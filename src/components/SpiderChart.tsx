"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
} from "chart.js";
import { Radar } from "react-chartjs-2";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function SpiderChart({ spiderData: propSpiderData, sessionId }: { spiderData?: any; sessionId?: string }) {
    // Pure presentational: use prop directly
    const spiderData = propSpiderData ?? null;


    // derive labels strictly from scores (prefer canonical order but fallback to whatever keys are present)
    const canonicalOrder = ["Stress", "Arousal", "LowMood", "Irritability", "CognitiveFatigue", "SocialWithdrawal"];
    const displayNameMap: { [k: string]: string } = {
        Stress: 'Stress',
        Arousal: 'Arousal',
        LowMood: 'Low Mood',
        Irritability: 'Irritability',
        CognitiveFatigue: 'Cognitive Fatigue',
        SocialWithdrawal: 'Social Withdrawal',
    };

    const dataForChart = useMemo(() => {
        if (!spiderData) return null;
        const scoresObj: { [k: string]: number } = spiderData?.scores || {};

        // pick labels in canonical order when possible, otherwise fall back to keys present
        const presentCanon = canonicalOrder.filter(k => Object.prototype.hasOwnProperty.call(scoresObj, k));
        const labelsFinal = presentCanon.length ? presentCanon : Object.keys(scoresObj);
        if (!labelsFinal || !labelsFinal.length) return null;

        const values = labelsFinal.map(k => {
            const v = Number(scoresObj[k]) || 0;
            return Math.max(0, Math.min(100, Math.round(v)));
        });

        const labelsDisplay = labelsFinal.map(k => displayNameMap[k] ?? String(k).replace(/([A-Z])/g, ' $1').trim());

        // friendly color palette for each axis
        const palette: { [k: string]: string } = {
            Stress: '#ef4444', // red
            Arousal: '#f59e0b', // amber
            LowMood: '#6366f1', // indigo
            Irritability: '#f97316', // orange
            CognitiveFatigue: '#06b6d4', // cyan
            SocialWithdrawal: '#10b981', // green
        };
        const pointColors = labelsFinal.map(k => palette[k] ?? '#60a5fa');

    return {
            labels: labelsDisplay,
            datasets: [
                {
                    // no verbose label here — keep chart minimal
                    data: values,
                    fill: true,
                    // soft purple fill to contrast with colored points
                    backgroundColor: "rgba(99,102,241,0.12)",
                    borderColor: "rgba(99,102,241,0.95)",
                    pointBackgroundColor: pointColors,
                    pointBorderColor: '#fff',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                },
            ],
        };
    }, [spiderData]);

    const chartRef = useRef<any>(null);
    // Plugin to render value badges near each point
    function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
        const radius = Math.min(r, h / 2, w / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
        ctx.fill();
    }

    const valueLabelPlugin = {
        id: 'valueLabelPlugin',
        afterDatasetsDraw: function (chart: any) {
            // Only draw value labels when explicitly enabled on the chart options
            const cfg = chart.options?.plugins?.valueLabelPlugin;
            if (!cfg || cfg.enabled !== true) return;
            const ctx: CanvasRenderingContext2D = chart.ctx;
            chart.data.datasets.forEach(function (dataset: any, i: number) {
                const meta = chart.getDatasetMeta(i);
                meta.data.forEach(function (element: any, index: number) {
                    const value = dataset.data[index];
                    if (value === null || value === undefined) return;
                    ctx.save();
                    const text = `${value}%`;
                    ctx.font = '600 12px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
                    const textWidth = ctx.measureText(text).width;
                    const padding = 8;
                    const rectWidth = textWidth + padding;
                    const rectHeight = 20;
                    const x = element.x - rectWidth / 2;
                    const y = element.y - rectHeight - 8;
                    // background pill
                    ctx.fillStyle = 'rgba(255,255,255,0.95)';
                    roundRect(ctx, x, y, rectWidth, rectHeight, 6);
                    // text
                    ctx.fillStyle = '#111827';
                    ctx.fillText(text, x + padding / 2, y + rectHeight - 6);
                    ctx.restore();
                });
            });
        }
    };

    useEffect(() => {
        try { ChartJS.register(valueLabelPlugin); } catch (e) { /* ignore double register */ }
        const chart = chartRef.current?.chartInstance ?? chartRef.current?.chart;
        if (!chart) return;
        try {
            const ctx = chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, chart.height || 420);
            gradient.addColorStop(0, 'rgba(99,102,241,0.55)');
            gradient.addColorStop(1, 'rgba(16,185,129,0.12)');
            if (chart.data && chart.data.datasets && chart.data.datasets[0]) {
                chart.data.datasets[0].backgroundColor = gradient;
                chart.data.datasets[0].borderColor = 'rgba(99,102,241,0.95)';
                chart.update();
            }
        } catch (e) { /* ignore */ }
    }, [dataForChart]);


    const conf = spiderData?.confidence ?? spiderData?.conf ?? 0;

    const labelsList = (dataForChart?.labels as string[]) || [];
    const datasetValues = ((dataForChart?.datasets?.[0]?.data as any[]) || []);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button type="button" className="w-full max-w-xl mx-auto bg-gradient-to-tr from-white to-slate-50 rounded-lg shadow transform transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl cursor-pointer text-left">
                    <div className="h-100 flex items-center justify-center">
                        {dataForChart ? (
                            <div className="w-full h-full">
                                <Radar ref={chartRef} data={dataForChart} options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    layout: { padding: { top: 8, bottom: 8, left: 8, right: 8 } },
                                    scales: { r: { suggestedMin: 0, suggestedMax: 100, ticks: { stepSize: 20, color: '#6b7280', font: { size: 12 } }, pointLabels: { font: { size: 12 }, padding: 8, color: '#374151' }, grid: { color: 'rgba(15,23,42,0.06)' } } },
                                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.formattedValue}%` } } },
                                    elements: { line: { borderWidth: 3, tension: 0.4 } },
                                    animation: { duration: 700 }
                                }} />

                                <div className="text-center text-sm font-medium text-muted-foreground mt-2">Confidence: {conf}%</div>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500">No scores available</div>
                        )}
                    </div>
                </button>
            </DialogTrigger>

            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Multimodal Tendencies — Expanded</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <div style={{ height: 520 }}>
                        {dataForChart ? (
                            <Radar ref={chartRef} data={dataForChart} options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                layout: { padding: { top: 12, bottom: 12, left: 12, right: 12 } },
                                scales: { r: { suggestedMin: 0, suggestedMax: 100, ticks: { stepSize: 20, color: '#374151', font: { size: 14 } }, pointLabels: { font: { size: 16 }, padding: 12, color: '#111827' }, grid: { color: 'rgba(15,23,42,0.06)' } } },
                                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.formattedValue}%` } } },
                                elements: { line: { borderWidth: 3, tension: 0.45 } },
                                animation: { duration: 900 }
                            }} />
                        ) : (
                            <div className="text-sm text-gray-500">No scores available</div>
                        )}
                    </div>

                    <div className="mt-4 flex flex-col items-center">
                        <div className="text-lg font-semibold">Confidence: {conf}%</div>
                        <div className="mt-3 flex flex-wrap gap-3 justify-center">
                            {labelsList.map((lbl, i) => {
                                const value = datasetValues[i] ?? '-';
                                const chipColors = ['#ef4444', '#f59e0b', '#6366f1', '#f97316', '#06b6d4', '#10b981'];
                                const color = chipColors[i % chipColors.length];
                                return (
                                    <div key={lbl} className="flex items-center space-x-3 bg-white px-4 py-2 rounded-full border border-gray-100 shadow-sm">
                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                        <span className="text-sm text-gray-700">{lbl}</span>
                                        <span className="text-sm font-semibold text-gray-600">{typeof value === 'number' ? `${value}%` : value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
                <DialogClose />
            </DialogContent>
        </Dialog>
    );
}