import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_PRODUCTS, getBlueprintCatalogCount } from '../src/data/catalog';

test('blueprint registry count reflects authored unique products, not hypothetical combinations', () => {
  const before = structuredClone(INITIAL_PRODUCTS);
  const authoredIds = new Set(INITIAL_PRODUCTS.map(product => product.id));
  assert.equal(authoredIds.size, INITIAL_PRODUCTS.length, 'authored IDs must be unique');
  assert.equal(getBlueprintCatalogCount(), authoredIds.size);
  assert.deepEqual(INITIAL_PRODUCTS, before, 'counting must not generate stock or mutate definitions');
});
