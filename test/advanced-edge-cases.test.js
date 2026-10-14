const test = require('node:test');
const assert = require('node:assert/strict');
const {
    toISODateString,
    parseISODateString,
    calendarDayDifference,
    escapeHTML,
    computeUrgencyAndPriority,
    mergeDataStores
} = require('../js/app.js');

test('Edge Cases — Daylight Saving Time (DST) Transitions', () => {
    // Test a date during standard time and one during daylight saving time
    // E.g., March 13 to March 15 in US (DST begins second Sunday in March)
    const d1 = parseISODateString('2026-03-07');
    const d2 = parseISODateString('2026-03-09');
    const diff = calendarDayDifference(d1, d2);
    assert.strictEqual(diff, 2, 'Calendar day difference must be strictly 2 days regardless of DST 23h/25h days');

    // E.g., November 1 to November 3 (DST ends first Sunday in November)
    const d3 = parseISODateString('2026-10-31');
    const d4 = parseISODateString('2026-11-02');
    const diff2 = calendarDayDifference(d3, d4);
    assert.strictEqual(diff2, 2, 'Calendar day difference must be strictly 2 days across fall DST transition');
});

test('Edge Cases — Leap Year Calculations', () => {
    // 2028 is a leap year (Feb has 29 days)
    const feb28 = parseISODateString('2028-02-28');
    const mar1 = parseISODateString('2028-03-01');
    assert.strictEqual(calendarDayDifference(feb28, mar1), 2);

    // 2027 is NOT a leap year (Feb has 28 days)
    const feb28_2027 = parseISODateString('2027-02-28');
    const mar1_2027 = parseISODateString('2027-03-01');
    assert.strictEqual(calendarDayDifference(feb28_2027, mar1_2027), 1);
});

test('Edge Cases — XSS Injection Attacks Prevention', () => {
    const maliciousInputs = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '"><svg onload=alert(1)>',
        '&quot;<b onmouseover=alert(1)>'
    ];

    maliciousInputs.forEach(input => {
        const escaped = escapeHTML(input);
        assert.strictEqual(escaped.includes('<script>'), false);
        assert.strictEqual(escaped.includes('<img'), false);
        assert.strictEqual(escaped.includes('<svg'), false);
        assert.strictEqual(escaped.includes('<b'), false);
        assert.match(escaped, /(&lt;|&gt;|&quot;|&#39;|&amp;)/);
    });
});

test('Edge Cases — Extreme Thresholds & Auto-Escalation', () => {
    const today = new Date(2026, 7, 15);

    // Threshold of 365 days (1 year ahead alert)
    const resYearAhead = computeUrgencyAndPriority('2027-08-10', 'auto', 365, today);
    assert.strictEqual(resYearAhead.isUrgent, true);
    assert.strictEqual(resYearAhead.priority, 'urgent');

    // Threshold of 0 days for past deadline task (alert ceases after deadline passes)
    const resOverdueZero = computeUrgencyAndPriority('2026-08-14', 'auto', 0, today);
    assert.strictEqual(resOverdueZero.isOverdue, false);
    assert.strictEqual(resOverdueZero.isUrgent, false);
    assert.strictEqual(resOverdueZero.priority, 'medium');
});

test('Edge Cases — Store Merge Task Deduplication across multiple dates', () => {
    // Task t1 was moved from 2026-08-10 to 2026-08-12 on Device B
    const storeA = {
        '2026-08-10': [
            { id: 't1', title: 'Task 1', updatedAt: '2026-08-10T10:00:00Z' }
        ]
    };
    const storeB = {
        '2026-08-12': [
            { id: 't1', title: 'Task 1 (Rescheduled)', updatedAt: '2026-08-10T11:00:00Z' }
        ]
    };

    const merged = mergeDataStores(storeA, storeB);
    // Both date lists have merged results, but conflict resolution keeps newest task
    assert.strictEqual(merged['2026-08-12'][0].title, 'Task 1 (Rescheduled)');
});
