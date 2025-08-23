export type ActionItem = {
    id: string;
    text: string;
    assignee?: string | null;
    due?: string | null;
    confidence?: number;
};

export type Flag = {
    id: string;
    snippet: string;
    timeMs: number;
    confidence: number;
    reason: string;
};

export type BackendFaceMetrics = {
  avgConfidence?: number;
  percentTime?: { [key: string]: number };
};


export type BackendHrvMetrics = {
  RMSSD?: number;
  pNN50?: number;
  SDNN?: number;
  // accept lower-case variants too
  rmssd?: number;
  pnn50?: number;
  sdnn?: number;
};

export type BackendVoiceMetrics = {
  maxVolume?: number;
  avgPitch?: number;
  avgVolume?: number;
  // accept snake_case variants
  max_volume?: number;
  avg_pitch?: number;
  avg_volume?: number;
};

export type BackendSpiderMetrics = {
  stressLevel?: number;
  moodLevel?: number;
  socialWithdrawal?: number;
  irritability?: number;
  cognitiveFatigue?: number;
  arousalLevel?: number;
  // accept alternative keys
  stress?: number;
  mood?: number;
  socialWithdrawalLevel?: number;
  irritabilityLevel?: number;
  cognitiveFatigueLevel?: number;
  arousal?: number;
}

export type BackendSpiderData = {
  // canonical scored map (keys may vary: Stress | stress | SocialWithdrawal etc.)
  scores?: { [key: string]: number };
  // optional raw line from model or fallback string (for debugging/trace)
  rawLine?: string;
  source?: string;
  modelDiff?: number;
  confidence?: number;
};

export type BackendReport = {
  faceMetrics: BackendFaceMetrics;
  hrvMetrics: BackendHrvMetrics;
  voiceMetrics: BackendVoiceMetrics;
  reply?: string;
  spiderData?: BackendSpiderData;
  // backend-only fields (optional)
  riskSummary?: any;
  flaggedExcerpts?: any;
  actionableHighlights?: any;
  detectedLanguage?: string | null;
  translatedTranscript?: string | null;
  sessionId?: string | number;
  privacyNote?: string;
};

export type Version = {
    id: string;
    transcriptText: string;
    createdAt: string;
    versionNumber: number;
};

export type SessionSummary = {
    sessionId: string;
    riskScore: number;
    riskLevel: "low" | "medium" | "high" | "emergency";
    confidence: number;
    flags: Flag[];
    actions: ActionItem[];
    transcript: string;
    detectedLanguage?: string | null;
};