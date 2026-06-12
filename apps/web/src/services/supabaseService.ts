import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Single shared Supabase client for the whole app.
 * Keys are fetched from the API at runtime so they are never baked into the bundle,
 * and every module (auth, data fetching, logout) shares one session source of truth.
 */
let client: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

async function init(): Promise<SupabaseClient> {
    const res = await fetch('/api/v1/config');
    if (!res.ok) throw new Error('Security handshake failed.');
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await res.json();
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Auth configuration missing.');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return client;
}

export const supabaseService = {
    getClient(): Promise<SupabaseClient> {
        if (client) return Promise.resolve(client);
        if (!initPromise) {
            initPromise = init().catch((err) => {
                initPromise = null;
                throw err;
            });
        }
        return initPromise;
    },

    async getAccessToken(): Promise<string | null> {
        const c = await supabaseService.getClient();
        const { data: { session } } = await c.auth.getSession();
        return session?.access_token ?? null;
    },

    async signOut(): Promise<void> {
        if (!client) return;
        await client.auth.signOut();
    }
};
