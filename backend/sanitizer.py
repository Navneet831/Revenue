import math
import re
from datetime import datetime

def build_key_map(row: dict) -> dict:
    def normalize(k: str) -> str:
        return re.sub(r'[^a-zA-Z0-9]', '', k).lower()

    row_keys = list(row.keys())
    normalized_row_keys = {normalize(k): k for k in row_keys}

    def find(target: str, default: str) -> str:
        norm_target = normalize(target)
        return normalized_row_keys.get(norm_target, default)

    return {
        'segment': find('Segment', 'Segment'),
        'invoicedate': find('Invoice date', 'Invoice date'),
        'revenue': find('Revenue', 'Revenue'),
        'saleshead': find('Sales Head', 'Sales Head'),
        'values': find('Taxable Value', 'Taxable Value'),
        'qty': find('SalesQty', 'SalesQty'),
        'mw': find('MW', 'MW'),
        'unitprice': find('UnitPrice', 'UnitPrice'),
        'custname': find('Cust_name', 'Cust_name'),
        'wp': find('Module WP', 'Module WP'),
        'invoiceNo': find('Invoice No', 'Invoice No'),
        'invoiceType': find('Invoice Type', 'Invoice Type'),
        'custCode': find('Cust_code', 'Cust_code'),
        'materialCode': find('Material Code', 'Material Code'),
        'matDesc': find('Mat Desc', 'Mat Desc'),
        'hsn': find('HSN CODE/SAC Code', 'HSN CODE/SAC Code'),
        'cgst': find('CGST Amount', 'CGST Amount'),
        'sgst': find('SGST Amount', 'SGST Amount'),
        'igst': find('IGST Amount', 'IGST Amount'),
        'netValue': find('Net Value', 'Net Value'),
        'uom': find('UOM', 'UOM'),
        'plant': find('Plant', 'Plant'),
        'sloc': find('Storage Location', 'Storage Location'),
        'vehicleNo': find('Vehicle No.', 'Vehicle No.'),
        'soNumber': find('S.O.Number', 'S.O.Number'),
        'incoterms': find('Incoterms', 'Incoterms'),
        'invoiceStatus': find('Invoice Status', 'Invoice Status'),
        'ewayExpiry': find('Eway Expiry', 'Eway Expiry'),
    }

def format_date(d: datetime) -> str:
    return d.strftime('%Y-%m-%d')

def parse_fy(month_idx: int, year: int) -> str:
    if month_idx >= 3:
        return f"{year}-{str(year + 1)[2:]}"
    else:
        return f"{year - 1}-{str(year)[2:]}"

def get_fy_start(date_str: str) -> str:
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    if dt.month >= 4:
        return f"{dt.year}-04-01"
    else:
        return f"{dt.year - 1}-04-01"

def sanitize(row: dict, key_map: dict) -> dict | None:
    dt = row.get(key_map['invoicedate'])
    if not isinstance(dt, datetime):
        try:
            if dt is None:
                return None
            dt = datetime.fromisoformat(str(dt))
        except (ValueError, TypeError):
            return None

    month_idx = dt.month - 1
    year = dt.year
    day = dt.day
    
    val = float(row.get(key_map['values']) or 0)
    qty = float(row.get(key_map['qty']) or 0)
    mw = float(row.get(key_map['mw']) or 0)
    unit_price = float(row.get(key_map['unitprice']) or 0)
    
    wp_raw = row.get(key_map['wp'])
    if wp_raw is not None:
        try:
            wp_str = str(round(float(wp_raw)))
        except (ValueError, TypeError):
            wp_str = str(wp_raw)
    else:
        wp_str = 'Generic'
        
    rev_status = str(row.get(key_map['revenue']) or '').lower()
    
    return {
        'date': dt,
        'monthIdx': month_idx,
        'year': year,
        'monthKey': dt.strftime('%Y-%m'),
        'day': day,
        'week': min(math.ceil(day / 7), 5),
        'val': val,
        'qty': qty,
        'mw': mw,
        'unitPrice': unit_price,
        'segment': str(row.get(key_map['segment']) or 'Unknown'),
        'salesHead': str(row.get(key_map['saleshead']) or 'Direct/Unmapped'),
        'customer': str(row.get(key_map['custname']) or 'Unidentified'),
        'wp': wp_str,
        'revenueStatus': rev_status,
        'isPending': 'pending' in rev_status,
        'invoiceNo': row.get(key_map['invoiceNo']),
        'invoiceType': row.get(key_map['invoiceType']),
        'custCode': row.get(key_map['custCode']),
        'materialCode': row.get(key_map['materialCode']),
        'matDesc': row.get(key_map['matDesc']),
        'hsn': row.get(key_map['hsn']),
        'cgst': row.get(key_map['cgst']),
        'sgst': row.get(key_map['sgst']),
        'igst': row.get(key_map['igst']),
        'netValue': row.get(key_map['netValue']),
        'uom': row.get(key_map['uom']),
        'plant': row.get(key_map['plant']),
        'sloc': row.get(key_map['sloc']),
        'vehicleNo': row.get(key_map['vehicleNo']),
        'soNumber': row.get(key_map['soNumber']),
        'incoterms': row.get(key_map['incoterms']),
        'invoiceStatus': row.get(key_map['invoiceStatus']),
        'ewayExpiry': row.get(key_map['ewayExpiry'])
    }
