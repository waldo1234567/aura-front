'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import type { BackendReport } from "@/types";
import { normalizeBackendResponse } from "@/lib/normalizeBackend";


interface ReportContextType {
    report: BackendReport | null;
    setReportData: (data: any) => void;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export function ReportProvider({ children }: { children: ReactNode }) {
    const [report, setReport] = useState<BackendReport | null>(null);

    const setReportData = (data: any) => {
        // if data already looks normalized (has faceMetrics with avgConfidence) accept it
        let normalized: BackendReport;
        if (data && data.faceMetrics && (data.faceMetrics.avgConfidence !== undefined || data.faceMetrics.percentTime)) {
            normalized = data as BackendReport;
        } else {
            normalized = normalizeBackendResponse(data);
        }
        setReport(normalized);
        try {
            window.localStorage.setItem("aura_report_data", JSON.stringify(normalized));
        } catch (e) { /* ignore storage errors */ }
    };

    return (
        <ReportContext.Provider value={{ report, setReportData }}>
            {children}
        </ReportContext.Provider>
    );
}

export function useReport() {
    const context = useContext(ReportContext);
    if (!context) throw new Error("useReport must be used within a ReportProvider");
    return context;
}