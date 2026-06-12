import pandas as pd
import duckdb
import os
import shutil
import traceback

# Configurable paths
xlsb_path = r"..\..\..\Analytics\revenue.xlsb"
db_path = r"..\..\..\..\..\GrewAnalytics\warehouse.duckdb"
temp_xlsb_path = "revenue_temp.xlsb"

try:
    print(f"Creating temporary copy of {xlsb_path}...")
    shutil.copy2(xlsb_path, temp_xlsb_path)

    print(f"Connecting to DuckDB: {db_path}")
    con = duckdb.connect(db_path)

    # Drop existing tables
    print("Dropping existing tables if they exist...")
    con.execute("DROP TABLE IF EXISTS revenue")
    con.execute("DROP TABLE IF EXISTS salesgl")

    print("Opening Excel file...")
    with pd.ExcelFile(temp_xlsb_path, engine="pyxlsb") as xl:
        sheets = xl.sheet_names
        print(f"Available sheets: {sheets}")
        
        # Find sheets (case-insensitive)
        revenue_sheet = next((s for s in sheets if s.strip().lower() == "revenue"), None)
        salesgl_sheet = next((s for s in sheets if s.strip().lower() == "salesgl"), None)

        if not revenue_sheet:
            raise ValueError(f"Sheet 'revenue' not found in {sheets}")
        if not salesgl_sheet:
            raise ValueError(f"Sheet 'salesgl' not found in {sheets}")

        # Load 'revenue' worksheet
        print(f"Loading worksheet '{revenue_sheet}' (columns A:AL)...")
        df_revenue = xl.parse(revenue_sheet, usecols="A:AL")
        con.execute("CREATE TABLE revenue AS SELECT * FROM df_revenue")
        print(f"Loaded {len(df_revenue)} rows into table 'revenue'.")

        # Load 'salesgl' worksheet
        print(f"Loading worksheet '{salesgl_sheet}'...")
        df_salesgl = xl.parse(salesgl_sheet)
        con.execute("CREATE TABLE salesgl AS SELECT * FROM df_salesgl")
        print(f"Loaded {len(df_salesgl)} rows into table 'salesgl'.")

    con.close()
    print("Revenue and Sales GL loading complete.")

except Exception as e:
    print(f"Error occurred: {e}")
    traceback.print_exc()
    exit(1)

finally:
    if os.path.exists(temp_xlsb_path):
        print(f"Removing temporary file {temp_xlsb_path}...")
        try:
            os.remove(temp_xlsb_path)
        except Exception as e:
            print(f"Could not remove temporary file: {e}")
