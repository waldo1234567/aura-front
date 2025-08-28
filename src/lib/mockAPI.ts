import type { SessionSummary, ActionItem, Version } from "@/types";

export type ApiRawSession = any; // narrow if you want

function safeJsonParse<T = any>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch (e) { return fallback; }
}

function normalizeFlagEntry(f: any, idx: number) {
  const textRaw = (f && (f.text ?? f.snippet)) ?? String(f ?? '');
  const snippet = String(textRaw).replace(/^"(.*)"$/, '$1').replace(/^'(.+)'$/, '$1');
  return {
    id: f?.id ?? `flag-${idx}`,
    snippet,
    timeMs: (f?.timestampMs ?? f?.timeMs) ?? null,
    confidence: typeof f?.confidence === 'number' ? f.confidence : 0,
    reason: f?.reason ?? null
  };
}

function normalizeActionEntry(a: any) {
  return {
    id: a?.id ?? a?.actionId ?? Math.random().toString(36).slice(2),
    text: a?.text ?? a?.label ?? '',
    assignee: a?.assignee ?? null,
    due: a?.due ?? null,
    confidence: typeof a?.confidence === 'number' ? a.confidence : (a?.confidence ?? null)
  };
}

export async function fetchSessionSummary(id: string | number): Promise<SessionSummary> {
  // simulate server delay
  try {
    const url = `http://localhost:5555/sessions/${encodeURIComponent(String(id))}`; // adjust if your API path is different
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' } // add Authorization if needed
    });

    const payload = await res.json();

    const actionableRaw = payload.actionableHighlights ?? payload.actionable_highlights ?? payload.actionable ?? [];
    const flaggedRaw = payload.flaggedExcerpts ?? payload.flagged_excerpts ?? payload.flagged ?? [];

    const actionableArr = Array.isArray(actionableRaw) ? actionableRaw : safeJsonParse<any[]>(actionableRaw, []);
    const flaggedArr = Array.isArray(flaggedRaw) ? flaggedRaw : safeJsonParse<any[]>(flaggedRaw, []);

    const flags = (flaggedArr || []).map((f: any, i: number) => normalizeFlagEntry(f, i));
    const actions = (actionableArr || []).map((a: any) => normalizeActionEntry(a));

    // risk summary may be object already
    const risk = payload.riskSummary ?? payload.risk_summary ?? {};
    const riskScore = Number(risk?.score ?? payload?.riskScore ?? 0);
    const riskLevel = (risk?.level ?? payload?.riskLevel ?? 'medium') as any;
    const confidence = Number(payload?.confidence ?? risk?.confidence ?? 0);

    const transcript = payload.transcript ?? payload.transcriptText ?? payload.translatedTranscript ?? '';

    return {
      sessionId: String(id),
      riskScore: Number(riskScore ?? 0),
      riskLevel: riskLevel ?? 'medium',
      confidence: Number(confidence ?? 0),
      flags,
      actions,
      transcript,
      detectedLanguage: payload.detectedLanguage ?? payload.detected_language ?? null
    };
  } catch (error) {
    throw new Error(`Failed to fetch session summary: ${error}`);
  }
}

export async function fetchVersions(): Promise<Version[]> {
  await new Promise(r => setTimeout(r, 80));
  return [
    { id: "v1", transcriptText: "Original transcript (raw)", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), versionNumber: 1 },
    { id: "v2", transcriptText: "Polished transcript (auto)", createdAt: new Date().toISOString(), versionNumber: 2 }
  ];
}

export async function translateText(text: string, to = "en") {
  await new Promise(r => setTimeout(r, 200));
  // simple mock - prepend
  return { translated: text + " (translated → " + to + ")", detectedLanguage: "es", confidence: 0.86 };
}