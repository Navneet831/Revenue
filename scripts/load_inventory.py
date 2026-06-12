import pandas as pd
import duckdb
import os
import shutil
import traceback

# Configurable paths
xlsb_path = r"..\..\..\Analytics\revenue.xlsb"
db_path = r"..\..\..\..\..\GrewAnalytics\warehouse.duckdb"
temp_xlsb_path = "inventory_temp_save.xlsb"

def process_inventory_sheet(xl, sheet_name, value_name):
    print(f"Processing sheet: {sheet_name}")
    df = xl.parse(sheet_name)
    
    # Identifier columns (Material, Desc, Type, Group, WP)
    id_vars_indices = [1, 2, 3, 4, 5]
    date_start_index = 7
    
    # Data excluding header row
    data = df.iloc[1:].copy()
    
    # Select column names
    id_cols = [df.columns[i] for i in id_vars_indices]
    date_cols = [df.columns[i] for i in range(date_start_index, len(df.columns))]
    
    # Unpivot (Melt)
    melted = data.melt(id_vars=id_cols, value_vars=date_cols, var_name='temp_date_col', value_name='temp_val_col')
    
    # Map back to actual dates from row 0
    date_mapping = {df.columns[i]: str(df.iloc[0, i]) for i in range(date_start_index, len(df.columns))}
    melted['Date'] = melted['temp_date_col'].map(date_mapping)
    
    # Rename and reorder
    melted.columns = ['Material', 'Material_Description', 'Material_Type', 'Material_Group', 'WP', 'temp_date_col', value_name, 'Date']
    return melted[['Material', 'Material_Description', 'Material_Type', 'Material_Group', 'WP', 'Date', value_name]]

try:
    print(f"Creating temporary copy of {xlsb_path}...")
    shutil.copy2(xlsb_path, temp_xlsb_path)

    print(f"Connecting to DuckDB: {db_path}")
    con = duckdb.connect(db_path)

    print("Opening Excel file...")
    with pd.ExcelFile(temp_xlsb_path, engine="pyxlsb") as xl:
        # Load sheets from workbook list
        df_amount = process_inventory_sheet(xl, 'Cl. Inventory Amount', 'Amount')
        df_quantity = process_inventory_sheet(xl, 'Cl. Inventory Q', 'Quantity')

        print("Merging Amount and Quantity data...")
        df_merged = pd.merge(df_amount, df_quantity, on=['Material', 'Material_Description', 'Material_Type', 'Material_Group', 'WP', 'Date'], how='outer')

        print("Dropping existing table 'mb5bd' if it exists...")
        con.execute("DROP TABLE IF EXISTS mb5bd")

        print("Creating table 'mb5bd'...")
        con.execute("CREATE TABLE mb5bd AS SELECT * FROM df_merged")
        
        row_count = con.execute("SELECT count(*) FROM mb5bd").fetchone()[0]
        print(f"Successfully loaded {row_count} rows into 'mb5bd'.")

    con.close()
    print("Inventory loading complete.")

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
