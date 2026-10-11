const test = require('node:test');
const assert = require('node:assert/strict');
const {
    createSubtask,
    getSubtaskProgress,
    toggleSubtaskInList,
    addSubtaskToList,
    removeSubtaskFromList
} = require('../js/app.js');

test('Subtasks — createSubtask creates a valid subtask object', () => {
    const sub = createSubtask('Write unit tests');
    assert.strictEqual(typeof sub.id, 'string');
    assert.ok(sub.id.startsWith('sub_'));
    assert.strictEqual(sub.text, 'Write unit tests');
    assert.strictEqual(sub.completed, false);

    // Whitespace trimming
    const trimmed = createSubtask('   Review pull request   ');
    assert.strictEqual(trimmed.text, 'Review pull request');

    // Empty or non-string input returns null
    assert.strictEqual(createSubtask(''), null);
    assert.strictEqual(createSubtask('   '), null);
    assert.strictEqual(createSubtask(null), null);
    assert.strictEqual(createSubtask(undefined), null);

    // Explicit custom ID and completed status
    const custom = createSubtask('Existing subtask', true, 'custom_id_123');
    assert.strictEqual(custom.id, 'custom_id_123');
    assert.strictEqual(custom.completed, true);
});

test('Subtasks — getSubtaskProgress calculates accurate totals and percentages', () => {
    // Null, undefined, empty array
    assert.deepStrictEqual(getSubtaskProgress([]), { total: 0, completed: 0, percentage: 0 });
    assert.deepStrictEqual(getSubtaskProgress(null), { total: 0, completed: 0, percentage: 0 });
    assert.deepStrictEqual(getSubtaskProgress(undefined), { total: 0, completed: 0, percentage: 0 });

    // Zero completed
    const zeroList = [
        { id: '1', text: 'Step 1', completed: false },
        { id: '2', text: 'Step 2', completed: false }
    ];
    assert.deepStrictEqual(getSubtaskProgress(zeroList), { total: 2, completed: 0, percentage: 0 });

    // All completed
    const allList = [
        { id: '1', text: 'Step 1', completed: true },
        { id: '2', text: 'Step 2', completed: true }
    ];
    assert.deepStrictEqual(getSubtaskProgress(allList), { total: 2, completed: 2, percentage: 100 });

    // Fractional progress (1 of 3 = 33%)
    const fractionalList = [
        { id: '1', text: 'Step 1', completed: true },
        { id: '2', text: 'Step 2', completed: false },
        { id: '3', text: 'Step 3', completed: false }
    ];
    assert.deepStrictEqual(getSubtaskProgress(fractionalList), { total: 3, completed: 1, percentage: 33 });

    // Fractional progress (3 of 4 = 75%)
    const threeFourths = [
        { id: '1', text: 'A', completed: true },
        { id: '2', text: 'B', completed: true },
        { id: '3', text: 'C', completed: true },
        { id: '4', text: 'D', completed: false }
    ];
    assert.deepStrictEqual(getSubtaskProgress(threeFourths), { total: 4, completed: 3, percentage: 75 });
});

test('Subtasks — toggleSubtaskInList toggles completion immutably', () => {
    const list = [
        { id: 's1', text: 'Item 1', completed: false },
        { id: 's2', text: 'Item 2', completed: true }
    ];

    // Toggle s1 to true
    const updated1 = toggleSubtaskInList(list, 's1');
    assert.notStrictEqual(updated1, list, 'Should return a new array');
    assert.strictEqual(updated1[0].completed, true);
    assert.strictEqual(list[0].completed, false, 'Original list must remain unmutated');

    // Toggle s2 to false
    const updated2 = toggleSubtaskInList(list, 's2');
    assert.strictEqual(updated2[1].completed, false);

    // Non-existent id returns shallow clone with identical items
    const nonExistent = toggleSubtaskInList(list, 's999');
    assert.strictEqual(nonExistent.length, 2);
    assert.strictEqual(nonExistent[0].completed, false);
    assert.strictEqual(nonExistent[1].completed, true);

    // Non-array input fallback
    assert.deepStrictEqual(toggleSubtaskInList(null, 's1'), []);
});

test('Subtasks — addSubtaskToList appends new subtasks safely', () => {
    const initial = [{ id: 's1', text: 'Task 1', completed: false }];

    // Valid text addition
    const result = addSubtaskToList(initial, 'Task 2');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[1].text, 'Task 2');
    assert.strictEqual(result[1].completed, false);

    // Whitespace only text should not add
    const same1 = addSubtaskToList(initial, '   ');
    assert.strictEqual(same1.length, 1);

    // Empty text should not add
    const same2 = addSubtaskToList(initial, '');
    assert.strictEqual(same2.length, 1);

    // Starting with empty or undefined list
    const fromNull = addSubtaskToList(null, 'Brand new');
    assert.strictEqual(fromNull.length, 1);
    assert.strictEqual(fromNull[0].text, 'Brand new');
});

test('Subtasks — removeSubtaskFromList removes targets immutably', () => {
    const list = [
        { id: 's1', text: 'First', completed: false },
        { id: 's2', text: 'Second', completed: true },
        { id: 's3', text: 'Third', completed: false }
    ];

    const result = removeSubtaskFromList(list, 's2');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result.some(s => s.id === 's2'), false);
    assert.strictEqual(list.length, 3, 'Original list must not be modified');

    // Removing non-existent ID
    const untouched = removeSubtaskFromList(list, 'unknown');
    assert.strictEqual(untouched.length, 3);

    // Empty list handling
    assert.deepStrictEqual(removeSubtaskFromList([], 's1'), []);
    assert.deepStrictEqual(removeSubtaskFromList(null, 's1'), []);
});
