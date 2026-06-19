import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useStore } from '@/store/useStore';
import { X, Download, Filter } from 'lucide-react';
import { ColDef } from 'ag-grid-community';

export const TransactionLedger: React.FC = () => {
    const { data, privacyMode } = useStore();

    const columnDefs = useMemo<ColDef[]>(() => [
        { field: 'date', headerName: 'Date', sortable: true, filter: 'agDateColumnFilter', flex: 1, minWidth: 110 },
        { field: 'invoiceNo', headerName: 'Invoice #', sortable: true, filter: 'agTextColumnFilter', flex: 1, minWidth: 120 },
        { field: 'invoiceType', headerName: 'Type', sortable: true, filter: 'agTextColumnFilter', flex: 0.8, minWidth: 100 },
        { field: 'customer', headerName: 'Customer', sortable: true, filter: 'agTextColumnFilter', flex: 1.5, minWidth: 200 },
        { field: 'custCode', headerName: 'Cust Code', sortable: true, filter: 'agTextColumnFilter', flex: 0.8, minWidth: 100, hide: true },
        { field: 'segment', headerName: 'Segment', sortable: true, filter: 'agTextColumnFilter', flex: 1, minWidth: 120 },
        { field: 'wp', headerName: 'SKU / Product', sortable: true, filter: 'agTextColumnFilter', flex: 1.5, minWidth: 180 },
        { field: 'materialCode', headerName: 'Mat Code', sortable: true, filter: 'agTextColumnFilter', flex: 1, minWidth: 120, hide: true },
        { field: 'matDesc', headerName: 'Material Description', sortable: true, filter: 'agTextColumnFilter', flex: 2, minWidth: 250, hide: true },
        { field: 'hsn', headerName: 'HSN/SAC', sortable: true, filter: 'agTextColumnFilter', flex: 0.8, minWidth: 100, hide: true },
        { 
            field: 'qty', 
            headerName: 'Qty', 
            sortable: true, 
            filter: 'agNumberColumnFilter', 
            flex: 0.8,
            minWidth: 80,
            valueFormatter: (params) => privacyMode ? '****' : params.value?.toLocaleString()
        },
        { field: 'uom', headerName: 'UOM', sortable: true, filter: 'agTextColumnFilter', flex: 0.6, minWidth: 70 },
        { 
            field: 'mw', 
            headerName: 'MW', 
            sortable: true, 
            filter: 'agNumberColumnFilter', 
            flex: 0.8,
            minWidth: 80,
            valueFormatter: (params) => privacyMode ? '****' : params.value?.toFixed(3)
        },
        { 
            field: 'unitPrice', 
            headerName: 'Unit Price', 
            sortable: true, 
            filter: 'agNumberColumnFilter', 
            flex: 1,
            minWidth: 100,
            valueFormatter: (params) => privacyMode ? '****' : `₹${params.value?.toLocaleString()}`
        },
        { 
            field: 'val', 
            headerName: 'Taxable Value', 
            sortable: true, 
            filter: 'agNumberColumnFilter', 
            flex: 1.2,
            minWidth: 130,
            cellClass: 'font-mono font-bold text-emerald-600',
            valueFormatter: (params) => privacyMode ? '****' : `₹${params.value?.toLocaleString()}`
        },
        { field: 'cgst', headerName: 'CGST', sortable: true, filter: 'agNumberColumnFilter', flex: 1, minWidth: 100, hide: true },
        { field: 'sgst', headerName: 'SGST', sortable: true, filter: 'agNumberColumnFilter', flex: 1, minWidth: 100, hide: true },
        { field: 'igst', headerName: 'IGST', sortable: true, filter: 'agNumberColumnFilter', flex: 1, minWidth: 100, hide: true },
        { 
            field: 'netValue', 
            headerName: 'Net Value', 
            sortable: true, 
            filter: 'agNumberColumnFilter', 
            flex: 1.2,
            minWidth: 130,
            valueFormatter: (params) => privacyMode ? '****' : `₹${params.value?.toLocaleString()}`
        },
        { field: 'salesHead', headerName: 'Sales Head', sortable: true, filter: 'agTextColumnFilter', flex: 1.2, minWidth: 150 },
        { field: 'plant', headerName: 'Plant', sortable: true, filter: 'agTextColumnFilter', flex: 0.8, minWidth: 100, hide: true },
        { field: 'sloc', headerName: 'Sloc', sortable: true, filter: 'agTextColumnFilter', flex: 0.8, minWidth: 100, hide: true },
        { field: 'vehicleNo', headerName: 'Vehicle No', sortable: true, filter: 'agTextColumnFilter', flex: 1, minWidth: 120 },
        { field: 'soNumber', headerName: 'SO #', sortable: true, filter: 'agTextColumnFilter', flex: 1, minWidth: 120 },
        { field: 'incoterms', headerName: 'Incoterms', sortable: true, filter: 'agTextColumnFilter', flex: 1, minWidth: 120, hide: true },
        { field: 'invoiceStatus', headerName: 'Status', sortable: true, filter: 'agTextColumnFilter', flex: 1, minWidth: 120 },
        { field: 'ewayExpiry', headerName: 'Eway Expiry', sortable: true, filter: 'agTextColumnFilter', flex: 1, minWidth: 150, hide: true },
    ], [privacyMode]);

    const defaultColDef = useMemo(() => ({
        resizable: true,
        floatingFilter: true,
        sortable: true,
        filter: true,
        flex: 1
    }), []);

    return (
        <div className="flex-1 flex flex-col bg-white overflow-hidden animate-in fade-in duration-300">
            {/* Toolbar */}
            <div className="h-12 shrink-0 bg-slate-900 text-white flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Full Data Source Ledger</span>
                    <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-3 ml-1">{data.length} Records Loaded</span>
                </div>
                <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 text-[10px] font-bold hover:text-emerald-400 transition-colors">
                        <Download className="w-3.5 h-3.5" /> Export Excel
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 ag-theme-alpine w-full">
                <AgGridReact
                    rowData={data}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    pagination={true}
                    paginationPageSize={100}
                    rowHeight={32}
                    headerHeight={36}
                    animateRows={true}
                    enableCellTextSelection={true}
                    suppressMenuHide={false}
                />
            </div>
        </div>
    );
};