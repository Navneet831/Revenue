/**
 * Centralized Design System Gradients
 * Separated from color tokens since gradients serve as composite design assets.
 */
export const gradients = {
    ambient: {
        amber: 'radial-gradient(circle, oklch(0.7161 0.0091 56.3 / 0.10) 0%, transparent 68%)',
        teal: 'radial-gradient(circle, oklch(0.8122 0.0678 202 / 0.05) 0%, transparent 68%)',
        rose: 'radial-gradient(circle, oklch(0.5284 0.0076 56 / 0.04) 0%, transparent 68%)',
    },
    glass: {
        default: 'linear-gradient(135deg, oklch(0.9885 0.0057 84.6 / 0.80) 0%, oklch(0.941 0.0156 86.4 / 0.80) 100%)',
    }
} as const;
export type GradientsType = typeof gradients;
export default gradients;
