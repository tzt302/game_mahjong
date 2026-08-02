const NUMBERS = ['一','二','三','四','五','六','七','八','九'];
const HONORS = ['東','南','西','北','白','發','中'];
const PIN_LAYOUTS = {
  1:[[50,50]], 2:[[32,28],[68,72]], 3:[[28,25],[50,50],[72,75]],
  4:[[30,28],[70,28],[30,72],[70,72]], 5:[[28,25],[72,25],[50,50],[28,75],[72,75]],
  6:[[30,20],[70,20],[30,50],[70,50],[30,80],[70,80]],
  7:[[50,14],[27,35],[73,35],[27,60],[73,60],[27,85],[73,85]],
  8:[[28,14],[72,14],[28,38],[72,38],[28,62],[72,62],[28,86],[72,86]],
  9:[[25,18],[50,18],[75,18],[25,50],[50,50],[75,50],[25,82],[50,82],[75,82]]
};

function pinFace(rank) {
  const circles = PIN_LAYOUTS[rank].map(([x,y], index) => {
    const color = rank === 1 ? '#c73e39' : ['#26705a','#2b6383','#c64b3f'][index % 3];
    return `<g transform="translate(${x} ${y})"><circle r="10" fill="none" stroke="${color}" stroke-width="3"/><circle r="5" fill="none" stroke="${color}" stroke-width="2"/><circle r="1.8" fill="${color}"/></g>`;
  }).join('');
  return `<svg class="tile-svg" viewBox="0 0 100 100" aria-hidden="true">${circles}</svg>`;
}

function souFace(rank) {
  const coords = PIN_LAYOUTS[rank];
  if (rank === 1) return `<svg class="tile-svg" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 78V39M50 45C25 38 24 20 39 14c9 6 14 14 11 31M50 45c25-7 26-25 11-31-9 6-14 14-11 31" fill="none" stroke="#27705a" stroke-width="7" stroke-linecap="round"/><path d="M48 51l-18 17m22-12 18 17" stroke="#c4473d" stroke-width="5" stroke-linecap="round"/></svg>`;
  const sticks = coords.map(([x,y], index) => `<g transform="translate(${x} ${y}) rotate(${index % 2 ? 4 : -4})"><path d="M0-10V10" stroke="${index === 4 ? '#c4473d' : '#27705a'}" stroke-width="6" stroke-linecap="round"/><path d="M-5-4L5 4M-5 4L5-4" stroke="#e9f0df" stroke-width="1.8"/></g>`).join('');
  return `<svg class="tile-svg" viewBox="0 0 100 100" aria-hidden="true">${sticks}</svg>`;
}

export function tileFaceMarkup(tile) {
  if (tile < 9) return `<span class="man-face"><b>${NUMBERS[tile]}</b><i>萬</i></span>`;
  if (tile < 18) return pinFace(tile - 8);
  if (tile < 27) return souFace(tile - 17);
  const honor = HONORS[tile - 27];
  const className = tile === 32 ? 'green-honor' : tile === 33 ? 'red-honor' : tile === 31 ? 'white-honor' : '';
  return `<span class="honor-face ${className}">${honor}</span>`;
}
