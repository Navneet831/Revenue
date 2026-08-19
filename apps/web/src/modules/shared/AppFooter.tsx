import React from 'react';
import { useStore } from '@revenue/store/useStore';
import { AnalyticsApi } from '@revenue/services/analyticsService';

/**
 * FOOTER COMPONENT
 * Matches HTML app's footer with:
 * - Last updated date from latestDate
 */
export const AppFooter: React.FC = () => {
    const { latestDate } = useStore();
    const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
    const [history, setHistory] = React.useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);

    const formattedDateWithTime = latestDate
        ? (() => {
              const day = String(latestDate.getDate()).padStart(2, '0');
              const month = String(latestDate.getMonth() + 1).padStart(2, '0');
              const year = latestDate.getFullYear();
              const hours = String(latestDate.getHours()).padStart(2, '0');
              const minutes = String(latestDate.getMinutes()).padStart(2, '0');
              const seconds = String(latestDate.getSeconds()).padStart(2, '0');
              return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
          })()
        : '—';

    const handleOpenHistory = async () => {
        setIsHistoryOpen(true);
        setIsLoadingHistory(true);
        try {
            const data = await AnalyticsApi.history();
            setHistory(data);
        } catch (err) {
            console.error('Failed to load DB load history:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    return (
        <div className="shrink-0 h-8 border-t border-hairline bg-card-bg flex items-center justify-between px-6 text-[9px] font-black text-ink-mute uppercase tracking-widest select-none z-[110]">
            <div className="flex items-center gap-6">
                <button 
                    onClick={handleOpenHistory}
                    className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                    title="Click to view database load history logs"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <span className="hover:underline">Last updated on: <span className="text-ink font-mono">{formattedDateWithTime}</span></span>
                </button>
            </div>

            <div className="flex items-center gap-6">
                <span className="text-ink-mute font-bold tracking-tighter uppercase">© Grew Energy Private Limited</span>
            </div>

            {isHistoryOpen && (
                <div 
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    onClick={() => setIsHistoryOpen(false)}
                >
                    <div 
                        className="w-full max-w-xs bg-card-bg/95 backdrop-blur-md border border-hairline rounded-2xl p-4 shadow-2xl animate-in zoom-in-95 duration-200 text-ink"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center pb-2 border-b border-hairline">
                            <span className="text-[9px] font-black uppercase tracking-widest text-ink-mute flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                DB Load History
                            </span>
                            <button 
                                onClick={() => setIsHistoryOpen(false)}
                                className="text-[10px] font-bold text-ink-mute hover:text-ink transition-colors uppercase tracking-wider"
                            >
                                Close
                            </button>
                        </div>
                        
                        <div className="mt-3 max-h-48 overflow-y-auto no-scrollbar space-y-2">
                            {isLoadingHistory ? (
                                <div className="flex items-center justify-center py-6 text-ink-mute gap-2">
                                    <div className="w-3.5 h-3.5 border-2 border-success/20 border-t-success rounded-full animate-spin" />
                                    <span className="text-[8px] font-bold uppercase tracking-widest">Loading log...</span>
                                </div>
                            ) : history.length === 0 ? (
                                <p className="text-center py-6 text-[8px] text-ink-mute uppercase font-black tracking-widest">No update records found</p>
                            ) : (
                                history.map((h: any) => {
                                    const dateObj = new Date(h.loaded_at);
                                    const day = String(dateObj.getDate()).padStart(2, '0');
                                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                    const year = dateObj.getFullYear();
                                    const hours = String(dateObj.getHours()).padStart(2, '0');
                                    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                                    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
                                    const formattedLoadDate = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
                                    
                                    return (
                                        <div key={h.id} className="p-2 bg-canvas-soft/50 border border-hairline rounded-xl flex flex-col gap-0.5 hover:border-ink-mute/30 transition-colors">
                                            <div className="flex justify-between items-center text-[7.5px] font-black uppercase text-ink-mute tracking-wider">
                                                <span>Table: {h.table_name}</span>
                                                <span className="text-success bg-success-bg px-1 py-0.5 rounded text-[7px]">{h.status}</span>
                                            </div>
                                            <div className="text-[9px] font-mono text-ink font-bold mt-0.5">
                                                {formattedLoadDate}
                                            </div>
                                            {h.rows_count && (
                                                <div className="text-[7.5px] font-black text-ink-mute uppercase tracking-widest">
                                                    Rows: <span className="text-ink font-mono">{h.rows_count.toLocaleString('en-IN')}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
