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

test('Urgency Calculator — Past Deadline Task (diffDays < 0)', () => {
    const baseDate = new Date(2026, 7, 15); // Aug 15, 2026
    const res = computeUrgencyAndPriority('2026-08-12', 'auto', 2, baseDate);

    assert.strictEqual(res.diffDays, -3);
    assert.strictEqual(res.isOverdue, false, 'Overdue alerts turned off past deadline');
    assert.strictEqual(res.isUrgent, false, 'Urgency alert ceases once deadline has passed');
    assert.strictEqual(res.duePillClass, 'normal');
    assert.strictEqual(res.priority, 'medium', 'Auto priority returns to medium once deadline passes');
    assert.strictEqual(res.dueLabel, '📅 Due Aug 12');
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

test('Urgency Calculator — Extending date from Today to +3 days transitions priority from urgent to medium', () => {
    const baseDate = new Date(2026, 7, 15);
    // Task originally due today
    const todayRes = computeUrgencyAndPriority('2026-08-15', 'auto', 2, baseDate);
    assert.strictEqual(todayRes.priority, 'urgent');
    assert.strictEqual(todayRes.isUrgent, true);

    // User extends deadline by 3 days (to 2026-08-18)
    const extendedRes = computeUrgencyAndPriority('2026-08-18', 'auto', 2, baseDate);
    assert.strictEqual(extendedRes.priority, 'medium', 'Priority must change from urgent to medium when extended past alert threshold');
    assert.strictEqual(extendedRes.isUrgent, false, 'Alert must turn off when extended past alert threshold');
    assert.strictEqual(extendedRes.diffDays, 3);
});

test('Urgency Calculator — renderPriorityPreview generates accurate DOM class and textual feedback', () => {
    const { renderPriorityPreview } = require('../js/app.js');
    const mockEl = { style: {}, className: '', innerHTML: '' };
    const baseDate = new Date(2026, 7, 15);

    // Test Due Today
    renderPriorityPreview('2026-08-15', 'auto', 2, mockEl, baseDate);
    assert.strictEqual(mockEl.className, 'priority-live-preview urgent');
    assert.match(mockEl.innerHTML, /Due Today/);

    // Test Extended (+4 days)
    renderPriorityPreview('2026-08-19', 'auto', 2, mockEl, baseDate);
    assert.strictEqual(mockEl.className, 'priority-live-preview medium');
    assert.match(mockEl.innerHTML, /MEDIUM Priority/);

    // Test No date
    renderPriorityPreview('', 'auto', 2, mockEl, baseDate);
    assert.strictEqual(mockEl.style.display, 'none');
});

test('Urgency Calculator — User Scenario: Deadline on Oct 20 with 2-day reminder alerts on Oct 18-20, ceases alert after Oct 20', () => {
    const dueDate = '2026-10-20';
    const threshold = 2;

    // Day 1: Oct 17 (3 days before) -> Outside alert window
    const oct17 = new Date(2026, 9, 17);
    const res17 = computeUrgencyAndPriority(dueDate, 'auto', threshold, oct17);
    assert.strictEqual(res17.isUrgent, false);
    assert.strictEqual(res17.priority, 'medium');
    assert.match(res17.dueLabel, /Alert on Oct 18/);

    // Day 2: Oct 18 (2 days before) -> Starts alert window
    const oct18 = new Date(2026, 9, 18);
    const res18 = computeUrgencyAndPriority(dueDate, 'auto', threshold, oct18);
    assert.strictEqual(res18.isUrgent, true);
    assert.strictEqual(res18.priority, 'urgent');
    assert.match(res18.dueLabel, /HIGH ALERT/);
    assert.match(res18.dueLabel, /2 days left/);

    // Day 3: Oct 19 (1 day before) -> Inside alert window
    const oct19 = new Date(2026, 9, 19);
    const res19 = computeUrgencyAndPriority(dueDate, 'auto', threshold, oct19);
    assert.strictEqual(res19.isUrgent, true);
    assert.strictEqual(res19.priority, 'urgent');
    assert.match(res19.dueLabel, /HIGH ALERT/);
    assert.match(res19.dueLabel, /1 day left/);

    // Day 4: Oct 20 (Due today) -> Inside alert window
    const oct20 = new Date(2026, 9, 20);
    const res20 = computeUrgencyAndPriority(dueDate, 'auto', threshold, oct20);
    assert.strictEqual(res20.isUrgent, true);
    assert.strictEqual(res20.priority, 'urgent');
    assert.match(res20.dueLabel, /PRESENT DAY ALERT/);

    // Day 5: Oct 25 (5 days after Oct 20) -> Deadline passed, alert stops! No "5 day overdue" alert message!
    const oct25 = new Date(2026, 9, 25);
    const res25 = computeUrgencyAndPriority(dueDate, 'auto', threshold, oct25);
    assert.strictEqual(res25.isUrgent, false, 'Must not be urgent after Oct 20');
    assert.strictEqual(res25.isOverdue, false, 'Must not trigger overdue alert');
    assert.strictEqual(res25.priority, 'medium', 'Must return to medium');
    assert.strictEqual(res25.dueLabel, '📅 Due Oct 20', 'Must not show "5 day overdue" message');
    assert.doesNotMatch(res25.dueLabel, /overdue/i);
});
