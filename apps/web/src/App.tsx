import React, { useEffect, useState, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from './store/useStore';
import { GlobalSidebar } from './modules/shared/GlobalSidebar';
import { SectionBoundary } from './modules/shared/SectionBoundary';
import { ModulePlaceholder } from './modules/shared/ModulePlaceholder';
import { MODULE_REGISTRY } from './modules/registry';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { GlobalTooltip } from './modules/shared/GlobalTooltip';
import { CommitDrilldown } from './modules/shared/CommitDrilldown';
import { FeatureService } from './services/featureService';
import { AppFooter } from './modules/shared/AppFooter';
import { AuditView } from './modules/shared/AuditView';
import { TransactionLedger } from './modules/shared/TransactionLedger';
import { Login } from './modules/shared/Login';
import { ExecutiveStories } from './modules/dashboard/ExecutiveStories';

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

const AgentationToolbar = React.lazy(() => import('agentation').then((m) => ({ default: m.Agentation })));

const ModuleLoading: React.FC<{ label: string }> = ({ label }) => (
    <div className="flex-1 h-full flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Loading {label}...</span>
    </div>
);

export const App: React.FC = () => {
    const { 
        updateUIState, 
        activeApp, 
        setFeatures, 
        features, 
        isAuthenticated, 
        activeMainView,
        ui,
        user
    } = useStore();

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

    useKeyboardShortcuts(() => {
        // If they use the shortcut, maybe toggle to audit or open stories
        updateUIState({ storiesOpen: true });
    });

    if (features.enable_auth && !isAuthenticated) {
        return <Login />;
    }

    const activeModule = MODULE_REGISTRY[activeApp];

    return (
        <ErrorBoundary>
            <div className="w-screen h-screen relative flex flex-col bg-white overflow-hidden">
                <div id="core-app" className="flex-1 flex w-full relative overflow-hidden font-sans antialiased text-[11px] font-medium tracking-wide text-slate-900">
                    <div className="flex h-full w-full relative select-none overflow-hidden">
                        <GlobalSidebar onOpenStories={() => updateUIState({ storiesOpen: true })} />

                        <main className="flex-1 flex flex-col min-w-0 bg-white relative z-20 overflow-y-auto">
                            {activeMainView === 'AUDIT' && (!user || user.features?.audit === true) ? (
                                <AuditView />
                            ) : activeMainView === 'LEDGER' && (!user || user.features?.ledger === true) ? (
                                <TransactionLedger />
                            ) : activeModule?.Component ? (
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
                    {features.story && ui.storiesOpen && (
                        <ExecutiveStories isOpen={ui.storiesOpen} onClose={() => updateUIState({ storiesOpen: false })} />
                    )}
                    {features.commitDrilldown && <CommitDrilldown />}
                </div>

                <AppFooter />

                {features.agentation && AgentationToolbar && (
                    <Suspense fallback={null}>
                        <AgentationToolbar />
                    </Suspense>
                )}
            </div>
        </ErrorBoundary>
    );
};
