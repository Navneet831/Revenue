import React from 'react';
import { Terminal, X, Keyboard, BookOpen, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/40 z-[99995] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-3xl card-3d flex flex-col rounded-xl overflow-hidden animate-in duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-3 px-4 border-b border-[#EDE8E0] bg-[#EAE3D6] flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 text-[#1C1917] font-bold uppercase tracking-wider text-[11px] font-sans">
                        <Terminal className="w-4 h-4 text-amber-600" /> System Command Reference
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                onClose();
                                localStorage.removeItem('grew_revenue_onboarding_completed_v1');
                                localStorage.setItem('grew_revenue_onboarding_step_v1', '0');
                                const store = useStore.getState();
                                store.setTourStep(0);
                                store.setTourOpen(true);
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="Start Guided Onboarding Tour"
                        >
                            <Sparkles className="w-3 h-3 text-emerald-600" /> Replay Tour
                        </button>
                        <button
                            onClick={onClose}
                            className="w-7 h-7 flex items-center justify-center text-[#78716C] hover:text-[#1C1917] bg-[#F0EBE0] hover:bg-[#E2D9C8] rounded-full transition-colors cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto no-scrollbar max-h-[75vh] grid grid-cols-1 md:grid-cols-2 gap-8 text-[#404040] text-[12px] tracking-normal select-none">
                    {/* Shortcuts list */}
                    <div>
                        <h3 className="text-[#1C1917] font-bold border-b border-[#EDE8E0] pb-2 mb-4 uppercase tracking-tight flex items-center gap-2">
                            <Keyboard className="w-3.5 h-3.5 text-amber-600" /> Keyboard Shortcuts
                        </h3>
                        <ul className="space-y-3 font-sans">
                            <li className="flex justify-between items-center">
                                <span className="font-medium">System Manual</span>
                                <span className="font-mono bg-[#FEF9F0] px-1.5 py-0.5 rounded-md border border-[#E7E5E4] text-[#1C1917] font-semibold">F1</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Multi-Toggle / Isolate Item</span>
                                <span className="font-mono bg-[#FEF9F0] px-1.5 py-0.5 rounded-md border border-[#E7E5E4] text-[#1C1917] font-semibold">Ctrl + Click</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Intelligence Board</span>
                                <span className="font-mono bg-[#FEF9F0] px-1.5 py-0.5 rounded-md border border-[#E7E5E4] text-[#1C1917] font-semibold">Ctrl + I</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Amount Metric</span>
                                <span className="font-mono bg-[#FEF9F0] px-1.5 py-0.5 rounded-md border border-[#E7E5E4] text-[#1C1917] font-semibold">Alt + A</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">MW Metric</span>
                                <span className="font-mono bg-[#FEF9F0] px-1.5 py-0.5 rounded-md border border-[#E7E5E4] text-[#1C1917] font-semibold">Alt + M</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Qty Metric</span>
                                <span className="font-mono bg-[#FEF9F0] px-1.5 py-0.5 rounded-md border border-[#E7E5E4] text-[#1C1917] font-semibold">Alt + Q</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Toggle Privacy Mask</span>
                                <span className="font-mono bg-[#FEF9F0] px-1.5 py-0.5 rounded-md border border-[#E7E5E4] text-[#1C1917] font-semibold">Ctrl + M</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Toggle Sidebar</span>
                                <span className="font-mono bg-[#FEF9F0] px-1.5 py-0.5 rounded-md border border-[#E7E5E4] text-[#1C1917] font-semibold">Ctrl + B</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Time Aggregation cycle</span>
                                <span className="font-mono bg-[#FEF9F0] px-1.5 py-0.5 rounded-md border border-[#E7E5E4] text-[#1C1917] font-semibold">↑ / ↓</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Scrub Chronological View</span>
                                <span className="font-mono bg-[#FEF9F0] px-1.5 py-0.5 rounded-md border border-[#E7E5E4] text-[#1C1917] font-semibold">← / →</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Hard Refresh & Purge</span>
                                <span className="font-mono bg-[#FEF9F0] px-1.5 py-0.5 rounded-md border border-[#E7E5E4] text-[#1C1917] font-semibold">Ctrl + R</span>
                            </li>
                        </ul>
                    </div>

                    {/* Analytics Explanations */}
                    <div>
                        <h3 className="text-[#171717] font-bold border-b border-[#ededed] pb-2 mb-4 uppercase tracking-tight flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-emerald-500" /> Analytics Logic
                        </h3>
                        <ul className="space-y-4">
                            <li>
                                <strong className="text-[#171717] block mb-0.5 tracking-tight">MTD / QTD / YTD</strong>
                                <span className="text-[#707070] leading-relaxed block text-[12px]">
                                    * <strong>MTD:</strong> Month-to-Date aggregation. <br />
                                    * <strong>QTD:</strong> Quarter-to-Date aggregation. <br />
                                    * <strong>YTD:</strong> Fiscal Year-to-Date aggregation (starts April 1st).
                                </span>
                            </li>
                            <li>
                                <strong className="text-[#171717] block mb-0.5 tracking-tight">MoM / QoQ / YoY Growth</strong>
                                <span className="text-[#707070] leading-relaxed block text-[12px]">
                                    * <strong>MoM:</strong> MTD vs Prior-Month Equivalent-Day Comparison. <br />
                                    * <strong>QoQ:</strong> QTD vs Prior-Year-Quarter Equivalent-Day Pacing. <br />
                                    * <strong>YoY:</strong> YTD vs Prior-Year Equivalent-Day Comparison.
                                </span>
                            </li>
                            <li>
                                <strong className="text-[#171717] block mb-0.5 tracking-tight">Smart Drilldown Filters</strong>
                                <span className="text-[#707070] leading-relaxed block text-[12px]">
                                    * Filters work in a 'Cascade' flow: Sales Head → Customer → SKU. Selecting a parent filter automatically refines the choices in the child lists.
                                </span>
                            </li>
                            <li>
                                <strong className="text-[#171717] block mb-0.5 tracking-tight">Intelligent Insight Engine</strong>
                                <span className="text-[#707070] leading-relaxed block text-[12px]">
                                    * The Intelligence Board uses HHI concentration models and trailing momentum trends to highlight risks and opportunities automatically.
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
