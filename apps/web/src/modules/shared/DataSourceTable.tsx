import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { useStore } from '@revenue/store/useStore';
import { Download, FilterX, Table as TableIcon } from 'lucide-react';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

export const DataSourceTable: React.FC = () => {
    const { data, privacyMode } = useStore();

    const columnDefs = useMemo(() => [
        { field: 'Invoice date', headerName: 'Date', filter: 'agDateColumnFilter', sort: 'desc', flex: 1 },
        { field: 'Invoice No', filter: 'agTextColumnFilter', flex: 1 },
        { field: 'Cust_name', headerName: 'Customer', filter: 'agTextColumnFilter', flex: 2 },
        { field: 'Segment', filter: 'agSetColumnFilter', flex: 1 },
        { field: 'Mat Desc', headerName: 'Material', filter: 'agTextColumnFilter', flex: 2 },
        { 
            field: 'Taxable Value', 
            headerName: 'Amount (₹)', 
            filter: 'agNumberColumnFilter',
            flex: 1,
            valueFormatter: (params: any) => {
                if (privacyMode) return '••••';
                return params.value?.toLocaleString('en-IN', { maximumFractionDigits: 0 });
            }
        },
        { field: 'SalesQty', headerName: 'Qty', filter: 'agNumberColumnFilter', flex: 1 },
        { field: 'MW', filter: 'agNumberColumnFilter', flex: 1 },
        { field: 'Plant', filter: 'agTextColumnFilter', flex: 1 },
        { field: 'Invoice Status', filter: 'agSetColumnFilter', flex: 1 },
    ], [privacyMode]);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        floatingFilter: true,
    }), []);

    const onExportClick = () => {
        // Simple CSV export could be added here if needed
        alert('CSV Export feature would be triggered here.');
    };

    return (
        <div className="flex-1 flex flex-col bg-white overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-emerald-600 rounded-lg shadow-md">
                        <TableIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-slate-900 tracking-tight uppercase">Master Revenue Ledger</h1>
                        <p className="text-[10px] text-slate-500 font-medium tracking-wide">Exhaustive transaction-level data with Excel-parity controls</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => alert('Filters Reset')}
                        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:text-slate-900 transition-colors uppercase tracking-widest"
                    >
                        <FilterX className="w-3.5 h-3.5" />
                        Clear Filters
                    </button>
                    <button 
                        onClick={onExportClick}
                        className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 text-white rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export to CSV
                    </button>
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 ag-theme-alpine w-full">
                <AgGridReact
                    rowData={data}
                    columnDefs={columnDefs as any}
                    defaultColDef={defaultColDef}
                    animateRows={true}
                    pagination={true}
                    paginationPageSize={100}
                    suppressMenuHide={true}
                    headerHeight={48}
                    floatingFiltersHeight={40}
                    rowHeight={40}
                />
            </div>
        </div>
    );
};
