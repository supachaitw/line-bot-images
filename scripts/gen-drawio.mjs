// Generates architecture-diagram.drawio — GSB topology using draw.io
// isometric network stencils (mxgraph.networks.*) so nodes look like real
// server machines in a network diagram. Status conveyed by fill colour.
import { writeFileSync } from 'fs';

const STATUS = {
  up:       { fill:'#D5E8D4', stroke:'#82B366' },
  down:     { fill:'#F8CECC', stroke:'#B85450' },
  external: { fill:'#FFF2CC', stroke:'#D6B656' },
  gateway:  { fill:'#DAE8FC', stroke:'#6C8EBF' },
};
// icon kinds -> stencils. 'server' renders as a Citrix tower server so
// machine nodes look like physical server towers; proxy/pc use the
// isometric mxgraph.networks family.
const NET = { pc:'pc', proxy:'proxy_server', fw:'firewall' };
function shapeStyle(icon) {
  if (icon === 'server') return 'shape=mxgraph.citrix.tower_server;aspect=fixed;';
  return `shape=mxgraph.networks.${NET[icon]};`;
}

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const cells = [];
let uid = 10;
const nid = () => 'n' + (uid++);

// Build the node's HTML label, then escape the WHOLE thing for use inside
// an XML value="" attribute (tags + inner quotes must become entities).
function label(name, sub) {
  let v = `<b>${name}</b>`;
  if (sub) v += `<br><font style="font-size:9px">${sub}</font>`;
  return esc(v);
}

function node(icon, status, name, sub, x, y, w=72, h=58) {
  const id = nid();
  const s = STATUS[status];
  const style = shapeStyle(icon) + `html=1;outlineConnect=0;align=center;`
    + `verticalLabelPosition=bottom;verticalAlign=top;labelPosition=center;`
    + `strokeWidth=2;gradientColor=none;fontColor=#1a2734;fontSize=11;`
    + `fillColor=${s.fill};strokeColor=${s.stroke};`;
  // Tower servers render with proper tall proportions, centred on the slot.
  let gx = x, gy = y, gw = w, gh = h;
  if (icon === 'server') { gw = 64; gh = 74; gx = x + Math.round((w - gw) / 2); gy = y - 8; }
  cells.push(`<mxCell id="${id}" value="${label(name,sub)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${gx}" y="${gy}" width="${gw}" height="${gh}" as="geometry"/></mxCell>`);
  return { id, x: gx, y: gy, w: gw, h: gh };
}

function box(x, y, w, h, title) {
  const id = nid();
  const style = `rounded=1;arcSize=3;fillColor=none;strokeColor=#9bb0c4;dashed=1;dashPattern=6 4;`
    + `verticalAlign=top;align=left;spacingLeft=10;spacingTop=6;fontColor=#6b7c8c;fontStyle=2;fontSize=12;`;
  cells.push(`<mxCell id="${id}" value="${esc(title)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
}

function text(x, y, w, t, opt={}) {
  const id = nid();
  const fs = opt.size||11, fc = opt.color||'#33424f', fw = opt.bold?1:0, al = opt.align||'center';
  cells.push(`<mxCell id="${id}" value="${esc(t)}" style="text;html=1;align=${al};verticalAlign=top;fontSize=${fs};fontColor=${fc};fontStyle=${fw};whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="20" as="geometry"/></mxCell>`);
}

function edge(a, b, lbl, opt={}) {
  const id = nid();
  const dash = opt.dash ? `dashed=1;` : '';
  const col = opt.color || '#6b7888';
  const style = `edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;${dash}strokeColor=${col};strokeWidth=2;`
    + `endArrow=block;endFill=1;fontColor=#33424f;fontSize=10;labelBackgroundColor=#ffffff;`;
  cells.push(`<mxCell id="${id}" value="${esc(lbl||'')}" style="${style}" edge="1" parent="1" source="${a.id}" target="${b.id}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
}

// ---- nodes ----
const browser = node('pc','external','Windows Browser','*.gsb.or.th → 127.0.0.1', 664, 40, 84, 60);
const gateway = node('proxy','gateway','gsb-gateway (nginx)',':80 + :443 · by Host', 656, 168, 96, 64);
text(640, 236, 130, 'project: gateway', {size:10, color:'#9aa6b2'});

// WebCSR family
box(40, 300, 300, 352, 'WebCSR family — cbswebdev / cbswebuat');
const proxy = node('proxy','up','gsb-proxy (nginx)',':443 path router', 150, 340, 96, 64);
const webcsr = node('server','up','webcsr UP','Tomcat :8080', 70, 470);
const webadmin = node('server','down','webadmin DOWN','Tomcat :8082', 240, 470);
text(60, 614, 260, 'project: webcsr_dev_v111800', {size:10, color:'#9aa6b2'});

// School
box(370, 300, 210, 352, 'CBS Banking — gsbschoolbank-dev');
const schNginx = node('proxy','down','gsb-school-nginx',':443', 438, 332);
const schWeb = node('server','down','gsb-school-web',':3000', 438, 432);
const schDb = node('server','down','gsb-school-db','(pg) :5433', 438, 532);
text(380, 632, 190, 'project: server · ALL DOWN', {size:10, color:'#9aa6b2'});

// Linkage
box(610, 300, 330, 352, 'Linkage Center — linkage-dev / linkage-uat');
const lkApp = node('server','down','gsb-machine-webapp',':3000', 640, 336);
node('server','down','gsb-machine-thaid',':3000 /thaid/', 800, 336);
node('server','down','gsb-machine-api','', 640, 436);
node('server','down','gsb-machine-redis','', 800, 436);
node('server','down','gsblk-mysql',':3307', 640, 536);
node('server','down','gsblk-fwd',':3001', 800, 536);
text(620, 632, 310, 'projects: server / gsblk · DOWN', {size:10, color:'#9aa6b2'});

// Tanachok
box(970, 300, 360, 352, 'TANACHOK — tanachok-dev / tanachok-sit');
const tnGw = node('proxy','down','tanachok-gateway',':8800 → :80', 1000, 336);
node('server','down','tanachok-web',':5173', 1180, 336);
node('server','down','tanachok-api',':8085', 1000, 436);
node('server','down','tanachok-pdf',':7000', 1180, 436);
node('server','down','tanachok-postgres',':5432', 1000, 536);
node('server','down','tanachok-adminer',':8081', 1180, 536);
text(980, 632, 340, 'project: tanachok-next · DOWN', {size:10, color:'#9aa6b2'});

// PDTeller
box(40, 690, 260, 210, 'PDTeller (separate — not via gateway)');
node('server','up','pdteller-tomcat UP',':18080 · .jnlp', 130, 740, 84, 64);
text(50, 858, 240, 'project: lab', {size:10, color:'#9aa6b2'});

// CI/CD
box(330, 690, 390, 210, 'CI/CD Lab (all DOWN now) — ci-lab');
node('server','down','ci-gitlab',':8929 +ssh', 360, 745);
node('server','down','ci-jenkins',':8090', 500, 745);
node('server','down','ci-nexus',':8091 reg:8092', 620, 745);
text(340, 868, 370, 'source · Multibranch build · docker registry', {size:10, color:'#9aa6b2'});

// TellerPortal
box(750, 690, 230, 210, 'TellerPortal (DOWN)');
node('server','down','teller-portal',':8088', 780, 745);
node('server','down','teller-tis',':8443', 890, 745);

// BAHTNET
box(1010, 690, 320, 210, 'BAHTNET mock (DOWN) — local-dev');
node('server','down','gsb-bahtnet-service',':8083', 1050, 745);
node('server','down','bahtnet-core-mock',':8089', 1200, 745);

// CBS external
box(40, 950, 380, 150, 'Core Banking — external / VPN');
const cbs = node('server','external','CBS (Sanchez)','cbsdev/sit/uat · 10.82.77.x', 160, 1000, 120, 64);
text(50, 1068, 360, 'via GSB VPN + extra_hosts · Sanchez JDBC (ScDriver) / MRPC', {size:9, color:'#8a6f24'});

// Host ports info
box(440, 950, 540, 150, 'Host ports published (reachable from Windows)');
text(456, 985, 520, '80/443 gateway · 8080 webcsr · 8082 webadmin · 18080 pdteller · 8443 teller-tis', {size:10, color:'#4a5663', align:'left'});
text(456, 1010, 520, '8929 gitlab · 8090 jenkins · 8091/8092 nexus · 8800 tanachok · 5173 tanachok-web', {size:10, color:'#4a5663', align:'left'});
text(456, 1035, 520, '3307 gsblk-mysql · 3001 gsblk-fwd · 5433 school-db · 8083/8089 bahtnet', {size:10, color:'#4a5663', align:'left'});

// ---- edges ----
edge(browser, gateway, ':443');
edge(gateway, proxy, 'cbsweb*');
edge(gateway, schNginx, 'gsbschool*');
edge(gateway, lkApp, 'linkage*');
edge(gateway, tnGw, 'tanachok*');
edge(proxy, webcsr, '/WebCSR/');
edge(proxy, webadmin, '/WebAdmin/');
edge(schNginx, schWeb);
edge(schWeb, schDb);
edge(webcsr, cbs, 'JDBC/MRPC', { dash:true, color:'#C79A2E' });

const xml = `<mxGraphModel dx="1400" dy="1100" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1380" pageHeight="1140" math="0" shadow="1">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="title1" value="GSB Local Dev — Server Topology (WSL2 / single Docker engine)" style="text;html=1;align=center;fontSize=20;fontStyle=1;fontColor=#222b36;" vertex="1" parent="1"><mxGeometry x="320" y="6" width="740" height="28" as="geometry"/></mxCell>
    <mxCell id="title2" value="green = UP · red = DOWN (set, not running) · yellow = external/VPN · blue = gateway · *.gsb.or.th" style="text;html=1;align=center;fontSize=11;fontColor=#7a8794;" vertex="1" parent="1"><mxGeometry x="320" y="34" width="740" height="18" as="geometry"/></mxCell>
    ${cells.join('\n    ')}
  </root>
</mxGraphModel>`;

writeFileSync(new URL('../architecture-diagram.drawio', import.meta.url), xml);
console.log('wrote architecture-diagram.drawio (' + xml.length + ' bytes)');
