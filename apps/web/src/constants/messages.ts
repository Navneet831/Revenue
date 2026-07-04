/**
 * Centralized System Messages (Errors, Warnings, Empty-states, Auth UI)
 */
export const MESSAGES = {
    errors: {
        fetchFailed: 'Failed to fetch revenue data.',
        authFailed: 'Failed to authenticate user.',
        networkError: 'Network error. Please try again later.',
        generic: 'An unexpected error occurred.',
        metaFailed: 'Failed to load metadata',
        analyticsFailed: 'Failed to compute analytics',
    },
    emptyStates: {
        noData: 'No records found for the selected filter criteria.',
        loading: 'Fetching records from database...',
    },
    auth: {
        verifying: 'Verifying Access…',
        loggingIn: 'Redirecting to login provider...',
    }
} as const;
