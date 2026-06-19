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

const MIN_DATE_SERIAL = 44929; // Day after company DOI 2022-12-25

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
        (DATE '1899-12-30' + "Invoice date" * INTERVAL '1 day')::date AS "Invoice date",
        "Invoice No", "Invoice Type", "Cust_code", "Cust_name",
        "Segment", "Sales Head", "Module WP", "Material Code",
        "Mat Desc", "HSN CODE/SAC Code", "SalesQty", "UnitPrice",
        "Taxable Value", "CGST Amount", "SGST Amount", "IGST Amount",
        "Net Value", "UOM", "Plant", "Storage Location", "Vehicle No.",
        "S.O.Number", "Incoterms", "Invoice Status", "Revenue", "Eway Expiry",
        "MW"
      FROM public.revenue
      WHERE "Invoice date" > ${MIN_DATE_SERIAL}
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
