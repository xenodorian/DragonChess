// Bundles src/* into a single self-contained index.html. Usage: node build.js
const fs = require('fs'), path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const icons = JSON.parse(rd('icons.json'));
const symbols = Object.keys(icons).map(k => `<symbol id="pc-${k}" viewBox="0 0 512 512"><path d="${icons[k].d}"/></symbol>`).join('');
const fav = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="#d59a25"/><path transform="translate(64 64) scale(.75)" fill="#3b2500" d="${icons.R.d}"/></svg>`);
const parts = { CSS: rd('style.css'), SYMBOLS: symbols, FAVICON: fav, ENGINE: rd('engine.js'), SFX: rd('sfx.js'), GUIDE: JSON.stringify(JSON.parse(rd('guide.json'))), UI: rd('ui.js') };
let html = rd('template.html');
for (const k of Object.keys(parts)) {
  if (/<\/script/i.test(parts[k]) && k !== 'SYMBOLS') throw new Error(k + ' contains a closing script tag');
  html = html.split('/*' + k + '*/').join(parts[k]);
}
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(1) + ' KB');
