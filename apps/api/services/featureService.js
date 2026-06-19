import Logger from '../../../monitoring/logging/index.js';

/**
 * FeatureService: Handles dynamic feature toggling and user-specific permissions.
 * Integration: Queries Supabase REST API (PostgREST) to ensure parity with 
 * database-level feature management.
 */
export class FeatureService {
    /**
     * Fetches globally enabled features and user-specific permissions from Supabase.
     * @param {string} userEmail - The email of the user to check permissions for.
     * @returns {Promise<Object>} - Merged feature flags.
     */
    static async getFeaturesForUser(userEmail = 'navneet.chaudhary831@gmail.com') {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            Logger.warn('feature_service_config_missing', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
            return { agentation: false, story: true, commitDrilldown: false, enable_auth: false };
        }

        try {
            const headers = {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            };

            // 1. Fetch global feature applicability
            const featuresRes = await fetch(`${supabaseUrl}/rest/v1/features?select=feature,enabled`, { headers });
            if (!featuresRes.ok) throw new Error(`Features fetch failed: ${featuresRes.statusText}`);
            const features = await featuresRes.json();
            
            const globalFeatures = {};
            features.forEach(f => {
                globalFeatures[f.feature.toLowerCase()] = f.enabled;
            });

            // 2. Fetch user-specific permissions
            // Since we can't join without a FK in PostgREST, we fetch separately
            const whitelistUrl = `${supabaseUrl}/rest/v1/whitelist?select=Name&email=eq.${encodeURIComponent(userEmail)}`;
            const whitelistRes = await fetch(whitelistUrl, { headers });
            if (!whitelistRes.ok) throw new Error(`Whitelist fetch failed`);
            const whitelistData = await whitelistRes.json();

            if (whitelistData.length === 0) return { agentation: false, story: true, commitDrilldown: false, enable_auth: true };

            const userName = whitelistData[0].Name;
            const permUrl = `${supabaseUrl}/rest/v1/feature_permissions?select=feature,allowed&Name=eq.${encodeURIComponent(userName)}`;
            const permRes = await fetch(permUrl, { headers });
            
            if (!permRes.ok) throw new Error(`Permissions fetch failed`);
            const permissions = await permRes.json();

            const userPermissions = {};
            permissions.forEach(p => {
                userPermissions[p.feature.toLowerCase()] = p.allowed;
            });

            // 3. Merged logic: Active = Globally Enabled AND User Allowed
            return {
                agentation: (globalFeatures['agentation'] && userPermissions['agentation']) || false,
                story: (globalFeatures['story'] && userPermissions['story']) || false,
                commitDrilldown: (globalFeatures['commit drilldown'] && userPermissions['commit drilldown']) || false,
                enable_auth: (globalFeatures['authentication'] && userPermissions['authentication']) || false
            };
        } catch (err) {
            Logger.error('fetch_features_failed', err);
            // Default safe state on failure
            return {
                agentation: false,
                story: true,
                commitDrilldown: false,
                enable_auth: false
            };
        }
    }
}
