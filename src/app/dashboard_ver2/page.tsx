"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Heart, Volume2, TrendingUp, FileText, ArrowUpRight, Download } from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    Legend,
} from "recharts";
import { motion } from "framer-motion";

type MetricPoint = {
    ts: number; // unix ms
    iso?: string; // optional human ISO timestamp
    riskScore?: number;
    SDNN?: number;
    RMSSD?: number;
    pNN50?: number;
    avgVolume?: number;
    avgPitch?: number;
};


type SessionHistoryPayload = {
    points: MetricPoint[]; // main time series (one point per session or snapshot)
    latest?: any; // optional full latest report
};

function fmtDate(ts: number) {
    const d = new Date(ts);
    return d.toLocaleDateString();
}


function movingAverage(data: number[], window = 3) {
    if (!data.length) return [];
    const out = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - window + 1);
        const slice = data.slice(start, i + 1);
        const avg = slice.reduce((a, b) => a + (b || 0), 0) / slice.length;
        out.push(avg);
    }
    return out;
}

async function fetchSessionHistory(sessionId?: string): Promise<SessionHistoryPayload> {
    // Replace this with your actual backend endpoint.
    // expected response shape: { points: [{ ts, riskScore, SDNN, RMSSD, avgVolume, avgPitch }, ...] }
    // For quick demo we return generated mock data.
    await new Promise((r) => setTimeout(r, 220));
    const now = Date.now();
    const points: MetricPoint[] = [];
    for (let i = 30; i >= 0; i--) {
        const ts = now - i * 1000 * 60 * 60 * 24; // daily
        points.push({
            ts,
            iso: new Date(ts).toISOString(),
            riskScore: Math.max(0, 60 + Math.round(10 * Math.sin(i / 4) - i * 0.2)),
            SDNN: Math.max(3, 18 + Math.round(4 * Math.cos(i / 6) - i * 0.05)),
            RMSSD: Math.max(2, 6 + Math.round(3 * Math.sin(i / 5) - i * 0.03)),
            avgVolume: Math.abs(0.005 + 0.003 * Math.sin(i / 3) + (Math.random() - 0.5) * 0.001),
            avgPitch: 120 + Math.round(6 * Math.cos(i / 7)),
        });
    }
    return { points, latest: points[points.length - 1] };
}

export default function GrowthDashboard({ sessionId }: { sessionId?: string }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<MetricPoint[]>([]);
    const [metric, setMetric] = useState<"riskScore" | "RMSSD" | "SDNN" | "avgVolume">("riskScore");
    const [smoothing, setSmoothing] = useState(3);
    const [rangeDays, setRangeDays] = useState<number | "all">(30);

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            try {
                const payload = await fetchSessionHistory(sessionId);
                if (!mounted) return;
                setData(payload.points || []);
            } catch (err: any) {
                console.error(err);
                setError(String(err?.message ?? err));
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [sessionId]);

    const points = useMemo(() => {
        if (!data?.length) return [];
        const filtered = rangeDays === "all" ? data : data.slice(-rangeDays);
        return filtered.map((p) => ({
            ...p,
            dateLabel: fmtDate(p.ts),
            riskScore: p.riskScore ?? null,
            SDNN: p.SDNN ?? null,
            RMSSD: p.RMSSD ?? null,
            avgVolume: p.avgVolume ?? null,
        }));
    }, [data, rangeDays]);


    const series = useMemo(() => {
        if (!points.length) return [];
        if (metric === "riskScore") return points.map((p) => p.riskScore ?? 0);
        if (metric === "RMSSD") return points.map((p) => p.RMSSD ?? 0);
        if (metric === "SDNN") return points.map((p) => p.SDNN ?? 0);
        if (metric === "avgVolume") return points.map((p) => p.avgVolume ?? 0);
        return points.map((p) => p.riskScore ?? 0);
    }, [points, metric]);


    const smoothed = useMemo(() => movingAverage(series, smoothing), [series, smoothing]);


    const chartData = useMemo(() => {
        return points.map((p, i) => ({
            name: p.dateLabel,
            value: series[i] ?? null,
            smooth: smoothed[i] ?? null,
        }));
    }, [points, series, smoothed]);


    const latest = points[points.length - 1];
    const first = points[0];
    const delta = latest && first ? ((latest[metric as keyof MetricPoint] as number) - (first[metric as keyof MetricPoint] as number)) : 0;
    const deltaPct = first && latest ? ((delta / ((first[metric as keyof MetricPoint] as number) || 1)) * 100).toFixed(1) : "0.0";


    if (loading) return <div className="p-6 text-center text-lg text-muted-foreground animate-pulse">Loading dashboard…</div>;
    if (error) return <div className="p-6 text-red-600 text-center">Error: {error}</div>;

    return (
        <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-100 min-h-screen">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="col-span-2">
                    <h2 className="text-4xl font-extrabold text-primary mb-2 flex items-center gap-2">
                        <TrendingUp className="w-7 h-7 text-primary" /> Growth & Trends
                    </h2>
                    <p className="text-base text-muted-foreground">Track progress over time — choose a metric, smooth the series, and change range.</p>
                </div>
                <div className="flex items-center justify-end gap-2">
                    <select className="p-2 border rounded-lg bg-muted/20" value={metric} onChange={(e) => setMetric(e.target.value as any)}>
                        <option value="riskScore">Risk Score (lower better)</option>
                        <option value="RMSSD">RMSSD (higher better)</option>
                        <option value="SDNN">SDNN (higher better)</option>
                        <option value="avgVolume">Avg. Voice Volume (higher = more engaged)</option>
                    </select>
                    <select className="p-2 border rounded-lg bg-muted/20" value={String(rangeDays)} onChange={(e) => setRangeDays(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                        <option value={7}>7d</option>
                        <option value={14}>14d</option>
                        <option value={30}>30d</option>
                        <option value={90}>90d</option>
                        <option value={'all'}>All</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <div className="p-6 bg-white rounded-2xl shadow-lg border border-border flex flex-col justify-center items-center">
                    <div className="text-sm text-muted-foreground mb-1">Current</div>
                    <div className="text-3xl font-extrabold text-primary mb-1">{latest ? (metric === 'avgVolume' ? latest.avgVolume?.toFixed(4) : String(latest[metric as keyof MetricPoint] ?? '--')) : '--'}</div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{metric}</div>
                </div>
                <div className="p-6 bg-white rounded-2xl shadow-lg border border-border flex flex-col justify-center items-center">
                    <div className="text-sm text-muted-foreground mb-1">Change (period)</div>
                    <div className={`text-3xl font-extrabold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'} mb-1`}>{delta >= 0 ? '+' : ''}{Number(delta).toFixed(2)} ({deltaPct}%)</div>
                    <div className="text-xs text-muted-foreground font-medium">{first ? fmtDate(first.ts) : ''} → {latest ? fmtDate(latest.ts) : ''}</div>
                </div>
                <div className="p-6 bg-white rounded-2xl shadow-lg border border-border flex flex-col justify-between">
                    <div>
                        <div className="text-sm text-muted-foreground">Smoothing</div>
                        <div className="mt-2 flex gap-2 items-center">
                            <input type="range" min={1} max={10} value={smoothing} onChange={(e) => setSmoothing(Number(e.target.value))} className="accent-primary" />
                            <div className="text-sm font-medium">{smoothing}</div>
                        </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-3">Tip: small smoothing helps surface trends over noisy signals.</div>
                </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-border mb-8">
                <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 mr-1" /> {metric} Over Time</h3>
                <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="value" stroke="#6366F1" dot={false} name={metric} strokeWidth={3} />
                        <Line type="monotone" dataKey="smooth" stroke="#10B981" dot={false} strokeDasharray="5 5" name={`Smoothed (${smoothing})`} strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <div className="col-span-2 bg-white rounded-2xl p-6 shadow-lg border border-border">
                    <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2"><FileText className="w-5 h-5 mr-1" /> Metric Breakdown (Latest)</h3>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-4 border rounded-xl flex items-center gap-3 bg-muted/10">
                            <Heart className="text-red-500 w-6 h-6" title="HRV RMSSD" />
                            <div>
                                <div className="text-xs text-muted-foreground">RMSSD <span title="Root Mean Square of Successive Differences">ℹ️</span></div>
                                <div className="text-2xl font-bold">{latest?.RMSSD ?? '--'}</div>
                            </div>
                        </div>
                        <div className="p-4 border rounded-xl flex items-center gap-3 bg-muted/10">
                            <Heart className="text-purple-500 w-6 h-6" title="HRV SDNN" />
                            <div>
                                <div className="text-xs text-muted-foreground">SDNN <span title="Standard Deviation of NN intervals">ℹ️</span></div>
                                <div className="text-2xl font-bold">{latest?.SDNN ?? '--'}</div>
                            </div>
                        </div>
                        <div className="p-4 border rounded-xl flex items-center gap-3 bg-muted/10">
                            <Volume2 className="text-blue-500 w-6 h-6" title="Avg Volume" />
                            <div>
                                <div className="text-xs text-muted-foreground">Avg Volume <span title="Average voice volume">ℹ️</span></div>
                                <div className="text-2xl font-bold">{latest?.avgVolume?.toFixed(4) ?? '--'}</div>
                            </div>
                        </div>
                        <div className="p-4 border rounded-xl flex items-center gap-3 bg-muted/10">
                            <Volume2 className="text-green-500 w-6 h-6" title="Avg Pitch" />
                            <div>
                                <div className="text-xs text-muted-foreground">Avg Pitch <span title="Average voice pitch">ℹ️</span></div>
                                <div className="text-2xl font-bold">{latest?.avgPitch ?? '--'}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-border flex flex-col justify-between">
                    <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2"><ArrowUpRight className="w-5 h-5 mr-1" /> Quick Actions</h3>
                    <div className="space-y-3">
                        <button className="w-full p-3 rounded-xl bg-primary text-white font-semibold flex items-center gap-2 shadow hover:bg-primary/90 transition"><Download className="w-4 h-4" /> Export CSV</button>
                        <button className="w-full p-3 rounded-xl bg-emerald-100 text-emerald-900 font-semibold flex items-center gap-2 shadow hover:bg-emerald-200 transition"><FileText className="w-4 h-4" /> Create follow-up</button>
                        <button className="w-full p-3 rounded-xl bg-muted text-foreground font-semibold flex items-center gap-2 shadow hover:bg-muted/80 transition"><ArrowUpRight className="w-4 h-4" /> Compare to baseline</button>
                    </div>
                </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-border">
                <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2"><FileText className="w-5 h-5 mr-1" /> History Table</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-muted/30 z-10">
                            <tr className="text-xs text-muted-foreground">
                                <th className="p-2">Date</th>
                                <th className="p-2">Risk</th>
                                <th className="p-2">RMSSD</th>
                                <th className="p-2">SDNN</th>
                                <th className="p-2">Avg Vol</th>
                            </tr>
                        </thead>
                        <tbody>
                            {points.slice().reverse().map((p, idx) => (
                                <tr key={p.ts} className={idx % 2 === 0 ? "bg-muted/10" : "bg-white"}>
                                    <td className="p-2 align-top font-medium">{fmtDate(p.ts)}</td>
                                    <td className="p-2 align-top">{p.riskScore}</td>
                                    <td className="p-2 align-top">{p.RMSSD}</td>
                                    <td className="p-2 align-top">{p.SDNN}</td>
                                    <td className="p-2 align-top">{p.avgVolume?.toFixed(4)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}