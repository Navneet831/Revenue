/**
 * USER ACTIVITY SERVICE
 * Mirrors HTML app's UI.logActivity() → Supabase user_activity_events table.
 * Fire-and-forget: never blocks UI on log failure.
 */

let _supabaseClient: any = null;
let _userEmail: string | null = null;

export const ActivityService = {
    init(client: any, email: string | null) {
        _supabaseClient = client;
        _userEmail = email;
    },

    async log(eventName: string, metadata: Record<string, any> = {}): Promise<void> {
        if (!_supabaseClient || !_userEmail) return;
        try {
            const safeMetadata = JSON.parse(JSON.stringify(metadata, (_key, val) => {
                if (val instanceof Set) return Array.from(val);
                if (val instanceof Date) return val.toISOString();
                return val;
            }));
            await _supabaseClient
                .from('user_activity_events')
                .insert([{
                    email: _userEmail,
                    event_name: eventName,
                    metadata: safeMetadata
                }]);
        } catch (e) {
            console.warn('[Activity] Log exception:', e);
        }
    }
};
