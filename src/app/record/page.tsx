"use client";
import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useReport } from '@/context/ReportContext';
import LoadingScreen from '@/components/Loader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Camera, Headphones, Heart, CheckCircle, Mic, CircleStop, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import * as faceapi from 'face-api.js';
import * as Meyda from 'meyda';
import { computeEAR, detectPitch } from '@/app/utils/utils';
import TranscriptDiff from '@/components/TranscriptDiff';
import { VoiceCleaner } from '@/lib/cleaner';
import { VoiceAggregate } from '@/lib/cleaner';

export interface ExpressionSample {
    time: number;
    emotion: string | null;
    confidence: number;
    faceConfidence: number;
    ear: number;
    blinkRate: number;
}

export interface HRSample {
    time: number;
    bpm: number;
}

export interface VoiceSample {
    time: number;
    volume: number;
    pitch: number | null;
    mfcc: number[];
    spectralCentroid: number;
    zcr: number;
    valid: boolean; // true if valid sample
}


export interface BlinkRateSample {
    time: number;
    blinkRate: number;
}

export interface TimelineEntry {
    time: number;
    expression: ExpressionSample | null;
    hr: HRSample | null;
    voice: VoiceSample | null;
    blinkRate: number | null;
}

export interface Report {
    totalTicks: number;
    expression: { count: number; percent: string };
    heartRate: { count: number; percent: string };
    voice: { count: number; percent: string };
}

interface PolishedTranscriptShape {
    finalTranscript: string;
    edits?: string[];
}

// --- Animation Variants (can be defined in a separate file if you prefer) ---
const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
    initial: { opacity: 0 },
    animate: {
        opacity: 1,
        transition: {
            staggerChildren: 0.2,
        },
    },
};

const popIn = {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1, transition: { duration: 0.6 } },
};

export default function RecordPage() {
    // Modal state for prompt questions
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [currentPromptIdx, setCurrentPromptIdx] = useState(0);
    const psychiatristPrompts = [
        "How have you been feeling emotionally this past week?",
        "Have you noticed any changes in your sleep or appetite?",
        "Is there anything that's been worrying you lately?",
        "Can you tell me about any recent events that have affected your mood?",
        "Are you finding it difficult to enjoy things you used to?",
        "Do you feel supported by friends or family right now?",
        "Have you experienced any thoughts of self-harm or hopelessness?"
    ];
    const [bluetoothError, setBluetoothError] = useState<string | null>(null);
    const [wantHeartRate, setWantHeartRate] = useState<boolean | null>(null); // null = not chosen yet
    const [showHRPrompt, setShowHRPrompt] = useState<boolean>(() => true);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
    const [calibrated, setCalibrated] = useState<boolean>(false);
    const [cameraReady, setCameraReady] = useState<boolean>(false);
    const [hrReady, setHrReady] = useState<boolean>(false);
    const [audioReady, setAudioReady] = useState<boolean>(false);
    const [calibrationTime, setCalibrationTime] = useState<number>(0);
    const [sessionStatus, setSessionStatus] = useState<
        'idle' | 'calibrating' | 'recording' | 'polishing' | 'showingDiff' | 'sendingReport'
    >('idle');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [transcript, setTranscript] = useState<string>('');
    const [polishedTranscript, setPolishedTranscript] = useState<string>('');


    const expressionsBuffer = useRef<ExpressionSample[]>([]);
    const heartRateBuffer = useRef<HRSample[]>([]);
    const voiceBuffer = useRef<VoiceAggregate[]>([]);
    const blinkRateRef = useRef<number[]>([]);
    const blinkRateBuffer = useRef<BlinkRateSample[]>([]);

    const lastEAR = useRef<number>(1.0);

    const baselineStartRef = useRef<number>(0);
    const promptTimestamps = useRef<number[]>([]);

    const hrCharRef = useRef<any>(null); // BluetoothRemoteGATTCharacteristic | null
    const bleDeviceRef = useRef<any>(null); // BluetoothDevice | null
    const lastBpmRef = useRef<number | null>(null);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Float32Array | null>(null);
    const exprIntervalRef = useRef<number | null>(null);
    const voiceIntervalRef = useRef<number | null>(null);

    const sessionRunningRef = useRef<boolean>(false);
    const endingSessionRef = useRef<boolean>(false);

    const speechRecognitionRef = useRef<any>(null);
    const transcriptRef = useRef<string>('');


    const router = useRouter();
    const { setReportData } = useReport();


    useEffect(() => {
        const MODEL_URL = '/models';
        Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ])
            .then(() => setModelsLoaded(true))
            .catch(() => {
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL).then(() => setModelsLoaded(true));
            });
    }, []);

    async function fetchPolishedTranscript(raw: string) {
        console.log('Sending raw transcript length:', raw?.length);

        const res = await fetch('http://localhost:5555/api/v1/asr/polish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw })
        });
        const text = await res.text();
        console.log('Polish raw text:', text);
        let body;
        try {
            body = JSON.parse(text);
        } catch {
            // maybe server sent non-JSON text; attempt res.json() as fallback
            try { body = await res.json(); } catch (e) { body = text; }
        }

        // final defensive normalization
        if (typeof body === 'string' && body.trim().startsWith('{')) {
            try { body = JSON.parse(body); } catch (e) { /* leave as string */ }
        }

        // ensure shape
        if (!body || !body.finalTranscript) {
            console.warn('Polished transcript missing finalTranscript, falling back to raw');
            return { finalTranscript: raw, edits: [] };
        }
        return body;

    }

    async function sendReport(chosenTranscript: string | PolishedTranscriptShape, usePolished: boolean, timeline: any[]) {
        setSessionStatus('sendingReport');
        try {
            const transcriptString =
                typeof chosenTranscript === "string"
                    ? chosenTranscript
                    : chosenTranscript.finalTranscript;
            const response = await fetch('http://localhost:5555/api/v1/vlogs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: transcriptString,
                    timeline: timeline,
                    usePolished: usePolished
                })
            });
            if (!response.ok) throw new Error('Failed to generate report from API.');
            const reportData = await response.json();
            setReportData(reportData);
            try { window.localStorage.setItem('aura_report_data', JSON.stringify(reportData)); } catch (e) { /* ignore */ }
            router.push('/report');
        } catch (err) {
            console.error('Report generation failed:', err);
            alert('An error occurred while generating the report. Please try again.');
            setIsProcessing(false);
        }
    }


    const markPrompt = () => {
        promptTimestamps.current.push(Date.now());
        setShowPromptModal(true);
        setCurrentPromptIdx((idx) => (idx + 1) % psychiatristPrompts.length);
    };
    const isInReadingWindow = (time: number) =>
        promptTimestamps.current.some(t0 => time - t0 < 3000 && time >= t0);

    const initCameraAudio = async (): Promise<void> => {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });

        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await new Promise<void>(res => { videoRef.current!.onloadedmetadata = () => res(); });
            try { await videoRef.current.play(); } catch (e) { /* ignore autoplay restrictions */ }
            setCameraReady(true);
        }

        if (!audioCtxRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) throw new Error('AudioContext not supported in this browser');
            audioCtxRef.current = new AudioContextClass(); // default sample rate (typically 48000)
        }
        const audioCtx = audioCtxRef.current;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        analyserRef.current = analyser;
        dataArrayRef.current = new Float32Array(analyser.fftSize);

        setAudioReady(true)
    };

    const hrHandler = (e: Event) => {
        if (!sessionRunningRef.current || endingSessionRef.current) return;
        const value = (e.target as any).value!;
        const flags = value.getUint8(0);
        const bpm = (flags & 0x01)
            ? value.getUint16(1, true)
            : value.getUint8(1);
        const time = Date.now();
        console.log('[HR] Handler fired:', { bpm, time, sessionRunning: sessionRunningRef.current, endingSession: endingSessionRef.current });
        if (time - baselineStartRef.current >= 0 && !isInReadingWindow(time)) {
            const last = lastBpmRef.current;
            if (last == null || Math.abs(bpm - last) < 30) {
                heartRateBuffer.current.push({ time, bpm });
                console.log('[HR] Buffer push:', { time, bpm, bufferLen: heartRateBuffer.current.length });
            }
            lastBpmRef.current = bpm;
            setHrReady(true);
        }
    };

    const initHeartRate = async (): Promise<void> => {
        // TypeScript-safe navigator.bluetooth
        const navAny = navigator as any;
        if (!navAny.bluetooth) throw new Error('Web Bluetooth API not supported in this browser.');
        const device = await navAny.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['heart_rate'],
        });
        bleDeviceRef.current = device;
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('heart_rate');
        const char = await service.getCharacteristic('heart_rate_measurement');
        hrCharRef.current = char;
        char.addEventListener('characteristicvaluechanged', hrHandler);
        console.log('Heart rate monitor connected:', device.name);
        setHrReady(true);
        await char.startNotifications();
    };

    const getEarliestSampleTime = (): number | null => {
        const candidates: number[] = [];

        const firstTimeFromBuffer = (buf: any[] | undefined) => {
            if (!buf || buf.length === 0) return null;
            const first = buf[0];
            if (typeof first === 'number') return first;
            if (first && typeof first.time === 'number') return first.time;
            return null;
        };

        const exprT = firstTimeFromBuffer(expressionsBuffer.current);
        const hrT = firstTimeFromBuffer(heartRateBuffer.current);
        const voiceT = firstTimeFromBuffer(voiceBuffer.current);
        const blinkT = firstTimeFromBuffer(blinkRateBuffer.current); // some buffers store {time, blinkRate}, some might store number

        if (exprT != null) candidates.push(exprT);
        if (hrT != null) candidates.push(hrT);
        if (voiceT != null) candidates.push(voiceT);
        if (blinkT != null) candidates.push(blinkT);

        return candidates.length ? Math.min(...candidates) : null;
    };

    const alignStreams = (intervalMs = 500, slackMs = 500, debug = true): TimelineEntry[] => {
        const earliest = getEarliestSampleTime();
        const fallbackBaseline = baselineStartRef.current ?? Date.now();
        const start = earliest != null ? Math.max(0, earliest - slackMs) : fallbackBaseline;
        const end = Date.now();

        const timeline: TimelineEntry[] = [];
        let lastExpr: ExpressionSample | null = null;
        let lastHr: HRSample | null = null;
        let lastBlink: number | null = null;

        if (debug) console.log('[HR] alignStreams: heartRateBuffer length', heartRateBuffer.current.length);

        // helper: pick the item in arr with smallest |item.time - t|
        const pickClosestByTime = (arr: any[], t: number) => {
            if (!arr || arr.length === 0) return null;
            let best = arr[0];
            let bestDiff = Math.abs(best.time - t);
            for (let i = 1; i < arr.length; i++) {
                const cur = arr[i];
                const d = Math.abs(cur.time - t);
                if (d < bestDiff) { best = cur; bestDiff = d; }
            }
            return best;
        };

        // iterate timeline slots
        for (let t = start; t <= end; t += intervalMs) {
            // expressions (keep last in window)
            const exprs = expressionsBuffer.current.filter((p: any) => Math.abs(p.time - t) < intervalMs / 2);
            const expression: ExpressionSample | null = exprs.length ? exprs[exprs.length - 1] : lastExpr;
            if (expression) lastExpr = expression;

            // HR: dedupe entries within this window by hr.time, then pick the closest one
            const hrsWindow = heartRateBuffer.current.filter((p: any) => Math.abs(p.time - t) < intervalMs / 2);
            if (hrsWindow.length) {
                // keep last sample per exact hr.timestamp to avoid duplicates
                const lastByTs = new Map<number, any>();
                for (const h of hrsWindow) lastByTs.set(h.time, h);
                const uniqueHrs = Array.from(lastByTs.values());
                const chosenHr = pickClosestByTime(uniqueHrs, t);
                if (chosenHr) {
                    lastHr = chosenHr;
                    if (debug) console.log('[HR] chosen HR for t', t, chosenHr);
                }
            }
            const hr = lastHr;

            // blinks: support numbers or {time,..} objects — take the last in the window
            const blinksWindow = blinkRateBuffer.current.filter((b: any) => {
                const bt = typeof b === 'number' ? b : (b && b.time) ? b.time : null;
                return bt != null && Math.abs(bt - t) < intervalMs / 2;
            });
            const blinkValue = blinksWindow.length ? blinksWindow[blinksWindow.length - 1] : null;
            const blinkRate: number | null = blinkValue == null
                ? lastBlink
                : (typeof blinkValue === 'number'
                    ? blinkValue
                    : (typeof blinkValue.blinkRate === 'number'
                        ? blinkValue.blinkRate
                        : null));
            lastBlink = blinkRate ?? null;

            // voice: pick the closest pre-aggregated voice sample (do NOT re-average)
            let voice: VoiceSample | null = null;
            const voicesWindow = voiceBuffer.current.filter((p: any) => Math.abs(p.time - t) < intervalMs / 2);
            if (voicesWindow.length) {
                const chosenVoice = pickClosestByTime(voicesWindow, t);

                // if the chosenVoice is an aggregate produced by your cleaner, prefer its audioValid flag
                const aggAudioValid = (chosenVoice && (typeof chosenVoice.audioValid === 'boolean'))
                    ? chosenVoice.audioValid
                    : undefined;

                // defensive extraction of rms/volume
                const measuredVol = typeof chosenVoice.volume === 'number' ? chosenVoice.volume : (chosenVoice?.avgRms ?? 0);

                // sensible default threshold — tune by logging distribution (see diagnostics below)
                const RMS_THRESHOLD = 0.005; // start low; tune to your device

                const fallbackValid = (measuredVol > RMS_THRESHOLD) &&
                    (chosenVoice.pitch != null && chosenVoice.pitch > 50) &&
                    Array.isArray(chosenVoice.mfcc) && chosenVoice.mfcc.length > 0;

                const finalValid = (aggAudioValid !== undefined) ? aggAudioValid : fallbackValid;

                voice = {
                    time: t,
                    volume: measuredVol,
                    pitch: chosenVoice.pitch ?? null,
                    mfcc: Array.isArray(chosenVoice.mfcc) ? chosenVoice.mfcc : [],
                    spectralCentroid: typeof chosenVoice.spectralCentroid === 'number' ? chosenVoice.spectralCentroid : 0,
                    zcr: typeof chosenVoice.zcr === 'number' ? chosenVoice.zcr : 0,
                    valid: Boolean(finalValid)
                };

                if (debug) console.log('[VOICE] chosen voice', chosenVoice, 'finalValid=', finalValid);
            }

            timeline.push({ time: t, expression, hr, voice, blinkRate });
        }

        // Trim leading empty entries (no expression/hr/voice/blinkRate)
        const firstNonEmpty = timeline.findIndex(entry =>
            Boolean(entry.expression) || Boolean(entry.hr) || Boolean(entry.voice) || (entry.blinkRate != null)
        );

        return firstNonEmpty > 0 ? timeline.slice(firstNonEmpty) : timeline;
    };

    const calibrate = async (): Promise<void> => {
        if (!modelsLoaded) return alert('Models still loading');
        setSessionStatus('calibrating');
        setCameraReady(false);
        setAudioReady(false);
        setHrReady(false);
        setBluetoothError(null);
        let cameraOk = false, audioOk = false, hrOk = false;
        try {
            await initCameraAudio();
            cameraOk = true;
            audioOk = true;
        } catch (e) {
            alert('Camera or microphone initialization failed.');
        }
        if (wantHeartRate) {
            try {
                await initHeartRate();
                hrOk = true;
            } catch (e) {
                // Heart rate is optional, so don't block calibration
                hrOk = false;
                setBluetoothError('Failed to connect to heart rate monitor. Please try again.');
            }
        } else {
            hrOk = false;
        }
        // Wait a moment to let state update
        setTimeout(() => {
            if (!cameraOk || !audioOk) {
                setSessionStatus('idle');
                alert('Camera or microphone not ready. Please check permissions and try again.');
                return;
            }
            // Optionally warn if HR is not ready
            if (wantHeartRate && !hrOk && !bluetoothError) {
                alert('Heart rate monitor not detected. You can continue, but HR data will be missing.');
            }
            // Do a short test: check if video and audio are still ready
            if (!videoRef.current || !videoRef.current.srcObject) {
                setSessionStatus('idle');
                alert('Camera stream not detected.');
                return;
            }
            setCalibrationTime(0);
            const interval = setInterval(() => setCalibrationTime(t => t + 1), 1000);
            setTimeout(() => {
                clearInterval(interval);
                baselineStartRef.current = Date.now();
                setCalibrated(true);
                setSessionStatus('idle');
                alert('Calibration OK. You may start session.');
            }, 10000);
        }, 500);
    };

    const startSession = async (): Promise<void> => {
        if (!calibrated) { alert('Please calibrate first.'); return; }
        if (sessionRunningRef.current) { alert('Session already running.'); return; }
        sessionRunningRef.current = true;
        setSessionStatus('recording');
        expressionsBuffer.current = [];
        heartRateBuffer.current = [];
        voiceBuffer.current = [];
        promptTimestamps.current = [];
        lastBpmRef.current = null;
        setTranscript('');
        transcriptRef.current = '';

        const EAR_THRESHOLD = 0.22;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            let runningTranscript = '';
            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        runningTranscript += result[0].transcript;
                    } else {
                        interimTranscript += result[0].transcript;
                    }
                }
                transcriptRef.current = runningTranscript + interimTranscript;
                setTranscript(transcriptRef.current);
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                if (sessionRunningRef.current) {
                    recognition.stop();
                    setTimeout(() => recognition.start(), 500);
                }
            };

            recognition.onend = () => {
                if (sessionRunningRef.current) {
                    setTimeout(() => recognition.start(), 500);
                }
            };

            recognition.start();
            speechRecognitionRef.current = recognition;

        } else {
            alert('Speech Recognition API not supported in this browser. Transcript will be empty.');
        }

        exprIntervalRef.current = window.setInterval(async () => {
            if (!sessionRunningRef.current) return;
            const det = await faceapi.detectSingleFace(videoRef.current!, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions();
            if (!det?.landmarks) return;

            const leftEAR = computeEAR(det.landmarks.getLeftEye());
            const rightEAR = computeEAR(det.landmarks.getRightEye());
            const avgEAR = (leftEAR + rightEAR) / 2;
            if (lastEAR.current >= EAR_THRESHOLD && avgEAR < EAR_THRESHOLD) {
                blinkRateRef.current.push(Date.now());
            }
            lastEAR.current = avgEAR;

            const now = Date.now();
            blinkRateRef.current = blinkRateRef.current.filter(ts => now - ts < 5000);
            const blinkRate = blinkRateRef.current.length / 5;

            let bestEmotion: string | null = null;
            let bestVal = 0;
            Object.entries(det.expressions).forEach(([emo, val]) => {
                if (val > bestVal) { bestVal = val; bestEmotion = emo; }
            });

            const p: ExpressionSample = { time: now, emotion: bestEmotion, confidence: bestVal, faceConfidence: det.detection.score, ear: avgEAR, blinkRate };
            if (p.faceConfidence >= 0.5 && !isInReadingWindow(now)) {
                expressionsBuffer.current.push(p);
            }
        }, 1000);

        const audioCtx = audioCtxRef.current!;
        if (audioCtx.state === 'suspended') {
            try { await audioCtx.resume(); } catch (e) { /* ignore */ }
        }

        // ensure analyser exists (should be created in initCameraAudio, but double-check)
        if (!analyserRef.current) {
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            analyserRef.current = analyser;
            // connect stream source if video stream exists
            if (videoRef.current?.srcObject) {
                const srcNode = audioCtx.createMediaStreamSource(videoRef.current.srcObject as MediaStream);
                srcNode.connect(analyserRef.current);
            }
        }
        const cleaner = new VoiceCleaner();
        const bufferSize = analyserRef.current?.fftSize ?? 8192;

        const meydaAnalyzer = (Meyda as any).createMeydaAnalyzer({
            audioContext: audioCtxRef.current!,
            source: audioCtx.createMediaStreamSource(videoRef.current!.srcObject as MediaStream),
            bufferSize: bufferSize,
            featureExtractors: ['mfcc', 'rms', 'spectralCentroid', 'zcr'],
            callback: (features: Record<string, any>) => {
                const time = Date.now();
                const timeDomainBuffer = new Float32Array(analyserRef.current!.fftSize);
                analyserRef.current!.getFloatTimeDomainData(timeDomainBuffer);

                const sr = audioCtxRef.current?.sampleRate ?? null;
                const bufSize = analyserRef.current?.fftSize ?? null;
                // Run pitch detection
                let rawPitch = detectPitch(timeDomainBuffer, audioCtxRef.current!.sampleRate);
                console.log("Raw pitch detection:", rawPitch);
                if (!Number.isFinite(rawPitch as any)) {
                    rawPitch = null;
                }

                const aggregates = cleaner.addRawFrame(
                    {
                        time,
                        rms: features.rms,
                        pitch: rawPitch,
                        mfcc: features.mfcc,
                        spectralCentroid: features.spectralCentroid,
                        zcr: features.zcr,
                        sampleRate: audioCtxRef.current!.sampleRate,
                        bufferSize: analyserRef.current!.fftSize
                    }
                )
                if (aggregates && aggregates.length) {
                    for (const agg of aggregates) {
                        console.log("Voice aggregate:", agg);
                        voiceBuffer.current.push(agg);
                    }
                }
            }
        });
        voiceIntervalRef.current = meydaAnalyzer; // new ref
        meydaAnalyzer.start();
    };

    const endSession = async () => {
        sessionRunningRef.current = false;
        setSessionStatus('idle');
        if (exprIntervalRef.current) {
            clearInterval(exprIntervalRef.current);
            exprIntervalRef.current = null;
        }
        if (voiceIntervalRef.current) {
            try {
                const vref: any = voiceIntervalRef.current;
                if (vref && typeof vref.stop === 'function') {
                    vref.stop();
                } else if (typeof vref === 'number') {
                    clearInterval(vref);
                }
            } catch (e) { /* ignore */ }
            voiceIntervalRef.current = null;
        }

        if (speechRecognitionRef.current) {
            speechRecognitionRef.current.stop();
            speechRecognitionRef.current = null;
        }

        if (hrCharRef.current) {
            try {
                await hrCharRef.current.stopNotifications();
            } catch (e) { /* ignore */ }
            try {
                hrCharRef.current.removeEventListener('characteristicvaluechanged', hrHandler);
            } catch (e) { /* ignore */ }
        }
        if (bleDeviceRef.current?.gatt?.connected) {
            try {
                bleDeviceRef.current.gatt.disconnect();
            } catch (e) { /* ignore */ }
        }

        const stream = videoRef.current?.srcObject as MediaStream;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (videoRef.current) {
            try { videoRef.current.pause(); } catch (e) { /* ignore */ }
            videoRef.current.srcObject = null;
        }

        if (audioCtxRef.current) {
            try { await audioCtxRef.current.suspend(); } catch (e) { /* ignore */ }
            try { await audioCtxRef.current.close(); } catch (e) { /* ignore */ }
        }

        const timeline = alignStreams(500);
        console.log('Session ended. Timeline:', timeline);
        console.log('Transcript:', transcriptRef.current);
        setSessionStatus('polishing');
        fetchPolishedTranscript(transcriptRef.current)
            .then(pt => {
                console.log('Fetched polished transcript (pt):', pt, 'type:', typeof pt);
                setPolishedTranscript(pt);
                setSessionStatus('showingDiff');
                // The modal's onChoose will call sendReport(...)
            })
            .catch(err => {
                console.error('Polish call failed, proceeding with raw', err);
                setPolishedTranscript("");
                setSessionStatus('showingDiff');
            })

    };

    if (sessionStatus === 'sendingReport' || sessionStatus === 'polishing') {
        // Show a loading screen for both polishing and sending the report
        const message = sessionStatus === 'polishing'
            ? "Polishing transcript..."
            : "Generating your report...";
        return <LoadingScreen />; // You can pass a message prop if your component supports it
    }

    // --- UI Logic based on state ---
    const showSetup = !calibrated && sessionStatus === 'idle' && wantHeartRate !== null;
    const showCalibration = sessionStatus === 'calibrating';
    const showSession = calibrated && sessionStatus === 'idle';
    const showRecording = sessionStatus === 'recording';



    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 overflow-hidden relative">
            {/* Prompt Modal */}
            {showPromptModal && (
                <motion.div
                    initial={{ y: -200, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -200, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="fixed top-0 left-0 w-full flex justify-center z-50"
                >
                    <div className="bg-white rounded-b-2xl shadow-xl border border-border p-8 mt-0 max-w-md w-full flex flex-col items-center gap-6">
                        <h2 className="text-xl font-bold text-primary text-center">Session Prompt</h2>
                        <p className="text-lg text-foreground/90 text-center">{psychiatristPrompts[currentPromptIdx]}</p>
                        <Button className="mt-4 w-full" onClick={() => setShowPromptModal(false)}>Close</Button>
                    </div>
                </motion.div>
            )}
            {sessionStatus === 'showingDiff' && (
                <TranscriptDiff
                    rawTranscript={transcriptRef.current}
                    polishedTranscript={polishedTranscript}// This will be false here, but good practice
                    onChoose={(usePolished) => {
                        // This logic is now safer
                        const polishedText = (typeof polishedTranscript === 'object' && polishedTranscript)
                            ? polishedTranscript
                            : (typeof polishedTranscript === 'string' ? polishedTranscript : '');

                        const chosen = usePolished ? polishedText : transcriptRef.current;
                        console.log('Chosen transcript:', chosen, 'Use polished:', usePolished);
                        sendReport(chosen, usePolished, alignStreams(500));
                    }}
                    onClose={() => {
                        // Decide what happens on "Cancel". Maybe go back to an idle state.
                        setSessionStatus('idle');
                    }}
                />
            )}
            {/* Heart Rate Monitor Choice Modal */}
            {showHRPrompt && wantHeartRate === null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-card rounded-xl shadow-lg p-8 max-w-md w-full flex flex-col items-center gap-6">
                        <Heart className="w-12 h-12 text-primary mb-2" />
                        <h2 className="text-2xl font-bold text-center">Connect Heart Rate Monitor?</h2>
                        <p className="text-foreground/80 text-center">Would you like to connect a Bluetooth heart rate monitor for more accurate analysis? This is optional and can be skipped.</p>
                        <div className="flex gap-4 w-full">
                            <Button className="flex-1" onClick={() => { setWantHeartRate(true); setShowHRPrompt(false); }}>Yes, connect</Button>
                            <Button className="flex-1" variant="secondary" onClick={() => { setWantHeartRate(false); setShowHRPrompt(false); }}>No, skip</Button>
                        </div>
                    </div>
                </div>
            )}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-300px] left-[-300px] w-[800px] h-[800px] rounded-full bg-primary/20 blur-[200px] animate-pulse-slow" />
                <div className="absolute bottom-[-400px] right-[-400px] w-[900px] h-[900px] rounded-full bg-secondary/20 blur-[150px]" />
                <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-secondary/20 blur-[150px]" />
                <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/25 blur-[100px]" />
                <div className="absolute top-1/2 right-1/3 w-[600px] h-[600px] rounded-full bg-primary/15 blur-[180px]" />
                <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-secondary/15 blur-[200px]" />
            </div>
            <Card className="w-full max-w-4xl p-6 bg-card text-foreground shadow-lg z-10">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl font-bold">Mental Health Check-up</CardTitle>
                    <CardDescription className="mt-2 text-md text-foreground/70">
                        This is a private, supportive space. Your data is analyzed securely and not stored.
                    </CardDescription>
                </CardHeader>
                <CardContent className="mt-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="relative w-full h-80 bg-muted rounded-xl overflow-hidden flex items-center justify-center">
                            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline muted />
                            {!cameraReady && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-foreground">
                                    <Camera className="w-16 h-16 text-primary animate-pulse" />
                                    <p className="mt-4 text-center">Camera not active. Click Start Calibration to begin.</p>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-6">
                            <AnimatePresence mode="wait">
                                {showSetup && (
                                    <motion.div key="setup" {...fadeIn} className="flex flex-col gap-4">
                                        <h3 className="text-xl font-semibold">Step 1: Set Up and Calibrate</h3>
                                        <p className="text-foreground/80">
                                            We need to securely set up your camera, microphone, and an optional heart rate monitor to begin. This step also measures your baseline.
                                        </p>
                                        <Button onClick={calibrate} disabled={!modelsLoaded} className="w-full text-lg font-semibold">
                                            {modelsLoaded ? 'Start Calibration' : 'Loading Models...'}
                                        </Button>
                                    </motion.div>
                                )}
                                {showCalibration && (
                                    <motion.div key="calibrating" {...fadeIn} className="flex flex-col gap-4">
                                        <h3 className="text-xl font-semibold text-center">Calibrating...</h3>
                                        <p className="text-foreground/80 text-center">
                                            Please stay still and look at the camera for a few seconds.
                                        </p>
                                        {bluetoothError && wantHeartRate && (
                                            <div className="bg-red-100 text-red-700 rounded-lg p-3 text-center mb-2">
                                                {bluetoothError}
                                                <Button className="mt-2" onClick={async () => {
                                                    setBluetoothError(null);
                                                    setHrReady(false);
                                                    try {
                                                        await initHeartRate();
                                                        setHrReady(true);
                                                    } catch (e) {
                                                        setBluetoothError('Failed to connect to heart rate monitor. Please try again.');
                                                    }
                                                }}>Try Again</Button>
                                            </div>
                                        )}
                                        <Progress value={(calibrationTime / 10) * 100} className="h-2" />
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <Card className="flex items-center gap-4 p-4">
                                                <Camera className={`h-6 w-6 ${cameraReady ? 'text-primary' : 'text-muted-foreground'}`} />
                                                <p>Camera: {cameraReady ? 'Ready' : 'Waiting'}</p>
                                            </Card>
                                            <Card className="flex items-center gap-4 p-4">
                                                <Mic className={`h-6 w-6 ${audioReady ? 'text-primary' : 'text-muted-foreground'}`} />
                                                <p>Audio: {audioReady ? 'Ready' : 'Waiting'}</p>
                                            </Card>
                                            <Card className="flex items-center gap-4 p-4 col-span-2">
                                                <Heart className={`h-6 w-6 ${hrReady ? 'text-primary' : 'text-muted-foreground'}`} />
                                                <p>Heart Rate Monitor: {hrReady ? 'Connected' : 'Waiting'}</p>
                                            </Card>
                                        </div>
                                    </motion.div>
                                )}
                                {showSession && (
                                    <motion.div key="session" {...fadeIn} className="flex flex-col gap-4">
                                        <h3 className="text-xl font-semibold">Step 2: Start Your Session</h3>
                                        <p className="text-foreground/80">
                                            You're all set! Press 'Start Session' and talk about how you're feeling.
                                        </p>
                                        <Button onClick={startSession} className="w-full text-lg font-semibold">
                                            <Camera className="h-5 w-5 mr-2" />
                                            Start Session
                                        </Button>
                                        <Button variant="destructive" onClick={() => { endSession(); }} className="w-full">
                                            <CircleStop className="h-5 w-5 mr-2" />
                                            End Session
                                        </Button>
                                    </motion.div>
                                )}
                                {showRecording && (
                                    <motion.div key="recording" {...fadeIn} className="flex flex-col gap-4">
                                        <h3 className="text-xl font-semibold animate-pulse text-center">Recording...</h3>
                                        <p className="text-foreground/80 text-center">
                                            You are being monitored for emotional state. Feel free to talk and express yourself.
                                        </p>
                                        <Button onClick={markPrompt} className="w-full">
                                            <Mic className="h-5 w-5 mr-2" />
                                            Next Prompt
                                        </Button>
                                        <Button variant="destructive" onClick={() => { endSession(); }} className="w-full">
                                            <CircleStop className="h-5 w-5 mr-2" />
                                            End Session
                                        </Button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <p className="mt-8 text-center text-foreground/60 text-sm max-w-xl">
                <TriangleAlert className="inline-block h-4 w-4 mr-1 text-destructive" />
                This tool is not a substitute for professional medical advice. Always consult with a qualified mental health professional for a full assessment and personalized care.
            </p>
        </div>
    );
}
