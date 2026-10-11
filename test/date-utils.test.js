const test = require('node:test');
const assert = require('node:assert/strict');
const {
    toISODateString,
    parseISODateString,
    isSameDay,
    calendarDayDifference,
    formatTimeDisplay,
    escapeHTML
} = require('../js/app.js');

test('Date Utils — toISODateString', () => {
    const d = new Date(2026, 7, 13); // Note: month index 7 is August
    assert.strictEqual(toISODateString(d), '2026-08-13');

    // Handles leap day
    const leapDay = new Date(2028, 1, 29); // February 29, 2028
    assert.strictEqual(toISODateString(leapDay), '2028-02-29');

    // Fallback on null, undefined, invalid date
    const fallbackStr = toISODateString(null);
    assert.match(fallbackStr, /^\d{4}-\d{2}-\d{2}$/);

    const invalidStr = toISODateString(new Date('invalid date string'));
    assert.match(invalidStr, /^\d{4}-\d{2}-\d{2}$/);
});

test('Date Utils — parseISODateString', () => {
    const parsed = parseISODateString('2026-08-15');
    assert.strictEqual(parsed.getFullYear(), 2026);
    assert.strictEqual(parsed.getMonth(), 7); // August
    assert.strictEqual(parsed.getDate(), 15);
    assert.strictEqual(parsed.getHours(), 0);
    assert.strictEqual(parsed.getMinutes(), 0);

    // Handles whitespace
    const trimmed = parseISODateString('  2026-12-31  ');
    assert.strictEqual(trimmed.getFullYear(), 2026);
    assert.strictEqual(trimmed.getMonth(), 11);
    assert.strictEqual(trimmed.getDate(), 31);

    // Fallback on invalid string
    const fallback = parseISODateString('not-a-date');
    assert.strictEqual(fallback instanceof Date, true);
    assert.strictEqual(isNaN(fallback.getTime()), false);

    // Fallback on null/undefined
    const nullFallback = parseISODateString(null);
    assert.strictEqual(nullFallback instanceof Date, true);
});

test('Date Utils — isSameDay', () => {
    const d1 = new Date(2026, 9, 11, 8, 30);
    const d2 = new Date(2026, 9, 11, 22, 45);
    const d3 = new Date(2026, 9, 12, 8, 30);

    assert.strictEqual(isSameDay(d1, d2), true, 'Same calendar day at different times should be equal');
    assert.strictEqual(isSameDay(d1, d3), false, 'Different calendar days should not be equal');
    assert.strictEqual(isSameDay(d1, null), false, 'Null comparison should return false');
    assert.strictEqual(isSameDay(new Date('invalid'), d1), false, 'Invalid Date should return false');
});

test('Date Utils — calendarDayDifference', () => {
    // Same day
    assert.strictEqual(calendarDayDifference('2026-08-10', '2026-08-10'), 0);

    // Future day (positive)
    assert.strictEqual(calendarDayDifference('2026-08-10', '2026-08-15'), 5);

    // Past day / overdue (negative)
    assert.strictEqual(calendarDayDifference('2026-08-15', '2026-08-10'), -5);

    // Month boundary
    assert.strictEqual(calendarDayDifference('2026-07-31', '2026-08-01'), 1);

    // Year boundary
    assert.strictEqual(calendarDayDifference('2026-12-31', '2027-01-01'), 1);

    // Leap year boundary (2028 is a leap year)
    assert.strictEqual(calendarDayDifference('2028-02-28', '2028-03-01'), 2);
});

test('Date Utils — formatTimeDisplay', () => {
    assert.strictEqual(formatTimeDisplay('00:00'), '12:00 AM');
    assert.strictEqual(formatTimeDisplay('09:05'), '9:05 AM');
    assert.strictEqual(formatTimeDisplay('12:00'), '12:00 PM');
    assert.strictEqual(formatTimeDisplay('13:45'), '1:45 PM');
    assert.strictEqual(formatTimeDisplay('23:59'), '11:59 PM');

    // Edge cases
    assert.strictEqual(formatTimeDisplay(''), '');
    assert.strictEqual(formatTimeDisplay(null), '');
    assert.strictEqual(formatTimeDisplay(undefined), '');
    assert.strictEqual(formatTimeDisplay('invalid'), '');
});

test('Date Utils — escapeHTML', () => {
    assert.strictEqual(escapeHTML('Hello & <World> "Test" \'Quote\''), 'Hello &amp; &lt;World&gt; &quot;Test&quot; &#39;Quote&#39;');
    assert.strictEqual(escapeHTML(''), '');
    assert.strictEqual(escapeHTML(null), '');
    assert.strictEqual(escapeHTML(undefined), '');
    assert.strictEqual(escapeHTML(12345), '12345');
});
