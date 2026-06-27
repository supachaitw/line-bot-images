// Generates architecture-tower.svg — GSB topology drawn with hand-built
// tower-server icons (so it can be rendered to a real PNG for Notion).
import { writeFileSync } from 'fs';

const W = 1360, H = 1130;
const PAL = {
  up:       { face:'#d6efdd', edge:'#4a9d68', dark:'#2f7a4e', text:'#1f5236', led:'#2fbf5a' },
  down:     { face:'#f4dadb', edge:'#cf8c90', dark:'#a64b51', text:'#7d2e33', led:'#b6bcc2' },
  external: { face:'#f7ecc8', edge:'#d8b24e', dark:'#b58a2a', text:'#735713', led:'#e0a92a' },
  gateway:  { face:'#cfe0f3', edge:'#6f9cd0', dark:'#3f6fb0', text:'#234d80', led:'#3a8fd6' },
};
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const P = [];
const add = s => P.push(s);

function towerIcon(cx, cy, c) {
  const w = 42, h = 64, d = 8;
  const x = cx - w/2, y = cy - h/2;
  let g = `<g filter="url(#sh)">`;
  g += `<polygon points="${x},${y} ${x+d},${y-d} ${x+w+d},${y-d} ${x+w},${y}" fill="${c.edge}"/>`;       // top
  g += `<polygon points="${x+w},${y} ${x+w+d},${y-d} ${x+w+d},${y+h-d} ${x+w},${y+h}" fill="${c.dark}"/>`; // side
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${c.face}" stroke="${c.edge}" stroke-width="1.4"/>`;
  for (let i=0;i<4;i++) g += `<rect x="${x+6}" y="${y+7+i*5}" width="24" height="2.6" rx="1.3" fill="${c.edge}" opacity="0.55"/>`;
  g += `<circle cx="${x+34}" cy="${y+9}" r="2.8" fill="${c.led}"/>`;
  g += `<rect x="${x+7}" y="${y+h-20}" width="28" height="6" rx="2" fill="#ffffff" opacity="0.6" stroke="${c.edge}" stroke-width="0.6"/>`;
  g += `<rect x="${x+7}" y="${y+h-11}" width="28" height="6" rx="2" fill="#ffffff" opacity="0.6" stroke="${c.edge}" stroke-width="0.6"/>`;
  g += `</g>`;
  add(g);
  return cy + h/2;
}
function proxyIcon(cx, cy, c) {
  const w = 70, h = 34, d = 6;
  const x = cx - w/2, y = cy - h/2;
  let g = `<g filter="url(#sh)">`;
  g += `<polygon points="${x},${y} ${x+d},${y-d} ${x+w+d},${y-d} ${x+w},${y}" fill="${c.edge}"/>`;
  g += `<polygon points="${x+w},${y} ${x+w+d},${y-d} ${x+w+d},${y+h-d} ${x+w},${y+h}" fill="${c.dark}"/>`;
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${c.face}" stroke="${c.edge}" stroke-width="1.4"/>`;
  // direction chevrons
  g += `<path d="M${x+12} ${y+10} l8 7 l-8 7" fill="none" stroke="${c.dark}" stroke-width="2"/>`;
  g += `<path d="M${x+26} ${y+10} l8 7 l-8 7" fill="none" stroke="${c.dark}" stroke-width="2" opacity="0.6"/>`;
  // ports
  for (let i=0;i<4;i++) g += `<rect x="${x+42+i*6}" y="${y+h-9}" width="4" height="5" rx="1" fill="${c.dark}"/>`;
  g += `<circle cx="${x+w-9}" cy="${y+9}" r="2.6" fill="${c.led}"/>`;
  g += `</g>`;
  add(g);
  return cy + h/2;
}
function pcIcon(cx, cy, c) {
  const w = 58, h = 38;
  const x = cx - w/2, y = cy - h/2;
  let g = `<g filter="url(#sh)">`;
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c.face}" stroke="${c.edge}" stroke-width="1.4"/>`;
  g += `<rect x="${x+5}" y="${y+5}" width="${w-10}" height="${h-13}" rx="2" fill="#ffffff" opacity="0.55"/>`;
  g += `<rect x="${cx-7}" y="${y+h}" width="14" height="6" fill="${c.dark}"/>`;
  g += `<rect x="${cx-17}" y="${y+h+6}" width="34" height="4" rx="2" fill="${c.edge}"/>`;
  g += `</g>`;
  add(g);
  return y + h + 10;
}

const ICON = { server: towerIcon, proxy: proxyIcon, pc: pcIcon };
const anchors = {};
function node(id, kind, status, name, sub, cx, cy) {
  const c = PAL[status];
  const bottom = ICON[kind](cx, cy, c);
  add(`<text x="${cx}" y="${bottom+15}" font-size="12" font-weight="700" fill="${c.text}" text-anchor="middle">${esc(name)}</text>`);
  if (sub) add(`<text x="${cx}" y="${bottom+29}" font-size="10" fill="${c.text}" opacity="0.85" text-anchor="middle">${esc(sub)}</text>`);
  anchors[id] = { cx, cy };
  return { cx, cy };
}
function group(x, y, w, h, title) {
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#ffffff" stroke="#c7d0db" stroke-dasharray="6 5"/>`);
  add(`<text x="${x+14}" y="${y+19}" font-size="11.5" font-weight="700" font-style="italic" fill="#7c8a98">${esc(title)}</text>`);
}
function footer(cx, y, t) { add(`<text x="${cx}" y="${y}" font-size="10" fill="#9aa6b2" text-anchor="middle">${esc(t)}</text>`); }
function info(x, y, t, opt={}) { add(`<text x="${x}" y="${y}" font-size="${opt.size||10}" fill="${opt.color||'#4a5663'}" text-anchor="${opt.anchor||'start'}">${esc(t)}</text>`); }

function edge(a, b, lbl, opt={}) {
  const A = anchors[a], B = anchors[b];
  const col = opt.color || '#6b7888';
  const dash = opt.dash ? `stroke-dasharray="6 4"` : '';
  // route from A bottom-ish to B top-ish with a vertical-mid bend
  const ax = A.cx, ay = A.cy + (opt.ay ?? 34);
  const bx = B.cx, by = B.cy - (opt.by ?? 34);
  const my = (ay + by) / 2;
  add(`<path d="M${ax},${ay} C ${ax},${my} ${bx},${my} ${bx},${by}" fill="none" stroke="${col}" stroke-width="2" ${dash} marker-end="url(#arr)"/>`);
  if (lbl) {
    const mx = (ax+bx)/2, myy = my;
    const tw = lbl.length*5.6 + 8;
    add(`<rect x="${mx-tw/2}" y="${myy-9}" width="${tw}" height="16" rx="3" fill="#ffffff" opacity="0.92"/>`);
    add(`<text x="${mx}" y="${myy+3}" font-size="10" fill="#4a5663" text-anchor="middle">${esc(lbl)}</text>`);
  }
}

// ---- canvas ----
add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Loma','Noto Sans Thai','Segoe UI',Helvetica,Arial,sans-serif">`);
add(`<defs>
  <radialGradient id="bg" cx="0.5" cy="0.04" r="1"><stop offset="0" stop-color="#fcfdff"/><stop offset="1" stop-color="#eef1f6"/></radialGradient>
  <filter id="sh" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1c2530" flood-opacity="0.18"/></filter>
  <marker id="arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" fill="#6b7888"/></marker>
</defs>`);
add(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);
add(`<text x="${W/2}" y="34" font-size="22" font-weight="800" fill="#222b36" text-anchor="middle">GSB Local Dev — Server Topology (WSL2 / single Docker engine)</text>`);
add(`<text x="${W/2}" y="56" font-size="12" fill="#7a8794" text-anchor="middle">เขียว = UP · แดง = DOWN (ตั้งไว้ ไม่ได้รัน) · เหลือง = นอกเครื่อง/VPN · ฟ้า = gateway · ทุก domain ลงท้าย .gsb.or.th</text>`);

// legend (top-left)
const lg = [['up','UP'],['down','DOWN'],['external','external/VPN'],['gateway','gateway']];
add(`<text x="34" y="92" font-size="11" font-weight="700" fill="#7a8794">สถานะ:</text>`);
let lx = 86;
for (const [s,t] of lg) { const c=PAL[s]; add(`<rect x="${lx}" y="82" width="13" height="13" rx="3" fill="${c.face}" stroke="${c.edge}"/>`); add(`<text x="${lx+18}" y="93" font-size="10.5" fill="#4a5663">${esc(t)}</text>`); lx += 22 + t.length*6.2 + 12; }

// ---- top spine ----
node('browser','pc','external','Windows Browser','*.gsb.or.th → 127.0.0.1', 706, 84);
node('gateway','proxy','gateway','gsb-gateway (nginx)',':80 + :443 · route by Host', 704, 214);
footer(704, 276, 'project: gateway');

// ---- families ----
group(40, 300, 300, 352, 'WebCSR family — cbswebdev / cbswebuat');
node('proxy','proxy','up','gsb-proxy (nginx)',':443 path router', 190, 360);
node('webcsr','server','up','webcsr UP','Tomcat :8080', 110, 480);
node('webadmin','server','down','webadmin DOWN','Tomcat :8082', 280, 480);
footer(190, 636, 'project: webcsr_dev_v111800');

group(370, 300, 210, 352, 'CBS Banking — gsbschoolbank-dev');
node('schNginx','proxy','down','gsb-school-nginx',':443', 475, 360);
node('schWeb','server','down','gsb-school-web',':3000', 475, 460);
node('schDb','server','down','gsb-school-db','(pg) :5433', 475, 560);
footer(475, 640, 'project: server · ALL DOWN');

group(610, 300, 330, 352, 'Linkage Center — linkage-dev / linkage-uat');
node('lkApp','server','down','gsb-machine-webapp',':3000', 685, 366);
node('thaid','server','down','gsb-machine-thaid',':3000 /thaid/', 865, 366);
node('mApi','server','down','gsb-machine-api','', 685, 466);
node('mRedis','server','down','gsb-machine-redis','', 865, 466);
node('mysql','server','down','gsblk-mysql',':3307', 685, 566);
node('fwd','server','down','gsblk-fwd',':3001', 865, 566);
footer(775, 640, 'projects: server / gsblk · DOWN');

group(970, 300, 350, 352, 'TANACHOK — tanachok-dev / tanachok-sit');
node('tnGw','proxy','down','tanachok-gateway',':8800 → :80', 1045, 366);
node('tnWeb','server','down','tanachok-web',':5173', 1225, 366);
node('tnApi','server','down','tanachok-api',':8085', 1045, 466);
node('tnPdf','server','down','tanachok-pdf',':7000', 1225, 466);
node('tnPg','server','down','tanachok-postgres',':5432', 1045, 566);
node('tnAdm','server','down','tanachok-adminer',':8081', 1225, 566);
footer(1145, 640, 'project: tanachok-next · DOWN');

// ---- secondary ----
group(40, 700, 260, 200, 'PDTeller (separate — not via gateway)');
node('pdteller','server','up','pdteller-tomcat UP',':18080 · .jnlp', 170, 770);
footer(170, 878, 'project: lab');

group(330, 700, 390, 200, 'CI/CD Lab (all DOWN now) — ci-lab');
node('gitlab','server','down','ci-gitlab',':8929 +ssh', 400, 770);
node('jenkins','server','down','ci-jenkins',':8090', 525, 770);
node('nexus','server','down','ci-nexus',':8091 reg:8092', 650, 770);
footer(525, 884, 'source · Multibranch build · docker registry');

group(750, 700, 230, 200, 'TellerPortal (DOWN)');
node('tellerPortal','server','down','teller-portal',':8088', 815, 770);
node('tellerTis','server','down','teller-tis',':8443', 925, 770);

group(1010, 700, 310, 200, 'BAHTNET mock (DOWN) — local-dev');
node('bahtnetSvc','server','down','gsb-bahtnet-service',':8083', 1085, 770);
node('bahtnetMock','server','down','bahtnet-core-mock',':8089', 1235, 770);

// ---- bottom ----
group(40, 948, 380, 158, 'Core Banking — external / VPN');
node('cbs','server','external','CBS (Sanchez)','cbsdev/sit/uat · 10.82.77.x', 230, 1008);
footer(230, 1092, 'via GSB VPN + extra_hosts · Sanchez JDBC (ScDriver) / MRPC');

group(440, 948, 540, 158, 'Host ports published (reachable from Windows)');
info(458, 992, '80/443 gateway · 8080 webcsr · 8082 webadmin · 18080 pdteller · 8443 teller-tis');
info(458, 1018, '8929 gitlab · 8090 jenkins · 8091/8092 nexus · 8800 tanachok · 5173 tanachok-web');
info(458, 1044, '3307 gsblk-mysql · 3001 gsblk-fwd · 5433 school-db · 8083/8089 bahtnet');

// ---- edges ----
edge('browser','gateway',':443', {ay:32, by:20});
edge('gateway','proxy','cbsweb*', {ay:20, by:17});
edge('gateway','schNginx','gsbschool*', {ay:20, by:17});
edge('gateway','lkApp','linkage*', {ay:20});
edge('gateway','tnGw','tanachok*', {ay:20, by:17});
edge('proxy','webcsr','/WebCSR/', {ay:17});
edge('proxy','webadmin','/WebAdmin/', {ay:17});
edge('schNginx','schWeb','', {ay:17});
edge('schWeb','schDb','');
edge('webcsr','cbs','JDBC/MRPC', {dash:true, color:'#C79A2E'});

add(`</svg>`);
writeFileSync(new URL('../architecture-tower.svg', import.meta.url), P.join('\n'));
console.log('wrote architecture-tower.svg');
