Postgres connection:
load rest. PG_HOST = "192.168.80.67"
PG_PORT = "5432"
PG_USER = "Navneet"
PG_PASSWORD = "Navn@98765"
PG_DATABASE = "GrewDB"
 
DB connection: "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 192.168.80.67 -p 5432 -U navneet -d Grewdb

Grewdb=> \d revenue
                        Table "public.revenue"
      Column      |       Type        | Collation | Nullable | Default
------------------+-------------------+-----------+----------+---------
 Invoice date     | date              |           |          |
 Invoice Type     | character varying |           |          |
 Invoice No       | character varying |           |          |
 Cust_code        | character varying |           |          |
 Cust_name        | character varying |           |          |
 WP               | character varying |           |          |
 Brand Code       | character varying |           |          |
 Mat Desc         | character varying |           |          |
 Qty              | bigint            |           |          |
 UnitPrice ₹      | bigint            |           |          |
 Value            | bigint            |           |          |
 Invoice value    | bigint            |           |          |
 UOM              | character varying |           |          |
 Plant            | character varying |           |          |
 Storage Location | character varying |           |          |
 Vehicle No.      | character varying |           |          |
 S.O.Number       | character varying |           |          |
 Incoterms        | character varying |           |          |
 Invoice Status   | character varying |           |          |
 Segment          | character varying |           |          |
 MW               | character varying |           |          |
 Month            | character varying |           |          |
 Year             | character varying |           |          |
 Week             | character varying |           |          |
 Time Index       | character varying |           |          |
 Month2           | character varying |           |          |
 tag              | character varying |           |          |
 Revenue          | character varying |           |          |
 Sales Head       | character varying |           |          |
 EWAY BILL DATE.  | character varying |           |          |
 EWAY Expiry      | character varying |           |          |

