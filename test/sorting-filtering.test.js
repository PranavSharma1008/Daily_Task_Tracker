const test = require('node:test');
const assert = require('node:assert/strict');
const { sortTasks, filterTasks } = require('../js/app.js');

test('Sorting — Pinned tasks always float to top across all sort modes', () => {
    const tasks = [
        { id: '1', title: 'Zebra', priority: 'low', dueDate: '2026-12-31', isPinned: false },
        { id: '2', title: 'Ant', priority: 'urgent', dueDate: '2026-01-01', isPinned: false },
        { id: '3', title: 'Monkey', priority: 'medium', dueDate: '2026-06-15', isPinned: true }
    ];

    // In 'title' mode, 'Ant' would normally be first, but 'Monkey' is pinned!
    const byTitle = sortTasks(tasks, 'title');
    assert.strictEqual(byTitle[0].id, '3', 'Pinned task must be first');
    assert.strictEqual(byTitle[1].id, '2'); // 'Ant'
    assert.strictEqual(byTitle[2].id, '1'); // 'Zebra'

    // In 'priority' mode, 'Ant' (urgent) would normally be first, but 'Monkey' is pinned!
    const byPriority = sortTasks(tasks, 'priority');
    assert.strictEqual(byPriority[0].id, '3');
    assert.strictEqual(byPriority[1].id, '2');
    assert.strictEqual(byPriority[2].id, '1');
});

test('Sorting — Sort by Due Date correctly orders dates and places tasks without due date at bottom', () => {
    const tasks = [
        { id: '1', title: 'No date', dueDate: '' },
        { id: '2', title: 'Later', dueDate: '2026-09-20' },
        { id: '3', title: 'Earlier', dueDate: '2026-09-05' },
        { id: '4', title: 'No date either', dueDate: null }
    ];

    const sorted = sortTasks(tasks, 'dueDate');
    assert.strictEqual(sorted[0].id, '3'); // 2026-09-05
    assert.strictEqual(sorted[1].id, '2'); // 2026-09-20
    assert.strictEqual(sorted[2].id, '1'); // No date
    assert.strictEqual(sorted[3].id, '4'); // No date
});

test('Sorting — Sort by Priority ranks urgent > high > auto > medium > low', () => {
    const tasks = [
        { id: '1', title: 'Low', priority: 'low' },
        { id: '2', title: 'Urgent', priority: 'urgent' },
        { id: '3', title: 'Medium', priority: 'medium' },
        { id: '4', title: 'High', priority: 'high' },
        { id: '5', title: 'Auto', priority: 'auto' }
    ];

    const sorted = sortTasks(tasks, 'priority');
    const ids = sorted.map(t => t.id);
    assert.deepStrictEqual(ids, ['2', '4', '5', '3', '1']);
});

test('Sorting — Sort by Time orders chronologically and puts time-less tasks at bottom', () => {
    const tasks = [
        { id: '1', title: 'Afternoon', time: '14:30' },
        { id: '2', title: 'Morning', time: '08:15' },
        { id: '3', title: 'Anytime', time: '' },
        { id: '4', title: 'Evening', time: '20:00' }
    ];

    const sorted = sortTasks(tasks, 'time');
    assert.strictEqual(sorted[0].id, '2'); // 08:15
    assert.strictEqual(sorted[1].id, '1'); // 14:30
    assert.strictEqual(sorted[2].id, '4'); // 20:00
    assert.strictEqual(sorted[3].id, '3'); // Anytime
});

test('Sorting — Sort by Title sorts alphabetically', () => {
    const tasks = [
        { id: '1', title: 'Cherry' },
        { id: '2', title: 'Apple' },
        { id: '3', title: 'Banana' }
    ];

    const sorted = sortTasks(tasks, 'title');
    assert.deepStrictEqual(sorted.map(t => t.title), ['Apple', 'Banana', 'Cherry']);
});

test('Filtering — Status filter separates all, pending, and completed tasks', () => {
    const tasks = [
        { id: '1', title: 'Pending 1', completed: false },
        { id: '2', title: 'Done 1', completed: true },
        { id: '3', title: 'Pending 2', completed: false }
    ];

    const all = filterTasks(tasks, { status: 'all' });
    assert.strictEqual(all.length, 3);

    const pending = filterTasks(tasks, { status: 'pending' });
    assert.strictEqual(pending.length, 2);
    assert.deepStrictEqual(pending.map(t => t.id), ['1', '3']);

    const completed = filterTasks(tasks, { status: 'completed' });
    assert.strictEqual(completed.length, 1);
    assert.deepStrictEqual(completed.map(t => t.id), ['2']);
});

test('Filtering — Category filter accurately isolates matching categories', () => {
    const tasks = [
        { id: '1', title: 'Deploy app', category: 'Work' },
        { id: '2', title: 'Buy milk', category: 'Personal' },
        { id: '3', title: 'Workout', category: 'Health' },
        { id: '4', title: 'Random note' } // fallback to 'General'
    ];

    const workOnly = filterTasks(tasks, { category: 'Work' });
    assert.strictEqual(workOnly.length, 1);
    assert.strictEqual(workOnly[0].id, '1');

    const generalOnly = filterTasks(tasks, { category: 'General' });
    assert.strictEqual(generalOnly.length, 1);
    assert.strictEqual(generalOnly[0].id, '4');

    const allCats = filterTasks(tasks, { category: 'all' });
    assert.strictEqual(allCats.length, 4);
});

test('Filtering — Search matches title, category, notes, and subtasks text', () => {
    const tasks = [
        { id: '1', title: 'Prepare Presentation', category: 'Work', notes: 'Include Q3 graphs' },
        { id: '2', title: 'Grocery run', category: 'Personal', subtasks: [{ id: 's1', text: 'Avocado and Almonds' }] },
        { id: '3', title: 'Read Book', category: 'Study', notes: '' }
    ];

    // Match in title
    const searchTitle = filterTasks(tasks, { search: 'presentation' });
    assert.strictEqual(searchTitle.length, 1);
    assert.strictEqual(searchTitle[0].id, '1');

    // Match in notes
    const searchNotes = filterTasks(tasks, { search: 'graphs' });
    assert.strictEqual(searchNotes.length, 1);
    assert.strictEqual(searchNotes[0].id, '1');

    // Match in subtasks
    const searchSubtask = filterTasks(tasks, { search: 'almonds' });
    assert.strictEqual(searchSubtask.length, 1);
    assert.strictEqual(searchSubtask[0].id, '2');

    // Match in category
    const searchCategory = filterTasks(tasks, { search: 'study' });
    assert.strictEqual(searchCategory.length, 1);
    assert.strictEqual(searchCategory[0].id, '3');

    // No matches
    const searchNone = filterTasks(tasks, { search: 'nonexistent keyword' });
    assert.strictEqual(searchNone.length, 0);
});

test('Filtering — Multi-criteria combinations work cohesively', () => {
    const tasks = [
        { id: '1', title: 'Write report', category: 'Work', completed: false, notes: 'Financial audit' },
        { id: '2', title: 'Audit server security', category: 'Work', completed: true, notes: 'Completed patch' },
        { id: '3', title: 'Review audit logs', category: 'Personal', completed: false, notes: '' }
    ];

    // Must be Work AND Pending AND contain 'audit'
    const combo = filterTasks(tasks, { status: 'pending', category: 'Work', search: 'audit' });
    assert.strictEqual(combo.length, 1);
    assert.strictEqual(combo[0].id, '1');
});
