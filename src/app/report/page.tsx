// src/app/report/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useReport } from '@/context/ReportContext';
import { mockBackendReport, BackendReport } from '@/lib/mockReportData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSpring, animated } from "@react-spring/web";
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

function parseObservations(text: string): string[] {
    if (!text) return [];

    const trimmed = text.trim();

    // 1) If we have an explicit numbered-list format "1. something 2. something" capture using regex
    const numberedRe = /(\d+)\.\s+([\s\S]*?)(?=(?:\n\d+\.|$))/g;
    const numberedMatches: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = numberedRe.exec(trimmed)) !== null) {
        const item = m[2].trim();
        if (item) numberedMatches.push(item);
    }
    if (numberedMatches.length > 0) return numberedMatches;

    // 2) Common alternative: "1\nObservation 1\n<text>\n2\nObservation 2\n<text>"
    // We'll match groups that start with a line that is just a number, optionally followed by a "Observation N" line, then consume until the next number line
    const altRe = /(?:^|\n)(\d+)\s*(?:\r?\n)?(?:Observation\s*\d+\s*(?:\r?\n)?)?([\s\S]*?)(?=(?:\n\d+\s*(?:\r?\n)?(?:Observation\s*\d+\s*(?:\r?\n)?)|$))/gi;
    const altMatches: string[] = [];
    while ((m = altRe.exec(trimmed)) !== null) {
        const item = m[2].trim();
        if (item) altMatches.push(item);
    }
    if (altMatches.length > 0) return altMatches;

    // 3) Another common variant: "Observation 1\n<text>\nObservation 2\n<text>"
    const obsHeadRe = /(?:^|\n)Observation\s*\d+\s*(?:\r?\n)?([\s\S]*?)(?=(?:\nObservation\s*\d+|$))/gi;
    const obsHeadMatches: string[] = [];
    while ((m = obsHeadRe.exec(trimmed)) !== null) {
        const item = m[1].trim();
        if (item) obsHeadMatches.push(item);
    }
    if (obsHeadMatches.length > 0) return obsHeadMatches;

    // 4) Fallback: split by double newlines (paragraphs)
    return trimmed
        .split(/\n{2,}/)
        .map(s => s.trim())
        .filter(Boolean);
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

const renderObservations = (text: string): React.ReactNode => {
    // cut off Actionable Tip section if present
    const observationsEndIndex = text.indexOf('**Actionable Tip:**');
    const observationsText = observationsEndIndex !== -1 ? text.substring(0, observationsEndIndex).trim() : text;

    const parts = parseObservations(observationsText);

    return parts.map((part: string, index: number) => {
        const html = simpleMarkdownToHtml(part);
        return (
            <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="mb-4"
            >
                <Card className="border border-border hover:shadow-md transition-all duration-200 bg-card/60 backdrop-blur">
                    <CardHeader className="flex items-center gap-3">
                        <span className="text-primary font-bold text-xl">{index + 1}</span>
                        <CardTitle className="text-lg font-semibold">Observation {index + 1}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-foreground/80 leading-relaxed">
                        <div dangerouslySetInnerHTML={{ __html: html }} />
                    </CardContent>
                </Card>
            </motion.div>
        );
    });
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

    useEffect(() => { setIsMounted(true); }, []);

    useEffect(() => {
        if (!contextReportData) {
            const stored = localStorage.getItem("aura_report_data");
            if (stored) {
                const parsed = JSON.parse(stored);
                setLocalReportData(parsed);
                setReportData(parsed);
            }
        }
    }, [contextReportData, setReportData]);

    useEffect(() => {
        if (isMounted && !reportData && !localReportData) {
            router.replace('/');
        }
    }, [isMounted, reportData, localReportData, router]);

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

    let observations = reply;
    let recommendation = '';
    let rationale = '';

    const TIP_MARKER = '**Actionable Tip:**';
    const RATIONALE_MARKER = '**Rationale:**';

    const tipIndex = reply.indexOf(TIP_MARKER);
    if (tipIndex !== -1) {
        // everything before tip marker is observations
        observations = reply.slice(0, tipIndex).trim();

        // everything after tip marker (trim leading/trailing whitespace)
        const afterTip = reply.slice(tipIndex + TIP_MARKER.length).trim();

        const rationaleIndexInAfterTip = afterTip.indexOf(RATIONALE_MARKER);
        if (rationaleIndexInAfterTip !== -1) {
            recommendation = afterTip.slice(0, rationaleIndexInAfterTip).trim();
            rationale = afterTip.slice(rationaleIndexInAfterTip + RATIONALE_MARKER.length).trim();
        } else {
            recommendation = afterTip;
            rationale = '';
        }
    }

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
                                {renderObservations(observations)}
                            </div>
                        </div>

                        <Collapsible>
                            <CollapsibleTrigger asChild>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    className="w-full flex items-center justify-between bg-emerald-100 p-4 rounded-xl border border-emerald-200 text-emerald-800 font-semibold"
                                >
                                    💡 Actionable Tip
                                    <ChevronDown className="h-4 w-4" />
                                </motion.button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-4 p-4 bg-white rounded-lg border border-border shadow-sm">
                                <div
                                    className="mb-3 text-sm leading-relaxed"
                                    // If using DOMPurify, do: dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(simpleMarkdownToHtml(recommendation)) }}
                                    dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(recommendation) }}
                                />
                                {rationale && (
                                    <details>
                                        <summary className="cursor-pointer font-medium">Why this works</summary>
                                        <div
                                            className="mt-2 text-sm text-foreground/80"
                                            dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(rationale) }}
                                        />
                                    </details>
                                )}
                            </CollapsibleContent>
                        </Collapsible>
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