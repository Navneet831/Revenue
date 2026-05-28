import psycopg2
import pandas as pd
from psycopg2 import extras

# Database Connection Details
DB_CONFIG = {
    "host": "192.168.80.67",
    "port": "5432",
    "user": "navneet",
    "password": "Navn@98765",
    "database": "Grewdb"
}

def migrate_csv_to_pg(csv_path):
    print(f"Reading CSV: {csv_path}...")
    # Read CSV with pandas to handle bigint and dates correctly
    df = pd.read_csv(csv_path)
    
    # Pre-processing
    if "Invoice date" in df.columns:
        df["Invoice date"] = pd.to_datetime(df["Invoice date"]).dt.date
    
    # Round bigint columns
    bigint_cols = ["Qty", "UnitPrice ₹", "Value", "Invoice value"]
    for col in bigint_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).round(0).astype('Int64')
    
    # Handle NaNs
    df = df.where(pd.notnull(df), None)
    
    columns = list(df.columns)
    data = [tuple(x) for x in df.values]
    
    print(f"Connecting to Postgres...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Drop table if exists (already done but safe)
        cur.execute("DROP TABLE IF EXISTS public.revenue")
        
        # Create table
        create_query = 'CREATE TABLE public.revenue ('
        col_defs = []
        for col in columns:
            if col == "Invoice date":
                col_defs.append(f'"{col}" date')
            elif col in bigint_cols:
                col_defs.append(f'"{col}" bigint')
            else:
                col_defs.append(f'"{col}" varchar')
        create_query += ", ".join(col_defs) + ")"
        
        print("Recreating table...")
        cur.execute(create_query)
        
        # Bulk Insert
        quoted_cols = [f'"{col}"' for col in columns]
        cols_str = ", ".join(quoted_cols)
        
        print(f"Inserting {len(data)} rows...")
        extras.execute_values(cur, f"INSERT INTO public.revenue ({cols_str}) VALUES %s", data)
        
        conn.commit()
        print("Migration from CSV completed successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    migrate_csv_to_pg("revenue_export.csv")
