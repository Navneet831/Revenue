import pandas as pd
import psycopg2
from psycopg2 import extras
import sys
import os
import requests
import io

# Database Connection Details
DB_CONFIG = {
    "host": "192.168.80.67",
    "port": "5432",
    "user": "navneet",
    "password": "Navn@98765",
    "database": "Grewdb"
}

# Google Sheet Details
DEFAULT_SHEET_ID = "151X0rOK6m66mxkqi3d7g-9Df50132QBy"

# Table Name
TABLE_NAME = 'public.revenue'

# Column Mapping (Excel Column Name -> DB Column Name)
# Update this mapping if your Excel column names differ from the DB column names
COLUMNS = [
    "Invoice date", "Invoice Type", "Invoice No", "Cust_code", "Cust_name",
    "WP", "Brand Code", "Mat Desc", "Qty", "UnitPrice ₹", "Value",
    "Invoice value", "UOM", "Plant", "Storage Location", "Vehicle No.",
    "S.O.Number", "Incoterms", "Invoice Status", "Segment", "MW",
    "Month", "Year", "Week", "Time Index", "Month2", "tag", "Revenue",
    "Sales Head", "EWAY BILL DATE.", "EWAY Expiry"
]

def download_google_sheet(sheet_id):
    print(f"Downloading Google Sheet: {sheet_id}...")
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"
    response = requests.get(url)
    if response.status_code == 200:
        return io.BytesIO(response.content)
    else:
        print(f"Error downloading sheet: {response.status_code}")
        return None

def migrate_data(source):
    """source can be a file path or a BytesIO object from download_google_sheet"""
    if isinstance(source, str):
        if not os.path.exists(source):
            print(f"Error: File '{source}' not found.")
            return
        print(f"Reading Excel file: {source}...")
    else:
        print("Processing downloaded data...")

    try:
        # Read the Excel file.
        df = pd.read_excel(source)
    except Exception as e:
        print(f"Error reading Excel: {e}")
        return

    # ... (rest of the processing logic)

    # Check if all required columns exist in the Excel file
    # (Optional: You can also use df.columns if you trust the Excel structure)
    missing_cols = [col for col in COLUMNS if col not in df.columns]
    if missing_cols:
        print(f"Warning: The following columns are missing in Excel: {missing_cols}")
        print("Continuing with existing columns...")
        # Filter COLUMNS to only those present in df
        actual_cols = [col for col in COLUMNS if col in df.columns]
    else:
        actual_cols = COLUMNS

    # Prepare data for insertion
    # Ensure date columns are correctly formatted
    if "Invoice date" in df.columns:
        df["Invoice date"] = pd.to_datetime(df["Invoice date"], errors='coerce').dt.date

    # Clean strings: trim whitespace
    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].apply(lambda x: str(x).strip() if x is not None and not pd.isna(x) else x)

    # Replace NaN with None for SQL NULL
    df = df.where(pd.notnull(df), None)

    # Debug: Check for extremely large values in bigint columns
    bigint_cols = ["Qty", "UnitPrice ₹", "Value", "Invoice value"]
    for col in bigint_cols:
        if col in df.columns:
            # Convert to numeric, errors='coerce' will make non-numeric None
            df[col] = pd.to_numeric(df[col], errors='coerce')
            
            # Check for values out of range
            mask = (df[col] > 9223372036854775807) | (df[col] < -9223372036854775808)
            if mask.any():
                print(f"Warning: Column '{col}' has {mask.sum()} values exceeding bigint range!")
                # Clip or set to None? Let's set to None for now to avoid crash, 
                # or maybe the user wants to know.
                df.loc[mask, col] = None
            
            # Round to nearest integer before converting to bigint
            df[col] = df[col].round(0)
            
            # Convert to object type with None for NULLs to be compatible with psycopg2
            df[col] = df[col].astype(object).where(df[col].notnull(), None)

    data = [tuple(x) for x in df[actual_cols].values]

    print(f"Connecting to database {DB_CONFIG['database']} at {DB_CONFIG['host']}...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Prepare the INSERT statement with double-quoted column names
        quoted_cols = [f'"{col}"' for col in actual_cols]
        cols_str = ", ".join(quoted_cols)
        placeholders = ", ".join(["%s"] * len(actual_cols))
        
        insert_query = f'INSERT INTO {TABLE_NAME} ({cols_str}) VALUES ({placeholders})'

        print(f"Inserting {len(data)} rows...")
        
        # Use execute_values for high-performance bulk insert
        extras.execute_values(cur, f"INSERT INTO {TABLE_NAME} ({cols_str}) VALUES %s", data)

        conn.commit()
        print("Migration completed successfully!")

    except Exception as e:
        print(f"Database Error: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # If an argument is provided, treat it as a local file path
        migrate_data(sys.argv[1])
    else:
        # Otherwise, download from Google Sheets
        sheet_data = download_google_sheet(DEFAULT_SHEET_ID)
        if sheet_data:
            migrate_data(sheet_data)
        else:
            print("Failed to acquire data.")
