DB:"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 80.225.203.238 -p 5432 -U navneet -d Grewdb
DB2:"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5433 -U navneet -d Grewdb
DB3:"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 192.168.80.67 -p 5432 -U navneet -d Grewdb
PSWD:Navn@98765


| Column            | Current Type     | Recommendation                 | Reason                                                                                   |

| ----------------- | ---------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |

| Invoice date      | timestamp        | ✅ Good                         | Correct if time is stored. Otherwise use `date`.                                         |

| Invoice Type      | text             | ✅ Good                         |                                                                                          |

| Invoice No        | double precision | ❌ text                         | Invoice numbers are identifiers, not numbers. They may contain leading zeros or letters. |

| Cust\_code         | double precision | ❌ text                         | Customer codes are identifiers.                                                          |

| Cust\_name         | text             | ✅ Good                         |                                                                                          |

| Module WP         | double precision | ⚠️ text                        | SKU/material codes should almost always be text.                                         |

| Material Code     | text             | ✅ Good                         |                                                                                          |

| Mat Desc          | text             | ✅ Good                         |                                                                                          |

| HSN CODE/SAC Code | double precision | ❌ text                         | HSN/SAC codes are codes, not numeric values.                                             |

| SalesQty          | double precision | ⚠️ numeric(18,4)               | Better precision than floating point.                                                    |

| UnitPrice         | double precision | ⚠️ numeric(18,2)               | Currency should use NUMERIC.                                                             |

| Taxable Value     | double precision | ⚠️ numeric(18,2)               | Currency should use NUMERIC.                                                             |

| CGST%             | double precision | ⚠️ numeric(5,2)                | Percentage.                                                                              |

| IGST%             | double precision | ⚠️ numeric(5,2)                | Percentage.                                                                              |

| SGST%             | double precision | ⚠️ numeric(5,2)                | Percentage.                                                                              |

| CGST Amount       | double precision | ⚠️ numeric(18,2)               | Currency.                                                                                |

| SGST Amount       | double precision | ⚠️ numeric(18,2)               | Currency.                                                                                |

| IGST Amount       | double precision | ⚠️ numeric(18,2)               | Currency.                                                                                |

| Net Value         | double precision | ⚠️ numeric(18,2)               | Currency.                                                                                |

| UOM               | text             | ✅ Good                         |                                                                                          |

| Plant             | double precision | ⚠️ integer or text             | Plant codes aren't measurements.                                                         |

| Storage Location  | double precision | ⚠️ text                        | Storage locations are codes.                                                             |

| Vehicle No.       | text             | ✅ Good                         |                                                                                          |

| S.O.Number        | double precision | ❌ text                         | Sales order numbers are identifiers.                                                     |

| Incoterms         | text             | ✅ Good                         |                                                                                          |

| Invoice Status    | text             | ✅ Good                         |                                                                                          |

| Sales Head        | text             | ✅ Good                         |                                                                                          |

| EWAY BILL DATE.   | text             | ❌ date                         | Should be stored as a date.                                                              |

| MW                | double precision | ⚠️ numeric(12,3)               | If this is megawatts.                                                                    |

| Segment           | text             | ✅ Good                         |                                                                                          |

| Month             | bigint           | ⚠️ smallint                    | Only values 1–12.                                                                        |

| Year              | text             | ✅ text 	| Fine if storing financial year.                                                          |

| Week              | text             |✅ text                                                                                         |

| Time Index        | bigint           | ⚠️ integer                                                                                   |

| Month2            | timestamp        | ⚠️ text                        |                                                       |

| tag               | text             | ✅ Good                         |                                                                                          |

| Revenue           | text             |  ✅text                                                                              |

| Eway Expiry       | text             | ❌ date                         | Should be a date.                                                                        |



