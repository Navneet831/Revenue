import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/access_whitelist?select=email,features`;
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function main() {
  if (!url || !key) {
    console.error('Supabase URL or Key is missing in env!');
    return;
  }
  const res = await fetch(url, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  if (!res.ok) {
    throw new Error(`Supabase REST error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  console.log('--- SUPABASE ACCESS WHITELIST ---');
  console.log(JSON.stringify(data, null, 2));
  console.log('---------------------------------');
}

main().catch(console.error);
