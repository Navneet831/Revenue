/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
            colors: {
                // --- B2 "Golden Layer" design system ---
                // Warm ivory canvas + pure-white floating cards + amber-gold primary.
                // Emerald is kept as a semantic-only color for positive financial indicators.
                canvas: '#FDFBF7',          // warm ivory — app background
                'canvas-soft': '#F0EBE0',   // warm linen — sidebar / panel surfaces
                'canvas-deep': '#EAE3D6',   // deeper warm — modal headers, table headers
                'canvas-night': '#1c1c1c',
                'canvas-night-soft': '#202020',
                ink: '#1C1917',             // warm near-black (stone-950)
                'ink-secondary': '#44403C', // warm dark grey (stone-700)
                'ink-mute': '#78716C',      // warm medium grey (stone-500)
                'ink-faint': '#A8A29E',     // warm light grey (stone-400)
                'on-primary': '#1C1917',    // dark text on amber (5.6:1 contrast ✓)
                primary: '#D97706',         // amber-600 — financial gold
                'primary-deep': '#B45309',  // amber-700
                'primary-soft': '#FDE68A',  // amber-200
                'primary-ghost': '#FEF3C7', // amber-100 — hover backgrounds
                hairline: '#E7E5E4',        // stone-200 — warm hairline
                'hairline-strong': '#D6D3D1', // stone-300

                // Legacy aliases kept for existing class usages.
                bg: '#FDFBF7',
                panel: '#F0EBE0',
                border: '#E7E5E4',
                brand: '#D97706',
                'brand-teal': '#B45309',
                'brand-green': '#3ecf8e',   // kept — semantic positive indicator in charts
                'dark-base': '#1c1c1c',
                'dark-card': '#1c1c1c',
                'dark-border': '#2a2a2a',

                // Emerald kept as semantic-only: positive variance, growth, confirmed states.
                emerald: {
                    50: '#ecfdf5',
                    100: '#d1fae5',
                    200: '#a7f3d0',
                    300: '#6ee7b7',
                    400: '#4ade80',
                    500: '#3ecf8e',
                    600: '#24b47e',
                    700: '#1c9e6e',
                    800: '#186b50',
                    900: '#14583f',
                    950: '#052e1f'
                },

                // Amber scale — primary action color family.
                amber: {
                    50: '#fffbeb',
                    100: '#fef3c7',
                    200: '#fde68a',
                    300: '#fcd34d',
                    400: '#fbbf24',
                    500: '#f59e0b',
                    600: '#d97706',
                    700: '#b45309',
                    800: '#92400e',
                    900: '#78350f',
                    950: '#451a03'
                },

                // Stone scale — warm grey family for text hierarchy and surfaces.
                stone: {
                    50: '#fafaf9',
                    100: '#f5f5f4',
                    200: '#e7e5e4',
                    300: '#d6d3d1',
                    400: '#a8a29e',
                    500: '#78716c',
                    600: '#57534e',
                    700: '#44403c',
                    800: '#292524',
                    900: '#1c1917',
                    950: '#0c0a09'
                }
            },
            gridTemplateRows: { 12: 'repeat(12, minmax(0, 1fr))' },
            gridTemplateColumns: { 12: 'repeat(12, minmax(0, 1fr))' }
        }
    },
    plugins: []
};
