import postgres from "npm:postgres@3";

const REQUIRED_SECRETS = [
  "PG_HOST",
  "PG_PORT",
  "PG_USER",
  "PG_PASSWORD",
  "PG_DATABASE",
] as const;

type SecretKey = (typeof REQUIRED_SECRETS)[number];

function loadDbCredentials(): Record<SecretKey, string> {
  const missing: string[] = [];
  const values = {} as Record<SecretKey, string>;

  for (const key of REQUIRED_SECRETS) {
    const value = Deno.env.get(key);
    if (!value) {
      missing.push(key);
    } else {
      values[key] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required Edge Function secrets: ${missing.join(", ")}. ` +
        "Set them via: supabase secrets set <KEY>=<VALUE>"
    );
  }

  return values;
}

// Initialise once per cold-start — secrets are validated at module load so a
// misconfigured deployment fails immediately rather than on the first request.
const credentials = loadDbCredentials();

const sql = postgres({
  host: credentials.PG_HOST,
  port: Number(credentials.PG_PORT),
  user: credentials.PG_USER,
  password: credentials.PG_PASSWORD,
  database: credentials.PG_DATABASE,
  ssl: "prefer",
  max: 5,
  connect_timeout: 10,
});

const MIN_DATE = '2022-12-25'; // Day before company DOI

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const rows = await sql`
      SELECT
        invoice_date,
        invoice_no, invoice_type, cust_code, cust_name,
        segment, sales_head, module_wp, material_code,
        mat_desc, hsn_code_sac_code, sales_qty, unit_price,
        taxable_value, cgst_amount, sgst_amount, igst_amount,
        net_value, uom, plant, storage_location, vehicle_no,
        so_number, incoterms, invoice_status, revenue, eway_expiry,
        mw
      FROM revenue.revenue
      WHERE invoice_date > ${MIN_DATE}
    `;

    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
