import './env.js';

/**
 * DETAILED SUPABASE EDGE FUNCTION DIAGNOSTIC
 * Shows exactly what's configured and what's missing
 */

async function diagnose() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          SUPABASE EDGE FUNCTION DETAILED DIAGNOSTIC           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Section 1: Configuration
  console.log('📋 CONFIGURATION STATUS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Anon Key: ${anonKey ? '✅ Set' : '❌ Missing'}\n`);

  // Section 2: Edge Function Endpoint
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/revenue-data`;
  console.log('🎯 EDGE FUNCTION ENDPOINT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`URL: ${edgeFunctionUrl}\n`);

  // Section 3: Check if function exists
  console.log('🔍 CHECKING IF FUNCTION IS DEPLOYED');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    console.log('Sending GET request to edge function...\n');

    const response = await fetch(edgeFunctionUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);

    const contentType = response.headers.get('content-type');
    console.log(`Content-Type: ${contentType}`);

    const responseBody = await response.text();
    console.log(`Response Body:\n${responseBody}\n`);

    // Parse response
    let responseData;
    try {
      responseData = JSON.parse(responseBody);
    } catch (e) {
      responseData = responseBody;
    }

    if (response.status === 404) {
      console.log('❌ ERROR: HTTP 404 - Function Not Found\n');
      console.log('⚠️  WHAT THIS MEANS:');
      console.log('   The edge function "revenue-data" has NOT been deployed to Supabase cloud.');
      console.log('   It exists locally but needs to be deployed.\n');

      console.log('🚀 HOW TO FIX:\n');
      console.log('   Step 1: Authenticate with Supabase');
      console.log('   $ supabase link --project-ref zqbciwvyxgjoprsetbgw\n');

      console.log('   Step 2: Deploy the edge function');
      console.log('   $ supabase functions deploy revenue-data\n');

      console.log('   Step 3: Set database secrets in Supabase');
      console.log('   $ supabase secrets set PG_HOST=<your-db-host>');
      console.log('   $ supabase secrets set PG_PORT=<your-db-port>');
      console.log('   $ supabase secrets set PG_USER=<your-db-user>');
      console.log('   $ supabase secrets set PG_PASSWORD=<your-db-password>');
      console.log('   $ supabase secrets set PG_DATABASE=<your-db-name>\n');

      console.log('   Step 4: Verify secrets were set');
      console.log('   $ supabase secrets list\n');

      console.log('   Step 5: Test again');
      console.log('   $ node apps/api/diagnose-supabase.js\n');

      process.exit(1);
    }

    if (response.status === 500) {
      console.log('❌ ERROR: HTTP 500 - Internal Server Error\n');
      console.log('⚠️  WHAT THIS MEANS:');
      console.log('   The edge function is deployed but encountered an error.');
      console.log('   This usually means the database secrets are not configured.\n');

      if (responseData.error) {
        console.log(`Error Details: ${responseData.error}\n`);
      }

      console.log('🔧 HOW TO FIX:\n');
      console.log('   The edge function needs database credentials in Supabase secrets:');
      console.log('   $ supabase secrets set PG_HOST=<your-db-host>');
      console.log('   $ supabase secrets set PG_PORT=<your-db-port>');
      console.log('   $ supabase secrets set PG_USER=<your-db-user>');
      console.log('   $ supabase secrets set PG_PASSWORD=<your-db-password>');
      console.log('   $ supabase secrets set PG_DATABASE=<your-db-name>\n');

      console.log('   After setting secrets:');
      console.log('   $ supabase functions deploy revenue-data\n');

      process.exit(1);
    }

    if (response.status === 200) {
      console.log('✅ SUCCESS: Edge function is working!\n');

      if (Array.isArray(responseData)) {
        console.log(`✅ Retrieved ${responseData.length} revenue records\n`);

        if (responseData.length > 0) {
          console.log('📊 SAMPLE DATA (First Record):');
          console.log('───────────────────────────────────────────────────────────');
          const record = responseData[0];
          console.log(`  Invoice Date: ${record['Invoice date']}`);
          console.log(`  Invoice No: ${record['Invoice No']}`);
          console.log(`  Customer: ${record['Cust_name']}`);
          console.log(`  Revenue: ${record['Revenue']}`);
          console.log(`  Amount: ${record['Net Value']}\n`);

          console.log('✅ Edge function is correctly connected to the database!');
          console.log('✅ App can now fetch data successfully!\n');
        }
      }

      process.exit(0);
    }

    if (!response.ok) {
      console.log(`❌ ERROR: HTTP ${response.status}\n`);
      console.log('Unexpected error. Response:', responseBody);
      process.exit(1);
    }

  } catch (err) {
    console.log(`❌ ERROR: ${err.message}\n`);
    console.log('⚠️  TROUBLESHOOTING:');
    console.log('   1. Check your internet connection');
    console.log('   2. Verify Supabase URL is correct');
    console.log('   3. Verify Anon Key is correct');
    console.log('   4. Check that the edge function has been deployed');
    console.log('\nDetailed error:');
    console.log(err);
    process.exit(1);
  }
}

diagnose();
