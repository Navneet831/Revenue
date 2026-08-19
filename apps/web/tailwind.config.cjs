/** @type {import('tailwindcss').Config} */
const fs = require('fs');
const path = require('path');
const colorsData = JSON.parse(fs.readFileSync(path.resolve(__dirname, './src/theme/colors.json'), 'utf8'));

module.exports = {
    darkMode: 'class',
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
        '../../packages/auth/src/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
            colors: {
                white: colorsData.surface.cardBg,
                // Semantic tokens — now CSS custom properties that toggle with .dark
                canvas: 'var(--color-canvas)',
                'canvas-soft': 'var(--color-canvas-soft)',
                'canvas-deep': 'var(--color-canvas-deep)',
                'card-bg': 'var(--color-card-bg)',
                'card-border': 'var(--color-card-border)',
                ink: 'var(--color-ink)',
                'ink-secondary': 'var(--color-ink-secondary)',
                'ink-mute': 'var(--color-ink-mute)',
                'ink-faint': 'var(--color-ink-faint)',
                'on-primary': 'var(--color-on-primary)',
                hairline: 'var(--color-hairline)',
                'hairline-strong': 'var(--color-hairline-strong)',
                brand: 'var(--color-brand)',
                'brand-deep': 'var(--color-brand-deep)',
                'brand-green': 'var(--color-brand)',
                'brand-teal': 'var(--color-brand)',
                success: 'var(--color-success)',
                'success-bg': 'var(--color-success-bg)',
                risk: 'var(--color-risk)',
                'risk-bg': 'var(--color-risk-bg)',
                strategic: 'var(--color-strategic)',
                'strategic-bg': 'var(--color-strategic-bg)',
                // Static tokens used by theme() in CSS
                primary: colorsData.interactive.primaryAction,
                'primary-deep': colorsData.interactive.primaryActionHover,
                'primary-soft': colorsData.interactive.primaryActionSelected,
                'primary-ghost': colorsData.interactive.primaryActionGhost,
                'success-deep': colorsData.aliases['success-deep'],
                'surface-warm': colorsData.aliases['surface-warm'],
                'surface-warm-line': colorsData.aliases['surface-warm-line'],
                // Legacy aliases
                bg: colorsData.aliases.bg,
                panel: colorsData.aliases.panel,
                border: colorsData.aliases.border,
                'canvas-night': colorsData.surface.appBgDark,
                'canvas-night-soft': colorsData.surface.panelBgDark,
                'dark-base': colorsData.aliases['dark-base'],
                'dark-card': colorsData.aliases['dark-card'],
                'dark-border': colorsData.aliases['dark-border'],
                // Palette scales (used by theme() in CSS)
                ...colorsData.palette,
            },
            gridTemplateRows: { 12: 'repeat(12, minmax(0, 1fr))' },
            gridTemplateColumns: { 12: 'repeat(12, minmax(0, 1fr))' }
        }
    },
    plugins: []
};
