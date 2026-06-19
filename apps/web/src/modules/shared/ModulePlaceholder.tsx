import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { useStore } from '@revenue/store/useStore';
import { MODULE_REGISTRY, ModuleId } from '../registry';

/** Shown when a registered bounded context has no shipped entry point yet. */
export const ModulePlaceholder: React.FC<{ moduleId: ModuleId }> = ({ moduleId }) => {
    const def = MODULE_REGISTRY[moduleId];
    return (
        <div data-testid="module-placeholder" className="flex-1 h-full flex items-center justify-center flex-col gap-4">
            <div className="w-16 h-16 bg-[#F5EDD8] rounded-2xl flex items-center justify-center border border-[#E7E5E4]">
                <LayoutGrid className="w-8 h-8 text-amber-400 animate-pulse" />
            </div>
            <h2 className="text-[#1C1917] font-medium text-base">Module {def?.label || moduleId} In Development</h2>
            <p className="text-[#78716C] text-[13px]">{def?.description || 'Unified Shell Protocol Active'}</p>
            <button onClick={() => useStore.getState().setActiveApp('REVENUE')} className="px-4 py-2 bg-[#D97706] text-[#1C1917] font-medium text-[14px] rounded-md transition-colors hover:bg-[#B45309] hover:text-white shadow-sm">Return to Revenue Hub</button>
        </div>
    );
};
