import React from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface SectionBoundaryProps {
    /** Human-readable section name shown in the degraded-state UI and telemetry */
    name: string;
    children: React.ReactNode;
    className?: string;
}

interface SectionBoundaryState {
    error: Error | null;
}

/**
 * Render-failure isolation for dashboard sections (bulkhead pattern).
 * A crash inside one section degrades that section only — the shell,
 * navigation, and sibling sections keep working. Failures are reported
 * to observability and the user gets an in-place retry.
 *
 * Data/loading/error states for *fetches* are owned by each section via
 * useSectionData; this boundary covers the remaining failure mode: a
 * thrown render/runtime error.
 */
export class SectionBoundary extends React.Component<SectionBoundaryProps, SectionBoundaryState> {
    state: SectionBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): SectionBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error(`[SectionBoundary:${this.props.name}]`, error, info.componentStack);
        Sentry.captureException(error, { tags: { section: this.props.name } });
    }

    render() {
        if (this.state.error) {
            return (
                <div
                    data-testid="section-fallback"
                    className={`flex flex-col items-center justify-center gap-2 bg-[#111620] border border-rose-900/40 rounded-2xl p-6 min-h-[120px] ${this.props.className || ''}`}
                >
                    <div className="flex items-center gap-2 text-rose-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{this.props.name} Unavailable</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono max-w-md text-center truncate">
                        {this.state.error.message}
                    </p>
                    <button
                        onClick={() => this.setState({ error: null })}
                        className="flex items-center gap-1.5 mt-1 px-3 py-1 bg-[#1E293B] text-slate-300 hover:text-white rounded-md text-[10px] font-bold uppercase tracking-wider"
                    >
                        <RotateCcw className="w-3 h-3" /> Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
