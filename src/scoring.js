import { countsFromHand, getWinningDecompositions, nextDora, ORPHANS } from './engine.js';

const DRAGONS = [31, 32, 33];
const WINDS = [27, 28, 29, 30];
const GREEN = new Set([19, 20, 21, 23, 25, 32]);
const ceil100 = value => Math.ceil(value / 100) * 100;
const isHonor = tile => tile >= 27;
const isTerminal = tile => tile < 27 && (tile % 9 === 0 || tile % 9 === 8);
const isYaochu = tile => isHonor(tile) || isTerminal(tile);

function sequenceKeys(melds) {
  return melds.filter(m => m.type === 'sequence').map(m => `${Math.floor(m.tile / 9)}-${m.tile % 9}`);
}

function tripletTiles(melds) {
  return melds.filter(m => m.type === 'triplet').map(m => m.tile);
}

function waitFu(decomp, winTile) {
  if (decomp.kind !== 'standard') return 0;
  if (decomp.pair === winTile) return 2;
  const waits = [];
  decomp.melds.forEach(meld => {
    if (meld.type !== 'sequence' || winTile < meld.tile || winTile > meld.tile + 2) return;
    const offset = winTile - meld.tile;
    if (offset === 1 || (meld.tile % 9 === 0 && offset === 2) || (meld.tile % 9 === 6 && offset === 0)) waits.push(2);
    else waits.push(0);
  });
  return waits.length ? Math.min(...waits) : 0;
}

function isValuePair(pair, context) {
  return DRAGONS.includes(pair) || pair === context.seatWind || pair === context.roundWind;
}

function suitProfile(hand) {
  const suits = new Set(hand.filter(tile => tile < 27).map(tile => Math.floor(tile / 9)));
  return { suits, honors: hand.some(isHonor) };
}

function chuurenInfo(hand, winTile) {
  if (hand.some(isHonor)) return null;
  const suit = Math.floor(hand[0] / 9);
  if (hand.some(tile => Math.floor(tile / 9) !== suit)) return null;
  const counts = Array(9).fill(0);
  hand.forEach(tile => counts[tile % 9]++);
  const base = [3,1,1,1,1,1,1,1,3];
  if (!base.every((value, i) => counts[i] >= value)) return null;
  const before = [...counts];
  before[winTile % 9]--;
  return { pure: base.every((value, i) => before[i] === value) };
}

function yakumanFor(hand, decomp, context) {
  const counts = countsFromHand(hand);
  const triplets = decomp.kind === 'standard' ? tripletTiles(decomp.melds) : [];
  const items = [];
  const add = (name, multiple = 1) => items.push({ name, yakuman: multiple });
  if (context.firstTurn && context.tsumo) add(context.dealer ? '天和' : '地和');
  if (context.kanCount >= 4) add('四杠子');
  if (decomp.kind === 'kokushi') {
    const thirteenWait = ORPHANS.every(tile => tile === context.winTile ? counts[tile] === 2 : counts[tile] === 1);
    add(thirteenWait ? '国士无双十三面' : '国士无双', thirteenWait ? 2 : 1);
  }
  if (DRAGONS.every(tile => triplets.includes(tile))) add('大三元');
  const windTrips = WINDS.filter(tile => triplets.includes(tile)).length;
  if (windTrips === 4) add('大四喜', 2);
  else if (windTrips === 3 && WINDS.includes(decomp.pair)) add('小四喜');
  if (hand.every(isHonor)) add('字一色');
  if (hand.every(tile => GREEN.has(tile))) add('绿一色');
  if (hand.every(isTerminal)) add('清老头');
  if (decomp.kind === 'standard' && triplets.length === 4) {
    const tanki = decomp.pair === context.winTile;
    if (context.tsumo || tanki) add(tanki ? '四暗刻单骑' : '四暗刻', tanki ? 2 : 1);
  }
  const chuuren = chuurenInfo(hand, context.winTile);
  if (chuuren) add(chuuren.pure ? '纯正九莲宝灯' : '九莲宝灯', chuuren.pure ? 2 : 1);
  return items;
}

function regularYaku(hand, decomp, context) {
  const counts = countsFromHand(hand);
  const yaku = [];
  const add = (name, han) => yaku.push({ name, han });
  if (context.doubleRiichi) add('两立直', 2);
  else if (context.riichi) add('立直', 1);
  if (context.ippatsu && context.riichi) add('一发', 1);
  if (context.tsumo) add('门前清自摸和', 1);
  if (context.haitei) add('海底摸月', 1);
  if (context.houtei) add('河底捞鱼', 1);
  if (context.chankan) add('抢杠', 1);
  if (context.rinshan) add('岭上开花', 1);
  if (context.kanCount === 3) add('三杠子', 2);
  if (hand.every(tile => !isYaochu(tile))) add('断幺九', 1);

  const profile = suitProfile(hand);
  if (profile.suits.size === 1) add(profile.honors ? '混一色' : '清一色', profile.honors ? 3 : 6);

  if (decomp.kind === 'chiitoi') {
    add('七对子', 2);
    if (hand.every(isYaochu)) add('混老头', 2);
    return yaku;
  }
  if (decomp.kind !== 'standard') return yaku;

  const sequences = decomp.melds.filter(m => m.type === 'sequence');
  const triplets = tripletTiles(decomp.melds);
  DRAGONS.forEach(tile => { if (triplets.includes(tile)) add(`役牌：${['白','发','中'][tile - 31]}`, 1); });
  if (triplets.includes(context.seatWind)) add('役牌：自风', 1);
  if (triplets.includes(context.roundWind)) add('役牌：场风', 1);

  const pinfu = sequences.length === 4 && !isValuePair(decomp.pair, context) && waitFu(decomp, context.winTile) === 0;
  if (pinfu) add('平和', 1);

  const keys = sequenceKeys(decomp.melds);
  const frequencies = new Map();
  keys.forEach(key => frequencies.set(key, (frequencies.get(key) || 0) + 1));
  const duplicatePairs = [...frequencies.values()].filter(value => value >= 2).length;
  if (duplicatePairs >= 2) add('二杯口', 3);
  else if (duplicatePairs === 1) add('一杯口', 1);

  for (let rank = 0; rank <= 6; rank++) {
    if ([0,1,2].every(suit => keys.includes(`${suit}-${rank}`))) { add('三色同顺', 2); break; }
  }
  for (let suit = 0; suit < 3; suit++) {
    if ([0,3,6].every(rank => keys.includes(`${suit}-${rank}`))) { add('一气通贯', 2); break; }
  }
  for (let rank = 0; rank < 9; rank++) {
    if ([0,1,2].every(suit => triplets.includes(suit * 9 + rank))) { add('三色同刻', 2); break; }
  }
  if (triplets.length === 4) add('对对和', 2);

  let concealedTrips = triplets.length;
  if (!context.tsumo && triplets.includes(context.winTile) && decomp.pair !== context.winTile) concealedTrips--;
  if (concealedTrips >= 3) add('三暗刻', 2);

  const dragonTrips = DRAGONS.filter(tile => triplets.includes(tile)).length;
  if (dragonTrips === 2 && DRAGONS.includes(decomp.pair)) add('小三元', 2);
  if (hand.every(isYaochu)) add('混老头', 2);

  const groups = [...decomp.melds.map(m => m.type === 'triplet' ? [m.tile] : [m.tile,m.tile+1,m.tile+2]), [decomp.pair]];
  const everyHasYaochu = groups.every(group => group.some(isYaochu));
  if (everyHasYaochu && sequences.length) {
    if (hand.some(isHonor)) add('混全带幺九', 2);
    else add('纯全带幺九', 3);
  }
  return yaku;
}

function calculateFu(decomp, context, yaku) {
  if (decomp.kind === 'chiitoi') return 25;
  if (decomp.kind !== 'standard') return 0;
  const pinfu = yaku.some(item => item.name === '平和');
  if (pinfu && context.tsumo) return 20;
  let fu = 20;
  if (context.tsumo) fu += 2;
  else fu += 10;
  if (DRAGONS.includes(decomp.pair)) fu += 2;
  if (decomp.pair === context.seatWind) fu += 2;
  if (decomp.pair === context.roundWind) fu += 2;
  let ronTripletConsumed = false;
  decomp.melds.filter(m => m.type === 'triplet').forEach(meld => {
    const terminal = isYaochu(meld.tile);
    const openedByRon = !context.tsumo && !ronTripletConsumed && meld.tile === context.winTile && decomp.pair !== context.winTile;
    if (openedByRon) ronTripletConsumed = true;
    fu += openedByRon ? (terminal ? 4 : 2) : (terminal ? 8 : 4);
  });
  fu += waitFu(decomp, context.winTile);
  return Math.ceil(fu / 10) * 10;
}

function pointsFrom(fu, han, yakuman, dealer, tsumo, playerCount) {
  let base;
  let limitName = '';
  if (yakuman > 0) { base = 8000 * yakuman; limitName = yakuman > 1 ? `${yakuman}倍役满` : '役满'; }
  else if (han >= 13) { base = 8000; limitName = '累计役满'; }
  else if (han >= 11) { base = 6000; limitName = '三倍满'; }
  else if (han >= 8) { base = 4000; limitName = '倍满'; }
  else if (han >= 6) { base = 3000; limitName = '跳满'; }
  else {
    base = fu * (2 ** (han + 2));
    if (han >= 5 || base >= 2000) { base = 2000; limitName = '满贯'; }
  }
  if (!tsumo) {
    const ron = ceil100(base * (dealer ? 6 : 4));
    return { total: ron, ron, payments: null, limitName };
  }
  if (dealer) {
    const each = ceil100(base * 2);
    return { total: each * (playerCount - 1), ron: null, payments: { each }, limitName };
  }
  const dealerPay = ceil100(base * 2);
  const childPay = ceil100(base);
  return { total: dealerPay + childPay * Math.max(1, playerCount - 2), ron: null, payments: { dealer: dealerPay, child: childPay }, limitName };
}

export function evaluateHand(hand, options = {}) {
  const context = {
    winTile: options.winTile ?? hand[hand.length - 1], tsumo: Boolean(options.tsumo),
    riichi: Boolean(options.riichi), doubleRiichi: Boolean(options.doubleRiichi), ippatsu: Boolean(options.ippatsu),
    dealer: Boolean(options.dealer), seatWind: options.seatWind ?? 27, roundWind: options.roundWind ?? 27,
    firstTurn: Boolean(options.firstTurn), haitei: Boolean(options.haitei), houtei: Boolean(options.houtei),
    playerCount: options.playerCount ?? 4
  };
  context.chankan = Boolean(options.chankan);
  context.rinshan = Boolean(options.rinshan);
  context.kanCount = options.kanCount ?? 0;
  const decompositions = getWinningDecompositions(hand);
  if (!decompositions.length) return null;
  let best = null;
  decompositions.forEach(decomp => {
    const yakuman = yakumanFor(hand, decomp, context);
    const yakumanCount = yakuman.reduce((sum, item) => sum + item.yakuman, 0);
    let yaku = yakumanCount ? [] : regularYaku(hand, decomp, context);
    if (!yakumanCount && !yaku.length) return;
    const dora = (options.doraIndicators || []).reduce((sum, indicator) => sum + hand.filter(tile => tile === nextDora(indicator)).length, 0);
    if (!yakumanCount && dora) yaku = [...yaku, { name: '宝牌', han: dora }];
    if (!yakumanCount && options.redDora) yaku = [...yaku, { name: '赤宝牌', han: options.redDora }];
    if (!yakumanCount && options.northDora) yaku = [...yaku, { name: '北宝牌', han: options.northDora }];
    const han = yaku.reduce((sum, item) => sum + item.han, 0);
    const fu = yakumanCount ? 0 : calculateFu(decomp, context, yaku);
    const points = pointsFrom(fu, han, yakumanCount, context.dealer, context.tsumo, context.playerCount);
    const candidate = { yaku: yakumanCount ? yakuman : yaku, han, fu, yakuman: yakumanCount, ...points, decomp };
    if (!best || candidate.total > best.total) best = candidate;
  });
  return best;
}
