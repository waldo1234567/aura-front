const RMS_SILENCE_THRESHOLD = 0.0015;     // drop frames quieter than this
const MIN_PITCH_HZ = 50;                  // valid human pitch range
const MAX_PITCH_HZ = 400;
const SMOOTH_EMA_ALPHA = 0.35;            // smoothing strength (0..1)
const MEDIAN_WIN = 3;                     // odd number; median filter window (frames)
const AGG_WINDOW_MS = 1000;               // aggregate into 1-second chunks
const MAX_PITCH_GAP_FRAMES = 6;

type VoiceFrameRaw = {
    time: number;
    rms: number;
    pitch: number | null;
    mfcc: number[];
    spectralCentroid: number;      // Hz (Meyda)
    zcr: number;                   // raw count over buffer
    sampleRate: number;
    bufferSize: number;
};

type VoiceFrameClean = {
    time: number;
    rms: number;
    pitch: number | null;          // smoothed, interpolated (within range), else null
    mfcc: number[];                // lightly smoothed
    spectralCentroid: number;      // smoothed Hz
    zcrPerSec: number;             // normalized to /sec
};

export type VoiceAggregate = {
    time: number;                 // midpoint of [tStart, tEnd]
    volume: number;               // avgRms
    pitch: number | null;         // avgPitchHz
    mfcc: number[];               // mfccMeansFirst5
    spectralCentroid: number;     // avgSpectralCentroidHz
    zcr: number;                  // medianZcrPerSec
    audioValid: boolean;   // robustness indicators
};

const median = (xs: number[]) => {
    const s = xs.slice().sort((a, b) => a - b);
    const n = s.length;
    return n ? s[Math.floor(n / 2)] : 0;
};
const ema = (prev: number | null, next: number, alpha = SMOOTH_EMA_ALPHA) =>
    prev == null ? next : alpha * next + (1 - alpha) * prev;

function medianSmooth(series: number[], win = MEDIAN_WIN): number[] {
    if (win < 3 || win % 2 === 0) return series.slice();
    const rad = Math.floor(win / 2);
    const out = series.slice();
    for (let i = 0; i < series.length; i++) {
        const start = Math.max(0, i - rad);
        const end = Math.min(series.length, i + rad + 1);
        out[i] = median(series.slice(start, end));
    }
    return out;
}

function clampPitch(p: number | null): number | null {
    if (p == null || !Number.isFinite(p)) return null;
    return (p >= MIN_PITCH_HZ && p <= MAX_PITCH_HZ) ? p : null;
}

function interpolatePitchShortGaps(pitches: (number | null)[], maxGap = MAX_PITCH_GAP_FRAMES): (number | null)[] {
    const out = pitches.slice();
    let i = 0;
    while (i < out.length) {
        if (out[i] != null) { i++; continue; }
        const gapStart = i;
        while (i < out.length && out[i] == null) i++;
        const gapEnd = i - 1;
        const gapLen = gapEnd - gapStart + 1;
        const left = gapStart - 1 >= 0 ? out[gapStart - 1] : null;
        const right = i < out.length ? out[i] : null;
        if (left != null && right != null && gapLen <= maxGap) {
            // linear interpolate
            for (let k = 0; k < gapLen; k++) {
                const t = (k + 1) / (gapLen + 1);
                out[gapStart + k] = (1 - t) * (left as number) + t * (right as number);
            }
        }
    }
    return out;
}

export class VoiceCleaner {
    private frameBuf: VoiceFrameClean[] = [];
    private emaRms: number | null = null;
    private emaPitch: number | null = null;
    private emaCentroid: number | null = null;
    private lastFlushT = 0;

    addRawFrame(f: VoiceFrameRaw): VoiceAggregate[] | null {
        // 1) Silence gate
        if (!Number.isFinite(f.rms) || f.rms < RMS_SILENCE_THRESHOLD) {
            // Keep a marker frame only if you want cadence; otherwise drop:
            return this.maybeFlush(f.time);
        }

        // 2) Normalize ZCR to /sec
        const zcrPerSec = (f.zcr && f.bufferSize && f.sampleRate)
            ? (f.zcr / f.bufferSize) * f.sampleRate
            : 0;

        // 3) Clamp pitch & prepare for smoothing
        const pClamped = clampPitch(f.pitch);

        // 4) Light EMA smoothing
        this.emaRms = ema(this.emaRms, f.rms);
        this.emaCentroid = ema(this.emaCentroid, f.spectralCentroid);
        if (pClamped != null) this.emaPitch = ema(this.emaPitch, pClamped);

        // 5) Push cleaned frame (MFCC left raw for per-chunk robust stats)
        this.frameBuf.push({
            time: f.time,
            rms: this.emaRms ?? f.rms,
            pitch: pClamped ?? this.emaPitch, // keep last good EMA if present
            mfcc: f.mfcc.slice(),
            spectralCentroid: this.emaCentroid ?? f.spectralCentroid,
            zcrPerSec
        });

        return this.maybeFlush(f.time);
    }

    private maybeFlush(nowT: number): VoiceAggregate[] | null {
        if (this.lastFlushT === 0) this.lastFlushT = nowT;
        if (nowT - this.lastFlushT < AGG_WINDOW_MS) return null;

        // Cut out the window
        const windowStart = this.lastFlushT;
        const windowEnd = nowT;
        const windowFrames = this.frameBuf.filter(fr => fr.time >= windowStart && fr.time < windowEnd);

        // Remove from buffer
        this.frameBuf = this.frameBuf.filter(fr => fr.time >= windowEnd);
        this.lastFlushT = nowT;

        if (windowFrames.length === 0) return null;

        // Build aggregate
        const agg = this.aggregateWindow(windowFrames, windowStart, windowEnd);
        return [agg];
    }

    private aggregateWindow(frames: VoiceFrameClean[], tStart: number, tEnd: number): VoiceAggregate {
        const n = frames.length;
        const rmsArr = frames.map(f => f.rms);
        const centroidArr = frames.map(f => f.spectralCentroid);
        const zcrArr = frames.map(f => f.zcrPerSec);

        // Pitch: median smoothing + interpolation
        let pitchArr = frames.map(f => f.pitch);
        const rawPitchNums = pitchArr.filter((p): p is number => p != null && Number.isFinite(p));
        if (rawPitchNums.length >= 3) {
            pitchArr = interpolatePitchShortGaps(pitchArr, MAX_PITCH_GAP_FRAMES);
        }
        const pitchNums = pitchArr.filter((p): p is number => p != null);
        const avgPitch = pitchNums.length
            ? pitchNums.reduce((a, b) => a + b, 0) / pitchNums.length
            : null;

        // MFCC robust stats (first 5 coefs): mean only (for AI input)
        const K = Math.min(frames[0].mfcc.length, 5);
        const mfccMeansFirst5: number[] = [];
        for (let k = 0; k < K; k++) {
            const coefSeries = frames.map(f => f.mfcc[k]);
            const mean = coefSeries.reduce((s, x) => s + x, 0) / coefSeries.length;
            mfccMeansFirst5.push(mean);
        }

        // Data quality
        const maxAbsMfcc = Math.max(...frames.flatMap(f => f.mfcc.map(Math.abs)));
        const mostlySilence = (rmsArr.filter(r => r < RMS_SILENCE_THRESHOLD).length / n) > 0.5;
        const audioValid = n >= 5 && !mostlySilence && maxAbsMfcc < 1000;
        
        // ✅ VoiceAggregate compatible with VoiceSample
        return {
            time: Math.floor((tStart + tEnd) / 2),   // midpoint
            volume: rmsArr.reduce((a, b) => a + b, 0) / n,
            pitch: avgPitch,
            mfcc: mfccMeansFirst5,
            spectralCentroid: centroidArr.reduce((a, b) => a + b, 0) / n,
            zcr: median(zcrArr),
            audioValid                                  // <-- extra flag
        };
    }
}