import Logger from '../../../monitoring/logging/index.js';
import { FEATURES } from '@revenue/shared';

/**
 * FeatureService: Handles dynamic feature toggling and user-specific permissions.
 * Integration: Queries Supabase REST API (PostgREST) whitelist table.
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

        const globalFeatures = {
            agentation: process.env.FEATURE_AGENTATION !== undefined
                ? process.env.FEATURE_AGENTATION === 'true'
                : FEATURES.agentation,
            story: process.env.FEATURE_STORY !== undefined
                ? process.env.FEATURE_STORY === 'true'
                : FEATURES.story,
            commitDrilldown: process.env.FEATURE_COMMIT_DRILLDOWN !== undefined
                ? process.env.FEATURE_COMMIT_DRILLDOWN === 'true'
                : FEATURES.commitDrilldown,
            enable_auth: process.env.FEATURE_ENABLE_AUTH !== undefined
                ? process.env.FEATURE_ENABLE_AUTH === 'true'
                : FEATURES.enable_auth,
            ledger: true,
            userAudit: true,
            developerAudit: true,
        };

        if (!supabaseUrl || !supabaseKey) {
            Logger.warn('feature_service_config_missing', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
            return globalFeatures;
        }

        try {
            const headers = {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            };

            // Query whitelist to check if the user is whitelisted and get their flags
            const whitelistUrl = `${supabaseUrl}/rest/v1/whitelist?select=agentation,commit_drill_down,audit&email=ilike.${encodeURIComponent(userEmail)}`;
            const whitelistRes = await fetch(whitelistUrl, { headers });
            
            if (!whitelistRes.ok) {
                throw new Error(`Whitelist fetch failed: ${whitelistRes.statusText}`);
            }
            
            const whitelistData = await whitelistRes.json();

            // If user is not in the whitelist, we return global features but restrict sensitive ones if auth is enabled
            if (whitelistData.length === 0) {
                if (globalFeatures.enable_auth) {
                    return {
                        agentation: false,
                        story: false,
                        commitDrilldown: false,
                        enable_auth: true,
                        ledger: false,
                        userAudit: false,
                        developerAudit: false,
                    };
                }
                return globalFeatures;
            }

            const row = whitelistData[0];
            const userFeatures = {
                agentation:         !!row.agentation,
                'commit drilldown': !!row.commit_drill_down,
                useraudit:          !!row.audit,
                developeraudit:     !!row.audit,
                story:              true,
                ledger:             true,
            };
            const userHas = (key) => {
                const kLower = key.toLowerCase();
                const matchedKey = Object.keys(userFeatures).find(k => k.toLowerCase() === kLower);
                return matchedKey ? !!userFeatures[matchedKey] : false;
            };

            return {
                agentation: globalFeatures.agentation && userHas('agentation'),
                story: globalFeatures.story && userHas('story'),
                commitDrilldown: globalFeatures.commitDrilldown && userHas('commit drilldown'),
                enable_auth: globalFeatures.enable_auth,
                ledger: userHas('ledger'),
                userAudit: userHas('useraudit'),
                developerAudit: userHas('developeraudit'),
            };
        } catch (err) {
            Logger.error('fetch_features_failed', err);
            return globalFeatures;
        }
    }
}

