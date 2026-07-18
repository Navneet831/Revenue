/** @type {import('tailwindcss').Config} */
const fs = require('fs');
const path = require('path');
const colorsData = JSON.parse(fs.readFileSync(path.resolve(__dirname, './src/theme/colors.json'), 'utf8'));

module.exports = {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
        // The shared @grew/auth package lives in packages/auth/src within the repo.
        // Without this entry, Tailwind purges all the utility classes used by the
        // login page and it renders unstyled.
        '../../packages/auth/src/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
            // Every colour value lives in src/theme/colors.json (single source of
            // truth). Nothing hardcoded here — edit the JSON and Tailwind hot-reloads.
            // Two tiers:
            //   • semantic tokens (canvas/ink/primary/success…) — meaning-based, preferred in new code
            //   • palette scales (slate/emerald/amber…) — raw shades behind class names like text-slate-500
            //   • aliases — legacy flat names kept for back-compat
            colors: {
                white: colorsData.surface.cardBg,
                // ── Semantic tokens ───────────────────────────────────────────
                canvas: colorsData.surface.appBg,
                'canvas-soft': colorsData.surface.panelBg,
                // Legacy aliases
                bg: colorsData.aliases.bg,
                panel: colorsData.aliases.panel,
                border: colorsData.aliases.border,
                brand: colorsData.aliases.brand,
                'brand-teal': colorsData.aliases['brand-teal'],
                'brand-green': colorsData.aliases['brand-green'],
                'dark-base': colorsData.aliases['dark-base'],
                'dark-card': colorsData.aliases['dark-card'],
                'dark-border': colorsData.aliases['dark-border'],
                'canvas-deep': colorsData.surface.headerBg,
                'canvas-night': colorsData.surface.appBgDark,
                'canvas-night-soft': colorsData.surface.panelBgDark,
                ink: colorsData.text.default,
                'ink-secondary': colorsData.text.secondary,
                'ink-mute': colorsData.text.muted,
                'ink-faint': colorsData.text.placeholder,
                'on-primary': colorsData.text.onPrimary,
                primary: colorsData.interactive.primaryAction,
                'primary-deep': colorsData.interactive.primaryActionHover,
                'primary-soft': colorsData.interactive.primaryActionSelected,
                'primary-ghost': colorsData.interactive.primaryActionGhost,
                hairline: colorsData.border.muted,
                'hairline-strong': colorsData.border.default,
                'card-bg': colorsData.surface.cardBg,
                'card-border': colorsData.surface.cardBorder,

                // Status — *-bg carry baked-in alpha because Tailwind v3 cannot
                // apply the /opacity modifier to oklch() colours (parser predates oklch).
                success: colorsData.status.success,
                'success-bg': colorsData.status.successBg,
                risk: colorsData.status.risk,
                'risk-bg': colorsData.status.riskBg,
                strategic: colorsData.status.strategic,
                'strategic-bg': colorsData.status.strategicBg,

                // ── Legacy flat aliases + raw palette scales (all from colors.json) ──
                ...colorsData.aliases,
                ...colorsData.palette,
            },
            gridTemplateRows: { 12: 'repeat(12, minmax(0, 1fr))' },
            gridTemplateColumns: { 12: 'repeat(12, minmax(0, 1fr))' }
        }
    },
    plugins: []
};
