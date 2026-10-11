const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateStreak, calculateProductivityStats } = require('../js/app.js');

test('Streak — Returns 0 when store has no completed tasks', () => {
    const emptyData = {};
    const resEmpty = calculateStreak(emptyData, new Date(2026, 7, 15));
    assert.deepStrictEqual(resEmpty, { currentStreak: 0, bestStreak: 0 });

    const pendingOnly = {
        '2026-08-14': [{ id: '1', completed: false }],
        '2026-08-15': [{ id: '2', completed: false }]
    };
    const resPending = calculateStreak(pendingOnly, new Date(2026, 7, 15));
    assert.deepStrictEqual(resPending, { currentStreak: 0, bestStreak: 0 });
});

test('Streak — Consecutive completed days up to today count towards active streak', () => {
    const refDate = new Date(2026, 7, 15); // Aug 15, 2026

    const data = {
        '2026-08-13': [{ id: '1', completed: true }],
        '2026-08-14': [{ id: '2', completed: true }],
        '2026-08-15': [{ id: '3', completed: true }]
    };

    const res = calculateStreak(data, refDate);
    assert.strictEqual(res.currentStreak, 3);
    assert.strictEqual(res.bestStreak, 3);
});

test('Streak — Grace period maintains streak if today has no completions yet but yesterday did', () => {
    const refDate = new Date(2026, 7, 15); // Aug 15, 2026 (morning, user hasn't completed tasks yet today)

    const data = {
        '2026-08-13': [{ id: '1', completed: true }],
        '2026-08-14': [{ id: '2', completed: true }],
        '2026-08-15': [{ id: '3', completed: false }] // pending today
    };

    const res = calculateStreak(data, refDate);
    assert.strictEqual(res.currentStreak, 2, 'Should maintain 2-day streak from yesterday');
    assert.strictEqual(res.bestStreak, 2);
});

test('Streak — Streak breaks when gap day occurs', () => {
    const refDate = new Date(2026, 7, 15);

    // Completed on 11th, 12th, then gap on 13th, completed on 14th and 15th
    const data = {
        '2026-08-11': [{ id: '1', completed: true }],
        '2026-08-12': [{ id: '2', completed: true }],
        // 2026-08-13 is missing / no completed tasks
        '2026-08-14': [{ id: '3', completed: true }],
        '2026-08-15': [{ id: '4', completed: true }]
    };

    const res = calculateStreak(data, refDate);
    assert.strictEqual(res.currentStreak, 2, 'Streak is 2 because 13th was missed');
    assert.strictEqual(res.bestStreak, 2);
});

test('Streak — Preserves bestStreak across history even when current streak is lower', () => {
    const refDate = new Date(2026, 7, 15);

    // Historical 4-day streak in January, current 1-day streak in August
    const data = {
        '2026-01-01': [{ id: '1', completed: true }],
        '2026-01-02': [{ id: '2', completed: true }],
        '2026-01-03': [{ id: '3', completed: true }],
        '2026-01-04': [{ id: '4', completed: true }],
        // Gap...
        '2026-08-15': [{ id: '5', completed: true }]
    };

    const res = calculateStreak(data, refDate);
    assert.strictEqual(res.currentStreak, 1);
    assert.strictEqual(res.bestStreak, 4, 'Best streak must reflect historical maximum');
});

test('Productivity Stats — Aggregates total tasks, completions, and completion rate accurately', () => {
    const refDate = new Date(2026, 7, 15);
    const data = {
        '2026-08-14': [
            { id: '1', category: 'Work', completed: true },
            { id: '2', category: 'Work', completed: false }
        ],
        '2026-08-15': [
            { id: '3', category: 'Personal', completed: true },
            { id: '4', category: 'Health', completed: true }
        ]
    };

    const stats = calculateProductivityStats(data, refDate);
    assert.strictEqual(stats.totalTasks, 4);
    assert.strictEqual(stats.totalCompleted, 3);
    assert.strictEqual(stats.completionRate, 75); // 3/4 = 75%
});

test('Productivity Stats — Generates 7-day velocity chart data ending on reference date', () => {
    const refDate = new Date(2026, 7, 15); // Aug 15, 2026
    const data = {
        '2026-08-15': [
            { id: '1', completed: true },
            { id: '2', completed: false }
        ],
        '2026-08-14': [
            { id: '3', completed: true }
        ]
    };

    const stats = calculateProductivityStats(data, refDate);
    assert.strictEqual(stats.recentDays.length, 7);

    // Last day in array should be refDate (2026-08-15)
    const todaySlot = stats.recentDays[6];
    assert.strictEqual(todaySlot.date, '2026-08-15');
    assert.strictEqual(todaySlot.total, 2);
    assert.strictEqual(todaySlot.completed, 1);

    // Day before should be 2026-08-14
    const yesterdaySlot = stats.recentDays[5];
    assert.strictEqual(yesterdaySlot.date, '2026-08-14');
    assert.strictEqual(yesterdaySlot.total, 1);
    assert.strictEqual(yesterdaySlot.completed, 1);
});

test('Productivity Stats — Tracks category distribution properly', () => {
    const refDate = new Date(2026, 7, 15);
    const data = {
        '2026-08-15': [
            { id: '1', category: 'Work', completed: true },
            { id: '2', category: 'Work', completed: false },
            { id: '3', category: 'Health', completed: true }
        ]
    };

    const stats = calculateProductivityStats(data, refDate);
    assert.deepStrictEqual(stats.categoryCounts.Work, { total: 2, completed: 1 });
    assert.deepStrictEqual(stats.categoryCounts.Health, { total: 1, completed: 1 });
    assert.deepStrictEqual(stats.categoryCounts.Study, { total: 0, completed: 0 });
});
