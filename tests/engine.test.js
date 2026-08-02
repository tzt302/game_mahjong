import test from 'node:test';
import assert from 'node:assert/strict';
import { createWall, isWinningHand, shanten, analyzeDiscards, nextDora } from '../src/engine.js';

test('four-player wall has 136 tiles', () => assert.equal(createWall(4).length, 136));
test('three-player wall removes 2m through 8m', () => {
  const wall = createWall(3);
  assert.equal(wall.length, 108);
  assert.equal(wall.some(tile => tile >= 1 && tile <= 7), false);
});
test('recognizes a standard winning hand', () => {
  assert.equal(isWinningHand([0,1,2, 9,10,11, 18,19,20, 27,27,27, 31,31]), true);
});
test('recognizes seven pairs', () => {
  assert.equal(isWinningHand([0,0, 8,8, 9,9, 17,17, 18,18, 26,26, 27,27]), true);
});
test('rejects an incomplete hand', () => assert.equal(isWinningHand([0,1,3, 9,10,12, 18,19,21, 27,27,28, 31,31]), false));
test('tenpai is zero shanten', () => assert.equal(shanten([0,1,2, 9,10,11, 18,19,20, 27,27,27, 31]), 0));
test('discard analysis returns sorted candidates', () => {
  const result = analyzeDiscards([0,1,2,3, 9,10,11, 18,19,20, 27,27,27,31], [], 4);
  assert.ok(result.length > 0);
  assert.ok(result[0].score >= result.at(-1).score);
});
test('dora wraps within suits and honor groups', () => {
  assert.equal(nextDora(8), 0); assert.equal(nextDora(30), 27); assert.equal(nextDora(33), 31);
});
