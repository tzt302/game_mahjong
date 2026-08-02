export const TILE_LABELS = [
  '一萬','二萬','三萬','四萬','五萬','六萬','七萬','八萬','九萬',
  '一筒','二筒','三筒','四筒','五筒','六筒','七筒','八筒','九筒',
  '一索','二索','三索','四索','五索','六索','七索','八索','九索',
  '東','南','西','北','白','發','中'
];

export function tileSuit(tile) {
  if (tile < 9) return 'm';
  if (tile < 18) return 'p';
  if (tile < 27) return 's';
  return 'z';
}

export function createWall(playerCount = 4) {
  const wall = [];
  for (let tile = 0; tile < 34; tile += 1) {
    if (playerCount === 3 && tile >= 1 && tile <= 7) continue;
    for (let copy = 0; copy < 4; copy += 1) wall.push(tile);
  }
  return wall;
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function countsFromHand(hand) {
  const counts = Array(34).fill(0);
  hand.forEach(tile => { counts[tile] += 1; });
  return counts;
}

export const ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

export function isKokushi(hand) {
  if (hand.length !== 14) return false;
  const counts = countsFromHand(hand);
  return ORPHANS.every(tile => counts[tile] >= 1) && ORPHANS.some(tile => counts[tile] >= 2);
}

function collectMelds(counts, melds, output) {
  const first = counts.findIndex(value => value > 0);
  if (first < 0) {
    output.push(melds.map(meld => ({ ...meld })));
    return;
  }
  if (counts[first] >= 3) {
    counts[first] -= 3;
    collectMelds(counts, [...melds, { type: 'triplet', tile: first }], output);
    counts[first] += 3;
  }
  if (first < 27 && first % 9 <= 6 && counts[first + 1] && counts[first + 2]) {
    counts[first]--; counts[first + 1]--; counts[first + 2]--;
    collectMelds(counts, [...melds, { type: 'sequence', tile: first }], output);
    counts[first]++; counts[first + 1]++; counts[first + 2]++;
  }
}

export function getWinningDecompositions(hand) {
  if (hand.length % 3 !== 2 || hand.length < 2 || hand.length > 14) return [];
  const counts = countsFromHand(hand);
  const output = [];
  if (hand.length === 14 && counts.filter(value => value === 2).length === 7) output.push({ kind: 'chiitoi', pair: null, melds: [] });
  if (hand.length === 14 && isKokushi(hand)) output.push({ kind: 'kokushi', pair: null, melds: [] });
  const meldsNeeded = (hand.length - 2) / 3;
  for (let pair = 0; pair < 34; pair += 1) {
    if (counts[pair] < 2) continue;
    const remaining = [...counts];
    remaining[pair] -= 2;
    const meldSets = [];
    collectMelds(remaining, [], meldSets);
    meldSets.filter(melds => melds.length === meldsNeeded).forEach(melds => output.push({ kind: 'standard', pair, melds }));
  }
  return output;
}

function canFormMelds(counts, meldsNeeded) {
  if (meldsNeeded === 0) return counts.every(value => value === 0);
  const first = counts.findIndex(value => value > 0);
  if (first < 0) return false;
  if (counts[first] >= 3) {
    counts[first] -= 3;
    if (canFormMelds(counts, meldsNeeded - 1)) return true;
    counts[first] += 3;
  }
  if (first < 27 && first % 9 <= 6 && counts[first + 1] && counts[first + 2]) {
    counts[first] -= 1; counts[first + 1] -= 1; counts[first + 2] -= 1;
    if (canFormMelds(counts, meldsNeeded - 1)) return true;
    counts[first] += 1; counts[first + 1] += 1; counts[first + 2] += 1;
  }
  return false;
}

export function isWinningHand(hand) {
  if (hand.length % 3 !== 2) return false;
  if (isKokushi(hand)) return true;
  const counts = countsFromHand(hand);
  const pairs = counts.filter(value => value === 2).length;
  if (hand.length === 14 && pairs === 7) return true;
  const meldsNeeded = (hand.length - 2) / 3;
  for (let tile = 0; tile < 34; tile += 1) {
    if (counts[tile] < 2) continue;
    counts[tile] -= 2;
    if (canFormMelds([...counts], meldsNeeded)) return true;
    counts[tile] += 2;
  }
  return false;
}

function normalShanten(counts, index = 0, melds = 0, pairs = 0, taatsu = 0) {
  while (index < 34 && counts[index] === 0) index += 1;
  if (index >= 34) {
    const usableTaatsu = Math.min(taatsu, 4 - melds);
    return 8 - melds * 2 - usableTaatsu - Math.min(pairs, 1);
  }
  let best = 8;
  if (counts[index] >= 3) {
    counts[index] -= 3;
    best = Math.min(best, normalShanten(counts, index, melds + 1, pairs, taatsu));
    counts[index] += 3;
  }
  if (index < 27 && index % 9 <= 6 && counts[index + 1] && counts[index + 2]) {
    counts[index]--; counts[index + 1]--; counts[index + 2]--;
    best = Math.min(best, normalShanten(counts, index, melds + 1, pairs, taatsu));
    counts[index]++; counts[index + 1]++; counts[index + 2]++;
  }
  if (counts[index] >= 2) {
    counts[index] -= 2;
    best = Math.min(best, normalShanten(counts, index, melds, pairs + 1, taatsu));
    counts[index] += 2;
  }
  if (index < 27 && index % 9 <= 7 && counts[index + 1]) {
    counts[index]--; counts[index + 1]--;
    best = Math.min(best, normalShanten(counts, index, melds, pairs, taatsu + 1));
    counts[index]++; counts[index + 1]++;
  }
  if (index < 27 && index % 9 <= 6 && counts[index + 2]) {
    counts[index]--; counts[index + 2]--;
    best = Math.min(best, normalShanten(counts, index, melds, pairs, taatsu + 1));
    counts[index]++; counts[index + 2]++;
  }
  counts[index]--;
  best = Math.min(best, normalShanten(counts, index, melds, pairs, taatsu));
  counts[index]++;
  return best;
}

export function shanten(hand, fixedMelds = 0) {
  const counts = countsFromHand(hand);
  const standard = normalShanten([...counts], 0, fixedMelds);
  if (fixedMelds > 0) return standard;
  const pairKinds = counts.filter(value => value >= 2).length;
  const uniqueKinds = counts.filter(value => value > 0).length;
  const sevenPairs = 6 - pairKinds + Math.max(0, 7 - uniqueKinds);
  const orphanKinds = ORPHANS.filter(tile => counts[tile] > 0).length;
  const orphanPair = ORPHANS.some(tile => counts[tile] >= 2) ? 1 : 0;
  const kokushi = 13 - orphanKinds - orphanPair;
  return Math.min(standard, sevenPairs, kokushi);
}

export function analyzeDiscards(hand, visibleTiles = [], playerCount = 4, fixedMelds = 0) {
  const visible = countsFromHand(visibleTiles);
  const allowed = createWall(playerCount).filter((tile, index, arr) => index === 0 || arr[index - 1] !== tile);
  return [...new Set(hand)].map(discard => {
    const reduced = [...hand];
    reduced.splice(reduced.indexOf(discard), 1);
    const currentShanten = shanten(reduced, fixedMelds);
    const effective = [];
    let ukeire = 0;
    for (const draw of allowed) {
      const remaining = 4 - reduced.filter(tile => tile === draw).length - visible[draw];
      if (remaining <= 0) continue;
      if (shanten([...reduced, draw], fixedMelds) < currentShanten) {
        effective.push(draw);
        ukeire += remaining;
      }
    }
    const centerBonus = discard < 27 ? 4 - Math.abs(4 - discard % 9) : 0;
    return { discard, shanten: currentShanten, ukeire, effective, score: -currentShanten * 100 + ukeire - centerBonus * .15 };
  }).sort((a, b) => b.score - a.score || a.discard - b.discard);
}

export function nextDora(indicator) {
  if (indicator < 27) return Math.floor(indicator / 9) * 9 + ((indicator % 9 + 1) % 9);
  if (indicator <= 30) return 27 + ((indicator - 27 + 1) % 4);
  return 31 + ((indicator - 31 + 1) % 3);
}

export function countDora(hand, indicator) {
  const dora = nextDora(indicator);
  return hand.filter(tile => tile === dora).length;
}
