import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from './store/useStore';
import { AuthLayer } from './modules/auth/AuthLayer';
import { GlobalSidebar } from './modules/shared/GlobalSidebar';
import { SectionBoundary } from './modules/shared/SectionBoundary';
import { ModulePlaceholder } from './modules/shared/ModulePlaceholder';
import { MODULE_REGISTRY } from './modules/registry';
import { dbService } from './services/dbService';
import { supabaseService } from './services/supabaseService';
import { CacheService } from './services/cacheService';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { HelpModal } from './modules/shared/HelpModal';
import { GlobalTooltip } from './modules/shared/GlobalTooltip';

// Agent-feedback toolbar (bottom-right) — dev builds only, never bundled for production.
// Click the toolbar, then click any element to annotate it and copy structured output.
const AgentationToolbar = import.meta.env.DEV
    ? React.lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
    : null;

const ModuleLoading: React.FC<{ label: string }> = ({ label }) => (
    <div className="flex-1 h-full flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
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
    useEffect(() => {
        const loader = document.getElementById('app-boot-loader');
        if (loader) {
            setTimeout(() => {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 500);
            }, 500);
        }
    }, []);

    const { setUserEmail, setStats, setData, resetFilters, updateUIState, activeApp } = useStore();

    const [authenticated, setAuthenticated] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);

    const handleLogout = useCallback(async () => {
        try {
            await supabaseService.signOut();
        } catch (e) {
            // Continue local cleanup even if the remote sign-out fails
        }
        setAuthenticated(false);
        setUserEmail(null);
        setStats(null);
        setData([]);
        resetFilters();
        CacheService.purge();
        await dbService.purge();
        window.location.replace('/');
    }, [resetFilters, setData, setStats, setUserEmail]);

    useKeyboardShortcuts(authenticated, () => setHelpOpen(true), handleLogout);

    const activeModule = MODULE_REGISTRY[activeApp];

    return (
        <div className="w-screen h-screen relative flex flex-col bg-[#0b101e] overflow-hidden">
            <AuthLayer onAuthenticated={(email) => { setUserEmail(email); setAuthenticated(true); }} isHidden={authenticated} />

            {authenticated && (
                <div id="core-app" className="flex-1 flex w-full relative overflow-hidden font-sans antialiased text-[11px] font-medium tracking-wide text-slate-400">
                    <div className="flex h-full w-full relative select-none overflow-hidden">
                        <GlobalSidebar onLogout={handleLogout} onOpenHelp={() => setHelpOpen(true)} onOpenStories={() => updateUIState({ storiesOpen: true })} />

                        <main className="flex-1 flex flex-col min-w-0 bg-[#090C10] relative z-20 overflow-y-auto">
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
                </div>
            )}

            {AgentationToolbar && (
                <Suspense fallback={null}>
                    <AgentationToolbar />
                </Suspense>
            )}
        </div>
    );
};
