const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCSV, generateMarkdownSummary } = require('../js/app.js');

test('CSV Export — Correctly structures RFC 4180 headers and escapes quotes, commas, newlines', () => {
    const data = {
        '2026-08-15': [
            {
                id: '1',
                title: 'Release "DayTask 2.0", now with sync',
                priority: 'urgent',
                dueDate: '2026-08-15',
                alertDays: 3,
                time: '18:00',
                category: 'Work',
                completed: false,
                isPinned: true,
                notes: 'Line 1\nLine 2 with, comma',
                subtasks: [
                    { id: 's1', text: 'Run tests', completed: true },
                    { id: 's2', text: 'Deploy to prod', completed: false }
                ]
            }
        ]
    };

    const csv = generateCSV(data);
    const lines = csv.split('\r\n');

    // Header row
    assert.strictEqual(lines[0], 'Date,Title,Priority,End Date,Alert Days,Time,Category,Status,Pinned,Notes,Subtasks');

    // Data row should contain escaped double quotes ("")
    assert.match(lines[1], /"Release ""DayTask 2\.0"", now with sync"/);
    // Pinned should be Yes
    assert.match(lines[1], /"Yes"/);
    // Priority should be urgent
    assert.match(lines[1], /"urgent"/);
    // Subtasks serialized
    assert.match(lines[1], /"\[x\] Run tests; \[ \] Deploy to prod"/);
});

test('CSV Export — Exports specific date when selectedDate parameter is passed', () => {
    const data = {
        '2026-08-14': [{ id: '1', title: 'Yesterday task' }],
        '2026-08-15': [{ id: '2', title: 'Today task' }]
    };

    const csv = generateCSV(data, '2026-08-15');
    assert.match(csv, /"Today task"/);
    assert.doesNotMatch(csv, /"Yesterday task"/);
});

test('Markdown Summary — Generates formatted daily summary with subtasks and notes', () => {
    const tasks = [
        {
            id: '1',
            title: 'Fix edge cases',
            priority: 'high',
            dueDate: '2026-08-15',
            completed: false,
            notes: 'Check leap years',
            subtasks: [
                { id: 's1', text: 'Write test', completed: true },
                { id: 's2', text: 'Verify code', completed: false }
            ]
        },
        {
            id: '2',
            title: 'Morning Standup',
            priority: 'auto',
            completed: true
        }
    ];

    const md = generateMarkdownSummary(tasks, '2026-08-15');

    // Header and Progress
    assert.match(md, /# 📅 DayTask Summary — 2026-08-15/);
    assert.match(md, /\*\*Progress:\*\* 1\/2 completed \(50%\)/);

    // Pending task details
    assert.match(md, /### ⏳ Pending Tasks \(1\)/);
    assert.match(md, /- \[ \] \*\*Fix edge cases\*\* \[HIGH\] \(Due: 2026-08-15\)/);
    assert.match(md, /> Check leap years/);
    assert.match(md, /- \[x\] Write test/);
    assert.match(md, /- \[ \] Verify code/);

    // Completed task details
    assert.match(md, /### ✅ Completed Tasks \(1\)/);
    assert.match(md, /- \[x\] ~Morning Standup~/);
});

test('Markdown Summary — Gracefully handles empty task list', () => {
    const md = generateMarkdownSummary([], '2026-08-15');
    assert.match(md, /\*\*Progress:\*\* 0\/0 completed \(0%\)/);
    assert.match(md, /\*No tasks recorded for this date\.\*/);
});
