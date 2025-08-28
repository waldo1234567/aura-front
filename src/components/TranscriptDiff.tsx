import React from "react";
import DiffMatchPatch from 'diff-match-patch';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // adjust if different
import { Button } from "@/components/ui/button";

interface PolishedTranscriptShape {
    finalTranscript?: string;
    edits?: string[];
}

interface Props {
    rawTranscript: string;
    polishedTranscript: string | PolishedTranscriptShape;
    onChoose: (usePolished: boolean) => void;
    onClose: () => void;
}

const dmp = new DiffMatchPatch();

export default function TranscriptDiff({ rawTranscript, polishedTranscript, onChoose, onClose}: Props) {
    const polishedText =
        typeof polishedTranscript === "string"
            ? polishedTranscript
            : (polishedTranscript && polishedTranscript.finalTranscript) || "";

    const diffs = dmp.diff_main(rawTranscript || " ", polishedText || " ");
    dmp.diff_cleanupSemantic(diffs);

    const renderDiff = () =>
        diffs.map((d: any, i: number) => {
            const [type, text]: [number, string] = d;
            if (type === DiffMatchPatch.DIFF_INSERT) {
                return (
                    <span key={i} className="bg-green-100 text-green-900 px-[1px] rounded-sm">
                        {text}
                    </span>
                );
            }
            if (type === DiffMatchPatch.DIFF_DELETE) {
                return (
                    <span key={i} className="bg-red-100 text-red-800 line-through px-[1px] rounded-sm">
                        {text}
                    </span>
                );
            }
            return <span key={i}>{text}</span>;
        })

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
            <Card className="w-[95%] md:w-3/4 max-w-4xl">
                <CardHeader className="flex items-center justify-between">
                    <CardTitle>Preview Transcript</CardTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    </div>
                </CardHeader>

                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-sm font-medium mb-2">Raw</h4>
                            <div className="whitespace-pre-wrap border border-slate-100 rounded-md p-3 min-h-[140px] text-sm">
                                {rawTranscript || "(empty)"}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium mb-2">Polished (changes highlighted)</h4>
                            <div className="whitespace-pre-wrap border border-slate-100 rounded-md p-3 min-h-[140px] text-sm">
                                {renderDiff()}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onChoose(false)}>
                            Use Raw
                        </Button>
                        <Button onClick={() => onChoose(true)}>
                            { "Use Polished"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
