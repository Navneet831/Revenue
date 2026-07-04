import './env.js';

/**
 * DIAGNOSTIC: Check which database is currently configured in Supabase secrets
 * This helps you verify which database the edge function will connect to
 */

async function checkDatabaseConfig() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     DATABASE CONFIGURATION DIAGNOSTIC                   ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (!supabaseUrl || !anonKey) {
    console.error('❌ Missing Supabase credentials in .env');
    console.error(`   VITE_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
    console.error(`   VITE_SUPABASE_ANON_KEY: ${anonKey ? '✅ Set' : '❌ Missing'}`);
    process.exit(1);
  }

  console.log('📍 Supabase Project URL:', supabaseUrl);
  console.log('🔑 Anon Key (first 20 chars):', anonKey.substring(0, 20) + '...\n');

  // Check local .env configuration
  console.log('📋 LOCAL .env DATABASE CONFIGURATION:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Host:', process.env.PG_HOST || '❌ NOT SET');
  console.log('Port:', process.env.PG_PORT || '❌ NOT SET');
  console.log('User:', process.env.PG_USER || '❌ NOT SET');
  console.log('Database:', process.env.PG_DATABASE || '❌ NOT SET');
  console.log('Password:', process.env.PG_PASSWORD ? '✅ Set (hidden)' : '❌ NOT SET\n');

  // Test connection to the database
  console.log('\n🧪 TESTING DATABASE CONNECTION:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/revenue-data`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });

    if (!response.ok) {
      console.error(`❌ Edge Function Error [HTTP ${response.status}]`);
      const errorText = await response.text();
      console.error('Response:', errorText);
      console.log('\n⚠️  POSSIBLE ISSUES:');
      console.log('   1. Supabase secrets (PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE)');
      console.log('      are NOT set in Supabase project settings');
      console.log('   2. The database at the configured address is unreachable');
      console.log('   3. Database credentials are incorrect');
      process.exit(1);
    }

    const data = await response.json();

    if (data.error) {
      console.error('❌ Database Error:', data.error);
      console.log('\n⚠️  The edge function received an error from the database.');
      console.log('   Check that the secrets in Supabase point to an accessible database.');
      process.exit(1);
    }

    console.log('✅ CONNECTION SUCCESSFUL!');
    console.log(`   Total records retrieved: ${data.length}`);

    if (data.length > 0) {
      console.log('\n📊 SAMPLE RECORD (First):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      const sample = data[0];
      console.log('   Invoice Date:', sample['Invoice date']);
      console.log('   Invoice No:', sample['Invoice No']);
      console.log('   Customer Name:', sample['Cust_name']);
      console.log('   Revenue:', sample['Revenue']);
      console.log('   Amount:', sample['Net Value']);
    }

    console.log('\n✅ Edge function is correctly connected to the database!');

  } catch (err) {
    console.error('❌ Connection Failed:', err.message);
    console.log('\n⚠️  TROUBLESHOOTING:');
    console.log('   1. Verify VITE_SUPABASE_URL is correct');
    console.log('   2. Verify VITE_SUPABASE_ANON_KEY is correct');
    console.log('   3. Check that Supabase project contains the revenue-data edge function');
    console.log('   4. Ensure the edge function has been deployed');
    process.exit(1);
  }
}

checkDatabaseConfig();
