// Environment bootstrap — MUST be imported before any module that reads
// process.env at load time (e.g. repositories/revenueRepository.js builds the
// pg Pool at import). ES modules evaluate all `import` statements before the
// body of index.js runs, so calling dotenv.config() in the body was too late:
// the Pool captured password=undefined. Importing this side-effect module first
// guarantees the .env is loaded before those pools are constructed.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env lives at the monorepo root (apps/api -> ../../.env)
dotenv.config({ path: path.join(__dirname, '../../.env') });
