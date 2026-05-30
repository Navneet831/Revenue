var CONFIG = {
    SHEET_ID: null,
    SHEET_NAME: "revenue",
    CURRENCY_DIVIDER: 10000000,
    FISCAL_MONTHS: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
    CALENDAR_MONTHS: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    FULL_MONTHS: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
};

/**
 * SRP: Format utility class handles dynamic output representations.
 * Constructed in ES5 style.
 */
function MetricFormatter() {}
MetricFormatter.formatValue = function(val, type, privacyMode) {
    var isPrivate = privacyMode || false;
    if (isPrivate) return "••••••";
    var num = Number(val) || 0;
    if (num === 0) {
        if (type === 'Amount') return "0.00 Cr";
        if (type === 'MW') return "0.00 MW";
        return "0.00 Qty";
    }
    var formatted = num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (type === 'Amount') return "₹ " + formatted + " Cr";
    if (type === 'MW') return formatted + " MW";
    return formatted + " Qty";
};
MetricFormatter.formatChartTooltip = function(val, type, privacyMode) {
    return this.formatValue(val, type, privacyMode);
};

var Format = {
    dynamic: function(val, type, privacyMode) {
        var isPrivate = (privacyMode !== undefined && privacyMode !== null) 
            ? privacyMode 
            : (typeof STATE !== 'undefined' && STATE.privacyMode);
        return MetricFormatter.formatValue(val, type, isPrivate);
    },
    chartTooltip: function(val, type, privacyMode) {
        var isPrivate = (privacyMode !== undefined && privacyMode !== null) 
            ? privacyMode 
            : (typeof STATE !== 'undefined' && STATE.privacyMode);
        return MetricFormatter.formatChartTooltip(val, type, isPrivate);
    }
};

/**
 * DSA: Time-series indexer provides binary search operations over chronological transactions.
 * Constructed in ES5 style for maximum compatibility.
 */
function ChronologicalIndexer(data) {
    this.data = data.slice().sort(function(a, b) {
        return a.date.getTime() - b.date.getTime();
    });
    this.timestamps = this.data.map(function(r) {
        return r.date.getTime();
    });
}
ChronologicalIndexer.prototype.findStartIndex = function(targetTime) {
    var low = 0;
    var high = this.timestamps.length - 1;
    var ans = this.timestamps.length;
    while (low <= high) {
        var mid = Math.floor((low + high) / 2);
        if (this.timestamps[mid] >= targetTime) {
            ans = mid;
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }
    return ans;
};
ChronologicalIndexer.prototype.findEndIndex = function(targetTime) {
    var low = 0;
    var high = this.timestamps.length - 1;
    var ans = -1;
    while (low <= high) {
        var mid = Math.floor((low + high) / 2);
        if (this.timestamps[mid] <= targetTime) {
            ans = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return ans;
};
ChronologicalIndexer.prototype.getRange = function(startTime, endTime) {
    var startIdx = this.findStartIndex(startTime);
    var endIdx = this.findEndIndex(endTime);
    if (startIdx > endIdx || startIdx >= this.data.length || endIdx < 0) {
        return [];
    }
    return this.data.slice(startIdx, endIdx + 1);
};

/**
 * SRP: DataSanitizer handles cleansing, column mapping, and default validation.
 */
function DataSanitizer() {}
DataSanitizer.parseFY = function(monthIdx, year) {
    return monthIdx >= 3 
        ? year + "-" + (year + 1).toString().slice(-2) 
        : (year - 1) + "-" + year.toString().slice(-2);
};
DataSanitizer.getFYStart = function(dateStr) {
    var d = new Date(dateStr);
    var m = d.getMonth();
    var y = d.getFullYear();
    return m >= 3 ? y + "-04-01" : (y - 1) + "-04-01";
};
DataSanitizer.formatDate = function(d) {
    try {
        if (!d || isNaN(d.getTime())) return "";
        var tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d - tzOffset).toISOString().split('T')[0];
    } catch (e) {
        return "";
    }
};
DataSanitizer.buildKeyMap = function(row) {
    var keys = Object.keys(row);
    var find = function(t) {
        return keys.find(function(k) {
            return k.toLowerCase().replace(/[^a-z0-9]/g, '') === t.toLowerCase().replace(/[^a-z0-9]/g, '');
        });
    };
    return {
        segment: find("segment") || "Segment",
        invoicedate: find("invoicedate") || "Invoice date",
        revenue: find("revenue") || "Revenue",
        saleshead: find("saleshead") || find("sales head") || find("manager"),
        values: find("values") || find("value") || find("amount") || "Values",
        qty: find("salesqty") || find("qty") || "SalesQty",
        mw: find("mw") || "MW",
        unitprice: find("unitprice") || "UnitPrice",
        custname: find("custname") || "Cust_name",
        wp: find("wp") || "WP"
    };
};
DataSanitizer.sanitize = function(row, keyMap) {
    try {
        var km = keyMap;
        var dateVal = row[km.invoicedate];
        var invDate = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (!invDate || isNaN(invDate)) return null;

        var revenueRaw = String(row[km.revenue] || "").trim().toLowerCase();
        var isPending = revenueRaw.includes("pending");
        var day = invDate.getDate();
        var monthIdx = invDate.getMonth();
        var year = invDate.getFullYear();

        var salesHeadRaw = String(row[km.saleshead] || "Direct/Unmapped").trim();
        var monthKey = year + "-" + (monthIdx < 10 ? '0' + monthIdx : monthIdx);

        var rawWp = row[km.wp];
        var wpStr = "Generic";
        if (rawWp !== null && rawWp !== undefined) {
            var s = String(rawWp).trim();
            if (!isNaN(s) && s !== "" && !isNaN(parseFloat(s))) {
                wpStr = Math.round(Number(s)).toString();
            } else {
                wpStr = s;
            }
        }

        return {
            date: invDate,
            monthIdx: monthIdx,
            year: year,
            monthKey: monthKey,
            day: day,
            week: Math.min(Math.ceil(day / 7), 5),
            val: Number(row[km.values]) || 0,
            qty: Number(row[km.qty]) || 0,
            mw: Number(row[km.mw]) || 0,
            unitPrice: Number(row[km.unitprice]) || 0,
            segment: String(row[km.segment] || "Unknown").trim(),
            salesHead: salesHeadRaw,
            customer: String(row[km.custname] || "Unidentified"),
            wp: wpStr,
            revenueStatus: revenueRaw,
            isPending: isPending
        };
    } catch (e) {
        return null;
    }
};

/**
 * SRP: ConcentrationAnalyser evaluates HHI concentrations and market share.
 */
function ConcentrationAnalyser() {}
ConcentrationAnalyser.calculateHHI = function(items) {
    if (!items || items.length === 0) return 0;
    var absValues = items.map(function(i) {
        return Math.abs(i.v || 0);
    });
    var totalAbs = absValues.reduce(function(a, b) {
        return a + b;
    }, 0);
    if (totalAbs <= 0) return 0;
    return absValues.reduce(function(sum, v) {
        return sum + Math.pow((v / totalAbs) * 100, 2);
    }, 0);
};
ConcentrationAnalyser.calculateGrowth = function(cur, prev) {
    if (cur === null || prev === null || cur === undefined || prev === undefined) return null;
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
};

/**
 * SOLID Core Engine Class coordinates calculators and analyzers.
 * ES5 Constructor function style.
 */
function RevenueComputeEngine(data, filters, latestDate, config) {
    this.rawData = data;
    this.filters = filters;
    this.latestDate = latestDate;
    this.config = config;

    // Perform DSA optimization by indexing data chronologically
    this.indexer = new ChronologicalIndexer(data);
}
RevenueComputeEngine.prototype.compute = function() {
    var f = this.filters;
    var CONFIG = this.config;
    var latestDate = this.latestDate;

    var buckets = { chart: { monthly: {}, weekly: {}, daily: {} } };
    CONFIG.FISCAL_MONTHS.forEach(function(m) {
        buckets.chart.monthly[m] = {};
        buckets.chart.weekly[m] = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };
        buckets.chart.daily[m] = Array(31).fill(0).map(function() { return {}; });
    });
    buckets.chart.quarterly = { 0: {}, 1: {}, 2: {}, 3: {} };
    var qtrMap = { 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1, 9: 2, 10: 2, 11: 2, 0: 3, 1: 3, 2: 3 };

    var tVal = 0, tMW = 0, tQty = 0;
    var kpiVal = 0, kpiMW = 0, kpiQty = 0;
    var last7DaysSales = 0;
    var activeSegments = new Set();
    var activePlotKeys = new Set();
    var rawFiltered = [];

    var kpi = {
        periodSales: 0, periodBreakdown: {}, periodActiveKeys: new Set(),
        mtd: 0, mtdBreakdown: {},
        qtd: 0, qtdBreakdown: {},
        ytd: 0, ytdBreakdown: {},
        prevMtd: 0, prevQtd: 0, prevYtd: 0,
        pending: 0, pendingBreakdown: {}
    };

    var sDateTime = f.startDate ? new Date(f.startDate).setHours(0, 0, 0, 0) : 0;
    var eDateTime = f.endDate ? new Date(f.endDate).setHours(23, 59, 59, 999) : Infinity;

    var filterStartTime = sDateTime;
    var filterEndTime = eDateTime;

    var curFY = DataSanitizer.parseFY(latestDate.getMonth(), latestDate.getFullYear());
    var currentSelectedFYStartYear = f.startDate 
        ? parseInt(new Date(f.startDate).getFullYear()) 
        : parseInt(curFY.split('-')[0]);
    var curFYStartYear = currentSelectedFYStartYear;

    if (f.matrixMonth) {
        var fmIdx = CONFIG.FISCAL_MONTHS.indexOf(f.matrixMonth);
        var colMonth = (fmIdx + 3) % 12;
        var colYear = fmIdx < 9 ? curFYStartYear : curFYStartYear + 1;
        filterStartTime = new Date(colYear, colMonth, 1).getTime();
        filterEndTime = new Date(colYear, colMonth + 1, 0, 23, 59, 59, 999).getTime();

        if (f.selectedWeek) {
            var startDay = (f.selectedWeek - 1) * 7 + 1;
            var endDay = Math.min(new Date(colYear, colMonth + 1, 0).getDate(), f.selectedWeek * 7);
            filterStartTime = new Date(colYear, colMonth, startDay).getTime();
            filterEndTime = new Date(colYear, colMonth, endDay, 23, 59, 59, 999).getTime();
        } else if (f.selectedDay) {
            filterStartTime = new Date(colYear, colMonth, f.selectedDay).setHours(0, 0, 0, 0);
            filterEndTime = new Date(colYear, colMonth, f.selectedDay, 23, 59, 59, 999).getTime();
        }
    } else if (f.selectedQuarter !== null) {
        var quarters = [[3, 4, 5], [6, 7, 8], [9, 10, 11], [0, 1, 2]];
        var qMonths = quarters[f.selectedQuarter];
        var startM = qMonths[0];
        var endM = qMonths[2];
        var sYear = startM >= 3 ? curFYStartYear : curFYStartYear + 1;
        var eYear = endM >= 3 ? curFYStartYear : curFYStartYear + 1;
        filterStartTime = new Date(sYear, startM, 1).getTime();
        filterEndTime = new Date(eYear, endM + 1, 0, 23, 59, 59, 999).getTime();
    }

    var kpiAnchorDate = new Date(filterEndTime);
    if (kpiAnchorDate > latestDate) {
        kpiAnchorDate = new Date(latestDate);
    }
    kpiAnchorDate.setHours(23, 59, 59, 999);

    var kpiAnchorTime = kpiAnchorDate.getTime();
    var dayMs = 24 * 60 * 60 * 1000;
    var anchorDay = kpiAnchorDate.getDate();
    var curMonth = kpiAnchorDate.getMonth();
    var curYear = kpiAnchorDate.getFullYear();
    var curDate = kpiAnchorDate.getDate();

    var metric = f.metric;
    var customStart = f.customStartDate ? new Date(f.customStartDate) : null;
    if (customStart) customStart.setHours(0, 0, 0, 0);
    var customStartTime = customStart ? customStart.getTime() : 0;

    var isOnlySolar = f.segment.length === 1 && f.segment[0].toLowerCase().includes('solar');
    var global_full = {};
    var global_paced = {};

    var shObj = {}, custObj = {}, wpObj = {};
    var segmentFilterSet = new Set(f.segment);
    var shFilterSet = new Set(f.salesHead);
    var custFilterSet = new Set(f.customer);
    var skuFilterSet = new Set(f.selectedSku);

    var excludedSet = f.excludedSeries || new Set();

    // 1. First Pass: Compute historical pacing datasets
    for (var i = 0; i < this.rawData.length; i++) {
        var r = this.rawData[i];
        if (segmentFilterSet.size > 0 && !segmentFilterSet.has(r.segment)) continue;

        var rTime = r.date.getTime();
        var rMonth = r.monthIdx;
        var rYear = r.year;
        var key = r.monthKey;

        var isPaced = (rMonth !== curMonth) || (r.day <= anchorDay);
        var metricVal = metric === 'Amount' ? r.val : (metric === 'MW' ? r.mw : r.qty);
        var plotKey = isOnlySolar ? r.wp : r.segment;

        activePlotKeys.add(plotKey);
        var isExcluded = excludedSet.has(plotKey);

        if (!isExcluded) {
            var matchesDrilldown = (shFilterSet.size === 0 || shFilterSet.has(r.salesHead)) &&
                                     (custFilterSet.size === 0 || custFilterSet.has(r.customer)) &&
                                     (skuFilterSet.size === 0 || skuFilterSet.has(r.wp));

            if (matchesDrilldown) {
                if (r.isPending) {
                    if (rTime >= sDateTime && rTime <= eDateTime) {
                        kpi.pending += metricVal;
                        kpi.pendingBreakdown[plotKey] = (kpi.pendingBreakdown[plotKey] || 0) + metricVal;
                    }
                } else {
                    var isCustomPeriodActive = !!(f.startDate && f.customStartDate && f.startDate !== f.customStartDate);
                    if (isCustomPeriodActive && customStart) {
                        if (rTime >= customStartTime && rTime <= eDateTime) {
                            kpi.periodSales += metricVal;
                            kpi.periodBreakdown[plotKey] = (kpi.periodBreakdown[plotKey] || 0) + metricVal;
                            kpi.periodActiveKeys.add(plotKey);
                        }
                    } else {
                        if (rYear === curYear && rMonth === curMonth && r.day === curDate) {
                            kpi.periodSales += metricVal;
                            kpi.periodBreakdown[plotKey] = (kpi.periodBreakdown[plotKey] || 0) + metricVal;
                            kpi.periodActiveKeys.add(plotKey);
                        }
                    }

                    if (rTime > kpiAnchorTime - 7 * dayMs && rTime <= kpiAnchorTime) {
                        last7DaysSales += metricVal;
                    }
                }

                var isTargetStateForMatrix = f.pendingOnly ? r.isPending : !r.isPending;
                if (isTargetStateForMatrix) {
                    if (!global_full[key]) global_full[key] = { val: 0, mw: 0, qty: 0, metricVal: 0, plotKeys: {}, hasData: false };
                    global_full[key].val += r.val;
                    global_full[key].mw += r.mw;
                    global_full[key].qty += r.qty;
                    global_full[key].metricVal += metricVal;
                    global_full[key].plotKeys[plotKey] = (global_full[key].plotKeys[plotKey] || 0) + metricVal;
                    global_full[key].hasData = true;

                    if (isPaced) {
                        if (!global_paced[key]) global_paced[key] = { val: 0, mw: 0, qty: 0, metricVal: 0, plotKeys: {}, hasData: false };
                        global_paced[key].val += r.val;
                        global_paced[key].mw += r.mw;
                        global_paced[key].qty += r.qty;
                        global_paced[key].metricVal += metricVal;
                        global_paced[key].plotKeys[plotKey] = (global_paced[key].plotKeys[plotKey] || 0) + metricVal;
                        global_paced[key].hasData = true;
                    }
                }
            }
        }
    }

    // 2. Second Pass: Range-Bounded Analytics
    // DSA Optimization: We query only records within [filterStartTime, filterEndTime] via binary search slicing!
    var rangeRecords = this.indexer.getRange(filterStartTime, filterEndTime);

    for (var j = 0; j < rangeRecords.length; j++) {
        var r = rangeRecords[j];
        
        if (segmentFilterSet.size > 0 && !segmentFilterSet.has(r.segment)) continue;

        var isTargetState = f.pendingOnly ? r.isPending : !r.isPending;
        if (!isTargetState) continue;

        if (shFilterSet.size > 0 && !shFilterSet.has(r.salesHead)) continue;
        if (custFilterSet.size > 0 && !custFilterSet.has(r.customer)) continue;
        if (skuFilterSet.size > 0 && !skuFilterSet.has(r.wp)) continue;

        var plotKey = isOnlySolar ? r.wp : r.segment;
        var isExcluded = excludedSet.has(plotKey);

        if (!isExcluded) {
            var metricVal = metric === 'Amount' ? r.val : (metric === 'MW' ? r.mw : r.qty);

            if (!shObj[r.salesHead]) shObj[r.salesHead] = { val: 0, mw: 0, qty: 0, comps: new Set(), plotKeys: {} };
            shObj[r.salesHead].val += r.val; shObj[r.salesHead].mw += r.mw; shObj[r.salesHead].qty += r.qty;
            shObj[r.salesHead].plotKeys[plotKey] = (shObj[r.salesHead].plotKeys[plotKey] || 0) + metricVal;
            if (r.customer) shObj[r.salesHead].comps.add(r.customer);

            if (!custObj[r.customer]) custObj[r.customer] = { val: 0, mw: 0, qty: 0, plotKeys: {} };
            custObj[r.customer].val += r.val; custObj[r.customer].mw += r.mw; custObj[r.customer].qty += r.qty;
            custObj[r.customer].plotKeys[plotKey] = (custObj[r.customer].plotKeys[plotKey] || 0) + metricVal;

            if (!wpObj[r.wp]) wpObj[r.wp] = { val: 0, mw: 0, qty: 0, plotKeys: {} };
            wpObj[r.wp].val += r.val; wpObj[r.wp].mw += r.mw; wpObj[r.wp].qty += r.qty;
            wpObj[r.wp].plotKeys[plotKey] = (wpObj[r.wp].plotKeys[plotKey] || 0) + metricVal;

            kpiVal += r.val; kpiMW += r.mw; kpiQty += r.qty;
            rawFiltered.push(r);
            activeSegments.add(r.segment);

            tVal += r.val; tMW += r.mw; tQty += r.qty;
        }

        // Monthly / Weekly / Daily / Quarterly Charting Distribution calculations
        var plotKeyChart = plotKey;
        var rMonth = r.monthIdx;
        var rfmIdx = rMonth >= 3 ? rMonth - 3 : rMonth + 9;
        var mName = CONFIG.FISCAL_MONTHS[rfmIdx];
        var metricVal = metric === 'Amount' ? r.val : (metric === 'MW' ? r.mw : r.qty);

        buckets.chart.monthly[mName][plotKeyChart] = (buckets.chart.monthly[mName][plotKeyChart] || 0) + metricVal;
        if (r.week <= 5) buckets.chart.weekly[mName][r.week][plotKeyChart] = (buckets.chart.weekly[mName][r.week][plotKeyChart] || 0) + metricVal;
        if (r.day <= 31) buckets.chart.daily[mName][r.day - 1][plotKeyChart] = (buckets.chart.daily[mName][r.day - 1][plotKeyChart] || 0) + metricVal;

        var qIdx = qtrMap[r.monthIdx];
        buckets.chart.quarterly[qIdx][plotKeyChart] = (buckets.chart.quarterly[qIdx][plotKeyChart] || 0) + metricVal;
    }

    // 3. Post-Process KPI Pacing Metrics
    var curKey = curYear + "-" + String(curMonth).padStart(2, '0');
    var prevMonthDate = new Date(curYear, curMonth - 1, 1);
    var prevMKey = prevMonthDate.getFullYear() + "-" + String(prevMonthDate.getMonth()).padStart(2, '0');
    var prevYearSameMonthDate = new Date(curYear - 1, curMonth, 1);
    var prevYKey = prevYearSameMonthDate.getFullYear() + "-" + String(prevYearSameMonthDate.getMonth()).padStart(2, '0');

    kpi.mtd = global_paced[curKey] && global_paced[curKey].hasData ? global_paced[curKey].metricVal : 0;
    kpi.mtdBreakdown = global_paced[curKey] && global_paced[curKey].hasData ? global_paced[curKey].plotKeys : {};
    kpi.prevMtd = global_paced[prevMKey] && global_paced[prevMKey].hasData ? global_paced[prevMKey].metricVal : 0;
    var prevYearMtd = global_paced[prevYKey] && global_paced[prevYKey].hasData ? global_paced[prevYKey].metricVal : 0;

    var getQTD = function(year, endMonth) {
        var sum = 0;
        var breakdown = {};
        var qStart = Math.floor(endMonth / 3) * 3;
        for (var m = qStart; m <= endMonth; m++) {
            var k = year + "-" + String(m).padStart(2, '0');
            if (global_paced[k] && global_paced[k].hasData) {
                sum += global_paced[k].metricVal;
                Object.keys(global_paced[k].plotKeys).forEach(function(pk) {
                    breakdown[pk] = (breakdown[pk] || 0) + global_paced[k].plotKeys[pk];
                });
            }
        }
        return { sum: sum, breakdown: breakdown };
    };

    var qRes = getQTD(curYear, curMonth);
    kpi.qtd = qRes.sum;
    kpi.qtdBreakdown = qRes.breakdown;
    kpi.prevQtd = getQTD(curYear - 1, curMonth).sum;

    var getYTD = function(year, endMonth) {
        var sum = 0;
        var breakdown = {};
        var startYear = endMonth < 3 ? year - 1 : year;
        var currentM = 3;
        var currentY = startYear;
        while (true) {
            var k = currentY + "-" + String(currentM).padStart(2, '0');
            if (global_paced[k] && global_paced[k].hasData) {
                sum += global_paced[k].metricVal;
                Object.keys(global_paced[k].plotKeys).forEach(function(pk) {
                    breakdown[pk] = (breakdown[pk] || 0) + global_paced[k].plotKeys[pk];
                });
            }
            if (currentY === year && currentM === endMonth) break;
            currentM++;
            if (currentM > 11) { currentM = 0; currentY++; }
            if (currentY > year + 1) break;
        }
        return { sum: sum, breakdown: breakdown };
    };

    var yRes = getYTD(curYear, curMonth);
    kpi.ytd = yRes.sum;
    kpi.ytdBreakdown = yRes.breakdown;
    kpi.prevYtd = getYTD(curYear - 1, curMonth).sum;

    // 4. Matrix Generation
    var matrixArr = CONFIG.FISCAL_MONTHS.map(function(mName, i) {
        var colMonth = (i + 3) % 12;
        var colYear = i < 9 ? curFYStartYear : curFYStartYear + 1;
        var keyCur = colYear + "-" + String(colMonth).padStart(2, '0');
        var pMD = new Date(colYear, colMonth - 1, 1);
        var keyPrevM = pMD.getFullYear() + "-" + String(pMD.getMonth()).padStart(2, '0');
        var keyPrevY = (colYear - 1) + "-" + String(colMonth).padStart(2, '0');

        var curPaced = global_paced[keyCur] ? global_paced[keyCur].metricVal || 0 : 0;
        var prevMPaced = global_paced[keyPrevM] ? global_paced[keyPrevM].metricVal || 0 : 0;
        var prevYPaced = global_paced[keyPrevY] ? global_paced[keyPrevY].metricVal || 0 : 0;

        var colQTD = getQTD(colYear, colMonth).sum;
        var prevYQTD = getQTD(colYear - 1, colMonth).sum;

        var mom = ConcentrationAnalyser.calculateGrowth(curPaced, prevMPaced);
        var yoy = ConcentrationAnalyser.calculateGrowth(curPaced, prevYPaced);
        var qoq = ConcentrationAnalyser.calculateGrowth(colQTD, prevYQTD);

        var fullCur = global_full[keyCur] || { val: 0, mw: 0, qty: 0, hasData: false };

        return {
            month: mName,
            valCr: fullCur.hasData ? fullCur.val / CONFIG.CURRENCY_DIVIDER : (fullCur.val > 0 ? fullCur.val / CONFIG.CURRENCY_DIVIDER : null),
            mw: fullCur.hasData ? fullCur.mw : (fullCur.mw > 0 ? fullCur.mw : null),
            qty: fullCur.hasData ? fullCur.qty : (fullCur.qty > 0 ? fullCur.qty : null),
            mom: mom, yoy: yoy, qoq: qoq
        };
    });

    var totals = matrixArr.reduce(function(acc, curr) {
        if (curr.valCr !== null) acc.valCr += curr.valCr;
        if (curr.mw !== null) acc.mw += curr.mw;
        if (curr.qty !== null) acc.qty += curr.qty;
        return acc;
    }, { valCr: 0, mw: 0, qty: 0 });

    matrixArr.push({
        month: 'Total',
        valCr: totals.valCr,
        mw: totals.mw,
        qty: totals.qty,
        mom: null, yoy: null, qoq: null
    });

    // 5. Output mapping helper
    var mapObjToArray = function(obj) {
        return Object.keys(obj).map(function(k) {
            var v = obj[k];
            return {
                n: k,
                v: metric === 'Amount' ? v.val / CONFIG.CURRENCY_DIVIDER : metric === 'MW' ? v.mw : v.qty,
                raw: v,
                plotKeys: v.plotKeys || {},
                comps: v.comps ? Array.from(v.comps) : []
            };
        });
    };

    var shArr = mapObjToArray(shObj);
    var custArr = mapObjToArray(custObj);
    var wpArr = mapObjToArray(wpObj);

    // 6. Insight Engine
    var insights = [];
    var curMonthDays = new Date(curYear, curMonth + 1, 0).getDate();
    var weekAvg = last7DaysSales / 7;
    var projWeek = weekAvg * curMonthDays;
    var isAccel = kpi.mtd !== null && projWeek > kpi.mtd;

    var formatInsightVal = function(v) {
        if (f.metric === 'Amount') return "₹ " + (v / CONFIG.CURRENCY_DIVIDER).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Cr";
        if (f.metric === 'MW') return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MW";
        return Math.round(v).toLocaleString('en-IN') + " Qty";
    };

    insights.push({
        t: isAccel ? 'success' : 'risk',
        l: 'MOMENTUM (7-DAY AVG)',
        txt: "Recent trailing velocity projects " + formatInsightVal(projWeek) + " for the current period."
    });

    var unfiltCust = custArr.sort(function(a, b) { return b.v - a.v; });
    var sumCustAbs = unfiltCust.reduce(function(a, c) { return a + Math.abs(c.v); }, 0);
    var hhi = ConcentrationAnalyser.calculateHHI(unfiltCust);
    var top5 = unfiltCust.slice(0, 5);
    var top5Share = sumCustAbs > 0 ? (top5.reduce(function(a, c) { return a + Math.abs(c.v); }, 0) / sumCustAbs) * 100 : 0;
    var concText = hhi < 1500 ? 'Diversified' : (hhi < 2500 ? 'Moderate' : 'Highly Concentrated');
    var concType = hhi < 1500 ? 'success' : (hhi < 2500 ? 'strategic' : 'risk');
    
    insights.push({
        t: concType,
        l: 'CUSTOMER CONCENTRATION',
        txt: "Top 5 hold " + top5Share.toFixed(1) + "%. HHI Score: " + hhi.toFixed(0) + " (" + concText + ")."
    });

    var unfiltWp = wpArr.sort(function(a, b) { return b.v - a.v; });
    var sumWPAbs = unfiltWp.reduce(function(a, c) { return a + Math.abs(c.v); }, 0);
    var prodHhi = ConcentrationAnalyser.calculateHHI(unfiltWp);
    var top3Prod = unfiltWp.slice(0, 3);
    var top3ProdShare = sumWPAbs > 0 ? (top3Prod.reduce(function(a, c) { return a + Math.abs(c.v); }, 0) / sumWPAbs) * 100 : 0;
    
    insights.push({
        t: 'strategic',
        l: 'PRODUCT CONCENTRATION',
        txt: "Top 3 SKUs hold " + top3ProdShare.toFixed(1) + "%. HHI Score: " + prodHhi.toFixed(0) + "."
    });

    if (tMW > 0) {
        insights.push({
            t: 'strategic',
            l: 'YIELD',
            txt: "Net Realization: ₹ " + ((tVal / CONFIG.CURRENCY_DIVIDER) / tMW).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " / MW."
        });
    }

    return {
        kpi: kpi,
        prevYearMtd: prevYearMtd,
        buckets: buckets,
        matrix: matrixArr,
        sh: shArr,
        cust: custArr,
        wp: wpArr,
        insights: insights,
        activeSegments: Array.from(activeSegments).sort(),
        activePlotKeys: Array.from(activePlotKeys).sort(),
        rawFiltered: rawFiltered,
        kpiAnchorDate: kpiAnchorDate,
        last7DaysSales: last7DaysSales,
        totalCr: tVal / CONFIG.CURRENCY_DIVIDER,
        totalMW: tMW,
        totalQty: tQty,
        kpiCr: kpiVal / CONFIG.CURRENCY_DIVIDER,
        kpiMW: kpiMW,
        kpiQty: kpiQty,
        realization: tMW > 0 ? (tVal / CONFIG.CURRENCY_DIVIDER) / tMW : 0,
        isOnlySolar: isOnlySolar
    };
};

// Retrocompatible API structures mapping cleanly to standard modules
var DataLogic = {
    parseFY: DataSanitizer.parseFY,
    getFYStart: DataSanitizer.getFYStart,
    formatDate: DataSanitizer.formatDate,
    buildKeyMap: DataSanitizer.buildKeyMap,
    sanitize: DataSanitizer.sanitize,
    calculateGrowth: ConcentrationAnalyser.calculateGrowth,
    calculateHHI: ConcentrationAnalyser.calculateHHI,
    getDaysInMonth: function(y, m) { return new Date(y, m + 1, 0).getDate(); },
    computeEngine: function(data, filters, latestDate, config) {
        var engine = new RevenueComputeEngine(data, filters, latestDate, config || CONFIG);
        return engine.compute();
    }
};

if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    window.Format = Format;
    window.DataLogic = DataLogic;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG: CONFIG, Format: Format, DataLogic: DataLogic };
}
