/**
 * Read a CSS custom property from the :root / .dark element and return its
 * computed value. Falls back to a sensible default so charts never render
 * invisible text.
 */
export function getCssVar(name: string, fallback: string = '#000'): string {
    try {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(name)
            .trim() || fallback;
    } catch {
        return fallback;
    }
}

/** Ink color (primary text) for dark/light adaptive canvas drawing */
export const ink = () => getCssVar('--color-ink', '#1e1e2e');
/** Secondary text */
export const inkSecondary = () => getCssVar('--color-ink-secondary', '#4a4a5e');
/** Hairline / grid color */
export const hairline = () => getCssVar('--color-hairline', '#d8d8e2');
/** Card background */
export const cardBg = () => getCssVar('--color-card-bg', '#fafafe');
/** Card border */
export const cardBorder = () => getCssVar('--color-card-border', '#e2e2ea');
