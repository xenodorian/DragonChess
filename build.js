// Bundles src/* into self-contained HTML pages. Usage: node build.js
//   index.html  : Dragonchess
//   wyvern.html : Wyvern Chess (no Underworld, no Sylph or Mage)
const fs = require('fs'), path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const icons = JSON.parse(rd('icons.json'));
const symbols = Object.keys(icons).map(k => `<symbol id="pc-${k}" viewBox="0 0 512 512"><path d="${icons[k].d}"/></symbol>`).join('');
const fav = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="#d59a25"/><path transform="translate(64 64) scale(.75)" fill="#3b2500" d="${icons.R.d}"/></svg>`);
const pages = [
  { out: 'index.html', id: 'dragonchess', title: 'Dragonchess', guide: 'guide.json' },
  { out: 'wyvern.html', id: 'wyvern', title: 'Wyvern Chess', guide: 'guide_wyvern.json' }
];
const shared = { CSS: rd('style.css'), SYMBOLS: symbols, FAVICON: fav, ENGINE: rd('engine.js'), SFX: rd('sfx.js'), UI: rd('ui.js') };
for (const pg of pages) {
  const parts = Object.assign({}, shared, {
    GUIDE: JSON.stringify(JSON.parse(rd(pg.guide))),
    TITLE: pg.title,
    VARIANT_ID: JSON.stringify(pg.id),
    CACHE: pg.id === 'wyvern' ? '<meta http-equiv="Cache-Control" content="no-cache">' : ''
  });
  let html = rd('template.html');
  for (const k of Object.keys(parts)) {
    if (/<\/script/i.test(parts[k]) && k !== 'SYMBOLS') throw new Error(k + ' contains a closing script tag');
    html = html.split('/*' + k + '*/').join(parts[k]);
  }
  fs.writeFileSync(path.join(__dirname, pg.out), html);
  console.log(pg.out, (html.length / 1024).toFixed(1) + ' KB');
}
