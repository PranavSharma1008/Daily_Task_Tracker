const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {
    CONFIG,
    SPREADSHEET_SCHEDULE,
    renderTaskAlertHtml,
    renderSpreadsheetReminderHtml,
    calendarDayDifference,
    toISODateString,
    checkAndSendAlerts,
    loadLedger,
    saveLedger
} = require('../email-service.js');

test('Email Service — Configuration has valid SMTP credentials and spreadsheet URL', () => {
    assert.strictEqual(CONFIG.smtpHost, 'smtp.gmail.com');
    assert.strictEqual(CONFIG.smtpPort, 465);
    assert.strictEqual(CONFIG.smtpUser, 'pranav2410991479@gmail.com');
    assert.strictEqual(CONFIG.notifyEmail, 'shpranav00009@gmail.com');
    assert.ok(CONFIG.spreadsheetUrl.includes('1qEQaXyeo_lEQwfSCEHsdbSOjnc0j-pBQtQDhk1PjKro'));
});

test('Email Service — Spreadsheet schedule contains 11:00 AM, 12:00 PM, 4:00 PM, 8:00 PM', () => {
    assert.strictEqual(SPREADSHEET_SCHEDULE.length, 4);
    const hours = SPREADSHEET_SCHEDULE.map(s => s.hour);
    assert.deepStrictEqual(hours, [11, 12, 16, 20]);
    assert.strictEqual(SPREADSHEET_SCHEDULE[0].label, '11:00 AM');
    assert.strictEqual(SPREADSHEET_SCHEDULE[1].label, '12:00 PM');
    assert.strictEqual(SPREADSHEET_SCHEDULE[2].label, '4:00 PM');
    assert.strictEqual(SPREADSHEET_SCHEDULE[3].label, '8:00 PM');
});

test('Email Service — Task alert HTML template renders task title, urgency, notes, subtasks', () => {
    const task = {
        id: 't1',
        title: 'Review quarterly revenue numbers',
        priority: 'urgent',
        dueDate: '2026-08-15',
        category: 'Work',
        notes: 'Compare Q2 vs Q3 figures',
        subtasks: [
            { id: 's1', text: 'Pull metrics from Stripe', completed: true },
            { id: 's2', text: 'Format chart in Sheets', completed: false }
        ]
    };

    const html = renderTaskAlertHtml(task, 'DUE TODAY!', 0);

    assert.ok(html.includes('Review quarterly revenue numbers'));
    assert.ok(html.includes('DUE TODAY!'));
    assert.ok(html.includes('URGENT'));
    assert.ok(html.includes('Work'));
    assert.ok(html.includes('Compare Q2 vs Q3 figures'));
    assert.ok(html.includes('Pull metrics from Stripe'));
    assert.ok(html.includes('Format chart in Sheets'));
    assert.ok(html.includes(CONFIG.appUrl));
});

test('Email Service — Spreadsheet reminder HTML template renders slot label and spreadsheet link', () => {
    const html = renderSpreadsheetReminderHtml('11:00 AM');

    assert.ok(html.includes('11:00 AM Scheduled Check-in'));
    assert.ok(html.includes('Google Spreadsheet Reminder'));
    assert.ok(html.includes(CONFIG.spreadsheetUrl));
    assert.ok(html.includes('Open Google Spreadsheet'));
});

test('Email Service — calendarDayDifference calculates accurate offsets', () => {
    const base = new Date(2026, 7, 15); // Aug 15, 2026

    // Same day
    assert.strictEqual(calendarDayDifference(base, '2026-08-15'), 0);
    // Tomorrow
    assert.strictEqual(calendarDayDifference(base, '2026-08-16'), 1);
    // Yesterday (overdue)
    assert.strictEqual(calendarDayDifference(base, '2026-08-14'), -1);
    // 3 days later
    assert.strictEqual(calendarDayDifference(base, '2026-08-18'), 3);
});

test('Email Service — Deduplication ledger prevents duplicate emails on repeated checks', () => {
    const tmpLedger = path.join(os.tmpdir(), `test-ledger-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

    try {
        const ledger = loadLedger(tmpLedger);
        assert.deepStrictEqual(ledger.sent, {});

        // Record a sent task alert
        ledger.sent['task_t1_2026-08-15'] = new Date().toISOString();
        saveLedger(ledger, tmpLedger);

        const reloaded = loadLedger(tmpLedger);
        assert.ok(reloaded.sent['task_t1_2026-08-15']);
    } finally {
        if (fs.existsSync(tmpLedger)) fs.unlinkSync(tmpLedger);
    }
});
