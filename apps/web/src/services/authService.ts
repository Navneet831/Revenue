import { supabase } from './supabaseClient';
import { useStore } from '../store/useStore';

export interface WhitelistResult {
    ok: boolean;
    errorMsg?: string;
}

/**
 * Verifies the signed-in user against the whitelist table (individual boolean
 * columns per feature) and maps them directly into the Zustand store.
 * Returns {ok:false} and signs the user out if the email is not in the table.
 *
 * skipDelay: true during initial boot (no new-user trigger delay needed).
 * Leave false for new sign-ins where the Postgres trigger may still be running.
 */
export async function verifyWhitelistAndSetUser(
    session: { user?: { email?: string } } | null,
    opts?: { skipDelay?: boolean }
): Promise<WhitelistResult> {
    const email = session?.user?.email;
    if (!email) return { ok: false, errorMsg: 'No email in session.' };

    if (!opts?.skipDelay) {
        // Small grace period for new-user Postgres trigger to finish inserting the row
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    const { data, error } = await supabase
        .from('whitelist')
        .select('*')
        .ilike('email', email)
        .single();

    if (error || !data) {
        await supabase.auth.signOut();
        return {
            ok: false,
            errorMsg: `ACCESS DENIED. The email address (${email}) could not be verified.`,
        };
    }

    const row = data as Record<string, unknown>;

    const { setUser, setAuthenticated, setFeatures, features } = useStore.getState();

    const perUserFeatures = {
        agentation:      row['agentation']       === true,
        commitDrilldown: row['commit_drill_down'] === true,
        audit:           row['audit']            === true,
        story:           row['story']            === true,
        devTab:          row['Dev']              === true,
        grewGpt:         row['GrewGpt']          === true,
        ledger:          row['Ledger']           === true,
    };

    setUser({ name: email, features: perUserFeatures });

    // enable_auth is a platform kill-switch from global config, not per-user.
    setFeatures({
        enable_auth:     features.enable_auth,
        agentation:      perUserFeatures.agentation,
        commitDrilldown: perUserFeatures.commitDrilldown,
        audit:           perUserFeatures.audit,
        story:           perUserFeatures.story,
        devTab:          perUserFeatures.devTab,
        grewGpt:         perUserFeatures.grewGpt,
        ledger:          perUserFeatures.ledger,
    });

    setAuthenticated(true);
    return { ok: true };
}
