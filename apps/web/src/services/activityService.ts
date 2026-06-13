/**
 * USER ACTIVITY SERVICE
 * Simple console logger for local-only execution.
 */

let _userEmail: string | null = null;

export const ActivityService = {
    init(_client: any, email: string | null) {
        _userEmail = email;
    },

    async log(eventName: string, metadata: Record<string, any> = {}): Promise<void> {
        console.log(`[Activity] ${eventName}`, { email: _userEmail, ...metadata });
    }
};
