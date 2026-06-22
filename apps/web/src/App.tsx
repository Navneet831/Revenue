import React, { useEffect, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from './store/useStore';
import { GlobalSidebar } from './modules/shared/GlobalSidebar';
import { SectionBoundary } from './modules/shared/SectionBoundary';
import { ModulePlaceholder } from './modules/shared/ModulePlaceholder';
import { MODULE_REGISTRY } from './modules/registry';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { GlobalTooltip } from './modules/shared/GlobalTooltip';
import { FeatureService } from './services/featureService';
import { verifyWhitelistAndSetUser } from './services/authService';
import { supabase } from './services/supabaseClient';
import { AppFooter } from './modules/shared/AppFooter';
import { AuditView } from './modules/shared/AuditView';
import { DataSourceTable } from './modules/shared/DataSourceTable';
import { DevView } from './modules/shared/DevView';
import { Login } from './modules/shared/Login';
import { ExecutiveStories } from './modules/dashboard/ExecutiveStories';
import { GrewGptPanel } from './modules/shared/GrewGptPanel';

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
        isBootstrapping,
        setBootstrapping,
        setAuthError,
        setUser,
        setAuthenticated,
        activeMainView,
        ui,
    } = useStore();

    useEffect(() => {
        // Runtime listener: handles new sign-ins (OTP, magic link, OAuth)
        // and explicit sign-outs after the initial boot is complete.
        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    const result = await verifyWhitelistAndSetUser(session);
                    if (!result.ok && result.errorMsg) {
                        setAuthError(result.errorMsg);
                    }
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setAuthenticated(false);
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

            setFeatures(flags);

            if (flags.enable_auth && session) {
                // Existing session: verify against the whitelist before showing anything.
                const result = await verifyWhitelistAndSetUser(session, { skipDelay: true });
                if (!result.ok && result.errorMsg) {
                    setAuthError(result.errorMsg);
                }
            }

            // Auth state is now fully resolved — safe to render.
            setBootstrapping(false);

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
                            {activeMainView === 'DEV' && features.devTab ? (
                                <DevView />
                            ) : activeMainView === 'AUDIT' && features.audit ? (
                                <AuditView />
                            ) : activeMainView === 'LEDGER' && features.ledger ? (
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
                        <ExecutiveStories isOpen={ui.storiesOpen} onClose={() => updateUIState({ storiesOpen: false })} />
                    )}
                </div>

                <AppFooter />

                {features.grewGpt && <GrewGptPanel />}

                {features.agentation && AgentationToolbar && (
                    <Suspense fallback={null}>
                        <AgentationToolbar />
                    </Suspense>
                )}
            </div>
        </ErrorBoundary>
    );
};
