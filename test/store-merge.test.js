const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeDataStores, dataKeys } = require('../js/app.js');
const { mergeStores, isDateKey } = require('../server.js');

test('Store Merge — Basic merge of non-conflicting tasks', () => {
    const a = {
        '2026-08-10': [
            { id: 't1', title: 'Task 1', completed: false, updatedAt: '2026-08-10T10:00:00Z' }
        ]
    };
    const b = {
        '2026-08-11': [
            { id: 't2', title: 'Task 2', completed: false, updatedAt: '2026-08-11T10:00:00Z' }
        ]
    };

    const merged = mergeStores(a, b);
    assert.strictEqual(merged['2026-08-10'].length, 1);
    assert.strictEqual(merged['2026-08-11'].length, 1);
    assert.strictEqual(merged['2026-08-10'][0].id, 't1');
    assert.strictEqual(merged['2026-08-11'][0].id, 't2');
});

test('Store Merge — Conflict resolution (newest timestamp wins)', () => {
    const a = {
        '2026-08-10': [
            { id: 't1', title: 'Task 1 (Original)', completed: false, updatedAt: '2026-08-10T10:00:00.000Z' }
        ]
    };
    const b = {
        '2026-08-10': [
            { id: 't1', title: 'Task 1 (Edited on Phone)', completed: true, updatedAt: '2026-08-10T11:00:00.000Z' }
        ]
    };

    const merged = mergeStores(a, b);
    assert.strictEqual(merged['2026-08-10'].length, 1);
    assert.strictEqual(merged['2026-08-10'][0].title, 'Task 1 (Edited on Phone)');
    assert.strictEqual(merged['2026-08-10'][0].completed, true);

    // Symmetric merge
    const mergedReverse = mergeStores(b, a);
    assert.strictEqual(mergedReverse['2026-08-10'][0].title, 'Task 1 (Edited on Phone)');
});

test('Store Merge — Deleted task tombstone propagation', () => {
    const a = {
        '2026-08-10': [
            { id: 't1', title: 'Task to keep', completed: false },
            { id: 't2', title: 'Task to delete', completed: false }
        ],
        _meta: { deleted: ['t2'] }
    };
    const b = {
        '2026-08-10': [
            { id: 't1', title: 'Task to keep', completed: false },
            { id: 't2', title: 'Task to delete', completed: false }
        ],
        _meta: { deleted: [] }
    };

    const merged = mergeStores(a, b);
    assert.strictEqual(merged['2026-08-10'].length, 1);
    assert.strictEqual(merged['2026-08-10'][0].id, 't1');
    assert.strictEqual(merged._meta.deleted.includes('t2'), true);

    // Verify client-side merge behaves identically
    const clientMerged = mergeDataStores(a, b);
    assert.strictEqual(clientMerged['2026-08-10'].length, 1);
    assert.strictEqual(clientMerged['2026-08-10'][0].id, 't1');
    assert.strictEqual(clientMerged._meta.deleted.includes('t2'), true);
});

test('Store Merge — Filter non-date keys', () => {
    const raw = {
        '2026-08-10': [{ id: 't1', title: 'Valid' }],
        'not-a-date': [{ id: 't2', title: 'Invalid' }],
        randomField: 'hello'
    };
    const keys = dataKeys(raw);
    assert.deepStrictEqual(keys, ['2026-08-10']);

    assert.strictEqual(isDateKey('2026-08-10'), true);
    assert.strictEqual(isDateKey('not-a-date'), false);
    assert.strictEqual(isDateKey('_meta'), false);
});
