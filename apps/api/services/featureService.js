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
            audit: true,
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

            // Query whitelist — select all columns so PostgREST returns exact mixed-case names
            const whitelistUrl = `${supabaseUrl}/rest/v1/whitelist?select=*&email=ilike.${encodeURIComponent(userEmail)}`;
            const whitelistRes = await fetch(whitelistUrl, { headers });

            if (!whitelistRes.ok) {
                throw new Error(`Whitelist fetch failed: ${whitelistRes.statusText}`);
            }

            const whitelistData = await whitelistRes.json();

            // User not in whitelist — deny all sensitive features when auth is enabled
            if (whitelistData.length === 0) {
                if (globalFeatures.enable_auth) {
                    return {
                        agentation: false,
                        story: false,
                        commitDrilldown: false,
                        enable_auth: true,
                        ledger: false,
                        audit: false,
                        devTab: false,
                        grewGpt: false,
                    };
                }
                return globalFeatures;
            }

            const row = whitelistData[0];

            return {
                agentation:      globalFeatures.agentation && row.agentation       === true,
                story:           globalFeatures.story      && row.story            === true,
                commitDrilldown: globalFeatures.commitDrilldown && row.commit_drill_down === true,
                enable_auth:     globalFeatures.enable_auth,
                ledger:          row['Ledger']   === true,
                audit:           row['audit']    === true,
                devTab:          row['Dev']      === true,
                grewGpt:         row['GrewGpt']  === true,
            };
        } catch (err) {
            Logger.error('fetch_features_failed', err);
            return globalFeatures;
        }
    }
}

