"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import RiskCard from "@/components/RiskCard";
import FlaggedExcerpts from "@/components/FlaggedExcerpts";
import ActionCardsList from "@/components/ActionCardsList";
import TranslationToggle from "@/components/TranslationToggle";
import { fetchSessionSummary, fetchVersions } from "@/lib/mockAPI";
import type { SessionSummary, Version } from "@/types";
import { useRouter, useSearchParams } from 'next/navigation';

export default function DashboardPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const sessionIdFromQuery = typeof searchParams?.get === 'function' ? searchParams?.get('id') : null;
    const [session, setSession] = useState<SessionSummary | null>(null);
    const [versions, setVersions] = useState<Version[]>([]);
    const [transcriptView, setTranscriptView] = useState<string | null>(null);
    const [crisisOpen, setCrisisOpen] = useState(false);
    const [consent, setConsent] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const idToLoad = sessionIdFromQuery ?? '13'; // fallback id for demo; remove in prod
        let mounted = true; // fallback id for demo; remove in production

        (async () => {
            setLoading(true);
            try {
                const s = await fetchSessionSummary(idToLoad);
                setSession(s);
                setTranscriptView(s.transcript ?? '');
                // try fetch versions for this session
                try {
                    const vs = await fetchVersions();
                    setVersions(vs);
                } catch (vErr) {
                    console.warn('fetchVersions failed', vErr);
                    setVersions([]);
                }
            } catch (err: any) {
                console.error('load session error', err);
                setError(String(err?.message ?? err));
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => { mounted = false; };
    }, [sessionIdFromQuery]);

    if (!session || loading) return <div className="p-6">Loading…</div>;

    return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-0">
                <div className="max-w-7xl mx-auto py-10 px-4 sm:px-8 space-y-8">
                    <header className="flex items-center justify-between gap-4 pb-2 border-b border-gray-200">
                        <div>
                            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight drop-shadow-sm">Mental Health — Dashboard <span className="text-base font-normal text-gray-500">(Demo)</span></h1>
                            <p className="text-sm text-gray-500 mt-1">Prototype demo — metrics-only storage (consent toggled)</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="accent-purple-500 scale-110" />
                                <span className="text-gray-600">Demo consent (metrics only)</span>
                            </label>
                            <Button variant="ghost" onClick={() => window.location.reload()} className="border border-gray-300">Refresh</Button>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <aside className="space-y-6">
                            <RiskCard score={session.riskScore} level={session.riskLevel} confidence={session.confidence} onCrisis={() => setCrisisOpen(true)} />

                            <Card className="shadow-lg border-0 bg-gradient-to-br from-white via-blue-50 to-purple-50">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold">Actions</CardTitle>
                                    <CardDescription className="text-gray-500">Suggested follow-ups</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ActionCardsList
                                        items={session.actions}
                                        onAccept={(a) => {
                                            alert("Accepted (demo): " + a.text);
                                            setSession(prev => prev ? { ...prev, actions: prev.actions.filter(x => x.id !== a.id) } : prev);
                                        }}
                                        onDismiss={(a) => setSession(prev => prev ? { ...prev, actions: prev.actions.filter(x => x.id !== a.id) } : prev)}
                                    />
                                </CardContent>
                            </Card>
                        </aside>

                        <main className="lg:col-span-2 space-y-6">
                            <Card className="shadow-lg border-0 bg-gradient-to-br from-white via-pink-50 to-purple-50">
                                <CardHeader className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg font-bold">Transcript</CardTitle>
                                        <CardDescription className="text-gray-500">Click flagged excerpts to preview. Translate or revert versions on the right.</CardDescription>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <TranslationToggle text={transcriptView ?? ""} detected={session.detectedLanguage} onTranslated={(t) => setTranscriptView(t)} />
                                        <Button variant="secondary" onClick={() => setTranscriptView(session.transcript)} className="border border-gray-300">Reset</Button>
                                    </div>
                                </CardHeader>

                                <CardContent>
                                    <div className="whitespace-pre-wrap text-base border rounded-xl p-6 bg-white/80 min-h-[140px] font-sans text-gray-900 shadow-inner">
                                        {transcriptView}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-lg border-0 bg-gradient-to-br from-white via-orange-50 to-pink-50">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold">Flagged Excerpts</CardTitle>
                                    <CardDescription className="text-gray-500">Key lines that contributed to the risk score</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <FlaggedExcerpts flags={session.flags} onJump={(ms) => alert("Jump to " + Math.round(ms / 1000) + "s (demo)")} />
                                </CardContent>
                            </Card>

                            <Card className="shadow-lg border-0 bg-gradient-to-br from-white via-gray-50 to-blue-50">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold">Version History</CardTitle>
                                    <CardDescription className="text-gray-500">Preview previous versions and revert (local state)</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {versions.map(v => (
                                        <div key={v.id} className="flex items-center justify-between rounded-lg bg-white/80 px-4 py-3 shadow-sm">
                                            <div>
                                                <div className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleString()}</div>
                                                <div className="text-sm truncate max-w-xl text-gray-700">{v.transcriptText}</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => setTranscriptView(v.transcriptText)} className="border border-gray-300">Preview</Button>
                                                <Button size="sm" onClick={() => {
                                                    if (confirm("Revert to this version? (demo)")) setTranscriptView(v.transcriptText);
                                                }} className="bg-orange-100 text-orange-900">Revert</Button>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </main>
                    </div>

                    <Dialog open={crisisOpen} onOpenChange={setCrisisOpen}>
                        <DialogContent className="rounded-2xl shadow-2xl border-0 bg-gradient-to-br from-white via-red-50 to-orange-50">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-bold">Immediate help</DialogTitle>
                                <p className="text-sm text-gray-500">If you or the user are in immediate danger, call your local emergency services. This is a demo — no data is shared.</p>
                            </DialogHeader>
                            <div className="mt-4 space-y-3">
                                <Button variant="destructive" onClick={() => alert("Calling local emergency (demo)")} className="w-full">Call Emergency</Button>
                                <Button onClick={() => alert("Show hotlines (demo)")} className="w-full">Show local hotlines</Button>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setCrisisOpen(false)} className="w-full">Close</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <div className="text-xs text-gray-400 pt-8 text-center">
                        Demo note: this dashboard is a prototype. For real deployment, add consent flows, server-side encryption, and audit logs.
                    </div>
                </div>
            </div>
      
    );
}