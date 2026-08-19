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

const DEFAULT_MODEL     = "openai/gpt-oss-120b:free";
const DEFAULT_PROVIDER  = "openrouter";
const DEFAULT_TEMP      = 0.3;
const DEFAULT_MAX_TOKENS = 2048;

// ── Types ──────────────────────────────────────────────────────────────────────

interface SemanticTerm   { term: string; sql_fragment: string; category: string; description: string }
interface QueryTemplate  { name: string; description: string; intent_keywords: string[]; sql_template: string }
interface SchemaColumn   { table_name: string; column_name: string; business_label: string; data_type: string; description: string }
interface AppConfig      { key: string; value: string }
interface UserPref       { pref_key: string; pref_value: string }

// ── Date helpers ───────────────────────────────────────────────────────────────

function getDateParams(): Record<string, string> {
  const now  = new Date();
  const today = now.toISOString().slice(0, 10);
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fyStart    = `${fyYear}-04-01`;
  const prevFyStart = `${fyYear - 1}-04-01`;
  const mtdStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  return { TODAY: today, FY_START: fyStart, PREV_FY_START: prevFyStart,
           MTD_START: mtdStart, LAST_MONTH_START: lastMonthStart, LAST_MONTH_END: lastMonthEnd };
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
  // Reject any data-modifying or DDL keywords anywhere in the statement
  return !/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE|COPY|CALL|MERGE)\b/.test(upper);
}

function extractSQL(raw: string): string {
  const fenced = raw.match(/```(?:sql)?\s*\n?([\s\S]+?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

// ── Prompt builders ────────────────────────────────────────────────────────────

function buildSchemaBlock(columns: SchemaColumn[]): string {
  if (!columns.length) return "";
  const lines = columns.map(c =>
    `  "${c.column_name}" ${c.data_type.padEnd(8)} — ${c.business_label}. ${c.description}`
  );
  return `ALLOWED SCHEMA:\nTable: revenue.revenue\n${lines.join("\n")}`;
}

function buildGlossaryBlock(terms: SemanticTerm[]): string {
  if (!terms.length) return "";
  const lines = terms.map(t => `  "${t.term}" [${t.category}]: ${t.description}`);
  return `BUSINESS GLOSSARY:\n${lines.join("\n")}`;
}

function buildTemplateMenu(templates: QueryTemplate[]): string {
  if (!templates.length) return "";
  const lines = templates.map(t =>
    `  ${t.name}: ${t.description}\n    keywords: ${t.intent_keywords.join(", ")}`
  );
  return `PRE-APPROVED QUERY TEMPLATES (prefer these when the question matches):\n${lines.join("\n")}`;
}

function buildSqlGenPrompt(
  schema: SchemaColumn[],
  terms: SemanticTerm[],
  templates: QueryTemplate[],
  dateParams: Record<string, string>
): string {
  return `You are a secure, read-only SQL query generator for a solar energy revenue database.

${buildSchemaBlock(schema)}

${buildGlossaryBlock(terms)}

DATE CONTEXT (use these exact values — never use NOW() for fiscal calculations):
  Today            : ${dateParams.TODAY}
  Financial year   : ${dateParams.FY_START} → current
  Previous FY      : ${dateParams.PREV_FY_START} → ${dateParams.FY_START}
  Month-to-date    : ${dateParams.MTD_START} → ${dateParams.TODAY}
  Last month       : ${dateParams.LAST_MONTH_START} → ${dateParams.LAST_MONTH_END}

${buildTemplateMenu(templates)}

RULES — READ CAREFULLY:
1. If the question matches a pre-approved template, output ONLY: USE_TEMPLATE:<template_name>
   Example: USE_TEMPLATE:ytd_by_segment
2. Otherwise output ONLY the raw SQL query — no markdown, no explanation, no commentary.
3. ONLY SELECT statements. NEVER INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, GRANT, REVOKE, COPY, TRUNCATE, EXECUTE, MERGE, or CALL.
4. Date filter: invoice_date > DATE '2022-12-25'
5. Revenue in Crores: ROUND(SUM(net_value)::numeric / 10000000, 2) AS revenue_cr
6. Always ROUND numeric results to 2 decimal places.
7. Use LIMIT 50 for row-level lists; omit LIMIT for aggregates.
8. Use clear column aliases. COALESCE(sales_head, 'Unassigned') for nullable fields.
9. If the question CANNOT be answered from the allowed schema, output exactly: UNSUPPORTED`;
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
  apiKey: string, model: string, temperature: number, maxTokens: number,
  messages: { role: string; content: string }[]
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://grewanalytics.com",
      "X-Title": "GrewGPT",
    },
    body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// ── Postgres ───────────────────────────────────────────────────────────────────

function tryLoadPgCredentials(): Record<string, string> | null {
  const keys = ["PG_HOST", "PG_PORT", "PG_USER", "PG_PASSWORD", "PG_DATABASE"];
  const vals: Record<string, string> = {};
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (!v) return null;
    vals[k] = v;
  }
  return vals;
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
        .in("key", ["grewgpt_system_prompt","grewgpt_model","grewgpt_provider",
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

    const systemPrompt = cfg["grewgpt_system_prompt"] || "";
    const model        = cfg["grewgpt_model"]          || DEFAULT_MODEL;
    const provider     = cfg["grewgpt_provider"]       || DEFAULT_PROVIDER;
    const temperature  = parseFloat(cfg["grewgpt_temperature"]  || String(DEFAULT_TEMP));
    const maxTokens    = parseInt(cfg["grewgpt_max_tokens"] || String(DEFAULT_MAX_TOKENS), 10);

    const semanticTerms: SemanticTerm[]  = (termsRes.data     ?? []) as SemanticTerm[];
    const templates:     QueryTemplate[] = (templatesRes.data  ?? []) as QueryTemplate[];
    const schemaColumns: SchemaColumn[]  = (schemaRes.data     ?? []) as SchemaColumn[];
    const userPrefs:     UserPref[]      = (prefsRes.data      ?? []) as UserPref[];

    // ── User preference block ─────────────────────────────────────────────────
    const prefBlock = userPrefs.length
      ? "\n\nCURRENT STANDING PREFERENCES:\n" +
        userPrefs.map(p => `- @${p.pref_key}: ${p.pref_value}`).join("\n")
      : "";

    const aiKey = Deno.env.get("AI");
    if (!aiKey) throw new Error('Supabase secret "AI" (OpenRouter key) is not set.');

    const currentQuestion: string = (messages as any[]).findLast?.((m: any) => m.role === "user")?.content
      ?? messages[messages.length - 1]?.content ?? "";

    const dateParams    = getDateParams();
    const sqlGenPrompt  = buildSqlGenPrompt(schemaColumns, semanticTerms, templates, dateParams);

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
          host: pgCreds.PG_HOST, port: Number(pgCreds.PG_PORT),
          user: pgCreds.PG_USER, password: pgCreds.PG_PASSWORD,
          database: pgCreds.PG_DATABASE,
          ssl: "prefer", max: 3, connect_timeout: 8, idle_timeout: 10,
        });

        // Phase 1 — SQL generation (zero temp, short budget)
        const rawAIResponse = await callAI(aiKey, model, 0.0, 300, [
          { role: "system", content: sqlGenPrompt },
          { role: "user",   content: currentQuestion },
        ]);

        let finalSQL = "";

        // Template resolution
        const templateMatch = rawAIResponse.trim().match(/^USE_TEMPLATE:(\S+)/i);
        if (templateMatch) {
          const tName = templateMatch[1].trim();
          const tpl   = templates.find(t => t.name === tName);
          if (tpl) {
            finalSQL      = fillParams(tpl.sql_template, dateParams);
            auditTemplate = tName;
          } else {
            // Template name hallucinated — fall back to NL2SQL
            const fallback = await callAI(aiKey, model, 0.0, 400, [
              { role: "system", content: sqlGenPrompt },
              { role: "user",   content: currentQuestion + "\n\n(Note: do not use USE_TEMPLATE — generate the SQL directly)" },
            ]);
            finalSQL = extractSQL(fallback);
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

          const freshness = `*Data as of ${dateParams.TODAY} — live query, ${rows.length} row${rows.length !== 1 ? "s" : ""} returned in ${auditMs}ms*`;
          dataBlock = `\n\nLIVE QUERY RESULTS:\n${rowsToMarkdown(rows)}\n\n${freshness}`;
          console.log(`[grewGpt] ${auditTemplate ? "TPL:" + auditTemplate : "NL2SQL"} → ${rows.length} rows in ${auditMs}ms`);
        }
      } catch (dbErr: any) {
        auditError = String(dbErr?.message ?? dbErr);
        console.warn("[grewGpt] DB error, falling back:", auditError);
        dataBlock = "\n\nDASHBOARD CONTEXT (live DB unavailable):\n" +
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

    const reply = await callAI(aiKey, model, temperature, maxTokens, [
      { role: "system", content: fullSystem },
      ...(messages as { role: string; content: string }[]),
    ]);

    return new Response(
      JSON.stringify({ reply, model, provider }),
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
