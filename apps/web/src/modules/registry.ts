import React from 'react';

/**
 * BOUNDED-CONTEXT REGISTRY
 * Single manifest of every domain module the shell can mount.
 * Adding a module = one entry here + one vertical slice under modules/<name>.
 * Modules are code-split: a context's bundle is fetched only when activated.
 */
export type ModuleId = 'REVENUE' | 'INVENTORY' | 'LOGISTICS';

export interface ModuleDefinition {
    id: ModuleId;
    label: string;
    description: string;
    status: 'GA' | 'IN_DEVELOPMENT';
    /** Lazy entry point of the bounded context; null while in development */
    Component: React.LazyExoticComponent<React.FC> | null;
}

export const MODULE_REGISTRY: Record<ModuleId, ModuleDefinition> = {
    REVENUE: {
        id: 'REVENUE',
        label: 'Revenue Intelligence',
        description: 'Sales velocity, KPI governance, and dispatch analytics',
        status: 'GA',
        Component: React.lazy(() =>
            import('./revenue/RevenueDashboard').then((m) => ({ default: m.RevenueDashboard }))
        ),
    },
    INVENTORY: {
        id: 'INVENTORY',
        label: 'Inventory & Stock',
        description: 'Warehouse stock levels and movement intelligence',
        status: 'IN_DEVELOPMENT',
        Component: null,
    },
    LOGISTICS: {
        id: 'LOGISTICS',
        label: 'Logistics',
        description: 'Dispatch tracking and fleet operations',
        status: 'IN_DEVELOPMENT',
        Component: null,
    },
};
