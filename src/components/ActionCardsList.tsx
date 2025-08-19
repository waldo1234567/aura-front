import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ActionItem } from "@/types";

export default function ActionCardsList({ items, onAccept, onDismiss }: {
    items: ActionItem[],
    onAccept: (a: ActionItem) => void,
    onDismiss: (a: ActionItem) => void
}) {
    if (!items.length) return <div className="text-sm text-muted-foreground">No actions</div>;
    return (
        <div className="space-y-2">
            {items.map(it => (
                <Card key={it.id}>
                    <CardContent className="flex items-center justify-between gap-4">
                        <div>
                            <div className="font-medium">{it.text}</div>
                            <div className="text-xs text-muted-foreground">{it.assignee ?? "Unassigned"} • confidence {(it.confidence || 0).toFixed(2)}</div>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => onAccept(it)}>Accept</Button>
                            <Button variant="destructive" onClick={() => onDismiss(it)}>Dismiss</Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )

}