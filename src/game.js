import { TILE_LABELS, tileSuit, createWall, shuffle, isWinningHand, shanten, analyzeDiscards } from './engine.js';
import { evaluateHand } from './scoring.js';
import { tileFaceMarkup } from './tiles.js';

const state = {
  playerCount: 4, mode: 'coach', matchType: 'east', maxRounds: 4, roundIndex: 0,
  dealer: 0, wall: [], hands: [], rivers: [], dora: 0, scores: [],
  riichi: [], doubleRiichi: [], riichiAt: [], riichiSticks: 0, totalDiscards: 0,
  turn: 0, waitingForDiscard: false, pendingRonTile: null, pendingRonFrom: null,
  lastDraw: [], lastDrawnIndex: -1, over: false, matchEnded: false
};

const $ = selector => document.querySelector(selector);
const startScreen = $('#startScreen');
const gameScreen = $('#gameScreen');
const handEl = $('#hand');
const messageBar = $('#messageBar');
const WIND_LABELS = ['东', '南', '西', '北'];
const NUMBER_LABELS = ['一', '二', '三', '四'];

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
  state.matchType = document.querySelector('[data-group="match"] .active').dataset.value;
  const roundsPerWind = state.playerCount;
  state.maxRounds = state.matchType === 'single' ? 1 : state.matchType === 'hanchan' ? roundsPerWind * 2 : roundsPerWind;
  startScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  $('#coachPanel').classList.toggle('hidden', state.mode !== 'coach');
  gameScreen.style.gridTemplateColumns = state.mode === 'coach' ? '' : '1fr';
  newMatch();
});

$('#settingsButton').addEventListener('click', () => {
  if (!gameScreen.classList.contains('hidden') && !confirm('返回设置并结束当前对局？')) return;
  showStartScreen();
});

$('#nextRoundButton').addEventListener('click', () => {
  $('#resultModal').classList.add('hidden');
  if (state.matchEnded) showStartScreen();
  else newRound();
});

$('#winButton').addEventListener('click', () => finishRound(0, '自摸', state.lastDraw[0], null));
$('#ronButton').addEventListener('click', () => {
  state.hands[0].push(state.pendingRonTile);
  sortHand(state.hands[0]);
  finishRound(0, '荣和', state.pendingRonTile, state.pendingRonFrom);
});
$('#skipButton').addEventListener('click', () => {
  hideCallButtons();
  const from = state.pendingRonFrom;
  state.pendingRonTile = null; state.pendingRonFrom = null;
  continueAfterDiscard(from);
});

$('#riichiButton').addEventListener('click', () => {
  if (state.scores[0] < 1000 || state.riichi[0]) return;
  state.scores[0] -= 1000;
  state.riichiSticks += 1;
  state.riichi[0] = true;
  state.doubleRiichi[0] = state.rivers[0].length === 0 && state.totalDiscards < state.playerCount;
  state.riichiAt[0] = state.totalDiscards;
  $('#riichiBadge').classList.remove('hidden');
  $('#riichiButton').classList.add('hidden');
  setMessage(`${state.doubleRiichi[0] ? '两立直' : '立直'}！请选择一张牌打出。`);
  renderStatus();
});

$('#toggleCoach').addEventListener('click', event => {
  $('#coachContent').classList.toggle('hidden');
  event.target.textContent = $('#coachContent').classList.contains('hidden') ? '展开' : '收起';
});

function showStartScreen() {
  gameScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
  $('#resultModal').classList.add('hidden');
}

function newMatch() {
  state.roundIndex = 0;
  state.riichiSticks = 0;
  state.scores = Array(state.playerCount).fill(state.playerCount === 4 ? 25000 : 35000);
  state.matchEnded = false;
  newRound();
}

function newRound() {
  state.dealer = state.roundIndex % state.playerCount;
  state.wall = shuffle(createWall(state.playerCount));
  state.hands = Array.from({ length: state.playerCount }, () => []);
  state.rivers = Array.from({ length: state.playerCount }, () => []);
  state.riichi = Array(state.playerCount).fill(false);
  state.doubleRiichi = Array(state.playerCount).fill(false);
  state.riichiAt = Array(state.playerCount).fill(-999);
  state.lastDraw = Array(state.playerCount).fill(null);
  state.totalDiscards = 0;
  state.over = false; state.waitingForDiscard = false;
  state.pendingRonTile = null; state.pendingRonFrom = null;
  hideCallButtons();
  for (let r = 0; r < 13; r++) {
    for (let p = 0; p < state.playerCount; p++) state.hands[p].push(state.wall.pop());
  }
  state.dora = state.wall.pop();
  state.hands.forEach(sortHand);
  $('#riichiBadge').classList.add('hidden');
  $('#resultModal').classList.add('hidden');
  renderAll();
  setMessage(`${roundName()}，${playerName(state.dealer)}坐庄`);
  setTimeout(() => takeTurn(state.dealer), 450);
}

function sortHand(hand) { hand.sort((a, b) => a - b); }
function setMessage(text) { messageBar.textContent = text; }
function nextPlayer(player) { return (player + 1) % state.playerCount; }
function roundWind() { return 27 + Math.floor(state.roundIndex / state.playerCount); }
function seatWind(player) { return 27 + ((player - state.dealer + state.playerCount) % state.playerCount); }
function roundName() { return `${WIND_LABELS[roundWind() - 27]}${NUMBER_LABELS[(state.roundIndex % state.playerCount)]}局`; }
function firstTurn(player) { return state.rivers[player].length === 0 && state.totalDiscards < state.playerCount; }
function ippatsu(player) { return state.riichi[player] && state.totalDiscards - state.riichiAt[player] <= state.playerCount; }

function scoreFor(player, method, winTile, hand = state.hands[player]) {
  return evaluateHand(hand, {
    winTile, tsumo: method === '自摸', riichi: state.riichi[player],
    doubleRiichi: state.doubleRiichi[player], ippatsu: ippatsu(player),
    dealer: player === state.dealer, seatWind: seatWind(player), roundWind: roundWind(),
    firstTurn: firstTurn(player), haitei: method === '自摸' && state.wall.length === 0,
    houtei: method === '荣和' && state.wall.length === 0,
    doraIndicators: [state.dora], playerCount: state.playerCount
  });
}

function takeTurn(player) {
  if (state.over) return;
  if (!state.wall.length) return finishRound(null, '流局', null, null);
  state.turn = player;
  const drawn = state.wall.pop();
  state.lastDraw[player] = drawn;
  state.hands[player].push(drawn);
  updateWall();

  if (isWinningHand(state.hands[player])) {
    const result = scoreFor(player, '自摸', drawn);
    if (result) {
      if (player === 0) {
        state.lastDrawnIndex = state.hands[0].length - 1;
        renderHand();
        $('#winButton').classList.remove('hidden');
        setMessage(`和牌成立：${result.yaku.map(item => item.name).join('、')}`);
      } else setTimeout(() => finishRound(player, '自摸', drawn, null, result), 520);
      return;
    }
  }

  if (player === 0) {
    state.lastDrawnIndex = state.hands[0].length - 1;
    state.waitingForDiscard = true;
    handEl.classList.remove('hand-lock');
    renderHand(); updateCoach();
    const canRiichi = analyzeDiscards(state.hands[0], allVisible(), state.playerCount).some(item => item.shanten === 0);
    $('#riichiButton').classList.toggle('hidden', !canRiichi || state.riichi[0] || state.scores[0] < 1000);
    setMessage(state.riichi[0] ? '立直中：请选择摸切牌' : '你的回合：选择一张牌打出');
  } else setTimeout(() => opponentDiscard(player), 380);
}

function discardHuman(index) {
  if (!state.waitingForDiscard || state.over) return;
  const tile = state.hands[0].splice(index, 1)[0];
  sortHand(state.hands[0]);
  state.rivers[0].push(tile);
  state.totalDiscards += 1;
  state.waitingForDiscard = false;
  handEl.classList.add('hand-lock');
  hideCallButtons();
  renderHand(); renderRivers(); updateCoach();

  for (let p = 1; p < state.playerCount; p++) {
    const winningHand = [...state.hands[p], tile];
    if (!isWinningHand(winningHand)) continue;
    const result = scoreFor(p, '荣和', tile, winningHand);
    if (result) return setTimeout(() => finishRound(p, '荣和', tile, 0, result), 520);
  }
  setMessage('对手思考中…');
  setTimeout(() => takeTurn(nextPlayer(0)), 320);
}

function opponentDiscard(player) {
  const analysis = analyzeDiscards(state.hands[player], allVisible(), state.playerCount);
  const noise = Math.random() < .16 ? Math.min(2, analysis.length - 1) : 0;
  const choice = analysis[noise]?.discard ?? state.hands[player][state.hands[player].length - 1];
  const index = state.hands[player].indexOf(choice);
  const tile = state.hands[player].splice(index, 1)[0];
  const wasFirstDiscard = state.rivers[player].length === 0 && state.totalDiscards < state.playerCount;
  state.rivers[player].push(tile);
  state.totalDiscards += 1;

  if (!state.riichi[player] && state.scores[player] >= 1000 && shanten(state.hands[player]) === 0 && Math.random() < .68) {
    state.riichi[player] = true;
    state.doubleRiichi[player] = wasFirstDiscard;
    state.riichiAt[player] = state.totalDiscards - 1;
    state.scores[player] -= 1000;
    state.riichiSticks += 1;
  }
  renderOpponents(); renderRivers(); renderStatus();

  const humanHand = [...state.hands[0], tile];
  if (isWinningHand(humanHand)) {
    const result = scoreFor(0, '荣和', tile, humanHand);
    if (result) {
      state.pendingRonTile = tile;
      state.pendingRonFrom = player;
      $('#ronButton').classList.remove('hidden');
      $('#skipButton').classList.remove('hidden');
      setMessage(`${playerName(player)} 打出 ${TILE_LABELS[tile]}，可荣和：${result.yaku.map(item => item.name).join('、')}`);
      return;
    }
  }

  for (let p = 1; p < state.playerCount; p++) {
    if (p === player) continue;
    const winningHand = [...state.hands[p], tile];
    if (!isWinningHand(winningHand)) continue;
    const result = scoreFor(p, '荣和', tile, winningHand);
    if (result) return setTimeout(() => finishRound(p, '荣和', tile, player, result), 460);
  }
  continueAfterDiscard(player);
}

function continueAfterDiscard(player) {
  hideCallButtons();
  state.pendingRonTile = null; state.pendingRonFrom = null;
  setTimeout(() => takeTurn(nextPlayer(player)), 300);
}

function hideCallButtons() {
  $('#winButton').classList.add('hidden');
  $('#ronButton').classList.add('hidden');
  $('#skipButton').classList.add('hidden');
  $('#riichiButton').classList.add('hidden');
}

function applyScore(winner, method, loser, result) {
  if (method === '荣和') {
    state.scores[loser] -= result.ron;
    state.scores[winner] += result.ron;
  } else if (result.payments.each) {
    for (let p = 0; p < state.playerCount; p++) {
      if (p === winner) continue;
      state.scores[p] -= result.payments.each;
      state.scores[winner] += result.payments.each;
    }
  } else {
    for (let p = 0; p < state.playerCount; p++) {
      if (p === winner) continue;
      const payment = p === state.dealer ? result.payments.dealer : result.payments.child;
      state.scores[p] -= payment;
      state.scores[winner] += payment;
    }
  }
  if (state.riichiSticks) {
    state.scores[winner] += state.riichiSticks * 1000;
    state.riichiSticks = 0;
  }
}

function finishRound(winner, method, winTile, loser, suppliedResult = null) {
  if (state.over) return;
  state.over = true;
  state.waitingForDiscard = false;
  handEl.classList.add('hand-lock');
  hideCallButtons();
  if (winner === null && method === '流局') {
    const nagashiWinner = state.rivers.findIndex(river => river.length > 0 && river.every(tile => tile >= 27 || tile % 9 === 0 || tile % 9 === 8));
    if (nagashiWinner >= 0) {
      winner = nagashiWinner;
      method = '流局满贯';
      const dealerWin = winner === state.dealer;
      const payments = dealerWin ? { each: 4000 } : { dealer: 4000, child: 2000 };
      const total = dealerWin ? 4000 * (state.playerCount - 1) : 4000 + 2000 * Math.max(1, state.playerCount - 2);
      suppliedResult = { yaku: [{ name: '流局满贯', han: 5 }], han: 5, fu: 0, yakuman: 0, total, payments, ron: null, limitName: '满贯' };
    }
  }
  const result = winner === null ? null : suppliedResult || scoreFor(winner, method, winTile);
  if (winner !== null && result) applyScore(winner, method, loser, result);
  renderStatus();

  $('#resultEyebrow').textContent = method === '流局' ? 'EXHAUSTIVE DRAW' : roundName();
  $('#resultTitle').textContent = method === '流局' ? '荒牌流局' : winner === 0 ? method : `${playerName(winner)} ${method}`;
  const yakuList = $('#yakuList');
  if (result) {
    yakuList.innerHTML = result.yaku.map(item => `<div><span>${item.name}</span><b>${item.yakuman ? `${item.yakuman}倍役满` : `${item.han}番`}</b></div>`).join('');
    const scoreLabel = result.yakuman ? result.limitName : `${result.fu}符 ${result.han}番${result.limitName ? ` · ${result.limitName}` : ''}`;
    $('#resultText').textContent = scoreLabel;
    const paymentText = method === '荣和' ? `${result.ron.toLocaleString()}点` : result.payments.each ? `${result.payments.each.toLocaleString()}点 ALL` : `庄家 ${result.payments.dealer.toLocaleString()} / 闲家 ${result.payments.child.toLocaleString()}`;
    $('#resultStats').innerHTML = `<div>符<b>${result.fu || '—'}</b></div><div>番<b>${result.yakuman ? '役满' : result.han}</b></div><div>得点<b>${paymentText}</b></div>`;
  } else {
    yakuList.innerHTML = '';
    $('#resultText').textContent = '牌山已尽，本局无人和牌。';
    $('#resultStats').innerHTML = `<div>你的向听数<b>${Math.max(0, shanten(state.hands[0]))}</b></div><div>剩余牌<b>0</b></div>`;
  }

  state.roundIndex += 1;
  state.matchEnded = state.roundIndex >= state.maxRounds;
  if (state.matchEnded) {
    const ranking = state.scores.map((score, player) => ({ player, score })).sort((a,b) => b.score - a.score);
    $('#resultText').textContent += `　终局第一：${playerName(ranking[0].player)} ${ranking[0].score.toLocaleString()}点`;
    $('#nextRoundButton').innerHTML = '返回模式选择 <span>→</span>';
  } else $('#nextRoundButton').innerHTML = '下一局 <span>→</span>';
  $('#resultModal').classList.remove('hidden');
}

function playerName(index) { return index === 0 ? '玩家' : ['', '北川', '森', '小林'][index]; }
function allVisible() { return [state.dora, ...state.rivers.flat()]; }
function positionFor(player) {
  if (player === 0) return 'bottom';
  return state.playerCount === 4 ? ['', 'right', 'top', 'left'][player] : ['', 'right', 'left'][player];
}

function tileElement(tile, options = {}) {
  const element = document.createElement(options.button === false ? 'div' : 'button');
  element.className = `tile suit-${tileSuit(tile)}${options.drawn ? ' drawn' : ''}${options.recommended ? ' recommended' : ''}${options.compact ? ' compact' : ''}`;
  element.innerHTML = tileFaceMarkup(tile);
  element.title = TILE_LABELS[tile];
  element.setAttribute('aria-label', TILE_LABELS[tile]);
  return element;
}

function renderHand() {
  handEl.innerHTML = '';
  const best = state.mode === 'coach' && state.waitingForDiscard ? analyzeDiscards(state.hands[0], allVisible(), state.playerCount)[0]?.discard : null;
  state.hands[0].forEach((tile, index) => {
    const element = tileElement(tile, { drawn: index === state.lastDrawnIndex, recommended: tile === best });
    element.addEventListener('click', () => discardHuman(index));
    handEl.appendChild(element);
  });
}

function renderRivers() {
  const host = $('#rivers');
  host.innerHTML = '';
  state.rivers.forEach((river, player) => {
    const seat = document.createElement('div');
    seat.className = `seat-river river-${positionFor(player)}`;
    seat.dataset.player = String(player);
    river.forEach((tile, index) => {
      const element = tileElement(tile, { button: false, compact: true });
      if (index === river.length - 1) element.classList.add('latest-discard');
      seat.appendChild(element);
    });
    host.appendChild(seat);
  });
}

function renderWalls() {
  const host = $('#tileWalls');
  host.innerHTML = '';
  const positions = state.playerCount === 4 ? ['top', 'right', 'bottom', 'left'] : ['top', 'right', 'left'];
  const pieces = Math.max(5, Math.ceil(state.wall.length / state.playerCount / 2));
  positions.forEach(position => {
    const wall = document.createElement('div');
    wall.className = `wall wall-${position}`;
    for (let i = 0; i < Math.min(17, pieces); i++) wall.insertAdjacentHTML('beforeend', '<i class="wall-piece"></i>');
    host.appendChild(wall);
  });
}

function renderOpponents() {
  $('#opponents').innerHTML = '';
  for (let p = 1; p < state.playerCount; p++) {
    const box = document.createElement('div');
    box.className = `opponent ${positionFor(p)}`;
    box.innerHTML = `<div class="opponent-info"><b>${playerName(p)}</b><span>${WIND_LABELS[seatWind(p) - 27]}家 · ${state.scores[p].toLocaleString()}${state.riichi[p] ? ' · 立直' : ''}</span></div><div class="concealed-hand">${state.hands[p].map(() => '<i class="back-tile"></i>').join('')}</div>`;
    $('#opponents').appendChild(box);
  }
}

function updateCoach() {
  if (state.mode !== 'coach') return;
  const container = $('#recommendations');
  if (!state.waitingForDiscard) {
    container.innerHTML = '<p class="coach-lead">等待你的下一次摸牌…</p>';
    return;
  }
  const recommendations = analyzeDiscards(state.hands[0], allVisible(), state.playerCount).slice(0, 3);
  container.innerHTML = '';
  recommendations.forEach((rec, index) => {
    const item = document.createElement('div');
    item.className = 'recommendation';
    item.appendChild(tileElement(rec.discard, { button: false }));
    const info = document.createElement('div');
    const shantenText = rec.shanten < 0 ? '和牌' : rec.shanten === 0 ? '听牌' : `${rec.shanten} 向听`;
    info.innerHTML = `<div class="rec-title"><b>${index === 0 ? '推荐' : `候选 ${index + 1}`}</b><span>打 ${TILE_LABELS[rec.discard]}</span></div><div class="rec-stats"><span>${shantenText}</span><span>${rec.ukeire} 枚进张</span><span>${rec.effective.length} 种有效牌</span></div><div class="rec-bar"><span style="width:${Math.min(100, rec.ukeire * 3)}%"></span></div>`;
    item.appendChild(info);
    container.appendChild(item);
  });
}

function updateWall() {
  $('#wallLabel').textContent = `余 ${state.wall.length}`;
  $('#centerWall').textContent = state.wall.length;
  renderWalls();
}

function renderStatus() {
  $('#scoreLabel').textContent = `${WIND_LABELS[seatWind(0) - 27]}家 · ${state.scores[0].toLocaleString()} 点`;
  $('#roundLabel').textContent = `${roundName()} · 立直棒 ${state.riichiSticks}`;
  $('#centerRound').textContent = `${WIND_LABELS[roundWind() - 27]}${NUMBER_LABELS[state.roundIndex % state.playerCount]}`;
  renderOpponents();
}

function renderAll() {
  $('#doraIndicator').innerHTML = '';
  $('#doraIndicator').appendChild(tileElement(state.dora, { button: false, compact: true }));
  renderHand(); renderRivers(); renderStatus(); updateWall(); updateCoach();
}
