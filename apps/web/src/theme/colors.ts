import colorsData from './colors.json';

/**
 * Centralized Design System Colors (Solid OKLCH Color Tokens)
 * Colors are imported from colors.json to keep theme configuration in a single file
 * that can be read by both TypeScript and Tailwind.
 */
export const colors = colorsData;
export type ColorsType = typeof colors;
export default colors;
