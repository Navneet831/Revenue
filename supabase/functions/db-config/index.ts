// Returns PG connection details from Supabase secrets — PASSWORD IS NEVER
// EXPOSED. Called by the backend (Dev console) when PG_HOST is absent from the
// local .env, so DB details can still be shown from the project's secrets.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const REQUIRED = ["PG_HOST", "PG_PORT", "PG_USER", "PG_DATABASE"] as const;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const missing = REQUIRED.filter((k) => !Deno.env.get(k));
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({
        error: `Missing Supabase secrets: ${missing.join(", ")}. ` +
          "Set them via: supabase secrets set <KEY>=<VALUE>",
      }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  // Password is intentionally omitted from the response.
  return new Response(
    JSON.stringify({
      host: Deno.env.get("PG_HOST"),
      port: Number(Deno.env.get("PG_PORT") || 5432),
      user: Deno.env.get("PG_USER"),
      database: Deno.env.get("PG_DATABASE"),
      ssl: Deno.env.get("PG_SSL") === "true",
    }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
