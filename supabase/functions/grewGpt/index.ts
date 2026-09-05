// grewGpt edge function — Corporate NL2SQL with Semantic Layer
//
// Pipeline:
//   1. Load config + semantic layer (terms, templates, schema registry, user prefs) in parallel
//   2. Build SQL-gen prompt enriched with business glossary + allowed schema
//   3. AI picks a pre-approved template OR generates raw SQL
//   4. Validate: SELECT-only; no writes ever reach the database
//   5. Execute against Postgres with timing
//   6. Log to audit trail (grewgpt_query_log)
//   7. Generate natural-language response from live results
//
// All behaviour is configurable from the Supabase dashboard — no redeployment needed.

import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_MODEL          = "nvidia/nemotron-3.5-lightning:free";
const DEFAULT_FALLBACK_MODEL = "minimax/minimax-m3:free";
const DEFAULT_PROVIDER       = "openrouter";
const DEFAULT_TEMP           = 0.3;
const DEFAULT_MAX_TOKENS     = 2048;

// ── Types ──────────────────────────────────────────────────────────────────────

interface SemanticTerm   { term: string; sql_fragment: string; category: string; description: string }
interface QueryTemplate  { name: string; description: string; intent_keywords: string[]; sql_template: string }
interface SchemaColumn   { table_name: string; column_name: string; business_label: string; data_type: string; description: string }
interface AppConfig      { key: string; value: string }
interface UserPref       { pref_key: string; pref_value: string }

// ── Default semantic layer fallbacks ──────────────────────────────────────────

const DEFAULT_SCHEMA_COLUMNS: SchemaColumn[] = [
  { table_name: "revenue.revenue", column_name: "invoice_date", business_label: "Invoice Date", data_type: "date", description: "Date of invoice. Filter invoice_date > DATE '2022-12-25'." },
  { table_name: "revenue.revenue", column_name: "invoice_no", business_label: "Invoice Number", data_type: "text", description: "Invoice identifier." },
  { table_name: "revenue.revenue", column_name: "invoice_type", business_label: "Invoice Type", data_type: "text", description: "Type of invoice (Domestic, Export, etc.)." },
  { table_name: "revenue.revenue", column_name: "cust_code", business_label: "Customer Code", data_type: "text", description: "Customer account code." },
  { table_name: "revenue.revenue", column_name: "cust_name", business_label: "Customer Name", data_type: "text", description: "Customer or client name." },
  { table_name: "revenue.revenue", column_name: "segment", business_label: "Segment", data_type: "text", description: "Business segment (Solar Modules, EPC, DCR, Non-DCR, etc.)." },
  { table_name: "revenue.revenue", column_name: "sales_head", business_label: "Sales Head", data_type: "text", description: "Sales lead / manager name." },
  { table_name: "revenue.revenue", column_name: "module_wp", business_label: "Module Wp", data_type: "numeric", description: "Module wattage in Wp." },
  { table_name: "revenue.revenue", column_name: "material_code", business_label: "Material Code", data_type: "text", description: "Product SKU / material code." },
  { table_name: "revenue.revenue", column_name: "mat_desc", business_label: "Material Description", data_type: "text", description: "Product description." },
  { table_name: "revenue.revenue", column_name: "sales_qty", business_label: "Sales Quantity", data_type: "numeric", description: "Quantity / units sold." },
  { table_name: "revenue.revenue", column_name: "unit_price", business_label: "Unit Price", data_type: "numeric", description: "Price per unit in INR." },
  { table_name: "revenue.revenue", column_name: "taxable_value", business_label: "Taxable Value", data_type: "numeric", description: "Taxable value in INR." },
  { table_name: "revenue.revenue", column_name: "net_value", business_label: "Net Revenue Value", data_type: "numeric", description: "Total net revenue in INR. ALWAYS use net_value for revenue aggregations: ROUND(SUM(net_value)::numeric / 10000000, 2) AS revenue_cr." },
  { table_name: "revenue.revenue", column_name: "mw", business_label: "Megawatts", data_type: "numeric", description: "Solar power capacity sold in Megawatts (MW). ROUND(SUM(mw)::numeric, 2) AS total_mw." },
  { table_name: "revenue.revenue", column_name: "plant", business_label: "Plant", data_type: "text", description: "Manufacturing plant location." },
  { table_name: "revenue.revenue", column_name: "invoice_status", business_label: "Invoice Status", data_type: "text", description: "Status of invoice." }
];

const DEFAULT_SEMANTIC_TERMS: SemanticTerm[] = [
  { term: "revenue", sql_fragment: "ROUND(SUM(net_value)::numeric / 10000000, 2) AS revenue_cr", category: "metric", description: "Total net revenue in Crores (INR). Always use net_value column." },
  { term: "sales", sql_fragment: "ROUND(SUM(net_value)::numeric / 10000000, 2) AS revenue_cr", category: "metric", description: "Total revenue / sales in Crores (INR)." },
  { term: "capacity", sql_fragment: "ROUND(SUM(mw)::numeric, 2) AS total_mw", category: "metric", description: "Total capacity sold in Megawatts (MW)." },
  { term: "volume", sql_fragment: "SUM(sales_qty) AS total_qty", category: "metric", description: "Total quantity / units sold." },
  { term: "ytd", sql_fragment: "invoice_date >= '{{FY_START}}' AND invoice_date <= '{{TODAY}}'", category: "time", description: "Year-to-date for Indian Financial Year (starts April 1st)." },
  { term: "mtd", sql_fragment: "invoice_date >= '{{MTD_START}}' AND invoice_date <= '{{TODAY}}'", category: "time", description: "Month-to-date for the current month." }
];

const DEFAULT_QUERY_TEMPLATES: QueryTemplate[] = [
  { name: "total_revenue", description: "Total company revenue and MW capacity for the current financial year (YTD)", intent_keywords: ["total revenue", "overall revenue", "total sales", "ytd revenue", "company revenue"], sql_template: "SELECT ROUND(SUM(net_value)::numeric / 10000000, 2) AS revenue_cr, ROUND(SUM(mw)::numeric, 2) AS total_mw, SUM(sales_qty) AS total_units FROM revenue.revenue WHERE invoice_date >= '{{FY_START}}' AND invoice_date <= '{{TODAY}}'" },
  { name: "revenue_by_segment", description: "Revenue and MW capacity broken down by business segment for current FY", intent_keywords: ["by segment", "segment breakdown", "segment performance", "segment wise", "segments"], sql_template: "SELECT segment, ROUND(SUM(net_value)::numeric / 10000000, 2) AS revenue_cr, ROUND(SUM(mw)::numeric, 2) AS total_mw, SUM(sales_qty) AS units_sold FROM revenue.revenue WHERE invoice_date >= '{{FY_START}}' AND invoice_date <= '{{TODAY}}' GROUP BY segment ORDER BY revenue_cr DESC" },
  { name: "top_customers", description: "Top 10 customers by revenue for current FY", intent_keywords: ["top customers", "best customers", "largest clients", "top clients", "key accounts"], sql_template: "SELECT cust_name, ROUND(SUM(net_value)::numeric / 10000000, 2) AS revenue_cr, ROUND(SUM(mw)::numeric, 2) AS total_mw FROM revenue.revenue WHERE invoice_date >= '{{FY_START}}' AND invoice_date <= '{{TODAY}}' GROUP BY cust_name ORDER BY revenue_cr DESC LIMIT 10" },
  { name: "sales_head_performance", description: "Revenue and MW performance by sales head for current FY", intent_keywords: ["sales head", "sales lead", "sales person", "sales team", "team performance"], sql_template: "SELECT COALESCE(sales_head, 'Unassigned') AS sales_head, ROUND(SUM(net_value)::numeric / 10000000, 2) AS revenue_cr, ROUND(SUM(mw)::numeric, 2) AS total_mw FROM revenue.revenue WHERE invoice_date >= '{{FY_START}}' AND invoice_date <= '{{TODAY}}' GROUP BY sales_head ORDER BY revenue_cr DESC" }
];

// ── Date helpers ───────────────────────────────────────────────────────────────

function getDateParams(anchorDateStr?: string | null): Record<string, string> {
  const now = anchorDateStr ? new Date(anchorDateStr + "T00:00:00Z") : new Date();
  const today = anchorDateStr || now.toISOString().slice(0, 10);
  const fyYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const fyStart = `${fyYear}-04-01`;
  const prevFyStart = `${fyYear - 1}-04-01`;
  const mtdMonth = String(now.getUTCMonth() + 1).padStart(2, "0");
  const mtdStart = `${now.getUTCFullYear()}-${mtdMonth}-01`;

  const lastMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastMonthStart = `${lastMonthDate.getUTCFullYear()}-${String(lastMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthEndDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const lastMonthEnd = `${lastMonthEndDate.getUTCFullYear()}-${String(lastMonthEndDate.getUTCMonth() + 1).padStart(2, "0")}-${String(lastMonthEndDate.getUTCDate()).padStart(2, "0")}`;

  return {
    TODAY: today,
    FY_START: fyStart,
    PREV_FY_START: prevFyStart,
    MTD_START: mtdStart,
    LAST_MONTH_START: lastMonthStart,
    LAST_MONTH_END: lastMonthEnd,
    LATEST_DATA_DATE: today,
  };
}

function fillParams(sql: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v),
    sql
  );
}

// ── Security ───────────────────────────────────────────────────────────────────

function isSafeSelect(sql: string): boolean {
  const upper = sql.trim().toUpperCase().replace(/\s+/g, " ");
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) return false;
  if (!upper.includes(" FROM ")) return false;
  return !/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE|COPY|CALL|MERGE)\b/.test(upper);
}

function extractSQL(raw: string): string {
  const fenced = raw.match(/```(?:sql)?\s*([\s\S]+?)```/i);
  if (fenced && isSafeSelect(fenced[1])) return fenced[1].trim();

  // Match genuine WITH query: WITH ... AS (...) SELECT ... FROM ...
  const withMatch = raw.match(/\b(WITH\s+[a-zA-Z0-9_"\s,]+?\s+AS\s*\([\s\S]+?\)\s*SELECT\s+[\s\S]+?\s+FROM\s+[\s\S]+?)(?:;|\n\n(?=[A-Z])|$)/i);
  if (withMatch && isSafeSelect(withMatch[1])) return withMatch[1].trim();

  // Match genuine SELECT query: SELECT ... FROM ...
  const selectMatch = raw.match(/\b(SELECT\s+[\s\S]+?\s+FROM\s+[\s\S]+?)(?:;|\n\n(?=[A-Z])|$)/i);
  if (selectMatch && isSafeSelect(selectMatch[1])) return selectMatch[1].trim();

  return raw.trim();
}

// ── Prompt builders ────────────────────────────────────────────────────────────

function buildSchemaBlock(columns: SchemaColumn[]): string {
  const cols = columns.length ? columns : DEFAULT_SCHEMA_COLUMNS;
  const lines = cols.map(c =>
    `  "${c.column_name}" ${c.data_type.padEnd(8)} — ${c.business_label}. ${c.description}`
  );
  return `ALLOWED SCHEMA:\nTable: revenue.revenue\n${lines.join("\n")}`;
}

function buildGlossaryBlock(terms: SemanticTerm[]): string {
  const tList = terms.length ? terms : DEFAULT_SEMANTIC_TERMS;
  const lines = tList.map(t => `  "${t.term}" [${t.category}]: ${t.description}`);
  return `BUSINESS GLOSSARY:\n${lines.join("\n")}`;
}

function buildTemplateMenu(templates: QueryTemplate[]): string {
  const tList = templates.length ? templates : DEFAULT_QUERY_TEMPLATES;
  const lines = tList.map(t =>
    `  ${t.name}: ${t.description}\n    keywords: ${t.intent_keywords.join(", ")}`
  );
  return `PRE-APPROVED QUERY TEMPLATES:\n${lines.join("\n")}`;
}

function buildSqlGenPrompt(
  schema: SchemaColumn[],
  terms: SemanticTerm[],
  templates: QueryTemplate[],
  dateParams: Record<string, string>
): string {
  return `You are a secure, read-only SQL query generator for a solar energy revenue database.
The database contains a PostgreSQL table named "revenue.revenue" with all company sales and revenue data.

${buildSchemaBlock(schema)}

${buildGlossaryBlock(terms)}

DATE CONTEXT:
  Today            : ${dateParams.TODAY}
  Current FY Start : ${dateParams.FY_START}
  Previous FY Start: ${dateParams.PREV_FY_START}
  Month-to-date    : ${dateParams.MTD_START}
  Last month       : ${dateParams.LAST_MONTH_START} to ${dateParams.LAST_MONTH_END}

${buildTemplateMenu(templates)}

RULES — READ CAREFULLY:
1. If the question matches a pre-approved template, output ONLY: USE_TEMPLATE:<template_name>
   Example: USE_TEMPLATE:total_revenue
2. Otherwise output ONLY the executable PostgreSQL SELECT query — no markdown, no explanation, no backticks, no thinking.
3. ALWAYS query table "revenue.revenue".
4. Revenue calculation: always calculate revenue in Crores (INR) as: ROUND(SUM(net_value)::numeric / 10000000, 2) AS revenue_cr
5. Capacity calculation: ROUND(SUM(mw)::numeric, 2) AS total_mw
6. Date filtering: the latest available invoice date in the database is ${dateParams.TODAY}. For current fiscal year / YTD queries, use: invoice_date >= '${dateParams.FY_START}' AND invoice_date <= '${dateParams.TODAY}'. Always ensure invoice_date > DATE '2022-12-25'.
7. ONLY SELECT queries. Never generate DROP, INSERT, UPDATE, DELETE, ALTER, TRUNCATE, or CREATE.
8. If the user asks about revenue, sales, customers, modules, segments, or financial figures, ALWAYS generate the query for revenue.revenue.
9. OUTPUT FORMAT REQUIREMENT: Output strictly ONLY the USE_TEMPLATE token or the raw SELECT query. Do not output any reasoning, chain of thought, or introductory remarks.`;
}

// ── Formatting ─────────────────────────────────────────────────────────────────

function rowsToMarkdown(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "(no rows returned for this period)";
  const cols   = Object.keys(rows[0]);
  const header = `| ${cols.join(" | ")} |`;
  const sep    = `| ${cols.map(() => "---").join(" | ")} |`;
  const body   = rows.map(r =>
    `| ${cols.map(c => String(r[c] ?? "—")).join(" | ")} |`
  ).join("\n");
  return [header, sep, body].join("\n");
}

// ── AI call ────────────────────────────────────────────────────────────────────

async function callAI(
  apiKey: string,
  model: string,
  temperature: number,
  maxTokens: number,
  messages: { role: string; content: string }[],
  fallbackModel: string = DEFAULT_FALLBACK_MODEL
): Promise<{ content: string; modelUsed: string }> {
  const modelsToTry = [model];
  if (fallbackModel && fallbackModel !== model) {
    modelsToTry.push(fallbackModel);
  }

  let lastError: Error | null = null;
  for (const targetModel of modelsToTry) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://grewanalytics.com",
          "X-Title": "GrewGPT",
        },
        body: JSON.stringify({
          model: targetModel,
          models: modelsToTry,
          temperature,
          max_tokens: maxTokens,
          messages,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${errorText}`);
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content ?? "";
      const modelUsed = json.model || targetModel;
      return { content, modelUsed };
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[grewGpt] Model ${targetModel} failed: ${lastError.message}. Trying next fallback if available.`);
    }
  }

  throw lastError ?? new Error("AI completion failed on all configured models");
}

// ── Postgres ───────────────────────────────────────────────────────────────────

function tryLoadPgCredentials(): Record<string, string> | null {
  const host = Deno.env.get("PG_HOST") || Deno.env.get("PGHOST");
  const port = Deno.env.get("PG_PORT") || Deno.env.get("PGPORT") || "5432";
  const user = Deno.env.get("PG_USER") || Deno.env.get("PGUSER");
  const password = Deno.env.get("PG_PASSWORD") || Deno.env.get("PGPASSWORD");
  const database = Deno.env.get("PG_DATABASE") || Deno.env.get("PGDATABASE");

  if (!host || !user || !password || !database) {
    console.warn("[grewGpt] DB credentials incomplete:", { hasHost: !!host, hasUser: !!user, hasPassword: !!password, hasDatabase: !!database });
    return null;
  }
  return { PG_HOST: host, PG_PORT: port, PG_USER: user, PG_PASSWORD: password, PG_DATABASE: database };
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const { messages = [], dashboard_context = {}, user_email, session_id } = await req.json();

    // ── Supabase (service role — bypasses RLS for reads and audit writes) ────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Load everything in parallel ──────────────────────────────────────────
    const [configRes, termsRes, templatesRes, schemaRes, prefsRes] = await Promise.all([
      supabase.from("app_config").select("key, value")
        .in("key", ["grewgpt_system_prompt","grewgpt_model","grewgpt_fallback_model","grewgpt_provider",
                    "grewgpt_temperature","grewgpt_max_tokens"]),
      supabase.from("grewgpt_semantic_terms").select("term,sql_fragment,category,description")
        .eq("is_active", true),
      supabase.from("grewgpt_query_templates").select("name,description,intent_keywords,sql_template")
        .eq("is_active", true),
      supabase.from("grewgpt_schema_registry").select("table_name,column_name,business_label,data_type,description")
        .eq("allowed", true).eq("sensitive", false),
      user_email
        ? supabase.from("grewgpt_user_prefs").select("pref_key,pref_value").eq("user_email", user_email)
        : Promise.resolve({ data: [] }),
    ]);

    // ── Parse config ─────────────────────────────────────────────────────────
    const cfg: Record<string, string> = {};
    for (const row of (configRes.data ?? []) as AppConfig[]) cfg[row.key] = row.value;

    const systemPrompt  = cfg["grewgpt_system_prompt"]  || "";
    const model         = cfg["grewgpt_model"]          || DEFAULT_MODEL;
    const fallbackModel = cfg["grewgpt_fallback_model"] || DEFAULT_FALLBACK_MODEL;
    const provider      = cfg["grewgpt_provider"]       || DEFAULT_PROVIDER;
    const temperature   = parseFloat(cfg["grewgpt_temperature"]  || String(DEFAULT_TEMP));
    const maxTokens     = parseInt(cfg["grewgpt_max_tokens"] || String(DEFAULT_MAX_TOKENS), 10);

    const semanticTerms: SemanticTerm[]  = ((termsRes.data?.length ? termsRes.data : DEFAULT_SEMANTIC_TERMS) ?? []) as SemanticTerm[];
    const templates:     QueryTemplate[] = ((templatesRes.data?.length ? templatesRes.data : DEFAULT_QUERY_TEMPLATES) ?? []) as QueryTemplate[];
    const schemaColumns: SchemaColumn[]  = ((schemaRes.data?.length ? schemaRes.data : DEFAULT_SCHEMA_COLUMNS) ?? []) as SchemaColumn[];
    const userPrefs:     UserPref[]      = (prefsRes.data      ?? []) as UserPref[];

    // ── User preference block ─────────────────────────────────────────────────
    const prefBlock = userPrefs.length
      ? "\n\nCURRENT STANDING PREFERENCES:\n" +
        userPrefs.map(p => `- @${p.pref_key}: ${p.pref_value}`).join("\n")
      : "";

    // ── Load OpenRouter API key ───────────────────────────────────────────────────────
    const aiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!aiKey) throw new Error('OpenRouter API key not set. Add OPENROUTER_API_KEY to your environment.');

    const currentQuestion: string = (messages as any[]).findLast?.((m: any) => m.role === "user")?.content
      ?? messages[messages.length - 1]?.content ?? "";

    let dateParams    = getDateParams();

    // ── NL2SQL pipeline ───────────────────────────────────────────────────────
    let dataBlock     = "";
    let auditSQL      = "";
    let auditTemplate: string | null = null;
    let auditRows     = 0;
    let auditMs       = 0;
    let auditError: string | null = null;

    const pgCreds = tryLoadPgCredentials();

    if (pgCreds && currentQuestion) {
      let sql: ReturnType<typeof postgres> | null = null;
      try {
        sql = postgres({
          host: pgCreds.PG_HOST, port: Number(pgCreds.PG_PORT || 5432),
          user: pgCreds.PG_USER, password: pgCreds.PG_PASSWORD,
          database: pgCreds.PG_DATABASE,
          ssl: false, max: 2, connect_timeout: 10, idle_timeout: 10,
        });

        // ── Fetch the latest invoice date from the database to anchor all date periods ──
        try {
          const maxDateRes = await sql`SELECT TO_CHAR(MAX(invoice_date), 'YYYY-MM-DD') AS max_date FROM revenue.revenue`;
          if (maxDateRes[0]?.max_date) {
            dateParams = getDateParams(String(maxDateRes[0].max_date));
          }
        } catch (dateErr: any) {
          console.warn("[grewGpt] Could not fetch MAX(invoice_date):", dateErr?.message);
        }

        const sqlGenPrompt = buildSqlGenPrompt(schemaColumns, semanticTerms, templates, dateParams);

        // Phase 1 — SQL generation (zero temp, short budget)
        const phase1Result = await callAI(aiKey, model, 0.0, 300, [
          { role: "system", content: sqlGenPrompt },
          { role: "user",   content: currentQuestion },
        ], fallbackModel);
        const rawAIResponse = phase1Result.content;

        let finalSQL = "";

        // Template resolution
        const templateMatch = rawAIResponse.match(/USE_TEMPLATE:\s*([a-zA-Z0-9_-]+)/i);
        if (templateMatch) {
          const tName = templateMatch[1].trim();
          const tpl   = templates.find(t => t.name === tName);
          if (tpl) {
            finalSQL      = fillParams(tpl.sql_template, dateParams);
            auditTemplate = tName;
          } else {
            // Template name hallucinated — fall back to NL2SQL
            const fallbackAi = await callAI(aiKey, model, 0.0, 400, [
              { role: "system", content: sqlGenPrompt },
              { role: "user",   content: currentQuestion + "\n\n(Note: do not use USE_TEMPLATE — generate the SQL directly)" },
            ], fallbackModel);
            finalSQL = extractSQL(fallbackAi.content);
          }
        } else {
          finalSQL = extractSQL(rawAIResponse);
        }

        auditSQL = finalSQL;

        if (finalSQL === "UNSUPPORTED") {
          dataBlock = "\n\nNote: This question is outside the available data scope. Answering from dashboard context.\n" +
            JSON.stringify(dashboard_context, null, 2);
        } else if (!isSafeSelect(finalSQL)) {
          // Hard block — log and refuse
          auditError = "SQL failed safety validation (non-SELECT rejected)";
          console.error("[grewGpt] SECURITY: non-SELECT SQL blocked:", finalSQL);
          dataBlock = "\n\nNote: The generated query was rejected by the safety validator.";
        } else {
          // Phase 2 — Execute with timing
          const t0   = Date.now();
          const rows = Array.from(await sql.unsafe(finalSQL)) as Record<string, unknown>[];
          auditMs    = Date.now() - t0;
          auditRows  = rows.length;

          const freshness = `*Data as of ${dateParams.LATEST_DATA_DATE || dateParams.TODAY} (latest invoice in database) — live query returned ${rows.length} row${rows.length !== 1 ? "s" : ""} in ${auditMs}ms*`;
          dataBlock = `\n\nLIVE DATABASE QUERY RESULTS:\n${rowsToMarkdown(rows)}\n\n${freshness}\n\nIMPORTANT INSTRUCTION: Use the LIVE DATABASE QUERY RESULTS above to directly answer the user's question. Present all quantitative figures in clean Markdown tables formatted in Indian Rupees Crores (₹ XX.XX Cr) and MW capacity as requested. The database records are current up to ${dateParams.TODAY} (the latest invoice date in the revenue table). Always report that the data is as of ${dateParams.TODAY}.`;
          console.log(`[grewGpt] ${auditTemplate ? "TPL:" + auditTemplate : "NL2SQL"} → ${rows.length} rows in ${auditMs}ms`);
        }
      } catch (dbErr: any) {
        auditError = String(dbErr?.message ?? dbErr);
        console.warn("[grewGpt] DB error, falling back:", auditError);
        dataBlock = `\n\n(Note: Live database query encountered an issue: ${auditError})\nDASHBOARD CONTEXT:\n` +
          JSON.stringify(dashboard_context, null, 2);
      } finally {
        await sql?.end().catch(() => {});
      }
    } else {
      dataBlock = "\n\nDASHBOARD CONTEXT:\n" + JSON.stringify(dashboard_context, null, 2);
    }

    // ── Audit log (fire-and-forget — never blocks the response) ─────────────
    supabase.from("grewgpt_query_log").insert([{
      user_email:    user_email ?? null,
      session_id:    session_id ?? null,
      user_question: currentQuestion,
      generated_sql: auditSQL || null,
      template_used: auditTemplate,
      row_count:     auditRows,
      execution_ms:  auditMs,
      error:         auditError,
      created_at:    new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.warn("[grewGpt] Audit log write failed:", error.message);
    });

    // ── Phase 3 — Generate response ───────────────────────────────────────────
    const fullSystem = systemPrompt + prefBlock + dataBlock;

    const finalReply = await callAI(aiKey, model, temperature, maxTokens, [
      { role: "system", content: fullSystem },
      ...(messages as { role: string; content: string }[]),
    ], fallbackModel);

    return new Response(
      JSON.stringify({
        reply: finalReply.content,
        model: finalReply.modelUsed || model,
        provider,
        sql: auditSQL || null,
        rows_count: auditRows
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[grewGpt]", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
