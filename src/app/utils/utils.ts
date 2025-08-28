// Robust autocorrelation-based pitch detection with normalization and threshold
export const detectPitch = (buffer: Float32Array, sampleRate: number): number | null => {
    if (!buffer || buffer.length === 0 || !Number.isFinite(sampleRate)) return null;

    const size = buffer.length;

    // Basic silence check (RMS)
    let rms = 0;
    for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / size);
    if (rms < 0.01) return null; // too quiet

    // sanity: finite values
    let minV = Infinity, maxV = -Infinity;
    for (let i = 0; i < size; i++) {
        const v = buffer[i];
        if (!Number.isFinite(v)) return null;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
    }
    if (maxV - minV < 1e-4) return null; // effectively constant / DC

    // Voice frequency bounds (Hz). Adjust if you need wider range.
    const MIN_F = 60;   // lowest expected pitch
    const MAX_F = 500;  // highest expected pitch

    // Convert to offset search range (samples)
    const maxOffset = Math.floor(sampleRate / MIN_F);
    const minOffset = Math.max(2, Math.floor(sampleRate / MAX_F)); // start at 2 to avoid lag=1

    let bestOffset = -1;
    let bestCorrelation = 0;

    for (let offset = minOffset; offset <= Math.min(maxOffset, Math.floor(size / 2)); offset++) {
        let sum = 0, norm = 0;
        for (let i = 0; i < size - offset; i++) {
            sum += buffer[i] * buffer[i + offset];
            norm += buffer[i] * buffer[i] + buffer[i + offset] * buffer[i + offset];
        }
        const corr = norm > 0 ? sum / Math.sqrt(norm) : 0;
        if (corr > bestCorrelation) {
            bestCorrelation = corr;
            bestOffset = offset;
        }
    }

    const CORR_THRESHOLD = 0.65; // permissive; raise to 0.7 if too many false positives
    if (bestOffset <= 0 || bestCorrelation < CORR_THRESHOLD) {
        return null;
    }

    const pitch = sampleRate / bestOffset;
    if (!Number.isFinite(pitch) || pitch < MIN_F || pitch > MAX_F) return null;
    return pitch;
};

export function computeEAR(eyeLandmarks: Array<{ x: number; y: number }>): number {
    const dist = (i: number, j: number): number =>
        Math.hypot(
            eyeLandmarks[i].x - eyeLandmarks[j].x,
            eyeLandmarks[i].y - eyeLandmarks[j].y
        );
    const A = dist(1, 5);
    const B = dist(2, 4);
    const C = dist(0, 3);
    return (A + B) / (2 * C);
}