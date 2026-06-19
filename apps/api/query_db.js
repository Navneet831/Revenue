import './env.js';

async function main() {
  const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/revenue-data`;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  console.log('Testing connection to Supabase Edge Function:', url);
  
  const res = await fetch(url, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });

  if (!res.ok) {
    throw new Error(`Supabase Edge Function query failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  console.log('--- SUPABASE CONNECTION TEST SUCCESSFUL ---');
  console.log('Total records retrieved:', data.length);
  if (data.length > 0) {
    console.log('First record sample:', JSON.stringify(data[0], null, 2));
  }
  console.log('-----------------------------------------');
}

main().catch(console.error);
