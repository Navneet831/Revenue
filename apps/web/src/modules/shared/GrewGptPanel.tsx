import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, Loader2, AlertTriangle } from 'lucide-react';
import { useStore } from '@revenue/store/useStore';
import { supabase } from '@revenue/services/supabaseClient';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

// Starter templates shown on the empty panel. Clicking one sends it immediately.
const SUGGESTIONS = [
    'What does this dashboard show right now?',
    'Who are my top 5 customers this period?',
    'Which SKUs are driving the most revenue?',
    'How is MTD tracking versus last month?',
    'Any risks in customer or product concentration?',
];

// Talks to the Supabase `grewGpt` edge function (OpenRouter-backed, keyed by the
// `AI` secret). functions.invoke attaches the session JWT (or the anon key) that
// the function's verify_jwt gate requires — no API key lives in the frontend.
export const GrewGptPanel: React.FC = () => {
    const { ui, updateUIState, activeApp, activeMainView, filters, stats, user } = useStore();
    const isOpen = ui.grewGptOpen;

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!isOpen) return undefined;
        // Focus the input shortly after the open transition settles.
        const t = setTimeout(() => inputRef.current?.focus(), 150);
        return () => clearTimeout(t);
    }, [isOpen]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, loading]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) updateUIState({ grewGptOpen: false });
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, updateUIState]);

    // Summarise exactly what the dashboard is currently showing so GrewGPT can
    // answer questions about the on-screen numbers, not just general knowledge.
    const buildDashboardContext = () => {
        const round = (n: any, d = 2) =>
            typeof n === 'number' && isFinite(n) ? Number(n.toFixed(d)) : n;
        const top = (arr: any[] | undefined, limit: number) =>
            (arr ?? [])
                .slice()
                .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
                .slice(0, limit)
                .map((e) => ({ name: e.n, value: round(e.v) }));

        const metricUnit =
            filters.metric === 'Amount' ? '₹ Crore' : filters.metric === 'MW' ? 'MW' : 'Qty';

        return {
            user_email: user?.name ?? null,
            active_app: activeApp,
            active_view: activeMainView,
            metric: filters.metric,
            metric_unit: metricUnit,
            date_range: { from: filters.startDate, to: filters.endDate },
            filters: {
                segments: filters.segment,
                sales_heads: filters.salesHead,
                customers: filters.customer,
                skus: filters.selectedSku,
                pending_only: filters.pendingOnly,
            },
            active_segments: stats?.activeSegments ?? [],
            totals: stats
                ? {
                      revenue_cr: round(stats.totalCr),
                      mw: round(stats.totalMW),
                      qty: round(stats.totalQty, 0),
                      realization_cr_per_mw: round(stats.realization),
                  }
                : null,
            kpis: stats
                ? {
                      anchor_date_sales: round(stats.kpi.periodSales),
                      mtd: round(stats.kpi.mtd),
                      prev_mtd: round(stats.kpi.prevMtd),
                      qtd: round(stats.kpi.qtd),
                      prev_qtd: round(stats.kpi.prevQtd),
                      ytd: round(stats.kpi.ytd),
                      prev_ytd: round(stats.kpi.prevYtd),
                      pending: round(stats.kpi.pending),
                      last_7_days: round(stats.last7DaysSales),
                  }
                : null,
            top_customers: top(stats?.cust, 8),
            top_skus: top(stats?.wp, 8),
            sales_heads: top(stats?.sh, 12),
            monthly_matrix: (stats?.matrix ?? []).map((m) => ({
                month: m.month,
                value_cr: round(m.valCr),
                mw: round(m.mw),
                qty: round(m.qty, 0),
                mom_pct: round(m.mom, 1),
                yoy_pct: round(m.yoy, 1),
            })),
            insights: (stats?.insights ?? []).map((i) => ({ label: i.l, text: i.txt })),
        };
    };

    const send = async (override?: string) => {
        const text = (override ?? input).trim();
        if (!text || loading) return;

        const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
        setMessages(nextMessages);
        setInput('');
        setError(null);
        setLoading(true);

        try {
            const { data, error: invokeError } = await supabase.functions.invoke('grewGpt', {
                body: {
                    messages: nextMessages,
                    dashboard_context: buildDashboardContext(),
                    environment: import.meta.env.MODE,
                },
            });

            if (invokeError) throw new Error(invokeError.message);
            if (data?.error) throw new Error(data.error);

            const reply = String(data?.reply ?? '').trim();
            if (!reply) throw new Error('GrewGPT returned an empty response.');

            setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        } catch (err: any) {
            setError(err?.message || 'GrewGPT request failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={() => updateUIState({ grewGptOpen: false })}
                className={`fixed inset-0 z-[1400] bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
            />

            {/* Slide-over panel */}
            <aside
                className={`fixed top-0 right-0 z-[1401] h-full w-full max-w-[400px] bg-white border-l border-[#E7E5E4] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
                aria-hidden={!isOpen}
            >
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-[#E7E5E4] bg-gradient-to-r from-sky-50 to-white">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-sky-500" />
                        </div>
                        <div className="leading-tight">
                            <div className="text-[12px] font-bold text-slate-800 tracking-tight">GrewGPT</div>
                            <div className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">AI Assistant</div>
                        </div>
                    </div>
                    <button
                        onClick={() => updateUIState({ grewGptOpen: false })}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Close (Esc)"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {messages.length === 0 && !loading && (
                        <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-2">
                            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center">
                                <Sparkles className="w-6 h-6 text-sky-500" />
                            </div>
                            <p className="text-[12px] font-semibold text-slate-700">Ask GrewGPT anything</p>
                            <p className="text-[11px] text-slate-400 leading-relaxed px-4">
                                It has live context of what the dashboard is showing — your current filters, KPIs, top
                                customers and SKUs.
                            </p>

                            <div className="w-full pt-2">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-left">
                                    Try asking
                                </p>
                                <div className="space-y-1.5">
                                    {SUGGESTIONS.map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => send(s)}
                                            className="w-full text-left text-[11px] text-slate-600 bg-slate-50 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 hover:border-sky-200 rounded-lg px-3 py-2 transition-colors"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed whitespace-pre-wrap break-words ${
                                    m.role === 'user'
                                        ? 'bg-sky-500 text-white rounded-br-md'
                                        : 'bg-slate-100 text-slate-800 rounded-bl-md'
                                }`}
                            >
                                {m.content}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span className="text-[11px]">Thinking…</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-[11px] text-rose-600">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span className="break-words">{error}</span>
                        </div>
                    )}
                </div>

                {/* Composer */}
                <div className="shrink-0 border-t border-[#E7E5E4] p-3 bg-white">
                    <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 focus-within:border-sky-400 focus-within:bg-white transition-colors px-3 py-2">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            placeholder="Ask about your revenue…"
                            className="flex-1 resize-none bg-transparent outline-none text-[12px] text-slate-800 placeholder:text-slate-400 max-h-28 leading-relaxed"
                        />
                        <button
                            onClick={send}
                            disabled={!input.trim() || loading}
                            className="shrink-0 w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-600 transition-colors"
                            title="Send (Enter)"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <p className="text-[9px] text-slate-400 text-center mt-1.5">
                        Enter to send · Shift+Enter for a new line
                    </p>
                </div>
            </aside>
        </>
    );
};
