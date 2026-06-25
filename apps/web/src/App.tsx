import React, { useEffect, Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from './store/useStore';
import { supabase, verifyWhitelistAndSetUser, useAuthStore } from '@grew/auth';
import { GlobalSidebar } from './modules/shared/GlobalSidebar';
import { SectionBoundary } from './modules/shared/SectionBoundary';
import { ModulePlaceholder } from './modules/shared/ModulePlaceholder';
import { MODULE_REGISTRY } from './modules/registry';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { GlobalTooltip } from './modules/shared/GlobalTooltip';
import { CommitDrilldown } from './modules/shared/CommitDrilldown';
import { GrewGPTErrorBoundary } from './modules/shared/GrewGPTErrorBoundary';
import { FeatureService } from './services/featureService';
import { AppFooter } from './modules/shared/AppFooter';
import { DataSourceTable } from './modules/shared/DataSourceTable';
import { Login } from './modules/shared/Login';

// Lazy load heavy components - named exports wrapped as default
const AuditView = lazy(() => import('./modules/shared/AuditView').then(m => ({ default: m.AuditView })));
const DevView = lazy(() => import('./modules/shared/DevView').then(m => ({ default: m.DevView })));
const GrewGPTPanel = lazy(() => import('./modules/shared/GrewGPTPanel').then(m => ({ default: m.GrewGPTPanel })));
const GrewGPTPage = lazy(() => import('./modules/shared/GrewGPTPage').then(m => ({ default: m.GrewGPTPage })));
const ExecutiveStories = lazy(() => import('./modules/dashboard/ExecutiveStories').then(m => ({ default: m.ExecutiveStories })));

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
    // Auth state from the shared package
    const {
        isAuthenticated,
        isBootstrapping,
        setBootstrapping,
        setUser,
        setAuthenticated,
        user: authUser,
    } = useAuthStore();

    // App-specific state stays in Revenue's store
    const {
        updateUIState,
        activeApp,
        setFeatures,
        features,
        activeMainView,
        ui,
    } = useStore();

    // Sync per-user whitelist features into Revenue's combined feature store
    // whenever the authenticated user changes.
    useEffect(() => {
        if (authUser?.features) {
            const { enable_auth } = useStore.getState().features;
            setFeatures({ enable_auth, ...authUser.features });
        }
    }, [authUser, setFeatures]);

    useEffect(() => {
        // Runtime listener: handles new sign-ins (OTP, magic link, OAuth)
        // and explicit sign-outs after the initial boot is complete.
        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    await verifyWhitelistAndSetUser(session);
                    // State is updated inside verifyWhitelistAndSetUser via useAuthStore
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);        // useAuthStore's setUser
                    setAuthenticated(false);  // useAuthStore's setAuthenticated
                }
            }
        );

        const boot = async () => {
            // Fetch global feature flags AND check the current Supabase session
            // in parallel so we can make the auth decision in one shot — no flash.
            const [flags, { data: { session } }] = await Promise.all([
                FeatureService.getFeatures(),
                supabase.auth.getSession(),
            ]);

            setFeatures(flags);  // useStore.setFeatures — sets enable_auth + any initial flags

            if (flags.enable_auth && session) {
                // Existing session: verify against the whitelist before showing anything.
                await verifyWhitelistAndSetUser(session, { skipDelay: true });
                // useAuthStore updated internally; feature-sync effect fires automatically
            }

            // Auth state is now fully resolved — safe to render.
            setBootstrapping(false);  // useAuthStore.setBootstrapping

            const loader = document.getElementById('app-boot-loader');
            if (loader) {
                setTimeout(() => {
                    loader.style.opacity = '0';
                    setTimeout(() => loader.remove(), 500);
                }, 500);
            }
        };

        boot();

        return () => authListener.subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (isAuthenticated && window.location.pathname === '/auth/callback') {
            window.history.replaceState({}, document.title, '/');
        }
    }, [isAuthenticated]);

    useKeyboardShortcuts(() => {
        updateUIState({ storiesOpen: true });
    });

    // Block ALL rendering until features + auth are resolved.
    if (isBootstrapping) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-[#05070A]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-[3px] border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">
                        Verifying Access…
                    </p>
                </div>
            </div>
        );
    }

    if (features.enable_auth && !isAuthenticated) {
        return <Login redirectTo="http://127.0.0.1:8000/auth/callback" />;
    }

    const activeModule = MODULE_REGISTRY[activeApp];

    return (
        <ErrorBoundary>
            <div className="w-screen h-screen relative flex flex-col bg-canvas overflow-hidden">
                <div id="core-app" className="flex-1 flex w-full relative overflow-hidden font-sans antialiased text-[11px] font-medium tracking-wide text-slate-900">
                    <div className="flex h-full w-full relative select-none overflow-hidden">
                        <GlobalSidebar onOpenStories={() => updateUIState({ storiesOpen: true })} />

                        <main className="flex-1 flex flex-col min-w-0 bg-canvas relative z-10 overflow-y-auto">
                            {/* Ambient gradient orbs — warm depth effect */}
                            <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
                                <div className="ambient-orb-amber" />
                                <div className="ambient-orb-teal" />
                                <div className="ambient-orb-rose" />
                            </div>
                            {activeMainView === 'GREWGPT' && features.GrewGpt ? (
                                <Suspense fallback={<ModuleLoading label="GrewGPT" />}>
                                    <GrewGPTPage />
                                </Suspense>
                            ) : activeMainView === 'AUDIT' && features.audit ? (
                                <Suspense fallback={<ModuleLoading label="Audit" />}>
                                    <AuditView />
                                </Suspense>
                            ) : activeMainView === 'DEV' && features.Dev ? (
                                <Suspense fallback={<ModuleLoading label="Developer Panel" />}>
                                    <DevView />
                                </Suspense>
                            ) : activeMainView === 'LEDGER' && features.Ledger ? (
                                <DataSourceTable />
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
                        <Suspense fallback={null}>
                            <ExecutiveStories isOpen={ui.storiesOpen} onClose={() => updateUIState({ storiesOpen: false })} />
                        </Suspense>
                    )}
                    <CommitDrilldown />
                    <GrewGPTErrorBoundary>
                        <Suspense fallback={null}>
                            <GrewGPTPanel />
                        </Suspense>
                    </GrewGPTErrorBoundary>
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
