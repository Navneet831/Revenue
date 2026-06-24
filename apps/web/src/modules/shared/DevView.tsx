import React, { useEffect, useState, useCallback } from 'react';
import {
    Terminal, Database, RefreshCw, CheckCircle2, XCircle,
    Server, User, Hash, Layers, GitBranch, GitCommit, Clock,
    ArrowRight, Code2, Filter, BarChart3, Info, Cpu, Settings,
} from 'lucide-react';
import { useStore } from '@revenue/store/useStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbConnection {
    host: string;
    port: number;
    user: string;
    database: string;
    ssl: boolean;
}

interface DataStats {
    totalRecords: number | null;
    minDate: string | null;
    maxDate: string | null;
    cacheStatus: 'warm' | 'cold' | 'error';
    fetchMode: 'direct_pg' | 'edge_function';
}

interface DataLogic {
    table: string;
    dateColumn: string;
    minDateFilter: string;
    sqlQuery: string;
    currencyDivider: string;
    fiscalYearStart: string;
    weekDefinition: string;
    columnMapping: Record<string, string>;
}

interface GitCommitEntry {
    hash: string;
    message: string;
    date: string;
    author: string;
}

interface GitInfo {
    branch: string | null;
    commits: GitCommitEntry[];
    error: string | null;
}

interface DbConfigResponse {
    connection: DbConnection | null;
    source: 'local_env' | 'edge_function' | null;
    connectionError: string | null;
    dataStats: DataStats | null;
    dataLogic: DataLogic | null;
    gitInfo: GitInfo | null;
}

// ─── Main View ────────────────────────────────────────────────────────────────

export const DevView: React.FC = () => {
    const { filters, features } = useStore();
    const [config, setConfig] = useState<DbConfigResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastFetched, setLastFetched] = useState<Date | null>(null);

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/v1/revenue/db-config');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setConfig(await res.json());
            setLastFetched(new Date());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const conn = config?.connection;
    const stats = config?.dataStats;
    const logic = config?.dataLogic;
    const git = config?.gitInfo;

    return (
        <div className="flex-1 flex flex-col bg-[#05070A] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        <Terminal className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold text-white">Dev Console</h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            DB · Git · Data Logic · Schema · Algorithms · Filters
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {lastFetched && (
                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {lastFetched.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={fetchConfig}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-40"
                    >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                {error && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
                        <XCircle className="w-4 h-4 shrink-0" />
                        Failed to load dev config: {error}
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-7xl mx-auto">

                    {/* ── DB Connection ── */}
                    <DarkCard
                        title="DB Connection"
                        icon={<Database className="w-4 h-4 text-emerald-400" />}
                        badge={conn
                            ? <StatusBadge ok label={config?.source === 'local_env' ? 'from .env' : 'from edge fn'} />
                            : <StatusBadge label="not configured" />}
                    >
                        {conn ? (
                            <>
                                <DbRow icon={<Server className="w-3.5 h-3.5 text-sky-400" />} label="PG_HOST" value={conn.host} />
                                <DbRow icon={<Hash className="w-3.5 h-3.5 text-violet-400" />} label="PG_PORT" value={String(conn.port)} />
                                <DbRow icon={<User className="w-3.5 h-3.5 text-amber-400" />} label="PG_USER" value={conn.user} />
                                <DbRow icon={<Layers className="w-3.5 h-3.5 text-emerald-400" />} label="PG_DATABASE" value={conn.database} />
                                <DbRow icon={<Info className="w-3.5 h-3.5 text-slate-400" />} label="SSL" value={conn.ssl ? 'enabled' : 'disabled'} />
                                <DbRow
                                    icon={<GitBranch className="w-3.5 h-3.5 text-teal-400" />}
                                    label="SOURCE"
                                    value={config?.source === 'local_env' ? 'local .env file' : 'Supabase edge function'}
                                    highlight
                                />
                            </>
                        ) : (
                            <p className="py-4 text-[10px] text-slate-600 font-mono">{config?.connectionError || 'No connection details available'}</p>
                        )}
                    </DarkCard>

                    {/* ── Git Info ── */}
                    <DarkCard
                        title="Git"
                        icon={<GitBranch className="w-4 h-4 text-violet-400" />}
                        badge={git?.branch
                            ? <StatusBadge ok label={git.branch} />
                            : <StatusBadge label={git?.error || 'unavailable'} />}
                    >
                        {git?.commits?.length ? (
                            <div className="py-1">
                                {git.commits.map((c, i) => (
                                    <div key={i} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
                                        <GitCommit className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2.5 mb-1">
                                                <span className="text-[10px] font-mono text-violet-300 font-semibold">{c.hash}</span>
                                                <span className="text-[10px] text-slate-500 font-mono">{c.date.slice(0, 10)}</span>
                                                <span className="text-[10px] text-slate-500">{c.author}</span>
                                            </div>
                                            <p className="text-xs text-slate-300 truncate" title={c.message}>{c.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="py-4 text-xs text-slate-500">{git?.error || 'No commits found'}</p>
                        )}
                    </DarkCard>

                    {/* ── Live Data Stats ── */}
                    <DarkCard title="Live Data Stats" icon={<BarChart3 className="w-4 h-4 text-violet-400" />}>
                        <DbRow
                            icon={<Layers className="w-3.5 h-3.5 text-emerald-400" />}
                            label="TOTAL RECORDS"
                            value={stats?.totalRecords != null ? stats.totalRecords.toLocaleString('en-IN') : '—'}
                            highlight={stats?.totalRecords != null}
                        />
                        <DbRow icon={<Clock className="w-3.5 h-3.5 text-sky-400" />} label="MIN DATE" value={stats?.minDate || '—'} />
                        <DbRow icon={<Clock className="w-3.5 h-3.5 text-amber-400" />} label="MAX DATE" value={stats?.maxDate || '—'} />
                        <DbRow
                            icon={<Server className="w-3.5 h-3.5 text-teal-400" />}
                            label="FETCH MODE"
                            value={stats?.fetchMode === 'direct_pg' ? 'Direct PostgreSQL' : 'Supabase Edge Fn'}
                            highlight
                        />
                        <DbRow
                            icon={<CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />}
                            label="ROW CACHE"
                            value={stats?.cacheStatus === 'warm' ? 'warm (in-memory)' : stats?.cacheStatus === 'cold' ? 'cold (not loaded)' : 'error'}
                        />
                    </DarkCard>

                    {/* ── Active Filters ── */}
                    <DarkCard title="Active Filters" icon={<Filter className="w-4 h-4 text-amber-400" />}>
                        <DbRow label="SEGMENT" value={filters.segment.length > 0 ? filters.segment.join(', ') : 'All segments'} />
                        <DbRow label="DATE RANGE" value={filters.startDate && filters.endDate ? `${filters.startDate} → ${filters.endDate}` : '—'} />
                        <DbRow label="METRIC" value={filters.metric} highlight />
                        <DbRow label="VELOCITY MODE" value={filters.velocityMode} />
                        <DbRow label="PENDING ONLY" value={filters.pendingOnly ? 'Yes' : 'No'} />
                        <DbRow label="SALES HEAD" value={filters.salesHead.length > 0 ? filters.salesHead.join(', ') : 'All'} />
                        <DbRow label="CUSTOMER" value={filters.customer.length > 0 ? filters.customer.join(', ') : 'All'} />
                        <DbRow label="EXCLUDED SKUs" value={filters.excludedSeries.size > 0 ? Array.from(filters.excludedSeries).join(', ') : 'None'} />
                        <DbRow label="SELECTED SKUs" value={filters.selectedSku.length > 0 ? filters.selectedSku.join(', ') : 'All'} />
                    </DarkCard>

                    {/* ── Data Logic ── */}
                    <DarkCard title="Data Logic" icon={<Code2 className="w-4 h-4 text-sky-400" />}>
                        <DbRow label="TABLE" value={logic?.table || '—'} />
                        <DbRow label="DATE COLUMN" value={logic?.dateColumn || '—'} />
                        <DbRow label="MIN DATE FILTER" value={logic?.minDateFilter || '—'} />
                        <DbRow label="CURRENCY DIVIDER" value={logic?.currencyDivider || '—'} />
                        <DbRow label="FISCAL YEAR START" value={logic?.fiscalYearStart || '—'} />
                        <DbRow label="WEEK DEFINITION" value={logic?.weekDefinition || '—'} />
                    </DarkCard>

                    {/* ── DB Schema ── */}
                    <DarkCard title="DB Schema" icon={<Database className="w-4 h-4 text-blue-400" />}>
                        <SchemaRow table="revenue" col="Invoice date" type="timestamp → cast ::date" />
                        <SchemaRow table="revenue" col="Taxable Value" type="numeric — Amount KPI" />
                        <SchemaRow table="revenue" col="SalesQty / UOM" type="numeric / text — qty" />
                        <SchemaRow table="revenue" col="MW" type="numeric — megawatt output" />
                        <SchemaRow table="revenue" col="Cust_code / Cust_name" type="text — customer" />
                        <SchemaRow table="revenue" col="Segment / Sales Head" type="text — hierarchy" />
                        <SchemaRow table="whitelist" col="email" type="text — primary key" />
                        <SchemaRow table="whitelist" col="agentation / commit_drill_down / audit / story" type="boolean — feature flags" />
                        <SchemaRow table="whitelist" col="Dev / GrewGpt / Ledger" type="boolean — feature flags" />
                    </DarkCard>

                    {/* ── Column Mapping ── */}
                    <div className="bg-[#0D1117] rounded-xl border border-white/10 overflow-hidden xl:col-span-2">
                        <CardHeader title="Column Mapping (DB → App)" icon={<ArrowRight className="w-4 h-4 text-teal-400" />} />
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {logic?.columnMapping
                                ? Object.entries(logic.columnMapping).map(([db, app]) => (
                                    <div key={db} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
                                        <span className="text-xs font-mono text-sky-400 shrink-0">{db}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                                        <span className="text-xs font-mono text-emerald-400 truncate">{app}</span>
                                    </div>
                                ))
                                : <span className="text-xs text-slate-500 font-mono">Loading…</span>
                            }
                        </div>
                    </div>

                    {/* ── Algorithm Notes ── */}
                    <div className="bg-[#0D1117] rounded-xl border border-white/10 overflow-hidden xl:col-span-2">
                        <CardHeader title="Algorithm Notes" icon={<Cpu className="w-4 h-4 text-amber-400" />} />
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <AlgoBlock accent="border-blue-500" title="Date Handling"
                                body={`"Invoice date" is a PG timestamp, cast to date: "Invoice date"::date\nFloor filter excludes on/before company DOI 2022-12-25.`} />
                            <AlgoBlock accent="border-emerald-500" title="PVM Waterfall"
                                body="Price-Volume-Mix decomposition computed server-side via the isomorphic DataLogic engine — no secondary DB round-trip." />
                            <AlgoBlock accent="border-amber-500" title="HHI Calculation"
                                body="HHI = Σ(customer share²) × 10,000. Computed after all active filters over the current period window." />
                            <AlgoBlock accent="border-purple-500" title="Pacing Algorithm"
                                body="Daily avg = MTD ÷ business days elapsed. Pacing = daily avg × total business days in month. Sundays excluded." />
                        </div>
                    </div>

                    {/* ── SQL Query ── */}
                    <div className="bg-[#0D1117] rounded-xl border border-white/10 overflow-hidden xl:col-span-2">
                        <CardHeader title="SQL Query (Data Fetch)" icon={<Code2 className="w-4 h-4 text-violet-400" />} />
                        <div className="p-4">
                            <pre className="text-xs font-mono text-emerald-300 bg-black/30 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed border border-white/5">
                                {logic?.sqlQuery || 'Loading…'}
                            </pre>
                        </div>
                    </div>

                    {/* ── Feature Flags ── */}
                    <div className="bg-[#0D1117] rounded-xl border border-white/10 overflow-hidden xl:col-span-2">
                        <CardHeader title="Feature Flags" icon={<Settings className="w-4 h-4 text-amber-400" />} />
                        <div className="p-4 flex flex-wrap gap-2">
                            {Object.entries(features).map(([flag, enabled]) => (
                                <div key={flag} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                                    enabled
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                        : 'bg-white/[0.03] border-white/10 text-slate-500'
                                }`}>
                                    {enabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                    {flag}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const CardHeader: React.FC<{ title: string; icon: React.ReactNode; children?: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
            {icon}
            <span className="text-xs font-semibold text-white tracking-wide">{title}</span>
        </div>
        {children}
    </div>
);

const StatusBadge: React.FC<{ label: string; ok?: boolean }> = ({ label, ok = false }) => (
    <div className="flex items-center gap-1.5">
        {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
        <span className={`text-xs font-medium font-mono ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>{label}</span>
    </div>
);

const DarkCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, icon, badge, children }) => (
    <div className="bg-[#0D1117] rounded-xl border border-white/10 overflow-hidden">
        <CardHeader title={title} icon={icon}>{badge}</CardHeader>
        <div className="px-4 py-1 divide-y divide-white/5">{children}</div>
    </div>
);

const DbRow: React.FC<{
    icon?: React.ReactNode;
    label: string;
    value: string;
    highlight?: boolean;
}> = ({ icon, label, value, highlight = false }) => (
    <div className="flex items-center justify-between gap-3 py-2.5">
        <div className="flex items-center gap-2 shrink-0">
            {icon}
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide font-mono">{label}</span>
        </div>
        <span className={`text-xs font-mono text-right truncate max-w-[60%] ${highlight ? 'text-white font-semibold' : 'text-slate-300'}`}>
            {value}
        </span>
    </div>
);

const SchemaRow: React.FC<{ table: string; col: string; type: string }> = ({ table, col, type }) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
        <span className="text-[10px] font-mono text-blue-400 font-medium shrink-0 w-28 mt-0.5">{table}</span>
        <span className="text-xs font-medium text-white shrink-0 w-28 font-mono">{col}</span>
        <span className="text-xs text-slate-400 font-mono">{type}</span>
    </div>
);

const AlgoBlock: React.FC<{ accent: string; title: string; body: string }> = ({ accent, title, body }) => (
    <div className="space-y-2">
        <h4 className={`text-xs font-semibold text-white border-l-2 ${accent} pl-2.5`}>{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line pl-2.5">{body}</p>
    </div>
);
