import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { CacheService } from '@/services/cacheService';

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
        updateUIState, ui, setCardView, cardViews,
        allSegments, expandedId, setExpandedId
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

            // Ctrl + R: Force Reload (purge cache first)
            if (e.ctrlKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                CacheService.purge();
                window.location.reload();
            }

            // Ctrl + A: Select All Segments
            if (e.ctrlKey && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                updateFilters({ segment: [...allSegments] });
            }

            // Alt + A/M/Q/V: Metric and View Toggles
            if (e.altKey) {
                const key = e.key.toLowerCase();
                const code = e.code; // Fallback for robust detection across locales

                if (key === 'a' || code === 'KeyA') { e.preventDefault(); updateFilters({ metric: 'Amount' }); }
                if (key === 'm' || code === 'KeyM') { e.preventDefault(); updateFilters({ metric: 'MW' }); }
                if (key === 'q' || code === 'KeyQ') { e.preventDefault(); updateFilters({ metric: 'Qty' }); }
                if (key === 'v' || code === 'KeyV') { 
                    e.preventDefault();
                    useStore.getState().toggleAllViews();
                }
                
                // Alt + [1-9]: Quick Isolate Segment
                if (!isNaN(parseInt(key)) && parseInt(key) > 0) {
                    const idx = parseInt(key) - 1;
                    if (allSegments[idx]) {
                        e.preventDefault();
                        updateFilters({ segment: [allSegments[idx]] });
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
                // 1. Close insights panel if open
                if (ui.insightsOpen) {
                    updateUIState({ insightsOpen: false });
                }

                // 2. Collapse expanded card if one is expanded
                if (expandedId) {
                    const el = document.getElementById(expandedId);
                    if (el) {
                        el.classList.remove('card-expanded');
                        const canvas = document.getElementById('dashboard-canvas');
                        if (canvas) {
                            canvas.appendChild(el);
                        }
                    }
                    setExpandedId(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [authenticated, filters.velocityMode, ui.insightsOpen, allSegments, expandedId, cardViews]);
};
