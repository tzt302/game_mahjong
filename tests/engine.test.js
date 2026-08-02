import test from 'node:test';
import assert from 'node:assert/strict';
import { createWall, isWinningHand, shanten, analyzeDiscards, nextDora, getWinningDecompositions } from '../src/engine.js';
import { evaluateHand } from '../src/scoring.js';

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

test('recognizes kokushi musou and its decomposition', () => {
  const hand = [0,8,9,17,18,26,27,28,29,30,31,32,33,33];
  assert.equal(isWinningHand(hand), true);
  assert.equal(getWinningDecompositions(hand)[0].kind, 'kokushi');
});

test('scores pinfu, menzen tsumo and ikkitsuukan', () => {
  const hand = [0,1,2,3,4,5,6,7,8,10,11,12,22,22];
  const result = evaluateHand(hand, { winTile: 12, tsumo: true, seatWind: 28, roundWind: 27 });
  assert.ok(result.yaku.some(item => item.name === '平和'));
  assert.ok(result.yaku.some(item => item.name === '一气通贯'));
  assert.equal(result.fu, 20);
  assert.equal(result.han, 4);
});

test('calculates closed ron fu including value pair and edge wait', () => {
  const hand = [0,1,2,9,10,11,18,19,20,24,25,26,27,27];
  const result = evaluateHand(hand, { winTile: 26, tsumo: false, seatWind: 27, roundWind: 27 });
  assert.equal(result.fu, 40);
  assert.ok(result.han >= 4);
});

test('scores daisangen as yakuman', () => {
  const hand = [0,1,2,31,31,31,32,32,32,33,33,33,27,27];
  const result = evaluateHand(hand, { winTile: 2, tsumo: true });
  assert.equal(result.yakuman, 1);
  assert.equal(result.limitName, '役满');
});

test('scores thirteen-sided kokushi as double yakuman', () => {
  const hand = [0,8,9,17,18,26,27,28,29,30,31,32,33,33];
  const result = evaluateHand(hand, { winTile: 33, tsumo: true });
  assert.equal(result.yakuman, 2);
  assert.equal(result.total, 64000);
});

test('supports kan-related situational yaku in the scoring engine', () => {
  const hand = [0,1,2,3,4,5,6,7,8,10,11,12,22,22];
  const result = evaluateHand(hand, { winTile: 12, chankan: true, rinshan: true, kanCount: 3 });
  assert.ok(result.yaku.some(item => item.name === '抢杠'));
  assert.ok(result.yaku.some(item => item.name === '岭上开花'));
  assert.ok(result.yaku.some(item => item.name === '三杠子'));
});

test('supports red and north dora counters without treating dora alone as yaku', () => {
  const hand = [0,1,2,3,4,5,6,7,8,10,11,12,22,22];
  const result = evaluateHand(hand, { winTile: 12, tsumo: true, redDora: 1, northDora: 2 });
  assert.ok(result.yaku.some(item => item.name === '赤宝牌' && item.han === 1));
  assert.ok(result.yaku.some(item => item.name === '北宝牌' && item.han === 2));
});
