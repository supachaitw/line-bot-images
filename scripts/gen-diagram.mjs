// Generates architecture-diagram.svg — GSB Local Dev server topology
// Rectangle nodes are drawn as 3D server-rack shapes, colored by status.
import { writeFileSync } from 'fs';

const W = 1500, H = 1080;
const D = 9; // 3D depth

const PAL = {
  up:       { face:'#d6efdd', stroke:'#4a9d68', top:'#bfe5cb', side:'#3f8a5b', rail:'#3a8f5f', text:'#1f5236', led:'#2fbf5a' },
  down:     { face:'#f4dadb', stroke:'#cf8c90', top:'#ecc6c8', side:'#b9595f', rail:'#b9595f', text:'#7d2e33', led:'#9aa1a8' },
  external: { face:'#f7ecc8', stroke:'#d8b24e', top:'#f0e0ab', side:'#c79a2e', rail:'#c79a2e', text:'#735713', led:'#e0a92a' },
  gateway:  { face:'#cfe0f3', stroke:'#6f9cd0', top:'#bcd4ee', side:'#4a7fc0', rail:'#4a7fc0', text:'#234d80', led:'#3a8fd6' },
};

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const parts = [];
const P = s => parts.push(s);

// --- a server-rack shaped node ---
function server(x, y, w, h, status, title, sub) {
  const c = PAL[status];
  const railW = 15;
  let g = `<g filter="url(#sh)">`;
  // top slab
  g += `<polygon points="${x},${y} ${x+D},${y-D} ${x+w+D},${y-D} ${x+w},${y}" fill="${c.top}" stroke="${c.stroke}" stroke-width="1"/>`;
  // right side
  g += `<polygon points="${x+w},${y} ${x+w+D},${y-D} ${x+w+D},${y+h-D} ${x+w},${y+h}" fill="${c.side}" stroke="${c.stroke}" stroke-width="1"/>`;
  // front face
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c.face}" stroke="${c.stroke}" stroke-width="1.3"/>`;
  // left rack rail
  g += `<rect x="${x}" y="${y}" width="${railW}" height="${h}" rx="3" fill="${c.rail}" opacity="0.92"/>`;
  const cx = x + railW/2;
  g += `<circle cx="${cx}" cy="${y+7}" r="2.4" fill="${c.led}"/>`;
  g += `<circle cx="${cx}" cy="${y+15}" r="2.4" fill="${c.led}" opacity="0.7"/>`;
  for (let i=0;i<3;i++) g += `<rect x="${x+4}" y="${y+h-7-i*5}" width="7" height="2" rx="1" fill="#ffffff" opacity="0.75"/>`;
  // text area
  const tx = x + railW + (w-railW)/2;
  if (sub) {
    g += `<text x="${tx}" y="${y+h/2-3}" font-size="12.5" font-weight="700" fill="${c.text}" text-anchor="middle">${esc(title)}</text>`;
    g += `<text x="${tx}" y="${y+h/2+13}" font-size="10.5" fill="${c.text}" opacity="0.85" text-anchor="middle">${esc(sub)}</text>`;
  } else {
    g += `<text x="${tx}" y="${y+h/2+4}" font-size="12.5" font-weight="700" fill="${c.text}" text-anchor="middle">${esc(title)}</text>`;
  }
  g += `</g>`;
  P(g);
  return { x, y, w, h, cx:x+w/2, cy:y+h/2, top:[x+w/2,y], bottom:[x+w/2,y+h], left:[x,y+h/2], right:[x+w,y+h/2] };
}

function group(x, y, w, h, title) {
  P(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#ffffff" stroke="#c7d0db" stroke-dasharray="6 5"/>`);
  P(`<text x="${x+14}" y="${y+20}" font-size="11.5" font-weight="700" font-style="italic" fill="#7c8a98">${esc(title)}</text>`);
}
function footer(x, y, t) { P(`<text x="${x}" y="${y}" font-size="10.5" fill="#9aa6b2" text-anchor="middle">${esc(t)}</text>`); }

function edge(a, b, label, opt={}) {
  const dash = opt.dash ? `stroke-dasharray="6 4"` : '';
  const col = opt.color || '#6b7888';
  P(`<path d="M${a[0]},${a[1]} C ${a[0]},${(a[1]+b[1])/2} ${b[0]},${(a[1]+b[1])/2} ${b[0]},${b[1]}" fill="none" stroke="${col}" stroke-width="2" ${dash} marker-end="url(#arr)"/>`);
  if (label) {
    const mx = (a[0]+b[0])/2, my = (a[1]+b[1])/2;
    const tw = label.length*5.7+8;
    P(`<rect x="${mx-tw/2}" y="${my-9}" width="${tw}" height="16" rx="3" fill="#ffffff" opacity="0.9"/>`);
    P(`<text x="${mx}" y="${my+3}" font-size="10" fill="#4a5663" text-anchor="middle">${esc(label)}</text>`);
  }
}

// ===== defs / background =====
P(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Loma','Noto Sans Thai','Segoe UI',Helvetica,Arial,sans-serif">`);
P(`<defs>
  <radialGradient id="bg" cx="0.5" cy="0.05" r="1"><stop offset="0" stop-color="#fcfdff"/><stop offset="1" stop-color="#eef1f6"/></radialGradient>
  <filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#1c2530" flood-opacity="0.18"/></filter>
  <marker id="arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" fill="#6b7888"/></marker>
</defs>`);
P(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);

// title + legend
P(`<text x="${W/2}" y="40" font-size="23" font-weight="800" fill="#222b36" text-anchor="middle">GSB Local Dev — Server Topology (WSL2 Ubuntu / Docker engine เดียว)</text>`);
P(`<text x="${W/2}" y="62" font-size="12.5" fill="#7a8794" text-anchor="middle">เขียว = UP · แดง = DOWN (ตั้งไว้ ไม่ได้รัน) · เหลือง = นอกเครื่อง/VPN · ทุก domain ลงท้าย .gsb.or.th</text>`);

// ===== top spine =====
const browser = server(630, 78, 240, 50, 'external', 'Windows Browser', 'hosts: *.gsb.or.th -> 127.0.0.1');
const gateway = server(600, 162, 300, 56, 'gateway', 'gsb-gateway (nginx) UP', 'ครอง host :80 + :443 — route ตาม Host header');
footer(750, 232, 'project: gateway');
edge(browser.bottom, gateway.top, ':443');

// ===== family groups =====
group(30, 250, 300, 310, 'WebCSR family — cbswebdev / cbswebuat');
const proxy = server(50, 295, 250, 50, 'up', 'gsb-proxy (nginx) UP', ':443 internal — path router');
const webcsr = server(50, 400, 118, 64, 'up', 'webcsr UP', 'Tomcat 8.5 · :8080');
const webadmin = server(182, 400, 118, 64, 'down', 'webadmin DOWN', 'Tomcat · :8082');
footer(180, 520, 'project: webcsr_dev_v111800');
edge(proxy.bottom, [webcsr.cx, webcsr.y], '/WebCSR/');
edge([proxy.cx+40, proxy.y+proxy.h], [webadmin.cx, webadmin.y], '/WebAdmin/');

group(350, 250, 215, 310, 'CBS Banking — gsbschoolbank-dev');
const schNginx = server(372, 300, 170, 46, 'down', 'gsb-school-nginx', ':443');
const schWeb = server(372, 378, 170, 46, 'down', 'gsb-school-web', ':3000');
const schDb = server(372, 456, 170, 46, 'down', 'gsb-school-db', '(pg) :5433');
footer(457, 530, 'project: server · ทั้งหมด DOWN');
edge(schNginx.bottom, schWeb.top);
edge(schWeb.bottom, schDb.top);

group(585, 250, 305, 310, 'Linkage Center — linkage-dev / linkage-uat');
const lkApp = server(602, 300, 132, 46, 'down', 'gsb-machine-webapp', ':3000');
server(748, 300, 132, 46, 'down', 'gsb-machine-thaid', ':3000 /thaid/');
server(602, 362, 132, 46, 'down', 'gsb-machine-api', '');
server(748, 362, 132, 46, 'down', 'gsb-machine-redis', '');
server(602, 424, 132, 46, 'down', 'gsblk-mysql', ':3307');
server(748, 424, 132, 46, 'down', 'gsblk-fwd', ':3001');
footer(737, 530, 'projects: server / gsblk · DOWN');

group(910, 250, 320, 310, 'TANACHOK — tanachok-dev / tanachok-sit');
const tnGw = server(926, 300, 144, 46, 'down', 'tanachok-gateway', ':8800 -> :80');
server(1072, 300, 144, 46, 'down', 'tanachok-web', ':5173');
server(926, 362, 144, 46, 'down', 'tanachok-api', ':8085');
server(1072, 362, 144, 46, 'down', 'tanachok-pdf', ':7000');
server(926, 424, 144, 46, 'down', 'tanachok-postgres', ':5432');
server(1072, 424, 144, 46, 'down', 'tanachok-adminer', ':8081');
footer(1070, 530, 'project: tanachok-next · DOWN');

// gateway fan-out
edge([gateway.cx-90, gateway.y+gateway.h], proxy.top, 'cbsweb* -> gsb-proxy:443');
edge([gateway.cx-30, gateway.y+gateway.h], schNginx.top, 'gsbschool*');
edge([gateway.cx+30, gateway.y+gateway.h], lkApp.top, 'linkage*');
edge([gateway.cx+90, gateway.y+gateway.h], tnGw.top, 'tanachok* -> :8800');

// ===== secondary groups =====
group(30, 600, 290, 175, 'PDTeller (แยกวง — ไม่ผ่าน gateway)');
server(55, 648, 240, 60, 'up', 'pdteller-tomcat UP', ':18080 — Web Start (.jnlp)');
footer(175, 745, 'project: lab');

group(340, 600, 365, 175, 'CI/CD Lab (DOWN ทั้งหมดตอนนี้) — project: ci-lab');
server(356, 650, 110, 70, 'down', 'ci-gitlab', ':8929 (+2224 ssh)');
server(478, 650, 110, 70, 'down', 'ci-jenkins', ':8090 (+50000)');
server(600, 650, 100, 70, 'down', 'ci-nexus', ':8091 reg:8092');
footer(522, 750, 'source + webhook · Multibranch · docker registry');

group(725, 600, 235, 175, 'TellerPortal (DOWN)');
server(745, 650, 100, 56, 'down', 'teller-portal', ':8088');
server(855, 650, 95, 56, 'down', 'teller-tis', ':8443');

group(980, 600, 250, 175, 'BAHTNET mock (DOWN) — project: local-dev');
server(996, 650, 110, 56, 'down', 'gsb-bahtnet-service', ':8083');
server(1116, 650, 108, 56, 'down', 'bahtnet-core-mock', ':8089');

// ===== bottom: external CBS + JDBC link =====
const cbs = server(30, 838, 380, 70, 'external', 'CBS (Sanchez core banking) — นอกเครื่อง', 'cbsdevdb / cbssitdb / cbsuatdb · .gsb = 10.82.77.x');
P(`<text x="220" y="928" font-size="10" fill="#8a6f24" text-anchor="middle">ผ่าน GSB VPN + extra_hosts · webcsr ต่อด้วย Sanchez JDBC (ScDriver) / MRPC</text>`);
edge([webcsr.cx, webcsr.y+webcsr.h], [cbs.cx-30, cbs.y], 'JDBC/MRPC', { dash:true, color:'#c79a2e' });

// host ports info box
P(`<rect x="440" y="838" width="540" height="78" rx="10" fill="#ffffff" stroke="#c7d0db"/>`);
P(`<text x="456" y="858" font-size="11.5" font-weight="700" fill="#3a4654">Host ports ที่ publish (เข้าจาก Windows ได้):</text>`);
P(`<text x="456" y="878" font-size="10.5" fill="#4a5663">80/443 gateway · 8080 webcsr · 8082 webadmin · 18080 pdteller · 8443 teller-tis</text>`);
P(`<text x="456" y="894" font-size="10.5" fill="#4a5663">8929 gitlab · 8090 jenkins · 8091/8092 nexus · 8800 tanachok · 5173 tanachok-web</text>`);
P(`<text x="456" y="910" font-size="10.5" fill="#4a5663">3307 gsblk-mysql · 3001 gsblk-fwd · 5433 school-db · 8083/8089 bahtnet</text>`);

// legend chips (top-left, below title — clear of the centered subtitle)
const lg = [['up','UP'],['down','DOWN (ตั้งไว้)'],['external','นอกเครื่อง/VPN'],['gateway','gateway']];
P(`<text x="34" y="98" font-size="11" font-weight="700" fill="#7a8794">สถานะ:</text>`);
let lx = 86;
for (const [s,t] of lg) {
  const c = PAL[s];
  P(`<rect x="${lx}" y="88" width="14" height="14" rx="3" fill="${c.face}" stroke="${c.stroke}"/>`);
  P(`<text x="${lx+19}" y="99" font-size="10.5" fill="#4a5663">${esc(t)}</text>`);
  lx += 24 + t.length*6.2 + 14;
}

P(`</svg>`);
writeFileSync(new URL('../architecture-diagram.svg', import.meta.url), parts.join('\n'));
console.log('wrote architecture-diagram.svg');
