import type { BackendReport, BackendFaceMetrics, BackendHrvMetrics, BackendVoiceMetrics, Flag, ActionItem } from "@/types";

function toNumber(v: any, fallback = 0): number {
    if (v == null) return fallback;
    if (typeof v === "number") return v;
    const parsed = Number(String(v).replace(/[^\d.\-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFaceMetrics(raw: any): BackendFaceMetrics {
    if (!raw) return { avgConfidence: 0, percentTime: {} };

    const avgConfidence =
        toNumber(raw.avgConfidence ?? raw.avg_confidence ?? raw["Avg confidence"] ?? raw.avg_conf) || 0;

    // percentTime may be `percentTime`, `percent_time`, or a map with emotion keys
    const percentTimeRaw = raw.percentTime ?? raw.percent_time ?? raw.percent_time_map ?? raw;
    const percentTime: { [k: string]: number } = {};
    if (percentTimeRaw && typeof percentTimeRaw === "object") {
        for (const [k, v] of Object.entries(percentTimeRaw)) {
            // skip numeric-looking top-level fields like avg_confidence
            if (k.toLowerCase().includes("avg") || k.toLowerCase().includes("confidence")) continue;
            const n = toNumber(v, NaN);
            if (!Number.isNaN(n)) percentTime[k] = n;
        }
    }

    return { avgConfidence, percentTime };
}

function normalizeHrvMetrics(raw: any) {
    if (!raw) return { RMSSD: 0, pNN50: 0, SDNN: 0 };
    const rmssd = toNumber(raw.RMSSD ?? raw.rmssd ?? raw.RMSSD ?? raw["RMSSD"]);
    const pnn50 = toNumber(raw.pNN50 ?? raw.pnn50 ?? raw["pNN50"]);
    const sdnn = toNumber(raw.SDNN ?? raw.sdnn ?? raw["SDNN"]);
    return { RMSSD: rmssd, pNN50: pnn50, SDNN: sdnn };
}

function normalizeVoiceMetrics(raw: any) {
    if (!raw) return { maxVolume: 0, avgPitch: 0, avgVolume: 0 };
    const maxVolume = toNumber(raw.maxVolume ?? raw.max_volume ?? raw["max_volume"]);
    const avgPitch = toNumber(raw.avgPitch ?? raw.avg_pitch ?? raw["avg_pitch"]);
    const avgVolume = toNumber(raw.avgVolume ?? raw.avg_volume ?? raw["avg_volume"]);
    return { maxVolume, avgPitch, avgVolume };
}

function normalizeFlags(rawFlags: any[] | undefined): Flag[] {
    if (!Array.isArray(rawFlags)) return [];
    return rawFlags.map((f, i) => {
        // backend may use text/snippet and timestampMs/timeMs
        const id = String(f.id ?? f._id ?? `f${i + 1}`);
        const snippet = String(f.text ?? f.snippet ?? "");
        const timeMs = toNumber(f.timestampMs ?? f.timeMs ?? f.ts ?? 0, 0);
        const confidence = typeof f.confidence === "number" ? f.confidence : toNumber(f.confidence, 0);
        const reason = String(f.keyword ?? f.reason ?? "");
        return { id, snippet, timeMs, confidence, reason };
    });
}

function normalizeActions(rawActions: any[] | undefined): ActionItem[] {
    if (!Array.isArray(rawActions)) return [];
    return rawActions.map((a, i) => ({
        id: String(a.id ?? `a${i + 1}`),
        text: String(a.text ?? a.action ?? ""),
        assignee: a.assignee ?? a.owner ?? null,
        due: a.due ?? a.dueDate ?? null,
        confidence: typeof a.confidence === "number" ? a.confidence : toNumber(a.confidence, 0),
    }));
}

export function normalizeBackendResponse(raw: any): BackendReport {
    if (!raw) return {
        faceMetrics: { avgConfidence: 0, percentTime: {} },
        hrvMetrics: { RMSSD: 0, pNN50: 0, SDNN: 0 },
        voiceMetrics: { maxVolume: 0, avgPitch: 0, avgVolume: 0 },
        reply: "",
    };

    const faceMetrics = normalizeFaceMetrics(raw.faceMetrics ?? raw.face_metrics ?? raw.face_metrics_json);
    const hrvMetrics = normalizeHrvMetrics(raw.hrvMetrics ?? raw.hrv_metrics ?? raw.hrv_metrics_json);
    const voiceMetrics = normalizeVoiceMetrics(raw.voiceMetrics ?? raw.voice_metrics ?? raw.voice_metrics_json);
    const reply = raw.reply ?? raw.aiReply ?? raw.summary ?? "";

    const flags = normalizeFlags(raw.flaggedExcerpts ?? raw.flagged_excerpts ?? raw.flagged ?? []);
    const actions = normalizeActions(raw.actionableHighlights ?? raw.actionable_highlights ?? raw.actions ?? []);

    const detectedLanguage = raw.detectedLanguage ?? raw.detected_language ?? null;
    const translatedTranscript = raw.translatedTranscript ?? raw.translated_transcript ?? null;

    const sessionId = raw.sessionId ?? raw.session_id ?? raw.id ?? null;
    const privacyNote = raw.privacyNote ?? raw.privacy_note ?? raw.privacy ?? null;

    return {
        faceMetrics,
        hrvMetrics,
        voiceMetrics,
        reply,
        riskSummary: raw.riskSummary ?? raw.risk_summary ?? null,
        flaggedExcerpts: flags,
        actionableHighlights: actions,
        detectedLanguage,
        translatedTranscript,
        sessionId,
        privacyNote,
    };
}