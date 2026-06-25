import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, User, Loader2, AlertCircle, History, ArrowLeft } from 'lucide-react';
import { useStore } from '@revenue/store/useStore';
import { useAuthStore } from '@grew/auth';
import { supabase } from '@revenue/services/supabaseClient';

interface Message {
    role: 'user' | 'assistant';
    text: string;
    loading?: boolean;
    error?: boolean;
}

interface ConversationRow {
    id: string;
    user_prompt: string;
    ai_response: string;
    created_at: string;
}

const STARTERS = [
    'What is my YTD revenue vs last year?',
    'Show top 5 customers by revenue this month',
    'Which segment has the highest growth rate?',
    'What is the current pacing for this month?',
];

// Minimal markdown → JSX renderer: headings, bold, code, bullets, numbered lists, tables.
function renderMarkdown(text: string): React.ReactNode {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    const isTableRow = (l: string) => l.trim().startsWith('|') && l.trim().endsWith('|');
    const isSepRow   = (l: string) => /^\|[\s\-:|]+\|$/.test(l.trim());

    const inline = (line: string): React.ReactNode => {
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return parts.map((p, idx) => {
            if (p.startsWith('**') && p.endsWith('**'))
                return <strong key={idx} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
            if (p.startsWith('`') && p.endsWith('`'))
                return <code key={idx} className="bg-amber-50 text-amber-700 px-1 rounded text-[10px] font-mono">{p.slice(1, -1)}</code>;
            return p;
        });
    };

    while (i < lines.length) {
        const line = lines[i];

        if (isTableRow(line) && i + 1 < lines.length && isSepRow(lines[i + 1])) {
            const headers = line.split('|').filter(Boolean).map(h => h.trim());
            const rows: string[][] = [];
            let j = i + 2;
            while (j < lines.length && isTableRow(lines[j])) {
                rows.push(lines[j].split('|').filter(Boolean).map(c => c.trim()));
                j++;
            }
            nodes.push(
                <div key={key++} className="overflow-x-auto my-2 rounded-lg border border-hairline">
                    <table className="w-full text-[10.5px] border-collapse">
                        <thead>
                            <tr className="bg-canvas-deep">
                                {headers.map((h, hi) => (
                                    <th key={hi} className="px-2.5 py-1.5 text-left font-bold text-ink border-b border-hairline whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, ri) => (
                                <tr key={ri} className={ri % 2 === 0 ? 'bg-canvas' : 'bg-canvas-soft/40'}>
                                    {row.map((cell, ci) => (
                                        <td key={ci} className="px-2.5 py-1.5 text-ink-secondary border-b border-hairline whitespace-nowrap font-mono text-[10px]">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            i = j;
            continue;
        }

        if (isSepRow(line)) { i++; continue; }
        if (!line.trim()) { nodes.push(<div key={key++} className="h-1.5" />); i++; continue; }
        if (line.startsWith('### ')) { nodes.push(<p key={key++} className="text-[10px] font-black text-ink-mute uppercase tracking-wide mt-2 mb-0.5">{line.slice(4)}</p>); i++; continue; }
        if (line.startsWith('## '))  { nodes.push(<p key={key++} className="text-[11px] font-black text-ink uppercase tracking-wide mt-3 mb-1">{line.slice(3)}</p>); i++; continue; }
        if (line.startsWith('# '))   { nodes.push(<p key={key++} className="text-[12px] font-black text-ink mt-3 mb-1">{line.slice(2)}</p>); i++; continue; }
        if (line.startsWith('- ') || line.startsWith('* ')) {
            nodes.push(<div key={key++} className="flex gap-2 items-start"><span className="text-amber-600 font-bold shrink-0 mt-0.5">•</span><span>{inline(line.slice(2))}</span></div>);
            i++; continue;
        }
        const numMatch = line.match(/^(\d+)\.\s(.*)$/);
        if (numMatch) {
            nodes.push(<div key={key++} className="flex gap-2 items-start"><span className="text-amber-600 font-bold shrink-0 w-4">{numMatch[1]}.</span><span>{inline(numMatch[2])}</span></div>);
            i++; continue;
        }
        nodes.push(<p key={key++}>{inline(line)}</p>);
        i++;
    }
    return <div className="space-y-0.5 text-[11px] leading-relaxed text-ink-secondary">{nodes}</div>;
}

export const GrewGPTPanel: React.FC = () => {
    const { ui, updateUIState, features, stats, filters, data, activeApp } = useStore();
    const { user } = useAuthStore();

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);
    const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    const [view, setView] = useState<'chat' | 'history'>('chat');
    const [historyItems, setHistoryItems] = useState<ConversationRow[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState<ConversationRow | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', text: "Hello! I'm GrewGPT — Grew Analytics AI. Ask me about your revenue data, trends, and performance metrics." },
    ]);

    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const isOpen = !!(features.GrewGpt && ui?.grewGptOpen);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!isOpen) return;
        const t = setTimeout(() => inputRef.current?.focus(), 100);
        return () => clearTimeout(t);
    }, [isOpen]);

    if (!isOpen) return null;

    const close = () => updateUIState({ grewGptOpen: false });

    const openHistory = async () => {
        setView('history');
        setSelectedHistory(null);
        if (!user?.email) return;
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('grewgpt_conversations')
                .select('id, user_prompt, ai_response, created_at')
                .eq('user_email', user.email)
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) { setHistoryItems([]); }
            else { setHistoryItems(data || []); }
        } catch { setHistoryItems([]); }
        finally { setHistoryLoading(false); }
    };

    const handleHeaderNav = () => {
        if (view === 'chat') { openHistory(); return; }
        if (selectedHistory) { setSelectedHistory(null); return; }
        setView('chat');
    };

    const formatHistoryDate = (s: string) => {
        try {
            const d = new Date(s);
            const mins = Math.floor((Date.now() - d.getTime()) / 60000);
            if (mins < 1) return 'Just now';
            if (mins < 60) return `${mins}m ago`;
            if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
            if (mins < 10080) return `${Math.floor(mins / 1440)}d ago`;
            return d.toLocaleDateString();
        } catch { return ''; }
    };

    const saveConversation = async (userPrompt: string, aiResponse: string, model: string, provider: string) => {
        if (!user?.email) return;
        try {
            await supabase.from('grewgpt_conversations').insert([{
                user_email: user.email,
                user_prompt: userPrompt,
                ai_response: aiResponse,
                ai_model: model,
                ai_provider: provider,
                conversation_session_id: sessionId,
                created_at: new Date().toISOString(),
            }]);
        } catch (err: any) {
            console.warn('[GrewGPT] Error saving conversation:', err?.message);
        }
    };

    const buildContext = () => {
        try {
            return {
                active_module: activeApp || 'REVENUE',
                user_email: user?.email || 'unknown',
                active_filters: {
                    segments: filters?.segment || [],
                    metric: filters?.metric || 'revenue',
                    date_range: { start: filters?.startDate || null, end: filters?.endDate || null },
                    sales_heads: filters?.salesHead || [],
                    customers: filters?.customer || [],
                    skus: filters?.selectedSku || [],
                    pending_only: filters?.pendingOnly || false,
                    velocity_mode: filters?.velocityMode || false,
                },
                data_summary: {
                    total_rows_in_memory: data?.length || 0,
                    ...(stats?.kpi ? {
                        mtd: stats.kpi.mtd || 0,
                        ytd: stats.kpi.ytd || 0,
                        mtd_qty: stats.kpi.mtd_qty || 0,
                        ytd_qty: stats.kpi.ytd_qty || 0,
                        mtd_mw: stats.kpi.mtd_mw || 0,
                        ytd_mw: stats.kpi.ytd_mw || 0,
                        mom_growth: stats.kpi.mom || 0,
                        yoy_growth: stats.kpi.yoy || 0,
                        pacing: stats.kpi.pacing || 0,
                        hhi: stats.kpi.hhi || 0,
                        anchor_date: stats.kpiAnchorDate || null,
                        last_7_days: stats.last7DaysSales || 0,
                    } : {}),
                },
            };
        } catch {
            return { active_module: 'REVENUE', user_email: 'unknown', active_filters: {}, data_summary: { total_rows_in_memory: 0 } };
        }
    };

    const send = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isLoading) return;

        setInput('');
        setIsLoading(true);

        setMessages(prev => [
            ...prev,
            { role: 'user', text: trimmed },
            { role: 'assistant', text: '', loading: true },
        ]);

        try {
            const history = messagesRef.current
                .slice(1)
                .filter(m => !m.loading && !m.error && m.text.trim())
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.text }));
            history.push({ role: 'user', content: trimmed });

            const { data: fnData, error } = await supabase.functions.invoke('grewGpt', {
                body: { messages: history, dashboard_context: buildContext(), environment: 'production' },
            });

            if (error) {
                let detail = error.message || 'Failed to call GrewGPT edge function';
                try {
                    const ctx = (error as any)?.context;
                    if (ctx && typeof ctx.json === 'function') {
                        const body = await ctx.json();
                        if (body?.error) detail = body.error;
                    }
                } catch { /* keep */ }
                throw new Error(detail);
            }

            const reply: string = fnData?.reply || fnData?.error || 'No response received.';
            const isErr = !!fnData?.error;

            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', text: reply, error: isErr };
                return updated;
            });

            if (!isErr) {
                await saveConversation(trimmed, reply, fnData?.model || 'unknown', fnData?.provider || 'unknown');
            }
        } catch (err: any) {
            const errMsg = err.message || 'Failed to reach GrewGPT';
            setConfigError(errMsg);
            setMessages(prev => {
                const updated = [...prev];
                const errorText = errMsg.includes('secret') || errMsg.includes('key')
                    ? `⚠️ Configuration Error: ${errMsg}\n\nPlease verify:\n1. Supabase secret "AI" is set with your OpenRouter key\n2. The edge function has permission to access it`
                    : `❌ ${errMsg}\n\nTry refreshing the page or check your internet connection.`;
                updated[updated.length - 1] = { role: 'assistant', text: errorText, error: true };
                return updated;
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); send(input); };
    const showStarters = messages.length <= 1 && !isLoading;

    return (
        <>
            <div className="fixed inset-0 bg-black/20 z-[99985]" onClick={close} />

            <div className="fixed right-0 top-0 bottom-0 w-[380px] bg-canvas border-l border-hairline z-[99990] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">

                {/* Header */}
                <div className="px-4 py-3 border-b border-hairline bg-gradient-to-r from-amber-50 to-canvas flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-amber-600 rounded-lg shadow-sm">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-[11px] font-black text-ink uppercase tracking-tight">GrewGPT</p>
                            <p className="text-[9px] text-amber-600 font-medium">
                                {view === 'history' ? 'Chat history' : 'Grew Energy AI'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleHeaderNav}
                            title={view === 'chat' ? 'Chat history' : 'Back'}
                            className="p-1.5 rounded-lg text-ink-mute hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                            {view === 'chat'
                                ? <History className="w-4 h-4" />
                                : <ArrowLeft className="w-4 h-4" />}
                        </button>
                        <button onClick={close} className="p-1.5 rounded-lg text-ink-mute hover:text-ink hover:bg-canvas-soft transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* History view */}
                {view === 'history' && (
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
                        {selectedHistory ? (
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[9px] font-bold text-ink-mute uppercase tracking-widest mb-1">Question</p>
                                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                                        <p className="text-[11px] text-ink leading-relaxed">{selectedHistory.user_prompt}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-ink-mute uppercase tracking-widest mb-1">GrewGPT</p>
                                    <div className="p-2.5 bg-canvas-soft border border-hairline rounded-xl">
                                        {renderMarkdown(selectedHistory.ai_response)}
                                    </div>
                                </div>
                                <p className="text-[8px] text-ink-faint text-right">{new Date(selectedHistory.created_at).toLocaleString()}</p>
                            </div>
                        ) : historyLoading ? (
                            <div className="flex items-center justify-center h-32 text-ink-mute gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-[10px]">Loading history…</span>
                            </div>
                        ) : historyItems.length === 0 ? (
                            <div className="flex items-center justify-center h-32 text-ink-mute">
                                <span className="text-[10px]">No past conversations yet</span>
                            </div>
                        ) : (
                            historyItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedHistory(item)}
                                    className="w-full text-left p-2.5 rounded-xl bg-canvas-soft border border-hairline hover:border-amber-300 hover:bg-amber-50/50 transition-colors"
                                >
                                    <p className="text-[10px] font-medium text-ink line-clamp-2">{item.user_prompt}</p>
                                    <p className="text-[8px] text-ink-faint mt-1">{formatHistoryDate(item.created_at)}</p>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* Chat view */}
                {view === 'chat' && (
                    <>
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                            {messages.map((m, idx) => (
                                <div key={idx} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    {/* Avatar */}
                                    <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
                                        m.role === 'assistant'
                                            ? m.error ? 'bg-rose-500' : 'bg-amber-600'
                                            : 'bg-canvas-deep'
                                    }`}>
                                        {m.role === 'assistant'
                                            ? m.loading
                                                ? <Loader2 className="w-3 h-3 text-white animate-spin" />
                                                : m.error
                                                    ? <AlertCircle className="w-3 h-3 text-white" />
                                                    : <Sparkles className="w-3 h-3 text-white" />
                                            : <User className="w-3 h-3 text-ink-secondary" />
                                        }
                                    </div>

                                    {/* Bubble */}
                                    <div className={`max-w-[82%] px-3 py-2.5 rounded-2xl ${
                                        m.role === 'assistant'
                                            ? m.error
                                                ? 'bg-rose-50 border border-rose-200 rounded-tl-sm'
                                                : 'bg-canvas-soft border border-hairline rounded-tl-sm'
                                            : 'bg-ink rounded-tr-sm'
                                    }`}>
                                        {m.loading ? (
                                            <div className="flex items-center gap-2 py-0.5">
                                                <span className="text-[10px] text-ink-mute font-medium">Thinking</span>
                                                <div className="flex gap-1">
                                                    {[0, 1, 2].map(d => (
                                                        <div key={d} className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
                                                    ))}
                                                </div>
                                            </div>
                                        ) : m.role === 'user' ? (
                                            <p className="text-[11px] leading-relaxed text-white">{m.text}</p>
                                        ) : (
                                            renderMarkdown(m.text)
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={bottomRef} />
                        </div>

                        {/* Starter prompts */}
                        {showStarters && (
                            <div className="px-4 pb-3 flex flex-col gap-1.5 shrink-0">
                                <p className="text-[9px] font-bold text-ink-faint uppercase tracking-widest mb-0.5">Try asking</p>
                                {STARTERS.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => send(s)}
                                        className="text-left text-[10px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-100 rounded-xl px-3 py-2 transition-colors font-medium"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Input */}
                        <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-hairline flex gap-2 shrink-0 bg-canvas">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                disabled={isLoading}
                                placeholder="Ask about your revenue data…"
                                className="flex-1 bg-canvas-soft border border-hairline rounded-xl px-3 py-2 text-[11px] text-ink placeholder:text-ink-faint outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300 transition-all disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="p-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                            >
                                {isLoading
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Send className="w-4 h-4" />
                                }
                            </button>
                        </form>
                    </>
                )}
            </div>
        </>
    );
};
