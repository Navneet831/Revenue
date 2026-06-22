import React, { useMemo, useState, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, GridReadyEvent } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { useStore } from '@revenue/store/useStore';
import { Download, FilterX, X } from 'lucide-react';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register AG Grid Community and Enterprise modules
ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

export const DataSourceTable: React.FC = () => {
    const { data, privacyMode, setActiveMainView } = useStore();
    const [gridApi, setGridApi] = useState<any>(null);
    const subtotalScrollRef = useRef<HTMLDivElement>(null);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

    const [subtotals, setSubtotals] = useState({
        val: 0,
        qty: 0,
        mw: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        netValue: 0,
        count: 0
    });

    const updateSubtotals = useCallback(() => {
        if (!gridApi) return;
        let totalVal = 0;
        let totalQty = 0;
        let totalMw = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;
        let totalNetValue = 0;
        let count = 0;
        
        gridApi.forEachNodeAfterFilter((node: any) => {
            if (node.data) {
                totalVal += node.data.val || 0;
                totalQty += node.data.qty || 0;
                totalMw += node.data.mw || 0;
                totalCgst += node.data.cgst || 0;
                totalSgst += node.data.sgst || 0;
                totalIgst += node.data.igst || 0;
                totalNetValue += node.data.netValue || 0;
                count++;
            }
        });
        
        setSubtotals({
            val: totalVal,
            qty: totalQty,
            mw: totalMw,
            cgst: totalCgst,
            sgst: totalSgst,
            igst: totalIgst,
            netValue: totalNetValue,
            count
        });
    }, [gridApi]);

    const updateColumnWidths = useCallback(() => {
        if (!gridApi) return;
        const widths: Record<string, number> = {};
        gridApi.getAllDisplayedColumns().forEach((col: any) => {
            widths[col.getColId()] = col.getActualWidth();
        });
        setColumnWidths(widths);
    }, [gridApi]);

    const onGridReady = useCallback((params: GridReadyEvent) => {
        setGridApi(params.api);
        
        // Calculate initial subtotals
        let totalVal = 0;
        let totalQty = 0;
        let totalMw = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;
        let totalNetValue = 0;
        let count = 0;
        
        params.api.forEachNodeAfterFilter((node: any) => {
            if (node.data) {
                totalVal += node.data.val || 0;
                totalQty += node.data.qty || 0;
                totalMw += node.data.mw || 0;
                totalCgst += node.data.cgst || 0;
                totalSgst += node.data.sgst || 0;
                totalIgst += node.data.igst || 0;
                totalNetValue += node.data.netValue || 0;
                count++;
            }
        });
        
        setSubtotals({
            val: totalVal,
            qty: totalQty,
            mw: totalMw,
            cgst: totalCgst,
            sgst: totalSgst,
            igst: totalIgst,
            netValue: totalNetValue,
            count
        });

        // Calculate initial column widths
        const widths: Record<string, number> = {};
        params.api.getAllDisplayedColumns().forEach((col: any) => {
            widths[col.getColId()] = col.getActualWidth();
        });
        setColumnWidths(widths);
    }, []);

    const onExportClick = useCallback(() => {
        if (!gridApi) return;
        const dateStr = new Date().toISOString().split('T')[0];
        gridApi.exportDataAsExcel({
            fileName: `GrewAnalytics_Revenue_Ledger_${dateStr}.xlsx`
        });
    }, [gridApi]);

    const onClearFilters = useCallback(() => {
        if (!gridApi) return;
        gridApi.setFilterModel(null);
    }, [gridApi]);

    const onBodyScroll = useCallback((params: any) => {
        if (subtotalScrollRef.current) {
            const scrollLeft = params.api.getHorizontalPixelRange().left;
            subtotalScrollRef.current.scrollLeft = scrollLeft;
        }
    }, []);

    const columnDefs = useMemo(() => [
        { 
            field: 'date', 
            headerName: 'Invoice date', 
            filter: 'agDateColumnFilter', 
            sort: 'desc', 
            width: 120,
            valueFormatter: (params: any) => {
                if (!params.value) return '';
                if (params.value instanceof Date) {
                    return params.value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                }
                const str = String(params.value).split(/[T ]/)[0];
                const parts = str.split('-');
                if (parts.length === 3) {
                    const y = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10);
                    const d = parseInt(parts[2], 10);
                    const dateObj = new Date(y, m - 1, d);
                    if (!isNaN(dateObj.getTime())) {
                        return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    }
                }
                const fallbackDate = new Date(params.value);
                return isNaN(fallbackDate.getTime()) ? params.value : fallbackDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
        },
        { field: 'invoiceNo', headerName: 'Invoice No', width: 130 },
        { field: 'invoiceType', headerName: 'Invoice Type', width: 130 },
        { field: 'revenueStatus', headerName: 'Revenue', width: 140 },
        { field: 'custCode', headerName: 'Cust_code', width: 120 },
        { field: 'customer', headerName: 'Cust_name', width: 220 },
        { field: 'salesHead', headerName: 'Sales Head', width: 140 },
        { field: 'segment', headerName: 'Segment', width: 120 },
        { field: 'wp', headerName: 'Module WP', width: 130 },
        { field: 'materialCode', headerName: 'Material Code', width: 130 },
        { field: 'matDesc', headerName: 'Mat Desc', width: 250 },
        { 
            field: 'val', 
            headerName: 'Taxable Value', 
            filter: 'agNumberColumnFilter',
            width: 150,
            cellClass: 'font-mono font-bold text-emerald-600',
            valueFormatter: (params: any) => {
                if (privacyMode) return '••••';
                return params.value ? `₹${params.value?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '';
            }
        },
        { 
            field: 'qty', 
            headerName: 'SalesQty', 
            filter: 'agNumberColumnFilter', 
            width: 110,
            valueFormatter: (params: any) => privacyMode ? '••••' : params.value?.toLocaleString()
        },
        { field: 'uom', headerName: 'UOM', width: 95 },
        { 
            field: 'mw', 
            headerName: 'MW', 
            filter: 'agNumberColumnFilter', 
            width: 110,
            valueFormatter: (params: any) => privacyMode ? '••••' : params.value?.toFixed(3)
        },
        { 
            field: 'unitPrice', 
            headerName: 'UnitPrice', 
            filter: 'agNumberColumnFilter', 
            width: 130,
            valueFormatter: (params: any) => {
                if (privacyMode) return '••••';
                return params.value ? `₹${params.value?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '';
            }
        },
        { 
            field: 'netValue', 
            headerName: 'Net Value', 
            filter: 'agNumberColumnFilter', 
            width: 140,
            valueFormatter: (params: any) => {
                if (privacyMode) return '••••';
                return params.value ? `₹${params.value?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '';
            }
        },
        { field: 'hsn', headerName: 'HSN CODE/SAC Code', width: 110 },
        { 
            field: 'cgst', 
            headerName: 'CGST Amount', 
            filter: 'agNumberColumnFilter', 
            width: 120,
            valueFormatter: (params: any) => {
                if (privacyMode) return '••••';
                return params.value ? `₹${params.value?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '';
            }
        },
        { 
            field: 'sgst', 
            headerName: 'SGST Amount', 
            filter: 'agNumberColumnFilter', 
            width: 120,
            valueFormatter: (params: any) => {
                if (privacyMode) return '••••';
                return params.value ? `₹${params.value?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '';
            }
        },
        { 
            field: 'igst', 
            headerName: 'IGST Amount', 
            filter: 'agNumberColumnFilter', 
            width: 120,
            valueFormatter: (params: any) => {
                if (privacyMode) return '••••';
                return params.value ? `₹${params.value?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '';
            }
        },
        { field: 'plant', headerName: 'Plant', width: 100 },
        { field: 'sloc', headerName: 'Storage Location', width: 100 },
        { field: 'vehicleNo', headerName: 'Vehicle No.', width: 135 },
        { field: 'soNumber', headerName: 'S.O.Number', width: 125 },
        { field: 'incoterms', headerName: 'Incoterms', width: 115 },
        { 
            field: 'ewayExpiry', 
            headerName: 'Eway Expiry', 
            filter: 'agDateColumnFilter', 
            width: 140,
            valueFormatter: (params: any) => {
                if (!params.value) return '';
                if (params.value instanceof Date) {
                    return params.value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                }
                const str = String(params.value).split(/[T ]/)[0];
                const parts = str.split('-');
                if (parts.length === 3) {
                    const y = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10);
                    const d = parseInt(parts[2], 10);
                    const dateObj = new Date(y, m - 1, d);
                    if (!isNaN(dateObj.getTime())) {
                        return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    }
                }
                const fallbackDate = new Date(params.value);
                return isNaN(fallbackDate.getTime()) ? params.value : fallbackDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
        },
        { field: 'invoiceStatus', headerName: 'Invoice Status', width: 140 },
    ], [privacyMode]);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: 'agSetColumnFilter',
        resizable: true,
        wrapHeaderName: true,
        autoHeaderHeight: true,
        enableRowGroup: true,
        enablePivot: true,
        enableValue: true,
    }), []);

    const sideBar = useMemo(() => ({
        toolPanels: [
            {
                id: 'columns',
                labelDefault: 'Columns',
                labelKey: 'columns',
                iconKey: 'columns',
                toolPanel: 'agColumnsToolPanel',
            },
            {
                id: 'filters',
                labelDefault: 'Filters',
                labelKey: 'filters',
                iconKey: 'filter',
                toolPanel: 'agFiltersToolPanel',
            }
        ],
        defaultToolPanel: ''
    }), []);

    const statusBar = useMemo(() => ({
        statusPanels: [
            { statusPanel: 'agSelectedRowCountComponent', align: 'left' },
            { statusPanel: 'agAggregationComponent', align: 'right' }
        ]
    }), []);

    const gridIcons = useMemo(() => ({
        menu: '<span class="excel-menu-btn-container flex items-center gap-0.5">' +
              '<svg class="excel-funnel-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>' +
              '<svg class="excel-caret-icon" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>' +
              '</span>',
    }), []);

    const renderSubtotalCells = () => {
        if (!gridApi) return null;
        
        return gridApi.getAllDisplayedColumns().map((col: any) => {
            const colId = col.getColId();
            const width = col.getActualWidth();
            
            let val = '';
            let align = 'left';
            let className = '';
            
            if (colId === 'date') {
                val = 'SUBTOTAL';
                className = 'text-emerald-800 font-black';
            } else if (colId === 'invoiceNo') {
                val = `${subtotals.count} / ${data.length} rows`;
                className = 'text-slate-600 font-bold text-[9px]';
            } else if (colId === 'val') {
                val = privacyMode ? '••••' : `₹${Math.round(subtotals.val).toLocaleString('en-IN')}`;
                align = 'right';
                className = 'text-emerald-700 font-bold font-mono text-xs';
            } else if (colId === 'qty') {
                val = privacyMode ? '••••' : Math.round(subtotals.qty).toLocaleString('en-IN');
                align = 'right';
                className = 'text-slate-700 font-mono font-bold';
            } else if (colId === 'mw') {
                val = privacyMode ? '••••' : subtotals.mw.toFixed(3);
                align = 'right';
                className = 'text-slate-700 font-mono font-bold';
            } else if (colId === 'netValue') {
                val = privacyMode ? '••••' : `₹${Math.round(subtotals.netValue).toLocaleString('en-IN')}`;
                align = 'right';
                className = 'text-slate-700 font-mono font-bold';
            } else if (colId === 'cgst') {
                val = privacyMode ? '••••' : `₹${Math.round(subtotals.cgst).toLocaleString('en-IN')}`;
                align = 'right';
                className = 'text-slate-700 font-mono font-bold';
            } else if (colId === 'sgst') {
                val = privacyMode ? '••••' : `₹${Math.round(subtotals.sgst).toLocaleString('en-IN')}`;
                align = 'right';
                className = 'text-slate-700 font-mono font-bold';
            } else if (colId === 'igst') {
                val = privacyMode ? '••••' : `₹${Math.round(subtotals.igst).toLocaleString('en-IN')}`;
                align = 'right';
                className = 'text-slate-700 font-mono font-bold';
            }
            
            return (
                <div
                    key={colId}
                    style={{ width, minWidth: width }}
                    className={`h-full border-r border-slate-200/60 px-3 flex items-center shrink-0 box-border ${
                        align === 'right' ? 'justify-end' : 'justify-start'
                    } ${className}`}
                >
                    <span className="truncate w-full">{val}</span>
                </div>
            );
        });
    };

    return (
        <div className="flex-1 flex flex-col bg-white overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            {/* Merged Header & Subtotal Summary Ribbon */}
            <div className="bg-slate-900 text-white px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-md z-10 select-none">
                {/* Left: Title & Count */}
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-xs font-black tracking-wider uppercase text-emerald-400">Master Revenue Ledger</h1>
                        <span className="font-mono text-[9px] text-slate-400 font-bold">
                            Filtered: {subtotals.count} / {data.length} rows
                        </span>
                    </div>
                </div>

                {/* Center: Live Subtotals */}
                <div 
                    className="flex flex-wrap items-center gap-x-6 gap-y-1 bg-slate-800/80 px-4 py-1.5 rounded-lg border border-slate-700/60 shadow-inner cursor-help"
                    data-tooltip={`Subtotals are calculated in real-time based on the current active filters within the selected Fiscal Year.
Logic:
• Sum of Amount (₹ Cr): Total value of filtered transactions divided by 10,000,000.
• Sum of Quantity: Total units of filtered transactions.
• Sum of Capacity (MW): Total megawatt capacity of filtered transactions.`}
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Amount:</span>
                        <span className="font-mono text-xs font-black text-emerald-400">
                            {privacyMode ? '••••' : `₹ ${(subtotals.val / 10_000_000).toFixed(2)} Cr`}
                        </span>
                    </div>
                    <div className="h-3 w-px bg-slate-700" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Qty:</span>
                        <span className="font-mono text-xs font-bold text-slate-200">
                            {privacyMode ? '••••' : Math.round(subtotals.qty).toLocaleString('en-IN')}
                        </span>
                    </div>
                    <div className="h-3 w-px bg-slate-700" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Capacity:</span>
                        <span className="font-mono text-xs font-bold text-slate-200">
                            {privacyMode ? '••••' : `${subtotals.mw.toFixed(3)} MW`}
                        </span>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onClearFilters}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black text-slate-300 hover:text-white transition-colors uppercase tracking-wider cursor-pointer"
                    >
                        <FilterX className="w-3.5 h-3.5" />
                        Clear Filters
                    </button>
                    <button 
                        onClick={onExportClick}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-[9px] font-black uppercase tracking-wider hover:bg-emerald-500 transition-all shadow-sm cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Excel Export
                    </button>
                    <div className="w-px h-4 bg-slate-700" />
                    <button 
                        onClick={() => setActiveMainView('DASHBOARD')}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer border border-slate-700 shadow-sm"
                        data-tooltip="Close Ledger"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Custom Column-Aligned Subtotal Row (Above headers) */}
            <div 
                ref={subtotalScrollRef}
                className="w-full overflow-x-hidden bg-emerald-50/70 border-b-2 border-emerald-500/80 shrink-0 select-none shadow-sm"
            >
                <div className="flex text-[10px] items-center h-8" style={{ width: 'fit-content' }}>
                    {renderSubtotalCells()}
                    {/* Trailing spacer cell for scrollbar width alignment */}
                    <div style={{ width: 30, minWidth: 30 }} className="shrink-0 h-full" />
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
                    rowHeight={40}
                    onGridReady={onGridReady}
                    onModelUpdated={updateSubtotals}
                    onBodyScroll={onBodyScroll}
                    onColumnResized={updateColumnWidths}
                    onColumnVisible={updateColumnWidths}
                    onColumnMoved={updateColumnWidths}
                    onGridColumnsChanged={updateColumnWidths}
                    icons={gridIcons}
                    enableRangeSelection={true}
                    enableFillHandle={true}
                    rowGroupPanelShow="always"
                    sideBar={sideBar}
                    statusBar={statusBar}
                    enableCharts={true}
                />
            </div>
        </div>
    );
};
