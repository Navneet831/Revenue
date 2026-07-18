import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const REQUIRED = ["PG_HOST", "PG_PORT", "PG_USER", "PG_PASSWORD", "PG_DATABASE"] as const;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const missing = REQUIRED.filter((k) => !Deno.env.get(k));
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({
        error: `Missing Supabase secrets: ${missing.join(", ")}. ` +
          "Set them via: supabase secrets set <KEY>=<VALUE>",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      host: Deno.env.get("PG_HOST"),
      port: Number(Deno.env.get("PG_PORT") || 5432),
      user: Deno.env.get("PG_USER"),
      password: Deno.env.get("PG_PASSWORD"),
      database: Deno.env.get("PG_DATABASE"),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
