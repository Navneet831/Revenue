import pandas as pd
import duckdb
import os

# --- CONFIGURATION ---
XLSB_PATH = r'D:\OneDrive - CHIRIPAL RENEWABLE ENERGY PRIVATE LIMITED\Desktop\Analytics\revenue.xlsb'
DUCKDB_PATH = r'D:\GrewAnalytics\warehouse.duckdb'
SHEET_NAME = 'revenue'
TABLE_NAME = 'revenue'

def update_duckdb():
    print(f"--- Starting DuckDB Update ---")
    print(f"Source: {XLSB_PATH}")
    print(f"Target DuckDB: {DUCKDB_PATH}")

    if not os.path.exists(XLSB_PATH):
        print(f"ERROR: XLSB file not found at {XLSB_PATH}")
        return

    try:
        # 1. Load data from XLSB
        print(f"Reading worksheet '{SHEET_NAME}' from XLSB...")
        df = pd.read_excel(XLSB_PATH, sheet_name=SHEET_NAME, engine='pyxlsb')
        
        # 2. Rename Qty to SalesQty (keeping consistency with Postgres)
        if 'Qty' in df.columns:
            print("Renaming 'Qty' to 'SalesQty'...")
            df.rename(columns={'Qty': 'SalesQty'}, inplace=True)

        # 3. Fix Dates
        if 'Invoice date' in df.columns:
            print("Converting Excel serial dates...")
            df['Invoice date'] = pd.to_numeric(df['Invoice date'], errors='coerce')
            df['Invoice date'] = pd.to_datetime(df['Invoice date'], unit='D', origin='1899-12-30', errors='coerce')

        # 4. Clean Numeric Types (matching Postgres bigint logic)
        numeric_cols = ["SalesQty", "UnitPrice ₹", "Value", "Invoice value"]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').round(0).fillna(0).astype('int64')

        # 5. Connect to DuckDB
        print(f"Connecting to DuckDB...")
        # Note: duckdb.connect creates the file if it doesn't exist
        conn = duckdb.connect(DUCKDB_PATH)

        # 6. Drop and Reload
        print(f"Dropping table '{TABLE_NAME}' if exists...")
        conn.execute(f"DROP TABLE IF EXISTS {TABLE_NAME}")

        # 7. Create and Insert (DuckDB can register a DF as a virtual table)
        print(f"Loading {len(df)} rows into DuckDB...")
        # We'll create the table directly from the dataframe
        conn.execute(f"CREATE TABLE {TABLE_NAME} AS SELECT * FROM df")

        # 8. Verification
        res = conn.execute(f"SELECT COUNT(*), MAX(\"Invoice date\") FROM {TABLE_NAME}").fetchone()
        print(f"SUCCESS: DuckDB updated.")
        print(f"Final Count: {res[0]}")
        print(f"Max Date: {res[1]}")

    except Exception as e:
        print(f"FATAL ERROR: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    update_duckdb()
