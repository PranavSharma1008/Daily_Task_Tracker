const test = require('node:test');
const assert = require('node:assert/strict');
const {
    batchMarkAllComplete,
    batchMovePending,
    batchClearCompleted,
    createUndoAction,
    applyUndoAction
} = require('../js/app.js');

test('Batch Actions — batchMarkAllComplete completes all pending tasks for a given date', () => {
    const store = {
        '2026-08-15': [
            { id: '1', title: 'Task 1', completed: false },
            { id: '2', title: 'Task 2', completed: true, completedDate: '2026-08-15' },
            { id: '3', title: 'Task 3', completed: false }
        ]
    };

    const res = batchMarkAllComplete(store, '2026-08-15');
    assert.strictEqual(res.count, 2, 'Should mark 2 pending tasks as completed');

    const tasks = store['2026-08-15'];
    assert.strictEqual(tasks[0].completed, true);
    assert.strictEqual(tasks[0].completedDate, '2026-08-15');
    assert.ok(tasks[0].completedAt);
    assert.strictEqual(tasks[2].completed, true);

    // Running again when all tasks are complete returns 0
    const resAgain = batchMarkAllComplete(store, '2026-08-15');
    assert.strictEqual(resAgain.count, 0);
});

test('Batch Actions — batchMovePending transfers pending tasks to target date, leaving completed tasks intact', () => {
    const store = {
        '2026-08-15': [
            { id: '1', title: 'Pending Task', completed: false },
            { id: '2', title: 'Done Task', completed: true }
        ],
        '2026-08-16': []
    };

    const res = batchMovePending(store, '2026-08-15', '2026-08-16');
    assert.strictEqual(res.count, 1);

    // Completed task stays on original date
    assert.strictEqual(store['2026-08-15'].length, 1);
    assert.strictEqual(store['2026-08-15'][0].id, '2');

    // Pending task transferred to next day
    assert.strictEqual(store['2026-08-16'].length, 1);
    assert.strictEqual(store['2026-08-16'][0].id, '1');
    assert.ok(store['2026-08-16'][0].updatedAt);
});

test('Batch Actions — batchClearCompleted removes completed tasks and appends tombstones to _meta.deleted', () => {
    const store = {
        _meta: { deleted: [] },
        '2026-08-15': [
            { id: '1', title: 'Pending Task', completed: false },
            { id: '2', title: 'Done Task 1', completed: true },
            { id: '3', title: 'Done Task 2', completed: true }
        ]
    };

    const res = batchClearCompleted(store, '2026-08-15');
    assert.strictEqual(res.count, 2);

    // Only pending task remains
    assert.strictEqual(store['2026-08-15'].length, 1);
    assert.strictEqual(store['2026-08-15'][0].id, '1');

    // Tombstones recorded for sync server
    assert.deepStrictEqual(store._meta.deleted, ['2', '3']);
});

test('Undo Action — createUndoAction and applyUndoAction restores deleted tasks correctly', () => {
    const deletedTask = { id: 'task_del_1', title: 'Accidentally deleted', completed: false };
    const undoAction = createUndoAction('delete', {
        dateKey: '2026-08-15',
        task: deletedTask
    });

    assert.strictEqual(undoAction.type, 'delete');
    assert.ok(undoAction.id.startsWith('undo_'));

    const store = {
        _meta: { deleted: ['task_del_1'] },
        '2026-08-15': []
    };

    const restored = applyUndoAction(store, undoAction);
    assert.strictEqual(restored, true);

    // Task restored in list
    assert.strictEqual(store['2026-08-15'].length, 1);
    assert.strictEqual(store['2026-08-15'][0].id, 'task_del_1');

    // Tombstone removed
    assert.strictEqual(store._meta.deleted.includes('task_del_1'), false);
});

test('Undo Action — applyUndoAction restores completion toggle status', () => {
    const store = {
        '2026-08-15': [
            { id: 'task_1', title: 'My Task', completed: true, completedDate: '2026-08-15' }
        ]
    };

    const undoToggle = createUndoAction('complete_toggle', {
        taskId: 'task_1',
        previousCompleted: false,
        previousCompletedDate: null
    });

    const success = applyUndoAction(store, undoToggle);
    assert.strictEqual(success, true);
    assert.strictEqual(store['2026-08-15'][0].completed, false);
    assert.strictEqual(store['2026-08-15'][0].completedDate, undefined);
});
