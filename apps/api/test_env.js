import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This matches apps/api/env.js
const envPath = path.join(__dirname, '../../.env');
console.log('Trying to load env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env:', result.error);
} else {
    console.log('Parsed:', result.parsed ? Object.keys(result.parsed) : 'none');
}

console.log('PG_HOST:', process.env.PG_HOST);
console.log('PG_PORT:', process.env.PG_PORT);
