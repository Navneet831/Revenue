async function testApi() {
    console.log('[TEST] Fetching from http://127.0.0.1:8000/api/v1/revenue...');
    try {
        const res = await fetch('http://127.0.0.1:8000/api/v1/revenue', {
            headers: { 'Authorization': 'Bearer test-token' }
        });
        console.log('[TEST] Status:', res.status);
        if (res.ok) {
            const data = await res.json();
            console.log('[TEST] Record count:', data.length);
            if (data.length > 0) {
                console.log('[TEST] Sample record:', JSON.stringify(data[0]));
            }
        } else {
            const text = await res.text();
            console.log('[TEST] Error body:', text);
        }
    } catch (err) {
        console.error('[TEST] Fetch failed:', err.message);
    }
}

testApi();
