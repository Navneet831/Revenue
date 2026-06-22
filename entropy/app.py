import os
import io
import json
import psycopg2
import psycopg2.extras
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, render_template, send_file
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

app = Flask(__name__)

# Database Configuration
DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "user": os.environ.get("PG_USER", "navneet"),
    "password": os.environ.get("PG_PASSWORD", ""),
    "dbname": os.environ.get("PG_DATABASE", "Grewdb")
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

def calculate_shannon_entropy(series):
    """Calculate Shannon entropy for a time series of quantities/revenues (12 months)."""
    total = series.sum()
    if total <= 0:
        return 0.0
    p = series / total
    p = p[p > 0]  # Ignore zero-probability months
    entropy = -np.sum(p * np.log2(p))
    return float(entropy)

def run_entropy_analysis(fy, plant='All', segment='All', cust_name='All', min_months=3, min_qty=0, winsorize_pct=99, abc_a=0.80, abc_b=0.15, adi_cutoff=1.32, cv2_cutoff=0.49):
    """
    Run core SKU temporal entropy and demand pattern analysis.
    Performs data cleaning, winsorization, zero-filling, and classification.
    """
    conn = get_db_connection()
    
    query = r"""
    SELECT 
        "Module WP" AS sku,
        "Mat Desc" AS mat_desc,
        "Invoice date" AS invoice_date,
        "SalesQty" AS qty,
        COALESCE(
            CASE 
                WHEN "Revenue" ~ '^-?[0-9]+(\.[0-9]+)?$' THEN CAST("Revenue" AS double precision)
                ELSE NULL 
            END, 
            "Taxable Value"
        ) AS revenue_val,
        "Year" AS fy,
        "Month" AS month,
        "Plant" AS plant,
        "Segment" AS segment,
        "Cust_name" AS cust_name
    FROM revenue
    WHERE "SalesQty" > 0 AND "Module WP" IS NOT NULL AND "Year" = %s;
    """
    
    df = pd.read_sql_query(query, conn, params=(fy,))
    conn.close()
    
    if df.empty:
        return pd.DataFrame(), {}
        
    # Python filters
    if plant != 'All':
        try:
            plant_val = float(plant)
            df = df[df['plant'] == plant_val]
        except ValueError:
            pass
            
    if segment != 'All':
        df = df[df['segment'] == segment]
        
    if cust_name != 'All':
        df = df[df['cust_name'] == cust_name]
        
    if df.empty:
        return pd.DataFrame(), {}
        
    # Winsorization
    if winsorize_pct > 0 and winsorize_pct < 100:
        q_limit = np.percentile(df['qty'], winsorize_pct)
        r_limit = np.percentile(df['revenue_val'], winsorize_pct)
        df['qty'] = np.clip(df['qty'], None, q_limit)
        df['revenue_val'] = np.clip(df['revenue_val'], None, r_limit)
        
    # Complete 12-month skeleton
    months_fy = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
    unique_skus = df['sku'].unique()
    
    sku_desc = df.groupby('sku')['mat_desc'].apply(lambda x: x.mode().iloc[0] if not x.mode().empty else 'Unknown').to_dict()
    
    grouped = df.groupby(['sku', 'month']).agg({
        'qty': 'sum',
        'revenue_val': 'sum'
    }).reset_index()
    
    index = pd.MultiIndex.from_product([unique_skus, months_fy], names=['sku', 'month'])
    skeleton = pd.DataFrame(index=index).reset_index()
    
    merged = pd.merge(skeleton, grouped, on=['sku', 'month'], how='left').fillna(0)
    
    sku_metrics = []
    max_h = np.log2(12)
    
    for sku, group in merged.groupby('sku'):
        group = group.set_index('month').loc[months_fy].reset_index()
        
        q_series = group['qty'].values
        r_series = group['revenue_val'].values
        
        total_qty = np.sum(q_series)
        total_revenue = np.sum(r_series)
        
        if total_qty < min_qty:
            continue
            
        nonzero_months = np.sum(q_series > 0)
        
        if nonzero_months < min_months:
            continue
            
        # Entropy
        h_qty = calculate_shannon_entropy(pd.Series(q_series))
        h_norm_qty = h_qty / max_h
        
        h_rev = calculate_shannon_entropy(pd.Series(r_series))
        h_norm_rev = h_rev / max_h
        
        # CV
        mean_qty = np.mean(q_series)
        std_qty = np.std(q_series, ddof=0)
        cv = std_qty / mean_qty if mean_qty > 0 else 0.0
        cv2 = cv ** 2
        
        # ADI
        adi = 12.0 / nonzero_months if nonzero_months > 0 else 99.0
        
        # Forecastability Score (0 - 100%)
        # Decreases as CV and ADI increase
        f_score = 100.0 * np.exp(-0.35 * (adi - 1.0) - 0.25 * cv)
        f_score = max(0.0, min(100.0, float(f_score)))
        
        # SBC Demand Pattern Classify based on configurable cutoffs
        if adi <= adi_cutoff and cv2 <= cv2_cutoff:
            pattern = 'Smooth'
        elif adi > adi_cutoff and cv2 <= cv2_cutoff:
            pattern = 'Intermittent'
        elif adi <= adi_cutoff and cv2 > cv2_cutoff:
            pattern = 'Erratic'
        else:
            pattern = 'Lumpy'
            
        # Entropy Level
        if h_norm_qty < 0.30:
            ent_level = 'Low'
        elif h_norm_qty < 0.60:
            ent_level = 'Medium'
        elif h_norm_qty < 0.80:
            ent_level = 'High'
        else:
            ent_level = 'Very High'
            
        sku_metrics.append({
            'Module WP': float(sku),
            'Mat Desc': sku_desc.get(sku, 'Unknown SKU'),
            'FY Qty': float(total_qty),
            'FY Revenue': float(total_revenue),
            'Entropy': float(h_qty),
            'H_norm': float(h_norm_qty),
            'Entropy_Revenue': float(h_rev),
            'H_norm_rev': float(h_norm_rev),
            'CV': float(cv),
            'CV2': float(cv2),
            'ADI': float(adi),
            'NonZeroMonths': int(nonzero_months),
            'Demand_Pattern': pattern,
            'Entropy_Level': ent_level,
            'Forecastability_Score': f_score
        })
        
    if not sku_metrics:
        return pd.DataFrame(), {}
        
    df_res = pd.DataFrame(sku_metrics)
    
    # ABC Pareto
    df_res = df_res.sort_values(by='FY Revenue', ascending=False)
    total_rev = df_res['FY Revenue'].sum()
    
    if total_rev > 0:
        df_res['cum_rev'] = df_res['FY Revenue'].cumsum()
        df_res['cum_rev_pct'] = df_res['cum_rev'] / total_rev
    else:
        df_res['cum_rev_pct'] = 0.0
        
    abc_classes = []
    running_pct = 0.0
    for idx, row in df_res.iterrows():
        prev_pct = running_pct
        running_pct = row['cum_rev_pct']
        
        if prev_pct <= abc_a:
            abc_class = 'A'
        elif prev_pct <= (abc_a + abc_b):
            abc_class = 'B'
        else:
            abc_class = 'C'
        abc_classes.append(abc_class)
        
    df_res['ABC Class'] = abc_classes
    df_res = df_res.drop(columns=['cum_rev', 'cum_rev_pct'])
    
    # Combined segment and Recommendations
    overall_segments = []
    recs = []
    
    for idx, row in df_res.iterrows():
        abc = row['ABC Class']
        pat = row['Demand_Pattern']
        ent = row['Entropy_Level']
        
        overall = f"{abc}-{pat}-{ent}"
        overall_segments.append(overall)
        
        # Recommendations
        if abc == 'A':
            if pat == 'Smooth':
                rec = "Core Stable SKU. High revenue, highly predictable. Use lean inventory/JIT with low safety stock and statistical forecasts."
            elif pat == 'Intermittent':
                rec = "High-Value Occasional SKU. Buffer stock or customer contracts recommended. Align with production schedule."
            elif pat == 'Erratic':
                rec = "High-Value Erratic SKU. High revenue but volatile quantity. Maintain moderate safety stock; review monthly forecast adjustments."
            else: # Lumpy
                rec = "Critical Volatile SKU. High revenue, rare & lumpy. Keep strategic safety stock or shift to Make-to-Order (MTO)."
        elif abc == 'B':
            if pat == 'Smooth':
                rec = "Medium-Value Stable SKU. Standard min-max planning with normal safety stock. Highly suitable for automated planning."
            elif pat == 'Intermittent':
                rec = "Medium-Value Intermittent SKU. Regular but periodic. Set standard reorder points with moderate safety margins."
            elif pat == 'Erratic':
                rec = "Medium-Value Erratic SKU. Volatile demand sizing. Frequent review of safety stock levels; track sales signals."
            else: # Lumpy
                rec = "Medium-Value Lumpy SKU. High risk of obsolescence or stockouts. Use Make-to-Order or maintain very lean buffer stock."
        else: # C
            if pat == 'Smooth':
                rec = "Low-Value Stable SKU. Cheap to hold, stable demand. Use visual kanban or high reorder quantities to reduce ordering costs."
            elif pat == 'Intermittent':
                rec = "Slow-moving C SKU. Keep zero or minimal stock. Transition to MTO. Review for potential rationalization."
            elif pat == 'Erratic':
                rec = "Low-Value Erratic SKU. Low revenue, high variability. Review SKU rationalization or move strictly to MTO."
            else: # Lumpy
                rec = "Highly Unpredictable Slow-mover. High obsolescence risk. Rationalize SKU, discontinue, or operate strictly on MTO."
                
        recs.append(rec)
        
    df_res['Overall_Segment'] = overall_segments
    df_res['Actionable Recommendation'] = recs
    
    # Calculate summary KPIs
    kpis = {
        "total_skus": len(df_res),
        "total_revenue": float(total_rev),
        "total_qty": float(df_res['FY Qty'].sum()),
        "avg_entropy": float(df_res['H_norm'].mean()) if len(df_res) > 0 else 0,
        "sbc_counts": df_res['Demand_Pattern'].value_counts().to_dict(),
        "sbc_revenue": df_res.groupby('Demand_Pattern')['FY Revenue'].sum().to_dict(),
        "abc_counts": df_res['ABC Class'].value_counts().to_dict(),
        "abc_revenue": df_res.groupby('ABC Class')['FY Revenue'].sum().to_dict()
    }
    
    # Ensure keys exist
    for key in ['Smooth', 'Lumpy', 'Erratic', 'Intermittent']:
        kpis['sbc_counts'].setdefault(key, 0)
        kpis['sbc_revenue'].setdefault(key, 0.0)
    for key in ['A', 'B', 'C']:
        kpis['abc_counts'].setdefault(key, 0)
        kpis['abc_revenue'].setdefault(key, 0.0)
        
    return df_res, kpis

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/filters')
def get_filters():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # FY Years
        cursor.execute('SELECT DISTINCT "Year" FROM revenue WHERE "Year" IS NOT NULL ORDER BY "Year" DESC;')
        years = [r[0] for r in cursor.fetchall()]
        
        # Plants
        cursor.execute('SELECT DISTINCT "Plant" FROM revenue WHERE "Plant" IS NOT NULL ORDER BY "Plant";')
        plants = [int(r[0]) for r in cursor.fetchall()]
        
        # Segments
        cursor.execute('SELECT DISTINCT "Segment" FROM revenue WHERE "Segment" IS NOT NULL ORDER BY "Segment";')
        segments = [r[0] for r in cursor.fetchall()]
        
        # Customers (Exclude dummy '0' or empty)
        cursor.execute('SELECT DISTINCT "Cust_name" FROM revenue WHERE "Cust_name" IS NOT NULL AND "Cust_name" != \'0\' ORDER BY "Cust_name";')
        customers = [r[0] for r in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "status": "success",
            "years": years,
            "plants": plants,
            "segments": segments,
            "customers": customers
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Database error: {str(e)}"
        }), 500

@app.route('/api/analyze')
def analyze():
    try:
        fy = request.args.get('fy', '2025-26')
        plant = request.args.get('plant', 'All')
        segment = request.args.get('segment', 'All')
        cust_name = request.args.get('cust_name', 'All')
        min_months = int(request.args.get('min_months', 3))
        min_qty = float(request.args.get('min_qty', 0))
        winsorize_pct = int(request.args.get('winsorize_pct', 99))
        abc_a = float(request.args.get('abc_a', 0.80))
        abc_b = float(request.args.get('abc_b', 0.15))
        adi_cutoff = float(request.args.get('adi_cutoff', 1.32))
        cv2_cutoff = float(request.args.get('cv2_cutoff', 0.49))
        
        df, kpis = run_entropy_analysis(
            fy=fy, plant=plant, segment=segment, cust_name=cust_name,
            min_months=min_months, min_qty=min_qty, 
            winsorize_pct=winsorize_pct, abc_a=abc_a, abc_b=abc_b,
            adi_cutoff=adi_cutoff, cv2_cutoff=cv2_cutoff
        )
        
        if df.empty:
            return jsonify({
                "status": "success",
                "skus": [],
                "kpis": {},
                "heatmap": {"x": [], "y": [], "z": []}
            })
            
        skus_data = df.to_dict(orient='records')
        
        # Calculate ABC vs Entropy Heatmap (Revenue Contribution)
        pivot_df = df.pivot_table(
            index='ABC Class', 
            columns='Entropy_Level', 
            values='FY Revenue', 
            aggfunc='sum'
        ).fillna(0.0)
        
        abc_order = ['A', 'B', 'C']
        entropy_order = ['Low', 'Medium', 'High', 'Very High']
        
        # Re-index to ensure correct order and size
        pivot_df = pivot_df.reindex(index=abc_order, columns=entropy_order, fill_value=0.0)
        
        heatmap_data = {
            "x": entropy_order,
            "y": abc_order,
            "z": pivot_df.values.tolist()
        }
        
        return jsonify({
            "status": "success",
            "skus": skus_data,
            "kpis": kpis,
            "heatmap": heatmap_data
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": f"Analysis failed: {str(e)}"
        }), 500

@app.route('/api/sku_detail')
def sku_detail():
    try:
        sku = request.args.get('sku')
        if not sku:
            return jsonify({"status": "error", "message": "SKU parameter is required"}), 400
            
        sku_val = float(sku)
        plant = request.args.get('plant', 'All')
        segment = request.args.get('segment', 'All')
        cust_name = request.args.get('cust_name', 'All')
        
        conn = get_db_connection()
        
        query = r"""
        SELECT 
            "Year" AS fy,
            "Month" AS month,
            SUM("SalesQty") AS qty,
            SUM(COALESCE(
                CASE 
                    WHEN "Revenue" ~ '^-?[0-9]+(\.[0-9]+)?$' THEN CAST("Revenue" AS double precision)
                    ELSE NULL 
                END, 
                "Taxable Value"
            )) AS revenue
        FROM revenue
        WHERE "SalesQty" > 0 AND "Module WP" = %s
          {plant_filter}
          {segment_filter}
          {cust_filter}
        GROUP BY "Year", "Month"
        ORDER BY "Year", "Month";
        """
        
        params = [sku_val]
        plant_filter = ""
        if plant != 'All':
            plant_filter = 'AND "Plant" = %s'
            params.append(float(plant))
            
        segment_filter = ""
        if segment != 'All':
            segment_filter = 'AND "Segment" = %s'
            params.append(segment)
            
        cust_filter = ""
        if cust_name != 'All':
            cust_filter = 'AND "Cust_name" = %s'
            params.append(cust_name)
            
        full_query = query.format(plant_filter=plant_filter, segment_filter=segment_filter, cust_filter=cust_filter)
        
        df = pd.read_sql_query(full_query, conn, params=params)
        conn.close()
        
        months_fy = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
        months_names = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
        
        result = {}
        if not df.empty:
            years = df['fy'].unique()
            for yr in years:
                df_yr = df[df['fy'] == yr].set_index('month')
                qty_series = []
                rev_series = []
                for m in months_fy:
                    if m in df_yr.index:
                        qty_series.append(float(df_yr.loc[m, 'qty']))
                        rev_series.append(float(df_yr.loc[m, 'revenue']))
                    else:
                        qty_series.append(0.0)
                        rev_series.append(0.0)
                        
                result[yr] = {
                    "months": months_names,
                    "qty": qty_series,
                    "revenue": rev_series
                }
                
        return jsonify({
            "status": "success",
            "sku": sku_val,
            "yoy_data": result
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to retrieve SKU details: {str(e)}"
        }), 500

@app.route('/api/yoy_comparison')
def yoy_comparison():
    """Endpoint to run comparison metrics of all SKUs across two years."""
    try:
        fy1 = request.args.get('fy1', '2025-26')
        fy2 = request.args.get('fy2', '2026-27')
        plant = request.args.get('plant', 'All')
        segment = request.args.get('segment', 'All')
        cust_name = request.args.get('cust_name', 'All')
        min_months = int(request.args.get('min_months', 3))
        min_qty = float(request.args.get('min_qty', 0))
        winsorize_pct = int(request.args.get('winsorize_pct', 99))
        abc_a = float(request.args.get('abc_a', 0.80))
        abc_b = float(request.args.get('abc_b', 0.15))
        adi_cutoff = float(request.args.get('adi_cutoff', 1.32))
        cv2_cutoff = float(request.args.get('cv2_cutoff', 0.49))
        
        df1, _ = run_entropy_analysis(
            fy=fy1, plant=plant, segment=segment, cust_name=cust_name,
            min_months=min_months, min_qty=min_qty, winsorize_pct=winsorize_pct,
            abc_a=abc_a, abc_b=abc_b, adi_cutoff=adi_cutoff, cv2_cutoff=cv2_cutoff
        )
        df2, _ = run_entropy_analysis(
            fy=fy2, plant=plant, segment=segment, cust_name=cust_name,
            min_months=min_months, min_qty=min_qty, winsorize_pct=winsorize_pct,
            abc_a=abc_a, abc_b=abc_b, adi_cutoff=adi_cutoff, cv2_cutoff=cv2_cutoff
        )
        
        if df1.empty or df2.empty:
            return jsonify({
                "status": "success",
                "comparison": []
            })
            
        # Merge years
        merged = pd.merge(df1, df2, on='Module WP', suffixes=('_yr1', '_yr2'))
        
        comp_records = []
        for idx, row in merged.iterrows():
            q1, q2 = row['FY Qty_yr1'], row['FY Qty_yr2']
            r1, r2 = row['FY Revenue_yr1'], row['FY Revenue_yr2']
            
            qty_diff_pct = ((q2 - q1) / q1 * 100.0) if q1 > 0 else 0.0
            rev_diff_pct = ((r2 - r1) / r1 * 100.0) if r1 > 0 else 0.0
            
            comp_records.append({
                "Module WP": row['Module WP'],
                "Mat Desc": row['Mat Desc_yr1'],
                "Qty_Yr1": q1,
                "Qty_Yr2": q2,
                "Qty_Diff_Pct": qty_diff_pct,
                "Revenue_Yr1": r1,
                "Revenue_Yr2": r2,
                "Revenue_Diff_Pct": rev_diff_pct,
                "Pattern_Yr1": row['Demand_Pattern_yr1'],
                "Pattern_Yr2": row['Demand_Pattern_yr2'],
                "Entropy_Yr1": row['H_norm_yr1'],
                "Entropy_Yr2": row['H_norm_yr2'],
                "FScore_Yr1": row['Forecastability_Score_yr1'],
                "FScore_Yr2": row['Forecastability_Score_yr2']
            })
            
        return jsonify({
            "status": "success",
            "comparison": comp_records
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"YoY calculation failed: {str(e)}"
        }), 500

@app.route('/api/export')
def export():
    try:
        fy = request.args.get('fy', '2025-26')
        plant = request.args.get('plant', 'All')
        segment = request.args.get('segment', 'All')
        cust_name = request.args.get('cust_name', 'All')
        min_months = int(request.args.get('min_months', 3))
        min_qty = float(request.args.get('min_qty', 0))
        winsorize_pct = int(request.args.get('winsorize_pct', 99))
        abc_a = float(request.args.get('abc_a', 0.80))
        abc_b = float(request.args.get('abc_b', 0.15))
        adi_cutoff = float(request.args.get('adi_cutoff', 1.32))
        cv2_cutoff = float(request.args.get('cv2_cutoff', 0.49))
        
        df, kpis = run_entropy_analysis(
            fy=fy, plant=plant, segment=segment, cust_name=cust_name,
            min_months=min_months, min_qty=min_qty, 
            winsorize_pct=winsorize_pct, abc_a=abc_a, abc_b=abc_b,
            adi_cutoff=adi_cutoff, cv2_cutoff=cv2_cutoff
        )
        
        if df.empty:
            wb = Workbook()
            ws = wb.active
            ws.title = "No Data Found"
            ws['A1'] = "No records matched the selected filters."
            output = io.BytesIO()
            wb.save(output)
            output.seek(0)
            return send_file(output, download_name="sku_entropy_empty.xlsx", as_attachment=True)
            
        wb = Workbook()
        
        # 1. Summary Sheet
        ws_sum = wb.active
        ws_sum.title = "KPI Summary"
        ws_sum.views.sheetView[0].showGridLines = True
        
        # Title Block
        ws_sum.merge_cells('A1:D1')
        ws_sum['A1'] = "SKU Temporal Entropy & Demand Analytics"
        ws_sum['A1'].font = Font(name='Segoe UI', size=16, bold=True, color='FFFFFF')
        ws_sum['A1'].fill = PatternFill(start_color='1E3A8A', end_color='1E3A8A', fill_type='solid')
        ws_sum['A1'].alignment = Alignment(horizontal='center', vertical='center')
        ws_sum.row_dimensions[1].height = 40
        
        # Subtitle
        ws_sum['A2'] = f"FY: {fy} | Plant: {plant} | Segment: {segment} | Customer: {cust_name}"
        ws_sum['A2'].font = Font(name='Segoe UI', size=11, italic=True)
        ws_sum.merge_cells('A2:D2')
        ws_sum.row_dimensions[2].height = 20
        
        # Headers Style
        hdr_fill = PatternFill(start_color='3B82F6', end_color='3B82F6', fill_type='solid')
        hdr_font = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')
        thin_border = Border(
            left=Side(style='thin', color='CCCCCC'),
            right=Side(style='thin', color='CCCCCC'),
            top=Side(style='thin', color='CCCCCC'),
            bottom=Side(style='thin', color='CCCCCC')
        )
        
        ws_sum['A4'] = "Key Performance Indicators"
        ws_sum['A4'].font = Font(name='Segoe UI', size=13, bold=True, color='1E3A8A')
        
        kpis_rows = [
            ("Total Active SKUs", kpis["total_skus"], "NOS"),
            ("Total FY Qty Sold", kpis["total_qty"], "#,##0.00"),
            ("Total FY Revenue", kpis["total_revenue"], "₹#,##0.00"),
            ("Avg Normalized Entropy", kpis["avg_entropy"], "0.00%")
        ]
        
        for idx, (label, val, fmt) in enumerate(kpis_rows, start=5):
            ws_sum.cell(row=idx, column=1, value=label).font = Font(name='Segoe UI', size=11, bold=True)
            cell = ws_sum.cell(row=idx, column=2, value=val)
            cell.font = Font(name='Segoe UI', size=11)
            cell.number_format = fmt
            ws_sum.cell(row=idx, column=1).border = thin_border
            cell.border = thin_border
            
        # SBC Counts Table
        ws_sum['A11'] = "SBC Demand Patterns"
        ws_sum['A11'].font = Font(name='Segoe UI', size=13, bold=True, color='1E3A8A')
        
        ws_sum.cell(row=12, column=1, value="Demand Pattern").fill = hdr_fill
        ws_sum.cell(row=12, column=1).font = hdr_font
        ws_sum.cell(row=12, column=2, value="SKU Count").fill = hdr_fill
        ws_sum.cell(row=12, column=2).font = hdr_font
        ws_sum.cell(row=12, column=3, value="Total Revenue").fill = hdr_fill
        ws_sum.cell(row=12, column=3).font = hdr_font
        
        patterns = ['Smooth', 'Intermittent', 'Erratic', 'Lumpy']
        for idx, pat in enumerate(patterns, start=13):
            c_cnt = kpis["sbc_counts"].get(pat, 0)
            c_rev = kpis["sbc_revenue"].get(pat, 0.0)
            
            ws_sum.cell(row=idx, column=1, value=pat).font = Font(name='Segoe UI', size=11)
            cell_cnt = ws_sum.cell(row=idx, column=2, value=c_cnt)
            cell_cnt.font = Font(name='Segoe UI', size=11)
            cell_cnt.number_format = '#,##0'
            cell_rev = ws_sum.cell(row=idx, column=3, value=c_rev)
            cell_rev.font = Font(name='Segoe UI', size=11)
            cell_rev.number_format = '₹#,##0.00'
            
            for col in range(1, 4):
                ws_sum.cell(row=idx, column=col).border = thin_border
                
        # ABC Table
        ws_sum['A19'] = "ABC Pareto Class Distribution"
        ws_sum['A19'].font = Font(name='Segoe UI', size=13, bold=True, color='1E3A8A')
        ws_sum.cell(row=20, column=1, value="ABC Class").fill = hdr_fill
        ws_sum.cell(row=20, column=1).font = hdr_font
        ws_sum.cell(row=20, column=2, value="SKU Count").fill = hdr_fill
        ws_sum.cell(row=20, column=2).font = hdr_font
        ws_sum.cell(row=20, column=3, value="Total Revenue").fill = hdr_fill
        ws_sum.cell(row=20, column=3).font = hdr_font
        
        classes = ['A', 'B', 'C']
        for idx, cls in enumerate(classes, start=21):
            c_cnt = kpis["abc_counts"].get(cls, 0)
            c_rev = kpis["abc_revenue"].get(cls, 0.0)
            
            ws_sum.cell(row=idx, column=1, value=f"Class {cls}").font = Font(name='Segoe UI', size=11)
            cell_cnt = ws_sum.cell(row=idx, column=2, value=c_cnt)
            cell_cnt.font = Font(name='Segoe UI', size=11)
            cell_cnt.number_format = '#,##0'
            cell_rev = ws_sum.cell(row=idx, column=3, value=c_rev)
            cell_rev.font = Font(name='Segoe UI', size=11)
            cell_rev.number_format = '₹#,##0.00'
            
            for col in range(1, 4):
                ws_sum.cell(row=idx, column=col).border = thin_border
                
        ws_sum.column_dimensions['A'].width = 25
        ws_sum.column_dimensions['B'].width = 18
        ws_sum.column_dimensions['C'].width = 22
        
        # 2. Details Sheet
        ws_det = wb.create_sheet(title="SKU Analysis Metrics")
        ws_det.views.sheetView[0].showGridLines = True
        
        columns_to_export = [
            'Module WP', 'Mat Desc', 'FY Qty', 'FY Revenue', 'ABC Class', 
            'Entropy', 'H_norm', 'Entropy_Revenue', 'H_norm_rev', 'CV', 'CV2', 'ADI', 
            'NonZeroMonths', 'Demand_Pattern', 'Entropy_Level', 'Forecastability_Score', 'Overall_Segment', 'Actionable Recommendation'
        ]
        
        for col_idx, col_name in enumerate(columns_to_export, start=1):
            cell = ws_det.cell(row=1, column=col_idx, value=col_name)
            cell.font = hdr_font
            cell.fill = hdr_fill
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            cell.border = thin_border
        ws_det.row_dimensions[1].height = 28
        
        format_map = {
            'Module WP': '0',
            'FY Qty': '#,##0.00',
            'FY Revenue': '₹#,##0.00',
            'Entropy': '0.0000',
            'H_norm': '0.00%',
            'Entropy_Revenue': '0.0000',
            'H_norm_rev': '0.00%',
            'CV': '0.0000',
            'CV2': '0.0000',
            'ADI': '0.00',
            'NonZeroMonths': '0',
            'Forecastability_Score': '0.00%'
        }
        
        zebra_fill = PatternFill(start_color='F3F4F6', end_color='F3F4F6', fill_type='solid')
        
        for row_idx, row in enumerate(df[columns_to_export].itertuples(index=False), start=2):
            is_zebra = (row_idx % 2 == 0)
            ws_det.row_dimensions[row_idx].height = 20
            
            for col_idx, val in enumerate(row, start=1):
                col_name = columns_to_export[col_idx-1]
                cell = ws_det.cell(row=row_idx, column=col_idx, value=val)
                cell.font = Font(name='Segoe UI', size=10)
                cell.border = thin_border
                
                if is_zebra:
                    cell.fill = zebra_fill
                    
                # Format forecast score properly as percentage if it is returned 0-100 scale
                if col_name == 'Forecastability_Score':
                    cell.value = val / 100.0
                    cell.number_format = '0.0%'
                elif col_name in format_map:
                    cell.number_format = format_map[col_name]
                    
                if col_name in ['Mat Desc', 'Actionable Recommendation', 'Overall_Segment', 'Demand_Pattern', 'Entropy_Level', 'ABC Class']:
                    cell.alignment = Alignment(horizontal='left', vertical='center')
                else:
                    cell.alignment = Alignment(horizontal='right', vertical='center')
                    
        for col in ws_det.columns:
            max_len = 0
            col_letter = col[0].column_letter
            for cell in col:
                val_str = str(cell.value or '')
                if len(val_str) > max_len:
                    max_len = len(val_str)
            ws_det.column_dimensions[col_letter].width = min(max(max_len + 3, 10), 50)
            
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        filename = f"sku_entropy_analysis_{fy}_{plant}_{segment}.xlsx".replace(" ", "_")
        return send_file(output, download_name=filename, as_attachment=True)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Export failed: {str(e)}"}), 500

@app.route('/api/sql')
def get_sql():
    sql_queries = {
        "full_entropy_analysis": r"""
-- Complete production-ready PostgreSQL query with composite Forecastability Score and segmentation
WITH base_sales AS (
    SELECT 
        "Module WP" AS sku,
        "Year" AS fy,
        "Month" AS month,
        "SalesQty" AS qty,
        COALESCE(
            CASE 
                WHEN "Revenue" ~ '^-?[0-9]+(\.[0-9]+)?$' THEN CAST("Revenue" AS double precision)
                ELSE NULL 
            END, 
            "Taxable Value"
        ) AS revenue_val,
        "Mat Desc" AS mat_desc
    FROM revenue
    WHERE "SalesQty" > 0 AND "Module WP" IS NOT NULL
      AND "Year" = '2025-26'
),
months AS (
    SELECT unnest(ARRAY[4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]) AS month
),
sku_info AS (
    SELECT sku, fy, MAX(mat_desc) AS mat_desc
    FROM base_sales
    GROUP BY sku, fy
),
skeleton AS (
    SELECT s.sku, s.mat_desc, s.fy, m.month
    FROM sku_info s
    CROSS JOIN months m
),
monthly_sales AS (
    SELECT sku, fy, month, SUM(qty) AS qty_sum, SUM(revenue_val) AS rev_sum
    FROM base_sales
    GROUP BY sku, fy, month
),
filled_sales AS (
    SELECT 
        s.sku, s.mat_desc, s.fy, s.month,
        COALESCE(m.qty_sum, 0) AS monthly_qty,
        COALESCE(m.rev_sum, 0) AS monthly_revenue
    FROM skeleton s
    LEFT JOIN monthly_sales m ON s.sku = m.sku AND s.fy = m.fy AND s.month = m.month
),
sku_totals AS (
    SELECT 
        sku, mat_desc, fy,
        SUM(monthly_qty) AS total_qty,
        SUM(monthly_revenue) AS total_revenue,
        COUNT(CASE WHEN monthly_qty > 0 THEN 1 END) AS nonzero_months,
        AVG(monthly_qty) AS mean_qty,
        STDDEV_POP(monthly_qty) AS stddev_qty
    FROM filled_sales
    GROUP BY sku, mat_desc, fy
),
monthly_probabilities AS (
    SELECT 
        f.sku, f.mat_desc, f.fy, f.month, f.monthly_qty, f.monthly_revenue,
        t.total_qty, t.total_revenue,
        CASE WHEN t.total_qty > 0 AND f.monthly_qty > 0 THEN f.monthly_qty / t.total_qty ELSE 0 END AS p_qty,
        CASE WHEN t.total_revenue > 0 AND f.monthly_revenue > 0 THEN f.monthly_revenue / t.total_revenue ELSE 0 END AS p_rev
    FROM filled_sales f
    JOIN sku_totals t ON f.sku = t.sku AND f.mat_desc = t.mat_desc AND f.fy = t.fy
),
sku_entropy AS (
    SELECT 
        sku, mat_desc, fy,
        -SUM(CASE WHEN p_qty > 0 THEN p_qty * (LN(p_qty) / LN(2)) ELSE 0 END) AS entropy_qty,
        -SUM(CASE WHEN p_rev > 0 THEN p_rev * (LN(p_rev) / LN(2)) ELSE 0 END) AS entropy_rev
    FROM monthly_probabilities
    GROUP BY sku, mat_desc, fy
),
sku_metrics AS (
    SELECT 
        t.sku, t.mat_desc, t.fy, t.total_qty, t.total_revenue, t.nonzero_months, t.mean_qty, t.stddev_qty,
        CASE WHEN t.mean_qty > 0 THEN t.stddev_qty / t.mean_qty ELSE 0 END AS cv,
        CASE WHEN t.mean_qty > 0 THEN POWER(t.stddev_qty / t.mean_qty, 2) ELSE 0 END AS cv2,
        CASE WHEN t.nonzero_months > 0 THEN 12.0 / t.nonzero_months ELSE 99.0 END AS adi,
        e.entropy_qty, e.entropy_rev,
        e.entropy_qty / 3.58496250072 AS h_norm,
        SUM(t.total_revenue) OVER (PARTITION BY t.fy) AS fy_total_revenue
    FROM sku_totals t
    JOIN sku_entropy e ON t.sku = e.sku AND t.mat_desc = e.mat_desc AND t.fy = e.fy
),
sku_ranked AS (
    SELECT *,
        SUM(total_revenue) OVER (PARTITION BY fy ORDER BY total_revenue DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_revenue
    FROM sku_metrics
),
sku_abc AS (
    SELECT *,
        CASE WHEN fy_total_revenue > 0 THEN running_revenue / fy_total_revenue ELSE 0 END AS cum_revenue_pct
    FROM sku_ranked
)
SELECT 
    sku AS "Module WP",
    mat_desc AS "Mat Desc",
    fy AS "FY",
    total_qty AS "FY Qty",
    total_revenue AS "FY Revenue",
    CASE 
        WHEN cum_revenue_pct <= 0.80 THEN 'A'
        WHEN cum_revenue_pct - (total_revenue / NULLIF(fy_total_revenue, 0)) <= 0.80 THEN 'A'
        WHEN cum_revenue_pct - (total_revenue / NULLIF(fy_total_revenue, 0)) <= 0.95 THEN 'B'
        ELSE 'C'
    END AS "ABC Class",
    entropy_qty AS "Entropy",
    h_norm AS "H_norm",
    entropy_rev AS "Entropy_Revenue",
    cv AS "CV",
    cv2 AS "CV2",
    adi AS "ADI",
    nonzero_months AS "NonZeroMonths",
    CASE 
        WHEN adi <= 1.32 AND cv2 <= 0.49 THEN 'Smooth'
        WHEN adi > 1.32 AND cv2 <= 0.49 THEN 'Intermittent'
        WHEN adi <= 1.32 AND cv2 > 0.49 THEN 'Erratic'
        ELSE 'Lumpy'
    END AS "Demand_Pattern",
    CASE 
        WHEN h_norm < 0.30 THEN 'Low'
        WHEN h_norm >= 0.30 AND h_norm < 0.60 THEN 'Medium'
        WHEN h_norm >= 0.60 AND h_norm < 0.80 THEN 'High'
        ELSE 'Very High'
    END AS "Entropy_Level",
    -- Forecastability Score calculation: 100 * exp(-0.35 * (ADI - 1.0) - 0.25 * CV)
    GREATEST(0.0, LEAST(100.0, 100.0 * EXP(-0.35 * (
        (CASE WHEN nonzero_months > 0 THEN 12.0 / nonzero_months ELSE 99.0 END) - 1.0
    ) - 0.25 * (
        CASE WHEN mean_qty > 0 THEN stddev_qty / mean_qty ELSE 0 END
    )))) AS "Forecastability_Score"
FROM sku_abc
ORDER BY fy, total_revenue DESC;
        """
    }
    return jsonify(sql_queries)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
