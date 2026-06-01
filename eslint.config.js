const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');

module.exports = [
    js.configs.recommended,
    prettier,
    {
        ignores: [
            'node_modules/**',
            'drizzle/**',
            'dist/**',
            'public/**',
            'src/**',
            'package.json',
            'package-lock.json',
            'data-logic.js',
            'data-logic.ts',
            'drizzle.config.ts',
            'tsconfig.json',
            'db/schema.ts'
        ]
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'commonjs',
            globals: {
                // Node globals
                process: 'readonly',
                require: 'readonly',
                module: 'readonly',
                __dirname: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                Promise: 'readonly',
                Buffer: 'readonly',

                // Browser globals
                window: 'writable',
                document: 'readonly',
                localStorage: 'readonly',
                fetch: 'readonly',
                Worker: 'readonly',
                self: 'readonly',
                importScripts: 'readonly',

                // Application globals
                STATE: 'writable',
                CONFIG: 'readonly',
                Format: 'readonly',
                DataLogic: 'readonly',
                UI: 'readonly',
                lucide: 'readonly',
                Chart: 'readonly',
                flatpickr: 'readonly',
                supabase: 'readonly',
                supabaseClient: 'writable',

                // Test globals
                describe: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                jest: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            semi: ['error', 'always'],
            quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }]
        }
    }
];
