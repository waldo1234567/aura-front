class RawAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs/*, outputs, parameters */) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        // input[0] is a Float32Array view for the current render quantum
        const channelData = input[0];

        // copy to a new Float32Array so we can transfer the underlying buffer
        const buf = new Float32Array(channelData.length);
        buf.set(channelData);

        // post transferable ArrayBuffer + sampleRate (global in worklet)
        this.port.postMessage({ type: 'frame', audio: buf.buffer, sampleRate }, [buf.buffer]);

        return true; // keep alive
    }
}

registerProcessor('raw-audio-processor', RawAudioProcessor);