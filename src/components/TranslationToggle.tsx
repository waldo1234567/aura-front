"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { translateText } from "@/lib/mockAPI";

export default function TranslationToggle({ text, detected, onTranslated }: { text: string; detected?: string | null; onTranslated?: (t: string) => void }) {
    const [loading, setLoading] = useState(false);

    return (
        <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">Lang: <strong>{detected ?? "—"}</strong></div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">{loading ? "Translating…" : "Translate"}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={async () => { setLoading(true); const r = await translateText(text, "en"); setLoading(false); onTranslated?.(r.translated); }}>To English</DropdownMenuItem>
                    <DropdownMenuItem onClick={async () => { setLoading(true); const r = await translateText(text, "id"); setLoading(false); onTranslated?.(r.translated); }}>To Indonesian</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onTranslated?.(text)}>Reset</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}