import pandas as pd
import psycopg2
from psycopg2 import extras
import os
import sys

# --- CONFIGURATION ---
DB_CONFIG = {
    "host": "192.168.80.67",
    "port": "5432",
    "user": "navneet",
    "password": "Navn@98765",
    "database": "Grewdb"
}

# Paths based on user request
XLSB_PATH = os.path.abspath(os.path.join(os.getcwd(), "..", "..", "Analytics", "revenue.xlsb"))
SHEET_NAME = "revenue"
TABLE_NAME = 'public.revenue'

# DuckDB related (for information/verification)
DUCKDB_EXE = os.path.abspath(os.path.join(os.getcwd(), "..", "..", "..", "..", "GrewAnalytics", "duckdb.exe"))
DUCKDB_FILE = os.path.abspath(os.path.join(os.getcwd(), "..", "..", "..", "..", "GrewAnalytics", "warehouse.duckdb"))

# Original Column Names (excluding Qty which is renamed to SalesQty)
COLUMNS = [
    "Invoice date", "Invoice Type", "Invoice No", "Cust_code", "Cust_name",
    "WP", "Brand Code", "Mat Desc", "SalesQty", "UnitPrice ₹", "Value",
    "Invoice value", "UOM", "Plant", "Storage Location", "Vehicle No.",
    "S.O.Number", "Incoterms", "Invoice Status", "Segment", "MW",
    "Month", "Year", "Week", "Time Index", "Month2", "tag", "Revenue",
    "Sales Head", "EWAY BILL DATE.", "EWAY Expiry"
]

def migrate():
    print(f"--- Starting Migration ---")
    print(f"Source: {XLSB_PATH}")
    print(f"Target Table: {TABLE_NAME}")

    if not os.path.exists(XLSB_PATH):
        print(f"ERROR: File not found at {XLSB_PATH}")
        return

    try:
        # Load Excel Binary (XLSB)
        print(f"Reading worksheet '{SHEET_NAME}' from XLSB...")
        df = pd.read_excel(XLSB_PATH, sheet_name=SHEET_NAME, engine='pyxlsb')
        
        # Rename Qty to SalesQty as requested
        if 'Qty' in df.columns:
            print("Renaming 'Qty' to 'SalesQty'...")
            df.rename(columns={'Qty': 'SalesQty'}, inplace=True)
        elif 'SalesQty' not in df.columns:
            print("WARNING: Neither 'Qty' nor 'SalesQty' found in sheet columns!")

        # Filter to requested columns only
        available_cols = [c for c in COLUMNS if c in df.columns]
        missing_cols = [c for c in COLUMNS if c not in df.columns]
        if missing_cols:
            print(f"WARNING: Missing columns in source: {missing_cols}")
        
        df = df[available_cols]

        # Data Cleaning
        if "Invoice date" in df.columns:
            # Excel date origin: 1899-12-30. XLSB returns these as floats/ints.
            # Convert numeric serials to datetime
            df["Invoice date"] = pd.to_numeric(df["Invoice date"], errors='coerce')
            df["Invoice date"] = pd.to_datetime(df["Invoice date"], unit='D', origin='1899-12-30', errors='coerce').dt.date

        # Clean strings
        for col in df.columns:
            if df[col].dtype == "object":
                df[col] = df[col].apply(lambda x: str(x).strip() if x is not None and not pd.isna(x) else x)

        # Handle Numeric types (Bigint safety)
        numeric_cols = ["SalesQty", "UnitPrice ₹", "Value", "Invoice value"]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                df[col] = df[col].round(0).fillna(0).astype(int)

        # Replace NaN for SQL NULL
        df = df.where(pd.notnull(df), None)
        
        data = [tuple(x) for x in df.values]

        # Database Operations
        print(f"Connecting to Postgres at {DB_CONFIG['host']}...")
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # 1. Drop the existing table
        print(f"Dropping table {TABLE_NAME}...")
        cur.execute(f"DROP TABLE IF EXISTS {TABLE_NAME} CASCADE;")

        # 2. Recreate the table with same data types (inferring SalesQty as bigint)
        # Note: We use the columns actually found in the source
        create_cols = []
        for col in available_cols:
            if col in ["SalesQty", "UnitPrice ₹", "Value", "Invoice value"]:
                col_type = "BIGINT"
            elif col == "Invoice date":
                col_type = "DATE"
            else:
                col_type = "CHARACTER VARYING"
            create_cols.append(f'"{col}" {col_type}')
        
        create_query = f"CREATE TABLE {TABLE_NAME} ({', '.join(create_cols)});"
        print(f"Creating table: {create_query}")
        cur.execute(create_query)

        # 3. Insert new data
        quoted_cols = [f'"{col}"' for col in available_cols]
        cols_str = ", ".join(quoted_cols)
        
        print(f"Inserting {len(data)} rows...")
        extras.execute_values(cur, f"INSERT INTO {TABLE_NAME} ({cols_str}) VALUES %s", data)

        conn.commit()
        print("SUCCESS: Postgres migration complete.")

    except Exception as e:
        print(f"FATAL ERROR: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

    # Verification of DuckDB paths
    print(f"\n--- Resource Verification ---")
    print(f"DuckDB Exe exists: {os.path.exists(DUCKDB_EXE)} ({DUCKDB_EXE})")
    print(f"DuckDB File exists: {os.path.exists(DUCKDB_FILE)} ({DUCKDB_FILE})")

if __name__ == "__main__":
    migrate()
