/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
            colors: {
                bg: '#090C10',
                panel: '#111620',
                border: '#1e293b',
                brand: '#10b981',
                'brand-teal': '#047857',
                'brand-green': '#10b981',
                'dark-base': '#0b101e',
                'dark-card': '#141b2d',
                'dark-border': '#232b3e'
            },
            gridTemplateRows: { 12: 'repeat(12, minmax(0, 1fr))' },
            gridTemplateColumns: { 12: 'repeat(12, minmax(0, 1fr))' }
        }
    },
    plugins: []
};
