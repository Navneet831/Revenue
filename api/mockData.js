// api/mockData.js
// Generates realistic mock revenue records for local testing and offline failovers

function generateMockRevenue(count = 1000) {
    const segments = ['Solar Modules', 'Solar Cells', 'EPC', 'O&M', 'Generic'];
    const salesHeads = ['A.K. Sharma', 'R.P. Singh', 'V.K. Mehta', 'S. Choudhury'];
    const customers = ['Adani Power', 'Tata Power', 'NTPC', 'ReNew Power', 'Azure Power', 'Hero Future', 'CleanMax'];
    const wps = ['540', '550', '580', '590', '600'];
    const statuses = ['realized', 'realized', 'realized', 'realized', 'pending'];

    const mockData = [];
    const startDate = new Date('2023-04-01').getTime();
    const endDate = new Date('2025-05-01').getTime();

    for (let i = 0; i < count; i++) {
        const time = startDate + Math.random() * (endDate - startDate);
        const date = new Date(time);

        const mw = parseFloat((Math.random() * 15 + 1).toFixed(2));
        const qty = Math.round(mw * 1500);
        const value = parseFloat((mw * 40000000 + Math.random() * 5000000).toFixed(2));
        const unitprice = parseFloat((value / qty).toFixed(2));

        mockData.push({
            id: i + 1,
            segment: segments[Math.floor(Math.random() * segments.length)],
            invoicedate: date.toISOString().split('T')[0],
            revenue: statuses[Math.floor(Math.random() * statuses.length)],
            saleshead: salesHeads[Math.floor(Math.random() * salesHeads.length)],
            values: value,
            qty: qty,
            mw: mw,
            unitprice: unitprice,
            custname: customers[Math.floor(Math.random() * customers.length)],
            wp: wps[Math.floor(Math.random() * wps.length)]
        });
    }
    return mockData;
}

module.exports = generateMockRevenue;
