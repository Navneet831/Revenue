"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5433 -U navneet -d Grewdb   # password: set via the PGPASSWORD env var

Grewdb=# \d revenue
                              Table "public.revenue"
      Column       |            Type             | Collation | Nullable | Default
-------------------+-----------------------------+-----------+----------+---------
 Invoice date      | timestamp without time zone |           |          |
 Invoice Type      | text                        |           |          |
 Invoice No        | double precision            |           |          |
 Cust_code         | double precision            |           |          |
 Cust_name         | text                        |           |          |
 Module WP         | double precision            |           |          |
 Material Code     | text                        |           |          |
 Mat Desc          | text                        |           |          |
 HSN CODE/SAC Code | double precision            |           |          |
 SalesQty          | double precision            |           |          |
 UnitPrice         | double precision            |           |          |
 Taxable Value     | double precision            |           |          |
 CGST%             | double precision            |           |          |
 IGST%             | double precision            |           |          |
 SGST%             | double precision            |           |          |
 CGST Amount       | double precision            |           |          |
 SGST Amount       | double precision            |           |          |
 IGST Amount       | double precision            |           |          |
 Net Value         | double precision            |           |          |
 UOM               | text                        |           |          |
 Plant             | double precision            |           |          |
 Storage Location  | double precision            |           |          |
 Vehicle No.       | text                        |           |          |
 S.O.Number        | double precision            |           |          |
 Incoterms         | text                        |           |          |
 Invoice Status    | text                        |           |          |
 Sales Head        | text                        |           |          |
 EWAY BILL DATE.   | text                        |           |          |
 MW                | double precision            |           |          |
 Segment           | text                        |           |          |
 Month             | bigint                      |           |          |
 Year              | text                        |           |          |
 Week              | text                        |           |          |
 Time Index        | bigint                      |           |          |
 Month2            | timestamp without time zone |           |          |
 tag               | text                        |           |          |
 Revenue           | text                        |           |          |
 Eway Expiry       | text                        |           |          |
Indexes:
    "ix_revenue_invoice_date" btree ("Invoice date")
    "ix_revenue_segment" btree ("Segment")

Below is a **Skill.md** specification you can give to Claude Code, Gemini CLI, Cursor, Windsurf, or any AI coding agent to implement a **SKU-wise Temporal Entropy Engine** from your Sales Register.

---

# Skill: SKU Wise Temporal Entropy Analysis

## Objective

Calculate **Temporal Entropy** for each SKU (`Module WP`) to measure how predictable or unpredictable demand is over time.

This metric helps classify SKUs into:

| Entropy Level | Interpretation              |
| ------------- | --------------------------- |
| Low           | Stable demand               |
| Medium        | Seasonal / cyclical demand  |
| High          | Erratic demand              |
| Very High     | Highly unpredictable demand |

The analysis should work for any selected FY.

---

# Data Source

Sales Register Table

## Required Columns

| Column       | Purpose                |
| ------------ | ---------------------- |
| Module WP    | SKU identifier         |
| Invoice date | Transaction Date       |
| SalesQty     | Quantity Sold          |
| Revenue      | Sales Value            |
| Year         | Financial Year         |
| Month        | Monthly aggregation    |
| Week         | Weekly aggregation     |
| Time Index   | Sequential time bucket |

---

# Business Logic

## Step 1: Create Time Series

Aggregate SKU demand by month.

Example:

| Time Index | Month  | SKU   | Qty |
| ---------- | ------ | ----- | --- |
| 1          | Apr-25 | SKU-A | 120 |
| 2          | May-25 | SKU-A | 80  |
| 3          | Jun-25 | SKU-A | 0   |
| 4          | Jul-25 | SKU-A | 250 |

Missing months must be filled with zero.

---

## Step 2: Convert into Probability Distribution

For a SKU:

Total FY Quantity:

[
Q = \sum Qty_t
]

Probability:

[
P_t = \frac{Qty_t}{Q}
]

Example:

| Month | Qty | Probability |
| ----- | --- | ----------- |
| Apr   | 120 | 0.24        |
| May   | 80  | 0.16        |
| Jun   | 0   | 0           |
| Jul   | 250 | 0.50        |

---

## Step 3: Calculate Shannon Temporal Entropy

[
H = - \sum P_t \log_2(P_t)
]

Ignore periods where:

[
P_t = 0
]

---

## Step 4: Normalize Entropy

Maximum possible entropy:

[
H_{max} = \log_2(N)
]

Where:

N = number of time periods

Monthly FY:

[
N = 12
]

Normalized Entropy:

[
H_{norm} = \frac{H}{H_{max}}
]

Range:

[
0 \le H_{norm} \le 1
]

---

# Interpretation Framework

## Stable SKU

[
H_{norm} < 0.30
]

Demand concentrated in few months.

Example:

| Month | Qty  |
| ----- | ---- |
| Apr   | 0    |
| May   | 0    |
| Jun   | 1000 |
| Rest  | 0    |

---

## Seasonal SKU

[
0.30 \le H_{norm} < 0.60
]

Demand concentrated in a season.

---

## Moderate SKU

[
0.60 \le H_{norm} < 0.80
]

Reasonably distributed demand.

---

## Highly Unstable SKU

[
H_{norm} \ge 0.80
]

Demand spread randomly across months.

---

# Additional Metrics

Calculate:

## Coefficient of Variation

[
CV = \frac{\sigma}{\mu}
]

Where:

* σ = Standard Deviation
* μ = Mean Demand

---

## ADI

Average Demand Interval

[
ADI = \frac{TotalPeriods}{NonZeroPeriods}
]

---

## Revenue Weighted Entropy

Use Revenue instead of Quantity:

[
P_t = Revenue_t / TotalRevenue
]

[
Entropy_{Revenue}
=================

-\sum P_t \log_2(P_t)
]

---

# ABC + Temporal Entropy Matrix

Create classification:

| ABC | Entropy | Meaning               |
| --- | ------- | --------------------- |
| A   | Low     | Strategic Core SKU    |
| A   | High    | Critical Volatile SKU |
| B   | Low     | Stable Mid-Tier       |
| B   | High    | Risky Mid-Tier        |
| C   | Low     | Niche Stable          |
| C   | High    | Dead/Erratic SKU      |

---

# Output Table

| Module WP | FY Qty | FY Revenue | Entropy | Normalized Entropy | CV   | ADI  | Non Zero Months | Class           |
| --------- | ------ | ---------- | ------- | ------------------ | ---- | ---- | --------------- | --------------- |
| SKU001    | 12,500 | 45,00,000  | 2.51    | 0.70               | 0.82 | 1.25 | 10              | Moderate        |
| SKU002    | 5,400  | 18,00,000  | 0.90    | 0.25               | 2.30 | 6.00 | 2               | Stable          |
| SKU003    | 8,100  | 25,00,000  | 3.30    | 0.92               | 1.60 | 1.10 | 11              | Highly Unstable |

---

# Visualizations

## 1. Entropy Distribution

Histogram of SKU entropy.

---

## 2. CV vs Entropy Scatter

X-axis:

Entropy

Y-axis:

CV

Bubble Size:

Revenue

---

## 3. ABC vs Entropy Heatmap

Rows:

ABC Class

Columns:

Entropy Bucket

Values:

Revenue Contribution

---

## 4. SKU Temporal Pattern

For selected SKU:

* Monthly Sales Trend
* Entropy
* CV
* ADI

---

# SQL (Postgress)

```sql
WITH monthly_sales AS (
    SELECT
        "Module WP",
        "Time Index",
        SUM("SalesQty") AS qty
    FROM sales_register
    WHERE "Year" = ?
    GROUP BY 1,2
),

sku_total AS (
    SELECT
        "Module WP",
        SUM(qty) AS total_qty
    FROM monthly_sales
    GROUP BY 1
),

probability AS (
    SELECT
        m."Module WP",
        m."Time Index",
        qty / NULLIF(total_qty,0) AS p
    FROM monthly_sales m
    JOIN sku_total s
      ON m."Module WP" = s."Module WP"
)

SELECT
    "Module WP",
    -SUM(
        CASE
            WHEN p > 0
            THEN p * LOG2(p)
            ELSE 0
        END
    ) AS entropy
FROM probability
GROUP BY 1;
```

---

For your industrial products business, I would also add **Demand Pattern Classification (Smooth, Intermittent, Erratic, Lumpy)** using **ADI + CV²**, because entropy alone doesn't distinguish a seasonal SKU from a genuinely lumpy spare-part SKU. Combining **Entropy + ADI + CV² + ABC Revenue Ranking** gives a much stronger SKU segmentation framework for inventory planning and forecasting.
