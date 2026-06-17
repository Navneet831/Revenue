import React, { useEffect, useState, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from './store/useStore';
import { GlobalSidebar } from './modules/shared/GlobalSidebar';
import { SectionBoundary } from './modules/shared/SectionBoundary';
import { ModulePlaceholder } from './modules/shared/ModulePlaceholder';
import { MODULE_REGISTRY } from './modules/registry';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { HelpModal } from './modules/shared/HelpModal';
import { GlobalTooltip } from './modules/shared/GlobalTooltip';
import { CommitDrilldown } from './modules/shared/CommitDrilldown';
import { FeatureService } from './services/featureService';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="w-screen h-screen flex flex-col items-center justify-center bg-white text-rose-500 p-8 text-center font-mono">
                    <h1 className="text-xl font-bold mb-4 uppercase tracking-widest">Critical Matrix Failure</h1>
                    <p className="text-xs text-slate-500 max-w-md">{this.state.error?.message}</p>
                    <button onClick={() => window.location.reload()} className="mt-8 px-6 py-2 bg-rose-500/10 border border-rose-500/20 rounded-full text-[10px] uppercase font-bold tracking-widest hover:bg-rose-500/20 transition-all">Reboot System</button>
                </div>
            );
        }
        return this.props.children;
    }
}

// Agent-feedback toolbar (bottom-right) — enabled per user request.
// Click the toolbar, then click any element to annotate it and copy structured output.
const AgentationToolbar = React.lazy(() => import('agentation').then((m) => ({ default: m.Agentation })));

const ModuleLoading: React.FC<{ label: string }> = ({ label }) => (
    <div className="flex-1 h-full flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Loading {label}...</span>
    </div>
);

/**
 * APPLICATION SHELL
 * Owns identity (auth/logout), global navigation, and module mounting.
 * Domain logic lives inside the bounded contexts listed in MODULE_REGISTRY —
 * the shell mounts exactly one active context and isolates its failures.
 */
export const App: React.FC = () => {
    const { updateUIState, activeApp, setFeatures, features } = useStore();

    const [helpOpen, setHelpOpen] = useState(false);

    useEffect(() => {
        const boot = async () => {
            const flags = await FeatureService.getFeatures();
            setFeatures(flags);

            const loader = document.getElementById('app-boot-loader');
            if (loader) {
                setTimeout(() => {
                    loader.style.opacity = '0';
                    setTimeout(() => loader.remove(), 500);
                }, 500);
            }
        };
        boot();
    }, [setFeatures]);

    useKeyboardShortcuts(() => setHelpOpen(true));

    const activeModule = MODULE_REGISTRY[activeApp];

    return (
        <ErrorBoundary>
            <div className="w-screen h-screen relative flex flex-col bg-white overflow-hidden">
                <div id="core-app" className="flex-1 flex w-full relative overflow-hidden font-sans antialiased text-[11px] font-medium tracking-wide text-slate-900">
                    <div className="flex h-full w-full relative select-none overflow-hidden">
                        <GlobalSidebar onOpenHelp={() => setHelpOpen(true)} onOpenStories={() => updateUIState({ storiesOpen: true })} />

                        <main className="flex-1 flex flex-col min-w-0 bg-white relative z-20 overflow-y-auto">
                            {activeModule?.Component ? (
                                <SectionBoundary name={activeModule.label} className="m-4 flex-1">
                                    <Suspense fallback={<ModuleLoading label={activeModule.label} />}>
                                        <activeModule.Component />
                                    </Suspense>
                                </SectionBoundary>
                            ) : (
                                <ModulePlaceholder moduleId={activeApp} />
                            )}
                        </main>
                    </div>

                    <GlobalTooltip />
                    <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
                    {features.commitDrilldown && <CommitDrilldown />}
                </div>

                {features.agentation && AgentationToolbar && (
                    <Suspense fallback={null}>
                        <AgentationToolbar />
                    </Suspense>
                )}
            </div>
        </ErrorBoundary>
    );
};
