type PostIn = { audio: ArrayBuffer; sampleRate: number };
type PostOut = { type: 'chunk', wav: ArrayBuffer } | { type: 'log', msg: string };

let rnnoise: any = null;
let rnInstance: any = null;
let FRAME_SIZE = 480; // RNNoise expects 480 sample frames at 48kHz usually
let srcSampleRate = 48000;

// helper: load wasm via fetch + instantiate
async function loadRnnoise(wasmUrl: string) {
    const resp = await fetch(wasmUrl);
    const bytes = await resp.arrayBuffer();
    const mod = await WebAssembly.instantiate(bytes, {});
    // The exact export interface depends on your wasm build.
    // Many RNNoise wasm builds expose simple APIs. We'll assume an exported "rnnoise_create" etc.
    return mod.instance;
}

// simple linear resampler (Float32) from srcRate -> dstRate
function resampleLinear(input: Float32Array, srcRate: number, dstRate: number) {
    if (srcRate === dstRate) return input.slice();
    const ratio = dstRate / srcRate;
    const outLen = Math.floor(input.length * ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
        const t = i / ratio;
        const i0 = Math.floor(t);
        const i1 = Math.min(i0 + 1, input.length - 1);
        const frac = t - i0;
        out[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return out;
}

// helper to encode Float32Array to 16-bit WAV (mono)
function floatTo16BitPCM(float32Array: Float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Uint8Array(buffer);
}

function makeWav(float32: Float32Array, sampleRate: number) {
    const pcm = floatTo16BitPCM(float32);
    const header = new ArrayBuffer(44);
    const dv = new DataView(header);
    function writeString(view: DataView, offset: number, str: string) {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }
    writeString(dv, 0, 'RIFF'); // ChunkID
    dv.setUint32(4, 36 + pcm.length, true); // ChunkSize
    writeString(dv, 8, 'WAVE');
    writeString(dv, 12, 'fmt ');
    dv.setUint32(16, 16, true); // Subchunk1Size
    dv.setUint16(20, 1, true); // AudioFormat (PCM)
    dv.setUint16(22, 1, true); // NumChannels
    dv.setUint32(24, sampleRate, true); // SampleRate
    dv.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    dv.setUint16(32, 2, true); // BlockAlign
    dv.setUint16(34, 16, true); // BitsPerSample
    writeString(dv, 36, 'data');
    dv.setUint32(40, pcm.length, true);
    // concat header + PCM
    const wav = new Uint8Array(44 + pcm.length);
    wav.set(new Uint8Array(header), 0);
    wav.set(pcm, 44);
    return wav.buffer;
}

// Simple RNNoise wrapper placeholder: adapt to your WASM exports
async function initRnnoise() {
    try {
        const inst = await loadRnnoise('/rnnoise.wasm'); // place rnnoise.wasm in /public
        rnInstance = inst;
        // depending on your build you might need to call exported functions to create state
        postMessage({ type: 'log', msg: 'RNNoise WASM loaded' } as PostOut);
    } catch (e) {
        postMessage({ type: 'log', msg: 'Failed to load RNNoise wasm: ' + e } as PostOut);
    }
}

// naive per-frame "denoise" that currently is a noop if WASM isn't available
function denoiseFrame(buffer: Float32Array): Float32Array {
    if (!rnInstance) {
        // no RNNoise: pass-through (or you can implement a simple spectral noise gate)
        return buffer;
    }
    // TODO: call into rnInstance exports; exact interface depends on build
    // Example pseudo-code:
    // const out = new Float32Array(buffer.length);
    // rnInstance.exports.denoise(bufferPtr, outPtr);
    // return out;
    return buffer;
}

// accumulators for building 16k chunks
let chunkAccumulator: Float32Array | null = null;
const targetChunkSeconds = 3; // send ~3s chunks to server
const targetSampleRate = 16000;
const targetChunkSize = targetChunkSeconds * targetSampleRate;

onmessage = async (ev: MessageEvent) => {
    if (ev.data === 'init') {
        await initRnnoise();
        return;
    }
    // incoming from AudioWorklet: { audio: ArrayBuffer, sampleRate }
    const data: PostIn = ev.data;
    const audioBuf = new Float32Array(data.audio);
    const sr = data.sampleRate || srcSampleRate;

    // process audio frames: if rnInstance present and sampleRate==48000 and FRAME_SIZE==480,
    // you might need to accumulate until FRAME_SIZE then call rnnoise per FRAME
    // We'll simply denoise the provided buffer (works fine for moderate frame sizes)
    const denoised = denoiseFrame(audioBuf);

    // resample to target (16k)
    const resamp = resampleLinear(denoised, sr, targetSampleRate);

    // accumulate
    if (!chunkAccumulator) chunkAccumulator = new Float32Array(0);
    const newAccum = new Float32Array(chunkAccumulator.length + resamp.length);
    newAccum.set(chunkAccumulator, 0);
    newAccum.set(resamp, chunkAccumulator.length);
    chunkAccumulator = newAccum;

    // when we have enough, encode and post chunk
    while (chunkAccumulator.length >= targetChunkSize) {
        const take = chunkAccumulator.slice(0, targetChunkSize);
        const wavBuf = makeWav(take, targetSampleRate);
        // send to main thread for upload
        new Worker('/denoiseWorker.js').postMessage({ type: 'chunk', wav: wavBuf } as PostOut, [wavBuf]);
        // keep remainder
        if (chunkAccumulator.length > targetChunkSize) {
            chunkAccumulator = chunkAccumulator.slice(targetChunkSize);
        } else {
            chunkAccumulator = new Float32Array(0);
        }
    }
};