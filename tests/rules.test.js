import test from 'node:test';
import assert from 'node:assert/strict';
import { canDiscardAfterRiichi, callAnnouncement } from '../src/rules.js';

test('a declared riichi hand can only discard the latest drawn tile', () => {
  const common = { riichi: true, riichiDiscardAt: 4, lastDrawnIndex: 13, tile: 6 };
  assert.equal(canDiscardAfterRiichi({ ...common, index: 13 }), true);
  assert.equal(canDiscardAfterRiichi({ ...common, index: 5 }), false);
});

test('the riichi declaration discard must preserve tenpai', () => {
  const common = { riichi: true, riichiDiscardAt: -1, lastDrawnIndex: 13, legalRiichiTiles: [4, 7] };
  assert.equal(canDiscardAfterRiichi({ ...common, index: 2, tile: 4 }), true);
  assert.equal(canDiscardAfterRiichi({ ...common, index: 2, tile: 5 }), false);
});

test('non-riichi hands are not restricted by the riichi rule', () => {
  assert.equal(canDiscardAfterRiichi({ riichi: false, riichiDiscardAt: -1, index: 0, lastDrawnIndex: 13, tile: 1 }), true);
});

test('call announcement identifies caller, source, method, and tile', () => {
  assert.equal(callAnnouncement({ caller: '玩家', from: '北川', method: '碰', tile: '五筒' }), '玩家 碰了 北川 打出的 五筒');
});
