import { TILE_LABELS, tileSuit, createWall, shuffle, isWinningHand, shanten, analyzeDiscards, countDora } from './engine.js';

const state = {
  playerCount: 4, mode: 'coach', wall: [], hands: [], rivers: [], dora: 0,
  turn: 0, scores: [], riichi: [], waitingForDiscard: false, pendingRonTile: null,
  lastDrawnIndex: -1, round: 1, over: false
};

const $ = selector => document.querySelector(selector);
const startScreen = $('#startScreen');
const gameScreen = $('#gameScreen');
const handEl = $('#hand');
const riverEl = $('#river');
const messageBar = $('#messageBar');

document.querySelectorAll('[data-group]').forEach(group => {
  group.addEventListener('click', event => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    group.querySelectorAll('button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
  });
});

$('#startButton').addEventListener('click', () => {
  state.playerCount = Number(document.querySelector('[data-group="players"] .active').dataset.value);
  state.mode = document.querySelector('[data-group="mode"] .active').dataset.value;
  startScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  $('#coachPanel').classList.toggle('hidden', state.mode !== 'coach');
  gameScreen.style.gridTemplateColumns = state.mode === 'coach' ? '' : '1fr';
  newRound(true);
});

$('#settingsButton').addEventListener('click', () => {
  if (!gameScreen.classList.contains('hidden') && !confirm('返回设置并结束当前对局？')) return;
  gameScreen.classList.add('hidden'); startScreen.classList.remove('hidden');
  $('#resultModal').classList.add('hidden');
});
$('#nextRoundButton').addEventListener('click', () => { $('#resultModal').classList.add('hidden'); newRound(false); });
$('#winButton').addEventListener('click', () => finishRound(0, '自摸'));
$('#ronButton').addEventListener('click', () => {
  state.hands[0].push(state.pendingRonTile);
  finishRound(0, '荣和');
});
$('#skipButton').addEventListener('click', () => {
  $('#ronButton').classList.add('hidden'); $('#skipButton').classList.add('hidden');
  state.pendingRonTile = null; continueOpponents();
});
$('#riichiButton').addEventListener('click', () => {
  if (state.scores[0] < 1000 || state.riichi[0]) return;
  state.scores[0] -= 1000; state.riichi[0] = true;
  $('#riichiBadge').classList.remove('hidden'); $('#riichiButton').classList.add('hidden');
  setMessage('立直！请打出一张牌。'); renderStatus();
});
$('#toggleCoach').addEventListener('click', event => {
  $('#coachContent').classList.toggle('hidden');
  event.target.textContent = $('#coachContent').classList.contains('hidden') ? '展开' : '收起';
});

function newRound(resetScores) {
  state.wall = shuffle(createWall(state.playerCount));
  state.hands = Array.from({ length: state.playerCount }, () => []);
  state.rivers = Array.from({ length: state.playerCount }, () => []);
  if (resetScores || state.scores.length !== state.playerCount) state.scores = Array(state.playerCount).fill(state.playerCount === 4 ? 25000 : 35000);
  state.riichi = Array(state.playerCount).fill(false);
  state.turn = 0; state.over = false; state.pendingRonTile = null;
  for (let r = 0; r < 13; r++) for (let p = 0; p < state.playerCount; p++) state.hands[p].push(state.wall.pop());
  state.dora = state.wall.pop();
  state.hands.forEach(sortHand);
  $('#riichiBadge').classList.add('hidden'); $('#resultModal').classList.add('hidden');
  renderAll();
  setTimeout(() => takeTurn(0), 450);
}

function sortHand(hand) { hand.sort((a, b) => a - b); }
function setMessage(text) { messageBar.textContent = text; }

function takeTurn(player) {
  if (state.over) return;
  if (!state.wall.length) return finishRound(null, '流局');
  state.turn = player;
  const drawn = state.wall.pop();
  state.hands[player].push(drawn);
  state.lastDrawnIndex = state.hands[player].length - 1;
  updateWall();
  if (isWinningHand(state.hands[player])) {
    if (player === 0) {
      sortHand(state.hands[0]); renderHand();
      $('#winButton').classList.remove('hidden'); setMessage('和牌成立，可以自摸！');
    } else {
      setTimeout(() => finishRound(player, '自摸'), 500);
    }
    return;
  }
  if (player === 0) {
    sortHand(state.hands[0]);
    state.lastDrawnIndex = state.hands[0].lastIndexOf(drawn);
    state.waitingForDiscard = true;
    handEl.classList.remove('hand-lock');
    renderHand(); updateCoach();
    const canRiichi = shanten(state.hands[0].slice(0, 13)) <= 0 || analyzeDiscards(state.hands[0], allVisible(), state.playerCount).some(a => a.shanten === 0);
    $('#riichiButton').classList.toggle('hidden', !canRiichi || state.riichi[0] || state.scores[0] < 1000);
    setMessage(state.riichi[0] ? '立直中：请摸切或选择出牌' : '你的回合：选择一张牌打出');
  } else {
    setTimeout(() => opponentDiscard(player), 420);
  }
}

function discardHuman(index) {
  if (!state.waitingForDiscard || state.over) return;
  const tile = state.hands[0].splice(index, 1)[0];
  state.rivers[0].push(tile); state.waitingForDiscard = false;
  handEl.classList.add('hand-lock');
  $('#winButton').classList.add('hidden'); $('#riichiButton').classList.add('hidden');
  renderHand(); renderRiver(); updateCoach();
  for (let p = 1; p < state.playerCount; p++) {
    if (isWinningHand([...state.hands[p], tile])) return setTimeout(() => finishRound(p, '荣和'), 500);
  }
  setMessage('对手思考中…');
  setTimeout(() => takeTurn(1), 360);
}

function opponentDiscard(player) {
  const analysis = analyzeDiscards(state.hands[player], allVisible(), state.playerCount);
  const difficultyNoise = Math.random() < .16 ? Math.min(2, analysis.length - 1) : 0;
  const choice = analysis[difficultyNoise]?.discard ?? state.hands[player][state.hands[player].length - 1];
  const index = state.hands[player].indexOf(choice);
  const tile = state.hands[player].splice(index, 1)[0];
  state.rivers[player].push(tile); renderOpponents();
  if (!state.riichi[player] && state.scores[player] >= 1000 && shanten(state.hands[player]) === 0 && Math.random() < .65) {
    state.riichi[player] = true; state.scores[player] -= 1000;
  }
  if (isWinningHand([...state.hands[0], tile])) {
    state.pendingRonTile = tile;
    $('#ronButton').classList.remove('hidden'); $('#skipButton').classList.remove('hidden');
    setMessage(`${playerName(player)} 打出 ${TILE_LABELS[tile]}，可以荣和！`);
    return;
  }
  continueOpponents();
}

function continueOpponents() {
  const next = state.turn + 1;
  if (next < state.playerCount) setTimeout(() => takeTurn(next), 330);
  else setTimeout(() => takeTurn(0), 400);
}

function finishRound(winner, method) {
  if (state.over) return;
  state.over = true; state.waitingForDiscard = false;
  let points = 0; let dora = 0;
  if (winner !== null) {
    dora = countDora(state.hands[winner], state.dora);
    points = 2000 + dora * 1000 + (state.riichi[winner] ? 1000 : 0);
    if (method === '自摸') {
      const payment = Math.ceil(points / (state.playerCount - 1) / 100) * 100;
      for (let p = 0; p < state.playerCount; p++) if (p !== winner) state.scores[p] -= payment;
      state.scores[winner] += payment * (state.playerCount - 1);
    } else {
      const loser = winner === 0 ? state.turn : 0;
      state.scores[loser] -= points; state.scores[winner] += points;
    }
  }
  renderStatus();
  $('#resultEyebrow').textContent = method === '流局' ? 'EXHAUSTIVE DRAW' : 'ROUND RESULT';
  $('#resultTitle').textContent = method === '流局' ? '荒牌流局' : winner === 0 ? method : `${playerName(winner)} ${method}`;
  $('#resultText').textContent = method === '流局' ? '牌山已尽。下一局继续磨炼判断。' : winner === 0 ? '漂亮的一手。真正重要的是，你知道自己为何这样选择。' : '胜负只是一局，复盘才会留下来。';
  $('#resultStats').innerHTML = method === '流局' ? `<div>你的向听数<b>${Math.max(0, shanten(state.hands[0]))}</b></div><div>剩余牌<b>0</b></div>` : `<div>方式<b>${method}</b></div><div>宝牌<b>${dora}</b></div><div>简化得点<b>${points}</b></div>`;
  $('#resultModal').classList.remove('hidden');
  state.round += 1;
}

function playerName(index) { return index === 0 ? '玩家' : ['','北川','森','小林'][index]; }
function allVisible() { return [state.dora, ...state.rivers.flat()]; }

function tileElement(tile, options = {}) {
  const button = document.createElement(options.button === false ? 'div' : 'button');
  button.className = `tile suit-${tileSuit(tile)}${options.drawn ? ' drawn' : ''}${options.recommended ? ' recommended' : ''}`;
  button.textContent = TILE_LABELS[tile];
  button.title = TILE_LABELS[tile];
  return button;
}

function renderHand() {
  handEl.innerHTML = '';
  const best = state.mode === 'coach' && state.waitingForDiscard ? analyzeDiscards(state.hands[0], allVisible(), state.playerCount)[0]?.discard : null;
  state.hands[0].forEach((tile, index) => {
    const el = tileElement(tile, { drawn: index === state.lastDrawnIndex, recommended: tile === best });
    el.addEventListener('click', () => discardHuman(index));
    handEl.appendChild(el);
  });
}

function renderRiver() {
  riverEl.innerHTML = '';
  state.rivers[0].forEach(tile => riverEl.appendChild(tileElement(tile, { button: false })));
}

function renderWalls() {
  const host = $('#tileWalls');
  host.innerHTML = '';
  const positions = state.playerCount === 4 ? ['top', 'right', 'bottom', 'left'] : ['top', 'right', 'left'];
  const pieces = Math.max(5, Math.ceil(state.wall.length / state.playerCount / 2));
  positions.forEach(position => {
    const wall = document.createElement('div');
    wall.className = `wall wall-${position}`;
    for (let i = 0; i < Math.min(17, pieces); i += 1) {
      wall.insertAdjacentHTML('beforeend', '<i class="wall-piece"></i>');
    }
    host.appendChild(wall);
  });
}

function renderOpponents() {
  const positions = state.playerCount === 4 ? ['top','left','right'] : ['left','right'];
  $('#opponents').innerHTML = '';
  for (let p = 1; p < state.playerCount; p++) {
    const box = document.createElement('div'); box.className = `opponent ${positions[p - 1]}`;
    box.innerHTML = `<div class="opponent-info"><b>${playerName(p)}</b><span>${state.scores[p].toLocaleString()}${state.riichi[p] ? ' · 立直' : ''}</span></div><div class="concealed-hand">${state.hands[p].map(() => '<i class="back-tile"></i>').join('')}</div>`;
    $('#opponents').appendChild(box);
  }
}

function updateCoach() {
  if (state.mode !== 'coach') return;
  const container = $('#recommendations');
  if (!state.waitingForDiscard) { container.innerHTML = '<p class="coach-lead">等待你的下一次摸牌…</p>'; return; }
  const recommendations = analyzeDiscards(state.hands[0], allVisible(), state.playerCount).slice(0, 3);
  container.innerHTML = '';
  recommendations.forEach((rec, index) => {
    const item = document.createElement('div'); item.className = 'recommendation';
    item.appendChild(tileElement(rec.discard, { button: false }));
    const info = document.createElement('div');
    const shantenText = rec.shanten < 0 ? '和牌' : rec.shanten === 0 ? '听牌' : `${rec.shanten} 向听`;
    info.innerHTML = `<div class="rec-title"><b>${index === 0 ? '推荐' : `候选 ${index + 1}`}</b><span>打 ${TILE_LABELS[rec.discard]}</span></div><div class="rec-stats"><span>${shantenText}</span><span>${rec.ukeire} 枚进张</span><span>${rec.effective.length} 种有效牌</span></div><div class="rec-bar"><span style="width:${Math.min(100, rec.ukeire * 3)}%"></span></div>`;
    item.appendChild(info); container.appendChild(item);
  });
}

function updateWall() {
  $('#wallLabel').textContent = `余 ${state.wall.length}`;
  $('#centerWall').textContent = state.wall.length;
  renderWalls();
}
function renderStatus() {
  $('#scoreLabel').textContent = `${state.scores[0].toLocaleString()} 点`;
  $('#roundLabel').textContent = `东${['一','二','三','四'][((state.round - 1) % 4)]}局`;
  $('#centerRound').textContent = `東${['一','二','三','四'][((state.round - 1) % 4)]}`;
  renderOpponents();
}
function renderAll() {
  $('#doraIndicator').innerHTML = '';
  $('#doraIndicator').appendChild(tileElement(state.dora, { button: false }));
  renderHand(); renderRiver(); renderStatus(); updateWall(); updateCoach();
}
