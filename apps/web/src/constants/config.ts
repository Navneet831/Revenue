/**
 * Centralized Application Config
 */
export const APP_CONFIG = {
    defaultStartDate: '2022-12-26',
    dateFormats: {
        display: 'DD-MM-YYYY',
        displayWithTime: 'DD-MM-YYYY HH:mm:ss',
        api: 'YYYY-MM-DD',
        locale: 'sv-SE', // YYYY-MM-DD locale format
    },
    debounceDelay: 300,
    staleTimes: {
        meta: 1000 * 60 * 10,        // 10 minutes
        analytics: 1000 * 60 * 5,    // 5 minutes
    },
    currency: {
        divider: 10000000,           // Divide to get Crores
        label: 'Cr',
    }
} as const;
