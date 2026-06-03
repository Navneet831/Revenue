import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

/**
 * EXECUTIVE KEYBOARD SHORTCUTS HOOK
 * Replicates the full system command suite from the original index.html.
 */
export const useKeyboardShortcuts = (
    authenticated: boolean,
    onOpenHelp: () => void,
    onLogout: () => void
) => {
    const { 
        filters, updateFilters, togglePrivacyMode, toggleSidebar, 
        updateUIState, ui, setCardView, cardViews, stats
    } = useStore();

    useEffect(() => {
        if (!authenticated) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // F1: System Help
            if (e.key === 'F1') {
                e.preventDefault();
                onOpenHelp();
            }

            // Ctrl + I: Intelligence Board
            if (e.ctrlKey && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                updateUIState({ insightsOpen: !ui.insightsOpen });
            }

            // Ctrl + M: Privacy Mask
            if (e.ctrlKey && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                togglePrivacyMode();
            }

            // Ctrl + B: Sidebar Toggle
            if (e.ctrlKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                toggleSidebar();
            }

            // Alt + A/M/Q: Metric Toggles
            if (e.altKey) {
                const key = e.key.toLowerCase();
                if (key === 'a') { e.preventDefault(); updateFilters({ metric: 'Amount' }); }
                if (key === 'm') { e.preventDefault(); updateFilters({ metric: 'MW' }); }
                if (key === 'q') { e.preventDefault(); updateFilters({ metric: 'Qty' }); }
                
                // Alt + [1-9]: Quick Isolate Segment
                if (!isNaN(parseInt(key)) && parseInt(key) > 0) {
                    const idx = parseInt(key) - 1;
                    const segments = stats?.allSegments || [];
                    if (segments[idx]) {
                        e.preventDefault();
                        updateFilters({ segment: [segments[idx]] });
                    }
                }
            }

            // Arrow Up/Down: Time Aggregation cycle
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                const modes: ('Daily' | 'Weekly' | 'Monthly' | 'Quarterly')[] = ['Daily', 'Weekly', 'Monthly', 'Quarterly'];
                const curIdx = modes.indexOf(filters.velocityMode);
                const nextIdx = e.key === 'ArrowUp' 
                    ? (curIdx + 1) % modes.length 
                    : (curIdx - 1 + modes.length) % modes.length;
                
                e.preventDefault();
                updateFilters({ velocityMode: modes[nextIdx] });
            }

            // Esc: Collapse / Exit
            if (e.key === 'Escape') {
                if (ui.insightsOpen) updateUIState({ insightsOpen: false });
                // Add logic for collapsing expanded cards if implemented
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [authenticated, filters.velocityMode, ui.insightsOpen, stats?.allSegments]);
};
