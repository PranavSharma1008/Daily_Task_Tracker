const test = require('node:test');
const assert = require('node:assert/strict');
const { computeUrgencyAndPriority } = require('../js/app.js');

test('Urgency Calculator — Task without due date', () => {
    const res = computeUrgencyAndPriority('', 'auto', 2);
    assert.strictEqual(res.isUrgent, false);
    assert.strictEqual(res.isOverdue, false);
    assert.strictEqual(res.priority, 'medium', 'Auto priority mode should fall back to medium');
    assert.strictEqual(res.dueLabel, '');
    assert.strictEqual(res.duePillClass, '');

    const customRes = computeUrgencyAndPriority(null, 'high', 2);
    assert.strictEqual(customRes.priority, 'high');
});

test('Urgency Calculator — Overdue Task (diffDays < 0)', () => {
    const baseDate = new Date(2026, 7, 15); // Aug 15, 2026
    const res = computeUrgencyAndPriority('2026-08-12', 'auto', 2, baseDate);

    assert.strictEqual(res.diffDays, -3);
    assert.strictEqual(res.isOverdue, true);
    assert.strictEqual(res.isUrgent, true);
    assert.strictEqual(res.duePillClass, 'overdue');
    assert.strictEqual(res.priority, 'urgent', 'Auto priority must escalate overdue tasks to urgent');
    assert.match(res.dueLabel, /OVERDUE/);
    assert.match(res.dueLabel, /3d overdue/);
});

test('Urgency Calculator — Due Today (diffDays === 0)', () => {
    const baseDate = new Date(2026, 7, 15);
    const res = computeUrgencyAndPriority('2026-08-15', 'auto', 2, baseDate);

    assert.strictEqual(res.diffDays, 0);
    assert.strictEqual(res.isOverdue, false);
    assert.strictEqual(res.isUrgent, true);
    assert.strictEqual(res.duePillClass, 'today');
    assert.strictEqual(res.priority, 'urgent');
    assert.match(res.dueLabel, /PRESENT DAY ALERT/);
});

test('Urgency Calculator — Inside High Alert Window (1 <= diffDays <= threshold)', () => {
    const baseDate = new Date(2026, 7, 15);
    // 2 days away, threshold is 3 days
    const res = computeUrgencyAndPriority('2026-08-17', 'auto', 3, baseDate);

    assert.strictEqual(res.diffDays, 2);
    assert.strictEqual(res.threshold, 3);
    assert.strictEqual(res.isOverdue, false);
    assert.strictEqual(res.isUrgent, true);
    assert.strictEqual(res.duePillClass, 'soon');
    assert.strictEqual(res.priority, 'urgent');
    assert.match(res.dueLabel, /HIGH ALERT/);
    assert.match(res.dueLabel, /2 days left/);
});

test('Urgency Calculator — Outside Alert Window (diffDays > threshold)', () => {
    const baseDate = new Date(2026, 7, 15);
    // 5 days away, threshold is 2 days
    const res = computeUrgencyAndPriority('2026-08-20', 'auto', 2, baseDate);

    assert.strictEqual(res.diffDays, 5);
    assert.strictEqual(res.isOverdue, false);
    assert.strictEqual(res.isUrgent, false);
    assert.strictEqual(res.duePillClass, 'normal');
    assert.strictEqual(res.priority, 'medium', 'When outside window and auto-escalate, stays medium');
    assert.match(res.dueLabel, /Due/);
    assert.match(res.dueLabel, /Alert on/);
    assert.match(res.dueLabel, /5 days left/);
});

test('Urgency Calculator — Custom manual priority preservation when outside window', () => {
    const baseDate = new Date(2026, 7, 15);
    const lowRes = computeUrgencyAndPriority('2026-08-25', 'low', 2, baseDate);
    assert.strictEqual(lowRes.priority, 'low');

    const highRes = computeUrgencyAndPriority('2026-08-25', 'high', 2, baseDate);
    assert.strictEqual(highRes.priority, 'high');
});

test('Urgency Calculator — Threshold parsing edge cases', () => {
    const baseDate = new Date(2026, 7, 15);

    // Threshold 0 (alert only on due date)
    const res0 = computeUrgencyAndPriority('2026-08-16', 'auto', 0, baseDate);
    assert.strictEqual(res0.threshold, 0);
    assert.strictEqual(res0.isUrgent, false, 'diffDays=1 is outside threshold 0');

    // Invalid threshold string defaults to 2
    const resInvalid = computeUrgencyAndPriority('2026-08-16', 'auto', 'abc', baseDate);
    assert.strictEqual(resInvalid.threshold, 2);
    assert.strictEqual(resInvalid.isUrgent, true, 'diffDays=1 is inside default threshold 2');

    // Negative threshold defaults to 2
    const resNeg = computeUrgencyAndPriority('2026-08-16', 'auto', -5, baseDate);
    assert.strictEqual(resNeg.threshold, 2);
});
