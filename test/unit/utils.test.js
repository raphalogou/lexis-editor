import assert from "node:assert/strict";
import { test } from "node:test";
import { deepMergeObjects, isPlainObject } from "../../src/helper/utils.js";

test("isPlainObject distinguishes plain objects from arrays/null/primitives", () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject({ a: 1 }), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);
  assert.equal(isPlainObject("x"), false);
  assert.equal(isPlainObject(42), false);
});

test("deepMergeObjects merges nested plain objects recursively without mutating the base", () => {
  const base = { a: 1, nested: { x: 1, y: 2 }, list: [1, 2] };
  const overrides = { b: 2, nested: { y: 20, z: 3 } };

  const result = deepMergeObjects(base, overrides);

  assert.deepEqual(result, {
    a: 1,
    b: 2,
    nested: { x: 1, y: 20, z: 3 },
    list: [1, 2],
  });
  assert.deepEqual(base, { a: 1, nested: { x: 1, y: 2 }, list: [1, 2] });
});

test("deepMergeObjects ignores undefined override values instead of clobbering the base", () => {
  // This is the exact behavior that used to differ between the shared
  // helper/utils.js implementation and a since-removed duplicate in
  // elements/editor.js — regressing it would silently reintroduce that drift.
  const base = { markdown: true, toolbar: { template: "bold" } };

  const result = deepMergeObjects(base, { markdown: undefined });

  assert.equal(result.markdown, true);
});

test("deepMergeObjects replaces (not merges) arrays and non-plain values", () => {
  const base = { list: [1, 2, 3] };

  const result = deepMergeObjects(base, { list: [9] });

  assert.deepEqual(result.list, [9]);
});
