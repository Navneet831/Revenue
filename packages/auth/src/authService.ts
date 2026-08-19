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

    // Default all critical features to FALSE so that if they are missing
    // in the DB, or the user is completely missing from the whitelist,
    // they don't inherit the generic 'true' from globalFeatures.
    const defaultFeatures: Record<string, boolean> = {
        agentation: false,
        GrewGpt: false,
        audit: false,
        Ledger: false,
        Dev: false,
        story: false,
        dashboard: false,
        commitDrilldown: false,
    };

    if (error || !data) {
        console.warn('[AuthService] Whitelist query failed:', error?.message || 'No data');
        // If they are not in the whitelist, they get the strict defaults (all false).
        const { setUser, setAuthenticated } = useAuthStore.getState();
        setUser({ email, features: defaultFeatures });
        setAuthenticated(true);
        return { ok: true };
    }

    console.log('[AuthService] Whitelist row:', JSON.stringify(data));

    const features: Record<string, boolean> = { ...defaultFeatures };
    for (const [key, value] of Object.entries(data)) {
        if (key !== 'email') {
            let boolValue = false;
            if (typeof value === 'boolean') {
                boolValue = value;
            } else if (typeof value === 'string') {
                boolValue = value.toLowerCase() === 'true';
            }
            
            // Normalize keys to match the frontend expectations
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'agentation') features['agentation'] = boolValue;
            else if (lowerKey === 'grewgpt') features['GrewGpt'] = boolValue;
            else if (lowerKey === 'audit') features['audit'] = boolValue;
            else if (lowerKey === 'ledger') features['Ledger'] = boolValue;
            else if (lowerKey === 'dev') features['Dev'] = boolValue;
            else if (lowerKey === 'story') features['story'] = boolValue;
            else if (lowerKey === 'command center') features['dashboard'] = boolValue;
            else if (lowerKey === 'commit_drill_down') features['commitDrilldown'] = boolValue;
            else features[key] = boolValue; // Fallback
        }
    }

    console.log('[AuthService] Extracted features:', JSON.stringify(features));

    const { setUser, setAuthenticated } = useAuthStore.getState();
    setUser({ email, features });
    setAuthenticated(true);
    return { ok: true };
}
