import { supabase } from './supabaseClient';
import { useAuthStore } from './useAuthStore';

export interface WhitelistResult {
    ok: boolean;
    errorMsg?: string;
}

export async function verifyWhitelistAndSetUser(
    session: { user?: { email?: string } } | null,
    opts?: { skipDelay?: boolean }
): Promise<WhitelistResult> {
    const email = session?.user?.email;
    if (!email) return { ok: false, errorMsg: 'No email in session.' };

    if (!opts?.skipDelay) {
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const { data, error } = await supabase
        .from('whitelist')
        .select('*')
        .ilike('email', email)
        .single();

    if (error || !data) {
        console.warn('[AuthService] Whitelist query failed:', error?.message || 'No data');
        // Don't sign out — allow global features to persist
        const { setUser, setAuthenticated } = useAuthStore.getState();
        setUser({ email, features: {} });
        setAuthenticated(true);
        return { ok: true };
    }

    console.log('[AuthService] Whitelist row:', JSON.stringify(data));

    const features: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
        if (key !== 'email') {
            // Accept both boolean and string "true"/"false"
            if (typeof value === 'boolean') {
                features[key] = value;
            } else if (typeof value === 'string') {
                features[key] = value.toLowerCase() === 'true';
            }
        }
    }

    console.log('[AuthService] Extracted features:', JSON.stringify(features));

    const { setUser, setAuthenticated } = useAuthStore.getState();
    setUser({ email, features });
    setAuthenticated(true);
    return { ok: true };
}
