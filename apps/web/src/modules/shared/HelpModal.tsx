import React from 'react';
import { Terminal, X, Keyboard, BookOpen } from 'lucide-react';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/70 z-[99995] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-3xl card-3d bg-[#141b2d] border border-slate-700 shadow-2xl flex flex-col rounded-2xl overflow-hidden animate-in duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-3 px-4 border-b border-slate-800 bg-[#0b101e] flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider text-[11px] font-sans">
                        <Terminal className="w-4 h-4 text-emerald-400" /> System Command Reference
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md transition-colors btn-3d bg-[#151921] border border-slate-600 cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto no-scrollbar max-h-[75vh] grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-300 text-[11px] tracking-wide select-none">
                    {/* Shortcuts list */}
                    <div>
                        <h3 className="text-white font-bold border-b border-slate-800 pb-2 mb-4 uppercase tracking-tighter flex items-center gap-2">
                            <Keyboard className="w-3.5 h-3.5 text-emerald-400" /> Keyboard Shortcuts
                        </h3>
                        <ul className="space-y-3 font-sans">
                            <li className="flex justify-between items-center">
                                <span className="font-medium">System Manual</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700 text-white font-semibold">F1</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Multi-Toggle / Isolate Item</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700 text-white font-semibold">Ctrl + Click</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Intelligence Board</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700 text-white font-semibold">Ctrl + I</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Amount Metric</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700 text-white font-semibold">Alt + A</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">MW Metric</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700 text-white font-semibold">Alt + M</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Qty Metric</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700 text-white font-semibold">Alt + Q</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Toggle Privacy Mask</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700 text-white font-semibold">Ctrl + M</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Toggle Sidebar</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700 text-white font-semibold">Ctrl + B</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Time Aggregation cycle</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700 text-white font-semibold">↑ / ↓</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Scrub Chronological View</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700 text-white font-semibold">← / →</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Hard Refresh & Purge</span>
                                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700 text-white font-semibold">Ctrl + R</span>
                            </li>
                        </ul>
                    </div>

                    {/* Analytics Explanations */}
                    <div>
                        <h3 className="text-white font-bold border-b border-slate-800 pb-2 mb-4 uppercase tracking-tighter flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-blue-400" /> Analytics Logic
                        </h3>
                        <ul className="space-y-4">
                            <li>
                                <strong className="text-white block mb-0.5 tracking-tight">MTD / QTD / YTD</strong>
                                <span className="text-slate-400 leading-relaxed block text-[10px]">
                                    * <strong>MTD:</strong> Month-to-Date aggregation. <br />
                                    * <strong>QTD:</strong> Quarter-to-Date aggregation. <br />
                                    * <strong>YTD:</strong> Fiscal Year-to-Date aggregation (starts April 1st).
                                </span>
                            </li>
                            <li>
                                <strong className="text-white block mb-0.5 tracking-tight">MoM / QoQ / YoY Growth</strong>
                                <span className="text-slate-400 leading-relaxed block text-[10px]">
                                    * <strong>MoM:</strong> MTD vs Prior-Month Equivalent-Day Comparison. <br />
                                    * <strong>QoQ:</strong> QTD vs Prior-Year-Quarter Equivalent-Day Pacing. <br />
                                    * <strong>YoY:</strong> YTD vs Prior-Year Equivalent-Day Comparison.
                                </span>
                            </li>
                            <li>
                                <strong className="text-white block mb-0.5 tracking-tight">Smart Drilldown Filters</strong>
                                <span className="text-slate-400 leading-relaxed block text-[10px]">
                                    * Filters work in a 'Cascade' flow: Sales Head → Customer → SKU. Selecting a parent filter automatically refines the choices in the child lists.
                                </span>
                            </li>
                            <li>
                                <strong className="text-white block mb-0.5 tracking-tight">Intelligent Insight Engine</strong>
                                <span className="text-slate-400 leading-relaxed block text-[10px]">
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
