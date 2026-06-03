import 'dotenv/config';

async function simulateBoot() {
    console.log('[SIM] Fetching from http://127.0.0.1:8000/api/v1/revenue...');
    try {
        const res = await fetch('http://127.0.0.1:8000/api/v1/revenue', {
            headers: { 'Authorization': 'Bearer test-token' }
        });
        const raw = await res.json();
        console.log('[SIM] Raw count:', raw.length);

        const cleanedData = [];
        let rejectedCount = 0;

        raw.forEach((row) => {
            if (row.date) {
                const d = new Date(row.date);
                if (!isNaN(d.getTime())) {
                    cleanedData.push({ ...row, date: d });
                } else {
                    rejectedCount++;
                }
            } else {
                rejectedCount++;
            }
        });

        console.log('[SIM] Cleaned count:', cleanedData.length);
        console.log('[SIM] Rejected count:', rejectedCount);

        let maxT = -Infinity, minT = Infinity;
        const yS = new Set(), sS = new Set(), skS = new Set(), cS = new Set(), shS = new Set();
        
        cleanedData.forEach((r) => {
            const t = r.date.getTime();
            if (t > maxT) maxT = t; 
            if (t < minT) minT = t;
            yS.add(r.year); 
            sS.add(r.segment); 
            skS.add(r.wp); 
            cS.add(r.customer); 
            if (r.salesHead) shS.add(r.salesHead);
        });

        console.log('[SIM] maxT:', maxT);
        console.log('[SIM] minT:', minT);
        
        const latest = new Date(maxT);
        const isValidLatest = !isNaN(latest.getTime());
        console.log('[SIM] Is Valid Latest:', isValidLatest);
        if (isValidLatest) {
            console.log('[SIM] Latest Date String:', latest.toISOString());
        }

    } catch (err) {
        console.error('[SIM] Failed:', err.message);
    }
}

simulateBoot();
