import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Flag } from "@/types";

export default function FlaggedExcerpts({ flags, onJump }: { flags: Flag[]; onJump: (ms: number) => void }) {
    if (!flags.length) return <div className="text-sm text-muted-foreground">No flagged excerpts.</div>;

    return (
        <div className="space-y-3">
            {flags.map(f => (
                <Card key={f.id}>
                    <CardContent className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <Badge variant="destructive">{f.reason}</Badge>
                                <div className="text-xs text-muted-foreground">confidence {(f.confidence * 100).toFixed(0)}%</div>
                            </div>
                            <div className="font-medium mt-2">{f.snippet}</div>
                            <div className="text-xs text-muted-foreground mt-1">Time: {Math.round(f.timeMs / 1000)}s</div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button variant="ghost" onClick={() => onJump(f.timeMs)}>Play</Button>
                            <Button variant="destructive" onClick={() => alert("Dismissed (demo)")}>Dismiss</Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
