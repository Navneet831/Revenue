import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { MODULE_REGISTRY, ModuleId } from '../registry';

/** Shown when a registered bounded context has no shipped entry point yet. */
export const ModulePlaceholder: React.FC<{ moduleId: ModuleId }> = ({ moduleId }) => {
    const def = MODULE_REGISTRY[moduleId];
    return (
        <div data-testid="module-placeholder" className="flex-1 h-full flex items-center justify-center flex-col gap-4">
            <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center border border-slate-700">
                <LayoutGrid className="w-8 h-8 text-slate-500 animate-pulse" />
            </div>
            <h2 className="text-white font-bold uppercase tracking-widest text-xs">Module {def?.label || moduleId} In Development</h2>
            <p className="text-slate-500 text-[9px] uppercase tracking-tighter">{def?.description || 'Unified Shell Protocol Active'}</p>
            <button onClick={() => useStore.getState().setActiveApp('REVENUE')} className="px-6 py-2 bg-emerald-500 text-black font-bold uppercase text-[10px] rounded-lg">Return to Revenue Hub</button>
        </div>
    );
};
