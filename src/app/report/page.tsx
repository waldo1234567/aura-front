// src/app/report/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import type { BackendSpiderData } from '@/types';
import { useReport } from '@/context/ReportContext';
import { BackendReport } from '@/lib/mockReportData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import SpiderChart from '@/components/SpiderChart';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Smile, Heart, Volume2, Lightbulb, TrendingUp, Sparkles, Target, ChevronDown } from 'lucide-react'; // Added Sparkles icon
import LoadingScreen from '@/components/Loader';


function simpleMarkdownToHtml(s: string): string {
    if (!s) return "";
    let html = s
        .replace(/\*\*([\s\S]*?)\*\*/g, "<strong>$1</strong>") // bold
        .replace(/\*([\s\S]*?)\*/g, "<em>$1</em>"); // italic

    // preserve line breaks within a paragraph
    html = html.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("");
    return html;
}

type ParsedObservation = { heading?: string; bullets: string[] };
type ParsedReply = {
    observations: ParsedObservation[];
    actionable: string[];
    flagged: string[];
};

function normalizeLineEndings(s: string) {
    return s ? s.replace(/\r\n?/g, '\n') : '';
}

/** canonicalize common headers */
function canonicalHeading(rawHeader: string): string {
    const h = rawHeader.trim();
    const withoutPrefix = h.replace(/^OBSERVATIONS\s*[—\-–:]\s*/i, '').trim();
    if (/transcript/i.test(withoutPrefix)) return 'Transcript';
    if (/time[-\s]*domain|hrv\s*\(time/i.test(withoutPrefix)) return 'HRV (time-domain)';
    if (/frequency[-\s]*domain|hrv\s*\(frequency|lf\/hf/i.test(withoutPrefix)) return 'HRV (frequency-domain)';
    if (/facial/i.test(withoutPrefix)) return 'Facial expressions';
    if (/voice/i.test(withoutPrefix)) return 'Voice';
    return withoutPrefix || h;
}

function splitIntoBullets(rawContent: string): string[] {
    if (!rawContent) return [];
    const content = normalizeLineEndings(rawContent).trim();

    // bullet char class (covers many common unicode bullets and hyphen/asterisk)
    const bulletChars = '[•\u2022\u2023\u25E6\u2043\\-\\*\\u2024\\u2027\\u2026]';
    const bulletSep = new RegExp(`(?:\\n[\\s\\u00A0]*${bulletChars}\\s*|^[\\s\\u00A0]*${bulletChars}\\s*)`, 'm');

    // 1) explicit bullets
    if (bulletSep.test(content)) {
        const rawParts = content.split(bulletSep);
        const parts = rawParts
            .map(s => s.replace(new RegExp(`^[\\s\\u00A0]*${bulletChars}\\s*`), '').trim())
            .filter(Boolean)
            .map(s => s.replace(/\s*\n\s*/g, ' '));
        if (parts.length) return parts;
    }

    // 2) numbered lists
    if (/\n\s*\d+\.\s+/.test(content) || /^\s*\d+\.\s+/.test(content)) {
        const parts = content
            .split(/\n\s*\d+\.\s*/)
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => s.replace(/\s*\n\s*/g, ' '));
        if (parts.length) return parts;
    }

    // 3) paragraph gaps
    const paras = content.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    if (paras.length > 1) return paras.map(s => s.replace(/\s*\n\s*/g, ' '));

    // fallback: single normalized block
    return [content.replace(/\s*\n\s*/g, ' ').trim()];
}

function parseReply(reply: string): ParsedReply {
    if (!reply) return { observations: [], actionable: [], flagged: [] };

    const text = normalizeLineEndings(reply);
    // remove trailing STRUCTURED_SECTION_END chunk so it doesn't get included
    const cleanedText = text.replace(/STRUCTURED_SECTION_END[\s\S]*$/i, '').trim();

    // find header matches and their positions
    const headerRe = /^\s*(\d+)\)\s*([^\n\r]+)/gm;
    const matches: { index: number; matchText: string; headerLine: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = headerRe.exec(cleanedText)) !== null) {
        matches.push({ index: m.index, matchText: m[0], headerLine: (m[2] || '').trim() });
    }

    // fallback: no headers found -> treat whole thing as Transcript
    if (!matches.length) {
        const bullets = splitIntoBullets(cleanedText);
        return { observations: [{ heading: 'Transcript', bullets }], actionable: [], flagged: [] };
    }

    // slice sections deterministically using matchText.length
    const sections: { headerLine: string; content: string }[] = [];
    for (let i = 0; i < matches.length; i++) {
        const cur = matches[i];
        const next = matches[i + 1];
        const contentStart = cur.index + cur.matchText.length; // deterministic slice start AFTER the matched header text
        const contentEnd = next ? next.index : cleanedText.length;
        let content = cleanedText.slice(contentStart, contentEnd).trim();

        // **Important cleanup**: if the content still begins with a header-like line (sometimes formatting
        // results in header repeating), strip leading header-like lines such as "2) OBSERVATIONS — ..." or "OBSERVATIONS — ...:"
        // Remove only one or two obvious header lines to be safe
        content = content.replace(/^\s*(?:\d+\)\s*)?OBSERVATIONS\s*[—\-–:]\s*[^\n\r]*\n?/i, '').trim();
        content = content.replace(/^\s*\d+\)\s*[^\n\r]*\n?/, '').trim();

        sections.push({ headerLine: cur.headerLine, content });
    }

    const observations: ParsedObservation[] = [];
    let actionable: string[] = [];
    let flagged: string[] = [];

    for (const sec of sections) {
        const headerRaw = sec.headerLine;
        const contentRaw = sec.content;
        const upper = headerRaw.toUpperCase();
        const heading = canonicalHeading(headerRaw);

        if (/ACTIONABLE|ACTIONABLE_HIGHLIGHTS|💡/i.test(upper)) {
            actionable = actionable.concat(splitIntoBullets(contentRaw));
        } else if (/FLAGGED_EXCERPTS?|FLAGGED_EXCERPT/i.test(upper)) {
            flagged = flagged.concat(splitIntoBullets(contentRaw));
        } else {
            const bullets = splitIntoBullets(contentRaw);
            if (bullets.length) observations.push({ heading, bullets });
        }
    }

    // normalize and dedupe
    const uniq = (arr: string[]) => Array.from(new Set((arr || []).map(s => s.trim()))).filter(Boolean);
    actionable = uniq(actionable);
    flagged = uniq(flagged);

    return { observations, actionable, flagged };
}
// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2,
        },
    },
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
};

const renderObservations = (parts: { heading?: string; bullets: string[] }[]): React.ReactNode => {
    return parts.map((part, index) => (
        <motion.div
            key={index}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="mb-4"
        >
            <Card className="border border-border hover:shadow-md transition-all duration-200 bg-card/60 backdrop-blur">
                <CardHeader className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-primary font-bold text-xl">{index + 1}</span>
                        {part.heading && <span className="text-sm text-muted-foreground uppercase ml-3">{part.heading}</span>}
                    </div>
                    <CardTitle className="text-lg font-semibold">{part.heading ?? `Observation ${index + 1}`}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-foreground/80 leading-relaxed">
                    {part.bullets.length > 1 ? (
                        <ul className="list-disc pl-6 space-y-2">
                            {part.bullets.map((b, i) => (
                                <li key={i} dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(b) }} />
                            ))}
                        </ul>
                    ) : (
                        <div dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(part.bullets[0] || '') }} />
                    )}
                </CardContent>
            </Card>
        </motion.div>
    ));
};

const getEmotionBgClass = (emotion: string) => {
    switch (emotion) {
        case 'neutral': return 'bg-muted-foreground';
        case 'happy': return 'bg-yellow-500';
        case 'sad': return 'bg-blue-500';
        case 'angry': return 'bg-red-500';
        case 'disgusted': return 'bg-green-500';
        case 'surprised': return 'bg-purple-500';
        default: return 'bg-secondary';
    }
};

const EmotionBarChart = ({ data }: { data: { [key: string]: number } }) => {
    const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a);
    return (
        <div className="space-y-4 p-4 rounded-xl bg-muted/30 border">
            {sortedData.map(([emotion, percent]) => (
                <div key={emotion}>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm capitalize text-muted-foreground">{emotion}</span>
                        <span className="text-sm font-medium">{Math.round(percent * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden relative">
                        <motion.div
                            className={`h-full rounded-full absolute top-0 left-0 ${getEmotionBgClass(emotion)}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${percent * 100}%` }}
                            transition={{ duration: 0.8 }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default function ReportPage() {
    const { report: contextReportData, setReportData } = useReport();
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);
    const [localReportData, setLocalReportData] = useState<BackendReport | null>(null);
    let reportData = contextReportData ?? localReportData;
    // ensure hooks order: declare resolvedSpiderData state early so it's always called
    const [resolvedSpiderData, setResolvedSpiderData] = useState<BackendSpiderData | null | undefined>((reportData as any)?.spiderData ?? null);

    useEffect(() => { setIsMounted(true); }, []);

    useEffect(() => {
        if (!contextReportData) {
            const stored = localStorage.getItem("aura_report_data");
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    // parsed is expected to already be normalized (we stored normalized earlier)
                    setLocalReportData(parsed);
                    setReportData(parsed);
                    console.log(reportData, "=> data recieved on report page") // save into context (no double-normalize)
                } catch (e) { /* ignore parse errors */ }
            }
        }
    }, [contextReportData, setReportData]);

    useEffect(() => {
        if (isMounted && !reportData && !localReportData) {
            router.replace('/');
        }
    }, [isMounted, reportData, localReportData, router]);

    // Try to derive spider data from the report object itself (no spider API required).
    const normalizeSpiderCandidate = (cand: any): BackendSpiderData | null => {
        if (!cand) return null;
        try {
            // Already a spider object
            if (typeof cand === 'object' && (cand.scores || cand.rawLine || cand.confidence || cand.source)) return cand as BackendSpiderData;
            // wrapper like { spiderData: {...} }
            if (typeof cand === 'object' && cand.spiderData) return cand.spiderData as BackendSpiderData;
            // sometimes stored as a JSON string under spiderJson
            if (typeof cand === 'string') {
                try {
                    const parsed = JSON.parse(cand);
                    if (parsed && (parsed.scores || parsed.rawLine || parsed.confidence)) return parsed as BackendSpiderData;
                } catch (e) {
                    // not json - try to parse raw SPIDER_DATA line
                    const m = cand.match(/SPIDER_DATA[:\s]*([0-9,\s]+)\s*,?\s*CONF[:\s]*([0-9]{1,3})/i);
                    if (m) {
                        const nums = m[1].split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n));
                        const conf = Number(m[2]) || 0;
                        const labelsOrder = ["Stress","LowMood","SocialWithdrawal","Irritability","CognitiveFatigue","Arousal"];
                        const scores: any = {};
                        for (let i = 0; i < Math.min(nums.length, labelsOrder.length); i++) scores[labelsOrder[i]] = nums[i];
                        return { scores, rawLine: cand, confidence: conf } as BackendSpiderData;
                    }
                }
            }
        } catch (e) {
            // ignore
        }
        return null;
    };

    useEffect(() => {
        if (resolvedSpiderData) return;
        const session = reportData ?? localReportData;
        if (!session) return;
        // look through likely fields for embedded spider data
        const candidates = [
            (session as any).spiderData,
            (session as any).spiderJson,
            (session as any).spider_json,
            (session as any).spiderJsonString,
            (session as any).spider, // fallback
            (session as any).rawSpider,
            (session as any).reply,
        ];
        for (const c of candidates) {
            const normalized = normalizeSpiderCandidate(c);
            if (normalized) {
                setResolvedSpiderData(normalized);
                return;
            }
        }
    }, [reportData, localReportData, resolvedSpiderData]);

    // Always-declared effect: attempt to fetch spiderData if not present on the report

    if (!isMounted || (!reportData && !localReportData)) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
                <LoadingScreen />
                <p className="text-muted-foreground mt-4">Loading report or no data found...</p>
            </div>
        );
    }

    const data = reportData || localReportData;
    const { faceMetrics, voiceMetrics, hrvMetrics, reply = '' } = data || {};
    console.log(data, "=> report data on report page");
    const parsed = parseReply(reply || "");
    console.log(parsed, "=> parse reply")
    const observations = parsed.observations; // {heading?, text}[]
    const recommendation = parsed.actionable; // string[]
    const flaggedExcerpts = parsed.flagged;



    const keyTakeaway = "Your session indicates a primarily neutral emotional state, but with signs of underlying physiological stress. The key is to incorporate mindful relaxation to complement your existing routines.";

    return (
        <motion.div className="flex min-h-screen flex-col items-center justify-center bg-background p-6" initial="hidden" animate="visible" variants={containerVariants}>
            <Card className="w-full max-w-7xl p-10 bg-card text-foreground shadow-xl border border-border backdrop-blur-sm rounded-3xl">
                <CardHeader className="text-center space-y-3">
                    <motion.div variants={itemVariants}>
                        <CardTitle className="text-4xl font-extrabold text-primary">Your Clarity Report</CardTitle>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <CardDescription className="text-lg text-muted-foreground">A compassionate look into your session&apos;s metrics.</CardDescription>
                    </motion.div>
                </CardHeader>

                <CardContent className="grid md:grid-cols-3 gap-10">
                    {/* Left Column */}
                    <motion.div variants={itemVariants} className="md:col-span-2 space-y-8">
                        <motion.div
                            variants={itemVariants}
                            className="relative overflow-hidden p-6 rounded-2xl border-l-4 border-primary"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/5 animate-gradient-x" />
                            <h3 className="text-2xl font-bold text-primary flex items-center relative z-10">
                                <Target className="mr-3 text-2xl animate-pulse" /> Key Takeaway
                            </h3>
                            <p className="mt-2 text-base text-foreground/80 relative z-10">
                                {keyTakeaway}
                            </p>
                        </motion.div>

                        <div>
                            <h2 className="text-xl font-semibold text-primary border-b border-border pb-1 flex items-center">
                                <Lightbulb className="mr-2" /> Insights from your session
                            </h2>
                            <div className="bg-muted/30 p-6 rounded-2xl border mt-4">
                                {observations.length ? renderObservations(observations) : (
                                    <p className="text-sm text-muted-foreground">No observation text could be parsed from the model reply.</p>
                                )}
                            </div>
                        </div>

                        {flaggedExcerpts.length > 0 && (
                            <div className="mt-8">
                                <h2 className="text-xl font-semibold text-primary border-b border-border pb-1 flex items-center">
                                    <Sparkles className="mr-2" /> Flagged Excerpts
                                </h2>
                                <div className="bg-orange-50 p-6 rounded-2xl border mt-4">
                                    <ul className="list-disc pl-6 space-y-2">
                                        {flaggedExcerpts.map((ex, i) => (
                                            <li key={i} className="text-base text-orange-900 font-semibold">{ex}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {recommendation.length > 0 && (
                            <Collapsible>
                                <CollapsibleTrigger asChild>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        className="w-full flex items-center justify-between bg-emerald-100 p-4 rounded-xl border border-emerald-200 text-emerald-800 font-semibold"
                                    >
                                        💡 Actionable Highlights
                                        <ChevronDown className="h-4 w-4" />
                                    </motion.button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-4 p-4 bg-white rounded-lg border border-border shadow-sm">
                                    <ul className="list-disc pl-6 space-y-2">
                                        {recommendation.map((tip, i) => (
                                            <li key={i} dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(tip) }} />
                                        ))}
                                    </ul>
                                </CollapsibleContent>
                            </Collapsible>
                        )}
                    </motion.div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-primary border-b border-border pb-1 flex items-center">
                            <TrendingUp className="mr-2" /> Key Metrics
                        </h2>
                        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
                            {[{
                                label: "Avg. Face Confidence",
                                value: faceMetrics?.avgConfidence ? `${Math.round(faceMetrics.avgConfidence * 100)}%` : '--'
                            }, {
                                label: "Avg. Volume",
                                value: voiceMetrics?.avgVolume?.toFixed(2) ?? '--'
                            }].map((metric, i) => (
                                <motion.div
                                    key={metric.label}
                                    className="p-4 bg-muted/30 rounded-xl text-center shadow-sm border"
                                    whileHover={{ scale: 1.02 }}
                                    transition={{ type: "spring", stiffness: 200 }}
                                >
                                    <p className="text-2xl font-bold text-primary">{metric.value}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
                                </motion.div>
                            ))}
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">Emotional Distribution</h3>
                            <EmotionBarChart data={faceMetrics?.percentTime || {}} />
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">Voice & HRV Data</h3>
                            <div className="space-y-3">
                                <div className="p-4 bg-muted/30 rounded-xl border flex items-center">
                                    <Heart className="text-red-500 mr-4" />
                                    <div>
                                        <p className="text-sm font-medium">RMSSD: {hrvMetrics?.RMSSD?.toFixed(2) ?? '--'}</p>
                                        <p className="text-xs text-muted-foreground">SDNN: {hrvMetrics?.SDNN?.toFixed(2) ?? '--'}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-muted/30 rounded-xl border flex items-center">
                                    <Volume2 className="text-blue-500 mr-4" />
                                    <div>
                                        <p className="text-sm font-medium">Avg. Pitch: {voiceMetrics?.avgPitch?.toFixed(0) ?? '--'} Hz</p>
                                        <p className="text-xs text-muted-foreground">Max Volume: {voiceMetrics?.maxVolume?.toFixed(2) ?? '--'}</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">Multimodal Tendencies</h3>
                            <div className="bg-muted/10 p-4 rounded-lg border">
                                <SpiderChart spiderData={resolvedSpiderData ?? (data as any)?.spiderData} sessionId={(data as any)?.sessionId} />
                            </div>
                        </motion.div>
                    </div>
                </CardContent>

                <motion.div variants={itemVariants} className="mt-12 flex justify-center">
                    <Button asChild className="w-full md:w-auto font-medium text-base py-6 px-12 rounded-full shadow-md">
                        <Link href="/">Return to Home</Link>
                    </Button>
                </motion.div>
            </Card>
        </motion.div>
    );
}