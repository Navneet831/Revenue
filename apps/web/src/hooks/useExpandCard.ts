import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store/useStore';

/**
 * CARD EXPAND / FULLSCREEN HOOK
 * Mirrors HTML app's UI.toggleExpand() and UI.collapseAll().
 * Uses CSS class "card-expanded" (defined in index.css) which positions the card
 * as fixed full-screen with backdrop.
 */
export function useExpandCard(cardId: string) {
    const { expandedId, setExpandedId } = useStore();
    const isExpanded = expandedId === cardId;
    const cardRef = useRef<HTMLElement | null>(null);

    const expand = useCallback(() => {
        const el = document.getElementById(cardId);
        if (!el) return;
        cardRef.current = el;

        // Collapse any currently expanded card first
        const prevId = useStore.getState().expandedId;
        if (prevId && prevId !== cardId) {
            const prevEl = document.getElementById(prevId);
            if (prevEl) {
                prevEl.classList.remove('card-expanded');
                // Return to dashboard canvas
                const canvas = document.getElementById('dashboard-canvas');
                if (canvas) canvas.appendChild(prevEl);
            }
        }

        setExpandedId(cardId);
        document.body.appendChild(el);
        el.classList.add('card-expanded');
    }, [cardId, setExpandedId]);

    const collapse = useCallback(() => {
        const el = document.getElementById(cardId);
        if (!el) return;
        el.classList.remove('card-expanded');

        // Return to dashboard canvas
        const canvas = document.getElementById('dashboard-canvas');
        if (canvas) canvas.appendChild(el);
        setExpandedId(null);
    }, [cardId, setExpandedId]);

    const toggle = useCallback(() => {
        if (isExpanded) {
            collapse();
        } else {
            expand();
        }
    }, [isExpanded, expand, collapse]);

    // Escape key collapses
    useEffect(() => {
        if (!isExpanded) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') collapse();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isExpanded, collapse]);

    return { isExpanded, toggle, expand, collapse };
}
