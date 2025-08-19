import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

function levelColor(level: string) {
    switch (level) {
        case "low": return "bg-green-100 text-green-900";
        case "medium": return "bg-amber-100 text-amber-900";
        case "high": return "bg-orange-100 text-orange-900";
        case "emergency": return "bg-red-100 text-red-900";
        default: return "bg-slate-100 text-slate-900";
    }
}

export default function RiskCard({ score, level, confidence, onCrisis }: { score: number; level: string; confidence: number; onCrisis: () => void }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Risk Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
                <div>
                    <div className="text-muted-foreground text-sm">Risk Score</div>
                    <div className="flex items-baseline gap-3">
                        <div className="text-3xl font-bold">{Math.round(score)}</div>
                        <Badge className={levelColor(level)}>{level.toUpperCase()}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">Confidence {(confidence * 100).toFixed(0)}%</div>
                </div>

                <div className="flex flex-col gap-2">
                    <Tooltip>
                        <span className="text-xs px-2 py-1 bg-slate-800 text-white rounded absolute -top-8 left-1/2 -translate-x-1/2 z-10">Open immediate help options (demo)</span>
                        <Button variant="destructive" onClick={onCrisis}>Crisis</Button>
                    </Tooltip>
                    <Button variant="outline" onClick={() => alert("Request clinician review (demo)")}>Request clinician review</Button>
                </div>
            </CardContent>
        </Card>
    );
}