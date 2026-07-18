import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Sparkles, Send, User, Loader2, AlertCircle,
    ArrowLeft, CheckCircle2, Database,
} from 'lucide-react';
import { useStore } from '@revenue/store/useStore';
import { useAuthStore } from '@grew/auth';
import { supabase } from '@revenue/services/supabaseClient';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Message {
    role: 'user' | 'assistant' | 'system';
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

// ─── Markdown → JSX (full table + inline support) ───────────────────────────

function renderMarkdown(text: string): React.ReactNode {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    const isTableRow = (l: string) => l.trim().startsWith('|') && l.trim().endsWith('|');
    const isSepRow   = (l: string) => /^\|[\s\-:|]+\|$/.test(l.trim());

    const inlineStyle = (s: string): React.ReactNode => {
        const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
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
                <div key={key++} className="overflow-x-auto my-3 rounded-lg border border-hairline">
                    <table className="w-full text-[11px] border-collapse">
                        <thead>
                            <tr className="bg-canvas-deep">
                                {headers.map((h, hi) => (
                                    <th key={hi} className="px-3 py-2 text-left font-bold text-ink border-b border-hairline whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, ri) => (
                                <tr key={ri} className={ri % 2 === 0 ? 'bg-canvas' : 'bg-canvas-soft/50'}>
                                    {row.map((cell, ci) => (
                                        <td key={ci} className="px-3 py-1.5 text-ink-secondary border-b border-hairline whitespace-nowrap font-mono text-[10.5px]">
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
        if (!line.trim()) { nodes.push(<div key={key++} className="h-2" />); i++; continue; }
        if (line.startsWith('### ')) { nodes.push(<p key={key++} className="text-[10px] font-black text-ink-mute uppercase tracking-widest mt-3 mb-1">{line.slice(4)}</p>); i++; continue; }
        if (line.startsWith('## '))  { nodes.push(<p key={key++} className="text-[12px] font-black text-ink mt-4 mb-1">{line.slice(3)}</p>); i++; continue; }
        if (line.startsWith('# '))   { nodes.push(<p key={key++} className="text-[13px] font-black text-ink mt-4 mb-1">{line.slice(2)}</p>); i++; continue; }
        if (line.startsWith('- ') || line.startsWith('* ')) {
            nodes.push(<div key={key++} className="flex gap-2 items-start text-ink-secondary"><span className="text-amber-600 shrink-0">•</span><span>{inlineStyle(line.slice(2))}</span></div>);
            i++; continue;
        }
        nodes.push(<p key={key++} className="text-ink-secondary leading-relaxed">{inlineStyle(line)}</p>);
        i++;
    }

    return <div className="space-y-0.5 text-[11px]">{nodes}</div>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STARTERS = [
    'What is total YTD revenue by segment?',
    'Show top 10 customers by revenue this financial year',
    'Which sales head has the highest revenue this month?',
    'Compare MTD revenue vs last month for each segment',
    'Show revenue trend for last 6 months',
];

function relativeTime(s: string) {
    try {
        const mins = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
        return `${Math.floor(mins / 1440)}d ago`;
    } catch { return ''; }
}

// ─── Component ───────────────────────────────────────────────────────────────

export const GrewGPTPage: React.FC = () => {
    const { stats, filters, data, activeApp, setActiveMainView } = useStore();
    const { user } = useAuthStore();

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId] = useState(() => `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    const [messages, setMessages] = useState<Message[]>([{
        role: 'assistant',
        text: "Hello! I'm **GrewGPT** — Grew Energy's AI financial analyst.\n\nI can answer questions about revenue, customers, segments, and financial performance. All amounts are in **Rs Crores**. Ask me anything.",
    }]);
    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const [history, setHistory] = useState<ConversationRow[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState<ConversationRow | null>(null);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef  = useRef<HTMLInputElement>(null);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

    useEffect(() => {
        if (!user?.email) return;
        loadHistory();
    }, [user?.email]);

    const loadHistory = async () => {
        if (!user?.email) return;
        setHistoryLoading(true);
        try {
            const { data: rows } = await supabase
                .from('grewgpt_conversations')
                .select('id, user_prompt, ai_response, created_at')
                .eq('user_email', user.email)
                .order('created_at', { ascending: false })
                .limit(50);
            setHistory(rows || []);
        } catch { setHistory([]); }
        finally { setHistoryLoading(false); }
    };

    const buildContext = () => ({
        active_module: activeApp || 'REVENUE',
        user_email: user?.email || 'unknown',
        active_filters: {
            segments: filters?.segment || [],
            metric: filters?.metric || 'Amount',
            date_range: { start: filters?.startDate || null, end: filters?.endDate || null },
            sales_heads: filters?.salesHead || [],
            customers: filters?.customer || [],
            skus: filters?.selectedSku || [],
        },
        data_summary: {
            total_rows_in_memory: data?.length || 0,
            ...(stats?.kpi ? {
                mtd: stats.kpi.mtd || 0,
                ytd: stats.kpi.ytd || 0,
                mom_growth: stats.kpi.mom || 0,
                yoy_growth: stats.kpi.yoy || 0,
                pacing: stats.kpi.pacing || 0,
                anchor_date: stats.kpiAnchorDate || null,
            } : {}),
        },
    });

    const send = useCallback(async (text: string) => {
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
                .filter(m => !m.loading && !m.error && m.role !== 'system' && m.text.trim())
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.text }));
            history.push({ role: 'user', content: trimmed });

            const { data: fnData, error } = await supabase.functions.invoke('grewGpt', {
                body: {
                    messages: history,
                    dashboard_context: buildContext(),
                    user_email: user?.email,
                    session_id: sessionId,
                },
            });

            if (error) {
                let detail = error.message || 'Edge function error';
                try {
                    const ctx = (error as any)?.context;
                    if (ctx && typeof ctx.json === 'function') {
                        const body = await ctx.json();
                        if (body?.error) detail = body.error;
                    }
                } catch { /* keep */ }
                throw new Error(detail);
            }

            const reply: string = fnData?.reply || 'No response received.';
            const isErr = !!fnData?.error;

            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', text: reply, error: isErr };
                return updated;
            });

            if (!isErr) {
                await supabase.from('grewgpt_conversations').insert([{
                    user_email: user?.email,
                    user_prompt: trimmed,
                    ai_response: reply,
                    ai_model: fnData?.model || 'unknown',
                    ai_provider: fnData?.provider || 'unknown',
                    conversation_session_id: sessionId,
                    created_at: new Date().toISOString(),
                }]);
                await loadHistory();
            }
        } catch (err: any) {
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: 'assistant',
                    text: `❌ ${err.message || 'Failed to reach GrewGPT.'}`,
                    error: true,
                };
                return updated;
            });
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, user, filters, stats, data, activeApp]);

    const showStarters = messages.length <= 1 && !isLoading;

    return (
        <div className="flex h-full w-full bg-canvas text-ink font-sans overflow-hidden">

            {/* ── History Sidebar ────────────────────────────────────────── */}
            <aside className="w-[240px] flex-shrink-0 flex flex-col border-r border-hairline bg-canvas-soft">

                <div className="px-4 py-3 border-b border-hairline shrink-0">
                    <p className="text-[9px] font-black text-ink-mute uppercase tracking-widest">Chat History</p>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {selectedHistory ? (
                        <div className="space-y-3">
                            <button
                                onClick={() => setSelectedHistory(null)}
                                className="flex items-center gap-1.5 text-[10px] text-ink-mute hover:text-ink transition-colors"
                            >
                                <ArrowLeft className="w-3 h-3" /> Back
                            </button>
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-1">Question</p>
                                <p className="text-[11px] text-ink">{selectedHistory.user_prompt}</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-canvas border border-hairline">
                                <p className="text-[9px] font-bold text-ink-mute uppercase tracking-widest mb-1">GrewGPT</p>
                                {renderMarkdown(selectedHistory.ai_response)}
                            </div>
                            <p className="text-[8px] text-ink-faint text-right">{new Date(selectedHistory.created_at).toLocaleString('en-IN')}</p>
                        </div>
                    ) : historyLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-ink-mute" /></div>
                    ) : history.length === 0 ? (
                        <p className="text-center text-[10px] text-ink-mute py-8">No conversations yet</p>
                    ) : (
                        history.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setSelectedHistory(item)}
                                className="w-full text-left p-2.5 rounded-lg bg-canvas/70 border border-hairline hover:border-amber-300 hover:bg-amber-50/30 transition-colors"
                            >
                                <p className="text-[10.5px] text-ink-secondary line-clamp-2 leading-snug">{item.user_prompt}</p>
                                <p className="text-[8px] text-ink-faint mt-1">{relativeTime(item.created_at)}</p>
                            </button>
                        ))
                    )}
                </div>
            </aside>

            {/* ── Main Chat Area ─────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Header */}
                <header className="flex items-center justify-between px-5 py-3 border-b border-hairline bg-canvas-soft/80 backdrop-blur shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-amber-600 rounded-lg">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-[13px] font-black text-ink tracking-tight">GrewGPT</h1>
                            <p className="text-[9px] text-ink-mute font-mono">Grew Energy AI · Revenue Analytics</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[9px] text-green-600 font-mono">
                            <Database className="w-3 h-3" />
                            <span>Revenue DB Connected</span>
                        </div>
                        <button
                            onClick={() => setActiveMainView('DASHBOARD')}
                            className="text-[10px] text-ink-mute hover:text-ink font-semibold transition-colors px-3 py-1.5 rounded-lg border border-hairline hover:border-hairline-strong"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {messages.map((m, idx) => (
                        <div key={idx} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            {m.role !== 'system' && (
                                <div className={`w-7 h-7 rounded-xl shrink-0 flex items-center justify-center mt-0.5 ${
                                    m.role === 'assistant'
                                        ? m.error ? 'bg-rose-500' : 'bg-amber-600'
                                        : 'bg-canvas-deep'
                                }`}>
                                    {m.role === 'assistant'
                                        ? m.loading
                                            ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                                            : m.error
                                                ? <AlertCircle className="w-3.5 h-3.5 text-white" />
                                                : <Sparkles className="w-3.5 h-3.5 text-white" />
                                        : <User className="w-3.5 h-3.5 text-ink-secondary" />
                                    }
                                </div>
                            )}

                            {m.role === 'system' ? (
                                <div className="flex items-center gap-2 text-[10px] text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mx-auto">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    {renderMarkdown(m.text)}
                                </div>
                            ) : (
                                <div className={`max-w-[78%] px-4 py-3 rounded-2xl ${
                                    m.role === 'user'
                                        ? 'bg-ink rounded-tr-sm'
                                        : m.error
                                            ? 'bg-rose-50 border border-rose-200 rounded-tl-sm'
                                            : 'bg-canvas-soft border border-hairline rounded-tl-sm'
                                }`}>
                                    {m.loading ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-ink-mute">Querying revenue data…</span>
                                            <div className="flex gap-1">
                                                {[0, 1, 2].map(d => (
                                                    <div key={d} className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
                                                ))}
                                            </div>
                                        </div>
                                    ) : m.role === 'user' ? (
                                        <p className="text-[11.5px] text-white leading-relaxed">{m.text}</p>
                                    ) : (
                                        renderMarkdown(m.text)
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {showStarters && (
                        <div className="grid grid-cols-1 gap-2 max-w-xl">
                            <p className="text-[9px] font-bold text-ink-mute uppercase tracking-widest">Suggested questions</p>
                            {STARTERS.map(s => (
                                <button
                                    key={s}
                                    onClick={() => send(s)}
                                    className="text-left text-[11px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 rounded-xl px-4 py-2.5 transition-all font-medium"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="shrink-0 border-t border-hairline bg-canvas-soft/60 px-5 py-4">
                    <form
                        onSubmit={e => { e.preventDefault(); send(input); }}
                        className="flex gap-2 items-end"
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            disabled={isLoading}
                            placeholder="Ask about revenue, segments, customers…"
                            className="flex-1 rounded-xl px-4 py-3 text-[11.5px] outline-none transition-all bg-canvas border border-hairline text-ink placeholder:text-ink-faint focus:border-amber-400 focus:ring-1 focus:ring-amber-300 disabled:opacity-50"
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="p-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </form>
                    <p className="mt-2 text-[9px] text-ink-faint text-center">
                        GrewGPT answers only revenue and financial performance questions · All amounts in Rs Crores
                    </p>
                </div>
            </div>
        </div>
    );
};
