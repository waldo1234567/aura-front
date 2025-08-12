import rnnoiseFactory from '/rnnoise/rnnoise.js';

let ready = false;
let statePtr;
let rnnoiseModule;
let processFrame;
let heapF32;
let inputPtr;
let outputPtr;

function resampleLinearFloat32(src, srcRate, dstRate) {
    if (srcRate === dstRate) return src;
    const ratio = srcRate / dstRate;
    const newLen = Math.round(src.length / ratio);
    const out = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.min(src.length, Math.floor((i + 1) * ratio));
        let sum = 0, count = 0;
        for (let j = start; j < end; j++) { sum += src[j]; count++; }
        out[i] = count ? sum / count : 0;
    }
    return out;
}

function floatTo16BitPCM(float32) {
    const l = float32.length;
    const ab = new ArrayBuffer(l * 2);
    const dv = new DataView(ab);
    let offset = 0;
    for (let i = 0; i < l; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, float32[i]));
        dv.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return ab;
}



// WAV encoder (simple PCM 16-bit mono)
function encodeWav16FromFloat32(float32, sampleRate = 16000) {
    const pcmAB = floatTo16BitPCM(float32);
    const pcmBytes = new Uint8Array(pcmAB);
    const buffer = new ArrayBuffer(44 + pcmBytes.length);
    const view = new DataView(buffer);
    function writeStr(offset, s) { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); }
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + pcmBytes.length, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, pcmBytes.length, true);
    new Uint8Array(buffer, 44).set(pcmBytes);
    return buffer;
}

// Initialize RNNoise
async function initRNNoise() {
    rnnoiseModule = await rnnoiseFactory({
        locateFile: (path) => `/rnnoise/${path}`
    });

    // RNNoise API bindings
    const rn_create = rnnoiseModule._rnnoise_create;
    const rn_destroy = rnnoiseModule._rnnoise_destroy;
    const rn_process = rnnoiseModule._rnnoise_process_frame;
    statePtr = rn_create();

    // Allocate memory for one frame in / out
    const frameSize = 480; // RNNoise expects exactly 480 samples per frame
    inputPtr = rnnoiseModule._malloc(frameSize * 4);
    outputPtr = rnnoiseModule._malloc(frameSize * 4);
    heapF32 = rnnoiseModule.HEAPF32;

    let rnProcessOrder = null; // null = unknown, 0/1 = chosen order

    processFrame = (frame) => {
        const frameSize = frame.length;
        // write input into heap
        heapF32.set(frame, inputPtr / 4);

        // helper to call low-level binding in a given order and read output
        const callAndRead = (order) => {
            if (order === 0) {
                // original assumed order: (statePtr, outPtr, inPtr)
                rnnoiseModule._rnnoise_process_frame(statePtr, outputPtr, inputPtr);
            } else {
                // alternate assumed order: (statePtr, inPtr, outPtr)
                rnnoiseModule._rnnoise_process_frame(statePtr, inputPtr, outputPtr);
            }
            // read back output
            const out = new Float32Array(frameSize);
            out.set(heapF32.subarray(outputPtr / 4, outputPtr / 4 + frameSize));
            return out;
        };

        // If we already know working order, use it
        if (rnProcessOrder !== null) {
            const out = callAndRead(rnProcessOrder);
            return out;
        }

        // Try order 0 first
        try {
            const out0 = callAndRead(0);
            if (!isAllZero(out0)) {
                rnProcessOrder = 0;
                self.postMessage({ type: 'dbg', stage: 'rn_detect', chosen: 0, msg: 'order0 works' });
                return out0;
            }
        } catch (e) {
            self.postMessage({ type: 'dbg', stage: 'rn_err', order: 0, msg: String(e) });
        }

        // Try order 1
        try {
            const out1 = callAndRead(1);
            if (!isAllZero(out1)) {
                rnProcessOrder = 1;
                self.postMessage({ type: 'dbg', stage: 'rn_detect', chosen: 1, msg: 'order1 works' });
                return out1;
            }
        } catch (e) {
            self.postMessage({ type: 'dbg', stage: 'rn_err', order: 1, msg: String(e) });
        }

        // fallback: return input copy (to avoid sending silence)
        self.postMessage({ type: 'dbg', stage: 'rn_detect', chosen: -1, msg: 'both orders produced zeros — returning passthrough' });
        return Float32Array.from(frame);
    };
    ready = true;
    self.postMessage({ type: 'log', msg: 'RNNoise initialized successfully (no cwrap)' });
    self.postMessage({ type: 'ready', ready });
}

let accumSrc = new Float32Array(0);
let srcRate = 48000;             // will be set per-incoming message if provided
const OUT_RATE = 16000;
const RN_FRAME = 480;            // samples/frame at 16k for RNNoise

// How many RNNoise frames to gather per chunk (e.g. 25 frames => 25*480/16000 = 0.75s)
const FRAMES_PER_CHUNK = 25;
let processedFramesBuffer = [];

function firstNSamples(arr, n = 10) {
    if (!arr) return [];
    const out = [];
    for (let i = 0; i < Math.min(n, arr.length); i++) out.push(Number(arr[i].toFixed(6)));
    return out;
}

function isAllZero(arr, eps = 1e-8) {
    for (let i = 0; i < arr.length; i++) if (Math.abs(arr[i]) > eps) return false;
    return true;
}

// try calling optional init if available
if (typeof rnnoiseModule?._rnnoise_init === 'function') {
    try { rnnoiseModule._rnnoise_init(); } catch (e) { /* ignore */ }
}


self.onmessage = (e) => {
    const { type, audio, sampleRate } = e.data;

    if (type === 'init') {
        initRNNoise(); // your existing init
        return;
    }

    if (type !== 'audio' || !ready) return;

    // audio may be ArrayBuffer (transferred); create Float32 view without copy
    const incoming = (audio instanceof ArrayBuffer) ? new Float32Array(audio) : Float32Array.from(audio);
    if (sampleRate && typeof sampleRate === 'number') srcRate = sampleRate;

    // DEBUG: show incoming few samples
    self.postMessage({ type: 'dbg', stage: 'incoming', sr: srcRate, len: incoming.length, samples: firstNSamples(incoming, 12) });

    // append incoming to accumSrc
    const joined = new Float32Array(accumSrc.length + incoming.length);
    joined.set(accumSrc, 0);
    joined.set(incoming, accumSrc.length);
    accumSrc = joined;

    // resample accum to OUT_RATE
    const down = resampleLinearFloat32(accumSrc, srcRate, OUT_RATE);
    self.postMessage({ type: 'dbg', stage: 'resampled', outLen: down.length, samples: firstNSamples(down, 12) });

    // Process as many RN frames (480@16k) as possible
    const availableFrames = Math.floor(down.length / RN_FRAME);
    if (availableFrames === 0) {
        // keep accumSrc for next incoming message
        return;
    }

    // For frames we will consume from 'down' array. But we must also compute how many source samples that consumed corresponds to,
    // so we can remove them from accumSrc. We'll do that after processing.
    for (let f = 0; f < availableFrames; f++) {
        const start = f * RN_FRAME;
        const frame = down.subarray(start, start + RN_FRAME);
        self.postMessage({ type: 'dbg', stage: 'frame_before_rn', frameIndex: f, samples: firstNSamples(frame, 12) });
        // rnnoise processing expects Float32 length RN_FRAME; your processFrame writes into HEAPF32 and returns Float32 slice
        let denoisedFrame;
        try {
            denoisedFrame = processFrame(frame); // returns Float32Array length RN_FRAME
        } catch (err) {
            // fallback - use input frame unchanged
            self.postMessage({ type: 'log', msg: 'rnnoise processFrame failed: ' + err });
            denoisedFrame = Float32Array.from(frame);
        }
        processedFramesBuffer.push(denoisedFrame);

        // when we have enough processed frames, emit a chunk (downsample not needed; they are at OUT_RATE)
        if (processedFramesBuffer.length >= FRAMES_PER_CHUNK) {
            // concatenate processed frames into one Float32Array
            const totalSamples = processedFramesBuffer.length * RN_FRAME;
            const all = new Float32Array(totalSamples);
            for (let i = 0; i < processedFramesBuffer.length; i++) {
                all.set(processedFramesBuffer[i], i * RN_FRAME);
            }
            processedFramesBuffer.length = 0;

            // encode WAV at 16k
            const wavAB = encodeWav16FromFloat32(all, OUT_RATE);
            // send to main thread (transferable)
            self.postMessage({ type: 'chunk', denoised: true, wav: wavAB }, [wavAB]);
        }

        self.postMessage({ type: 'dbg', stage: 'frame_after_rn', frameIndex: f, samples: firstNSamples(denoisedFrame, 12) });

    }

    // Remove consumed samples from accumSrc.
    // We consumed `consumedOutSamples = availableFrames * RN_FRAME` at OUT_RATE.
    // Map to input samples count: consumedSrc = Math.round(consumedOutSamples * (srcRate / OUT_RATE))
    const consumedOutSamples = availableFrames * RN_FRAME;
    const consumedSrc = Math.round(consumedOutSamples * (srcRate / OUT_RATE));
    // drop consumedSrc from accumSrc
    accumSrc = accumSrc.subarray(consumedSrc);
};