export function canDiscardAfterRiichi({
  riichi,
  riichiDiscardAt,
  index,
  lastDrawnIndex,
  tile,
  legalRiichiTiles = []
}) {
  if (!riichi) return true;
  if (riichiDiscardAt < 0) return legalRiichiTiles.includes(tile);
  return index === lastDrawnIndex;
}

export function callAnnouncement({ caller, from, method, tile }) {
  return `${caller} ${method}了 ${from} 打出的 ${tile}`;
}
