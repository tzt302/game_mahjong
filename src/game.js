import { TILE_LABELS, tileSuit, createWall, shuffle, isWinningHand, shanten, analyzeDiscards } from './engine.js';
import { evaluateHand } from './scoring.js';
import { tileFaceMarkup } from './tiles.js';

const state = {
  playerCount: 4, mode: 'coach', matchType: 'east', maxRounds: 4, roundIndex: 0,
  dealer: 0, wall: [], hands: [], rivers: [], dora: 0, scores: [],
  riichi: [], doubleRiichi: [], riichiAt: [], riichiSticks: 0, totalDiscards: 0,
  turn: 0, waitingForDiscard: false, pendingRonTile: null, pendingRonFrom: null,
  lastDraw: [], lastDrawnIndex: -1, over: false, matchEnded: false,
  resultPhase: 'settlement', roundSummary: null, melds: [], pendingCalls: [],
  riichiDiscardAt: [], ippatsuValid: [], rinshan: []
};

const $ = selector => document.querySelector(selector);
const startScreen = $('#startScreen');
const gameScreen = $('#gameScreen');
const handEl = $('#hand');
const messageBar = $('#messageBar');
const WIND_LABELS = ['东', '南', '西', '北'];
const NUMBER_LABELS = ['一', '二', '三', '四'];
let tableActionTimer = null;

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
  if (state.resultPhase === 'settlement') {
    showScoreComparison();
    return;
  }
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
  state.pendingCalls = [];
  continueAfterDiscard(from);
});

$('#ponButton').addEventListener('click', () => performHumanCall(state.pendingCalls.find(call => call.type === 'pon')));
$('#kanButton').addEventListener('click', () => performHumanCall(state.pendingCalls.find(call => call.type === 'kan')));

$('#riichiButton').addEventListener('click', () => {
  if (state.scores[0] < 1000 || state.riichi[0] || state.melds[0].length) return;
  state.scores[0] -= 1000;
  state.riichiSticks += 1;
  state.riichi[0] = true;
  state.doubleRiichi[0] = state.rivers[0].length === 0 && state.totalDiscards < state.playerCount;
  state.riichiAt[0] = state.totalDiscards;
  state.ippatsuValid[0] = true;
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
  state.riichiDiscardAt = Array(state.playerCount).fill(-1);
  state.ippatsuValid = Array(state.playerCount).fill(false);
  state.rinshan = Array(state.playerCount).fill(false);
  state.melds = Array.from({ length: state.playerCount }, () => []);
  state.lastDraw = Array(state.playerCount).fill(null);
  state.totalDiscards = 0;
  state.over = false; state.waitingForDiscard = false;
  state.resultPhase = 'settlement'; state.roundSummary = null;
  state.pendingRonTile = null; state.pendingRonFrom = null; state.pendingCalls = [];
  hideCallButtons();
  for (let r = 0; r < 13; r++) {
    for (let p = 0; p < state.playerCount; p++) state.hands[p].push(state.wall.pop());
  }
  state.dora = state.wall.pop();
  state.hands.forEach(sortHand);
  $('#riichiBadge').classList.add('hidden');
  $('#resultModal').classList.add('hidden');
  $('#tableCallout').classList.add('hidden');
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
function ippatsu(player) { return state.riichi[player] && state.ippatsuValid[player] && state.totalDiscards - state.riichiAt[player] <= state.playerCount; }

function scoreFor(player, method, winTile, hand = state.hands[player]) {
  return evaluateHand(hand, {
    winTile, tsumo: method === '自摸', riichi: state.riichi[player],
    doubleRiichi: state.doubleRiichi[player], ippatsu: ippatsu(player),
    dealer: player === state.dealer, seatWind: seatWind(player), roundWind: roundWind(),
    firstTurn: firstTurn(player), haitei: method === '自摸' && state.wall.length === 0,
    houtei: method === '荣和' && state.wall.length === 0,
    doraIndicators: [state.dora], playerCount: state.playerCount,
    openMelds: state.melds[player], kanCount: state.melds[player].filter(meld => meld.type === 'kan').length,
    rinshan: state.rinshan[player]
  });
}

function takeTurn(player) {
  if (state.over) return;
  if (!state.wall.length) return finishRound(null, '流局', null, null);
  state.turn = player;
  state.rinshan[player] = false;
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
    const canRiichi = analyzeDiscards(state.hands[0], allVisible(), state.playerCount, state.melds[0].length).some(item => item.shanten === 0);
    $('#riichiButton').classList.toggle('hidden', !canRiichi || state.riichi[0] || state.scores[0] < 1000 || state.melds[0].length > 0);
    setMessage(state.riichi[0] ? '立直中：请选择摸切牌' : '你的回合：选择一张牌打出');
  } else setTimeout(() => opponentDiscard(player), 380);
}

function discardHuman(index) {
  if (!state.waitingForDiscard || state.over) return;
  if (state.riichi[0] && state.riichiDiscardAt[0] < 0) {
    const legalRiichiTiles = analyzeDiscards(state.hands[0], allVisible(), state.playerCount, 0).filter(item => item.shanten === 0).map(item => item.discard);
    if (!legalRiichiTiles.includes(state.hands[0][index])) return setMessage('立直宣言后，只能打出保持听牌的牌');
  } else if (state.riichi[0] && index !== state.lastDrawnIndex) {
    return setMessage('立直后必须摸切刚摸到的牌');
  }
  const tile = state.hands[0].splice(index, 1)[0];
  state.rinshan[0] = false;
  sortHand(state.hands[0]);
  state.rivers[0].push(tile);
  if (state.riichi[0] && state.riichiDiscardAt[0] < 0) {
    state.riichiDiscardAt[0] = state.rivers[0].length - 1;
    showTableAction('立直', 0, 'RIICHI');
  }
  state.totalDiscards += 1;
  state.waitingForDiscard = false;
  handEl.classList.add('hand-lock');
  hideCallButtons();
  renderHand(); renderRivers(0); updateCoach();

  for (let p = 1; p < state.playerCount; p++) {
    const winningHand = [...state.hands[p], tile];
    if (!isWinningHand(winningHand)) continue;
    const result = scoreFor(p, '荣和', tile, winningHand);
    if (result) return setTimeout(() => finishRound(p, '荣和', tile, 0, result), 520);
  }
  if (tryAiCall(tile, 0)) return;
  setMessage('对手思考中…');
  setTimeout(() => takeTurn(nextPlayer(0)), 320);
}

function opponentDiscard(player) {
  const analysis = analyzeDiscards(state.hands[player], allVisible(), state.playerCount, state.melds[player].length);
  const noise = Math.random() < .16 ? Math.min(2, analysis.length - 1) : 0;
  const choice = state.riichi[player] ? state.lastDraw[player] : analysis[noise]?.discard ?? state.hands[player][state.hands[player].length - 1];
  const index = state.hands[player].indexOf(choice);
  const tile = state.hands[player].splice(index, 1)[0];
  state.rinshan[player] = false;
  const wasFirstDiscard = state.rivers[player].length === 0 && state.totalDiscards < state.playerCount;
  state.rivers[player].push(tile);
  state.totalDiscards += 1;

  let declaredRiichi = false;
  if (!state.riichi[player] && !state.melds[player].length && state.scores[player] >= 1000 && shanten(state.hands[player]) === 0 && Math.random() < .68) {
    state.riichi[player] = true;
    state.doubleRiichi[player] = wasFirstDiscard;
    state.riichiAt[player] = state.totalDiscards - 1;
    state.scores[player] -= 1000;
    state.riichiSticks += 1;
    state.riichiDiscardAt[player] = state.rivers[player].length - 1;
    state.ippatsuValid[player] = true;
    declaredRiichi = true;
  }
  renderOpponents(); renderRivers(player); renderStatus();
  if (declaredRiichi) showTableAction(state.doubleRiichi[player] ? '两立直' : '立直', player, 'RIICHI');

  const humanHand = [...state.hands[0], tile];
  const humanRon = isWinningHand(humanHand) ? scoreFor(0, '荣和', tile, humanHand) : null;

  for (let p = 1; p < state.playerCount; p++) {
    if (p === player) continue;
    const winningHand = [...state.hands[p], tile];
    if (!isWinningHand(winningHand)) continue;
    const result = scoreFor(p, '荣和', tile, winningHand);
    if (result) return setTimeout(() => finishRound(p, '荣和', tile, player, result), 460);
  }
  if (offerHumanResponse(player, tile, humanRon)) return;
  if (tryAiCall(tile, player)) return;
  continueAfterDiscard(player);
}

function countTile(hand, tile) { return hand.filter(item => item === tile).length; }

function callsFor(player, tile, from) {
  if (state.riichi[player]) return [];
  const hand = state.hands[player];
  const calls = [];
  if (countTile(hand, tile) >= 2) calls.push({ type: 'pon', tile, tiles: [tile, tile, tile] });
  if (countTile(hand, tile) >= 3 && state.wall.length) calls.push({ type: 'kan', tile, tiles: [tile, tile, tile, tile] });
  if (nextPlayer(from) === player && tile < 27) {
    const suitStart = Math.floor(tile / 9) * 9;
    for (let start = tile - 2; start <= tile; start++) {
      if (start < suitStart || start + 2 >= suitStart + 9) continue;
      const needed = [start, start + 1, start + 2].filter(item => item !== tile);
      if (needed.every(item => countTile(hand, item) >= needed.filter(value => value === item).length)) {
        calls.push({ type: 'chi', tile: start, tiles: [start, start + 1, start + 2], calledTile: tile });
      }
    }
  }
  return calls;
}

function offerHumanResponse(from, tile, ronResult) {
  const calls = callsFor(0, tile, from);
  if (!ronResult && !calls.length) return false;
  state.pendingRonTile = tile;
  state.pendingRonFrom = from;
  state.pendingCalls = calls;
  $('#ronButton').classList.toggle('hidden', !ronResult);
  $('#ponButton').classList.toggle('hidden', !calls.some(call => call.type === 'pon'));
  $('#kanButton').classList.toggle('hidden', !calls.some(call => call.type === 'kan'));
  $('#skipButton').classList.remove('hidden');
  const chiCalls = calls.filter(call => call.type === 'chi');
  const choices = $('#callChoices');
  choices.innerHTML = '';
  chiCalls.forEach(call => {
    const button = document.createElement('button');
    button.className = 'action-button call chi-choice';
    button.textContent = `吃 ${call.tiles.map(item => TILE_LABELS[item]).join('·')}`;
    button.addEventListener('click', () => performHumanCall(call));
    choices.appendChild(button);
  });
  choices.classList.toggle('hidden', !chiCalls.length);
  const actions = [ronResult ? '荣和' : '', ...calls.map(call => ({ chi: '吃', pon: '碰', kan: '杠' })[call.type])].filter(Boolean);
  setMessage(`${playerName(from)} 打出 ${TILE_LABELS[tile]}：可${[...new Set(actions)].join(' / ')}`);
  return true;
}

function consumeTiles(player, call, calledTile) {
  const needed = [...call.tiles];
  needed.splice(needed.indexOf(calledTile), 1);
  needed.forEach(tile => state.hands[player].splice(state.hands[player].indexOf(tile), 1));
}

function takeCalledDiscard(from, tile) {
  const river = state.rivers[from];
  if (river[river.length - 1] === tile) river.pop();
}

function registerCall(player, call, from, calledTile) {
  consumeTiles(player, call, calledTile);
  takeCalledDiscard(from, calledTile);
  state.melds[player].push({
    type: call.type === 'chi' ? 'sequence' : call.type === 'pon' ? 'triplet' : 'kan',
    tile: call.tile, tiles: [...call.tiles], calledTile, from, open: true
  });
  state.ippatsuValid.fill(false);
  state.pendingCalls = [];
  state.pendingRonTile = null;
  state.pendingRonFrom = null;
  renderRivers();
  renderMelds();
  renderOpponents();
}

function performHumanCall(call) {
  if (!call || state.over) return;
  const from = state.pendingRonFrom;
  const calledTile = state.pendingRonTile;
  hideCallButtons();
  registerCall(0, call, from, calledTile);
  showTableAction(({ chi: '吃', pon: '碰', kan: '杠' })[call.type], 0, call.type.toUpperCase());
  state.turn = 0;
  if (call.type === 'kan') return setTimeout(() => takeKanReplacement(0), 520);
  state.waitingForDiscard = true;
  state.lastDrawnIndex = -1;
  handEl.classList.remove('hand-lock');
  renderHand(); updateCoach();
  setMessage(`${({ chi: '吃', pon: '碰' })[call.type]}成立：请选择一张牌打出`);
}

function takeKanReplacement(player) {
  if (!state.wall.length) return finishRound(null, '流局', null, null);
  const tile = state.wall.pop();
  state.hands[player].push(tile);
  state.lastDraw[player] = tile;
  state.rinshan[player] = true;
  updateWall();
  if (isWinningHand(state.hands[player])) {
    const result = scoreFor(player, '自摸', tile);
    if (result) {
      if (player === 0) {
        state.lastDrawnIndex = state.hands[0].length - 1;
        state.waitingForDiscard = true;
        renderHand();
        $('#winButton').classList.remove('hidden');
        return setMessage(`岭上开花成立：${result.yaku.map(item => item.name).join('、')}`);
      }
      return setTimeout(() => finishRound(player, '自摸', tile, null, result), 420);
    }
  }
  if (player === 0) {
    state.lastDrawnIndex = state.hands[0].length - 1;
    state.waitingForDiscard = true;
    handEl.classList.remove('hand-lock');
    renderHand(); updateCoach();
    setMessage('杠后补牌：请选择一张牌打出');
  } else setTimeout(() => opponentDiscard(player), 360);
}

function callStrength(player, call, calledTile) {
  if (call.type === 'kan') return Math.random() < .22 ? 1 : -1;
  const simulated = [...state.hands[player]];
  const needed = [...call.tiles];
  needed.splice(needed.indexOf(calledTile), 1);
  needed.forEach(tile => simulated.splice(simulated.indexOf(tile), 1));
  const before = shanten(state.hands[player], state.melds[player].length);
  const bestAfter = analyzeDiscards(simulated, allVisible(), state.playerCount, state.melds[player].length + 1)[0]?.shanten ?? 8;
  const valueHonor = call.type === 'pon' && (calledTile >= 31 || calledTile === seatWind(player) || calledTile === roundWind());
  return before - bestAfter + (valueHonor ? .6 : 0);
}

function tryAiCall(tile, from) {
  const candidates = [];
  for (let offset = 1; offset < state.playerCount; offset++) {
    const player = (from + offset) % state.playerCount;
    if (player === 0 || player === from) continue;
    const options = callsFor(player, tile, from).sort((a, b) => ({ kan: 3, pon: 2, chi: 1 })[b.type] - ({ kan: 3, pon: 2, chi: 1 })[a.type]);
    options.forEach(call => {
      if (callStrength(player, call, tile) > 0 && Math.random() < .72) candidates.push({ player, call, offset });
    });
  }
  candidates.sort((a, b) => ({ kan: 3, pon: 2, chi: 1 })[b.call.type] - ({ kan: 3, pon: 2, chi: 1 })[a.call.type] || a.offset - b.offset);
  const selected = candidates[0];
  if (!selected) return false;
  registerCall(selected.player, selected.call, from, tile);
  showTableAction(({ chi: '吃', pon: '碰', kan: '杠' })[selected.call.type], selected.player, selected.call.type.toUpperCase());
  if (selected.call.type === 'kan') setTimeout(() => takeKanReplacement(selected.player), 520);
  else setTimeout(() => opponentDiscard(selected.player), 560);
  return true;
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
  $('#ponButton').classList.add('hidden');
  $('#kanButton').classList.add('hidden');
  $('#callChoices').classList.add('hidden');
  $('#callChoices').innerHTML = '';
}

function applyScore(winner, method, loser, result) {
  const transfers = [];
  if (method === '荣和') {
    state.scores[loser] -= result.ron;
    state.scores[winner] += result.ron;
    transfers.push({ from: loser, to: winner, amount: result.ron, label: '放铳支付' });
  } else if (result.payments.each) {
    for (let p = 0; p < state.playerCount; p++) {
      if (p === winner) continue;
      state.scores[p] -= result.payments.each;
      state.scores[winner] += result.payments.each;
      transfers.push({ from: p, to: winner, amount: result.payments.each, label: '自摸支付' });
    }
  } else {
    for (let p = 0; p < state.playerCount; p++) {
      if (p === winner) continue;
      const payment = p === state.dealer ? result.payments.dealer : result.payments.child;
      state.scores[p] -= payment;
      state.scores[winner] += payment;
      transfers.push({ from: p, to: winner, amount: payment, label: '自摸支付' });
    }
  }
  if (state.riichiSticks) {
    const stickPoints = state.riichiSticks * 1000;
    state.scores[winner] += stickPoints;
    transfers.push({ from: null, to: winner, amount: stickPoints, label: '场上立直棒' });
    state.riichiSticks = 0;
  }
  return transfers;
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
  const scoresBefore = [...state.scores];
  const result = winner === null ? null : suppliedResult || scoreFor(winner, method, winTile);
  const transfers = winner !== null && result ? applyScore(winner, method, loser, result) : [];
  const scoresAfter = [...state.scores];
  renderStatus();

  $('#resultEyebrow').textContent = method === '流局' ? 'EXHAUSTIVE DRAW' : roundName();
  $('#resultTitle').textContent = method === '流局' ? '荒牌流局' : winner === 0 ? method : `${playerName(winner)} ${method}`;
  $('#winnerSeat').textContent = winner === null ? '流局' : `${WIND_LABELS[seatWind(winner) - 27]}家`;
  const winnerIsOpen = winner !== null && state.melds[winner].some(meld => meld.open);
  $('#winSource').textContent = method === '荣和' ? `${playerName(loser)} 放铳 · ${winnerIsOpen ? '副露手' : '门前手'}` : method === '自摸' ? (winnerIsOpen ? '副露后自摸' : '门前清自摸和') : method;
  renderSettlementHand(winner, method, winTile);
  renderSettlementMelds(winner);
  const yakuList = $('#yakuList');
  if (result) {
    yakuList.innerHTML = result.yaku.map(item => `<div><span>${item.name}</span><b>${item.yakuman ? `${item.yakuman}倍役满` : `${item.han}番`}</b></div>`).join('');
    const scoreLabel = result.yakuman ? result.limitName : `${result.fu}符 ${result.han}番${result.limitName ? ` · ${result.limitName}` : ''}`;
    $('#resultText').textContent = scoreLabel;
    const paymentText = method === '荣和' ? `${result.ron.toLocaleString()}点` : result.payments.each ? `${result.payments.each.toLocaleString()}点 ALL` : `庄家 ${result.payments.dealer.toLocaleString()} / 闲家 ${result.payments.child.toLocaleString()}`;
    $('#resultPointHero').textContent = `${result.total.toLocaleString()}点`;
    $('#resultPointHero').classList.remove('hidden');
    $('#resultReason').textContent = `${method}${method === '荣和' ? ` · ${playerName(loser)}放铳` : ''} · ${result.fu || '役满'}${result.fu ? '符' : ''}${result.yakuman ? '' : ` ${result.han}番`}`;
    $('#resultStats').innerHTML = `<div>符<b>${result.fu || '—'}</b></div><div>番<b>${result.yakuman ? '役满' : result.han}</b></div><div>得点<b>${paymentText}</b></div>`;
    const humanDelta = scoresAfter[0] - scoresBefore[0];
    const notice = $('#humanPaymentNotice');
    notice.className = `human-payment-notice ${humanDelta > 0 ? 'gain' : humanDelta < 0 ? 'pay' : 'neutral'}`;
    notice.textContent = humanDelta > 0 ? `你获得 ${humanDelta.toLocaleString()} 点` : humanDelta < 0 ? `你需要支付 ${Math.abs(humanDelta).toLocaleString()} 点` : '你本局没有点数变化';
  } else {
    yakuList.innerHTML = '';
    $('#resultText').textContent = '牌山已尽，本局无人和牌。';
    $('#resultStats').innerHTML = `<div>你的向听数<b>${Math.max(0, shanten(state.hands[0]))}</b></div><div>剩余牌<b>0</b></div>`;
    $('#humanPaymentNotice').className = 'human-payment-notice neutral';
    $('#humanPaymentNotice').textContent = '本局无人支付点数';
    $('#resultPointHero').classList.add('hidden');
    $('#resultReason').textContent = '无人和牌 · 进入点数确认';
  }

  state.roundIndex += 1;
  state.matchEnded = state.roundIndex >= state.maxRounds;
  state.resultPhase = 'settlement';
  state.roundSummary = { winner, method, loser, result, scoresBefore, scoresAfter, transfers };
  $('#resultPhase').classList.remove('hidden');
  $('#scorePhase').classList.add('hidden');
  $('#nextRoundButton').innerHTML = '查看分数变化 <span>→</span>';
  showWinAnnouncement(winner, method);
}

function renderSettlementHand(winner, method, winTile) {
  const host = $('#settlementHand');
  host.innerHTML = '';
  if (winner === null) {
    host.classList.add('hidden');
    return;
  }
  host.classList.remove('hidden');
  const hand = [...state.hands[winner]];
  if (method === '荣和' && hand.length % 3 === 1) hand.push(winTile);
  sortHand(hand);
  const winningIndex = hand.lastIndexOf(winTile);
  const winning = winningIndex >= 0 ? hand.splice(winningIndex, 1)[0] : null;
  if (winning !== null) hand.push(winning);
  hand.forEach((tile, index) => {
    const element = tileElement(tile, { button: false });
    element.style.animationDelay = `${index * 26}ms`;
    if (index === hand.length - 1) element.classList.add('winning-tile');
    host.appendChild(element);
  });
}

function renderSettlementMelds(winner) {
  const host = $('#settlementMelds');
  host.innerHTML = '';
  if (winner === null || !state.melds[winner].length) {
    host.classList.add('hidden');
    return;
  }
  host.classList.remove('hidden');
  const label = document.createElement('span');
  label.textContent = '副露';
  host.appendChild(label);
  state.melds[winner].forEach(meld => host.appendChild(meldElement(meld, true)));
}

function showTableAction(method, player, latin = method) {
  clearTimeout(tableActionTimer);
  const callout = $('#tableCallout');
  $('#tableCalloutMethod').textContent = latin;
  $('#tableCalloutPlayer').textContent = `${playerName(player)} · ${WIND_LABELS[seatWind(player) - 27]}家 · ${method}`;
  callout.className = `table-callout action-callout ${latin === 'RIICHI' ? 'riichi-callout' : ''}`;
  callout.style.animation = 'none';
  void callout.offsetWidth;
  callout.style.animation = '';
  tableActionTimer = setTimeout(() => callout.classList.add('hidden'), latin === 'RIICHI' ? 1050 : 720);
}

function showWinAnnouncement(winner, method) {
  clearTimeout(tableActionTimer);
  const callout = $('#tableCallout');
  const modal = $('#resultModal');
  document.querySelectorAll('.winning-seat-focus').forEach(element => element.classList.remove('winning-seat-focus'));
  $('#table').classList.add('win-freeze');
  modal.classList.add('hidden');
  modal.classList.remove('result-reveal');
  const position = winner === null ? 'center' : positionFor(winner);
  callout.className = `table-callout win-callout win-seat-${position} ${method === '荣和' ? 'win-ron' : method === '自摸' ? 'win-tsumo' : 'win-draw'}`;
  $('#tableCalloutMethod').textContent = method === '荣和' ? '荣和' : method === '自摸' ? '自摸' : method === '流局' ? '流局' : '满贯';
  $('#tableCalloutPlayer').textContent = winner === null ? '荒牌平局' : `${WIND_LABELS[seatWind(winner) - 27]}家 · ${playerName(winner)} 和牌`;
  const winnerTarget = winner === 0 ? document.querySelector('.player-zone') : winner === null ? null : document.querySelector(`.opponent.${position}`);
  winnerTarget?.classList.add('winning-seat-focus');
  callout.style.animation = 'none';
  void callout.offsetWidth;
  callout.style.animation = '';
  tableActionTimer = setTimeout(() => callout.classList.add('win-callout-leaving'), winner === null ? 850 : 1450);
  setTimeout(() => {
    callout.classList.add('hidden');
    callout.classList.remove('win-callout-leaving');
    winnerTarget?.classList.remove('winning-seat-focus');
    $('#table').classList.remove('win-freeze');
    modal.classList.remove('hidden');
    modal.classList.add('result-reveal');
  }, winner === null ? 1150 : 1850);
}

function showScoreComparison() {
  if (!state.roundSummary) return;
  state.resultPhase = 'score';
  $('#resultPhase').classList.add('hidden');
  $('#scorePhase').classList.remove('hidden');
  const { transfers, scoresBefore, scoresAfter, winner } = state.roundSummary;
  const transferHost = $('#scoreTransfers');
  transferHost.innerHTML = transfers.length ? transfers.map((transfer, index) => `
    <div class="score-transfer" style="--delay:${index * 160}ms">
      <span class="from">${transfer.from === null ? transfer.label : playerName(transfer.from)}</span>
      <strong>−${transfer.amount.toLocaleString()} →</strong>
      <span class="to">${playerName(transfer.to)}</span>
    </div>`).join('') : '<div class="human-payment-notice neutral">本局没有点数移动</div>';

  const ranking = scoresAfter.map((score, player) => ({ player, score, before: scoresBefore[player], delta: score - scoresBefore[player] })).sort((a,b) => b.score - a.score);
  const maxScore = Math.max(...scoresAfter, 1);
  $('#scoreComparison').innerHTML = ranking.map((item, index) => `
    <div class="score-row ${item.player === winner ? 'winner' : ''}" style="--delay:${index * 100 + 220}ms">
      <span class="score-rank">${index + 1}</span>
      <span class="score-name">${playerName(item.player)}${item.player === 0 ? '（你）' : ''}</span>
      <span class="score-bar"><i style="--width:${Math.max(3, item.score / maxScore * 100)}%"></i></span>
      <span class="score-numbers"><b data-from="${item.before}" data-to="${item.score}">${item.before.toLocaleString()}</b><span class="${item.delta > 0 ? 'positive' : item.delta < 0 ? 'negative' : ''}">${item.delta > 0 ? '+' : ''}${item.delta.toLocaleString()}</span></span>
    </div>`).join('');
  document.querySelectorAll('.score-numbers b').forEach(element => animateScoreNumber(element));
  $('#nextRoundButton').innerHTML = state.matchEnded ? '返回模式选择 <span>→</span>' : '下一局 <span>→</span>';
}

function animateScoreNumber(element) {
  const from = Number(element.dataset.from);
  const to = Number(element.dataset.to);
  const started = performance.now();
  const duration = 900;
  function tick(now) {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - ((1 - progress) ** 3);
    element.textContent = Math.round(from + (to - from) * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function playerName(index) { return index === 0 ? '玩家' : ['', '北川', '森', '小林'][index]; }
function allVisible() { return [state.dora, ...state.rivers.flat(), ...state.melds.flat().flatMap(meld => meld.tiles)]; }
function positionFor(player) {
  if (player === 0) return 'bottom';
  return state.playerCount === 4 ? ['', 'right', 'top', 'left'][player] : ['', 'right', 'left'][player];
}

function tileElement(tile, options = {}) {
  const element = document.createElement(options.button === false ? 'div' : 'button');
  element.className = `tile suit-${tileSuit(tile)}${options.drawn ? ' drawn' : ''}${options.recommended ? ' recommended' : ''}${options.compact ? ' compact' : ''}${options.entering ? ' tile-arrive' : ''}`;
  element.innerHTML = tileFaceMarkup(tile);
  element.title = TILE_LABELS[tile];
  element.setAttribute('aria-label', TILE_LABELS[tile]);
  return element;
}

function renderHand(animateDeal = false) {
  handEl.innerHTML = '';
  const best = state.mode === 'coach' && state.waitingForDiscard ? analyzeDiscards(state.hands[0], allVisible(), state.playerCount, state.melds[0].length)[0]?.discard : null;
  state.hands[0].forEach((tile, index) => {
    const element = tileElement(tile, { drawn: index === state.lastDrawnIndex, recommended: tile === best, entering: animateDeal });
    element.addEventListener('click', () => discardHuman(index));
    handEl.appendChild(element);
  });
}

function renderRivers(animatedPlayer = null) {
  const host = $('#rivers');
  const existingSeats = [...host.querySelectorAll('.seat-river')];
  const needsReset = existingSeats.length !== state.playerCount || existingSeats.some((seat, player) =>
    Number(seat.dataset.player) !== player || seat.children.length > state.rivers[player].length
  );
  if (needsReset) {
    host.innerHTML = '';
    for (let player = 0; player < state.playerCount; player++) {
      const seat = document.createElement('div');
      seat.className = `seat-river river-${positionFor(player)}`;
      seat.dataset.player = String(player);
      host.appendChild(seat);
    }
  }
  state.rivers.forEach((river, player) => {
    const seat = host.querySelector(`[data-player="${player}"]`);
    [...seat.children].forEach(element => element.classList.remove('latest-discard'));
    for (let index = seat.children.length; index < river.length; index++) {
      const tile = river[index];
      const element = tileElement(tile, { button: false, compact: true });
      if (index === river.length - 1) element.classList.add('latest-discard');
      if (player === animatedPlayer && index === river.length - 1) element.classList.add('discard-enter');
      if (index === state.riichiDiscardAt[player]) element.classList.add('riichi-discard');
      seat.appendChild(element);
    }
    if (seat.lastElementChild) seat.lastElementChild.classList.add('latest-discard');
  });
}

function meldElement(meld, settlement = false) {
  const group = document.createElement('div');
  group.className = `meld-group meld-${meld.type}${settlement ? ' settlement-meld' : ''}`;
  let calledMarked = false;
  meld.tiles.forEach(tile => {
    const element = tileElement(tile, { button: false, compact: true });
    if (!calledMarked && tile === meld.calledTile) {
      element.classList.add('called-tile');
      calledMarked = true;
    }
    group.appendChild(element);
  });
  return group;
}

function renderMelds() {
  const host = $('#meldsLayer');
  host.innerHTML = '';
  state.melds.forEach((melds, player) => {
    if (!melds.length) return;
    const seat = document.createElement('div');
    seat.className = `seat-melds melds-${positionFor(player)}`;
    melds.forEach(meld => seat.appendChild(meldElement(meld)));
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
    box.className = `opponent ${positionFor(p)}${state.riichi[p] ? ' opponent-riichi' : ''}`;
    box.innerHTML = `<div class="opponent-info"><b>${playerName(p)}</b><span>${WIND_LABELS[seatWind(p) - 27]}家 · ${state.scores[p].toLocaleString()}</span>${state.riichi[p] ? '<em class="riichi-state">立直</em>' : ''}</div><div class="concealed-hand">${state.hands[p].map(() => '<i class="back-tile"></i>').join('')}</div>`;
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
  const recommendations = analyzeDiscards(state.hands[0], allVisible(), state.playerCount, state.melds[0].length).slice(0, 3);
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
  renderHand(true); renderRivers(); renderMelds(); renderStatus(); updateWall(); updateCoach();
}
