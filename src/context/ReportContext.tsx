'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { BackendReport } from '@/lib/mockReportData';

interface ReportContextType {
    report: BackendReport | null;
    setReportData: (data: BackendReport) => void;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export function ReportProvider({ children }: { children: ReactNode }) {
    const [report, setReport] = useState<BackendReport | null>(null);

    const setReportData = (data: BackendReport) => {
        setReport(data);
    };

    return (
        <ReportContext.Provider value={{ report, setReportData }}>
            {children}
        </ReportContext.Provider>
    );
}

export function useReport() {
    const context = useContext(ReportContext);
    if (!context) {
        throw new Error('useReport must be used within a ReportProvider');
    }
    return context;
}