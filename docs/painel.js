/* =====================================================================
   Painel de Levantamento de Safras MS · Conab · SUREG-MS · SEGEO-MS
   Tudo que vem da pasta da equipe é lido só no navegador do usuário.
   ===================================================================== */
'use strict';

// ------------------------------------------------------------------ utilidades
const $ = id => document.getElementById(id);
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmtD = d => d ? d.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: '2-digit'}) : '—';
const fmtDL = d => d ? d.toLocaleDateString('pt-BR') : '—';
const addD = (d, n) => new Date(d.getTime() + n * 864e5);
const dISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const deISO = s => new Date(s + 'T12:00:00');
const n0 = v => v == null || isNaN(v) ? '—' : Math.round(v).toLocaleString('pt-BR');
const n1 = v => v == null || isNaN(v) ? '—' : v.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
const n2 = v => v == null || isNaN(v) ? '—' : v.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const pegar = u => fetch(u + (u.includes('?') ? '&' : '?') + 'v=' + Date.now()).then(r => r.ok ? r.json() : null).catch(() => null);
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const HOJE = new Date(); HOJE.setHours(12, 0, 0, 0);
const _scripts = {};
const carregarScript = u => _scripts[u] || (_scripts[u] = new Promise((ok, er) => {
  const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = () => { delete _scripts[u]; er(new Error('não foi possível carregar ' + u)); }; document.head.appendChild(s);
}));
const LIBS = {
  tess: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  tessWorker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  tessCore: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
  tessLang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
  mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
};

// ------------------------------------------------------------------ culturas (fotos, relatos e planilha)
const CULTURAS = [
  {id: 'soja', nome: 'Soja', cor: '#5f8f2a', re: /soja/},
  {id: 'milho2', nome: 'Milho 2ª safra', cor: '#c98b14', re: /milho.*(safrinha|2|segunda)/},
  {id: 'milho1', nome: 'Milho 1ª safra', cor: '#e0a526', re: /milho/},
  {id: 'sorgo', nome: 'Sorgo', cor: '#a83a2a', re: /sorgo/},
  {id: 'amendoim', nome: 'Amendoim', cor: '#b9773c', re: /amendoim/},
  {id: 'arroz', nome: 'Arroz irrigado', cor: '#4f86b8', re: /arroz/},
  {id: 'feijao2', nome: 'Feijão 2ª safra', cor: '#6e3a2e', re: /feij.*(2|segunda)/},
  {id: 'feijao1', nome: 'Feijão 1ª safra', cor: '#8b4a3a', re: /feij/},
  {id: 'algodao', nome: 'Algodão', cor: '#7d8fa3', re: /algod/},
  {id: 'trigo', nome: 'Trigo', cor: '#c29a3c', re: /trigo/},
  {id: 'aveia', nome: 'Aveia', cor: '#8f8455', re: /aveia/},
  {id: 'cana', nome: 'Cana-de-açúcar', cor: '#3f9a5a', re: /cana/},
];
const CULT = Object.fromEntries(CULTURAS.map(c => [c.id, c]));
const OUTRA = {id: 'outra', nome: 'Outras', cor: '#6b7280'};
function culturaDe(txt) { const t = norm(txt).replace(/_/g, ' '); return CULTURAS.find(c => c.re.test(t)) || null; }
// ícones simples (branco sobre a cor da cultura)
function iconeCultura(id, cor) {
  const C = cor || (CULT[id] || OUTRA).cor, W = '#fff';
  const espiga = (rx, n) => { let s = `<path d="M12 22V4" stroke="${W}" stroke-width="1.6"/>`; for (let i = 0; i < n; i++) { const y = 6 + i * 3.4; s += `<ellipse cx="9.7" cy="${y}" rx="${rx}" ry="2.6" transform="rotate(-32 9.7 ${y})" fill="${W}"/><ellipse cx="14.3" cy="${y}" rx="${rx}" ry="2.6" transform="rotate(32 14.3 ${y})" fill="${W}"/>`; } return s; };
  const g = {
    soja: `<path d="M5.5 18c-1.2-4.6 3.4-12 9.5-13.3 2.2-.3 3.6.9 3.4 3.2-.9 6.4-8.4 11-12.9 10.1z" fill="${W}"/><circle cx="9.6" cy="13.6" r="1.7" fill="${C}"/><circle cx="12.6" cy="10.4" r="1.7" fill="${C}"/><circle cx="15.4" cy="7.6" r="1.5" fill="${C}"/>`,
    milho1: `<ellipse cx="12" cy="10.5" rx="4.2" ry="7.3" fill="${W}"/><path d="M8.3 8h7.4M8 11h8M8.3 14h7.4M12 3.5v14" stroke="${C}" stroke-width=".9"/><path d="M12 22c-4-1.6-6.4-5.6-6.6-9.6 2.4 2.2 4.8 4.9 6.6 9.6zM12 22c4-1.6 6.4-5.6 6.6-9.6-2.4 2.2-4.8 4.9-6.6 9.6z" fill="${W}" opacity=".9"/>`,
    cana: `<rect x="10.8" y="2" width="2.4" height="20" rx="1" fill="${W}"/><path d="M10.4 7h3.2M10.4 12h3.2M10.4 17h3.2" stroke="${C}" stroke-width="1.4"/><path d="M13.2 9.5c2.8-3.4 5.8-4 8-3-3 .3-5.2 1.6-8 4.6zM10.8 14c-2.8-3-5.6-3.4-7.6-2.4 2.8.3 4.9 1.4 7.6 4z" fill="${W}"/>`,
    algodao: `<circle cx="8.8" cy="10" r="4.2" fill="${W}"/><circle cx="15.2" cy="10" r="4.2" fill="${W}"/><circle cx="12" cy="14.6" r="4.2" fill="${W}"/><path d="M12 18.5V22" stroke="${W}" stroke-width="2"/><path d="M12 8.5v4M9.5 12.5l2.5 1.5 2.5-1.5" stroke="${C}" stroke-width=".9" fill="none"/>`,
    trigo: espiga(1.6, 5), aveia: `<path d="M12 22V3" stroke="${W}" stroke-width="1.4"/><path d="M12 6l-4 3M12 6l4 3M12 11l-5 3M12 11l5 3M12 16l-4 3M12 16l4 3" stroke="${W}" stroke-width="1.2"/><ellipse cx="7.6" cy="9.6" rx="1.3" ry="2.2" fill="${W}"/><ellipse cx="16.4" cy="9.6" rx="1.3" ry="2.2" fill="${W}"/><ellipse cx="6.6" cy="14.6" rx="1.3" ry="2.2" fill="${W}"/><ellipse cx="17.4" cy="14.6" rx="1.3" ry="2.2" fill="${W}"/><ellipse cx="7.6" cy="19.6" rx="1.3" ry="2.2" fill="${W}"/><ellipse cx="16.4" cy="19.6" rx="1.3" ry="2.2" fill="${W}"/>`,
    arroz: `<path d="M6 22C7.5 12 11.5 5.5 18.5 3.5" stroke="${W}" stroke-width="1.6" fill="none"/>${[[9.6, 11], [12, 7.6], [14.8, 5.4], [7.9, 15.4], [11.8, 11.4], [14.9, 8.9]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.2" ry="2" transform="rotate(35 ${x} ${y})" fill="${W}"/>`).join('')}`,
    feijao1: `<path d="M6.3 9.4C6 5 12.4 3.6 15.8 5.8c4.3 2.6 3.4 10.2-1 11.4-3 .8-3.4-2.4-5.6-2.3-2.1.1-2.9 2.3-4 .4-1-1.7.9-3.4 1.1-5.9z" fill="${W}"/><path d="M12.6 9.8c.8.4 1.2 1.2 1 2" stroke="${C}" stroke-width="1.2" fill="none"/>`,
    sorgo: `<path d="M12 22V12" stroke="${W}" stroke-width="1.6"/>${[[12, 4.2], [9.6, 6], [14.4, 6], [12, 7.4], [8.8, 8.8], [15.2, 8.8], [11, 10.2], [13.4, 10.6], [10.2, 3.6], [13.8, 3.6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${W}"/>`).join('')}<path d="M12 16c2.6-2 5-2.2 6.6-1.6-2.4.4-4.4 1.4-6.6 3.4z" fill="${W}"/>`,
    amendoim: `<path d="M12 2.6c3.2 0 4.4 3.2 3.2 5.8-.6 1.4.8 2.6.8 4.8 0 4.4-2.2 8.2-4 8.2s-4-3.8-4-8.2c0-2.2 1.4-3.4.8-4.8C7.6 5.8 8.8 2.6 12 2.6z" fill="${W}"/><path d="M10 7.2h4M9.6 12.6h4.8M9.8 16.6h4.4" stroke="${C}" stroke-width=".9"/>`,
    outra: `<rect x="3.5" y="7" width="17" height="12" rx="2.2" fill="${W}"/><circle cx="12" cy="13" r="3.4" fill="${C}"/><path d="M8.6 7l1.6-2.4h3.6L15.4 7z" fill="${W}"/>`
  };
  g.milho2 = g.milho1; g.feijao2 = g.feijao1;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${g[id] || g.outra}</svg>`;
}

// ------------------------------------------------------------------ mapa
const mapa = L.map('mapa', {zoomControl: true, preferCanvas: true}).setView([-20.6, -54.6], 7);
const fundos = {
  claro: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {attribution: 'Mapa base © Esri', maxZoom: 16}),
  sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: 'Imagens © Esri', maxZoom: 18})
};
fundos.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '© OpenStreetMap', maxZoom: 18});
let fundoAtual = fundos.claro.addTo(mapa), errosFundo = 0;
// se o servidor da Esri falhar repetidamente, troca o fundo claro pelo OpenStreetMap
fundos.claro.on('tileerror', () => { if (++errosFundo === 6 && fundoAtual === fundos.claro) { mapa.removeLayer(fundos.claro); fundoAtual = fundos.osm.addTo(mapa); } });
fundos.claro.on('tileload', () => { errosFundo = 0; });
[['solo', 340], ['uso', 360], ['clima', 380], ['plantio', 390], ['rod', 405], ['lim', 415], ['clique', 420], ['destaque', 430]]
  .forEach(([n, z]) => { mapa.createPane(n).style.zIndex = z; });
mapa.getPane('destaque').style.pointerEvents = 'none';

// estado global
let dadosMun = null, MAN = null, MUN_IDX = {}, selecionado = null, camDestaque = null;
let PL = null, safraSel = null, cultSel = null, semSel = 1;      // planilhas de plantio
let CL = null, EST = null;                                        // clima
let FOTOS = [], RELATOS = [], arquivosPasta = [];
const SOLO_MUN = {};
let dadosSolo = null, modoSolo = 'ordem';

// ------------------------------------------------------------------ registro de camadas
const GRUPOS = [['lav', 'Lavouras'], ['clima', 'Clima'], ['campo', 'Fotos de campo'], ['uso', 'Uso do solo: culturas'], ['uso2', 'Uso do solo: outras ocupações'], ['solo', 'Solos'], ['ref', 'Referência']];
const CAM = {};
function defCam(id, cfg) { CAM[id] = Object.assign({id, op: 1, on: false, layer: null}, cfg); }
const OPC = id => CAM[id] ? CAM[id].op : 1;

function renderCamadas() {
  const abertos = lsGet('painel-safra.grupos', {lav: true, clima: true, campo: true, ref: true});
  $('camadas').innerHTML = GRUPOS.map(([g, nome]) => {
    const ids = Object.keys(CAM).filter(k => CAM[k].grupo === g);
    if (!ids.length) return '';
    return `<details class="grupo" data-g="${g}" ${abertos[g] ? 'open' : ''}><summary>${nome}<span class="cont" id="cont-${g}"></span></summary><div class="grupo-corpo">${ids.map(id => {
      const c = CAM[id];
      return `<div class="cam ${c.on ? 'on' : ''} ${c.desab ? 'desab' : ''}" id="cam-${id}"><div class="cam-lin"><label><input type="checkbox" id="cb-${id}" ${c.on ? 'checked' : ''} ${c.desab ? 'disabled' : ''}><span>${c.nome}</span></label><span class="st" id="st-${id}">${c.st || ''}</span><input class="op" type="range" min="10" max="100" value="${Math.round(c.op * 100)}" title="Opacidade" aria-label="Opacidade de ${c.nome}" id="op-${id}"></div><div class="sub" id="sub-${id}">${c.sub ? c.sub() : ''}</div></div>`;
    }).join('')}</div></details>`;
  }).join('');
  document.querySelectorAll('details.grupo').forEach(d => d.addEventListener('toggle', () => { abertos[d.dataset.g] = d.open; lsSet('painel-safra.grupos', abertos); }));
  Object.values(CAM).forEach(c => {
    $('cb-' + c.id).onchange = e => ligar(c.id, e.target.checked);
    $('op-' + c.id).oninput = e => definirOp(c.id, e.target.value / 100);
    c.depois && c.depois();
  });
  contarGrupos();
}
function contarGrupos() { GRUPOS.forEach(([g]) => { const el = $('cont-' + g); if (el) { const n = Object.values(CAM).filter(c => c.grupo === g && c.on).length; el.textContent = n ? n + ' ligada' + (n > 1 ? 's' : '') : ''; } }); }
function atualizarSub(id) { const c = CAM[id], el = $('sub-' + id); if (el && c.sub) { el.innerHTML = c.sub(); c.depois && c.depois(); } }
function setSt(id, t) { if (CAM[id]) CAM[id].st = t; const el = $('st-' + id); if (el) el.textContent = t || ''; }
function habilitar(id, sim) { const c = CAM[id]; if (!c) return; c.desab = !sim; const cb = $('cb-' + id), box = $('cam-' + id); if (cb) cb.disabled = !sim; if (box) box.classList.toggle('desab', !sim); }
async function ligar(id, on) {
  const c = CAM[id]; c.on = on; const box = $('cam-' + id); box && box.classList.toggle('on', on);
  if (on) { if (!c.layer) { setSt(id, 'carregando…'); try { c.layer = await c.montar(); } catch (e) { console.error(e); } setSt(id, c.stFixo || ''); } if (c.layer && c.on) c.layer.addTo(mapa); }
  else if (c.layer) mapa.removeLayer(c.layer);
  c.aoLigar && c.aoLigar(on);
  contarGrupos();
}
async function redesenhar(id) {
  const c = CAM[id]; if (!c) return;
  if (c.layer) mapa.removeLayer(c.layer);
  c.layer = null;
  if (c.on) { try { c.layer = await c.montar(); } catch (e) { console.error(e); } if (c.layer && c.on) c.layer.addTo(mapa); }
}
function definirOp(id, op) {
  const c = CAM[id]; c.op = op; const L_ = c.layer; if (!L_) return;
  if (c.estilo && L_.setStyle) L_.setStyle(c.estilo);
  else if (L_.eachLayer) L_.eachLayer(l => { if (l.setOpacity) l.setOpacity(op); else if (l.setStyle) l.setStyle({opacity: op, fillOpacity: op}); });
}

// ------------------------------------------------------------------ camadas de referência
defCam('mun', {grupo: 'ref', nome: 'Limites municipais', on: true, op: .75,
  estilo: () => ({pane: 'lim', fill: false, color: '#2b3328', weight: .8, opacity: OPC('mun')}),
  montar: async () => L.geoJSON(dadosMun, {pane: 'lim', interactive: false, style: CAM.mun.estilo})});
defCam('uf', {grupo: 'ref', nome: 'Limite estadual', on: true,
  estilo: () => ({pane: 'lim', fill: false, color: '#1f2a1d', weight: 2, opacity: OPC('uf')}),
  montar: async () => { const d = await pegar('dados/limite_ms.geojson'); return d ? L.geoJSON(d, {pane: 'lim', interactive: false, style: CAM.uf.estilo}) : null; }});
defCam('rot', {grupo: 'ref', nome: 'Nomes dos municípios',
  montar: async () => L.layerGroup(dadosMun.features.map(f => L.marker(L.geoJSON(f).getBounds().getCenter(), {interactive: false, opacity: OPC('rot'),
    icon: L.divIcon({className: 'rot', html: esc(f.properties.NM_MUN), iconSize: [120, 14], iconAnchor: [60, 7]})})))});
function estiloRod(id, f) {
  const p = f.properties, fed = id === 'rodfed', cobe = norm(p.cobe);
  return {pane: 'rod', color: fed ? '#b5452f' : '#d9822b', weight: fed ? 2.8 : 1.7, opacity: OPC(id),
    dashArray: cobe.includes('terra') ? '5 4' : cobe.includes('pavimentacao') && cobe.startsWith('em') ? '1 5' : null, lineCap: 'round'};
}
function camRodovia(id, arq, nome) {
  defCam(id, {grupo: 'ref', nome, estilo: f => estiloRod(id, f),
    montar: async () => { const d = await pegar(`dados/${arq}.geojson`); if (!d) return null;
      return L.geoJSON(d, {style: CAM[id].estilo, onEachFeature: (f, l) => { const p = f.properties;
        l.bindTooltip(`<b>${esc(p.nome)}</b><br>${esc(p.jurd || '')} · ${esc(p.cobe || '')}${p.extensa_km ? ' · ' + n0(p.extensa_km) + ' km' : ''}`, {sticky: true}); }}); },
    sub: () => `<div class="leg"><div><i class="linha" style="border-color:${id === 'rodfed' ? '#b5452f' : '#d9822b'}"></i>Pavimentada</div><div><i class="linha" style="border-color:${id === 'rodfed' ? '#b5452f' : '#d9822b'};border-top-style:dashed"></i>Terra</div><div><i class="linha" style="border-color:${id === 'rodfed' ? '#b5452f' : '#d9822b'};border-top-style:dotted"></i>Em pavimentação</div></div>`});
}

// ------------------------------------------------------------------ solos
const CORES_ORDEM = {"Latossolo": "#b5452f", "Argissolo": "#d98a3d", "Neossolo": "#e8d28a", "Planossolo": "#8fa3b8", "Gleissolo": "#5f87a8", "Nitossolo": "#7a2f2a",
  "Vertissolo": "#6e6a4f", "Plintossolo": "#c9a36b", "Espodossolo": "#d9d4c7", "Luvissolo": "#9c6b4a", "Chernossolo": "#4a3b30", "Organossolo": "#2f2a25", "Cambissolo": "#b39a5e", "Corpo d'água": "#a9cbe0", "Outros": "#bdbdbd"};
const CORES_TEX = {"Argilosa / muito argilosa": "#7b3f24", "Média": "#c98a4b", "Arenosa": "#ecd9a2", "Siltosa": "#9c9a7a", "Indiscriminada": "#a8a29a", "Sem informação": "#d6dde2"};
// capacidade de água disponível aproximada para 60 cm de raízes (mm), por textura — valores típicos, indicativos
const CAD_TEX = {"Arenosa": 40, "Média": 65, "Argilosa / muito argilosa": 90, "Siltosa": 75, "Indiscriminada": 60, "Sem informação": 60};
defCam('solo', {grupo: 'solo', nome: 'Solos (IBGE/Embrapa 1:5.000.000)', op: .7,
  estilo: f => ({pane: 'solo', fillColor: (modoSolo === 'ordem' ? CORES_ORDEM : CORES_TEX)[f.properties[modoSolo]] || '#bdbdbd', fillOpacity: OPC('solo'), color: 'rgba(60,50,40,.35)', weight: .5}),
  montar: async () => dadosSolo ? L.geoJSON(dadosSolo, {style: CAM.solo.estilo, onEachFeature: (f, l) => { const p = f.properties;
    l.bindTooltip(`<b>${esc(p.classe || p.ordem)}</b><br>Textura: ${esc(p.textura_orig || '—')}`, {sticky: true}); }}) : null,
  sub: () => {
    if (!dadosSolo) return '';
    const cont = {}; dadosSolo.features.forEach(f => { const k = f.properties[modoSolo]; cont[k] = (cont[k] || 0) + turf.area(f); });
    const cores = modoSolo === 'ordem' ? CORES_ORDEM : CORES_TEX;
    return `<div class="seg" id="modo-solo"><button data-m="ordem" class="${modoSolo === 'ordem' ? 'on' : ''}">Classe</button><button data-m="textura" class="${modoSolo === 'textura' ? 'on' : ''}">Textura</button></div>
      <div class="leg">${Object.entries(cont).sort((a, b) => b[1] - a[1]).map(([k]) => `<div><i style="background:${cores[k] || '#bdbdbd'}"></i>${esc(k)}</div>`).join('')}</div>
      <div class="nota">Escala regional: não representa variações dentro do município nem no talhão.</div>`;
  },
  depois: () => document.querySelectorAll('#modo-solo button').forEach(b => b.onclick = () => { modoSolo = b.dataset.m; CAM.solo.layer && CAM.solo.layer.setStyle(CAM.solo.estilo); atualizarSub('solo'); })});
// solos ocupados por cada cultura mapeada (gerado pela rotina: dados/solo_cultura.json)
let SOLO_CULT = null;
const cadDe = tex => Object.entries(tex).reduce((t, [k, p]) => t + (CAD_TEX[k] ?? 60) * p / 100, 0) || 60;
function soloCultura(cid, cd) {
  if (!SOLO_CULT || !cid) return null;
  const nome = Object.keys(SOLO_CULT.culturas).find(n => culturaDe(n)?.id === cid);   // só o mapa da própria cultura (milho 2ª safra não vale para o de verão)
  if (!nome) return null;
  const r = cd ? SOLO_CULT.culturas[nome].mun[cd] : SOLO_CULT.culturas[nome].estado; if (!r || !r.area) return null;
  const pct = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, 100 * v / r.area]));
  const textura = pct(r.textura);
  return {nome, area: r.area, ordem: pct(r.ordem), textura, cad: cadDe(textura)};
}
function soloCulturaAlvo(cid) {   // solos da cultura no estado ou somados nos municípios da região
  if (!CDS_ALVO) return soloCultura(cid, null);
  if (!SOLO_CULT || !cid) return null; const nome = Object.keys(SOLO_CULT.culturas).find(n => culturaDe(n)?.id === cid); if (!nome) return null;
  const r = {area: 0, textura: {}, ordem: {}};
  for (const cd of CDS_ALVO) { const x = SOLO_CULT.culturas[nome].mun[cd]; if (!x) continue; r.area += x.area; for (const k of ['textura', 'ordem']) for (const [a, v] of Object.entries(x[k])) r[k][a] = (r[k][a] || 0) + v; }
  if (!r.area) return null; const pct = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, 100 * v / r.area])); const textura = pct(r.textura);
  return {nome, area: r.area, ordem: pct(r.ordem), textura, cad: cadDe(textura)};
}
const naRegiao = r => !CDS_ALVO || CDS_ALVO.some(cd => r.muns.has(cd));
const fotoNaRegiao = f => !CDS_ALVO || (f.mun && CDS_ALVO.includes(String(+f.mun.properties.CD_MUN)));
function htmlSoloCultura(cd) {
  if (!SOLO_CULT) return '';
  const tb = (o, cores) => Object.entries(o).filter(([, v]) => v >= .5).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td><i style="background:${cores[k] || '#bdbdbd'}"></i>${esc(k)}</td><td>${v.toFixed(0)}%</td></tr>`).join('');
  const blocos = Object.keys(SOLO_CULT.culturas).map(n => { const c = culturaDe(n); const r = soloCultura(c?.id, cd); if (!r) return '';
    return `<div class="nota" style="margin-top:8px;color:var(--tinta)"><b>${esc(n)}</b> · ${n0(r.area)} ha mapeados</div><div class="subt">Textura do solo</div><table>${tb(r.textura, CORES_TEX)}</table><div class="subt">Classe de solo</div><table>${tb(r.ordem, CORES_ORDEM)}</table>`; }).join('');
  return blocos ? `<h3>Solos ocupados pelas culturas mapeadas</h3>${blocos}<div class="nota">Cruzamento dos mapas de uso da Aprosoja-MS com o mapa de solos 1:5.000.000 (% da área de cada cultura).</div>` : '';
}
function soloDoMunicipio(f) {
  const cd = String(+f.properties.CD_MUN); if (SOLO_MUN[cd]) return SOLO_MUN[cd];
  if (!dadosSolo) return null;
  const r = {ordem: {}, textura: {}, total: 0};
  dadosSolo.features.forEach(s => {
    if (!turf.booleanIntersects(s, f)) return;
    let i = null; try { i = turf.intersect(s, f); } catch (e) {}
    if (!i) return; const a = turf.area(i) / 1e4;
    r.ordem[s.properties.ordem] = (r.ordem[s.properties.ordem] || 0) + a; r.textura[s.properties.textura] = (r.textura[s.properties.textura] || 0) + a; r.total += a;
  });
  ['ordem', 'textura'].forEach(k => { for (const x in r[k]) r[k][x] = 100 * r[k][x] / (r.total || 1); });
  r.cad = Object.entries(r.textura).reduce((t, [k, p]) => t + (CAD_TEX[k] ?? 60) * p / 100, 0) || 60;
  return SOLO_MUN[cd] = r;
}

// ------------------------------------------------------------------ uso e cobertura (camadas publicadas pela rotina)
const CORES_USO = {"Soja": "#e0a526", "Cana-de-açúcar": "#3f9a5a", "Milho": "#d4694a", "Pastagem": "#c9d99a", "Remanescente/vegetação": "#2f5d3a", "Eucalipto": "#6d8fbf", "Pinus": "#a37fbf", "Seringueira": "#8a6f4e", "Outros usos": "#bdbdbd", "Milho 2ª safra": "#c98b14", "Sorgo": "#a83a2a", "Algodão": "#7d8fa3", "Milheto": "#b9a183",
  "Milho 1ª safra": "#e0a526", "Vegetação remanescente": "#2f5d3a", "Arroz irrigado": "#4f86b8"};
const PALETA = ["#e3b23c", "#4f8a3c", "#9ccf7f", "#d4694a", "#6d8fbf", "#a37fbf", "#c4c4a0", "#3f6f6a"];
// nome legível da camada de uso: classes do manifesto + safra tirada do nome do arquivo
// ex.: uso_soja_2025-26 -> "Soja 2025/26"; uso_milho_2a_safra_2025 -> "Milho 2ª safra 2025"; uso_sorgo_2a_safra_2025 -> "Sorgo 2ª safra 2025"
function rotuloUso(nome) {
  const cls = MAN?.classes?.[nome], base = nome.replace(/^uso_/, '');
  let txt = cls?.length ? cls.join(', ') : base.replace(/_?(\d{4}[-_]\d{2,4}|2a_safra_\d{4}|\d{4})$/, '').replace(/_/g, ' ');
  txt = txt.charAt(0).toUpperCase() + txt.slice(1);
  const s2 = base.match(/2a_safra_(\d{4})/), s1 = base.match(/(\d{4})[-_](\d{2,4})$/), ano = base.match(/(\d{4})$/);
  if (s2) return /2ª safra/i.test(txt) ? `${txt} ${s2[1]}` : `${txt} 2ª safra ${s2[1]}`;
  if (s1) return `${txt} ${s1[1]}/${s1[2].slice(-2)}`;
  return ano ? `${txt} ${ano[1]}` : txt;
}
function camUso(nome, grupo = 'uso') {
  const id = 'u_' + nome, rot = rotuloUso(nome);
  let classes = null;
  const cor = c => CORES_USO[c] || PALETA[(classes || []).indexOf(c) % PALETA.length];
  defCam(id, {grupo, nome: rot, op: .85,
    estilo: f => ({pane: 'uso', fillColor: cor(f.properties.classe || ''), fillOpacity: OPC(id), weight: 0}),
    montar: async () => { const d = await pegar(`dados/${nome}.geojson`); if (!d) return null;
      USO_GEO[nome] = d; classes = [...new Set(d.features.map(f => f.properties.classe))];
      const area = {}; d.features.forEach(f => area[f.properties.classe] = (area[f.properties.classe] || 0) + (f.properties.area_ha || 0));
      CAM[id].legenda = classes.map(c => `<div><i style="background:${cor(c)}"></i>${esc(c)}${area[c] ? ' · ' + (area[c] >= 1e5 ? (area[c] / 1e6).toLocaleString('pt-BR', {maximumFractionDigits: 2}) + ' mi ha' : n0(area[c]) + ' ha') : ''}</div>`).join('');
      atualizarSub(id);
      return L.geoJSON(d, {style: CAM[id].estilo, interactive: false}); },
    sub: () => `<div class="leg">${CAM[id].legenda || ''}</div>${solosNaCamada(classes)}<div class="nota">Fonte: ${esc(fonteUso(nome))}.</div>`});
}
function fonteUso(nome) { if (/arroz/i.test(nome)) return 'mapeamento de arroz irrigado da Conab (SEGEO-MS), safra 2023/24, por interpretação de imagens Sentinel-2 e levantamentos de campo';
  if (/soja_2024/i.test(nome)) return 'mapeamento de soja da Conab e do Inpe, safra 2024/25 (Sentinel-2, classificação híbrida, escala 1:100.000)';
  return /soja|cana|milho|sorgo|algod|pastagem|vegetacao|remanescente|eucalipto|outros_usos|seringueira|pinus|ms2\d/i.test(nome) ? `mapeamento de uso e cobertura da Aprosoja-MS${/2a_safra/i.test(nome) ? ' (2ª safra)' : ''}` : 'mapeamento de uso e cobertura enviado à SEGEO-MS'; }
// geometrias de uso já baixadas (uma feição por classe e município) e busca do mapa de uma cultura
const USO_GEO = {};
function arquivoUso(cid) {   // nome da camada uso_* que tem a cultura (o mais recente pelo nome)
  return (MAN?.camadas || []).filter(n => n.startsWith('uso_')).sort().reverse().find(n => (MAN.classes?.[n] || [n.replace(/^uso_/, '').replace(/_/g, ' ')]).some(cl => culturaDe(cl)?.id === cid)) || null;
}
async function usoDaCultura(cid) {
  const n = arquivoUso(cid); if (!n) return null;
  USO_GEO[n] = USO_GEO[n] || await pegar(`dados/${n}.geojson`); const d = USO_GEO[n]; if (!d) return null;
  const fs = d.features.filter(f => culturaDe(f.properties.classe || '')?.id === cid);
  return fs.length ? {nome: n, fc: {type: 'FeatureCollection', features: fs}} : null;
}
function barraSolo(o, cores) {
  const it = Object.entries(o).filter(([, v]) => v >= .5).sort((a, b) => b[1] - a[1]);
  return `<div class="barra" style="height:12px">${it.map(([k, v]) => `<i title="${esc(k)}: ${v.toFixed(0)}%" style="width:${v}%;background:${cores[k] || '#bdbdbd'}"></i>`).join('')}</div>
    <div class="leg" style="display:flex;flex-wrap:wrap;gap:0 10px">${it.filter(([, v]) => v >= 1).map(([k, v]) => `<div><i style="background:${cores[k] || '#bdbdbd'}"></i>${esc(k)} ${v.toFixed(0)}%</div>`).join('')}</div>`;
}
// solos ocupados por uma classe de uso (cultura ou outra ocupação), pelo nome da classe no solo_cultura.json
function soloClasse(cl, cd) {
  const o = SOLO_CULT?.culturas[cl]; if (!o) return null;
  const r = cd ? o.mun[cd] : o.estado; if (!r || !r.area) return null;
  const pct = x => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, 100 * v / r.area]));
  return {nome: cl, area: r.area, ordem: pct(r.ordem), textura: pct(r.textura)};
}
function solosNaCamada(classes) {
  if (!SOLO_CULT || !classes) return '';
  return classes.map(cl => { const r = soloClasse(cl, null); if (!r) return '';
    const cd = selecionado && selecionado !== ESTADO && selecionado !== REGIAO ? String(+selecionado.properties.CD_MUN) : null, rm = cd ? soloClasse(cl, cd) : null;
    return `<div style="margin-top:8px;font-size:12px"><b>Solos sob ${esc(cl.toLowerCase())}</b> · MS, ${n0(r.area)} ha</div>
      <div class="nota" style="margin:2px 0 0">Textura do solo</div>${barraSolo(r.textura, CORES_TEX)}<div class="nota" style="margin:2px 0 0">Classe de solo</div>${barraSolo(r.ordem, CORES_ORDEM)}
      ${rm ? `<div style="margin-top:6px;font-size:12px"><b>${esc(selecionado.properties.NM_MUN)}</b> · ${n0(rm.area)} ha</div><div class="nota" style="margin:2px 0 0">Textura do solo</div>${barraSolo(rm.textura, CORES_TEX)}<div class="nota" style="margin:2px 0 0">Classe de solo</div>${barraSolo(rm.ordem, CORES_ORDEM)}` : `<div class="nota">Selecione um município para ver os solos sob ${esc(cl.toLowerCase())} nele.</div>`}`; }).join('');
}

// =====================================================================
// PLANTIO E FENOLOGIA (planilhas da pasta da equipe)
// =====================================================================
function rotuloSafra(nomeArq, culturas) {
  const m = nomeArq.match(/(20\d{2})\s*[-_/]\s*(\d{2,4})/);
  if (m) return `${m[1]}/${m[2].slice(-2)}`;
  const ini = Object.values(culturas).map(c => c.inicio).filter(Boolean).sort((a, b) => a - b)[0];
  if (!ini) return 'safra';
  const y = ini.getMonth() >= 6 ? ini.getFullYear() : ini.getFullYear() - 1;
  return `${y}/${String(y + 1).slice(-2)}`;
}
function lerPlanilha(buf) {
  const wb = XLSX.read(buf, {type: 'array', cellDates: true});
  const par = wb.Sheets['Parâmetros']; if (!par) throw new Error('aba “Parâmetros” não encontrada');
  const rows = XLSX.utils.sheet_to_json(par, {header: 1, raw: true, defval: null});
  const C = {};
  for (let r = 3; r < rows.length; r++) {
    const x = rows[r] || [];
    if (x[0] && x[2] != null && typeof x[3] === 'number') (C[x[0]] ??= {estadios: []}).estadios.push({nome: String(x[2]), dias: x[3], critico: norm(x[4]) === 'sim', obs: x[5] || ''});
    if (x[8] && x[9] != null) { const d = x[9] instanceof Date ? x[9] : new Date(Math.round((x[9] - 25569) * 864e5)); d.setHours(12, 0, 0, 0); (C[x[8]] ??= {estadios: []}).inicio = d;
      const nums = [x[11], x[12], x[13], x[14]]; if (nums.slice(0, 3).every(v => typeof v === 'number')) C[x[8]].kcPlan = {ini: x[11], mid: x[12], fim: x[13], p: typeof x[14] === 'number' ? x[14] : undefined}; }
  }
  for (const nome in C) {
    const ws = wb.Sheets[nome]; C[nome].mun = {}; C[nome].nome = nome; C[nome].cid = (culturaDe(nome) || OUTRA).id;
    C[nome].estadios.sort((p, q) => p.dias - q.dias);
    if (!ws) continue;
    const a = XLSX.utils.sheet_to_json(ws, {header: 1, raw: true, defval: null});
    for (let r = 5; r < a.length; r++) {
      const x = a[r]; if (!x || x[0] == null || isNaN(+x[0])) continue;
      const serie = x.slice(4, 26).map(v => typeof v === 'number' ? Math.min(100, Math.max(0, v)) : null);
      if (serie.every(v => v == null)) continue;
      C[nome].mun[String(+x[0])] = {area: typeof x[3] === 'number' ? x[3] : null, serie};
    }
  }
  return C;
}
// projeção: deslocamento em semanas a partir da semeadura, valor acumulado repetido quando a semana está vazia
function acum(serie, k) { if (k < 1) return 0; let v = null; for (let i = 0; i < Math.min(k, serie.length); i++) if (serie[i] != null) v = serie[i]; return v ?? 0; }
function distrib(c, m, j) { const E = c.estadios; return E.map((e, s) => { const a = acum(m.serie, j - Math.round(e.dias / 7)); const b = s < E.length - 1 ? acum(m.serie, j - Math.round(E[s + 1].dias / 7)) : 0; return Math.max(0, a - b); }); }
const pctCritico = (c, m, j) => distrib(c, m, j).reduce((t, v, i) => t + (c.estadios[i].critico ? v : 0), 0);
const semanaDe = (c, d) => Math.floor((d - c.inicio) / (7 * 864e5)) + 1;
const dataSem = (c, j) => addD(c.inicio, 7 * (j - 1));
// Cana-de-açúcar: sem acompanhamento fenológico na planilha. Entra como "cultura sem fenologia", com a área do
// mapeamento da Aprosoja-MS por município (solo_cultura.json), Kc médio anual e raízes mais profundas.
const CANA_SEL = '__cana', KC_CANA = 1.0, P_CANA = .65, PROF_CANA = 120;
let CANA = null;
function montarCana() {
  if (!SOLO_CULT) return null;
  const n = Object.keys(SOLO_CULT.culturas).find(x => culturaDe(x)?.id === 'cana'); if (!n) return null;
  const mun = {}; for (const [cd, r] of Object.entries(SOLO_CULT.culturas[n].mun)) if (r.area >= 1) mun[cd] = {area: r.area};
  return CANA = {cid: 'cana', nome: 'Cana-de-açúcar', semFenologia: true, mun, estadios: [], arquivos: SOLO_CULT.culturas[n].arquivos || []};
}
const profRaiz = c => c?.cid === 'cana' ? PROF_CANA : 60;
const cultAtual = () => cultSel === CANA_SEL ? CANA : PL && safraSel && PL[safraSel] ? PL[safraSel][cultSel] : null;
function mediaMS(c, fn) {   // média ponderada pela área (municípios com área informada); sem área: média simples
  let sa = 0, sv = 0, n = 0, ss = 0;
  for (const m of Object.values(c.mun)) { const v = fn(m); if (v == null) continue; n++; ss += v; if (m.area) { sa += m.area; sv += v * m.area; } }
  return sa ? {v: sv / sa, pond: true, n, area: sa} : n ? {v: ss / n, pond: false, n, area: 0} : null;
}
// Kc da FAO-56 (Allen et al., 1998; Boletim 56, tabela 12) e fração de esgotamento p (tabela 22), por cultura.
// A planilha pode sobrescrever: aba Parâmetros, colunas L–O da tabela de datas (Kc inicial, Kc médio, Kc final, p).
const KC_FAO = {soja: [.40, 1.15, .50, .50], milho1: [.30, 1.20, .60, .55], milho2: [.30, 1.20, .60, .55], sorgo: [.30, 1.05, .55, .55],
  amendoim: [.40, 1.15, .60, .50], arroz: [1.05, 1.20, .75, .20], feijao1: [.40, 1.15, .35, .45], feijao2: [.40, 1.15, .35, .45],
  algodao: [.35, 1.18, .60, .65], trigo: [.30, 1.15, .30, .55], aveia: [.30, 1.15, .25, .55], cana: [.40, 1.25, .75, .65]};
const KC_PALHADA = .30;   // área colhida ou não semeada (solo com palhada)
function paramsKc(c) { if (c.semFenologia) return {ini: KC_CANA, mid: KC_CANA, fim: KC_CANA, p: P_CANA, fonte: 'média anual'};
  const t = KC_FAO[c.cid] || [.4, 1.1, .5, .5]; const o = c.kcPlan || {};
  return {ini: o.ini ?? t[0], mid: o.mid ?? t[1], fim: o.fim ?? t[2], p: o.p ?? t[3], fonte: c.kcPlan ? 'planilha' : 'FAO-56'}; }
// curva de Kc por dias após a semeadura, ancorada nos estádios da planilha:
// inicial até o 2º estádio; sobe até o 1º estádio crítico; médio até o fim das fases críticas; desce até a colheita.
function kcCurva(c, das) {
  const E = c.estadios, k = paramsKc(c); if (das < 0) return null;
  const ic = E.findIndex(e => e.critico), lc = E.map(e => e.critico).lastIndexOf(true);
  const D1 = E[1]?.dias ?? 10, Dc = ic >= 0 ? E[ic].dias : (E[Math.floor(E.length / 2)]?.dias ?? 50);
  const Dpc = lc >= 0 && E[lc + 1] ? E[lc + 1].dias : Dc + 30, Dh = E.at(-1).dias;
  if (das < D1) return k.ini;
  if (das < Dc) return k.ini + (k.mid - k.ini) * (das - D1) / Math.max(1, Dc - D1);
  if (das < Dpc) return k.mid;
  if (das < Dh) return k.mid + (k.fim - k.mid) * (das - Dpc) / Math.max(1, Dh - Dpc);
  return KC_PALHADA;
}
// Kc médio da área semeada numa data: cada semana de semeadura é uma coorte com sua idade
function kcInfo(c, m, data) {   // kc médio da área semeada e % dessa área ainda em campo (não colhida)
  if (c.semFenologia) return {kc: KC_CANA, campo: 100};   // canavial: presente o ano todo, idades misturadas
  let soma = 0, peso = 0, ant = 0, campo = 0; const Dh = c.estadios.at(-1).dias;
  for (let w = 1; w <= m.serie.length; w++) {
    const ac = acum(m.serie, w), inc = ac - ant; ant = ac; if (inc <= 0) continue;
    const das = (data - addD(dataSem(c, w), -3.5)) / 864e5; if (das < 0) continue;
    soma += inc * kcCurva(c, das); peso += inc; if (das < Dh) campo += inc;
  }
  return peso >= 1 ? {kc: soma / peso, campo} : null;
}
function kcArea(c, m, data) { return kcInfo(c, m, data)?.kc ?? null; }
function corEstadio(c, i) {
  const E = c?.estadios; if (!E || i == null || i < 0) return null;
  const crit = E.map((e, k) => e.critico ? k : -1).filter(k => k >= 0), a = crit.length ? crit[0] : E.length, b = crit.length ? crit.at(-1) : E.length;
  const pick = (p, k, n) => p[Math.round(k * (p.length - 1) / Math.max(1, n - 1))];
  if (E[i].critico) return pick(['#f2c14e', '#e8834f', '#c4472b', '#8f2d1f'], crit.indexOf(i), crit.length);
  if (i < a) return pick(['#dcebc4', '#9cc97a', '#4f9a3c'], i, a);
  return pick(['#b9a183', '#866b52', '#4d3f33'], i - b - 1, E.length - b - 1);
}
const ESC_PL = ['#fbf3dc', '#f2d38a', '#e0a526', '#b8741a', '#7a3b12'], ESC_CR = ['#fdf0e6', '#f6c39b', '#e8834f', '#c4472b', '#7f1d1d'];
function corSeq(v, esc_) {
  if (v == null || isNaN(v)) return null; const t = Math.min(1, Math.max(0, v / 100)) * (esc_.length - 1), i = Math.floor(t);
  if (i >= esc_.length - 1) return esc_.at(-1);
  const h = x => [1, 3, 5].map(k => parseInt(x.slice(k, k + 2), 16)), a = h(esc_[i]), b = h(esc_[i + 1]), f = t - i;
  return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * f)).join(',')})`;
}
let visPl = 'plantio';
function valorPl(c, m, j) {
  if (visPl === 'plantio') return acum(m.serie, j);
  if (visPl === 'critico') return pctCritico(c, m, j);
  let im = -1, vm = 0; distrib(c, m, j).forEach((v, i) => { if (v > vm) { vm = v; im = i; } }); return im;
}
defCam('plantio', {grupo: 'lav', nome: 'Evolução da safra (planilha)', op: .85, desab: true, st: 'conecte a pasta',
  estilo: f => { const c = cultAtual(), m = c && c.mun[String(+f.properties.CD_MUN)]; if (!m || c.semFenologia) return {pane: 'plantio', fill: false, stroke: false};
    const v = valorPl(c, m, semSel), k = visPl === 'estadio' ? corEstadio(c, v) : corSeq(v, visPl === 'critico' ? ESC_CR : ESC_PL);
    return k ? {pane: 'plantio', fill: true, fillColor: k, fillOpacity: OPC('plantio'), weight: 0, stroke: false} : {pane: 'plantio', fill: false, stroke: false}; },
  montar: async () => cultAtual() ? L.geoJSON(dadosMun, {interactive: false, style: CAM.plantio.estilo}) : null,
  sub: () => {
    const c = cultAtual(); if (!c || c.semFenologia) return '';
    let res = '';
    if (visPl === 'estadio') {
      const dist = new Array(c.estadios.length).fill(0); let sa = 0;
      for (const m of Object.values(c.mun)) { const w = m.area || 1; sa += w; distrib(c, m, semSel).forEach((v, i) => dist[i] += v * w); }
      res = `Área por estádio (MS):<div class="barra">${dist.map((v, i) => `<i title="${esc(c.estadios[i].nome)}: ${(v / sa).toFixed(0)}%" style="width:${v / sa}%;background:${corEstadio(c, i)}"></i>`).join('')}</div>`;
    } else {
      const r = mediaMS(c, m => visPl === 'plantio' ? acum(m.serie, semSel) : pctCritico(c, m, semSel));
      res = r ? `MS: <b>${r.v.toFixed(0)}%</b> ${visPl === 'plantio' ? 'plantado' : 'em fase crítica'} · ${r.n} municípios${r.pond ? '' : ' (média simples: preencha a área)'}` : '';
    }
    const esc_ = visPl === 'critico' ? ESC_CR : ESC_PL;
    const leg = visPl === 'estadio' ? c.estadios.map((e, i) => `<div><i style="background:${corEstadio(c, i)}"></i>${esc(e.nome)}${e.critico ? ' ⚠' : ''}</div>`).join('')
      : [0, 25, 50, 75, 100].map(v => `<div><i style="background:${corSeq(v, esc_)}"></i>${v}%</div>`).join('');
    return `<div class="seg" id="modo-pl"><button data-v="plantio" class="${visPl === 'plantio' ? 'on' : ''}">% plantado</button><button data-v="critico" class="${visPl === 'critico' ? 'on' : ''}">Fase crítica</button><button data-v="estadio" class="${visPl === 'estadio' ? 'on' : ''}">Estádio</button></div>
      <div class="resumo">${res}</div><div class="leg">${leg}</div><div class="nota">${visPl === 'critico' ? 'Soma dos estádios marcados como críticos (⚠) na aba Parâmetros.' : visPl === 'estadio' ? 'Estádio predominante na área semeada.' : 'Percentual acumulado da área plantada.'} Cultura e semana: seção “Safra e cultura”.</div>`;
  },
  depois: () => document.querySelectorAll('#modo-pl button').forEach(b => b.onclick = () => { visPl = b.dataset.v; CAM.plantio.layer && CAM.plantio.layer.setStyle(CAM.plantio.estilo); atualizarSub('plantio'); })});

function montarControlesCult() {
  const safras = PL ? Object.keys(PL).sort().reverse() : [];
  safraSel = safras.includes(safraSel) ? safraSel : (safras[0] || null);
  $('sel-safra').innerHTML = safras.map(s => `<option>${s}</option>`).join('');
  if (safraSel) $('sel-safra').value = safraSel;
  preencherCulturas();
  $('bloco-cult').hidden = !PL && !CANA;
}
function preencherCulturas() {
  const P = PL && safraSel ? PL[safraSel] : {}, nomes = Object.keys(P), com = nomes.filter(n => Object.keys(P[n].mun).length);
  if (cultSel !== CANA_SEL || !CANA) cultSel = com.includes(cultSel) ? cultSel : (com[0] || null);
  $('sel-cult').innerHTML = (cultSel ? '' : '<option value="">Escolha a cultura…</option>')
    + (PL ? nomes.map(n => `<option value="${esc(n)}" ${com.includes(n) ? '' : 'disabled'}>${esc(n)}${com.includes(n) ? '' : ' (sem dados)'}</option>`).join('') : '<option value="" disabled>Culturas anuais: conecte a pasta</option>')
    + (CANA ? `<option value="${CANA_SEL}">Cana-de-açúcar (sem fenologia)</option>` : '');
  $('sel-cult').value = cultSel || '';
  semSel = semanaPadrao();
  aoMudarCultura();
}
function semanaPadrao() { const c = cultAtual(); return c?.inicio ? Math.min(48, Math.max(1, semanaDe(c, HOJE))) : 1; }
function aoMudarCultura() {
  const c = cultAtual(), comFen = c && !c.semFenologia;
  $('bloco-cult').querySelector('.sem').hidden = !comFen;
  $('sel-safra').style.display = PL && Object.keys(PL).length > 1 && cultSel !== CANA_SEL ? '' : 'none';
  $('nota-cult').innerHTML = !c ? 'A cultura escolhida filtra o mapa de água no solo, as fotos, os relatos e as análises.'
    : c.semFenologia ? `Cana-de-açúcar: sem acompanhamento fenológico. O painel usa a área mapeada pela Aprosoja-MS (${n0(Object.values(c.mun).reduce((t, m) => t + m.area, 0))} ha), os solos sob a cultura, o clima e o balanço hídrico com Kc médio.` : 'Filtra o mapa, as fotos, os relatos e as análises.';
  if (comFen) { $('sl-sem').value = semSel; const d = dataSem(c, semSel); $('lb-sem').textContent = fmtD(d) + (d > HOJE ? ' · proj.' : ''); }
  habilitar('plantio', !!comFen); setSt('plantio', comFen ? '' : c ? 'sem fenologia' : (PL ? 'escolha a cultura' : 'conecte a pasta'));
  if (!comFen && CAM.plantio.on) { $('cb-plantio').checked = false; ligar('plantio', false); }
  if (CAM.plantio.layer) CAM.plantio.layer.setStyle(CAM.plantio.estilo); else if (CAM.plantio.on) redesenhar('plantio');
  atualizarSub('plantio');
  atualizarAgua();
  if (CAM.fotos.seguir) redesenhar('fotos'), atualizarSub('fotos');
  if (selecionado) abrirFicha(selecionado, true);
}
$('sel-safra').onchange = e => { safraSel = e.target.value; preencherCulturas(); };
$('sel-cult').onchange = e => { const c0 = cultAtual(), d = c0 && !c0.semFenologia ? dataSem(c0, semSel) : HOJE; cultSel = e.target.value || null; const c = cultAtual();
  if (c && !c.semFenologia) semSel = Math.min(48, Math.max(1, semanaDe(c, d)));
  if ($('sel-cult').options[0]?.value === '' && cultSel) $('sel-cult').options[0].remove();
  aoMudarCultura(); };
$('sl-sem').oninput = e => { semSel = +e.target.value; aoMudarCultura(); };

// =====================================================================
// CLIMA (modelo por município e estações INMET)
// =====================================================================
const iHoje = () => CL ? CL.datas.indexOf(CL.hoje) : -1;
function janela(per) { const h = iHoje(); if (h < 0) return [0, 0]; return {f7: [h, h + 7], f15: [h, Math.min(CL.datas.length, h + 15)], p7: [h - 7, h], p30: [h - 30, h]}[per]; }
function calcClima(m, per, v) {
  const [a, b] = janela(per), sl = k => (m[k] || []).slice(a, b).filter(x => x != null);
  if (v === 'p') return sl('p').reduce((t, x) => t + x, 0);
  if (v === 'bh') return sl('p').reduce((t, x) => t + x, 0) - sl('et0').reduce((t, x) => t + x, 0);
  if (v === 'tx') { const x = sl('tx'); return x.length ? Math.max(...x) : null; }
  if (v === 'tn') { const x = sl('tn'); return x.length ? Math.min(...x) : null; }
  if (v === 'v') { const x = sl('v'); return x.length ? Math.max(...x) : null; }
  if (v === 'amp') { const x = sl('tx'), n = sl('tn'); return x.length ? x.reduce((t, q, i) => t + q - (n[i] ?? q), 0) / x.length : null; }
  if (v === 'seco') return diasSecos(m);
  if (v === 'div') return per.startsWith('f') ? concordancia(totaisModelos(m, a, b))?.amp ?? null : null;
}
function diasSecos(m) { let n = 0; for (let i = iHoje() - 1; i >= 0; i--) { if ((m.p[i] ?? 0) >= 1) break; n++; } return n; }
const ESC_CL = {p: {c: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b'], min: 0, max: {f7: 80, f15: 150, p7: 80, p30: 200}, u: 'mm'},
  bh: {c: ['#8c510a', '#d8b365', '#f5f5f5', '#5ab4ac', '#01665e'], min: -60, max: 60, u: 'mm'},
  tx: {c: ['#fff5d6', '#fdd28a', '#f59a4a', '#d9472b', '#8f1d1d'], min: 28, max: 40, u: '°C'},
  tn: {c: ['#3b4cc0', '#7b9ff9', '#c0d4f5', '#f2f2f2', '#f4c6a6'], min: 0, max: 20, u: '°C'},
  amp: {c: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#6a51a3', '#3f007d'], min: 6, max: 18, u: '°C'},
  v: {c: ['#f7fcf5', '#c7e9c0', '#74c476', '#238b45', '#00441b'], min: 10, max: 50, u: 'km/h'},
  seco: {c: ['#ffffe5', '#fee391', '#fe9929', '#cc4c02', '#662506'], min: 0, max: 30, u: 'dias'},
  div: {c: ['#f7f4f9', '#d4b9da', '#c994c7', '#df65b0', '#980043'], min: 0, max: {f7: 60, f15: 100, p7: 60, p30: 100}, u: 'mm'}};
let clPer = 'f7', clVar = 'p';
const maxEsc = e => typeof e.max === 'object' ? e.max[clPer] : e.max;
async function garantirClima() { CL = CL || await pegar('dados/clima/modelo_municipios.json'); return CL; }
defCam('clima', {grupo: 'clima', nome: 'Clima por município', op: .8,
  estilo: f => { const m = CL?.mun[String(+f.properties.CD_MUN)], e = ESC_CL[clVar]; const v = m ? calcClima(m, clPer, clVar) : null;
    const k = v == null ? null : corSeq(100 * (v - e.min) / (maxEsc(e) - e.min), e.c);
    return k ? {pane: 'clima', fill: true, fillColor: k, fillOpacity: OPC('clima'), weight: 0, stroke: false} : {pane: 'clima', fill: false, stroke: false}; },
  montar: async () => { await garantirClima(); atualizarSub('clima'); return CL ? L.geoJSON(dadosMun, {interactive: false, style: CAM.clima.estilo}) : null; },
  sub: () => {
    const e = ESC_CL[clVar], mx = maxEsc(e);
    let info = 'Dados de clima ainda não gerados pela rotina diária.';
    if (CL) { const [a, b] = janela(clPer); info = `${clVar === 'seco' ? 'Até ' + fmtD(deISO(CL.hoje)) : fmtD(deISO(CL.datas[a])) + ' a ' + fmtD(deISO(CL.datas[b - 1]))} · Open-Meteo${clPer.startsWith('f') && CL.modelos ? ' (média de ' + Object.keys(CL.modelos).length + ' modelos)' : ''} · gerado ${new Date(CL.gerado).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}${clPer.startsWith('p') || clVar === 'seco' ? '<br>Dias passados: estimativa de modelo, não medição.' : ''}`; }
    return `<select id="cl-per" class="campo"><option value="f7">Próximos 7 dias (previsão)</option><option value="f15">Próximos 15 dias (previsão)</option><option value="p7">Últimos 7 dias (estimativa)</option><option value="p30">Últimos 30 dias (estimativa)</option></select>
      <select id="cl-var" class="campo"><option value="p">Chuva acumulada (mm)</option><option value="bh">Chuva − evapotranspiração (mm)</option><option value="tx">Temperatura máxima (°C)</option><option value="tn">Temperatura mínima (°C)</option><option value="amp">Amplitude térmica média (°C)</option><option value="v">Vento máximo (km/h)</option><option value="seco">Dias seguidos sem chuva (até hoje)</option><option value="div">Divergência entre modelos na chuva prevista (mm)</option></select>
      <div class="leg">${[0, 25, 50, 75, 100].map(t => `<div><i style="background:${corSeq(t, e.c)}"></i>${t === 100 ? '≥ ' : t === 0 && clVar !== 'seco' && clVar !== 'p' ? '≤ ' : ''}${Math.round(e.min + (mx - e.min) * t / 100)} ${e.u}</div>`).join('')}</div>
      ${clVar === 'tn' ? '<div class="nota">Mínimas ≤ 3 °C: risco de geada.</div>' : ''}${clVar === 'div' ? '<div class="nota">Diferença entre o modelo mais chuvoso e o mais seco no período (só modelos que cobrem o período inteiro). Quanto maior, mais incerta a previsão de chuva.</div>' : ''}<div class="nota">${info}</div>`;
  },
  depois: () => { const p = $('cl-per'), v = $('cl-var'); if (!p) return; p.value = clPer; v.value = clVar; p.disabled = clVar === 'seco';
    p.onchange = () => { clPer = p.value; CAM.clima.layer && CAM.clima.layer.setStyle(CAM.clima.estilo); atualizarSub('clima'); };
    v.onchange = () => { clVar = v.value; if (clVar === 'div' && clPer.startsWith('p')) clPer = 'f7'; CAM.clima.layer && CAM.clima.layer.setStyle(CAM.clima.estilo); atualizarSub('clima'); }; }});
// ------------------------------------------------- água no solo para a cultura escolhida (balanço hídrico FAO-56)
// Classes pelo Ks (fração da transpiração potencial que a lavoura consegue manter) ou pela demanda atendida (ΣETa/ΣETc).
// A demanda é a de cada cultura: ETc = ET0 × Kc da fase (FAO-56), e o limite de estresse usa o p da cultura.
const CLS_AG = [{k: 'ok', nome: 'Atendida', cor: '#3f9a4c'}, {k: 'leve', nome: 'Restrição leve', cor: '#f0c541'},
  {k: 'mod', nome: 'Restrição moderada', cor: '#e8803f'}, {k: 'sev', nome: 'Restrição severa', cor: '#b5302a'}];
const COR_SEMCAMPO = '#bdbdbd';
const classeKs = ks => ks == null ? null : ks >= .99 ? 0 : ks >= .7 ? 1 : ks >= .4 ? 2 : 3;
const classeAt = a => a == null ? null : a >= 95 ? 0 : a >= 80 ? 1 : a >= 60 ? 2 : 3;
const MODOS_AG = {hoje: 'Hoje', fut: 'Pior dia (15 dias)', at30: 'Demanda atendida (30 dias)', at15: 'Demanda atendida (próx. 15)'};
let agVis = 'hoje', BHC = null;
// água disponível (mm) na zona radicular: textura do solo sob a cultura (ou do município) para 60 cm; cana com raízes até 120 cm
function cadMun(cid, cd) { const f = MUN_IDX[cd]; return (soloCultura(cid, cd)?.cad || (f && soloDoMunicipio(f)?.cad) || 60) * (cid === 'cana' ? PROF_CANA / 60 : 1); }
function bhCultura(c) {   // balanço de todos os municípios da cultura, em cache
  if (!c || !CL) return null;
  const chave = [safraSel, cultSel, CL.gerado, !!VAL, !!SOLO_CULT, !!dadosSolo].join('|');
  if (BHC?.chave === chave) return BHC.mun;
  const mun = {}, cc = c.cid === cultAtual()?.cid ? cultAtual() : c;   // sempre a cultura inteira (o recorte por região é feito por quem usa)
  for (const [cd, m] of Object.entries(cc.mun)) { const mc = CL.mun[cd]; if (mc) mun[cd] = balancoHidrico(mc, cadMun(c.cid, cd), c, m, cd); }
  BHC = {chave, mun}; return mun;
}
function classeAgua(bh) {   // índice da classe, -1 = sem lavoura em campo, null = sem dado
  if (!bh) return null;
  if (agVis === 'hoje') return bh.campoAtual > 0 ? classeKs(bh.ksAtual) : -1;
  if (agVis === 'fut') return bh.ksMinFutCampo == null ? -1 : classeKs(bh.ksMinFutCampo);
  const a = agVis === 'at30' ? bh.atend30 : bh.atendFut; return a == null ? -1 : classeAt(a);
}
defCam('agua', {grupo: 'clima', nome: 'Água no solo', op: .8, desab: true, st: 'conecte a pasta',
  estilo: f => { const c = cultAtual(), cd = String(+f.properties.CD_MUN), B = bhCultura(c);
    if (c && B && !c.mun[cd] && CAM.agua.fonte) return {pane: 'clima', fill: true, fillColor: COR_SEMCAMPO, fillOpacity: OPC('agua') * .35, weight: 0, stroke: false};   // lavoura mapeada sem dado na planilha
    if (!c || !B || !c.mun[cd]) return {pane: 'clima', fill: false, stroke: false};
    const k = classeAgua(B[cd]); if (k == null) return {pane: 'clima', fill: false, stroke: false};
    return {pane: 'clima', fill: true, fillColor: k < 0 ? COR_SEMCAMPO : CLS_AG[k].cor, fillOpacity: OPC('agua') * (k < 0 ? .6 : 1), weight: 0, stroke: false}; },
  montar: async () => { await garantirClima(); const c = cultAtual(); if (!c || !CL) { setSt('agua', !CL ? 'sem clima ainda' : 'escolha a cultura'); return null; }
    CAM.agua.fonte = null; CAM.agua.cid = c.cid;   // pintado por município
    const L_ = L.geoJSON(dadosMun, {interactive: false, style: CAM.agua.estilo}); atualizarSub('agua'); return L_; },
  sub: () => {
    const c = cultAtual(); if (!c) return '';
    const B = CL ? bhCultura(c) : null, kp = paramsKc(c), area = new Array(4).fill(0); let semCampo = 0, tot = 0;
    if (B) for (const [cd, bh] of Object.entries(B)) { const w = c.mun[cd]?.area || 1, k = classeAgua(bh); if (k == null) continue; tot += w; if (k < 0) semCampo += w; else area[k] += w; }
    const comCampo = tot - semCampo, crit = agVis.startsWith('at') ? ['≥ 95%', '80–95%', '60–80%', '< 60%'] : ['Ks = 1', 'Ks 0,7–0,99', 'Ks 0,4–0,7', 'Ks < 0,4'];
    const res = comCampo ? `<div class="barra">${area.map((v, k) => `<i title="${CLS_AG[k].nome}: ${(100 * v / comCampo).toFixed(0)}%" style="width:${100 * v / comCampo}%;background:${CLS_AG[k].cor}"></i>`).join('')}</div>
      Área com lavoura em campo: ${area.map((v, k) => `${CLS_AG[k].nome.toLowerCase()} <b>${(100 * v / comCampo).toFixed(0)}%</b>`).join(' · ')}` : (B ? 'Nenhum município com lavoura em campo no período.' : '');
    return `<div class="seg seg-wrap" id="modo-ag">${Object.entries(MODOS_AG).map(([k, n]) => `<button data-v="${k}" class="${agVis === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="resumo">${res}</div>
      <div class="leg">${CLS_AG.map((x, k) => `<div><i style="background:${x.cor}"></i>${x.nome} (${crit[k]})</div>`).join('')}<div><i style="background:${COR_SEMCAMPO}"></i>Sem lavoura em campo</div></div>
      <div class="nota">${c.semFenologia ? `Demanda da cana: ETc = ET0 × Kc médio anual de ${n2(KC_CANA)} (canaviais com idades misturadas; valor aproximado da curva FAO-56, 0,40 / 1,25 / 0,75). Raízes até ${PROF_CANA} cm; estresse abaixo de ${(100 * (1 - P_CANA)).toFixed(0)}% da água disponível (p = ${n2(P_CANA)}). ` : `Demanda de ${esc(c.nome.toLowerCase())}: ETc = ET0 × Kc (${n2(kp.ini)} no início, ${n2(kp.mid)} no pico, ${n2(kp.fim)} no fim; ${kp.fonte}), seguindo a fase de cada semana de semeadura da planilha. Estresse começa quando a água cai abaixo de ${(100 * (1 - kp.p)).toFixed(0)}% da disponível (p = ${n2(kp.p)}). `}Água disponível pela textura do solo sob a cultura. ${agVis.startsWith('at') ? 'Demanda atendida = consumo estimado ÷ consumo potencial nos dias com lavoura em campo.' : 'Ks = fração da transpiração potencial que a lavoura consegue manter.'} Clique no município para ver o gráfico.</div>`;
  },
  depois: () => document.querySelectorAll('#modo-ag button').forEach(b => b.onclick = () => { agVis = b.dataset.v; CAM.agua.layer && CAM.agua.layer.setStyle(CAM.agua.estilo); atualizarSub('agua'); })});
function dicaMun(f) {   // dica ao passar o mouse; com a camada de água ligada, mostra a situação da cultura
  const nome = esc(f.properties.NM_MUN), c = cultAtual(); if (!CAM.agua?.on || !c || !CL) return nome;
  const bh = bhCultura(c)?.[String(+f.properties.CD_MUN)]; if (!bh) return `${nome}<br><span style="opacity:.75">sem ${esc(c.nome.toLowerCase())} na planilha</span>`;
  const k = classeAgua(bh), cls = k == null ? '' : k < 0 ? 'sem lavoura em campo' : CLS_AG[k].nome.toLowerCase();
  const det = agVis === 'hoje' ? `água ${n0(bh.atual)}% · Ks ${n2(bh.ksAtual)} · demanda ${n1(bh.etcHoje)} mm/dia` : agVis === 'fut' ? `pior Ks ${n2(bh.ksMinFutCampo)} · água mín. ${n0(bh.minFut)}%`
    : agVis === 'at30' ? `${n0(bh.atend30)}% de ${n0(bh.dem30)} mm de demanda` : `${n0(bh.atendFut)}% de ${n0(bh.demFut)} mm de demanda`;
  return `${nome}<br><b>${cls}</b>${k >= 0 ? '<br>' + det : ''}`;
}
function atualizarAgua() {
  if (!CAM.agua) return; const c = cultAtual();
  habilitar('agua', !!c); setSt('agua', c ? '' : CANA || PL ? 'escolha a cultura' : 'conecte a pasta');
  if (CAM.agua.layer && CAM.agua.cid === c?.cid) CAM.agua.layer.setStyle(CAM.agua.estilo);
  else { if (CAM.agua.layer) mapa.removeLayer(CAM.agua.layer); CAM.agua.layer = null; if (CAM.agua.on && c) redesenhar('agua'); }   // outra cultura: outra geometria
  atualizarSub('agua');
}
function graficoEst(e) {
  const ds = Object.keys(e.serie).slice(-30); if (!ds.length) return ''; const W = 280, H = 70, bw = W / ds.length, pm = Math.max(10, ...ds.map(d => e.serie[d].p || 0));
  return `<svg class="graf" viewBox="0 0 ${W} ${H + 14}" width="100%" font-size="10">${ds.map((d, i) => { const p = e.serie[d].p || 0, h = H * p / pm; return `<rect x="${i * bw + 1}" y="${H - h}" width="${bw - 2}" height="${h}" fill="#2171b5"><title>${d}: ${p} mm</title></rect>`; }).join('')}<line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="#ccc"/><text x="0" y="${H + 12}">${fmtD(deISO(ds[0]))}</text><text x="${W}" y="${H + 12}" text-anchor="end">${fmtD(deISO(ds.at(-1)))}</text></svg>`;
}
function valEst(cod) {
  const v = VAL?.estacoes.find(x => x.codigo === cod); if (!v) return '';
  const l = (t, x) => x ? `<br>${t}: ET0 estação ${n1(x.inmet)} × modelo ${n1(x.modelo)} mm/dia (${x.vies_pct > 0 ? '+' : ''}${n1(x.vies_pct)}%, ${x.n} dias${x.r != null ? ', r = ' + n1(x.r) : ''})` : '';
  return `<div style="margin-top:4px;font-size:12px">Validação da ET0 (Penman-Monteith):${l('Reanálise ERA5', v.era5)}${l('Modelo de previsão', v.previsao)}</div>`;
}
defCam('est', {grupo: 'clima', nome: 'Estações INMET',
  montar: async () => {
    EST = EST || await pegar('dados/clima/estacoes_inmet.json');
    if (!EST) { setSt('est', 'sem dados ainda'); return null; }
    const ult = EST.estacoes.map(e => e.ultimo_dia).filter(Boolean).sort().at(-1);
    CAM.est.stFixo = ult ? 'até ' + fmtD(deISO(ult)) : '';
    return L.layerGroup(EST.estacoes.filter(e => e.lat && e.lon).map(e => {
      const ds = Object.keys(e.serie), soma = l => l.reduce((t, d) => t + (e.serie[d].p ?? 0), 0).toFixed(0);
      return L.circleMarker([e.lat, e.lon], {radius: 6, color: '#fff', weight: 1.5, fillColor: '#1f4e79', fillOpacity: OPC('est'), opacity: OPC('est')})
        .bindPopup(`<b>${esc(e.nome)}</b> · ${esc(e.codigo)}<br>Último dia com dados: ${e.ultimo_dia ? fmtD(deISO(e.ultimo_dia)) : '—'}<br>Chuva, 7 últimos dias com dados: <b>${soma(ds.slice(-7))} mm</b><br>Chuva, 30 últimos dias com dados: <b>${soma(ds.slice(-30))} mm</b>${valEst(e.codigo)}${graficoEst(e)}`, {maxWidth: 320});
    }));
  },
  sub: () => '<div class="nota">O INMET publica o arquivo anual com algumas semanas de atraso.</div>'});

// =====================================================================
// FOTOS DE CAMPO (cultura pela subpasta; posição pelo GPS ou pelo carimbo)
// =====================================================================
const CACHE_FOTOS = 'painel-safra.fotos.v4';   // v4: carimbo com hemisfério antes do número (S 21.6°, W 54.4°)
let fotoFiltro = null;      // Set de ids de cultura visíveis (null = todas)
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
let _ocr = null;
function ocrWorker() {
  if (_ocr) return _ocr;
  _ocr = (async () => { await carregarScript(LIBS.tess);
    const w = await Tesseract.createWorker('eng', 1, {workerPath: LIBS.tessWorker, corePath: LIBS.tessCore, langPath: LIBS.tessLang});
    await w.setParameters({tessedit_pageseg_mode: '6'}); return w; })();
  _ocr.catch(() => { _ocr = null; }); return _ocr;
}
// Carimbo de data/coordenadas escrito na imagem por apps de câmera (texto vermelho, amarelo ou branco),
// geralmente no rodapé ou no topo. Tenta várias cores e faixas e para na primeira leitura com coordenadas.
// "contorno": exige pixel escuro por perto (o texto branco desses apps tem contorno preto; separa de nuvens e capulhos).
const MASCARAS = {
  vermelho: {f: (r, g, b) => r > 150 && g < 110 && b < 110 && r - Math.max(g, b) > 70, contorno: false},
  amarelo: {f: (r, g, b) => r > 200 && g > 200 && b < 90 && Math.abs(r - g) < 35, contorno: false},
  branco: {f: (r, g, b) => Math.min(r, g, b) > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 35, contorno: true}
};
function perto(escuro, w, h, raio) {   // dilatação (máximo móvel) separável
  const t = new Uint8Array(w * h), o = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { let n = 0; const b = y * w;
    for (let x = -raio; x < w; x++) { if (x + raio < w && escuro[b + x + raio]) n++; if (x - raio - 1 >= 0 && escuro[b + x - raio - 1]) n--; if (x >= 0) t[b + x] = n > 0; } }
  for (let x = 0; x < w; x++) { let n = 0;
    for (let y = -raio; y < h; y++) { if (y + raio < h && t[(y + raio) * w + x]) n++; if (y - raio - 1 >= 0 && t[(y - raio - 1) * w + x]) n--; if (y >= 0) o[y * w + x] = n > 0; } }
  return o;
}
async function lerCarimbo(file) {
  const bmp = await createImageBitmap(file), W = bmp.width, H = bmp.height, faixa = Math.round(H * .18);
  const tentar = async (y0, x0, cor) => {
    const w0 = W - x0, sc = Math.min(3, Math.max(1, 1600 / w0)), c = document.createElement('canvas'); c.width = Math.round(w0 * sc); c.height = Math.round(faixa * sc);
    const g = c.getContext('2d'); g.drawImage(bmp, x0, y0, w0, faixa, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height), px = d.data, M = MASCARAS[cor], np = c.width * c.height;
    const hit = new Uint8Array(np); let n = 0;
    for (let k = 0, q = 0; q < np; k += 4, q++) if (M.f(px[k], px[k + 1], px[k + 2])) { hit[q] = 1; n++; }
    if (n < 400 || n / np > .45) return null;          // sem texto dessa cor, ou fundo inteiro dessa cor
    if (M.contorno) {
      const esc_ = new Uint8Array(np); for (let k = 0, q = 0; q < np; k += 4, q++) esc_[q] = (.299 * px[k] + .587 * px[k + 1] + .114 * px[k + 2]) < 80;
      const viz = perto(esc_, c.width, c.height, Math.round(3 * sc)); n = 0; for (let q = 0; q < np; q++) { hit[q] = hit[q] && viz[q]; n += hit[q]; }
      if (n < 300) return null;
    }
    for (let k = 0, q = 0; q < np; k += 4, q++) px[k] = px[k + 1] = px[k + 2] = hit[q] ? 0 : 255;
    g.putImageData(d, 0, 0);
    const w = await ocrWorker(), t1 = (await w.recognize(c)).data.text; let r = interpretarCarimbo(t1);
    if (!r || r.lat == null) {                       // 2ª leitura só com dígitos e sinais de coordenada
      await w.setParameters({tessedit_char_whitelist: '0123456789,.-SWNOE '});
      try { const r2 = interpretarCarimbo((await w.recognize(c)).data.text); if (r2 && r2.lat != null) r = {...(r || {}), lat: r2.lat, lon: r2.lon}; }
      finally { await w.setParameters({tessedit_char_whitelist: ''}); }
    }
    return r;
  };
  let melhor = null;
  // rodapé primeiro (mais comum), depois topo; cores em ordem; lado direito antes da largura toda
  outer: for (const y0 of [H - faixa, 0]) for (const cor of ['vermelho', 'amarelo', 'branco']) for (const x0 of [Math.round(W * .35), 0]) {
    const r = await tentar(y0, x0, cor);
    if (r && r.lat != null) { melhor = {...(melhor || {}), ...r}; break outer; }
    if (r && r.data && !melhor) melhor = r;
  }
  bmp.close && bmp.close(); return melhor;
}
// faixa geográfica de MS com folga (graus): usada para validar e reparar leituras do carimbo
const LIM = {lat: [-24.3, -17.0], lon: [-58.4, -50.7]};
const dentro = (v, [a, b]) => v >= a && v <= b;
function numeroGeo(tok, lim, hemNeg) {
  // aceita "-18,0778", "18.0778" e também leituras sem separador ("1807785"): recoloca a vírgula pela faixa de MS
  const t = String(tok).replace(/[^\d.,-]/g, ''); if (!t) return null;
  let v = parseFloat(t.replace(',', '.')); if (/[.,]/.test(t) && isFinite(v)) { v = -Math.abs(v); return dentro(v, lim) ? v : null; }
  const dig = t.replace(/\D/g, '');
  for (let ini = 0; ini <= 2 && ini < dig.length - 3; ini++) for (const ni of [2, 1]) {
    const inteiro = dig.slice(ini, ini + ni), dec = dig.slice(ini + ni, ini + ni + 4); if (dec.length < 3) continue;
    const cand = -parseFloat(inteiro + '.' + dec); if (dentro(cand, lim)) return cand;
  }
  return null;
}
function interpretarCarimbo(txt) {
  const t = String(txt || '').replace(/[Oo](?=\d)/g, '0').replace(/[‐‑–—~]/g, '-').replace(/([.,]\d+) +(?=\d)/g, '$1'), out = {};
  // 0) hemisfério antes do número: "S 21.646588°, W 54.451925°" (carimbo de câmera do iPhone e outros apps)
  const h = t.match(/(?:^|[^A-Za-z])([NS5])\s*(\d{1,2}[.,]\d{2,7})\s*°?\s*[,;]?\s*([EWLO])\s*(\d{1,3}[.,]\d{2,7})/i);
  if (h) { let lat = parseFloat(h[2].replace(',', '.')), lon = parseFloat(h[4].replace(',', '.'));
    if (/[s5]/i.test(h[1])) lat = -lat; if (/[wo]/i.test(h[3])) lon = -lon;
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) { out.lat = lat; out.lon = lon; } }
  // 1) formato normal: lat [S] [,;] lon [W]
  const m = out.lat != null ? null : t.match(/(-?\d{1,2}[.,]\d{2,7})\s*°?\s*([NS])?\s*[,;]?\s+(-?\d{1,3}[.,]\d{2,7})\s*°?\s*([EWLO])?/i)
    || t.match(/(-?\d{1,2}[.,]\d{2,7})\s*°?\s*([NS])?\s*[,;]\s*(-?\d{1,3}[.,]\d{2,7})\s*°?\s*([EWLO])?/i);
  if (m) { let lat = parseFloat(m[1].replace(',', '.')), lon = parseFloat(m[3].replace(',', '.'));
    if (/s/i.test(m[2] || '')) lat = -Math.abs(lat); if (/[wo]/i.test(m[4] || '')) lon = -Math.abs(lon);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat || lon)) { out.lat = lat; out.lon = lon; } }
  // 2) reparo: longitude legível seguida de W/O e latitude logo antes, mesmo sem separador
  if (out.lat == null || !dentro(out.lat, LIM.lat) || !dentro(out.lon, LIM.lon)) {
    const r = t.match(/([-\d.,]{5,12})\s*[S5]?\s*[,;]?\s*(-?\d{2}[.,]?\d{3,6})\s*[WO]/i);
    if (r) { const la = numeroGeo(r[1], LIM.lat), lo = numeroGeo(r[2], LIM.lon); if (la != null && lo != null) { out.lat = la; out.lon = lo; out.reparado = true; } }
  }
  // datas: escolhe a mais frequente no carimbo (as linhas costumam repetir a data)
  const cand = [];
  for (const d of t.matchAll(/(\d{1,2})\s+de\s+([a-zçA-ZÇ]+)\.?,?\s+de\s+(\d{4})/g)) { const i = MESES.indexOf(norm(d[2]).slice(0, 3)); if (i >= 0) cand.push(new Date(+d[3], i, +d[1], 12)); }
  for (const d of t.matchAll(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\D+(\d{1,2}):(\d{2}))?/g)) cand.push(new Date(+d[3], d[2] - 1, +d[1], d[4] ? +d[4] : 12, d[5] ? +d[5] : 0));
  const ok = cand.filter(d => !isNaN(d) && d <= addD(HOJE, 1) && d.getFullYear() >= 2015);
  if (ok.length) { const cont = {}; ok.forEach(d => { const k = dISO(d); cont[k] = (cont[k] || 0) + 1; });
    const k = Object.entries(cont).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0][0]; out.data = ok.find(d => dISO(d) === k); }
  return out.lat != null || out.data ? out : null;
}
function munDoPonto(lon, lat) { return dadosMun?.features.find(m => turf.booleanPointInPolygon([lon, lat], m)) || null; }
async function carregarFotos(lista) {
  FOTOS = []; fotoFiltro = null;
  if (!lista.length) { habilitar('fotos', false); setSt('fotos', 'nenhuma foto'); atualizarSub('fotos'); return; }
  habilitar('fotos', true);
  const cache = lsGet(CACHE_FOTOS, {}); let ocrFalhou = false, k = 0, semPos = [];
  for (const a of lista) {
    k++; setSt('fotos', `lendo ${k}/${lista.length}`);
    try {
      const f = await a.obter(), chave = f.name + '|' + f.size; let r = cache[chave];
      if (!r) {
        let ex = null; try { ex = await exifr.parse(f, {tiff: true, exif: true, gps: true, xmp: false, icc: false, iptc: false, jfif: false, ihdr: false}); } catch (e) {}
        r = {src: 'sem'};
        if (ex && isFinite(ex.latitude) && isFinite(ex.longitude)) r = {lat: ex.latitude, lon: ex.longitude, src: 'gps'};
        const dEx = ex && (ex.DateTimeOriginal || ex.CreateDate); if (dEx) r.data = new Date(dEx).toISOString();
        r.cam = ex ? [ex.Make, ex.Model].filter(Boolean).join(' ') : '';
        if (r.lat == null && !ocrFalhou && /\.(jpe?g|png|webp)$/i.test(f.name)) {
          try { const c = await lerCarimbo(f); if (c) { if (c.lat != null) { r.lat = c.lat; r.lon = c.lon; r.src = 'carimbo'; } if (c.data && !r.data) r.data = c.data.toISOString(); } }
          catch (e) { console.warn('Leitura do carimbo indisponível:', e); ocrFalhou = true; }
        }
        if (r.lat != null || !ocrFalhou) cache[chave] = r;
      }
      const partes = a.caminho.split('/'); const pasta = partes.slice(0, -1).reverse().find(p => culturaDe(p)) || '';
      const cult = culturaDe(pasta) || OUTRA;
      const foto = {a, f, cult: cult.id, src: r.src, cam: r.cam, data: r.data ? new Date(r.data) : new Date(f.lastModified), dataArq: !r.data, lat: r.lat, lon: r.lon};
      if (r.lat != null) { foto.mun = munDoPonto(r.lon, r.lat); FOTOS.push(foto); } else semPos.push(a.caminho);
    } catch (e) { semPos.push(a.caminho); }
  }
  lsSet(CACHE_FOTOS, cache);
  if (_ocr) { try { (await _ocr).terminate(); } catch (e) {} _ocr = null; }
  CAM.fotos.semPos = semPos; CAM.fotos.ocrFalhou = ocrFalhou;
  CAM.fotos.stFixo = FOTOS.length ? String(FOTOS.length) : ''; setSt('fotos', CAM.fotos.stFixo);
  atualizarSub('fotos');
  if (FOTOS.length && !CAM.fotos.on) { $('cb-fotos').checked = true; await ligar('fotos', true); } else redesenhar('fotos');
  if (selecionado) abrirFicha(selecionado, true);
}
const fotoVisivel = p => CAM.fotos.seguir ? (cultAtual() ? p.cult === cultAtual().cid : true) : (!fotoFiltro || fotoFiltro.has(p.cult));
defCam('fotos', {grupo: 'campo', nome: 'Mostrar fotos no mapa', desab: true, st: 'conecte a pasta', seguir: true,
  montar: async () => L.layerGroup(FOTOS.filter(fotoVisivel).map(p => {
    const cult = CULT[p.cult] || OUTRA;
    const mk = L.marker([p.lat, p.lon], {opacity: OPC('fotos'), riseOnHover: true,
      icon: L.divIcon({className: '', html: `<div class="pin ${p.src === 'carimbo' ? 'carimbo' : ''}" style="background:${cult.cor}">${iconeCultura(cult.id)}</div>`, iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -12]})});
    mk.bindTooltip(`${esc(cult.nome)} · ${fmtD(p.data)} · ${p.mun ? esc(p.mun.properties.NM_MUN) : 'fora do MS'}`, {direction: 'top', offset: [0, -12]});
    mk.bindPopup(() => {
      const url = p.url || (p.url = URL.createObjectURL(p.f));
      return `<div class="foto-pop"><img src="${url}" onclick="window.open('${url}')" title="Abrir em tamanho real" alt="">
        <b>${esc(cult.nome)} · ${p.mun ? esc(p.mun.properties.NM_MUN) : 'Fora do MS'}</b><br>${p.dataArq ? 'Data do arquivo: ' + fmtDL(p.data) : p.data.toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: p.data.getHours() === 12 && !p.data.getMinutes() ? undefined : 'short'})}
        <br><span style="color:#5d6b58">${esc(p.a.caminho.split('/').pop())}<br>${p.lat.toFixed(5)}, ${p.lon.toFixed(5)} · posição ${p.src === 'gps' ? 'pelo GPS da foto' : 'lida do carimbo na imagem'}${p.cam ? ' · ' + esc(p.cam) : ''}</span>
        <br><a href="${url}" target="_blank" rel="noopener">Abrir em tamanho real</a></div>`;
    }, {maxWidth: 300, autoPanPadding: [20, 20]});
    return mk;
  })),
  sub: () => {
    if (!FOTOS.length) return CAM.fotos.semPos?.length ? `<div class="nota">${CAM.fotos.semPos.length} fotos sem localização (sem GPS e sem carimbo legível).</div>` : '';
    const cont = {}; FOTOS.forEach(p => cont[p.cult] = (cont[p.cult] || 0) + 1);
    const ids = [...CULTURAS.map(c => c.id), 'outra'].filter(id => cont[id]);
    const ativo = id => CAM.fotos.seguir && cultAtual() ? (cultAtual().cid === id) : (!fotoFiltro || fotoFiltro.has(id));
    return `<div class="mini"><label><input type="checkbox" id="ft-seguir" ${CAM.fotos.seguir ? 'checked' : ''}> só a cultura selecionada</label></div>
      <div class="chips">${ids.map(id => { const c = CULT[id] || OUTRA; return `<span class="chip ${ativo(id) ? '' : 'off'}" data-c="${id}" title="Mostrar/ocultar"><span class="pin" style="background:${c.cor}">${iconeCultura(id)}</span>${esc(c.nome)} (${cont[id]})</span>`; }).join('')}</div>
      <div class="mini"><a id="ft-todas">todas</a><a id="ft-nenhuma">nenhuma</a></div>
      <div class="nota">Cultura identificada pela subpasta (ex.: 04_Fotos_Campo/Soja). Contorno tracejado: posição lida do carimbo.${CAM.fotos.semPos?.length ? `<br><span title="${esc(CAM.fotos.semPos.join('\n'))}" style="text-decoration:underline dotted;cursor:help">${CAM.fotos.semPos.length} sem localização</span>` : ''}${CAM.fotos.ocrFalhou ? '<br>Leitura do carimbo indisponível (sem internet para baixar o leitor).' : ''}</div>`;
  },
  depois: () => {
    const s = $('ft-seguir'); if (!s) return;
    s.onchange = () => { CAM.fotos.seguir = s.checked; redesenhar('fotos'); atualizarSub('fotos'); };
    document.querySelectorAll('#sub-fotos .chip').forEach(ch => ch.onclick = () => {
      if (CAM.fotos.seguir) return;
      const ids = [...new Set(FOTOS.map(p => p.cult))]; fotoFiltro = fotoFiltro || new Set(ids);
      fotoFiltro.has(ch.dataset.c) ? fotoFiltro.delete(ch.dataset.c) : fotoFiltro.add(ch.dataset.c);
      redesenhar('fotos'); atualizarSub('fotos'); });
    $('ft-todas').onclick = () => { CAM.fotos.seguir = false; fotoFiltro = null; redesenhar('fotos'); atualizarSub('fotos'); };
    $('ft-nenhuma').onclick = () => { CAM.fotos.seguir = false; fotoFiltro = new Set(); redesenhar('fotos'); atualizarSub('fotos'); };
  }});

// =====================================================================
// RELATOS DE VIAGEM (docx, txt, md, pdf)
// =====================================================================
// palavras-chave (texto sem acento, minúsculo) para identificar as culturas citadas num relato
const PALAVRAS_CULT = {soja: ['soja'], milho1: ['milho'], milho2: ['milho', 'safrinha'], sorgo: ['sorgo'], amendoim: ['amendoim'], arroz: ['arroz'],
  feijao1: ['feijao'], feijao2: ['feijao'], algodao: ['algodao'], trigo: ['trigo'], aveia: ['aveia'], cana: ['cana-de-acucar', 'cana de acucar', 'canavial', 'cana ']};
async function extrairTexto(a) {
  const f = await a.obter(), ext = f.name.toLowerCase().split('.').pop();
  if (ext === 'txt' || ext === 'md') return await f.text();
  if (ext === 'docx') { await carregarScript(LIBS.mammoth); return (await mammoth.extractRawText({arrayBuffer: await f.arrayBuffer()})).value; }
  if (ext === 'odt') return await textoODT(await f.arrayBuffer());
  if (ext === 'pdf') {
    await carregarScript(LIBS.pdfjs); pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfjsWorker;
    const pdf = await pdfjsLib.getDocument({data: await f.arrayBuffer()}).promise; let t = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) { const pg = await pdf.getPage(i); t += (await pg.getTextContent()).items.map(x => x.str).join(' ') + '\n'; }
    return t;
  }
  return '';
}
// .odt (LibreOffice): é um zip; lê o content.xml descompactando com o próprio navegador (DecompressionStream)
async function textoODT(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf); let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) return '';
  let p = v.getUint32(e + 16, true); const n = v.getUint16(e + 10, true);
  for (let k = 0; k < n; k++) { const met = v.getUint16(p + 10, true), tam = v.getUint32(p + 20, true), ln = v.getUint16(p + 28, true), lx = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + ln)); p += 46 + ln + lx + lc;
    if (nome !== 'content.xml') continue;
    const ini = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), dados = u8.subarray(ini, ini + tam);
    const bytes = met === 0 ? dados : new Uint8Array(await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    const xml = new TextDecoder().decode(bytes).replace(/<text:tab\/>/g, ' ').replace(/<text:line-break\/>/g, '\n').replace(/<text:s(?: text:c="(\d+)")?\/>/g, (x, c) => ' '.repeat(+c || 1)).replace(/<\/text:(p|h)>/g, '\n').replace(/<\/table:table-cell>/g, ' | ').replace(/<[^>]+>/g, '');
    const d = document.createElement('textarea'); d.innerHTML = xml; return d.value; }
  return '';
}
function dataDoRelato(nome, texto, f) {
  let m = nome.match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})/); if (m) return new Date(+m[1], m[2] - 1, +m[3], 12);
  m = nome.match(/(\d{2})[-_.](\d{2})[-_.](20\d{2})/); if (m) return new Date(+m[3], m[2] - 1, +m[1], 12);
  m = texto.slice(0, 600).match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/); if (m) return new Date(+m[3], m[2] - 1, +m[1], 12);
  // "entre os dias 19 e 23 de outubro", "de 19 a 23 de outubro de 2026", "23 de outubro de 2026": vale o último dia citado
  const t = norm(texto.slice(0, 1500)), ano0 = new Date(f.lastModified).getFullYear();
  m = t.match(/(primeira|segunda|terceira|quarta|ultima) semana de ([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (m) { const mes = MESES.indexOf(m[2].slice(0, 3)); if (mes >= 0) { const dia = {primeira: 7, segunda: 14, terceira: 21, quarta: 28, ultima: 28}[m[1]]; let d = new Date(+(m[3] || ano0), mes, dia, 12); if (d > addD(new Date(f.lastModified), 2)) d = new Date(d.getFullYear() - 1, mes, dia, 12); return d; } }
  m = t.match(/(\d{1,2})\s+(?:e|a|ate)\s+(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/) || t.match(/(\d{1,2})()\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (m) { const mes = MESES.indexOf(m[3].slice(0, 3)); if (mes >= 0) { const d = new Date(+(m[4] || ano0), mes, +(m[2] || m[1]), 12); if (d <= addD(new Date(f.lastModified), 2)) return d; } }
  return new Date(f.lastModified);
}
async function carregarRelatos(lista) {
  RELATOS = [];
  if (!lista.length) return;
  const nomesMun = dadosMun.features.map(f => ({cd: String(+f.properties.CD_MUN), nome: f.properties.NM_MUN, re: new RegExp('(^|[^A-Za-z])' + semAcento(f.properties.NM_MUN).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])')}));
  for (const a of lista) {
    try {
      const f = await a.obter(), texto = (await extrairTexto(a)).replace(/\r/g, ''); if (!texto.trim()) continue;
      const sa = semAcento(texto), tn = norm(texto);
      const muns = nomesMun.filter(x => x.re.test(sa)).map(x => x.cd);
      // subpasta define o grupo: ".../Cana/..." = relato de cana; ".../Graos/..." = grãos e algodão (não conta citações de cana)
      const pastas = a.caminho.split('/').slice(0, -1).map(norm), grupo = pastas.some(x => /(^|[^a-z])cana/.test(x)) ? 'cana' : pastas.some(x => /graos|grao/.test(x)) ? 'graos' : null;
      let cults = Object.entries(PALAVRAS_CULT).filter(([, ps]) => ps.some(p => tn.includes(p))).map(([k]) => k);
      if (grupo === 'cana') cults = ['cana']; else if (grupo === 'graos') cults = cults.filter(k => k !== 'cana');
      const rel = {caminho: a.caminho, nome: a.caminho.split('/').pop(), data: dataDoRelato(a.caminho.split('/').pop(), texto, f), texto, grupo, muns: new Set(muns), cults: new Set(cults)};
      try { rel.fatos = analisarRelato(rel, nomesMun); rel.fatos.forEach(x => x.cid && rel.cults.add(x.cid)); } catch (e) { console.warn('leitura analítica do relato falhou', e); rel.fatos = []; }
      RELATOS.push(rel);
    } catch (e) { console.warn('relato não lido', a.caminho, e); }
  }
  RELATOS.sort((p, q) => q.data - p.data);
  const ng = g => RELATOS.filter(r => r.grupo === g).length, ng0 = RELATOS.filter(r => !r.grupo).length;
  $('st-pasta').innerHTML = $('st-pasta').innerHTML.replace(/Relatos: \d+/, `Relatos: ${RELATOS.length} (grãos ${ng('graos')} · cana ${ng('cana')}${ng0 ? ` · fora das subpastas ${ng0}` : ''})`);
  if (selecionado) abrirFicha(selecionado, true);
}
// =====================================================================
// LEITURA ANALÍTICA DOS RELATOS: extrai fatos (números, problemas, clima, mercado) e cruza com os dados do painel
// =====================================================================
// número no padrão brasileiro: "1.400" -> 1400; "10.500,00" -> 10500; "47,5" -> 47.5; "3 mil" tratado à parte
function numBR(t) {
  t = String(t).trim(); if (/,/.test(t)) return parseFloat(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return parseFloat(t.replace(/\./g, ''));
  return parseFloat(t);
}
const PRAGAS = [['lesma', 'lesmas'], ['caramujo', 'caramujos'], ['percevejo', 'percevejos'], ['lagarta', 'lagartas'], ['helicoverpa', 'Helicoverpa'], ['mosca-branca', 'mosca-branca'], ['mosca branca', 'mosca-branca'],
  ['cigarrinha', 'cigarrinha'], ['ferrugem', 'ferrugem'], ['antracnose', 'antracnose'], ['mofo branco', 'mofo-branco'], ['nematoide', 'nematoides'], ['buva', 'buva'], ['capim-amargoso', 'capim-amargoso'],
  ['capim amargoso', 'capim-amargoso'], ['plantas daninhas', 'plantas daninhas'], ['tripes', 'tripes'], ['acaro', 'ácaros'], ['pulgao', 'pulgões'], ['cupim', 'cupins'], ['brusone', 'brusone'], ['mancha-alvo', 'mancha-alvo'], ['mancha alvo', 'mancha-alvo'], ['enfezamento', 'enfezamento'],
  ['sphenophorus', 'Sphenophorus (bicudo-da-cana)'], ['bicudo', 'Sphenophorus (bicudo-da-cana)'], ['estria vermelha', 'estria-vermelha'], ['isoporiza', 'isoporização'], ['broca', 'broca-da-cana'], ['carvao', 'carvão'], ['podridao', 'podridões']];
const CLIMA_RE = {
  excesso: /excesso de chuva|chuvas? acima da media|chuvas? fora de epoca|chuvas? (recorrente|frequente|intensa|continua|persistente)|elevado volume de chuva|muita chuva|chuva em excesso|encharcad|alagad|solo muito umido|umidade elevada/,
  falta: /falta de chuva|estiagem|veranico|seca\b|deficit hidrico|chuva(s)? (escassa|irregular|abaixo)|baixa umidade do solo|restricao hidrica/,
  geada: /geada/, granizo: /granizo/, radiacao: /(baixa|pouca|reduzida) (incidencia de )?radiacao|nebulosidade|dias nublados|tempo nublado/, calor: /altas temperaturas|calor excessivo|temperaturas elevadas/};
const ROT_CLIMA = {excesso: 'excesso de chuva', falta: 'falta de chuva / estiagem', geada: 'geada', granizo: 'granizo', radiacao: 'pouca luz (nebulosidade)', calor: 'calor excessivo'};
function cidSecao(linha) {   // título de seção com o nome de uma cultura ("Soja", "Milho 2ª safra", "Amendoim")
  const l = linha.trim(); if (!l || l.length > 32 || /[.:;]$/.test(l)) return null;
  const c = culturaDe(l); return c && norm(l).replace(/[^a-z ]/g, '').split(' ').filter(Boolean).length <= 4 ? c.id : null;
}
function analisarRelato(rel, nomesMun) {
  const fatos = [], linhas = rel.texto.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const munsDe = s => { const sa = semAcento(s); return nomesMun.filter(x => x.re.test(sa)).map(x => x.cd); };
  // escopo regional: municípios citados na frase de visitas; senão todos os citados no relato
  const fv = rel.texto.split(/(?<=[.!?])\s+|\n+/).find(x => /visitad|percorrid|vistoriad|roteiro|viagem/.test(norm(x)) && munsDe(x).length >= 2);
  const regiao = fv ? munsDe(fv) : [...rel.muns];
  let cidAtual = null;
  for (const linha of linhas) {
    const sec = cidSecao(linha); if (sec) { cidAtual = sec; continue; }
    for (const frase of linha.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)) {
      const n = norm(frase), ms = munsDe(frase), escopo = ms.length ? ms : regiao, tipoEsc = ms.length ? 'mun' : 'regiao';
      const cids = rel.grupo === 'cana' ? ['cana'] : cidAtual ? [cidAtual] : Object.entries(PALAVRAS_CULT).filter(([, ps]) => ps.some(p => n.includes(p))).map(([k]) => k);
      if (rel.grupo === 'cana' && !cids.includes('cana')) cids.push('cana');
      const add = (cat, extra) => { for (const cid of (cids.length ? cids : [null])) fatos.push({cid, cat, escopo, tipoEsc, frase: frase.length > 300 ? frase.slice(0, 297) + '…' : frase, rel, ...extra}); };
      let m;
      if ((m = n.match(/atras\w*[^.]{0,70}?(\d{1,3})\s*%(?:\s*(?:e|a)\s*(\d{1,3})\s*%)?/))) add('atraso', {min: +m[1], max: +(m[2] || m[1])});
      else if (/atras/.test(n) && /plant|semead|semeadura/.test(n)) add('atraso', {});
      if (!/atras/.test(n) && ((m = n.match(/(\d{1,3}(?:[.,]\d+)?)\s*%[^.]{0,90}?(semead|plantad|implantad)/)) || (m = n.match(/(semeadura|plantio|semead|plantad)[^.]{0,60}?(\d{1,3}(?:[.,]\d+)?)\s*%/))))
        add('plantio', {pct: numBR(/\d/.test(m[1]) ? m[1] : m[2])});
      if ((m = n.match(/paralis\w*[^.]{0,90}?(\d{1,3})\s*dias/)) || (m = n.match(/(\d{1,3})\s*dias[^.]{0,40}?(parad|paralis|sem (poder )?plantar)/))) add('paralisacao', {dias: +m[1]});
      const has = [...n.matchAll(/(\d[\d.,]*)\s*(mil)?\s*(?:hectares|ha)\b/g)].map(x => numBR(x[1]) * (x[2] ? 1000 : 1)).filter(v => isFinite(v) && v > 0);
      const hasMil = [...n.matchAll(/(\d[\d.,]*)\s*mil\s*(?:e|a)\s*(\d[\d.,]*)\s*mil\s*(?:hectares|ha)/g)].map(x => [numBR(x[1]) * 1000, numBR(x[2]) * 1000]);
      if (/replant/.test(n) && has.length) add('replantio', {ha: has[0]});
      else if (/convert|perdendo espaco|substitu|migr|destinad/.test(n) && /eucalipto|silvicultura|pecuaria|pastagem|cana/.test(n)) {
        const para = /eucalipto|silvicultura/.test(n) ? 'eucalipto (silvicultura)' : /pecuaria|pastagem/.test(n) ? 'pecuária' : 'cana-de-açúcar';
        const fr = frase + ' ' + (linhas[linhas.indexOf(linha)] || ''); const mm = norm(fr).match(/(\d[\d.,]*)\s*mil\s*(?:e|a)\s*(\d[\d.,]*)\s*mil\s*(?:hectares|ha)/);
        add('conversao', {para, min: mm ? numBR(mm[1]) * 1000 : (hasMil[0]?.[0] ?? has[0]), max: mm ? numBR(mm[2]) * 1000 : (hasMil[0]?.[1] ?? has[0])});
      } else if (has.length && /area|cultivad|plantad|estimad|safra/.test(n) && !/custo|r\$/.test(n)) add('area', {ha: has.at(-1), anterior: /safra anterior|ano passado|ultima safra/.test(n) && !/para a safra|nesta safra|estimativa de cerca/.test(n)});
      for (const [k, re] of Object.entries(CLIMA_RE)) if (re.test(n)) add('clima', {tipo: k});
      const pr = [...new Set(PRAGAS.filter(([p]) => n.includes(p)).map(([, r]) => r))];
      if (pr.length) add('pragas', {itens: pr, nivel: /elevad|alta|severa|intensa/.test(n) ? 'alto' : /moderad/.test(n) ? 'moderado' : /baixa|pontua/.test(n) ? 'baixo' : null});
      const est = [...new Set([...frase.matchAll(/\b([VR])\s?(E|C|\d{1,2})\b/g)].map(x => x[1] + x[2]))]; if (est.length) add('estadio', {itens: est});
      if ((m = n.match(/r\$\s*([\d.,]+)\s*(?:por|\/)\s*(saca|sc|kg|tonelada|t\b)(?:\s*de\s*(\d+)\s*kg)?/))) add('preco', {valor: numBR(m[1]), unid: m[2], kgSaca: m[3] ? +m[3] : (m[2] === 'kg' ? 1 : m[2].startsWith('t') ? 1000 : 60)});
      if ((m = n.match(/custo[^.]{0,80}?r\$\s*([\d.,]+)\s*(?:por|\/)\s*(hectare|ha)/))) add('custo', {valor: numBR(m[1])});
      if ((m = n.match(/custo[^.]{0,80}?(\d+)\s*a\s*(\d+)\s*sacas/))) add('custo', {sacasMin: +m[1], sacasMax: +m[2]});
      if ((m = n.match(/produtividade[^.]{0,80}?([\d.,]+)\s*(kg\/ha|sc\/ha|sacas por hectare)/))) add('produtividade', {valor: numBR(m[1]), unid: m[2].startsWith('kg') ? 'kg/ha' : 'sc/ha'});
      if ((m = n.match(/diesel[^.]{0,60}?r\$\s*([\d.,]+)/))) add('diesel', {valor: numBR(m[1])});
      if ((m = n.match(/ate\s+(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/)) || (m = n.match(/ate\s+()([a-z]+)\s+de\s+(\d{4})/))) {
        const mes = MESES.indexOf(m[2].slice(0, 3)); if (mes >= 0 && /plant|semead|semeadura|conclu|estend|janela/.test(n)) { let ano = +(m[3] || rel.data.getFullYear()); const d = new Date(ano, mes, +(m[1] || 28), 12); if (!m[3] && d < addD(rel.data, -30)) d.setFullYear(ano + 1); add('prazo', {data: d}); } }
      // cana e bioenergia: colheita, qualidade, mix, variedades, preços, etanol de milho, biomassa e sorgo
      if (rel.grupo === 'cana') {
        if ((m = n.match(/(\d{1,3})\s*% da area (?:ja )?(?:foi |havia sido |esta |estava )?colhid/))) add('colheita', {pct: +m[1]});
        if ((m = n.match(/(metade|\d{1,3}\s*%) da area (?:ja )?deveria ter sido colhid/))) add('colheitaEsperada', {pct: /metade/.test(m[1]) ? 50 : parseFloat(m[1])});
        if (/colheita/.test(n) && (m = n.match(/atrasad\w*[^.]{0,40}?(\d{1,2})\s*pontos? percentuais/))) add('atrasoColheita', {pp: +m[1]});
        if ((m = n.match(/(?:impacto|perda|reducao|queda)[^.]{0,30}?(\d{1,2})\s*% no atr/)) || (m = n.match(/\batr\b[^.]{0,40}(?:impacto|perda|reducao|queda)[^.]{0,20}?(\d{1,2})\s*%/))) add('atrImpacto', {pct: +m[1]});
        if ((m = n.match(/produtividade media[^.]{0,50}?(\d{2,3}(?:[.,]\d+)?)\s*(?:toneladas por hectare|t\/ha)/))) add('tch', {v: numBR(m[1])});
        if ((m = n.match(/(\d{1,2})\s*% para (?:o )?acucar/))) add('mix', {acucar: +m[1]});
        if ((m = n.match(/(\d{1,3})\s*variedades/))) add('variedades', {n: +m[1]});
        if (/preco/.test(n) && (m = n.match(/de ([a-z ]{4,40}?) para o acucar/))) { const e = n.match(/de ([a-z ]{4,40}?) para o etanol/); add('precoSent', {acucar: m[1].trim(), etanol: e ? e[1].trim() : null}); }
        if ((m = n.match(/(\d{1,3})\s*% do volume necessario[^.]{0,60}?adquirid/))) add('milhoCompra', {pct: +m[1]});
        if ((m = n.match(/contrato futuro[^.]{0,40}?(\d{1,3})\s*% a (\d{1,3})\s*%/))) add('milhoContrato', {min: +m[1], max: +m[2]});
        if (/metade[^.]{0,40}produtores[^.]{0,60}cooperativas/.test(n)) add('milhoOrigem', {});
        if ((m = n.match(/silo bag[^.]{0,80}?(\d{1,3})\s*%/))) add('siloBag', {pct: +m[1]});
        if ((m = n.match(/estoque[^.]{0,80}?entre (\d{1,2}) e (\d{1,2}) meses/)) || (m = n.match(/estoque[^.]{0,80}?(\d{1,2})() meses/))) add('estoque', {min: +m[1], max: +(m[2] || m[1])});
        if (/cavaco|biomassa de madeira|lenha/.test(n)) add('cavaco', {celulose: /celulose/.test(n)});
        if ((m = n.match(/sorgo[^.]{0,40}?(?:no maximo |ate )?(\d{1,2})\s*% do volume/))) add('sorgoPct', {pct: +m[1]});
        if ((m = n.match(/chuvas?[^.]{0,50}?(?:em|de) (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/))) add('climaMes', {mes: MESES.indexOf(m[1].slice(0, 3)), acima: /acima|excesso|fora de epoca/.test(n)});
      }
      if (/cooperativ|revenda|credito|financiament|juros|garantia/.test(n) && rel.grupo !== 'cana') add('credito', {});
      if (/precoce|semiprecoce|ciclo (curto|medio|tardio)|grupo de maturacao/.test(n)) add('ciclo', {});
      if (/preco|comprador|comercializa|rentabilidade|margem/.test(n) && !fatos.some(f => f.frase === frase && f.cat === 'preco')) add('mercado', {});
    }
  }
  return fatos;
}
// --- cruzamento com os dados do painel -------------------------------------------------------------------
function cultDaData(cid, data) {   // planilha da cultura cuja safra contém a data do relato (ou a mais recente)
  if (cid === 'cana') return CANA; if (!PL) return null;
  const cands = Object.keys(PL).sort().reverse().map(s => Object.values(PL[s]).find(c => c.cid === cid && Object.keys(c.mun).length)).filter(Boolean);
  return cands.find(c => c.inicio && data >= c.inicio && data <= addD(c.inicio, 7 * 48)) || cands[0] || null;
}
function climaJanela(cds, ate, dias = 30) {   // chuva e ET0 médias dos municípios nos N dias até a data (modelo do painel)
  if (!CL) return null; const i1 = CL.datas.indexOf(dISO(ate)) + 1; if (i1 <= 0) return null; const i0 = Math.max(0, i1 - dias);
  let n = 0, p = 0, e = 0, dch = 0, seq = 0, maxSeq = 0;
  const ms = cds.map(cd => CL.mun[cd]).filter(Boolean); if (!ms.length) return null;
  for (let i = i0; i < i1; i++) { const pd = ms.reduce((t, m) => t + (m.p[i] || 0), 0) / ms.length, ed = ms.reduce((t, m) => t + (m.et0[i] || 0), 0) / ms.length; p += pd; e += ed; n++;
    if (pd >= 1) { dch++; seq++; maxSeq = Math.max(maxSeq, seq); } else seq = 0; }
  return {p, e, dias: n, dch, maxSeq};
}
const fmtHa = v => v >= 1e6 ? n1(v / 1e6) + ' mi ha' : v >= 1e4 ? n0(v / 1e3) + ' mil ha' : n0(v) + ' ha';
function cruzarRelatos(cid, cdsAlvo, filtro) {
  // fatos do(s) relato(s) da cultura cujo escopo toca o alvo (município, região ou estado)
  const alvo = cdsAlvo ? new Set(cdsAlvo) : null, todos = [];
  for (const r of RELATOS) if (!filtro || filtro(r)) for (const f of r.fatos || []) if ((!cid || f.cid === cid) && (!alvo || f.escopo.some(cd => alvo.has(cd)))) todos.push(f);
  if (!todos.length) return null;
  const obs = [], cruz = [], porRel = new Map(); todos.forEach(f => { if (!porRel.has(f.rel)) porRel.set(f.rel, []); porRel.get(f.rel).push(f); });
  const nomeM = cds => cds.length > 3 ? `${cds.length} municípios do roteiro` : cds.map(cd => MUN_IDX[cd]?.properties.NM_MUN).filter(Boolean).join(', ');
  for (const [rel, fs] of porRel) {
    const regiao = [...new Set(fs.filter(f => f.tipoEsc === 'regiao').flatMap(f => f.escopo))];
    const c = cultDaData(cid || fs[0].cid, rel.data), cid2 = cid || fs[0].cid, nomeC = (CULT[cid2] || OUTRA).nome.toLowerCase(), dt = rel.data;
    const um = (cat) => fs.filter(f => f.cat === cat), tem = cat => um(cat).length > 0;
    // 1. o que o relato diz (resumo por tema)
    const pl = um('plantio'), at = um('atraso'), par = um('paralisacao'), rp = um('replantio'), cv = um('conversao'), ar = um('area'), cl = um('clima'), pg = um('pragas'), es = um('estadio'), pz = um('prazo');
    if (pl.length) obs.push(`Plantio relatado: <b>${pl.map(f => f.pct + '%').join(', ')}</b> da área prevista (${f0(pl[0])}).`);
    if (at.length) obs.push(`Atraso de plantio${at[0].min != null ? ` de <b>${at[0].min}${at[0].max !== at[0].min ? ' a ' + at[0].max : ''}%</b>` : ''} em relação ao esperado${par.length ? `, com <b>${par[0].dias} dias</b> de operações paradas` : ''} (${f0(at[0])}).`);
    else if (par.length) obs.push(`Operações paradas por <b>${par[0].dias} dias</b> (${f0(par[0])}).`);
    if (cl.length) obs.push(`Clima citado: ${[...new Set(cl.map(f => ROT_CLIMA[f.tipo]))].join(', ')}.`);
    if (pg.length) { const it = [...new Set(pg.flatMap(f => f.itens))]; obs.push(`Problemas fitossanitários: ${it.join(', ')}${pg.some(f => f.nivel) ? ` (intensidade ${[...new Set(pg.map(f => f.nivel).filter(Boolean))].join('/')})` : ''}.`); }
    if (rp.length) obs.push(`Replantio: <b>${fmtHa(rp[0].ha)}</b>.`);
    if (es.length) obs.push(`Estádios observados: ${[...new Set(es.flatMap(f => f.itens))].join(', ')}.`);
    if (cv.length) cv.forEach(f => obs.push(`Mudança de uso: ${nomeC} perdendo área para ${f.para}${f.min ? ` (${fmtHa(f.min)}${f.max && f.max !== f.min ? ' a ' + fmtHa(f.max) : ''})` : ''} em ${nomeM(f.escopo)}.`));
    if (ar.length) { const ant = ar.find(f => f.anterior), atu = ar.find(f => !f.anterior);
      if (ant || atu) obs.push(`Área: ${ant ? `safra anterior ~${fmtHa(ant.ha)}` : ''}${ant && atu ? ' → ' : ''}${atu ? `estimativa atual ~${fmtHa(atu.ha)}` : ''}${ant && atu ? ` (<b>${atu.ha > ant.ha ? '+' : ''}${n0(100 * (atu.ha - ant.ha) / ant.ha)}%</b>)` : ''}.`); }
    if (pz.length) obs.push(`Prazo citado para o plantio: até ${fmtDL(pz[0].data)}.`);
    if (tem('credito')) obs.push('Financiamento: relatos sobre crédito (cooperativas, revendas, garantias e juros).');
    // 2. cruzamentos
    const escp = regiao.length ? regiao : [...new Set(fs.flatMap(f => f.escopo))], onde = regiao.length ? `nos ${regiao.length} municípios do roteiro` : `em ${nomeM(escp)}`;
    if (c && !c.semFenologia) {
      const j = semanaDe(c, dt), sub = {mun: Object.fromEntries(escp.filter(cd => c.mun[cd]).map(cd => [cd, c.mun[cd]]))}, nSub = Object.keys(sub.mun).length;
      const pRel = nSub ? mediaMS(sub, m => acum(m.serie, j)) : null, pEst = mediaMS(c, m => acum(m.serie, j)), pAnt = nSub ? mediaMS(sub, m => acum(m.serie, j - 2)) : null;
      if (pRel) {
        let t = `Planilha da equipe na semana do relato (${fmtD(dataSem(c, j))}): <b>${pRel.v.toFixed(0)}%</b> plantado ${onde} (estado: ${pEst ? pEst.v.toFixed(0) : '—'}%).`;
        if (pl.length) { const d = pl[0].pct - pRel.v; t += Math.abs(d) <= 12 ? ` <span class="tag ok">coerente</span> com os ${pl[0].pct}% do relato.` : ` <span class="tag div">diverge</span> dos ${pl[0].pct}% do relato (${d > 0 ? '+' : ''}${d.toFixed(0)} p.p.): conferir a planilha ou o escopo do relato.`; }
        if (at.length && pEst) t += pRel.v < pEst.v - 5 ? ` A região está ${(pEst.v - pRel.v).toFixed(0)} p.p. atrás da média do estado, <span class="tag ok">coerente</span> com o atraso relatado.` : ` Na planilha, a região não aparece atrás do estado (${pRel.v.toFixed(0)}% × ${pEst.v.toFixed(0)}%): o atraso relatado pode ser em relação ao calendário usual, não aos demais municípios.`;
        // ritmo e prazo
        if (pAnt && pRel.v < 100) { const ritmo = (pRel.v - pAnt.v) / 2;
          if (ritmo > .5) { const sem = Math.ceil((95 - pRel.v) / ritmo), fim = addD(dataSem(c, j), 7 * sem);
            t += ` No ritmo das últimas duas semanas (~${ritmo.toFixed(0)} p.p./semana), a região chegaria a 95% por volta de <b>${fmtD(fim)}</b>.`;
            if (pz.length) t += fim > pz[0].data ? ` <span class="tag div">atenção</span>: depois do prazo de ${fmtD(pz[0].data)} citado no relato.` : ` <span class="tag ok">dentro</span> do prazo de ${fmtD(pz[0].data)} citado no relato.`;
          } else t += ' A planilha mostra pouco avanço nas últimas duas semanas na região.'; }
        cruz.push(t);
        // estádios observados × projeção
        if (es.length) { const dist = new Array(c.estadios.length).fill(0); let sw = 0; for (const m of Object.values(sub.mun)) { const w = m.area || 1; sw += w; distrib(c, m, j).forEach((v, i) => dist[i] += v * w); }
          const top = dist.map((v, i) => [v / sw, c.estadios[i].nome]).filter(x => x[0] >= 5).map(x => `${x[1]} ${x[0].toFixed(0)}%`).join('; ');
          if (top) cruz.push(`Estádios relatados (${[...new Set(es.flatMap(f => f.itens))].join(', ')}) × projeção da planilha para a área semeada na região: ${top}. ${es.some(f => f.itens.some(x => /^V/.test(x))) && /Vegetativo|V\d/i.test(top) ? '<span class="tag ok">coerente</span>' : 'Comparar no campo a defasagem entre talhões.'}`); }
      }
      // replantio em proporção da área
      if (rp.length) { const aReg = escp.reduce((t, cd) => t + (c.mun[cd]?.area || 0), 0) || (soloCultura(cid2, null)?.area || 0);
        if (aReg) cruz.push(`O replantio de ${fmtHa(rp[0].ha)} equivale a <b>${n1(100 * rp[0].ha / aReg)}%</b> da área de ${nomeC} ${onde} (${fmtHa(aReg)} na planilha): perda pontual, como diz o relato.`); }
    }
    // clima relatado × dados
    if (cl.length && CL) { const cj = climaJanela(escp, dt, 30); const tipos = new Set(cl.map(f => f.tipo));
      if (cj) { const sal = cj.p - cj.e;
        let t = `Clima nos 30 dias até ${fmtD(dt)} ${onde} (estimativa do modelo): <b>${cj.p.toFixed(0)} mm</b> de chuva para ${cj.e.toFixed(0)} mm de ET0 (saldo ${sal > 0 ? '+' : ''}${sal.toFixed(0)} mm), ${cj.dch} dias com chuva e até ${cj.maxSeq} dias seguidos chovendo.`;
        if (tipos.has('excesso')) t += cj.p > cj.e * 1.2 || cj.dch >= 12 || cj.maxSeq >= 4 ? ' <span class="tag ok">confirma</span> o excesso de chuva relatado.' : ' <span class="tag div">diverge</span>: o modelo não mostra chuva acima do normal; o excesso pode ter sido localizado (conferir estações INMET próximas).';
        if (tipos.has('falta')) t += sal < -30 || cj.dch <= 4 ? ' <span class="tag ok">confirma</span> a falta de chuva relatada.' : ' <span class="tag div">diverge</span>: o modelo indica chuva suficiente no período; o déficit pode ser localizado ou de distribuição.';
        if (tipos.has('radiacao')) t += ` Com ${cj.dch} dias de chuva em ${cj.dias}, a nebulosidade citada é plausível (o painel não mede radiação diretamente).`;
        if (tipos.has('excesso') && (tem('pragas') && pg.some(f => f.itens.some(x => /lesma|caramujo|mofo|antracnose|ferrugem/.test(x))))) t += ' Umidade alta e prolongada favorece lesmas, caramujos e doenças fúngicas: o quadro relatado é consistente com o clima.';
        cruz.push(t); } }
    // mudança de uso × mapas
    for (const f of cv) { const cd = f.escopo.length === 1 ? f.escopo[0] : null, nm = cd ? MUN_IDX[cd]?.properties.NM_MUN : null;
      const eu = cd ? soloClasse('Eucalipto', cd)?.area : null, sj = cd ? soloCultura(cid2, cd)?.area : null;
      if (cd && (eu || sj)) cruz.push(`Nos mapas de uso, ${esc(nm)} tem ${eu ? fmtHa(eu) + ' de eucalipto' : 'pouco eucalipto mapeado'}${sj ? ` e ${fmtHa(sj)} de ${nomeC}` : ''}.${sj && f.max ? ` A conversão relatada (${fmtHa(f.min)}${f.max !== f.min ? '–' + fmtHa(f.max) : ''}) equivale a <b>${n0(100 * f.min / sj)}${f.max !== f.min ? '–' + n0(100 * f.max / sj) : ''}%</b> da área de ${nomeC} mapeada no município: <span class="tag novo">verificar</span> no próximo mapeamento.` : ''}`); }
    // área relatada × planilha
    if (ar.length && c && !c.semFenologia) { const atu = ar.find(f => !f.anterior), tot = Object.values(c.mun).reduce((t, m) => t + (m.area || 0), 0);
      if (atu && tot) cruz.push(`Área estimada no relato (~${fmtHa(atu.ha)}) × área informada na planilha para ${nomeC} (${fmtHa(tot)}): ${Math.abs(atu.ha - tot) / tot <= .15 ? '<span class="tag ok">coerente</span>' : `<span class="tag div">diferença de ${n0(100 * (atu.ha - tot) / tot)}%</span>: revisar a área da planilha ou a abrangência do relato`}.`); }
    // economia: ponto de equilíbrio
    const cu = um('custo').find(f => f.valor), pr = um('preco')[0], pd = um('produtividade')[0];
    if (cu && pr) { const kgNec = cu.valor / pr.valor * pr.kgSaca, scNec = kgNec / 60;
      let t = `Ponto de equilíbrio pelos números do relato: custo de R$ ${n0(cu.valor)}/ha ÷ R$ ${pr.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} por ${pr.unid === 'kg' ? 'kg' : `saca de ${pr.kgSaca} kg`} = <b>${n0(kgNec)} kg/ha</b> (${n0(scNec)} sc de 60 kg).`;
      if (pd) { const kg = pd.unid === 'kg/ha' ? pd.valor : pd.valor * 60, marg = (kg / pr.kgSaca) * pr.valor - cu.valor, precoEq = cu.valor / (kg / pr.kgSaca);
        t += ` Com a produtividade citada (${n0(kg)} kg/ha), a margem fica em <b>R$ ${n0(marg)}/ha</b> e o preço de equilíbrio seria R$ ${precoEq.toLocaleString('pt-BR', {maximumFractionDigits: 2})} por ${pr.unid === 'kg' ? 'kg' : 'saca'}. <span class="tag novo">indicador</span> de pressão sobre a área da próxima safra.`; }
      cruz.push(t); }
  }
  return {obs: [...new Set(obs)], cruz: [...new Set(cruz)], rels: [...porRel.keys()]};
  function f0(f) { return f.tipoEsc === 'mun' ? nomeM(f.escopo) : `relato regional, ${f.escopo.length} municípios`; }
}
function htmlCruzRelatos(cid, cds, titulo = 'Relatos de campo: leitura e cruzamento com o painel') {
  const r = cruzarRelatos(cid, cds); if (!r) return '';
  return `<h4>${titulo}</h4><div class="nota" style="margin-top:0">${r.rels.map(x => `${esc(x.nome)} (${fmtD(x.data)})`).join(' · ')}</div>
    ${r.obs.length ? `<p style="margin-bottom:2px"><b>O que o relato registra</b></p><ul class="lista-rel">${r.obs.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${r.cruz.length ? `<p style="margin-bottom:2px"><b>Cruzamento com os dados do painel</b></p><ul class="lista-rel">${r.cruz.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    <div class="nota">Leitura automática por regras (números, termos de clima, pragas, mercado e municípios citados). Confira o texto original do relato.</div>`;
}
function trechos(rel, nomeMun, cid, max = 2) {
  const frases = rel.texto.split(/(?<=[.!?;])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 25);
  const reM = new RegExp(semAcento(nomeMun).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), ps = PALAVRAS_CULT[cid] || [];
  const pont = s => (reM.test(semAcento(s)) ? 2 : 0) + (ps.some(p => norm(s).includes(p)) ? 1 : 0);
  return frases.map(s => [pont(s), s]).filter(x => x[0] >= 2).sort((a, b) => b[0] - a[0]).slice(0, max).map(x => x[1].length > 320 ? x[1].slice(0, 317) + '…' : x[1]);
}

// =====================================================================
// PASTA DA EQUIPE
// =====================================================================
const idb = () => new Promise((ok, er) => { const r = indexedDB.open('painel-safra', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => ok(r.result); r.onerror = er; });
async function guardarPasta(h) { try { const db = await idb(); db.transaction('h', 'readwrite').objectStore('h').put(h, 'pasta'); } catch (e) {} }
async function lerGuardada() { try { const db = await idb(); return await new Promise(ok => { const q = db.transaction('h').objectStore('h').get('pasta'); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); }); } catch (e) { return null; } }
async function* percorrer(dir, cam = '') { for await (const [n, h] of dir.entries()) { if (h.kind === 'file') yield {caminho: cam + n, obter: () => h.getFile()}; else yield* percorrer(h, cam + n + '/'); } }
async function processarArquivos(lista, nomePasta) {
  arquivosPasta = lista;
  const st = $('st-pasta'), ext = a => a.caminho.toLowerCase().split('.').pop(), tmp = a => /(^|\/)~\$|(^|\/)\./.test(a.caminho);
  const planilhas = lista.filter(a => ['xlsx', 'xls'].includes(ext(a)) && /plantio|evolu/i.test(norm(a.caminho)) && !/modelo|template/i.test(norm(a.caminho.split('/').pop())) && !tmp(a));
  const fotos = lista.filter(a => ['jpg', 'jpeg', 'png', 'webp'].includes(ext(a)) && !tmp(a));
  const heic = lista.filter(a => ext(a) === 'heic').length;
  const relatos = lista.filter(a => ['docx', 'odt', 'txt', 'md', 'pdf'].includes(ext(a)) && !tmp(a));
  const plUsinas = lista.filter(a => ['xlsx', 'xlsm', 'xls'].includes(ext(a)) && /usina/.test(norm(a.caminho)) && !/plantio|evolu/.test(norm(a.caminho.split('/').pop())) && !tmp(a));
  const linhas = [`<b>${esc(nomePasta)}</b> · ${lista.length} arquivos`];
  // todas as planilhas (uma por safra); se houver duas da mesma safra, vale a salva por último
  PL = {}; const origem = {};
  for (const a of planilhas) {
    try { const f = await a.obter(), C = lerPlanilha(await f.arrayBuffer()), s = rotuloSafra(f.name, C);
      if (!origem[s] || f.lastModified > origem[s].t) { PL[s] = C; origem[s] = {t: f.lastModified, nome: f.name}; } }
    catch (e) { linhas.push(`Não foi possível ler ${esc(a.caminho)}: ${esc(e.message)}`); }
  }
  const safras = Object.keys(PL).sort();
  if (safras.length) { linhas.push('Planilhas: ' + safras.map(s => `${s} (${esc(origem[s].nome)}, salva ${fmtD(new Date(origem[s].t))})`).join('; ')); montarControlesCult(); }
  else { PL = null; linhas.push('Nenhuma planilha de plantio (o nome deve conter “plantio” ou “evolução”).'); }
  linhas.push(`Fotos: ${fotos.length}${heic ? ` · ${heic} HEIC não suportadas (converta para JPG)` : ''} · Relatos: ${relatos.length}`);
  st.innerHTML = linhas.join('<br>');
  $('bt-pasta').textContent = 'Recarregar pasta';
  carregarFotos(fotos);
  carregarRelatos(relatos);
  carregarUsinas(plUsinas);
}
$('bt-pasta').onclick = async () => {
  const st = $('st-pasta');
  try {
    if (window.showDirectoryPicker) {
      let h = await lerGuardada();
      if (!(h && (await h.requestPermission({mode: 'read'})) === 'granted')) h = await showDirectoryPicker({id: 'painel-safra', mode: 'read'});
      await guardarPasta(h); st.textContent = 'Lendo pasta…';
      const lista = []; for await (const a of percorrer(h)) lista.push(a);
      await processarArquivos(lista, h.name);
    } else $('inp-pasta').click();
  } catch (e) { if (e.name !== 'AbortError') st.textContent = 'Não foi possível abrir a pasta: ' + e.message; }
};
$('inp-pasta').onchange = e => { const fs = [...e.target.files]; processarArquivos(fs.map(f => ({caminho: f.webkitRelativePath || f.name, obter: async () => f})), (fs[0]?.webkitRelativePath || '').split('/')[0] || 'pasta'); };
lerGuardada().then(h => { if (h) $('bt-pasta').textContent = 'Reconectar “' + h.name + '”'; });

// =====================================================================
// MUNICÍPIO: ficha e análise agronômica
// =====================================================================
let abaFicha = 'geral';
const ESTADO = {estado: true};
// seleção de vários municípios (Ctrl + clique): a ficha e a análise passam a valer para a região escolhida
const REGIAO = {regiao: true};
let SELECAO = [], CDS_ALVO = null;   // CDS_ALVO: códigos da região selecionada (null = estado inteiro)
const nomeAlvo = () => CDS_ALVO ? `Região selecionada (${CDS_ALVO.length} municípios)` : 'Mato Grosso do Sul';
const ondeAlvo = () => CDS_ALVO ? 'na região selecionada' : 'no estado';
function cultAlvo() { const c = cultAtual(); if (!c || !CDS_ALVO) return c; const sel = new Set(CDS_ALVO); return {...c, mun: Object.fromEntries(Object.entries(c.mun).filter(([cd]) => sel.has(cd)))}; }
function selecionar(f, somar) {
  if (somar && f !== ESTADO) {
    const atual = selecionado === REGIAO ? SELECAO : (selecionado && selecionado !== ESTADO ? [selecionado] : []);
    SELECAO = atual.includes(f) ? atual.filter(x => x !== f) : [...atual, f];
    if (SELECAO.length === 1) return selecionar(SELECAO[0]);
    if (!SELECAO.length) { $('f-fechar').onclick(); return; }
    CDS_ALVO = SELECAO.map(x => String(+x.properties.CD_MUN)); selecionado = REGIAO;
    if (camDestaque) mapa.removeLayer(camDestaque);
    camDestaque = L.geoJSON({type: 'FeatureCollection', features: SELECAO}, {pane: 'destaque', interactive: false, style: {fill: false, color: getComputedStyle(document.documentElement).getPropertyValue('--acento2').trim() || '#b5882c', weight: 3}}).addTo(mapa);
    abrirFicha(REGIAO); return;
  }
  SELECAO = []; CDS_ALVO = null;
  selecionado = f;
  if (camDestaque) mapa.removeLayer(camDestaque);
  if (f === ESTADO) { camDestaque = null; abrirFicha(f); return; }
  camDestaque = L.geoJSON(f, {pane: 'destaque', interactive: false, style: {fill: false, color: getComputedStyle(document.documentElement).getPropertyValue('--acento2').trim() || '#b5882c', weight: 3}}).addTo(mapa);
  abrirFicha(f);
  Object.keys(CAM).filter(k => k.startsWith('u_') && CAM[k].on).forEach(atualizarSub);
}
$('f-fechar').onclick = () => { $('ficha').hidden = true; selecionado = null; SELECAO = []; CDS_ALVO = null; if (camDestaque) mapa.removeLayer(camDestaque); };
document.querySelectorAll('.abas button').forEach(b => b.onclick = () => { abaFicha = b.dataset.a; document.querySelectorAll('.abas button').forEach(x => x.classList.toggle('on', x === b)); $('f-geral').hidden = abaFicha !== 'geral'; $('f-analise').hidden = abaFicha !== 'analise'; abrirFicha(selecionado, true); });
async function abrirFicha(f, manter) {
  if (!f) return;
  $('ficha').hidden = false;
  if (f === ESTADO || f === REGIAO) {
    $('f-nome').textContent = nomeAlvo();
    $('f-sub').innerHTML = f === REGIAO ? `${esc(SELECAO.map(x => x.properties.NM_MUN).join(', '))}<br><span style="opacity:.8">Ctrl + clique soma ou retira municípios</span>` : `Visão estadual · ${dadosMun.features.length} municípios · Ctrl + clique no mapa seleciona uma região`;
    await garantirClima();
    if (abaFicha === 'geral') { $('f-geral').innerHTML = htmlGeralEstado(); const b = $('bt-clima'); if (b) b.onclick = () => abrirClima(f); }
    else { $('f-analise').innerHTML = '<div class="nota">Calculando a análise de todos os municípios…</div>'; setTimeout(() => { $('f-analise').innerHTML = `<div class="analise">${gerarAnaliseEstado()}</div>`; ligarCopiar(); }, 30); }
    return;
  }
  const p = f.properties;
  $('f-nome').textContent = p.NM_MUN; $('f-sub').textContent = `IBGE ${p.CD_MUN} · ${p.NM_RGI || ''}${p.AREA_KM2 ? ' · ' + Number(p.AREA_KM2).toLocaleString('pt-BR') + ' km²' : ''} · Ctrl + clique em outro município para analisar uma região`;
  await garantirClima();
  if (abaFicha === 'geral') { $('f-geral').innerHTML = htmlGeral(f); const b = $('bt-clima'); if (b) b.onclick = () => abrirClima(f); }
  else $('f-analise').innerHTML = `<div class="analise">${gerarAnalise(f)}</div>`;
}
// gráfico de chuva (barras) e temperaturas máxima/mínima (linhas) num intervalo de dias [a, b)
function graficoClima(m, a, b, W = 300, H = 90) {
  const DT = m.datas || CL.datas, h = m.datas ? DT.length : iHoje(); a = Math.max(0, a ?? h - 30); b = Math.min(DT.length, b ?? h);
  const idx = [...Array(b - a).keys()].map(i => i + a);
  const bw = W / idx.length, pm = Math.max(20, ...idx.map(i => m.p[i] || 0));
  const tmin = Math.min(...idx.map(i => m.tn[i] ?? 99)) - 2, tmax = Math.max(...idx.map(i => m.tx[i] ?? 0)) + 2;
  const y = t => H - (t - tmin) / (tmax - tmin) * H, lin = k => idx.map((i, j) => m[k][i] == null ? '' : `${j ? 'L' : 'M'}${((j + .5) * bw).toFixed(1)},${y(m[k][i]).toFixed(1)}`).join('');
  return `<svg class="graf" viewBox="0 0 ${W} ${H + 28}" width="100%" font-size="10" style="overflow:visible">
    ${idx.map((i, j) => { const p = m.p[i] || 0, hh = H * .6 * p / pm; return `<rect x="${(j * bw + .5).toFixed(1)}" y="${(H - hh).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${hh.toFixed(1)}" fill="#2171b5"><title>${fmtD(deISO(DT[i]))}: ${n1(p)} mm · ${n1(m.tn[i])} a ${n1(m.tx[i])} °C</title></rect>`; }).join('')}
    <path d="${lin('tx')}" fill="none" stroke="#d9472b" stroke-width="1.5"/><path d="${lin('tn')}" fill="none" stroke="#3b6fb6" stroke-width="1.5"/>
    <line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="#bbb"/>
    <text x="0" y="${H + 12}">${fmtD(deISO(DT[a]))}</text><text x="${W}" y="${H + 12}" text-anchor="end">${fmtD(deISO(DT[b - 1]))}</text>
    <text x="0" y="${H + 25}"><tspan fill="#2171b5">■ chuva (máx ${pm.toFixed(0)} mm)</tspan></text><text x="${W}" y="${H + 25}" text-anchor="end"><tspan fill="#d9472b">— máx</tspan> <tspan fill="#3b6fb6">— mín</tspan> ${tmin.toFixed(0)}–${tmax.toFixed(0)} °C</text></svg>`;
}
// ------------------------------------------------- previsão por vários modelos (média, faixa e concordância)
const nomeMod = k => CL?.modelos?.[k] || k.toUpperCase();
function totaisModelos(mc, i0, i1) {   // chuva acumulada de cada modelo que cobre todos os dias do intervalo
  if (!mc.mod) return null; const r = {};
  for (const [k, s] of Object.entries(mc.mod)) { const v = s.slice(i0, i1); if (v.length < i1 - i0 || v.some(x => x == null)) continue; r[k] = v.reduce((t, x) => t + x, 0); }
  return Object.keys(r).length ? r : null;
}
function concordancia(tot) {   // convenção do painel: amplitude entre modelos frente à média
  const v = tot ? Object.values(tot) : []; if (v.length < 2) return null;
  const mn = Math.min(...v), mx = Math.max(...v), md = v.reduce((t, x) => t + x, 0) / v.length, amp = mx - mn;
  return {mn, mx, md, amp, n: v.length, nivel: amp <= Math.max(10, .4 * md) ? 'alta' : amp <= Math.max(20, .8 * md) ? 'média' : 'baixa'};
}
const COR_CONC = {alta: '#3f9a4c', 'média': '#d9a21b', baixa: '#c0502a'};
function txtConc(cc) { return cc ? `<span class="conc" style="background:${COR_CONC[cc.nivel]}">concordância ${cc.nivel}</span>` : ''; }
function graficoPrevisao(mc, W = 300, H = 92) {
  const h = iHoje(), b = CL.datas.length, idx = [...Array(b - h).keys()].map(i => i + h); if (!idx.length) return '';
  const bw = W / idx.length, pm = Math.max(20, ...idx.map(i => mc.p_max?.[i] ?? mc.p[i] ?? 0));
  const y = v => H - H * .92 * v / pm;
  return `<svg class="graf" viewBox="0 0 ${W} ${H + 28}" width="100%" font-size="10" style="overflow:visible">
    ${[.25, .5, .75].map(t => `<line x1="0" x2="${W}" y1="${y(pm * t).toFixed(1)}" y2="${y(pm * t).toFixed(1)}" stroke="currentColor" opacity=".07"/>`).join('')}
    ${idx.map((i, j) => { const p = mc.p[i] || 0, n = mc.n_mod?.[i], x = j * bw, xc = x + bw / 2, lo = mc.p_min?.[i], hi = mc.p_max?.[i];
      const barra = `<rect x="${(x + bw * .18).toFixed(1)}" y="${y(p).toFixed(1)}" width="${(bw * .64).toFixed(1)}" height="${(H - y(p)).toFixed(1)}" fill="#2171b5" opacity="${n != null && n <= 2 ? .4 : .85}"/>`;
      const faixa = lo != null && hi > lo ? `<line x1="${xc.toFixed(1)}" x2="${xc.toFixed(1)}" y1="${y(lo).toFixed(1)}" y2="${y(hi).toFixed(1)}" stroke="currentColor" stroke-width="1.2" opacity=".55"/><line x1="${(xc - bw * .2).toFixed(1)}" x2="${(xc + bw * .2).toFixed(1)}" y1="${y(hi).toFixed(1)}" y2="${y(hi).toFixed(1)}" stroke="currentColor" opacity=".55"/>` : '';
      return `<g>${barra}${faixa}<rect x="${x.toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent"><title>${fmtD(deISO(CL.datas[i]))}: média ${n1(p)} mm${lo != null ? ` · modelos entre ${n1(lo)} e ${n1(hi)} mm (${n} modelo${n > 1 ? 's' : ''})` : ''}</title></rect></g>`; }).join('')}
    <line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="#bbb"/>
    <text x="0" y="${H + 12}">hoje</text><text x="${W / 2}" y="${H + 12}" text-anchor="middle">${fmtD(deISO(CL.datas[h + Math.floor(idx.length / 2)]))}</text><text x="${W}" y="${H + 12}" text-anchor="end">${fmtD(deISO(CL.datas[b - 1]))}</text>
    <text x="0" y="${H + 25}"><tspan fill="#2171b5">■ chuva, média dos modelos</tspan><tspan> · ┃ faixa entre modelos · barra clara: 1–2 modelos</tspan></text></svg>`;
}
// série ponderada de vários municípios (estado): médias diárias e, por modelo, chuva média; faixa entre modelos
function climaPonderado(pesos) {
  const cds = Object.keys(pesos).filter(cd => CL.mun[cd]); if (!cds.length) return null;
  const med = s => CL.datas.map((_, i) => { let sw = 0, sv = 0; for (const cd of cds) { const v = s(CL.mun[cd])?.[i]; if (v == null) continue; sw += pesos[cd]; sv += pesos[cd] * v; } return sw ? sv / sw : null; });
  const out = {}; for (const k of ['p', 'tx', 'tn', 'et0']) out[k] = med(m => m[k]);
  const mods = Object.keys(CL.mun[cds[0]].mod || {});
  if (mods.length) { out.mod = {}; for (const k of mods) out.mod[k] = med(m => m.mod?.[k]);
    out.p_min = CL.datas.map((_, i) => { const v = mods.map(k => out.mod[k][i]).filter(x => x != null); return v.length ? Math.min(...v) : null; });
    out.p_max = CL.datas.map((_, i) => { const v = mods.map(k => out.mod[k][i]).filter(x => x != null); return v.length ? Math.max(...v) : null; });
    out.n_mod = CL.datas.map((_, i) => mods.filter(k => out.mod[k][i] != null).length); }
  return {mc: out, cds, pesos};
}
// resumo compacto na visão geral (o detalhe abre na janela de clima)
function htmlClimaResumo(mc, bh, c, kpi3) {
  const h0 = iHoje(), s = (i0, i1) => mc.p.slice(Math.max(0, i0), i1).reduce((t, x) => t + (x || 0), 0), cc = concordancia(totaisModelos(mc, h0, h0 + 7));
  const k = bh ? (bh.campoAtual > 0 ? classeKs(bh.ksAtual) : -1) : null;
  let h = `<h3>Clima e água no solo</h3><div class="kpis"><div class="kpi"><b>${s(h0 - 30, h0).toFixed(0)} mm</b><span>chuva 30 dias (estimativa)</span></div><div class="kpi"><b>${s(h0, h0 + 15).toFixed(0)} mm</b><span>previsão 15 dias${cc ? `<br>concordância ${cc.nivel}` : ''}</span></div>`;
  h += kpi3 ? kpi3 : bh && bh.atual != null ? `<div class="kpi"><b style="color:${k == null || k < 0 ? 'var(--tinta)' : CLS_AG[k].cor}">${n0(bh.atual)}%</b><span>água no solo · ${k == null || k < 0 ? 'sem lavoura em campo' : CLS_AG[k].nome.toLowerCase()}</span></div>` : `<div class="kpi"><b>${diasSecos(mc)}</b><span>dias sem chuva</span></div>`;
  h += `</div>`;
  if (mc.tn.slice(h0, h0 + 15).some(t => t != null && t <= 3)) h += `<div style="color:var(--alerta);font-weight:600;font-size:12.5px">⚠ Previsão de mínima ≤ 3 °C: risco de geada</div>`;
  return h + `<button class="btn sec2" id="bt-clima" style="margin-top:8px">Abrir clima e água no solo</button>`;
}
// ------------------------------------------------- janela de clima (município ou estado)
function pesosAlvo(c) {   // pesos do clima ponderado: área da cultura no estado/região; sem cultura, todos os municípios do alvo
  const pesos = {}; if (c) for (const [k, m] of Object.entries(c.mun)) pesos[k] = m.area || 1;
  else for (const k of (CDS_ALVO || Object.keys(CL.mun))) if (CL.mun[k]) pesos[k] = 1;
  return pesos;
}
function htmlJanelaClima(alvo) {
  const c = cultAlvo(), h0 = iHoje(), est = alvo === ESTADO || alvo === REGIAO;
  let mc, cd = null, f = null;
  if (est) mc = climaPonderado(pesosAlvo(c))?.mc;
  else { f = alvo; cd = String(+f.properties.CD_MUN); mc = CL.mun[cd]; }
  if (!mc) return '<p>Sem dados de clima para este local.</p>';
  const soma = (k, i0, i1) => mc[k].slice(Math.max(0, i0), i1).reduce((t, x) => t + (x || 0), 0);
  const fat = est ? null : fatorET0(...centroMun(cd), 'previsao');
  const out = [];
  // 1. previsão
  const t7 = totaisModelos(mc, h0, h0 + 7), t15 = totaisModelos(mc, h0, h0 + 15), c7 = concordancia(t7), c15 = concordancia(t15);
  let tp = `<p>Próximos 7 dias: <b>${soma('p', h0, h0 + 7).toFixed(0)} mm</b>${c7 ? ` (modelos entre ${c7.mn.toFixed(0)} e ${c7.mx.toFixed(0)} mm) ${txtConc(c7)}` : ''}<br>Próximos 15 dias: <b>${soma('p', h0, h0 + 15).toFixed(0)} mm</b>${c15 ? ` (entre ${c15.mn.toFixed(0)} e ${c15.mx.toFixed(0)} mm, ${c15.n} modelos cobrem os 15 dias) ${txtConc(c15)}` : ''}</p>`;
  if (mc.mod) {
    const ks = Object.keys(mc.mod);
    tp += `<table class="tab-ag"><tr><th>Modelo</th><th>7 dias</th><th>15 dias</th></tr>${ks.map(k => `<tr><td>${esc(nomeMod(k))}</td><td>${t7?.[k] != null ? t7[k].toFixed(0) + ' mm' : '—'}</td><td>${t15?.[k] != null ? t15[k].toFixed(0) + ' mm' : '—'}</td></tr>`).join('')}<tr><td><b>Média usada no painel</b></td><td><b>${soma('p', h0, h0 + 7).toFixed(0)} mm</b></td><td><b>${soma('p', h0, h0 + 15).toFixed(0)} mm</b></td></tr></table>
      <div class="nota">“—”: o modelo não cobre o período inteiro (ICON e UKMO vão até ~7 dias; GEM, 10; JMA, 11; ECMWF, 15; GFS, 16). A média de cada dia usa os modelos disponíveis naquele dia. Concordância (convenção do painel): alta quando a diferença entre o modelo mais chuvoso e o mais seco é de até 40% da média (ou 10 mm); baixa quando passa de 80% (ou 20 mm).</div>`;
  } else tp += `<div class="nota">A comparação entre modelos aparece a partir da próxima atualização automática dos dados.</div>`;
  const tx = mc.tx.slice(h0, h0 + 15).filter(x => x != null), tn = mc.tn.slice(h0, h0 + 15).filter(x => x != null);
  tp += `<p>Temperaturas previstas (média dos modelos): máximas até ${tx.length ? n1(Math.max(...tx)) : '—'} °C, mínimas a partir de ${tn.length ? n1(Math.min(...tn)) : '—'} °C. ET0 prevista: ${soma('et0', h0, h0 + 15).toFixed(0)} mm em 15 dias${fat && Math.abs(fat.f - 1) >= .03 ? ` (${(soma('et0', h0, h0 + 15) * fat.f).toFixed(0)} mm após o ajuste pelas estações INMET)` : ''}.</p>`;
  out.push(`<section class="jc"><h3>Previsão (16 dias)</h3>${graficoPrevisao(mc, 470, 110)}${graficoClima(mc, h0, CL.datas.length, 470, 80)}${tp}</section>`);
  // 2. histórico: período escolhido pelo usuário (padrão: últimos 30 dias); preenchido depois por atualizarHist()
  const ontem = deISO(CL.datas[h0 - 1]), ini0 = HIST_PER?.ini || new Date(ontem.getTime() - 29 * 864e5), fim0 = HIST_PER?.fim || ontem;
  out.push(`<section class="jc"><h3>Histórico</h3><div class="hist-per"><label>De <input type="date" id="hp-ini" min="${INICIO_HIST}" max="${CL.datas[h0 - 1]}" value="${isoD(ini0)}"></label><label>até <input type="date" id="hp-fim" min="${INICIO_HIST}" max="${CL.datas[h0 - 1]}" value="${isoD(fim0)}"></label>
    <span class="seg">${[15, 30, 60, 90].map(n => `<button data-n="${n}">${n} d</button>`).join('')}${c && !c.semFenologia ? '<button data-n="safra">Safra</button>' : ''}</span></div><div id="jc-hist"><p class="nota">Carregando…</p></div></section>`);
  // 3. água no solo
  if (!c) out.push(`<section class="jc larga"><h3>Água no solo</h3><p>Escolha uma cultura em “Safra e cultura” para ver o balanço hídrico.</p></section>`);
  else if (est) out.push(`<section class="jc larga">${htmlAguaEstado(c)}</section>`);
  else { const m = c.mun[cd]; out.push(`<section class="jc larga">${m ? htmlAgua(f, c, m, mc, 900) : `<h3>Água no solo · ${esc(c.nome)}</h3><p>Sem ${esc(c.nome.toLowerCase())} ${c.semFenologia ? 'mapeada' : 'na planilha'} para este município.</p>`}</section>`); }
  return `<div class="janela-clima">${out.join('')}</div><div class="nota" style="margin-top:10px">${esc(CL.fonte || 'Open-Meteo')} Atualizado em ${new Date(CL.gerado).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}.</div>`;
}
// ---------- histórico de clima por período escolhido ----------
const INICIO_HIST = '2025-07-01';   // início do histórico permanente (scripts/clima.py)
let HIST_PER = null;                // período escolhido (mantido enquanto a página estiver aberta)
const isoD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
async function serieHist(ini, fim, pesos) {   // série diária ponderada {datas, p, tx, tn, et0, fonte}
  const dias = await climaDiario(ini, fim), cds = Object.keys(pesos), s = {datas: [], p: [], tx: [], tn: [], et0: [], fonte: []};
  for (const d of Object.keys(dias).sort()) { const D = dias[d]; if (D.fonte === 'previsão') continue; const v = {p: 0, et0: 0, tx: 0, tn: 0}, w = {p: 0, et0: 0, tx: 0, tn: 0};
    for (const cd of cds) { const x = D.mun[cd]; if (!x) continue; for (const k in v) if (x[k] != null) { v[k] += x[k] * pesos[cd]; w[k] += pesos[cd]; } }
    if (!w.p) continue; s.datas.push(d); s.fonte.push(D.fonte); for (const k in v) s[k].push(w[k] ? v[k] / w[k] : null); }
  return s;
}
function statsHist(s) {
  const n = s.datas.length, sum = k => s[k].reduce((t, x) => t + (x || 0), 0), vals = k => s[k].filter(x => x != null);
  let seco = 0, sx = 0, sIni = null, best = {n: 0}; s.p.forEach((p, i) => { if ((p || 0) < 1) { if (!sx) sIni = i; sx++; if (sx > best.n) best = {n: sx, a: sIni, b: i}; } else sx = 0; }); seco = sx;
  const iMax = s.p.reduce((bi, p, i) => (p || 0) > (s.p[bi] || 0) ? i : bi, 0), tx = vals('tx'), tn = vals('tn');
  return {n, p: sum('p'), et0: sum('et0'), chuvosos: s.p.filter(p => p >= 1).length, fortes: s.p.filter(p => p >= 20).length, seco, best, pMax: s.p[iMax] || 0, dMax: s.datas[iMax],
    txMax: tx.length ? Math.max(...tx) : null, tnMin: tn.length ? Math.min(...tn) : null, txMed: tx.length ? tx.reduce((a, b) => a + b, 0) / tx.length : null, tnMed: tn.length ? tn.reduce((a, b) => a + b, 0) / tn.length : null,
    quentes: tx.filter(t => t >= 35).length, frios: tn.filter(t => t <= 3).length, era5: s.fonte.filter(f => f === 'era5').length};
}
function blocosHist(s) {   // somas por decêndio (até ~4 meses) ou por mês
  const porMes = s.datas.length > 125, g = {};
  s.datas.forEach((d, i) => { const dt = deISO(d), k = porMes ? d.slice(0, 7) : `${d.slice(0, 7)}-${dt.getDate() <= 10 ? 1 : dt.getDate() <= 20 ? 2 : 3}`;
    (g[k] = g[k] || {ini: d, fim: d, p: 0, et0: 0, n: 0}); g[k].fim = d; g[k].p += s.p[i] || 0; g[k].et0 += s.et0[i] || 0; g[k].n++; });
  return {porMes, l: Object.values(g)};
}
async function atualizarHist(alvo) {
  const box = $('jc-hist'); if (!box) return;
  const ini = deISO($('hp-ini').value), fim = deISO($('hp-fim').value);
  if (!(ini <= fim)) { box.innerHTML = '<p class="aviso">A data inicial deve ser anterior à final.</p>'; return; }
  HIST_PER = {ini, fim}; box.innerHTML = '<p class="nota">Carregando…</p>';
  const est = alvo === ESTADO || alvo === REGIAO, cd = est ? null : String(+alvo.properties.CD_MUN);
  const s = await serieHist(ini, fim, est ? pesosAlvo(cultAlvo()) : {[cd]: 1});
  if ($('jc-hist') !== box) return;   // janela trocada enquanto carregava
  if (!s.datas.length) { box.innerHTML = '<p class="aviso">Sem dados de clima neste período. O histórico permanente começa em 01/07/2025 e é preenchido aos poucos pela rotina diária.</p>'; return; }
  const st = statsHist(s), pedidos = Math.round((fim - ini) / 864e5) + 1, bal = st.p - st.et0;
  const b = blocosHist(s), pm = Math.max(1, ...b.l.map(x => Math.max(x.p, x.et0)));
  let h = graficoClima(s, 0, s.datas.length, 470, 110);
  h += `<div class="kpis"><div class="kpi"><b>${n0(st.p)} mm</b><span>chuva</span></div><div class="kpi"><b>${n0(st.et0)} mm</b><span>ET0</span></div><div class="kpi"><b style="color:${bal < 0 ? '#b5542c' : 'var(--azul)'}">${bal > 0 ? '+' : ''}${n0(bal)} mm</b><span>chuva − ET0</span></div></div>`;
  h += `<p>${st.chuvosos} dia${st.chuvosos === 1 ? '' : 's'} com chuva (≥ 1 mm) em ${st.n}${st.fortes ? `, ${st.fortes} com 20 mm ou mais` : ''}; maior chuva diária: ${n0(st.pMax)} mm em ${fmtD(deISO(st.dMax))}.
    Maior sequência sem chuva: <b>${st.best.n} dia${st.best.n === 1 ? '' : 's'}</b>${st.best.n ? ` (${fmtD(deISO(s.datas[st.best.a]))} a ${fmtD(deISO(s.datas[st.best.b]))})` : ''}${st.seco ? `; o período termina com ${st.seco} dia${st.seco === 1 ? '' : 's'} seco${st.seco === 1 ? '' : 's'}` : ''}.
    Temperatura: máximas com média de ${n1(st.txMed)} °C (pico ${n1(st.txMax)} °C${st.quentes ? `, ${st.quentes} dia${st.quentes === 1 ? '' : 's'} ≥ 35 °C` : ''}); mínimas com média de ${n1(st.tnMed)} °C (menor ${n1(st.tnMin)} °C${st.frios ? `, ${st.frios} dia${st.frios === 1 ? '' : 's'} ≤ 3 °C` : ''}).</p>`;
  h += `<table class="tab-ag"><tr><th>${b.porMes ? 'Mês' : 'Decêndio'}</th><th>Chuva</th><th>ET0</th><th style="width:40%"></th></tr>${b.l.map(x => `<tr><td>${fmtD(deISO(x.ini))}–${fmtD(deISO(x.fim))}${x.n < (b.porMes ? 28 : 8) ? ' *' : ''}</td><td>${n0(x.p)} mm</td><td>${n0(x.et0)} mm</td><td><div class="mini-b"><i style="width:${100 * x.p / pm}%;background:#2171b5"></i></div><div class="mini-b"><i style="width:${100 * x.et0 / pm}%;background:#e8803f"></i></div></td></tr>`).join('')}</table>`;
  // mesmo período do ano anterior, quando o histórico cobre
  const iniA = new Date(ini.getTime() - 365 * 864e5), fimA = new Date(fim.getTime() - 365 * 864e5);
  if (isoD(iniA) >= INICIO_HIST) { const sa = await serieHist(iniA, fimA, est ? pesosAlvo(cultAlvo()) : {[cd]: 1});
    if (sa.datas.length >= .9 * st.n) { const sta = statsHist(sa); h += `<p>Mesmo período do ano anterior: ${n0(sta.p)} mm de chuva (${st.p >= sta.p ? '+' : ''}${n0(st.p - sta.p)} mm agora), ${sta.chuvosos} dias com chuva, maior sequência seca de ${sta.best.n} dias.</p>`; } }
  // estação INMET
  if (!est && EST) { const ct = centroMun(cd), ep = estacaoProxima(ct[1], ct[0]);
    if (ep) { const ds = Object.keys(ep.e.serie).filter(d => d >= isoD(ini) && d <= isoD(fim)), pe = ds.reduce((t, d) => t + (ep.e.serie[d].p || 0), 0), v = VAL?.estacoes.find(x => x.codigo === ep.e.codigo);
      h += `<h4>Estação INMET mais próxima: ${esc(ep.e.nome)} (${ep.d.toFixed(0)} km)</h4><p>${ds.length ? `Registrou ${pe.toFixed(0)} mm em ${ds.length} dia${ds.length === 1 ? '' : 's'} com dados no período${ds.length < st.n ? ` (o modelo soma ${n0(ds.reduce((t, d) => { const i = s.datas.indexOf(d); return t + (i >= 0 ? s.p[i] || 0 : 0); }, 0))} mm nesses mesmos dias)` : ''}.` : 'Sem dados da estação no período escolhido (o arquivo do INMET cobre os últimos ~60 dias).'}</p>${htmlValChuva(v)}${valEst(ep.e.codigo)}`; }
    else h += `<div class="nota">Nenhuma estação INMET a menos de 70 km.</div>`; }
  else if (est) h += htmlValChuvaEstado();
  h += `<div class="nota">${pedidos > st.n ? `${st.n} de ${pedidos} dias com dados. ` : ''}${est ? `Média ponderada pela área ${cultAlvo() ? 'da cultura' : 'dos municípios'}${CDS_ALVO ? ' da região' : ''}. ` : ''}Fonte: ${st.era5 ? `reanálise ERA5 em ${st.era5} dia${st.era5 === 1 ? '' : 's'}` : ''}${st.era5 && st.era5 < st.n ? ' e ' : ''}${st.era5 < st.n ? `estimativa do modelo de maior resolução nos dias mais recentes (${st.n - st.era5})` : ''}; não é medição. ET0 já ajustada pelas estações INMET. ${b.porMes ? '' : 'Decêndios: dias 1–10, 11–20 e 21–fim do mês; '}* bloco incompleto no período.</div>`;
  box.innerHTML = h;
}
function ligarHist(alvo) {
  const i = $('hp-ini'), f = $('hp-fim'); if (!i) return;
  i.onchange = f.onchange = () => atualizarHist(alvo);
  document.querySelectorAll('.hist-per button').forEach(bt => bt.onclick = () => {
    const fim = deISO(f.max); let ini;
    if (bt.dataset.n === 'safra') { const c = cultAtual(); ini = dataSem(c, 0); ini = new Date(ini.getTime() - 15 * 864e5); }
    else ini = new Date(fim.getTime() - (+bt.dataset.n - 1) * 864e5);
    if (isoD(ini) < INICIO_HIST) ini = deISO(INICIO_HIST);
    i.value = isoD(ini); f.value = isoD(fim); atualizarHist(alvo); });
  atualizarHist(alvo);
}
function htmlValChuva(v) {
  const x = v?.chuva_era5 || v?.chuva_previsao; if (!x) return '';
  return `<p class="nota" style="color:var(--tinta)">Chuva do modelo × estação (${v.chuva_era5 ? 'reanálise ERA5' : 'estimativa recente'}, ${x.n} dias com dados): modelo ${x.total_modelo} mm, estação ${x.total_inmet} mm (${x.vies_pct > 0 ? '+' : ''}${n1(x.vies_pct)}%). Correlação das somas semanais r = ${n2(x.r_7dias)}; dia com/sem chuva coincidiu em ${x.acerto_dias}% dos dias; dos dias com chuva na estação, o modelo indicou chuva em ${x.deteccao ?? '—'}%. Só descritivo: a chuva não é corrigida.</p>`;
}
function htmlValChuvaEstado() {
  const l = (VAL?.estacoes || []).map(v => ({v, x: v.chuva_era5 || v.chuva_previsao})).filter(o => o.x);
  if (!l.length) return '<div class="nota">A comparação da chuva com as estações INMET aparece após a próxima atualização automática.</div>';
  const med = a => { const s = a.filter(x => x != null).sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : null; };
  return `<h4>Chuva do modelo × estações INMET</h4><p>Mediana entre ${l.length} estações: viés de ${n1(med(l.map(o => o.x.vies_pct)))}% no total, correlação das somas semanais ${n2(med(l.map(o => o.x.r_7dias)))}.</p>
    <details><summary class="nota" style="cursor:pointer">Ver por estação</summary><table class="tab-ag"><tr><th>Estação</th><th>Estação mm</th><th>Modelo mm</th><th>Viés</th><th>r 7 dias</th></tr>${l.sort((a, b) => a.v.nome.localeCompare(b.v.nome)).map(({v, x}) => `<tr><td>${esc(v.nome)}</td><td>${x.total_inmet}</td><td>${x.total_modelo}</td><td>${x.vies_pct > 0 ? '+' : ''}${n0(x.vies_pct)}%</td><td>${n2(x.r_7dias)}</td></tr>`).join('')}</table></details>`;
}
function htmlAguaEstado(c) {
  const B = bhCultura(c); if (!B) return '';
  const l = Object.entries(B).filter(([cd]) => c.mun[cd]).map(([cd, bh]) => ({cd, nome: MUN_IDX[cd]?.properties.NM_MUN, bh, w: c.mun[cd]?.area || 1, k: bh.campoAtual > 0 ? classeKs(bh.ksAtual) : -1, kf: bh.ksMinFutCampo == null ? -1 : classeKs(bh.ksMinFutCampo)})).filter(x => x.nome);
  const tot = l.filter(x => x.k >= 0).reduce((t, x) => t + x.w, 0), totF = l.filter(x => x.kf >= 0).reduce((t, x) => t + x.w, 0);
  const pct = (arr, key, T) => CLS_AG.map((_, k) => T ? 100 * arr.filter(x => x[key] === k).reduce((t, x) => t + x.w, 0) / T : 0);
  const barra = v => `<div class="barra">${v.map((p, k) => `<i title="${CLS_AG[k].nome}: ${p.toFixed(0)}%" style="width:${p}%;background:${CLS_AG[k].cor}"></i>`).join('')}</div>`;
  const ph = pct(l, 'k', tot), pf = pct(l, 'kf', totF);
  const piores = l.filter(x => x.k >= 0 || x.kf >= 0).sort((a, b) => (a.bh.ksMinFutCampo ?? 1) - (b.bh.ksMinFutCampo ?? 1) || a.bh.atual - b.bh.atual).slice(0, 12);
  return `<h3>Água no solo · ${esc(c.nome)} (${CDS_ALVO ? 'região selecionada' : 'estado'})</h3><p>Hoje: ${ph.map((p, k) => `${CLS_AG[k].nome.toLowerCase()} <b>${p.toFixed(0)}%</b>`).join(' · ')} da área com lavoura em campo.</p>${barra(ph)}
    <p style="margin-top:8px">Pior dia nos próximos 15 dias: ${pf.map((p, k) => `${CLS_AG[k].nome.toLowerCase()} <b>${p.toFixed(0)}%</b>`).join(' · ')}.</p>${barra(pf)}
    <h4>Municípios com a situação mais restrita</h4><table class="tab-ag"><tr><th>Município</th><th>Água hoje</th><th>Ks hoje</th><th>Pior Ks 15 dias</th><th>Demanda atendida 30 d</th></tr>${piores.map(x => `<tr><td><a href="#" data-cd="${x.cd}" class="lk-mun">${esc(x.nome)}</a></td><td>${n0(x.bh.atual)}%</td><td>${x.k >= 0 ? `<span style="color:${CLS_AG[x.k].cor};font-weight:600">${n2(x.bh.ksAtual)}</span>` : '—'}</td><td>${x.kf >= 0 ? `<span style="color:${CLS_AG[x.kf].cor};font-weight:600">${n2(x.bh.ksMinFutCampo)}</span>` : '—'}</td><td>${x.bh.atend30 != null ? n0(x.bh.atend30) + '%' : '—'}</td></tr>`).join('')}</table>
    <div class="nota">Porcentagens ponderadas pela área ${c.semFenologia ? 'mapeada' : 'informada na planilha'}. Clique no município para abrir a ficha dele.</div>`;
}
function abrirClima(alvo) {
  const nome = alvo === ESTADO || alvo === REGIAO ? nomeAlvo() : alvo.properties.NM_MUN, c = cultAtual();
  abrirModal(`Clima e água no solo · ${nome}${c ? ' · ' + c.nome : ''}`, htmlJanelaClima(alvo), 'larga');
  ligarHist(alvo);
  document.querySelectorAll('#m-corpo .lk-mun').forEach(a => a.onclick = e => { e.preventDefault(); const f = MUN_IDX[a.dataset.cd]; if (!f) return; $('modal').hidden = true; mapa.fitBounds(L.geoJSON(f).getBounds(), {paddingBottomRight: [400, 0]}); selecionar(f); });
}
// gráfico do balanço: água no solo (% da disponível) com as faixas "água fácil" e "estresse" (limite = 1 − p da cultura),
// chuva em barras e, embaixo, uma fita com a classe de Ks de cada dia
function graficoAgua(bh, W = 300, H = 100) {
  const S = bh.serie, n = S.length; if (!n) return '';
  const bw = W / n, y = v => H - Math.max(0, Math.min(100, v)) / 100 * H, xc = j => (j + .5) * bw;
  const pm = Math.max(20, ...S.map(s => s.chuva)), jh = S.findIndex(s => s.futuro), xh = jh < 0 ? W : jh * bw;
  const lim = S.map((s, j) => `${j ? 'L' : 'M'}${xc(j).toFixed(1)},${y(100 * (1 - s.p)).toFixed(1)}`).join('');
  const zonaEst = `M0,${H} L0,${y(100 * (1 - S[0].p)).toFixed(1)} ${lim.replace(/^M/, 'L')} L${W},${y(100 * (1 - S[n - 1].p)).toFixed(1)} L${W},${H} Z`;
  const linha = l => l.map(([s, j], k) => `${k ? 'L' : 'M'}${xc(j).toFixed(1)},${y(s.pct).toFixed(1)}`).join('');
  const passado = S.map((s, j) => [s, j]).filter(([s]) => !s.futuro), fut = S.map((s, j) => [s, j]).filter(([s], j) => s.futuro || j === jh - 1);
  const corDia = s => s.campo > 0 ? CLS_AG[classeKs(s.ks)].cor : COR_SEMCAMPO, d = s => fmtD(deISO(CL.datas[s.i]));
  return `<svg class="graf" viewBox="0 0 ${W} ${H + 40}" width="100%" font-size="10" style="overflow:visible">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#3f9a4c" opacity=".10"/><path d="${zonaEst}" fill="#e8803f" opacity=".16"/>
    <path d="${lim}" fill="none" stroke="#e8803f" stroke-width="1" stroke-dasharray="3 2"/>
    <rect x="${xh}" y="0" width="${W - xh}" height="${H}" fill="currentColor" opacity=".05"/><line x1="${xh}" x2="${xh}" y1="0" y2="${H}" stroke="currentColor" opacity=".35"/>
    ${S.map((s, j) => { const hh = H * .4 * s.chuva / pm; return hh > .2 ? `<rect x="${(j * bw + .4).toFixed(1)}" y="${(H - hh).toFixed(1)}" width="${Math.max(1, bw - .8).toFixed(1)}" height="${hh.toFixed(1)}" fill="#2171b5" opacity=".65"/>` : ''; }).join('')}
    <path d="${linha(passado)}" fill="none" style="stroke:var(--azul)" stroke-width="2"/><path d="${linha(fut)}" fill="none" style="stroke:var(--azul)" stroke-width="2" stroke-dasharray="4 3"/>
    <text x="3" y="10" fill="#3f9a4c" style="fill:#3f9a4c">água fácil</text><text x="3" y="${H - 3}" style="fill:#c0612a">estresse</text>
    ${S.map((s, j) => `<rect x="${(j * bw).toFixed(1)}" y="${H + 3}" width="${(bw + .2).toFixed(1)}" height="6" fill="${corDia(s)}"/>`).join('')}
    ${S.map((s, j) => `<rect x="${(j * bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H + 9}" fill="transparent"><title>${d(s)}${s.futuro ? ' (previsão)' : ''}\nágua no solo ${s.pct.toFixed(0)}% · chuva ${s.chuva.toFixed(0)} mm\nKc ${n2(s.kc)} · demanda ${n1(s.etc)} mm · consumo ${n1(s.eta)} mm · Ks ${n2(s.ks)}${s.campo > 0 ? '' : '\n(sem lavoura em campo)'}</title></rect>`).join('')}
    <text x="0" y="${H + 20}">${d(S[0])}</text>${jh > 0 ? `<text x="${xh}" y="${H + 20}" text-anchor="middle">hoje</text>` : ''}<text x="${W}" y="${H + 20}" text-anchor="end">${d(S[n - 1])}</text>
    <text x="0" y="${H + 34}"><tspan style="fill:var(--azul)">— água no solo (% da disponível)</tspan> <tspan style="fill:#2171b5">■ chuva (máx ${pm.toFixed(0)} mm)</tspan></text></svg>`;
}
function htmlAgua(f, c, m, mc, W) {
  const cd = String(+f.properties.CD_MUN), bh = bhCultura(c)?.[cd] || balancoHidrico(mc, cadMun(c.cid, cd), c, m, cd), kp = paramsKc(c);
  const k = bh.campoAtual > 0 ? classeKs(bh.ksAtual) : -1, cls = k < 0 ? 'Sem lavoura em campo' : CLS_AG[k].nome;
  let h = `<h3>Água no solo · ${esc(c.nome)}</h3>`;
  h += `<div class="kpis"><div class="kpi"><b>${n0(bh.atual)}%</b><span>água disponível hoje</span></div><div class="kpi"><b style="color:${k < 0 ? 'var(--suave)' : CLS_AG[k].cor}">${k < 0 ? '—' : n2(bh.ksAtual)}</b><span>Ks hoje · ${cls.toLowerCase()}</span></div><div class="kpi"><b>${bh.campoAtual > 0 ? n1(bh.etcHoje) : '—'}</b><span>demanda (mm/dia)</span></div></div>`;
  h += W ? graficoAgua(bh, W, Math.round(W / 4.2)) : graficoAgua(bh);
  const at = (a, dmd) => a == null ? '—' : `${a.toFixed(0)}% de ${dmd.toFixed(0)} mm`;
  h += `<table><tr><td>Demanda hoje (ET0 ${n1(bh.et0Hoje)} × Kc ${n2(bh.kcAtual)})</td><td>${bh.campoAtual > 0 ? n1(bh.etcHoje) + ' mm/dia' : '—'}</td></tr>
    <tr><td>Demanda atendida, últimos 30 dias</td><td>${at(bh.atend30, bh.dem30)}</td></tr><tr><td>Demanda atendida, próximos 15 dias</td><td>${at(bh.atendFut, bh.demFut)}</td></tr>
    <tr><td>Pior Ks previsto (15 dias)</td><td>${bh.ksMinFutCampo == null ? '—' : n2(bh.ksMinFutCampo)}</td></tr></table>`;
  h += `<div class="nota">Reservatório de ~${bh.TAW.toFixed(0)} mm (textura do solo${soloCultura(c.cid, cd) ? ' sob a cultura' : ''}, ${profRaiz(c)} cm de raízes). A faixa de estresse começa abaixo de ~${(100 * (1 - (bh.pAtual ?? kp.p))).toFixed(0)}% (p de ${esc(c.nome.toLowerCase())} = ${n2(kp.p)}, ajustado pela demanda do dia). Fita colorida: classe de Ks de cada dia. Passe o mouse no gráfico para ver os valores diários.</div>`;
  const comp = htmlAguaCulturas(f);
  return h + (comp ? `<details style="margin-top:8px"><summary class="nota" style="cursor:pointer;color:var(--tinta)">Comparar com as outras culturas em campo no município</summary>${comp}</details>` : '');
}
function htmlAguaCulturas(f) {   // compara todas as culturas da planilha com lavoura em campo no município
  if (!PL || !CL) return '';
  const cd = String(+f.properties.CD_MUN), mc = CL.mun[cd]; if (!mc) return '';
  const linhas = [], safras = Object.keys(PL).sort().reverse(), fontes = safras.map(s => [s, PL[s]]);
  if (CANA) fontes.push(['', {'Cana-de-açúcar': CANA}]);
  for (const [s, P] of fontes) for (const [n, c] of Object.entries(P)) {
    const m = c.mun[cd]; if (!m || linhas.some(l => l.n === n)) continue;
    const bh = balancoHidrico(mc, cadMun(c.cid, cd), c, m, cd);
    if (!(bh.campoAtual > 0) && bh.ksMinFutCampo == null) continue;
    linhas.push({n, s, c, bh});
  }
  if (linhas.length < 2) return '';
  linhas.sort((a, b) => (a.c === cultAtual() ? -1 : 0) - (b.c === cultAtual() ? -1 : 0));
  const cel = ks => { const k = classeKs(ks); return ks == null ? '—' : `<span style="color:${CLS_AG[k].cor};font-weight:600">${n2(ks)}</span>`; };
  return `<table class="tab-ag"><tr><th>Cultura</th><th>Kc</th><th>Demanda<br>mm/dia</th><th>Água</th><th>Ks hoje</th><th>Pior Ks<br>15 dias</th></tr>${linhas.map(({n, s, bh}) => `<tr><td>${esc(n)}${safras.length > 1 ? ` <span class="nota" style="margin:0">${esc(s)}</span>` : ''}</td><td>${bh.campoAtual > 0 ? n2(bh.kcAtual) : '—'}</td><td>${bh.campoAtual > 0 ? n1(bh.etcHoje) : '—'}</td><td>${n0(bh.atual)}%</td><td>${bh.campoAtual > 0 ? cel(bh.ksAtual) : '—'}</td><td>${cel(bh.ksMinFutCampo)}</td></tr>`).join('')}</table>
    <div class="nota">Mesma chuva e mesmo clima, mas cada cultura tem sua demanda (Kc da fase) e sua tolerância (p), e o solo considerado é o das áreas da cultura quando mapeadas. Por isso a situação pode diferir entre culturas no mesmo município.</div>`;
}
function htmlGeral(f) {
  const cd = String(+f.properties.CD_MUN), c = cultAtual(), m = c?.mun[cd], cid = c?.cid; let h = '';
  if (c?.semFenologia) {
    h += `<h3>${esc(c.nome)}</h3>`;
    if (!m) h += `<div class="nota">Sem cana mapeada neste município no mapeamento da Aprosoja-MS.</div>`;
    else { const tot = Object.values(c.mun).reduce((t, x) => t + x.area, 0), am = (+f.properties.AREA_KM2 || 0) * 100;
      h += `<div class="kpis"><div class="kpi"><b>${n0(m.area / 1000)} mil</b><span>ha mapeados</span></div><div class="kpi"><b>${am ? n1(100 * m.area / am) + '%' : '—'}</b><span>da área do município</span></div><div class="kpi"><b>${n1(100 * m.area / tot)}%</b><span>da cana do MS</span></div></div>
        <div class="nota">Mapeamento de uso e cobertura da Aprosoja-MS, safra 2025/26. A cana não tem acompanhamento fenológico na planilha.</div>`; }
  } else if (c) {
    h += `<h3>${esc(c.nome)} · semana de ${fmtD(dataSem(c, semSel))}${dataSem(c, semSel) > HOJE ? ' (projeção)' : ''}</h3>`;
    if (!m) h += `<div class="nota">Sem dados de ${esc(c.nome)} para este município na planilha.</div>`;
    else {
      const d = distrib(c, m, semSel), pl = acum(m.serie, semSel), cr = pctCritico(c, m, semSel), ms = mediaMS(c, x => acum(x.serie, semSel));
      h += `<div class="kpis"><div class="kpi"><b>${pl.toFixed(0)}%</b><span>plantado${ms ? ' (MS ' + ms.v.toFixed(0) + '%)' : ''}</span></div><div class="kpi"><b>${cr.toFixed(0)}%</b><span>em fase crítica</span></div><div class="kpi"><b>${m.area ? n0(m.area / 1000) + ' mil' : '—'}</b><span>ha estimados</span></div></div>`;
      h += `<table>${c.estadios.map((e, i) => d[i] >= .5 ? `<tr><td><i style="background:${corEstadio(c, i)}"></i>${esc(e.nome)}${e.critico ? ' ⚠' : ''}</td><td>${d[i].toFixed(0)}%</td></tr>` : '').join('')}</table>`;
      const cal = calendarioCritico(c, m);
      if (cal.length) h += `<div class="nota" style="margin-top:8px">Metade da área semeada atinge (projeção):</div><table>${cal.map(([e, dt]) => `<tr><td>${esc(e)}</td><td>${dt ? fmtD(dt) : '—'}</td></tr>`).join('')}</table>`;
    }
  } else h += `<div class="aviso">Escolha uma cultura em “Safra e cultura” para filtrar a ficha${PL ? '' : ' (as culturas anuais aparecem ao conectar a pasta da equipe)'}.</div>`;
  const mc = CL?.mun[cd];
  if (mc) h += htmlClimaResumo(mc, c && m ? bhCultura(c)?.[cd] : null, c);
  const sc = c ? soloCultura(cid, cd) : null, so = soloDoMunicipio(f);
  const tb = (o, cores) => Object.entries(o).filter(([, v]) => v >= .5).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td><i style="background:${cores[k] || '#bdbdbd'}"></i>${esc(k)}</td><td>${v.toFixed(0)}%</td></tr>`).join('');
  if (sc) h += `<h3>Solos sob ${esc(c.nome.toLowerCase())} (${n0(sc.area)} ha mapeados)</h3><div class="subt">Textura do solo</div><table>${tb(sc.textura, CORES_TEX)}</table><div class="subt">Classe de solo</div><table>${tb(sc.ordem, CORES_ORDEM)}</table><div class="nota">Mapa de uso da Aprosoja-MS × solos 1:5.000.000. Água disponível ~${(sc.cad * profRaiz(c) / 60).toFixed(0)} mm em ${profRaiz(c)} cm.</div>`;
  else if (so) h += `<h3>Solos do município (1:5.000.000)</h3><div class="subt">Textura do solo</div><table>${tb(so.textura, CORES_TEX)}</table><div class="subt">Classe de solo</div><table>${tb(so.ordem, CORES_ORDEM)}</table><div class="nota">${c ? `${esc(c.nome)} não tem mapa de uso: valores do município inteiro. ` : ''}Água disponível estimada: ~${so.cad.toFixed(0)} mm em 60 cm (pela textura).</div>`;
  const fts = FOTOS.filter(p => p.mun && String(+p.mun.properties.CD_MUN) === cd && (!cid || p.cult === cid)), rel = RELATOS.filter(r => r.muns.has(cd) && (!cid || r.cults.has(cid)));
  const outros = cid ? RELATOS.filter(r => r.muns.has(cd) && !r.cults.has(cid)).length : 0;
  if (fts.length || rel.length || outros) h += `<h3>Fotos e relatos de campo${c ? ' · ' + esc(c.nome.toLowerCase()) : ''}</h3><div class="nota">${fts.length} foto${fts.length === 1 ? '' : 's'}${fts.length ? ' (última em ' + fmtD(new Date(Math.max(...fts.map(p => p.data)))) + ')' : ''} · ${rel.length} relato${rel.length === 1 ? '' : 's'}${rel.length ? ' (último: ' + esc(rel[0].nome) + ', ' + fmtD(rel[0].data) + ')' : ''}${outros ? ` · ${outros} outro${outros > 1 ? 's' : ''} cita${outros > 1 ? 'm' : ''} o município sem mencionar a cultura` : ''}</div>`;
  return h;
}
function calendarioCritico(c, m) {
  const tot = acum(m.serie, 99);
  return c.estadios.filter(e => e.critico).map(e => { for (let j = 1; j <= 70; j++) if (tot && acum(m.serie, j - Math.round(e.dias / 7)) >= tot / 2) return [e.nome, dataSem(c, j)]; return [e.nome, null]; });
}
// balanço hídrico diário da zona radicular (FAO-56, cap. 8): depleção Dr, RAW = p·TAW, Ks = (TAW − Dr)/((1 − p)·TAW)
function balancoHidrico(mc, cad, c, m, cd) {
  const h = iHoje(), a = Math.max(0, h - 45), b = Math.min(CL.datas.length, h + 15), TAW = cad;
  const ct = centroMun(cd), fat = ct ? fatorET0(ct[0], ct[1], 'previsao') : {f: 1, base: []}, pTab = c ? paramsKc(c).p : .5;
  let Dr = TAW * .5; const serie = [];
  for (let i = a; i < b; i++) {
    const data = deISO(CL.datas[i]);
    let kc = KC_PALHADA, campo = 0; if (c && m) { const k = kcInfo(c, m, data); if (k) { kc = k.kc; campo = k.campo; } }
    const et0 = (mc.et0[i] || 0) * fat.f, etc = et0 * kc, p = Math.min(.8, Math.max(.1, pTab + .04 * (5 - etc)));
    const raw = p * TAW, ks = Dr <= raw ? 1 : Math.max(0, (TAW - Dr) / ((1 - p) * TAW)), eta = ks * etc;
    Dr = Math.min(TAW, Math.max(0, Dr - (mc.p[i] || 0) + eta));
    serie.push({i, kc, ks, p, pct: 100 * (TAW - Dr) / TAW, et0, etc, eta, chuva: mc.p[i] || 0, campo, futuro: i >= h});
  }
  const pass = serie.filter(s => !s.futuro && s.i >= h - 30), fut = serie.filter(s => s.futuro), ult = pass.at(-1);
  const soma = (l, k) => l.reduce((t, s) => t + s[k], 0), pc = pass.filter(s => s.campo > 0), fc = fut.filter(s => s.campo > 0);
  return {atual: ult?.pct, ksAtual: ult?.ks, kcAtual: ult?.kc, pAtual: ult?.p, minFut: fut.length ? Math.min(...fut.map(s => s.pct)) : null,
    ksMinFut: fut.length ? Math.min(...fut.map(s => s.ks)) : null, diasEstresse: pass.filter(s => s.ks < 1).length, diasEstresseFut: fut.filter(s => s.ks < 1).length,
    etc30: soma(pass, 'etc'), eta30: soma(pass, 'eta'), etcFut: soma(fut, 'etc'), fator: fat,
    // só os dias com lavoura em campo (semeada e não colhida): base da camada "Água no solo"
    serie, TAW, campoAtual: ult?.campo || 0, etcHoje: ult?.etc, et0Hoje: ult?.et0,
    ksMinFutCampo: fc.length ? Math.min(...fc.map(s => s.ks)) : null,
    atend30: soma(pc, 'etc') > 1 ? 100 * soma(pc, 'eta') / soma(pc, 'etc') : null, dem30: soma(pc, 'etc'),
    atendFut: soma(fc, 'etc') > 1 ? 100 * soma(fc, 'eta') / soma(fc, 'etc') : null, demFut: soma(fc, 'etc')};
}
let VAL = null;   // validação da ET0 (estações INMET x modelo)
function fatorET0(lon, lat, tipo = 'previsao') {
  if (!VAL) return {f: 1, base: []};
  let sw = 0, sf = 0; const base = [];
  for (const e of VAL.estacoes) { const v = e[tipo]; if (!v || !v.fator) continue; const d = turf.distance([lon, lat], [e.lon, e.lat]); if (d > 150) continue;
    const w = 1 / Math.max(5, d) ** 2; sw += w; sf += w * v.fator; base.push({nome: e.nome, d, ...v}); }
  return sw ? {f: sf / sw, base: base.sort((a, b) => a.d - b.d)} : {f: 1, base: []};
}
const centroMun = cd => { const f = MUN_IDX[cd]; if (!f) return null; f._ct = f._ct || turf.centroid(f).geometry.coordinates; return f._ct; };
function estacaoProxima(lat, lon) {
  if (!EST) return null; let melhor = null;
  for (const e of EST.estacoes) { if (!e.lat) continue; const d = turf.distance([lon, lat], [e.lon, e.lat]); if (d < 70 && (!melhor || d < melhor.d)) melhor = {e, d}; }
  return melhor;
}
function gerarAnalise(f, soDados = false) {
  const p = f.properties, cd = String(+p.CD_MUN), c = cultAtual(), m = c?.mun[cd], mc = CL?.mun[cd], so = soloDoMunicipio(f), sc = soloCultura(c?.cid, cd), cad = cadMun(c?.cid, cd);
  let bhR = null;
  const nome = esc(p.NM_MUN), out = [], atencao = []; let pontos = 0;
  const cult = c ? esc(c.nome.toLowerCase()) : null, cid = c?.cid;
  out.push(`<div class="aviso">Análise automática gerada a partir dos dados do painel em ${fmtDL(HOJE)}. É um apoio à decisão: indica situações a verificar e não substitui a observação de campo. Associações entre clima, solo e lavoura não implicam, por si, relação de causa.</div>`);
  // 1. situação da lavoura
  let dCrit = null, crit15 = 0;
  if (c?.semFenologia) {
    out.push(`<h4>Situação da lavoura</h4><p>${m ? `O mapeamento da Aprosoja-MS indica <b>${n0(m.area)} ha</b> de cana-de-açúcar em ${nome}${p.AREA_KM2 ? ` (${n1(100 * m.area / (p.AREA_KM2 * 100))}% da área do município)` : ''}.` : `Não há cana-de-açúcar mapeada em ${nome}.`} A cana não tem acompanhamento fenológico na planilha; a análise considera a área mapeada, os solos sob a cultura, o clima e o balanço hídrico com Kc médio anual de ${n2(KC_CANA)} e raízes até ${PROF_CANA} cm.</p>`);
  } else if (c && m) {
    const pl = acum(m.serie, semSel), ant = acum(m.serie, semSel - 1), ms = mediaMS(c, x => acum(x.serie, semSel)), d = distrib(c, m, semSel);
    const dS = dataSem(c, semSel), proj = dS > HOJE;
    const domi = d.map((v, i) => [v, i]).filter(x => x[0] >= 1).sort((a, b) => b[0] - a[0]);
    let t = `Em ${nome}, ${proj ? 'a projeção para a semana de ' + fmtD(dS) + ' indica' : 'até a semana de ' + fmtD(dS) + ' foi informada'} semeadura de <b>${pl.toFixed(0)}%</b> da área de ${cult}`;
    if (ms) t += ` (média do estado: ${ms.v.toFixed(0)}%${ms.pond ? ', ponderada pela área' : ''})`;
    t += `. ${pl - ant > 0 ? `O avanço na última semana foi de ${(pl - ant).toFixed(0)} pontos percentuais.` : pl > 0 && pl < 100 ? 'Não houve avanço registrado na última semana.' : ''}`;
    if (ms && pl > 5 && pl < ms.v - 15) { t += ' O ritmo está abaixo da média estadual.'; atencao.push(`Semeadura atrasada em relação ao estado (${pl.toFixed(0)}% contra ${ms.v.toFixed(0)}%): verificar causa (umidade do solo, chuva excessiva, logística ou janela do ZARC).`); pontos += 1; }
    out.push(`<h4>Situação da lavoura</h4><p>${t}</p>`);
    if (domi.length) out.push(`<p>Distribuição da área semeada por estádio (projeção pelo calendário médio): ${domi.slice(0, 4).map(([v, i]) => `${esc(c.estadios[i].nome)} ${v.toFixed(0)}%`).join('; ')}.</p>`);
    for (let j = semSel; j <= semSel + 2; j++) crit15 = Math.max(crit15, pctCritico(c, m, j));
    const cal = calendarioCritico(c, m).filter(x => x[1]);
    if (cal.length) { dCrit = cal[0][1]; out.push(`<p>Pela projeção, metade da área semeada entra em ${esc(cal[0][0])} por volta de <b>${fmtD(cal[0][1])}</b>${cal.length > 1 ? ` e em ${esc(cal.at(-1)[0])} por volta de ${fmtD(cal.at(-1)[1])}` : ''}. ${crit15 >= 1 ? ` Nas próximas três semanas, até <b>${crit15.toFixed(0)}%</b> da área estará em fases críticas.` : ' Nas próximas três semanas, a área ainda não deve estar em fases críticas.'}</p>`); }
    if (crit15 >= 30) pontos += 2;
  } else if (c) out.push(`<h4>Situação da lavoura</h4><p>Não há dados de ${cult} para ${nome} na planilha da safra ${esc(safraSel)}.</p>`);
  else out.push(`<h4>Situação da lavoura</h4><p>Conecte a pasta da equipe para incluir plantio e fenologia na análise.</p>`);
  // 2. solo
  if (so) {
    const tex = Object.entries(so.textura).sort((a, b) => b[1] - a[1])[0], ord = Object.entries(so.ordem).sort((a, b) => b[1] - a[1])[0];
    let t = `Predominam ${esc(ord[0].toLowerCase())}s (${ord[1].toFixed(0)}% da área) com textura ${esc(tex[0].toLowerCase())} (${tex[1].toFixed(0)}%), o que corresponde a uma água disponível estimada de ~${so.cad.toFixed(0)} mm na camada de 60 cm.`;
    if (so.cad < 55) t += ' Solos de menor retenção de água tornam a lavoura mais sensível a veranicos curtos.'; else if (so.cad > 80) t += ' Solos de maior retenção amortecem veranicos curtos, mas podem dificultar operações após chuvas intensas.';
    if (sc) { const tc = Object.entries(sc.textura).sort((a, b) => b[1] - a[1]), oc = Object.entries(sc.ordem).sort((a, b) => b[1] - a[1])[0];
      t += ` Considerando só as áreas de ${esc(sc.nome.toLowerCase())} do mapa de uso da Aprosoja-MS (${n0(sc.area)} ha), ${tc.slice(0, 2).map(([k, v]) => `${v.toFixed(0)}% estão em solos de textura ${esc(k.toLowerCase())}`).join(' e ')}, e ${oc[1].toFixed(0)}% em ${esc(oc[0].toLowerCase())}s; a água disponível nessas áreas é estimada em ~${cad.toFixed(0)} mm${profRaiz(c) !== 60 ? ` (${profRaiz(c)} cm de raízes)` : ''}, valor usado no balanço hídrico.`; }
    out.push(`<h4>Solo</h4><p>${t} <span class="nota">(Mapa 1:5.000.000: valor regional, não do talhão.)</span></p>`);
  }
  // 3. clima e balanço hídrico
  if (mc) {
    const h = iHoje(), soma = (k, i0, i1) => mc[k].slice(Math.max(0, i0), i1).reduce((t, x) => t + (x || 0), 0);
    const p30 = soma('p', h - 30, h), p15 = soma('p', h, h + 15), et30 = soma('et0', h - 30, h), et15 = soma('et0', h, h + 15), seco = diasSecos(mc);
    const tx15 = mc.tx.slice(h, h + 15), tn15 = mc.tn.slice(h, h + 15), quente = tx15.filter(t => t >= 35).length, geada = tn15.filter(t => t != null && t <= 3).length;
    let t = `Nos últimos 30 dias, o modelo estima <b>${p30.toFixed(0)} mm</b> de chuva para uma evapotranspiração de referência de ${et30.toFixed(0)} mm${seco >= 1 ? `, com ${seco} dia${seco > 1 ? 's' : ''} seguido${seco > 1 ? 's' : ''} sem chuva até hoje` : ''}.`;
    const bh = balancoHidrico(mc, cad, c, m, cd), kp = c ? paramsKc(c) : null; bhR = bh;
    if (bh.fator.base.length && Math.abs(bh.fator.f - 1) >= .03)
      t += ` A ET0 do modelo foi ajustada por um fator de ${bh.fator.f.toFixed(2).replace('.', ',')}, obtido da comparação com a ET0 Penman-Monteith calculada nas estações INMET próximas (o modelo ficou ${bh.fator.base.slice(0, 2).map(b => n1(Math.abs(b.vies_pct)) + '% ' + (b.vies_pct > 0 ? 'acima' : 'abaixo') + ' em ' + esc(b.nome)).join(' e ')}).`;
    if (bh.atual != null) {
      t += ` O balanço hídrico da zona radicular (FAO-56; água disponível ~${cad.toFixed(0)} mm pela textura${sc ? ' das áreas da cultura' : ''}${kp ? `; Kc de ${esc(c.nome.toLowerCase())} ${c.semFenologia ? 'médio anual' : kp.fonte === 'FAO-56' ? 'da FAO-56' : 'da planilha'}, hoje ~${n2(bh.kcAtual)}${c.semFenologia ? '' : ' na área semeada'}; p = ${n2(bh.pAtual)}` : ''}) indica <b>${bh.atual.toFixed(0)}%</b> da água disponível no solo`;
      t += bh.ksAtual < 1 ? `, já abaixo do limite de fácil absorção: há <b>restrição hídrica</b> (Ks = ${bh.ksAtual.toFixed(2).replace('.', ',')}; a planta transpira ~${(100 * bh.ksAtual).toFixed(0)}% do potencial)` : ', sem restrição hídrica (Ks = 1)';
      t += bh.diasEstresse ? `. Nos últimos 30 dias, houve ${bh.diasEstresse} dia${bh.diasEstresse > 1 ? 's' : ''} com restrição (evapotranspiração real ${n0(bh.eta30)} mm frente a ${n0(bh.etc30)} mm potenciais).` : '.';
      if (bh.ksAtual < 1 && m) { pontos += 2; atencao.push(`Restrição hídrica atual (Ks ${bh.ksAtual.toFixed(2).replace('.', ',')}; ${bh.atual.toFixed(0)}% da água disponível)${dCrit ? ', com fases críticas se aproximando' : ''}.`); }
    }
    out.push(`<h4>Clima recente e água no solo</h4><p>${t}</p>`);
    const c15 = concordancia(totaisModelos(mc, h, h + 15)), c7 = concordancia(totaisModelos(mc, h, h + 7));
    let tp = `A previsão para os próximos 15 dias${mc.mod ? ` (média de ${Object.keys(mc.mod).length} modelos)` : ''} indica <b>${p15.toFixed(0)} mm</b> de chuva para ${et15.toFixed(0)} mm de evapotranspiração de referência${Math.abs(bh.fator.f - 1) >= .03 ? ` (${(et15 * bh.fator.f).toFixed(0)} mm após o ajuste pelas estações)` : ''}.`;
    if (c7) tp += ` Para os próximos 7 dias, os modelos variam de ${c7.mn.toFixed(0)} a ${c7.mx.toFixed(0)} mm (concordância ${c7.nivel})${c15 ? `; em 15 dias, de ${c15.mn.toFixed(0)} a ${c15.mx.toFixed(0)} mm entre os ${c15.n} modelos que cobrem o período (concordância ${c15.nivel})` : ''}.`;
    if (c7?.nivel === 'baixa') tp += ' A divergência entre os modelos indica previsão de chuva incerta: acompanhar as atualizações diárias.';
    if (bh.minFut != null) tp += ` Mantida a previsão, a água no solo deve chegar a no mínimo ${bh.minFut.toFixed(0)}% da disponível${bh.diasEstresseFut ? `, com ${bh.diasEstresseFut} dia${bh.diasEstresseFut > 1 ? 's' : ''} de restrição hídrica (Ks mínimo ${bh.ksMinFut.toFixed(2).replace('.', ',')})` : ', sem restrição hídrica'}.`;
    if (quente) { tp += ` Há ${quente} dia${quente > 1 ? 's' : ''} com máxima prevista ≥ 35 °C.`; if (m && crit15 >= 20) { pontos += 1; atencao.push(`Calor (≥ 35 °C) previsto com ${crit15.toFixed(0)}% da área em fases críticas: risco de abortamento de flores/estruturas.`); } }
    if (geada) { tp += ` Há ${geada} dia${geada > 1 ? 's' : ''} com mínima prevista ≤ 3 °C.`; if (['trigo', 'aveia', 'milho2', 'feijao2'].includes(cid) && m) { pontos += 2; atencao.push('Risco de geada previsto para cultura sensível em ciclo de inverno/segunda safra.'); } }
    if (bh.diasEstresseFut && m && crit15 >= 20) { pontos += 1; atencao.push('Previsão de restrição hídrica coincidindo com fases críticas.'); }
    if (m && !c.semFenologia && p15 > 120) { const dist = distrib(c, m, semSel), fim = dist.reduce((t, v, i) => t + (i >= dist.length - 2 ? v : 0), 0); if (fim >= 20) { pontos += 1; atencao.push(`Chuva elevada prevista (${p15.toFixed(0)} mm) com ${fim.toFixed(0)}% da área em maturação/colheita: risco de perdas de qualidade e atraso na colheita.`); } }
    out.push(`<h4>Previsão (15 dias)</h4><p>${tp}</p>`);
    const ep = estacaoProxima(...(() => { const ct = turf.centroid(f).geometry.coordinates; return [ct[1], ct[0]]; })());
    if (ep) { const ds = Object.keys(ep.e.serie).slice(-30), pe = ds.reduce((t, d) => t + (ep.e.serie[d].p || 0), 0);
      out.push(`<p class="nota">Referência observada: estação INMET ${esc(ep.e.nome)} (${ep.d.toFixed(0)} km) registrou ${pe.toFixed(0)} mm nos últimos 30 dias com dados (até ${fmtD(deISO(ds.at(-1)))}).</p>`); }
  }
  // 4. campo
  const fts = FOTOS.filter(x => x.mun && String(+x.mun.properties.CD_MUN) === cd && (!cid || x.cult === cid));
  const rels = RELATOS.filter(r => r.muns.has(cd) && (!cid || r.cults.has(cid))).sort((a, b) => b.data - a.data);
  const relOutros = cid ? RELATOS.filter(r => r.muns.has(cd) && !r.cults.has(cid)).length : 0;
  let tc = '';
  if (fts.length) tc += `<p>${fts.length} foto${fts.length > 1 ? 's' : ''} de ${cult || 'lavouras'} no município, a mais recente de ${fmtD(new Date(Math.max(...fts.map(x => x.data))))}.</p>`;
  if (rels.length) { tc += `<p>${rels.length} relato${rels.length > 1 ? 's' : ''} de viagem cita${rels.length > 1 ? 'm' : ''} ${nome}${cid ? ' e ' + cult : ''}. Trechos mais relevantes:</p>`;
    rels.slice(0, 3).forEach(r => { const tr = trechos(r, p.NM_MUN, cid); tc += `<div class="nota"><b>${esc(r.nome)}</b> · ${fmtD(r.data)}</div>${tr.map(x => `<div class="trecho">“${esc(x)}”</div>`).join('') || '<div class="trecho">(o município é citado, sem trecho destacado)</div>'}`; }); }
  const ultVisita = Math.max(0, ...fts.map(x => +x.data), ...rels.map(r => +r.data));
  if (!ultVisita || HOJE - ultVisita > 30 * 864e5) { if (m) { pontos += 1; atencao.push('Sem fotos ou relatos de campo nos últimos 30 dias para este município.'); } }
  if (relOutros) tc += `<p class="nota">${relOutros} outro${relOutros > 1 ? 's' : ''} relato${relOutros > 1 ? 's' : ''} cita${relOutros > 1 ? 'm' : ''} o município sem mencionar ${cult}.</p>`;
  out.push(`<h4>Informações de campo${cult ? ' (' + cult + ')' : ''}</h4>${tc || `<p>Nenhuma foto ou relato da pasta da equipe se refere a ${cult ? cult + ' neste município' : 'este município'}.</p>`}`);
  if (!soDados) out.push(htmlCruzRelatos(cid, [cd]));
  // 5. síntese
  const nivel = pontos >= 5 ? ['Alta', '#b5452f'] : pontos >= 3 ? ['Média', '#d9822b'] : ['Baixa', '#5f8f2a'];
  if (soDados) return {cd, nome: p.NM_MUN, pontos, nivel, atencao, ks: bhR?.ksAtual, ksFut: bhR?.ksMinFut, diasFut: bhR?.diasEstresseFut, area: m?.area || 0, crit15};
  out.push(`<h4>Pontos de atenção</h4>${atencao.length ? `<ul>${atencao.map(a => `<li>${a}</li>`).join('')}</ul>` : '<p>Nenhum ponto de atenção identificado pelas regras automáticas.</p>'}
    <p>Prioridade sugerida de vistoria: <span class="prio" style="background:${nivel[1]}">${nivel[0]}</span> <span class="nota">(${pontos} pontos: fases críticas próximas, restrição hídrica, extremos de temperatura, chuva na colheita, atraso de semeadura e tempo desde a última visita)</span></p>
    <div class="aviso">Limitações: projeção fenológica por calendário médio (sem graus-dia); clima por município = ponto central, estimado por modelo; solos em escala 1:5.000.000; balanço hídrico FAO-56 com água disponível estimada pela textura, Kc de referência da cultura e condição inicial assumida. Confirme em campo antes de usar nas estimativas.</div>
    <button class="btn sec2" id="bt-copiar">Copiar texto da análise</button>`);
  ligarCopiar();
  return out.join('');
}
function ligarCopiar() {
  setTimeout(() => { const b = $('bt-copiar'); if (b) b.onclick = () => { const t = $('f-analise').innerText.replace(/Copiar texto da análise$/, '').trim(); navigator.clipboard?.writeText(t).then(() => { b.textContent = 'Copiado ✓'; }); }; });
}


// =====================================================================
// VISÃO DO ESTADO
// =====================================================================
function serieEstado(c) {      // curva estadual de plantio (ponderada pela área; sem área, média simples)
  const ms = Object.values(c.mun), serie = [];
  for (let k = 1; k <= 22; k++) { let sw = 0, sv = 0; for (const m of ms) { const w = m.area || 1; sw += w; sv += w * acum(m.serie, k); } serie.push(sw ? sv / sw : null); }
  return {serie, area: ms.reduce((t, m) => t + (m.area || 0), 0)};
}
function climaEstado(c) {      // série diária média do estado (ponderada pela área da cultura, se houver)
  if (!CL) return null;
  const pesos = pesosAlvo(c);
  const cds = Object.keys(pesos).filter(cd => CL.mun[cd]); if (!cds.length) return null;
  const out = {}; for (const k of ['p', 'tx', 'tn', 'et0']) out[k] = CL.datas.map((_, i) => { let sw = 0, sv = 0; for (const cd of cds) { const v = CL.mun[cd][k][i]; if (v == null) continue; sw += pesos[cd]; sv += pesos[cd] * v; } return sw ? sv / sw : null; });
  return {mc: out, cds, pesos};
}
function regioes(c, j) {
  const reg = {}; for (const [cd, m] of Object.entries(c.mun)) { const r = MUN_IDX[cd]?.properties.NM_RGI || '—'; (reg[r] ??= {}).mun ??= {}; reg[r].mun[cd] = m; }
  return Object.entries(reg).map(([r, o]) => { const pl = mediaMS(o, m => acum(m.serie, j)), cr = mediaMS(o, m => pctCritico(c, m, j)), ant = mediaMS(o, m => acum(m.serie, j - 1));
    return {r, n: Object.keys(o.mun).length, area: Object.values(o.mun).reduce((t, m) => t + (m.area || 0), 0), pl: pl?.v ?? 0, cr: cr?.v ?? 0, av: (pl?.v ?? 0) - (ant?.v ?? 0)}; });
}
function htmlGeralEstado() {
  const c = cultAlvo(), cid = c?.cid; let h = '';
  if (c?.semFenologia) {
    const l = Object.entries(c.mun).map(([cd, m]) => ({cd, m, f: MUN_IDX[cd]})).filter(x => x.f), tot = l.reduce((t, x) => t + x.m.area, 0);
    const reg = {}; l.forEach(x => { const r = x.f.properties.NM_RGI || '—'; reg[r] = (reg[r] || 0) + x.m.area; });
    h += `<h3>${esc(c.nome)}</h3><div class="kpis"><div class="kpi"><b>${tot >= 1e6 ? n1(tot / 1e6) + ' mi' : n0(tot / 1e3) + ' mil'}</b><span>ha mapeados ${CDS_ALVO ? 'na região' : 'no MS'}</span></div><div class="kpi"><b>${l.filter(x => x.m.area >= 100).length}</b><span>municípios com ≥ 100 ha</span></div><div class="kpi"><b>${Object.keys(reg).length}</b><span>regiões imediatas com cana</span></div></div>
      <h3>Maiores áreas</h3><table>${l.sort((a, b) => b.m.area - a.m.area).slice(0, 8).map(x => `<tr><td>${esc(x.f.properties.NM_MUN)}</td><td>${n0(x.m.area)} ha · ${n1(100 * x.m.area / tot)}%</td></tr>`).join('')}</table>
      <h3>Por região imediata</h3><table>${Object.entries(reg).sort((a, b) => b[1] - a[1]).map(([r, v]) => `<tr><td>${esc(r)}</td><td>${n0(v)} ha · ${n1(100 * v / tot)}%</td></tr>`).join('')}</table>
      <div class="nota">Mapeamento de uso e cobertura da Aprosoja-MS.</div>`;
  } else if (c) {
    const pl = mediaMS(c, m => acum(m.serie, semSel)), cr = mediaMS(c, m => pctCritico(c, m, semSel)), se = serieEstado(c), n = Object.keys(c.mun).length;
    h += `<h3>${esc(c.nome)} · semana de ${fmtD(dataSem(c, semSel))}${dataSem(c, semSel) > HOJE ? ' (projeção)' : ''}</h3>`;
    h += `<div class="kpis"><div class="kpi"><b>${pl ? pl.v.toFixed(0) : 0}%</b><span>plantado ${CDS_ALVO ? 'na região' : 'no MS'}${pl && !pl.pond ? ' (média simples)' : ''}</span></div><div class="kpi"><b>${cr ? cr.v.toFixed(0) : 0}%</b><span>em fase crítica</span></div><div class="kpi"><b>${se.area ? (se.area / 1e6).toLocaleString('pt-BR', {maximumFractionDigits: 1}) + ' mi' : '—'}</b><span>ha informados · ${n} munic.</span></div></div>`;
    const dist = new Array(c.estadios.length).fill(0); let sw = 0;
    for (const m of Object.values(c.mun)) { const w = m.area || 1; sw += w; distrib(c, m, semSel).forEach((v, i) => dist[i] += v * w); }
    h += `<table>${c.estadios.map((e, i) => dist[i] / sw >= .5 ? `<tr><td><i style="background:${corEstadio(c, i)}"></i>${esc(e.nome)}${e.critico ? ' ⚠' : ''}</td><td>${(dist[i] / sw).toFixed(0)}%</td></tr>` : '').join('')}</table>`;
    const cal = calendarioCritico(c, se);
    if (cal.length) h += `<div class="nota" style="margin-top:8px">Metade da área semeada ${CDS_ALVO ? 'na região' : 'no estado'} atinge (projeção):</div><table>${cal.map(([e, dt]) => `<tr><td>${esc(e)}</td><td>${dt ? fmtD(dt) : '—'}</td></tr>`).join('')}</table>`;
    h += `<h3>Por região imediata</h3><table>${regioes(c, semSel).sort((a, b) => b.area - a.area || a.r.localeCompare(b.r)).map(r => `<tr><td>${esc(r.r)} <span class="nota" style="margin:0">(${r.n})</span></td><td>${r.pl.toFixed(0)}% · crít. ${r.cr.toFixed(0)}%</td></tr>`).join('')}</table>`;
  } else h += `<div class="aviso">Escolha uma cultura em “Safra e cultura” para filtrar a visão ${CDS_ALVO ? 'da região' : 'do estado'}${PL ? '' : ' (as culturas anuais aparecem ao conectar a pasta da equipe)'}.</div>`;
  if (CL) { const ce = climaPonderado(pesosAlvo(c));
    if (ce) { let k3 = null; if (c) { let sw = 0, sr = 0; for (const [k, b] of Object.entries(bhCultura(c) || {})) { if (!(b.campoAtual > 0) || !c.mun[k]) continue; const w = c.mun[k]?.area || 1; sw += w; if (b.ksAtual < .99) sr += w; }
        if (sw) k3 = `<div class="kpi"><b style="color:${sr / sw >= .2 ? CLS_AG[2].cor : 'var(--tinta)'}">${(100 * sr / sw).toFixed(0)}%</b><span>da área com restrição hídrica hoje</span></div>`; }
      h += htmlClimaResumo(ce.mc, null, c, k3).replace('<h3>Clima e água no solo</h3>', `<h3>Clima e água no solo${c ? ' · áreas de ' + esc(c.nome.toLowerCase()) : ''}</h3>`); } }
  const sc = c ? soloCulturaAlvo(cid) : null;
  if (sc) { const tb = (o, cores) => Object.entries(o).filter(([, v]) => v >= .5).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td><i style="background:${cores[k] || '#bdbdbd'}"></i>${esc(k)}</td><td>${v.toFixed(0)}%</td></tr>`).join('');
    h += `<h3>Solos sob ${esc(c.nome.toLowerCase())} ${CDS_ALVO ? 'na região' : 'no MS'}</h3><div class="subt">Textura do solo</div><table>${tb(sc.textura, CORES_TEX)}</table><div class="subt">Classe de solo</div><table>${tb(sc.ordem, CORES_ORDEM)}</table><div class="nota">${n0(sc.area)} ha mapeados (Aprosoja-MS) × solos 1:5.000.000.</div>`; }
  else if (!c) h += htmlSoloCultura(null);
  const fts = FOTOS.filter(p => (!cid || p.cult === cid) && fotoNaRegiao(p)), rels = RELATOS.filter(r => (!cid || r.cults.has(cid)) && naRegiao(r));
  if (fts.length || rels.length) { const pc = {}; fts.forEach(p => pc[p.cult] = (pc[p.cult] || 0) + 1);
    h += `<h3>Fotos e relatos de campo${c ? ' · ' + esc(c.nome.toLowerCase()) : ''}</h3><div class="nota">${fts.length} foto${fts.length === 1 ? '' : 's'}${c ? '' : ` (${Object.entries(pc).map(([k, v]) => `${esc((CULT[k] || OUTRA).nome)} ${v}`).join(', ')})`} · ${rels.length} relato${rels.length === 1 ? '' : 's'}${rels.length ? ' (último: ' + esc(rels[0].nome) + ', ' + fmtD(rels[0].data) + ')' : ''}</div>`; }
  return h;
}
function trechosCultura(rel, cid, max = 2) {
  const ps = PALAVRAS_CULT[cid] || []; if (!ps.length) return [];
  return rel.texto.split(/(?<=[.!?;])\s+|\n+/).map(x => x.trim()).filter(x => x.length > 25 && ps.some(p => norm(x).includes(p))).slice(0, max).map(x => x.length > 320 ? x.slice(0, 317) + '…' : x);
}
function gerarAnaliseEstado() {
  const c = cultAlvo(), out = [], cid = c?.cid, cult = c ? esc(c.nome.toLowerCase()) : null;
  out.push(`<div class="aviso">Análise automática ${CDS_ALVO ? 'da região selecionada (' + CDS_ALVO.length + ' municípios)' : 'do estado'} gerada em ${fmtDL(HOJE)} a partir dos dados do painel. Indica situações a verificar e não substitui o levantamento de campo; associações entre indicadores não implicam causa.</div>`);
  if (!c) { out.push('<p>Conecte a pasta da equipe para gerar a análise estadual por cultura.</p>'); return out.join(''); }
  // 1. plantio (cana: área mapeada)
  if (c.semFenologia) {
    const l = Object.entries(c.mun).filter(([cd]) => MUN_IDX[cd]).sort((a, b) => b[1].area - a[1].area), tot = l.reduce((t, [, m]) => t + m.area, 0);
    out.push(`<h4>Área da cultura</h4><p>O mapeamento da Aprosoja-MS indica <b>${tot >= 1e6 ? n1(tot / 1e6) + (tot >= 2e6 ? ' milhões' : ' milhão') : n0(tot / 1e3) + ' mil'} de ha</b> de cana-de-açúcar ${CDS_ALVO ? 'na região selecionada' : 'em Mato Grosso do Sul'}. Os maiores municípios são ${l.slice(0, 5).map(([cd, m]) => `${esc(MUN_IDX[cd].properties.NM_MUN)} (${n0(m.area / 1000)} mil ha)`).join(', ')}. A cana não tem acompanhamento fenológico na planilha; as demais seções usam a área mapeada como peso.</p>`);
  } else {
  const pl = mediaMS(c, m => acum(m.serie, semSel)), ant = mediaMS(c, m => acum(m.serie, semSel - 1)), se = serieEstado(c), dS = dataSem(c, semSel);
  const regs = regioes(c, semSel).filter(r => r.area || r.n).sort((a, b) => b.pl - a.pl);
  let t = `${dS > HOJE ? 'A projeção para a semana de ' + fmtD(dS) + ' indica' : 'Até a semana de ' + fmtD(dS) + ', a semeadura de ' + cult + (CDS_ALVO ? ' na região selecionada' : ' em Mato Grosso do Sul') + ' atingiu'} <b>${pl ? pl.v.toFixed(0) : 0}%</b> da área${pl?.pond ? ' (média ponderada pela área informada)' : ''}, com avanço de ${pl && ant ? (pl.v - ant.v).toFixed(0) : 0} pontos percentuais na última semana.`;
  if (regs.length > 2) t += ` As regiões mais adiantadas são ${regs.slice(0, 2).map(r => `${esc(r.r)} (${r.pl.toFixed(0)}%)`).join(' e ')}; as mais atrasadas, ${regs.slice(-2).reverse().map(r => `${esc(r.r)} (${r.pl.toFixed(0)}%)`).join(' e ')}.`;
  out.push(`<h4>Situação da safra ${CDS_ALVO ? 'na região' : 'no estado'}</h4><p>${t}</p>`);
  const cal = calendarioCritico(c, se).filter(x => x[1]); let crit15 = 0; for (let j = semSel; j <= semSel + 2; j++) crit15 = Math.max(crit15, mediaMS(c, m => pctCritico(c, m, j))?.v || 0);
  if (cal.length) out.push(`<p>Pela projeção, metade da área semeada ${CDS_ALVO ? 'na região' : 'no estado'} entra em ${esc(cal[0][0])} por volta de <b>${fmtD(cal[0][1])}</b>${cal.length > 1 ? ` e em ${esc(cal.at(-1)[0])} por volta de ${fmtD(cal.at(-1)[1])}` : ''}. ${crit15 >= 1 ? `Nas próximas três semanas, até <b>${crit15.toFixed(0)}%</b> da área estará em fases críticas.` : 'Nas próximas três semanas, a área ainda não deve estar em fases críticas.'}</p>`);
  }
  // 2. solos da cultura
  const sc = soloCulturaAlvo(cid);
  if (sc) { const tc = Object.entries(sc.textura).sort((a, b) => b[1] - a[1]), oc = Object.entries(sc.ordem).sort((a, b) => b[1] - a[1]);
    out.push(`<h4>Solos ocupados pela cultura</h4><p>Pelo mapa de uso da Aprosoja-MS (${n0(sc.area)} ha de ${esc(sc.nome.toLowerCase())} mapeados), a área se distribui assim por textura do solo: ${tc.map(([k, v]) => `${v.toFixed(0)}% ${esc(k.toLowerCase())}`).join('; ')}. Por classe, predominam ${oc.slice(0, 3).map(([k, v]) => `${esc(k.toLowerCase())}s (${v.toFixed(0)}%)`).join(', ')}. ${(sc.textura['Arenosa'] || 0) >= 10 ? `A fração em solos arenosos (${sc.textura['Arenosa'].toFixed(0)}%) é a mais sensível a veranicos.` : 'A maior parte da área está em solos de média a alta retenção de água.'} <span class="nota">(Solos 1:5.000.000.)</span></p>`); }
  // 3. água no solo por município
  const linhas = []; let aR = 0, aRF = 0, aT = 0;
  if (CL) for (const [cd, m] of Object.entries(c.mun)) {
    const mc = CL.mun[cd], f = MUN_IDX[cd]; if (!mc || !f) continue;
    const cad = cadMun(cid, cd), bh = balancoHidrico(mc, cad, c, m, cd), w = m.area || 1;
    aT += w; if (bh.ksAtual < 1) aR += w; if (bh.diasEstresseFut) aRF += w; linhas.push({cd, nome: f.properties.NM_MUN, w, bh});
  }
  if (aT) {
    const rest = linhas.filter(l => l.bh.ksAtual < 1).sort((a, b) => b.w - a.w), restF = linhas.filter(l => !(l.bh.ksAtual < 1) && l.bh.diasEstresseFut).sort((a, b) => b.w - a.w);
    out.push(`<h4>Água no solo (balanço hídrico FAO-56 por município)</h4><p>Hoje, <b>${(100 * aR / aT).toFixed(0)}%</b> da área de ${cult} com dados está em municípios com restrição hídrica (Ks &lt; 1)${rest.length ? `: ${rest.slice(0, 8).map(l => esc(l.nome)).join(', ')}${rest.length > 8 ? ` e mais ${rest.length - 8}` : ''}` : ''}. Mantida a previsão de 15 dias, <b>${(100 * aRF / aT).toFixed(0)}%</b> da área terá dias de restrição${restF.length ? `, incluindo municípios hoje sem restrição como ${restF.slice(0, 5).map(l => esc(l.nome)).join(', ')}` : ''}.</p>`);
  }
  const ce = climaEstado(c);
  if (ce) { const mc = ce.mc, h0 = iHoje(), s = (k, i0, i1) => mc[k].slice(Math.max(0, i0), i1).reduce((t, x) => t + (x || 0), 0);
    const geada = ce.cds.filter(cd => CL.mun[cd].tn.slice(h0, h0 + 15).some(t => t != null && t <= 3)).map(cd => MUN_IDX[cd]?.properties.NM_MUN).filter(Boolean);
    const calor = ce.cds.filter(cd => CL.mun[cd].tx.slice(h0, h0 + 15).some(t => t != null && t >= 35)).length;
    const pz = {}; for (const [k, m] of Object.entries(c.mun)) pz[k] = m.area || 1; const cp = climaPonderado(pz)?.mc, c7 = cp ? concordancia(totaisModelos(cp, h0, h0 + 7)) : null;
    out.push(`<h4>Clima nas áreas da cultura</h4><p>Nos últimos 30 dias, a chuva média ponderada pela área foi de ${s('p', h0 - 30, h0).toFixed(0)} mm (estimativa de modelo), e a previsão para os próximos 15 dias é de ${s('p', h0, h0 + 15).toFixed(0)} mm${c7 ? `; nos próximos 7 dias os modelos variam de ${c7.mn.toFixed(0)} a ${c7.mx.toFixed(0)} mm (concordância ${c7.nivel})` : ''}. ${calor ? `${calor} município${calor > 1 ? 's' : ''} com a cultura ${calor > 1 ? 'têm' : 'tem'} máxima prevista ≥ 35 °C. ` : ''}${geada.length ? `Há previsão de mínima ≤ 3 °C em ${geada.length} município${geada.length > 1 ? 's' : ''} (${geada.slice(0, 6).map(esc).join(', ')}${geada.length > 6 ? '…' : ''}).` : ''}</p>`); }
  // 4. campo
  const fts = FOTOS.filter(x => x.cult === cid && fotoNaRegiao(x)), rels = RELATOS.filter(r => r.cults.has(cid) && naRegiao(r));
  let tc = `<p>${fts.length} foto${fts.length === 1 ? '' : 's'} de ${cult} e ${rels.length} relato${rels.length === 1 ? '' : 's'} que citam a cultura.</p>`;
  rels.filter(r => !r.fatos?.length).slice(0, 3).forEach(r => { const tr = trechosCultura(r, cid); if (tr.length) tc += `<div class="nota"><b>${esc(r.nome)}</b> · ${fmtD(r.data)}</div>${tr.map(x => `<div class="trecho">“${esc(x)}”</div>`).join('')}`; });
  out.push(`<h4>Informações de campo</h4>${tc}`);
  out.push(htmlCruzRelatos(cid, CDS_ALVO));
  // 5. prioridades
  const rank = Object.keys(c.mun).map(cd => MUN_IDX[cd]).filter(Boolean).map(f => gerarAnalise(f, true)).sort((a, b) => b.pontos - a.pontos || b.area - a.area);
  const cont = {Alta: 0, 'Média': 0, Baixa: 0}; rank.forEach(r => cont[r.nivel[0]]++);
  out.push(`<h4>Prioridades de vistoria</h4><p>Pelas regras automáticas: ${cont.Alta} município${cont.Alta === 1 ? '' : 's'} com prioridade alta, ${cont['Média']} média e ${cont.Baixa} baixa.</p>
    <table>${rank.slice(0, 12).map(r => `<tr><td><span class="prio" style="background:${r.nivel[1]};font-size:11px">${r.nivel[0]}</span> ${esc(r.nome)}<div class="nota" style="margin:2px 0 0">${r.atencao[0] ? r.atencao[0].replace(/<[^>]+>/g, '') : 'sem ponto de atenção'}</div></td><td>${r.pontos} pt</td></tr>`).join('')}</table>`);
  out.push(`<div class="aviso">Limitações: projeção fenológica por calendário médio; clima por município no ponto central (modelo); solos em escala 1:5.000.000; balanço hídrico FAO-56 com água disponível estimada pela textura. Confirme em campo.</div><button class="btn sec2" id="bt-copiar">Copiar texto da análise</button>`);
  return out.join('');
}

// =====================================================================
// METODOLOGIA (somente leitura)
// =====================================================================
function abrirModal(tit, html, classe) { $('m-tit').textContent = tit; $('m-corpo').innerHTML = html; $('modal').querySelector('.caixa').classList.toggle('larga', classe === 'larga'); $('modal').hidden = false; $('m-corpo').scrollTop = 0; }
$('m-fechar').onclick = () => { $('modal').hidden = true; };
$('modal').onclick = e => { if (e.target.id === 'modal') $('modal').hidden = true; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('modal').hidden = true; });
$('bt-metodo').onclick = () => abrirModal('Metodologia do painel', `<div class="metodo" oncontextmenu="return false">${METODOLOGIA}</div>`);
const METODOLOGIA = `
<h3>1. Objetivo</h3>
<p>O painel integra, em um único mapa, as informações que influenciam o desenvolvimento das lavouras em Mato Grosso do Sul — evolução da semeadura, fenologia, solos, uso do solo, clima observado e previsto, infraestrutura e observações de campo — para apoiar o levantamento de safras da Conab (SUREG-MS / SEGEO-MS). Ele não produz estimativas oficiais: organiza e cruza dados para orientar a análise técnica e as vistorias.</p>
<h3>2. Fontes de dados</h3>
<table><tr><th>Informação</th><th>Fonte</th><th>Atualização</th></tr>
<tr><td>Limites municipais</td><td>IBGE, malha municipal 2025 (SIRGAS 2000)</td><td>Fixa</td></tr>
<tr><td>Solos (classe e textura)</td><td>Mapa de Solos do Brasil, IBGE/Embrapa, escala 1:5.000.000</td><td>Fixa</td></tr>
<tr><td>Uso e cobertura (soja, cana, milho 2ª safra, sorgo, algodão)</td><td>Mapeamentos vetoriais de uso e cobertura da Aprosoja-MS: 1ª safra 2025/26 (arquivo MS26S1UCS: cana-de-açúcar e demais ocupações; a soja passou a vir do mapeamento da Conab) e 2ª safra 2025 (arquivo MS25S2: milho 2ª safra, sorgo e algodão). Do mapa de 2ª safra foram extraídas só as culturas anuais acompanhadas pela Conab (milheto e demais usos ficaram de fora). Do mapa de 1ª safra também foram extraídos, só como referência visual, milho 1ª safra, pastagem, vegetação remanescente, eucalipto, pinus, seringueira e outros usos; pastagem e vegetação remanescente foram simplificadas em 100 m para caber no repositório (as áreas exibidas são as do mapeamento original)</td><td>Quando novos arquivos são enviados</td></tr>
<tr><td>Soja</td><td>Mapeamento de soja de MS da Conab e do Inpe, safra 2024/25: classificação híbrida (supervisionada com Random Forest no Brazil Data Cube + interpretação visual) de imagens Sentinel-2, escala 1:100.000 (4,22 milhões de ha). Substitui o mapa de soja da Aprosoja-MS</td><td>Quando novos arquivos são enviados</td></tr>
<tr><td>Arroz irrigado</td><td>Mapeamento de arroz irrigado de MS da Conab (SEGEO-MS), safra 2023/24: interpretação visual de imagens Sentinel-2 (10 m) com apoio do SATVEG/Embrapa e de levantamentos de campo, escala 1:2.000 a 1:6.000 (9.952 ha em 9 municípios)</td><td>Quando novos arquivos são enviados</td></tr>
<tr><td>Rodovias federais e estaduais</td><td>Base vetorial de rodovias de MS fornecida à SEGEO-MS (nome, jurisdição, revestimento, extensão)</td><td>Quando novos arquivos são enviados</td></tr>
<tr><td>Evolução do plantio</td><td>Planilha semanal preenchida pelos técnicos da SEGEO-MS (% acumulado da área plantada por município)</td><td>Semanal, lida da pasta da equipe</td></tr>
<tr><td>Previsão diária por município (16 dias)</td><td>Open-Meteo: média de seis modelos globais (ECMWF IFS, NOAA GFS, DWD ICON, CMC GEM, JMA e UK Met Office), no ponto central de cada município, com a faixa entre os modelos</td><td>Diária (06h)</td></tr>
<tr><td>Estimativa dos últimos 92 dias por município</td><td>Open-Meteo, opção “best match”: o modelo de maior resolução disponível para o local (um modelo, não média)</td><td>Diária (06h)</td></tr>
<tr><td>Histórico diário por município</td><td>Reanálise ERA5 (Copernicus/ECMWF) via Open-Meteo Archive desde 01/07/2025, complementada pela análise do modelo nos dias mais recentes</td><td>Diária, acumulativa</td></tr>
<tr><td>Estações meteorológicas</td><td>INMET, estações automáticas de MS (arquivo anual de dados históricos)</td><td>Diária; o INMET publica com algumas semanas de atraso</td></tr>
<tr><td>Fotos e relatos de campo</td><td>Pasta compartilhada da equipe (ConabCloud)</td><td>Sempre que a pasta é conectada</td></tr></table>
<h3>3. Processamento automático</h3>
<p>Os arquivos geográficos colocados no repositório são convertidos por uma rotina automática (GitHub Actions) para o sistema WGS 84, recortados ao limite do estado e simplificados para exibição (tolerância de ~100 m a ~200 m). A área das classes de uso é calculada antes da simplificação, em projeção equivalente. A mesma rotina busca diariamente os dados de clima e os grava em um <b>histórico permanente por ano</b>: dias já registrados nunca são apagados, e uma estimativa de modelo só é substituída pela reanálise ERA5, que é a série consolidada. Todo o repositório tem versionamento, o que permite recuperar qualquer estado anterior.</p>
<h3>4. Dados da equipe (pasta local)</h3>
<p>A planilha de plantio, as fotos e os relatos são lidos diretamente da pasta sincronizada do ConabCloud no computador de quem usa o painel. Esses arquivos <b>não são publicados</b> nem enviados para a internet. Todas as planilhas de plantio da pasta são lidas, uma por safra (identificada pelo nome do arquivo, por exemplo “2026-27”), preservando o histórico das safras anteriores.</p>
<h3>5. Projeção fenológica</h3>
<p>Para cada cultura, a aba “Parâmetros” da planilha define a data da primeira semana e o número de dias após a semeadura em que começa cada estádio (ciclo médio, valores de referência ajustáveis pela equipe). A área semeada em cada semana é deslocada no tempo segundo esses dias, arredondados para semanas inteiras. A fração da área em um estádio é a diferença entre a área que já atingiu esse estádio e a que já atingiu o seguinte. Quando uma semana não é preenchida, repete-se o último valor informado. A data em que “metade da área semeada” atinge um estádio é calculada sobre o total semeado até o momento.</p>
<p>As médias do estado são ponderadas pela área estimada informada na planilha; sem área, usa-se média simples (indicado no painel).</p>
<h3>6. Clima por município</h3>
<p><b>Previsão por vários modelos.</b> Para os próximos 16 dias, a rotina diária pede ao Open-Meteo a previsão de cada modelo separadamente e calcula, para cada dia e município, a média dos modelos disponíveis naquele dia (chuva, temperaturas, vento e ET0). O horizonte varia: ICON e UKMO cobrem cerca de 7 dias, GEM 10, JMA 11, ECMWF 15 e GFS 16; nos últimos dias da previsão a média usa menos modelos (indicado no gráfico). A média de vários modelos costuma errar menos que um modelo isolado, principalmente a partir do 4º ou 5º dia, mas suaviza chuvas intensas e localizadas. Por isso o painel mostra também a faixa entre os modelos e os totais de cada um. <b>Concordância</b> (convenção do painel, sobre o total de chuva do período): alta quando a diferença entre o modelo mais chuvoso e o mais seco é de até 40% da média ou até 10 mm; média até 80% ou 20 mm; baixa acima disso. A camada de clima tem a variável “Divergência entre modelos”, com essa diferença em mm.</p>
<p><b>Dias passados.</b> Os últimos 92 dias vêm da opção “best match” do Open-Meteo, que usa, para cada local, o modelo de maior resolução disponível (um único modelo, sem média). Cerca de 5 dias depois, o histórico permanente passa a usar a reanálise ERA5, recalculada com observações.</p>
<p><b>Chuva do modelo × estações INMET.</b> Para cada estação automática do INMET em MS, a rotina compara a chuva diária medida com a do modelo no ponto da estação (reanálise ERA5 e estimativa recente): totais, viés, correlação diária e das somas semanais, porcentagem de dias em que estação e modelo concordam sobre chover ou não (limiar de 1 mm) e porcentagem dos dias chuvosos da estação que o modelo detectou. Essa comparação é só descritiva: a chuva não é corrigida, porque o erro do modelo na chuva varia muito de um evento para outro. Ela aparece na janela de clima.</p>
<p><b>Janela de clima.</b> O botão “Abrir clima e água no solo”, na ficha do município ou do estado, abre a previsão por modelo, o histórico, a comparação com a estação INMET mais próxima e o balanço hídrico da cultura escolhida. No estado e na região selecionada, os valores são médias dos municípios ponderadas pela área da cultura.</p>
<p><b>Período do histórico.</b> A coluna “Histórico” abre com os últimos 30 dias, mas o período pode ser escolhido (datas ou atalhos de 15, 30, 60 e 90 dias e desde o início da semeadura), a partir de 01/07/2025. Para o período são calculados chuva, ET0 (ajustada pelas estações INMET), saldo chuva − ET0, dias com chuva (≥ 1 mm) e com 20 mm ou mais, maior chuva diária, maior sequência sem chuva, médias e extremos de temperatura e somas por decêndio (dias 1–10, 11–20 e 21–fim do mês; por mês em períodos acima de ~4 meses). Quando o histórico cobre, o mesmo período do ano anterior é mostrado para comparação. A fonte é a reanálise ERA5 nos dias já consolidados e a estimativa do modelo de maior resolução nos dias mais recentes; a previsão não muda com o período escolhido.</p>
<p>Os valores representam o ponto central (centróide) de cada município. Para os dias passados, são <b>estimativas de modelo ou reanálise</b>, não medições; as estações do INMET são exibidas como referência observada. Indicadores: chuva acumulada, chuva menos evapotranspiração de referência (FAO-56, Penman-Monteith), temperaturas extremas, amplitude térmica, vento máximo e dias seguidos sem chuva (dias com menos de 1 mm).</p>
<h3>7. Evapotranspiração e balanço hídrico</h3>
<p><b>Evapotranspiração de referência (ET0).</b> Vem da Open-Meteo (variável <i>et0_fao_evapotranspiration</i>), calculada pelo método FAO-56 Penman-Monteith (Allen et al., 1998) com temperatura, umidade, vento a 2 m, radiação solar e pressão estimados pelos modelos (previsão) ou pela reanálise ERA5 (histórico). As variáveis de entrada são estimadas por modelo no ponto central do município, e não medidas.</p>
<p><b>Validação e ajuste pelas estações INMET.</b> Para cada estação automática do INMET em MS, a rotina diária calcula a ET0 Penman-Monteith FAO-56 com os dados horários da própria estação: temperaturas máxima e mínima, umidades relativas máxima e mínima, vento médio convertido de 10 m para 2 m (fator 0,748) e radiação global medida, com o saldo de radiação calculado segundo o capítulo 3 da FAO-56. O cálculo foi conferido com o Exemplo 18 do Boletim 56 (3,9 mm/dia). Essa ET0 é comparada com a do modelo no mesmo ponto, separadamente para a reanálise ERA5 e para o modelo de previsão. São calculados número de dias, médias, viés (mm/dia e %), RMSE e correlação, exibidos no popup de cada estação. O fator de ajuste é a razão entre as médias (estação ÷ modelo). Ele só é usado com pelo menos 30 dias comparados, fica limitado entre 0,7 e 1,3 e é interpolado para cada município pelo inverso do quadrado da distância das estações a até 150 km. Quando não há estação válida, usa-se a ET0 do modelo sem ajuste.</p>
<p><b>Coeficiente de cultura (Kc).</b> Os valores de referência são os da FAO-56 (tabela 12) para cada cultura (Kc inicial / médio / final): soja 0,40 / 1,15 / 0,50; milho 0,30 / 1,20 / 0,60; sorgo 0,30 / 1,05 / 0,55; amendoim 0,40 / 1,15 / 0,60; arroz 1,05 / 1,20 / 0,75; feijão 0,40 / 1,15 / 0,35; algodão 0,35 / 1,18 / 0,60; trigo 0,30 / 1,15 / 0,30; aveia 0,30 / 1,15 / 0,25. Podem ser substituídos pela equipe na aba Parâmetros da planilha. A curva de Kc segue os estádios da planilha: valor inicial até o segundo estádio, subida linear até o primeiro estádio crítico, valor médio até o fim das fases críticas e queda linear até a colheita. Na área colhida ou não semeada usa-se 0,30 (solo com palhada). Cada semana de semeadura é tratada como um grupo com sua própria idade, e o Kc do município é a média ponderada pela área semeada em cada semana.</p>
<p><b>Balanço hídrico da zona radicular (FAO-56, capítulo 8).</b> O cálculo é diário, de 45 dias antes de hoje até 15 dias de previsão. A água total disponível (TAW) é estimada pela textura predominante para 60 cm de raízes (arenosa ~40 mm, média ~65 mm, argilosa ~90 mm). A água facilmente disponível é RAW = p·TAW, com p de cada cultura (tabela 22; soja 0,50, milho 0,55, feijão 0,45, algodão 0,65 etc.), ajustado pela demanda do dia (p + 0,04·(5 − ETc)). Quando a depleção ultrapassa a RAW, a evapotranspiração real é reduzida pelo coeficiente de estresse Ks = (TAW − Dr)/((1 − p)·TAW). A chuva entra integralmente, e o excedente acima da capacidade é perdido por drenagem. A depleção inicial é assumida em 50% da TAW, e os primeiros 15 dias servem de ajuste. Ks &lt; 1 indica restrição hídrica.</p>
<p><b>Camada “Água no solo” e gráfico do município.</b> Para a cultura escolhida, cada município é classificado pelo balanço acima, com a demanda própria da cultura (ETc = ET0 × Kc da fase em que a área semeada está) e o seu limite de estresse (p). Modos: <i>Hoje</i> e <i>Pior dia (15 dias)</i> usam o Ks: atendida (Ks = 1), restrição leve (0,7 a 0,99), moderada (0,4 a 0,7) e severa (abaixo de 0,4). <i>Demanda atendida</i> é o consumo estimado (ETa) dividido pelo consumo potencial (ETc) nos dias com lavoura em campo: atendida (95% ou mais), leve (80 a 95%), moderada (60 a 80%) e severa (abaixo de 60%). Municípios sem área semeada ou já colhida no período aparecem em cinza. Os limites das classes são convenções do painel para leitura rápida, não limiares de perda de produtividade. O gráfico da ficha mostra a água no solo dia a dia (45 dias passados e 15 de previsão, em tracejado), a linha de início do estresse (1 − p), a chuva diária e uma fita com a classe de Ks de cada dia. Quando há mais de uma cultura em campo no município, a ficha compara Kc, demanda, água e Ks entre elas.</p>
<p><b>Cana-de-açúcar.</b> A cana não tem acompanhamento fenológico na planilha. Ela aparece na seleção de cultura como “sem fenologia”: a área por município vem do mapeamento da Aprosoja-MS, e o balanço hídrico usa Kc médio anual de 1,0, que é um valor aproximado para canaviais com idades misturadas, entre os valores da FAO-56 (0,40 no início, 1,25 no pico e 0,75 no fim). Usa também p = 0,65 (tabela 22) e raízes até 120 cm (a FAO-56 indica 1,2 a 2,0 m), o que dobra a água disponível em relação às culturas anuais. Kc e profundidade são convenções do painel e devem ser revistos com a equipe.</p>
<p><b>Filtro por cultura.</b> A cultura escolhida em “Safra e cultura” filtra a ficha, a análise, a camada de água no solo, as fotos no mapa (opção “só a cultura selecionada”, ligada por padrão) e os relatos (só os que citam a cultura; os demais são contados à parte).</p>
<h3>8. Fotos de campo</h3>
<p>A cultura de cada foto é identificada pela subpasta (por exemplo “04_Fotos_Campo/Soja”). A posição é lida do GPS gravado na foto (EXIF). Quando a foto não tem GPS, como as enviadas pelo WhatsApp, o painel lê por reconhecimento de texto (OCR) o carimbo de data e coordenadas impresso na imagem pelo aplicativo de câmera. São tentados textos vermelhos, amarelos e brancos (no branco, exige-se contorno escuro), no rodapé e no topo da foto, com uma segunda leitura restrita a dígitos. Leituras com o separador decimal perdido são reparadas apenas quando o resultado cai dentro da faixa geográfica de MS (17°–24,3° S; 50,7°–58,4° O). Entre as datas lidas, vale a mais frequente. O município é obtido pela sobreposição do ponto com a malha municipal.</p>
<h3>8a. Solos ocupados por cada cultura</h3>
<p>Para as culturas com mapa de uso e cobertura (soja e cana-de-açúcar da 1ª safra 2025/26; milho 2ª safra, sorgo e algodão da 2ª safra 2025, todos da Aprosoja-MS), a rotina automática sobrepõe os polígonos da cultura ao mapa de solos e à malha municipal, em projeção de áreas iguais, e soma a área (ha) por classe e por textura de solo, em cada município e no estado. Esses percentuais aparecem na camada de uso (barras de textura e classe, no estado e no município selecionado), na ficha, na análise e no resumo em PDF. Na análise, a água disponível usada no balanço hídrico passa a ser a das áreas ocupadas pela cultura, e não a do município inteiro. A escala do mapa de solos (1:5.000.000) limita a interpretação ao nível regional.</p>
<h3>8b. Visão do estado e de regiões</h3>
<p>A ficha do estado agrega os municípios com dados: médias ponderadas pela área informada, distribuição por estádio, calendário das fases críticas a partir da curva estadual de semeadura e indicadores por região imediata. O clima é a média diária dos municípios com a cultura, ponderada pela área. A análise estadual roda o balanço hídrico de cada município, informa a fração da área com restrição hídrica (Ks &lt; 1) hoje e na previsão, e ordena os municípios pela pontuação de prioridade de vistoria.</p>
<p><b>Seleção de região.</b> Com a tecla Ctrl (Cmd no Mac) pressionada, cada clique no mapa soma ou retira um município da seleção. A ficha, a análise e a janela de clima passam a valer para o conjunto escolhido, com as mesmas regras da visão estadual (médias ponderadas pela área da cultura nos municípios selecionados, solos somados nesses municípios, relatos e fotos que citam algum deles). Um clique sem Ctrl volta à análise de um único município; fechar a ficha limpa a seleção.</p>
<h3>9. Relatos de viagem</h3>
<p>São lidos arquivos .docx, .odt, .pdf, .txt e .md da pasta de relatos. A subpasta define o grupo: relatos dentro de uma subpasta “Cana” são atribuídos à cana-de-açúcar; relatos dentro de “Grãos” (que inclui algodão) têm as culturas identificadas por palavras-chave, sem contar citações de cana. Fora dessas subpastas, todas as culturas são identificadas por palavras-chave. A data vem do nome do arquivo (AAAA-MM-DD), da primeira data no texto ou da data de modificação. Os municípios citados são identificados pelo nome (com inicial maiúscula, ignorando acentos) e as culturas por palavras-chave. Cada relato é lido por regras que extraem fatos: percentuais de plantio, atraso e dias de operações paradas, replantio (ha), mudança de uso (por exemplo, soja convertida em eucalipto), área da safra atual e anterior, clima citado (excesso ou falta de chuva, nebulosidade, calor, frio), pragas e doenças com a intensidade, estádios (V4, R1…), prazo de plantio, preço, custo de produção, produtividade, diesel e crédito. O escopo de cada fato é o município citado na mesma frase ou, sem citação, o conjunto de municípios do roteiro da viagem.</p>
<p><b>Cruzamento com o painel.</b> Os fatos são comparados com as demais bases: o percentual relatado com a planilha da equipe na semana do relato (diferença de até 12 p.p. = coerente); o atraso relatado com a posição da região em relação ao estado; o ritmo das duas últimas semanas da planilha com o prazo citado (data provável de 95% plantado); os estádios relatados com a projeção fenológica; o replantio como % da área da cultura no roteiro; o clima relatado com a chuva, a ET0, os dias com chuva e a maior sequência chuvosa dos 30 dias anteriores (modelo); pragas de ambiente úmido com períodos chuvosos; mudanças de uso com os mapas de uso do solo; a área relatada com a da planilha (diferença de até 15% = coerente); e custo, preço e produtividade citados para calcular o ponto de equilíbrio (kg/ha), a margem e o preço de equilíbrio. Cada cruzamento recebe uma marca (coerente, diverge, atenção, novo) para orientar a conferência. É leitura automática: números e termos fora dos padrões previstos não são captados, e o texto original deve ser consultado.</p>
<h3>10. Análise agronômica automática e prioridade de vistoria</h3>
<p>O texto da análise é montado por regras explícitas a partir dos itens acima. A prioridade de vistoria soma pontos para: área em fases críticas nas próximas três semanas (≥ 30%), restrição hídrica atual (Ks &lt; 1), calor ≥ 35 °C ou déficit hídrico previsto durante fases críticas, risco de geada em culturas sensíveis, chuva elevada na maturação ou colheita, semeadura atrasada em relação ao estado e ausência de informação de campo nos últimos 30 dias (Alta ≥ 5 pontos; Média 3–4; Baixa ≤ 2).</p>
<h3>11. Resumo da safra (PDF)</h3>
<p>O resumo é escrito em texto corrido, em ordem cronológica. A primeira página traz o panorama do período (o tempo nas áreas agrícolas e uma frase por cultura) e os números principais. Cada cultura conta como andou a semeadura (início, semanas de maior e menor avanço com a chuva de cada semana, situação na última atualização da planilha, comparação com a safra anterior quando a planilha a tiver, diferenças entre regiões e projeção pelo ritmo recente), o tempo por quinzena e a água no solo, o que vem pela frente (fases e previsão) e o que o campo contou (relatórios de viagem lidos e cruzados como no item 9). Dois gráficos acompanham o texto: a semeadura semana a semana (com a chuva de cada semana) e a falta de água no período, que mostra, dia a dia, a parcela da área com lavoura em campo em restrição leve, moderada ou severa pelo balanço hídrico FAO-56 (com 30 dias anteriores para estabilizar o solo e a previsão nos dias seguintes), junto com a parcela em fase crítica. O comentário sobre o efeito na safra considera em que fase a falta de água ocorreu: no início do ciclo o efeito tende a ser pequeno; em florescimento e enchimento de grãos pode reduzir a produtividade. As tabelas de apoio (regiões, solos, indicadores de clima, municípios com mais falta de água, relatórios e dados por município) ficam no anexo. Culturas citadas nos relatórios e não incluídas no resumo ganham uma seção própria.</p>
<h3>11a. Planilhas das usinas (cana e etanol de milho)</h3>
<p>As planilhas da pasta “03_Planilha_Usinas” seguem o questionário da Conab para a safra sucroenergética, com uma aba por usina. O painel lê cada aba pelos rótulos do formulário: área e produtividade por idade do canavial (cana própria e de fornecedores), cana moída, ATR, área plantada, rotação nas áreas de reforma, chuva mensal (média histórica e ocorrida), calendário de colheita, transporte, capacidade industrial, período de funcionamento, produção de açúcar, etanol anidro e hidratado, etanol e DDG de milho e energia elétrica, para a safra anterior e para cada avaliação da safra atual. Nome do responsável, telefone, e-mail, CNPJ e endereço não são lidos. A safra vale para o arquivo inteiro: é tirada do nome do arquivo (por exemplo “25_26”) ou, sem isso, da safra mais citada nos questionários, porque o campo costuma ficar desatualizado.</p>
<p><b>Consistência.</b> Antes de somar, o painel corrige unidades evidentemente trocadas (moagem, milho, DDG ou transporte informados em toneladas em vez de mil toneladas, reconhecidos por valores mil vezes maiores que os das outras avaliações da mesma usina ou que a moagem), trata como não preenchida uma avaliação com moagem abaixo de 30% das demais da mesma usina ou com área que cai mais de 40% sem a moagem acompanhar e, quando um bloco não foi preenchido na avaliação mais recente, usa a anterior. Todos os ajustes ficam listados no anexo do resumo, pelo código do questionário.</p>
<p><b>Indicadores.</b> Estimativa atual = avaliação mais recente preenchida por cada usina. Comparações com a safra anterior e entre avaliações usam sempre o mesmo conjunto de usinas. Produtividade média ponderada pela área; ATR ponderado pela cana moída. Mix em ATR pelos fatores do Consecana (1,0495 kg de ATR por kg de açúcar; 1,7651 e 1,6913 kg por litro de etanol anidro e hidratado). Idade do canavial pela área de cada corte; a necessidade de renovação de 15% a 20% ao ano corresponde a ciclos de cinco a seis cortes. Uso da capacidade = moagem ÷ (capacidade diária × dias de safra). A área equivalente do milho moído usa 90 sacas por hectare como referência, e as residências abastecidas pela energia vendida usam consumo de 160 kWh por mês, ambos apenas para dar escala aos números. As usinas são agrupadas em polos (Centro-Sul, Vale do Ivinhema, Norte e Bolsão) pela região imediata do município; dados de usinas individuais não aparecem no resumo.</p>
<p><b>Cruzamentos.</b> A chuva informada pelas usinas é comparada à média histórica delas e à produtividade de cada polo; a área informada é comparada à do mapeamento de uso do solo; os relatórios de viagem de cana são confrontados com o calendário de colheita, o ATR, a produtividade e o mix das usinas dos municípios visitados, com a chuva do mês citado (histórico do painel) e com os mapas de solos, eucalipto, milho e sorgo. Relatórios de cana sem data no período do resumo entram se forem dos últimos seis meses.</p>
<p><b>Coerência entre fontes.</b> Quando duas fontes não fecham, o resumo diz isso e explica o motivo provável, em vez de apresentar números contraditórios. A moagem e a tabela de área e produtividade são comparadas sobre as mesmas usinas; se área × produtividade se afastar mais de 5% da moagem, o texto aponta a diferença e usa a moagem como medida de volume. Relatórios de campo de uma safra mais nova que a das planilhas usam as planilhas só como referência do que é habitual. No atraso de colheita, o calendário planejado pelas próprias usinas é comparado à referência citada na visita, e o resumo apresenta a faixa entre as duas. Uma chuva citada no relatório e não confirmada pelo modelo é discutida pela frequência de dias com chuva e pela resolução do modelo; a observação de campo é mantida, com a ressalva. Valores extremos, como uma perda de ATR que levaria a um nível historicamente baixo, são tratados como pior cenário. Um mix mais açucareiro em meio a insatisfação com o preço do açúcar é sinalizado como provável diferença de base (volume ou ATR). A seção “Levantamento de campo” traz o que o relatório acrescenta, sem repetir números já apresentados.</p>
<h3>12. Limitações</h3>
<ul><li>A projeção fenológica usa calendário médio, sem considerar temperatura (graus-dia), cultivar ou grupo de maturação.</li>
<li>Os dados de clima por município são estimativas em um ponto e não captam a variabilidade da chuva dentro do município. A média de modelos suaviza chuvas intensas e localizadas.</li>
<li>O mapa de solos é de escala muito pequena (1:5.000.000) e não representa o solo das lavouras.</li>
<li>Correlação entre indicadores não implica causa; as indicações do painel devem ser confirmadas em campo e com as fontes do levantamento.</li></ul>`;

// =====================================================================
// RESUMO DA SAFRA EM PDF
// =====================================================================
$('bt-resumo').onclick = () => {
  if (!PL && !CANA) { abrirModal('Resumo da safra (PDF)', '<p>Conecte a pasta da equipe para gerar o resumo: ele depende das planilhas de plantio.</p>'); return; }
  const itens = []; if (PL) Object.keys(PL).sort().reverse().forEach(s => Object.keys(PL[s]).forEach(n => { if (Object.keys(PL[s][n].mun).length) itens.push([s, n]); }));
  if (CANA) itens.push(['', CANA_SEL]);
  const c0 = cultAtual(), ini = (!c0?.semFenologia && c0?.inicio) || addD(HOJE, -60);
  abrirModal('Resumo da safra (PDF)', `<div class="form-pdf">
    <div class="datas"><div><label for="pdf-ini">Início do período</label><input type="date" id="pdf-ini" class="campo" value="${dISO(ini)}"></div>
    <div><label for="pdf-fim">Fim do período</label><input type="date" id="pdf-fim" class="campo" value="${dISO(HOJE)}"></div></div>
    <label>Culturas (marque quantas quiser)</label>
    <div class="lista">${itens.map(([s, n], i) => `<label><input type="checkbox" class="pdf-c" data-s="${esc(s)}" data-n="${esc(n)}" ${(n === CANA_SEL ? cultSel === CANA_SEL : s === safraSel && n === cultSel) ? 'checked' : ''}> ${n === CANA_SEL ? `Cana-de-açúcar <span class="nota" style="margin:0">área mapeada${USINAS?.R ? ' e planilhas das usinas' : ''}</span>` : `${esc(n)} <span class="nota" style="margin:0">${esc(s)}</span>`}</label>`).join('') || '<span class="nota">Nenhuma cultura com dados.</span>'}</div>
    <div class="mini"><a id="pdf-todas">marcar todas</a><a id="pdf-nenhuma">desmarcar</a></div>
    <label>Incluir</label>
    <div class="lista"><label><input type="checkbox" id="pdf-mun" checked> Tabela completa por município</label><label><input type="checkbox" id="pdf-clima" checked> Clima do período</label><label><input type="checkbox" id="pdf-campo" checked> Relatos de campo do período</label></div>
    <button class="btn" id="pdf-gerar">Gerar PDF</button><div class="nota" id="pdf-st"></div></div>`);
  $('pdf-todas').onclick = () => document.querySelectorAll('.pdf-c').forEach(x => x.checked = true);
  $('pdf-nenhuma').onclick = () => document.querySelectorAll('.pdf-c').forEach(x => x.checked = false);
  $('pdf-gerar').onclick = async () => {
    const sel = [...document.querySelectorAll('.pdf-c:checked')].map(x => [x.dataset.s, x.dataset.n]);
    const a = deISO($('pdf-ini').value), b = deISO($('pdf-fim').value), st = $('pdf-st');
    if (!sel.length) { st.textContent = 'Escolha ao menos uma cultura.'; return; }
    if (!(a <= b)) { st.textContent = 'O início deve ser anterior ao fim.'; return; }
    $('pdf-gerar').disabled = true; st.textContent = 'Gerando…';
    try { await gerarPDF(a, b, sel, {mun: $('pdf-mun').checked, clima: $('pdf-clima').checked, campo: $('pdf-campo').checked}); st.textContent = 'PDF gerado.'; }
    catch (e) { console.error(e); st.textContent = 'Erro ao gerar o PDF: ' + e.message; }
    $('pdf-gerar').disabled = false;
  };
};
async function imagemDataURL(url) { const r = await fetch(url); const b = await r.blob(); return await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }); }
// clima histórico do período: histórico permanente + modelo atual (dias recentes e previsão)
const _hist = {}, _fat = {};
const fatorMun = (cd, tipo) => { const k = cd + tipo; if (_fat[k] == null) { const ct = centroMun(cd); _fat[k] = ct ? fatorET0(ct[0], ct[1], tipo).f : 1; } return _fat[k]; };
async function climaDiario(ini, fim) {
  const anos = []; for (let y = ini.getFullYear(); y <= fim.getFullYear(); y++) anos.push(y);
  const dias = {};   // data -> {fonte, mun:{cd:{p,tx,tn,et0}}}
  for (const y of anos) { _hist[y] = _hist[y] || await pegar(`dados/clima/historico/modelo_${y}.json`); const h = _hist[y]; if (!h) continue;
    h.datas.forEach((d, i) => { const dt = deISO(d); if (dt < ini || dt > fim) return; const mun = {}; for (const cd in h.mun) mun[cd] = {p: h.mun[cd].p[i], tx: h.mun[cd].tx[i], tn: h.mun[cd].tn[i], et0: h.mun[cd].et0[i] == null ? null : h.mun[cd].et0[i] * fatorMun(cd, h.fonte[i] === 'era5' ? 'era5' : 'previsao')}; dias[d] = {fonte: h.fonte[i], mun}; }); }
  await garantirClima();
  if (CL) CL.datas.forEach((d, i) => { const dt = deISO(d); if (dt < ini || dt > fim || (dias[d] && d < CL.hoje)) return; const mun = {}; for (const cd in CL.mun) mun[cd] = {p: CL.mun[cd].p[i], tx: CL.mun[cd].tx[i], tn: CL.mun[cd].tn[i], et0: CL.mun[cd].et0[i] == null ? null : CL.mun[cd].et0[i] * fatorMun(cd, 'previsao')}; dias[d] = {fonte: d >= CL.hoje ? 'previsão' : 'modelo', mun}; });
  return dias;
}
function resumoClima(dias, pesos) {   // pesos: {cd: área}
  const ds = Object.keys(dias).sort(); if (!ds.length) return null;
  const agg = {p: 0, et0: 0, txMax: -99, tnMin: 99, geada: 0, quente: 0, seco: 0, chuvosos: 0, fontes: {}}; let sp = 0;
  const cds = Object.keys(pesos).filter(cd => pesos[cd] > 0); sp = cds.reduce((t, cd) => t + pesos[cd], 0);
  let secoAtual = 0;
  for (const d of ds) {
    const D = dias[d]; agg.fontes[D.fonte] = (agg.fontes[D.fonte] || 0) + 1;
    let p = 0, e = 0, w = 0, g = false, q = false;
    for (const cd of cds) { const v = D.mun[cd]; if (!v) continue; w += pesos[cd]; p += (v.p || 0) * pesos[cd]; e += (v.et0 || 0) * pesos[cd]; if (v.tx != null) agg.txMax = Math.max(agg.txMax, v.tx); if (v.tn != null) agg.tnMin = Math.min(agg.tnMin, v.tn); if (v.tn != null && v.tn <= 3) g = true; if (v.tx != null && v.tx >= 35) q = true; }
    if (!w) continue; p /= w; e /= w; agg.p += p; agg.et0 += e; if (g) agg.geada++; if (q) agg.quente++;
    secoAtual = p < 1 ? secoAtual + 1 : 0; agg.seco = Math.max(agg.seco, secoAtual); if (p >= 1) agg.chuvosos++;
  }
  agg.dias = ds.length; agg.ini = ds[0]; agg.fim = ds.at(-1); return agg;
}
// =====================================================================
// PLANILHAS DAS USINAS (questionário Conab da safra sucroenergética)
// Lê as abas de questionário (uma por usina), corrige unidades óbvias e marca o que falta.
// Dados pessoais (responsável, telefone, e-mail, CNPJ, endereço) não são lidos.
// =====================================================================
const somaObj = o => Object.values(o || {}).reduce((t, v) => t + (v || 0), 0);
const PER_US = ['ant', 'a1', 'a2', 'a3'], ROT_PER = {ant: 'safra anterior', a1: '1ª avaliação', a2: '2ª avaliação', a3: '3ª avaliação'};
const CICLOS_US = [['r12', 'Cana de 12 meses', 'Renovação'], ['e12', null, 'Expansão'], ['r18', 'Cana de 18 meses', 'Renovação'], ['e18', null, 'Expansão'],
  ['c2', '2º corte'], ['c3', '3º corte'], ['c4', '4º corte'], ['c5', '5º corte'], ['c6', '6º corte']];
const POLO_RGI = {'Dourados': 'Centro-Sul', 'Ponta Porã': 'Centro-Sul', 'Campo Grande': 'Centro-Sul', 'Amambai': 'Centro-Sul', 'Jardim': 'Centro-Sul', 'Aquidauana - Anastácio': 'Centro-Sul',
  'Nova Andradina': 'Vale do Ivinhema', 'Naviraí - Mundo Novo': 'Vale do Ivinhema', 'Coxim': 'Norte e Bolsão', 'Paranaíba - Chapadão do Sul - Cassilândia': 'Norte e Bolsão', 'Três Lagoas': 'Norte e Bolsão', 'Corumbá': 'Norte e Bolsão'};
// fatores de conversão em ATR (Consecana): kg de ATR por kg de açúcar e por litro de etanol
const ATR_ACUCAR = 1.0495, ATR_ANIDRO = 1.7651, ATR_HIDRATADO = 1.6913;
function numUs(v) { if (v == null || v === '') return null; if (typeof v === 'number') return isFinite(v) ? v : null; if (v instanceof Date) return null;
  const s = String(v).trim(); if (!s || /DIV|N\/A|#/.test(s)) return null; const t = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); const x = Number(t); return isFinite(x) ? x : null; }
const txtUs = v => v == null ? '' : String(v).trim();
const normUs = s => txtUs(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
function lerQuestionario(A) {   // A: matriz da aba (linhas × colunas)
  const acha = (re, c0 = 0) => { for (let r = 0; r < A.length; r++) for (let c = c0; c < (A[r] || []).length; c++) if (typeof A[r][c] === 'string' && re.test(normUs(A[r][c]))) return [r, c]; return null; };
  const cel = (r, c) => (A[r] || [])[c];
  const q = acha(/^01- n. questionario/); if (!q) return null;
  const valDir = ([r, c]) => { for (let k = c + 1; k < c + 6; k++) if (txtUs(cel(r, k))) return cel(r, k); return null; };
  const u = {cod: txtUs(valDir(q)), safra: txtUs(valDir(acha(/^02- ano/) || q)), periodos: {}};
  const pm = acha(/^09- municipio/); u.municipio = pm ? txtUs(valDir(pm)) : '';
  // perfil: "X" na célula à esquerda da opção
  u.perfil = []; for (const [re, k] of [[/^usina$/, 'usina'], [/^usina flex/, 'flex'], [/^destilaria/, 'destilaria'], [/^usina de milho/, 'milho'], [/^usina mista/, 'mista']]) { const p = acha(re); if (p && /x/i.test(txtUs(cel(p[0], p[1] - 1)))) u.perfil.push(k); }
  PER_US.forEach(k => u.periodos[k] = {area: {p: {}, f: {}}, tch: {p: {}, f: {}}});
  // 15 — área e produtividade por idade do canavial (colunas própria/fornecedor de cada período)
  const h = acha(/^15- area/);
  if (h) { const hp = acha(/^propria$/, 0); const cols = []; if (hp) for (let c = hp[1]; c < hp[1] + 8; c++) cols.push(c);
    let r = h[0] + 1, ciclo = null;
    for (; r < Math.min(A.length, h[0] + 40); r++) { const a = normUs(cel(r, 2)), b = normUs(cel(r, 4));
      if (/^16-/.test(a)) break;
      if (a) ciclo = a;
      const put = (key, campo, linha) => cols.forEach((c, i) => { const per = PER_US[i >> 1], pf = i % 2 ? 'f' : 'p', v = numUs(cel(linha, c)); if (v != null) u.periodos[per][campo][pf][key] = v; });
      if (b && /^(renovacao|expansao|area)/.test(b) && ciclo) { const key = /12 meses/.test(ciclo) ? (/^exp/.test(b) ? 'e12' : 'r12') : /18 meses/.test(ciclo) ? (/^exp/.test(b) ? 'e18' : 'r18') : (/^(\d)/.exec(ciclo) || [])[1] ? 'c' + Math.min(6, +/^(\d)/.exec(ciclo)[1]) : null;
        if (key) { put(key, 'area', r); put(key, 'tch', r + 1); } }
      if (/^total de cana moida/.test(a)) put('moida', 'area', r);
      if (/^atr/.test(a)) put('atr', 'area', r);
      if (/^cana bisada/.test(a)) put('bisada', 'area', r); }
    for (const k of PER_US) { const P = u.periodos[k]; for (const pf of ['p', 'f']) { P[pf === 'p' ? 'moidaP' : 'moidaF'] = P.area[pf].moida ?? null; P[pf === 'p' ? 'atrP' : 'atrF'] = P.area[pf].atr ?? null; P[pf === 'p' ? 'bisada' : '_b'] = P.area[pf].bisada ?? null; delete P.area[pf].moida; delete P.area[pf].atr; delete P.area[pf].bisada; } } }
  // blocos de quatro períodos (Safra anterior, 1ª, 2ª, 3ª): rótulo do bloco, cabeçalho logo abaixo, linhas pelo rótulo na mesma coluna
  const bloco = (re, linhas) => { const p = acha(re); if (!p) return; let hr = -1, cs = [];
    for (let r = p[0] + 1; r <= p[0] + 3 && hr < 0; r++) for (let c = p[1]; c < p[1] + 8; c++) if (/^safra anterior/.test(normUs(cel(r, c)))) { hr = r; cs = [c, c + 1, c + 2, c + 3]; break; }
    if (hr < 0) return;
    for (let r = hr + 1; r < hr + 9; r++) { const lab = normUs(cel(r, p[1])); if (!lab) continue; for (const [rl, key] of linhas) if (rl.test(lab)) cs.forEach((c, i) => { const v = cel(r, c); u.periodos[PER_US[i]][key] = v instanceof Date ? v : numUs(v); }); } };
  bloco(/^16- area de plantio/, [[/^renov/, 'plantioRenov'], [/^expan/, 'plantioExp']]);
  bloco(/^17- areas ocupadas/, [[/^soja/, 'rotSoja'], [/^amendoim/, 'rotAmendoim'], [/^milho/, 'rotMilho'], [/^outros/, 'rotOutros']]);
  bloco(/^19- numero de colhedoras/, [[/./, 'colhedoras']]);
  bloco(/^22- cana a ser transportada/, [[/^ate 20/, 'tr20'], [/^de 20 a 40/, 'tr40'], [/^mais de 40/, 'trMais']]);
  bloco(/^27- producao de bagaco/, [[/^producao/, 'bagaco']]);
  bloco(/^23- capacidade industrial/, [[/^esmag/, 'capDia']]);
  bloco(/^28- tancagem/, [[/^tancagem/, 'tancagem']]);
  bloco(/^24- estimativa de esmagamento/, [[/^propria/, 'esmP'], [/^fornec/, 'esmF'], [/^outras/, 'esmSpot'], [/^total/, 'esmTot']]);
  bloco(/^29- periodo de funcionamento/, [[/^data inicio/, 'ini'], [/^data encerr/, 'fim'], [/^dias corridos/, 'dias'], [/^eficiencia da moenda/, 'efMoenda'], [/^horas de operacao-moenda/, 'hMoenda']]);
  bloco(/^25- estimativa de producao \(a partir da cana/, [[/^acucar/, 'acucar'], [/^etanol anidro/, 'anidro'], [/^etanol hidratado/, 'hidratado'], [/^etanol total/, 'etanol'], [/^mel/, 'mel']]);
  bloco(/^30- geracao de energia/, [[/^capacidade/, 'capKw'], [/^previsao de geracao/, 'gerMwh'], [/^previsao de consumo/, 'consMwh'], [/^en\. elet/, 'vendaMwh']]);
  bloco(/^26- estimativa de producao \(a partir do milho/, [[/^total de milho/, 'milho'], [/^etanol anidro/, 'anidroMilho'], [/^etanol hidratado/, 'hidratadoMilho'], [/^etanol total/, 'etanolMilho'], [/^ddg/, 'ddg']]);
  // 18 — sistema de colheita (mil t): queimada/crua
  const sc = acha(/^18- sistema de colheita/); if (sc) for (let r = sc[0] + 1; r < sc[0] + 6; r++) if (/^mecanico/.test(normUs(cel(r, sc[1])))) { u.mecQueim = numUs(cel(r, sc[1] + 1)); u.mecCrua = numUs(cel(r, sc[1] + 2)); } else if (/^manual/.test(normUs(cel(r, sc[1])))) { u.manQueim = numUs(cel(r, sc[1] + 1)); u.manCrua = numUs(cel(r, sc[1] + 2)); }
  // 20 e 21 — chuva mensal (histórica e ocorrida) e calendário de colheita (ha por mês)
  const mes = re => { const p = acha(re); if (!p) return null; const v = []; for (let c = 3; c < 15; c++) v.push(numUs(cel(p[0], c))); return v; };
  u.chuvaHist = mes(/^media historica/); u.chuvaOcorr = mes(/^ocorrida/); u.calendario = mes(/^hectares/);
  const coment = acha(/^31- condicoes/); u.comentario = coment ? [1, 2, 3, 4].map(k => txtUs(cel(coment[0] + k, 2))).filter(Boolean).join(' ') : '';
  return u;
}
// ---------- consistência: unidades trocadas, períodos não preenchidos ----------
function checarUsinas(US) {
  const avisos = [];
  const tem = (P, ks) => ks.some(k => (P[k] || 0) > 0);
  for (const u of US) for (const k of PER_US) { const P = u.periodos[k], ref = Math.max(...PER_US.map(x => u.periodos[x].esmTot || 0).filter(v => v < 30000), 1);
    // esmagamento e milho em mil t: valor mil vezes maior que o dos outros períodos -> estava em t
    for (const c of ['esmTot', 'esmP', 'esmF', 'esmSpot']) if (P[c] > 30000) { P[c] /= 1000; avisos.push(`${u.cod}: ${c === 'esmTot' ? 'esmagamento total' : 'esmagamento'} da ${ROT_PER[k]} estava em toneladas (dividido por mil).`); }
    if (P.milho > 10000) { P.milho /= 1000; avisos.push(`${u.cod}: milho moído da ${ROT_PER[k]} estava em toneladas (dividido por mil).`); }
    if (P.ddg > 0 && P.milho > 0 && P.ddg > P.milho) { P.ddg /= 1000; avisos.push(`${u.cod}: DDG da ${ROT_PER[k]} estava em toneladas (dividido por mil).`); }
    const tr = (P.tr20 || 0) + (P.tr40 || 0) + (P.trMais || 0); if (tr > 30000 && P.esmTot > 0 && tr / P.esmTot > 100) { for (const c of ['tr20', 'tr40', 'trMais']) if (P[c]) P[c] /= 1000; avisos.push(`${u.cod}: cana transportada da ${ROT_PER[k]} estava em toneladas (dividido por mil).`); }
    if (P.bagaco > 0 && P.esmTot > 0 && P.bagaco > P.esmTot) { P.bagaco /= 1000; }
    for (const c of ['gerMwh', 'consMwh', 'vendaMwh']) if (P[c] == null && u.periodos[k]._raw?.[c]) avisos.push(`${u.cod}: valor de energia ilegível na ${ROT_PER[k]}.`);
    // período sem dado algum de produção = não preenchido (não é zero)
    P.temCana = tem(P, ['esmTot']) || tem(P, ['moidaP', 'moidaF']); P.temProd = tem(P, ['acucar', 'etanol', 'anidro', 'hidratado']); P.temMilho = tem(P, ['milho', 'etanolMilho']); P.temEnergia = tem(P, ['gerMwh', 'vendaMwh']);
    P.temArea = Object.values(P.area.p).some(v => v > 0) || Object.values(P.area.f).some(v => v > 0);
    if (!P.etanol && (P.anidro || P.hidratado)) P.etanol = (P.anidro || 0) + (P.hidratado || 0);
    if (!P.etanolMilho && (P.anidroMilho || P.hidratadoMilho)) P.etanolMilho = (P.anidroMilho || 0) + (P.hidratadoMilho || 0);
    if (!P.esmTot && (P.esmP || P.esmF)) P.esmTot = (P.esmP || 0) + (P.esmF || 0) + (P.esmSpot || 0); }
  // moagem muito abaixo das outras avaliações da mesma usina: avaliação incompleta
  for (const u of US) { const vs = PER_US.map(k => u.periodos[k].esmTot || 0); for (let i = 0; i < 4; i++) { const out = vs.filter((v, j) => j !== i && v > 0).sort((a, b) => a - b); if (out.length < 2 || !vs[i]) continue; const med = out[Math.floor(out.length / 2)];
    if (vs[i] < .3 * med) { u.periodos[PER_US[i]].temCana = false; avisos.push(`${u.cod}: moagem da ${ROT_PER[PER_US[i]]} (${Math.round(vs[i]).toLocaleString('pt-BR')} mil t) muito abaixo das demais avaliações; tratada como não preenchida.`); } } }
  // área informada que despenca sem a moagem acompanhar: avaliação incompleta (usa a anterior)
  const areaU = P => somaObj(P.area.p) + somaObj(P.area.f);
  for (const u of US) for (let i = 2; i < PER_US.length; i++) { const P = u.periodos[PER_US[i]], Q = u.periodos[PER_US[i - 1]];
    if (P.temArea && Q.temArea && areaU(P) < .6 * areaU(Q) && P.esmTot && Q.esmTot && Math.abs(P.esmTot / Q.esmTot - 1) < .15) { P.temArea = false; avisos.push(`${u.cod}: área da ${ROT_PER[PER_US[i]]} incompleta (${Math.round(areaU(P)).toLocaleString('pt-BR')} ha contra ${Math.round(areaU(Q)).toLocaleString('pt-BR')} ha antes, com moagem estável); usada a ${ROT_PER[PER_US[i - 1]]}.`); } }
  // a estimativa "atual" de cada usina é a avaliação mais recente preenchida, bloco a bloco
  const ultima = (u, flag) => [...PER_US].reverse().find(k => k !== 'ant' && u.periodos[k][flag]);
  for (const u of US) { u.atual = {}; for (const f of ['temCana', 'temProd', 'temMilho', 'temEnergia', 'temArea']) u.atual[f] = ultima(u, f) || null;
    const ult = PER_US.filter(k => k !== 'ant' && Object.keys(u.periodos[k]).some(x => x.startsWith('tem') && u.periodos[k][x])).at(-1);
    for (const f of ['temCana', 'temProd', 'temMilho']) if (u.atual[f] && ult && u.atual[f] !== ult && u.periodos[ult].temCana) avisos.push(`${u.cod}: ${f === 'temProd' ? 'produção de açúcar e etanol' : f === 'temMilho' ? 'produção a partir do milho' : 'moagem'} não preenchida na ${ROT_PER[ult]}; usada a ${ROT_PER[u.atual[f]]}.`);
    u.semDados = !PER_US.some(k => u.periodos[k].temCana || u.periodos[k].temMilho); }
  return avisos;
}

// ---------- agregação: estado, períodos, polos, idade do canavial, produtos, milho, energia, indústria ----------
function cdDoMunUs(nome) {   // "IVINHEMA E ANGÉLICA" -> Ivinhema; "Naviraí - MS" -> Naviraí
  const base = normUs(nome).replace(/\s*-?\s*ms$/, '').split(/\s+e\s+|\/|,/)[0].trim();
  for (const [cd, f] of Object.entries(MUN_IDX)) if (normUs(f.properties.NM_MUN) === base) return cd;
  return null;
}
function analisarUsinas(US, cidCana) {
  const R = {usinas: US.filter(u => !u.semDados), safra: US[0]?.safra || ''};
  for (const u of R.usinas) { u.cd = cdDoMunUs(u.municipio); const rgi = u.cd ? MUN_IDX[u.cd].properties.NM_RGI : null; u.polo = POLO_RGI[rgi] || 'Outras'; u.rgi = rgi;
    u.temCanaAlgum = PER_US.some(k => u.periodos[k].temCana); u.temMilhoAlgum = PER_US.some(k => u.periodos[k].temMilho); }
  const cana = R.usinas.filter(u => u.temCanaAlgum), milho = R.usinas.filter(u => u.temMilhoAlgum);
  R.nCana = cana.length; R.nMilho = milho.length; R.nFlex = R.usinas.filter(u => u.temCanaAlgum && u.temMilhoAlgum).length;
  // valor de um campo num período, com "carregamento" da última avaliação preenchida até ele (para a série de revisões)
  const ate = (u, k, flag) => { if (k === 'ant') return u.periodos.ant[flag] ? 'ant' : null; const i = PER_US.indexOf(k); for (let j = i; j >= 1; j--) if (u.periodos[PER_US[j]][flag]) return PER_US[j]; return null; };
  const ind = (u, k) => {   // indicadores de uma usina num período
    const P = u.periodos[k], A = P.area, areaT = somaObj(A.p) + somaObj(A.f);
    let ap = 0, pp = 0; for (const pf of ['p', 'f']) for (const [c, a] of Object.entries(A[pf])) { const t = P.tch[pf][c]; if (a > 0 && t > 0) { ap += a; pp += a * t; } }
    const mp = P.moidaP || 0, mf = P.moidaF || 0, moida = P.esmTot || (mp + mf);
    const atr = (mp * (P.atrP || 0) + mf * (P.atrF || 0)) / ((P.atrP ? mp : 0) + (P.atrF ? mf : 0) || NaN);
    const atrProd = ((P.acucar || 0) * ATR_ACUCAR + (P.anidro || 0) * ATR_ANIDRO + (P.hidratado || 0) * ATR_HIDRATADO) / 1000;   // mil t de ATR nos produtos (t de açúcar × kg/kg; m³ de etanol × kg/L = t)
    return {moida, areaT, areaProd: ap, tch: ap ? pp / ap : null, atr: isFinite(atr) ? atr : null, acucar: P.acucar || 0, anidro: P.anidro || 0, hidratado: P.hidratado || 0,
      etanol: P.etanol || 0, atrAcucar: (P.acucar || 0) * ATR_ACUCAR / 1000, atrProd, milho: P.milho || 0, etanolMilho: P.etanolMilho || 0, anidroMilho: P.anidroMilho || 0, ddg: P.ddg || 0,
      venda: P.vendaMwh || 0, ger: P.gerMwh || 0, capDia: P.capDia || 0, dias: P.dias || 0, tr: [P.tr20 || 0, P.tr40 || 0, P.trMais || 0], plantio: (P.plantioRenov || 0) + (P.plantioExp || 0), plantioRenov: P.plantioRenov || 0, plantioExp: P.plantioExp || 0,
      rot: {soja: P.rotSoja || 0, amendoim: P.rotAmendoim || 0, milho: P.rotMilho || 0, outros: P.rotOutros || 0}, A, T: P.tch, moidaP: mp, moidaF: mf, atrP: P.atrP, atrF: P.atrF};
  };
  const agrega = (lista, k, flag) => { const S = {n: 0, moida: 0, areaT: 0, areaProd: 0, tchW: 0, atrW: 0, atrM: 0, acucar: 0, anidro: 0, hidratado: 0, etanol: 0, atrAcucar: 0, atrProd: 0, milho: 0, etanolMilho: 0, anidroMilho: 0, ddg: 0, venda: 0, ger: 0, cap: 0, capDia: 0, tr: [0, 0, 0], plantio: 0, plantioRenov: 0, plantioExp: 0, rot: {soja: 0, amendoim: 0, milho: 0, outros: 0}, moidaPF: [0, 0], atrPF: [0, 0, 0, 0], tchPF: [0, 0, 0, 0], idade: {}, idadeT: {}, cods: []};
    for (const u of lista) { const kk = flag ? ate(u, k, flag) : k; if (!kk) continue; const x = ind(u, kk); S.n++; S.cods.push(u.cod);
      for (const c of ['moida', 'areaT', 'areaProd', 'acucar', 'anidro', 'hidratado', 'etanol', 'atrAcucar', 'atrProd', 'milho', 'etanolMilho', 'anidroMilho', 'ddg', 'venda', 'ger', 'plantio', 'plantioRenov', 'plantioExp', 'capDia']) S[c] += x[c];
      if (x.tch) S.tchW += x.tch * x.areaProd; if (x.atr) { S.atrW += x.atr * x.moida; S.atrM += x.moida; }
      if (x.capDia && x.dias) S.cap += x.capDia * x.dias / 1000; x.tr.forEach((v, i) => S.tr[i] += v); for (const r in S.rot) S.rot[r] += x.rot[r];
      S.moidaPF[0] += x.moidaP; S.moidaPF[1] += x.moidaF; if (x.atrP) { S.atrPF[0] += x.atrP * x.moidaP; S.atrPF[1] += x.moidaP; } if (x.atrF) { S.atrPF[2] += x.atrF * x.moidaF; S.atrPF[3] += x.moidaF; }
      for (const pf of ['p', 'f']) for (const [c, a] of Object.entries(x.A[pf])) { const t = x.T[pf][c]; S.idade[c] = (S.idade[c] || 0) + (a || 0); if (a > 0 && t > 0) { const kq = c + pf; (S.idadeT[kq] ??= [0, 0]); S.idadeT[kq][0] += a * t; S.idadeT[kq][1] += a; } }
      for (const pf of [0, 1]) { const Ap = pf ? x.A.f : x.A.p, Tp = pf ? x.T.f : x.T.p; for (const [c, a] of Object.entries(Ap)) if (a > 0 && Tp[c] > 0) { S.tchPF[pf * 2] += a * Tp[c]; S.tchPF[pf * 2 + 1] += a; } } }
    S.tch = S.areaProd ? S.tchW / S.areaProd : null; S.atr = S.atrM ? S.atrW / S.atrM : null; S.atrTot = S.atr ? S.atr * S.atrM / 1000 : null;   // mil t de ATR
    S.mix = S.atrProd ? S.atrAcucar / S.atrProd : null; S.etanolTotal = S.etanol + S.etanolMilho;
    S.tchP = S.tchPF[1] ? S.tchPF[0] / S.tchPF[1] : null; S.tchF = S.tchPF[3] ? S.tchPF[2] / S.tchPF[3] : null; S.atrPr = S.atrPF[1] ? S.atrPF[0] / S.atrPF[1] : null; S.atrFo = S.atrPF[3] ? S.atrPF[2] / S.atrPF[3] : null;
    S.recup = S.atrM && S.atr ? S.atrProd / (S.atr * S.atrM / 1000) : null;   // ATR nos produtos ÷ ATR da cana moída (mil t ÷ mil t)
    return S; };
  // estimativa atual (última avaliação de cada usina) e revisões (carregando a última preenchida até cada avaliação)
  R.atual = agrega(cana, 'a3', 'temCana'); R.atualProd = agrega(cana, 'a3', 'temProd'); R.atualMilho = agrega(milho, 'a3', 'temMilho'); R.atualEnergia = agrega(R.usinas, 'a3', 'temEnergia'); R.atualArea = agrega(cana, 'a3', 'temArea');
  R.rev = {}; for (const k of ['a1', 'a2', 'a3']) R.rev[k] = {cana: agrega(cana, k, 'temCana'), prod: agrega(cana, k, 'temProd'), milho: agrega(milho, k, 'temMilho')};
  // base comparável com a safra anterior: só usinas com os dois períodos preenchidos
  const comp = (lista, flag) => { const l = lista.filter(u => u.periodos.ant[flag] && ate(u, 'a3', flag)); return {ant: agrega(l, 'ant', flag), atu: agrega(l, 'a3', flag), n: l.length, fora: lista.filter(u => !l.includes(u)).map(u => u.cod)}; };
  // moagem e área/produtividade sempre sobre as mesmas usinas, para que os números de um parágrafo fechem entre si
  const ambos = cana.filter(u => u.periodos.ant.temCana && u.periodos.ant.temArea && ate(u, 'a3', 'temCana') && ate(u, 'a3', 'temArea'));
  R.compCana = comp(ambos, 'temCana'); R.compArea = comp(ambos, 'temArea'); R.compCana.fora = R.compArea.fora = cana.filter(u => !ambos.includes(u)).map(u => u.cod);
  R.compProd = comp(cana, 'temProd'); R.compMilho = comp(milho, 'temMilho'); R.compEnergia = comp(R.usinas, 'temEnergia');
  // polos
  const polos = [...new Set(cana.map(u => u.polo))]; R.polos = polos.map(p => { const l = cana.filter(u => u.polo === p), c = comp(l, 'temCana'), ca = comp(l, 'temArea');
    const chuva = chuvaGrupo(l); return {polo: p, n: l.length, atual: agrega(l, 'a3', 'temCana'), prod: agrega(l, 'a3', 'temProd'), area: agrega(l, 'a3', 'temArea'), comp: c, compArea: ca, chuva, a1: agrega(l, 'a1', 'temCana'), a3: agrega(l, 'a3', 'temCana')}; }).sort((a, b) => b.atual.moida - a.atual.moida);
  R.chuva = chuvaGrupo(R.usinas.filter(u => u.temCanaAlgum));
  // área mapeada (uso do solo) por polo, para comparar com a área informada pelas usinas
  if (cidCana && typeof CANA !== 'undefined' && CANA) { R.mapa = {}; for (const [cd, m] of Object.entries(CANA.mun)) { const rgi = MUN_IDX[cd]?.properties.NM_RGI, p = POLO_RGI[rgi] || 'Outras'; R.mapa[p] = (R.mapa[p] || 0) + m.area; } R.mapaTot = somaObj(R.mapa); }
  // calendário de colheita (ha por mês) e período de moagem
  R.calendario = new Array(12).fill(0); for (const u of cana) (u.calendario || []).forEach((v, i) => R.calendario[i] += v || 0);
  return R;
}
// chuva ocorrida × histórica informada pelas usinas (meses preenchidos por todas as usinas do grupo, ponderado pela moagem)
function chuvaGrupo(l) {
  const ok = l.filter(u => u.chuvaHist && u.chuvaOcorr); if (!ok.length) return null;
  const meses = []; for (let i = 0; i < 12; i++) { const us = ok.filter(u => u.chuvaOcorr[i] != null && u.chuvaHist[i] > 0 && (u.chuvaOcorr[i] > 0 || i < 6)); if (us.length >= Math.max(1, ok.length * .6)) { let w = 0, o = 0, h = 0; for (const u of us) { const p = u.periodos.a3.esmTot || u.periodos.a2.esmTot || 1; w += p; o += p * u.chuvaOcorr[i]; h += p * u.chuvaHist[i]; } meses.push({i, o: o / w, h: h / w}); } }
  if (!meses.length) return null; const o = meses.reduce((t, m) => t + m.o, 0), h = meses.reduce((t, m) => t + m.h, 0);
  return {meses, o, h, desvio: h ? (o - h) / h : null};
}

// ---------- textos do resumo a partir das planilhas das usinas ----------
const PROD_MILHO_REF = 5.4;      // t/ha (90 sacas/ha), só para converter o milho moído em área equivalente
const KWH_CASA_MES = 160;        // consumo residencial médio de referência (kWh por mês)
const milhoes = v => `${n1(v)} ${v >= 1.95 ? 'milhões' : 'milhão'}`;
const miT = v => v >= 1000 ? `${milhoes(v / 1000)} de toneladas` : `${n0(v)} mil toneladas`;          // v em mil t
const tTxt = v => v >= 1e6 ? `${n2(v / 1e6)} ${v >= 1.995e6 ? 'milhões' : 'milhão'} de toneladas` : `${n0(v / 1e3)} mil toneladas`;     // v em t
const litros = v => v >= 1e6 ? `${n2(v / 1e6)} ${v >= 1.995e6 ? 'bilhões' : 'bilhão'} de litros` : `${n0(v / 1e3)} milhões de litros`;  // v em m³
const varPct = (a, b) => a && b ? (b / a - 1) * 100 : null;
const sinal = v => v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${n1(Math.abs(v))}%`;
const sobeDesce = (v, f = ['subiu', 'caiu', 'ficou estável']) => v == null ? '' : Math.abs(v) < 1 ? f[2] : v > 0 ? f[0] : f[1];
const nomePer = {ant: 'safra anterior', a1: '1ª avaliação', a2: '2ª avaliação', a3: '3ª avaliação'};
const IDADE_GRUPOS = [['Cana-planta', ['r12', 'e12', 'r18', 'e18']], ['2º corte', ['c2']], ['3º corte', ['c3']], ['4º corte', ['c4']], ['5º corte', ['c5']], ['6º corte ou mais', ['c6']]];
function idadeResumo(S) {   // participação na área e produtividade (própria e fornecedor) por idade
  const tot = somaObj(S.idade); if (!tot) return null;
  const tch = (ks, pf) => { let a = 0, p = 0; for (const k of ks) { const v = S.idadeT[k + pf]; if (v) { p += v[0]; a += v[1]; } } return a ? p / a : null; };
  const g = IDADE_GRUPOS.map(([nome, ks]) => ({nome, area: ks.reduce((t, k) => t + (S.idade[k] || 0), 0), tchP: tch(ks, 'p'), tchF: tch(ks, 'f')})).map(x => ({...x, pct: 100 * x.area / tot}));
  const cortes = (g[0].area * 1 + g[1].area * 2 + g[2].area * 3 + g[3].area * 4 + g[4].area * 5 + g[5].area * 6.5) / tot;
  return {g, tot, cortes};
}
// revisões numa base fixa: usinas com moagem informada na safra anterior e nas três avaliações
function revisoesBase(R) {
  const lista = R.usinas.filter(u => PER_US.every(k => u.periodos[k].temCana)); if (lista.length < 3) return null;
  const ag = (k, flag) => { let moida = 0, atrW = 0, atrM = 0, ap = 0, tw = 0, et = 0, ac = 0; for (const u of lista) { const P = u.periodos[k]; moida += P.esmTot || ((P.moidaP || 0) + (P.moidaF || 0));
      for (const [pf, w] of [['p', P.moidaP], ['f', P.moidaF]]) { const a = pf === 'p' ? P.atrP : P.atrF; if (a && w) { atrW += a * w; atrM += w; } }
      const kA = [...PER_US.slice(0, PER_US.indexOf(k) + 1)].reverse().find(x => u.periodos[x].temArea), PA = kA ? u.periodos[kA] : P;
      for (const pf of ['p', 'f']) for (const [c, a] of Object.entries(PA.area[pf])) { const t = PA.tch[pf][c]; if (a > 0 && t > 0) { ap += a; tw += a * t; } }
      et += P.etanol || 0; ac += P.acucar || 0; }
    return {moida, atr: atrM ? atrW / atrM : null, tch: ap ? tw / ap : null, etanol: et, acucar: ac}; };
  const out = {n: lista.length}; for (const k of PER_US) out[k] = ag(k); return out;
}
// a safra de cana vai de abril a março: depois de 1º de abril do segundo ano, os números da planilha descrevem uma safra encerrada
function safraEncerrada(s) { const m = /(\d{4})\D(\d{2,4})/.exec(s || ''); if (!m) return false; const a2 = +m[2] < 100 ? 2000 + +m[2] : +m[2]; return HOJE >= new Date(a2, 3, 1); }
function textosUsinas(R) {
  const T = {}, A = R.atual, cC = R.compCana, cA = R.compArea, cP = R.compProd, cM = R.compMilho, enc = safraEncerrada(R.safra), V = (p, q) => enc ? q : p;
  const varia = (v, f) => sobeDesce(v, enc ? f[1] : f[0]);
  // --- a safra nas usinas
  const vM = varPct(cC.ant.moida, cC.atu.moida), vT = varPct(cA.ant.tch, cA.atu.tch), vA = varPct(cC.ant.atr, cC.atu.atr), vAT = varPct(cC.ant.atrTot, cC.atu.atrTot);
  let t = `As planilhas preenchidas pelas usinas para a safra ${R.safra} reúnem ${R.nCana} unidades que processam cana${R.nMilho ? ` e ${R.nMilho} dedicadas ao etanol de milho` : ''}. ${V('Pela estimativa mais recente de cada uma, as usinas de cana devem moer', 'Pela última estimativa de cada uma, as usinas de cana moeram cerca de')} ${miT(A.moida)} na safra.`;
  if (cC.n >= 3 && vM != null) t += ` Comparando apenas as ${cC.n} usinas que informaram os dois anos, a moagem ${varia(vM, [['cresce', 'cai', 'fica praticamente estável'], ['cresceu', 'caiu', 'ficou praticamente estável']])}${Math.abs(vM) >= 1 ? ` ${n0(Math.abs(vM))}%` : ''}, de ${n1(cC.ant.moida / 1000)} para ${miT(cC.atu.moida)}.`;
  const vAr = varPct(cA.ant.areaProd, cA.atu.areaProd), vImp = vT != null && vAr != null ? ((1 + vT / 100) * (1 + vAr / 100) - 1) * 100 : null, vMa = varPct(cA.ant.moida, cA.atu.moida);
  const prodTab = cA.atu.tchW / 1000, gapTab = cA.atu.moida ? prodTab / cA.atu.moida - 1 : 0;
  if (vT != null && vImp != null && vMa != null && Math.abs(vImp - vMa) <= 4) t += ` A variação vem do campo: a produtividade média dos canaviais ${sobeDesce(vT)} de ${n0(cA.ant.tch)} para ${n0(cA.atu.tch)} toneladas por hectare (${sinal(vT)}) e a área colhida ${sobeDesce(vAr, ['aumentou', 'diminuiu', 'ficou estável'])}${Math.abs(vAr) >= 1 ? ` ${n0(Math.abs(vAr))}%` : ''}.`;
  else if (vT != null && vImp != null && vMa != null) t += ` A produtividade média informada ${sobeDesce(vT)} de ${n0(cA.ant.tch)} para ${n0(cA.atu.tch)} toneladas por hectare (${sinal(vT)}) e a área colhida ${sobeDesce(vAr, ['aumentou', 'diminuiu', 'ficou estável'])}${Math.abs(vAr) >= 1 ? ` ${n0(Math.abs(vAr))}%` : ''}, o que corresponderia a ${n0(Math.abs(vImp))}% ${vImp >= 0 ? 'mais' : 'menos'} cana, bem ${vImp > vMa ? 'acima' : 'abaixo'} da variação da moagem. As duas partes da planilha não fecham entre si: multiplicando área por produtividade, o canavial ${V('renderia', 'teria rendido')} ${miT(prodTab)}, ${n0(Math.abs(gapTab) * 100)}% ${gapTab > 0 ? 'acima' : 'abaixo'} da moagem informada. ${gapTab > 0 ? 'Isso pode indicar cana deixada no campo para a safra seguinte, perdas na colheita ou estimativas de produtividade mais otimistas que as de moagem.' : 'Isso pode indicar cana comprada de terceiros que não aparece na tabela de área ou áreas não informadas.'} Por isso o resumo usa a moagem como medida de volume e a produtividade só como indicador de tendência.`;
  if (vA != null) t += ` A qualidade da cana, medida pelo ATR, ${sobeDesce(vA, ['melhorou', 'recuou', 'se manteve'])} de ${n1(cC.ant.atr)} para ${n1(cC.atu.atr)} kg de açúcares por tonelada.`;
  const vAT2 = vM != null && vA != null ? ((1 + vM / 100) * (1 + vA / 100) - 1) * 100 : null;
  if (vAT2 != null) t += ` No saldo, a quantidade total de açúcares entregue às indústrias (moagem × ATR) ${varia(vAT2, [['aumenta', 'diminui', 'fica estável'], ['aumentou', 'diminuiu', 'ficou estável']])}${Math.abs(vAT2) >= 1 ? ` cerca de ${n0(Math.abs(vAT2))}%` : ''}; é ela que define quanto açúcar e etanol a safra ${V('pode render', 'rendeu')}.`;
  T.safra = [t];
  const rv = revisoesBase(R); T.rev = rv;
  if (rv) { const f = k => `${miT(rv[k].moida)}`, d = (a, b) => varPct(rv[a].moida, rv[b].moida);
    let t2 = `As estimativas mudaram ao longo da safra (mesmas ${rv.n} usinas em todas as etapas). Na 1ª avaliação, elas esperavam moer ${f('a1')}${rv.a1.atr ? `, com ATR de ${n1(rv.a1.atr)} kg/t` : ''}.`;
    const d12 = d('a1', 'a2'), d23 = d('a2', 'a3');
    t2 += ` Na 2ª, a expectativa ${Math.abs(d12) < 1 ? 'praticamente não mudou' : d12 > 0 ? `subiu para ${f('a2')} (${sinal(d12)})` : `caiu para ${f('a2')} (${sinal(d12)})`}${Math.abs(d12) >= 1 && rv.a2.tch && rv.a1.tch ? `, com a produtividade revista de ${n0(rv.a1.tch)} para ${n0(rv.a2.tch)} t/ha` : ''}.`;
    t2 += ` A 3ª avaliação ${Math.abs(d23) < 1 ? 'manteve a moagem' : d23 > 0 ? `elevou a moagem para ${f('a3')} (${sinal(d23)})` : `trouxe um corte, para ${f('a3')} (${sinal(d23)})`}${rv.a3.atr && rv.a2.atr && Math.abs(rv.a3.atr - rv.a2.atr) >= 1 ? ` e ${rv.a3.atr < rv.a2.atr ? 'reduziu' : 'elevou'} o ATR esperado para ${n1(rv.a3.atr)} kg/t` : ''}.`;
    T.safra.push(t2); }
  // chuva informada pelas usinas
  if (R.chuva?.meses.length >= 3) { const C = R.chuva, ms = C.meses.map(m => ({...m, d: (m.o - m.h) / m.h * 100}));
    const secos = ms.filter(m => m.d <= -30), umidos = ms.filter(m => m.d >= 30), nomeM = m => MESES_EXT[m.i], ano = (R.safra.match(/(\d{4})/) || [])[1];
    let t3 = `As usinas também registram a chuva nas suas áreas. De ${MESES_EXT[ms[0].i]} a ${MESES_EXT[ms.at(-1).i]}${ano ? ` de ${ano}` : ''}, choveu ${n0(Math.abs(C.desvio * 100))}% ${C.desvio < 0 ? 'abaixo' : 'acima'} da média histórica informada por elas (${n0(C.o)} mm, contra ${n0(C.h)} mm).`;
    if (secos.length) t3 += ` ${secos.length === 1 ? `O mês mais seco foi ${nomeM(secos[0])}, com chuva ${n0(-secos[0].d)}% abaixo da média` : `Os meses mais secos foram ${lista(secos.map(nomeM))}, com chuva entre ${n0(-Math.max(...secos.map(m => m.d)))}% e ${n0(-Math.min(...secos.map(m => m.d)))}% abaixo da média`}`;
    if (umidos.length) t3 += `${secos.length ? ', enquanto ' : ' '}${lista(umidos.map(m => nomeM(m)))} ${umidos.length === 1 ? 'teve' : 'tiveram'} chuva bem acima do normal (${lista(umidos.map(m => `${n0(m.d)}% acima`))})`;
    if (secos.length || umidos.length) t3 += '.';
    const ps = R.polos.filter(p => p.chuva?.desvio != null && p.compArea.n >= 2 && p.compArea.ant.tch && p.compArea.atu.tch).map(p => ({p, d: p.chuva.desvio * 100, v: varPct(p.compArea.ant.tch, p.compArea.atu.tch)}));
    if (ps.length >= 2) { const pior = ps.reduce((a, b) => b.d < a.d ? b : a), melhor = ps.reduce((a, b) => b.v > a.v ? b : a);
      t3 += ` Entre os polos produtores, o ${pior.p.polo} teve a chuva mais baixa em relação à média (${n0(-pior.d)}% abaixo)${pior.v < 0 ? ` e ${ps.filter(x => x.v < 0).length === 1 ? 'foi o único em que a produtividade caiu' : 'teve queda de produtividade'} em relação à safra anterior (${sinal(pior.v)})` : pior === melhor ? ', mas ainda assim teve o maior ganho de produtividade' : `, e sua produtividade variou ${sinal(pior.v)}, contra ${sinal(melhor.v)} no ${melhor.p.polo}`}. É uma associação, não uma prova de causa, mas coerente com o papel da chuva de verão no crescimento da cana.`; }
    T.safra.push(t3); }
  // --- canavial
  const I = idadeResumo(R.atualArea), Ia = cA.n >= 3 ? idadeResumo(cA.ant) : null;
  if (I) { const g = I.g, velho = g[4].pct + g[5].pct, plnt = g[0];
    let t4 = `O canavial informado pelas usinas soma ${haTxt(I.tot)}. A cana-planta (primeiro corte) ocupa ${n0(plnt.pct)}% da área, os segundos e terceiros cortes ${n0(g[1].pct + g[2].pct)}%, e os canaviais de quinto corte em diante ${n0(velho)}%. Em média, os canaviais estão ${I.cortes < 3 ? 'entre o segundo e o terceiro corte' : I.cortes < 4 ? 'entre o terceiro e o quarto corte' : 'entre o quarto e o quinto corte'}.`;
    if (Ia) { const va = Ia.g[4].pct + Ia.g[5].pct; if (Math.abs(velho - va) >= 2) t4 += ` Na safra anterior, os canaviais de quinto corte em diante eram ${n0(va)}% da área: o canavial ${velho > va ? 'envelheceu' : 'rejuvenesceu'}.`; }
    const tP = g.map(x => x.tchP), ok = tP.filter(Boolean); if (ok.length >= 4) t4 += ` A idade pesa na produtividade: nas áreas próprias das usinas, a cana-planta rende cerca de ${n0(g[0].tchP)} t/ha, o segundo corte ${n0(g[1].tchP)} t/ha e, a partir do quarto corte, a produtividade fica perto de ${n0((g[3].tchP + g[4].tchP + g[5].tchP) / 3)} t/ha.`;
    if (A.tchP && A.tchF) t4 += ` A cana de fornecedores rende menos que a própria (${n0(R.atualArea.tchF)} contra ${n0(R.atualArea.tchP)} t/ha)${R.atualArea.atrFo && R.atualArea.atrPr ? `, mas tem ATR ${R.atualArea.atrFo > R.atualArea.atrPr ? 'um pouco maior' : 'semelhante'} (${n1(R.atualArea.atrFo)} contra ${n1(R.atualArea.atrPr)} kg/t)` : ''}; ela responde por ${n0(100 * A.moidaPF[1] / (A.moidaPF[0] + A.moidaPF[1]))}% da cana moída.`;
    T.canavial = [t4];
    const S = R.atualArea, ren = S.plantioRenov, exp = S.plantioExp;
    if (ren || exp) { const tx = 100 * ren / I.tot; let t5 = `No ano, as usinas plantaram ${haTxt(ren + exp)} de cana: ${haTxt(ren)} para renovar canaviais velhos e ${haTxt(exp)} em áreas novas. A renovação equivale a ${n1(tx)}% do canavial; para manter um ciclo de cinco a seis cortes, seria preciso renovar algo entre 15% e 20% ao ano. ${tx < 13 ? 'Com o ritmo atual, a tendência é de envelhecimento do canavial e de pressão sobre a produtividade nas próximas safras, a menos que a renovação acelere.' : 'O ritmo de renovação é compatível com a manutenção da produtividade.'}`;
      const rot = S.rot, rt = rot.soja + rot.amendoim + rot.milho + rot.outros; if (rt > 0) t5 += ` Nas áreas em reforma, ${haTxt(rt)} receberam outra cultura antes do replantio${rot.soja / rt > .5 ? `, sobretudo soja (${n0(100 * rot.soja / rt)}% dessa área). A reforma dos canaviais, portanto, também alimenta a área de soja do estado` : `: ${lista(Object.entries({soja: rot.soja, amendoim: rot.amendoim, milho: rot.milho, 'outras culturas': rot.outros}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k))}`}.`;
      T.canavial.push(t5); } }
  // --- açúcar, etanol e energia
  const P = R.atualProd, M = R.atualMilho, etTot = P.etanol + M.etanolMilho;
  if (P.n) { const vAc = varPct(cP.ant.acucar, cP.atu.acucar), vEt = varPct(cP.ant.etanol, cP.atu.etanol);
    let t6 = `Das usinas de cana ${V('devem sair', 'saíram')} ${tTxt(P.acucar)} de açúcar e ${litros(P.etanol)} de etanol, sendo ${n0(100 * P.anidro / (P.etanol || 1))}% anidro (misturado à gasolina) e ${n0(100 * P.hidratado / (P.etanol || 1))}% hidratado (vendido nos postos).`;
    if (cP.n >= 3 && vAc != null && vEt != null) t6 += ` Na mesma base de usinas, o açúcar ${varia(vAc, [['cresce', 'cai', 'fica estável'], ['cresceu', 'caiu', 'ficou estável']])} ${Math.abs(vAc) >= 1 ? n0(Math.abs(vAc)) + '% ' : ''}e o etanol de cana ${varia(vEt, [['cresce', 'cai', 'fica estável'], ['cresceu', 'caiu', 'ficou estável']])}${Math.abs(vEt) >= 1 ? ' ' + n0(Math.abs(vEt)) + '%' : ''} em relação à safra anterior.`.replace('  ', ' ');
    if (P.mix != null) { t6 += ` Medido em açúcares (ATR), ${n0(100 * P.mix)}% da cana ${V('vai', 'foi')} para o açúcar e ${n0(100 - 100 * P.mix)}% para o etanol${cP.ant.mix != null && Math.abs(cP.atu.mix - cP.ant.mix) >= .01 ? `, contra ${n0(100 * cP.ant.mix)}% para o açúcar na safra anterior` : ''}: Mato Grosso do Sul segue como um estado essencialmente alcooleiro.`;
      const r1 = R.rev.a1.prod, r3 = R.rev.a3.prod; if (r1.mix != null && r3.mix != null && Math.abs(r3.mix - r1.mix) >= .02) t6 += ` Ao longo das avaliações, a destinação ao açúcar foi revista de ${n0(100 * r1.mix)}% para ${n0(100 * r3.mix)}%, ${r3.mix < r1.mix ? 'deslocando ATR para o etanol' : 'deslocando ATR para o açúcar'}.`; }
    T.produtos = [t6]; }
  const E = R.atualEnergia, cE = R.compEnergia; if (E.venda > 0) { const canaV = R.usinas.filter(u => u.temCanaAlgum).reduce((t, u) => { const k = [...PER_US].reverse().find(x => x !== 'ant' && u.periodos[x].temEnergia); return t + (k ? u.periodos[k].vendaMwh || 0 : 0); }, 0);
    const vEn = canaV || E.venda, casas = vEn * 1000 / (KWH_CASA_MES * 12), casasTxt = casas >= 1e6 ? `${milhoes(casas / 1e6)} de` : `${n0(casas / 1e3)} mil`;
    let t7 = `Além do açúcar e do etanol, o bagaço da cana vira eletricidade. As usinas de cana ${V('estimam', 'estimaram')} vender ${n1(vEn / 1e6).replace(',0', '')} ${vEn >= 2e6 ? 'milhões' : 'milhão'} de MWh à rede${cE.n >= 3 && cE.ant.venda ? ` (${sinal(varPct(cE.ant.venda, cE.atu.venda))} sobre a safra anterior, na mesma base)` : ''}, o suficiente para abastecer cerca de ${casasTxt} residências durante um ano (consumo médio de ${KWH_CASA_MES} kWh por mês).`;
    if (canaV && P.moida) t7 += ` Isso equivale a ${n0(canaV / P.moida)} kWh exportados por tonelada de cana moída.`;
    const milV = E.venda - canaV; if (R.nMilho && milV >= 0) t7 += ` Já as usinas de milho consomem quase toda a energia que geram${milV > 0 ? `, vendendo só ${n0(milV / 1e3)} mil MWh` : ''}.`;
    (T.produtos ??= []).push(t7); }
  // --- etanol de milho
  if (M.n && M.milho) { const vEM = varPct(cM.ant.etanolMilho, cM.atu.etanolMilho), share = 100 * M.etanolMilho / etTot, rend = M.etanolMilho * 1000 / (M.milho * 1000), haEq = M.milho * 1000 / PROD_MILHO_REF, m2 = soloClasse('Milho 2ª safra', null)?.area;
    let t8 = `O etanol de milho já é parte central da história. As ${M.n} usinas que processam o grão ${V('devem moer', 'moeram')} ${miT(M.milho)} de milho e ${V('produzir', 'produziram')} ${litros(M.etanolMilho)} de etanol${vEM != null && cM.n >= 1 ? `, ${n0(Math.abs(vEM))}% ${vEM >= 0 ? 'a mais' : 'a menos'} que na safra anterior` : ''}. Com isso, ${n0(share)}% de todo o etanol produzido no estado (${litros(etTot)}) ${V('vem', 'veio')} do milho.`;
    t8 += ` Cada tonelada de milho rende cerca de ${n0(rend)} litros de etanol${M.ddg ? ` e ${n0(1000 * M.ddg / M.milho)} kg de DDG, um farelo proteico usado na ração animal (${miT(M.ddg)} no total)` : ''}.`;
    t8 += ` O volume de milho moído equivale à colheita de cerca de ${haTxt(haEq)} de milho com produtividade de ${n0(PROD_MILHO_REF * 1000 / 60)} sacas por hectare${m2 ? `, ou ${n0(100 * haEq / m2)}% da área de milho de segunda safra mapeada no estado` : ''}. Uma demanda desse tamanho torna as usinas compradoras de peso no mercado de milho do estado.`;
    T.milho = [t8]; }
  // --- polos
  const PL = R.polos.filter(p => p.atual.n >= 2);
  if (PL.length >= 2) { const tot = PL.reduce((t, p) => t + p.atual.moida, 0), ord = [...PL].sort((a, b) => b.atual.moida - a.atual.moida);
    const tchMax = PL.reduce((a, b) => (b.area.tch || 0) > (a.area.tch || 0) ? b : a), atrMax = PL.reduce((a, b) => (b.atual.atr || 0) > (a.atual.atr || 0) ? b : a), atrMin = PL.reduce((a, b) => (b.atual.atr || 999) < (a.atual.atr || 999) ? b : a);
    const mixMin = PL.filter(p => p.prod.mix != null).reduce((a, b) => b.prod.mix < a.prod.mix ? b : a, PL[0]);
    let t9 = `A cana se organiza em ${PL.length} polos. O ${ord[0].polo} concentra ${n0(100 * ord[0].atual.moida / tot)}% da moagem (${ord[0].atual.n} usinas)${ord[1] ? `, seguido pelo ${ord[1].polo} (${n0(100 * ord[1].atual.moida / tot)}%)` : ''}${ord[2] ? ` e pelo ${ord[2].polo} (${n0(100 * ord[2].atual.moida / tot)}%)` : ''}.`;
    t9 += ` O ${tchMax.polo} tem os canaviais mais produtivos (${n0(tchMax.area.tch)} t/ha), enquanto o ${atrMax.polo} entrega a cana mais rica em açúcares (${n1(atrMax.atual.atr)} kg/t de ATR, contra ${n1(atrMin.atual.atr)} kg/t no ${atrMin.polo}).`;
    if (mixMin.prod.mix != null) t9 += ` O ${mixMin.polo} é o mais voltado ao etanol: só ${n0(100 * mixMin.prod.mix)}% do ATR vai para o açúcar.`;
    const cres = PL.filter(p => p.comp.n >= 2).map(p => ({p, v: varPct(p.comp.ant.moida, p.comp.atu.moida)})).filter(x => x.v != null).sort((a, b) => b.v - a.v);
    if (cres.length >= 2) t9 += ` Em relação à safra anterior, a moagem ${cres[0].v >= 0 ? V('cresce mais', 'cresceu mais') : V('cai menos', 'caiu menos')} no ${cres[0].p.polo} (${sinal(cres[0].v)}) e ${cres.at(-1).v < 0 ? V('recua', 'recuou') : V('cresce menos', 'cresceu menos')} no ${cres.at(-1).p.polo} (${sinal(cres.at(-1).v)}).`;
    T.polos = [t9];
    if (R.mapa && R.mapaTot) { const inf = R.atualArea.areaT, mp = R.mapaTot;
      let t10 = `O mapeamento de uso do solo (Aprosoja-MS) identifica ${haTxt(mp)} de cana no estado, ${mp > inf ? `${n0(100 * (mp / inf - 1))}% a mais` : `${n0(100 * (1 - mp / inf))}% a menos`} que os ${haTxt(inf)} informados pelas usinas.`;
      const dif = PL.map(p => ({p, m: R.mapa[p.polo] || 0, i: p.area.areaT})).filter(x => x.i > 0).map(x => ({...x, r: x.m / x.i})).sort((a, b) => b.r - a.r);
      if (dif.length >= 2) t10 += ` A diferença se concentra no ${dif[0].p.polo}, onde o mapa mostra ${n1(dif[0].r).replace(',0', '')} vez${dif[0].r >= 2 ? 'es' : ''} a área informada; no ${dif.at(-1).p.polo}, as duas fontes ${Math.abs(dif.at(-1).r - 1) < .15 ? 'praticamente coincidem' : `ficam mais próximas (${n1(dif.at(-1).r)} vez)`}.`;
      t10 += ' Parte da diferença pode ser cana de usinas que não responderam ou que ficam fora do estado, áreas em formação ou abandonadas e erros de classificação do mapa; o tema merece checagem com as usinas.';
      T.polos.push(t10); } }
  // --- indústria
  const ut = R.usinas.filter(u => u.temCanaAlgum).map(u => { const k = [...PER_US].reverse().find(x => x !== 'ant' && u.periodos[x].temCana); const Q = k && u.periodos[k]; return Q && Q.capDia > 0 && Q.dias > 0 ? {m: Q.esmTot, c: Q.capDia * Q.dias / 1000} : null; }).filter(Boolean);
  const ind = []; if (ut.length >= 3) { const m = ut.reduce((t, x) => t + x.m, 0), c = ut.reduce((t, x) => t + x.c, 0); ind.push(`As usinas ${V('operam', 'operaram')} com ${n0(100 * m / c)}% da capacidade instalada ao longo dos dias de safra previstos${m / c < .85 ? `: haveria espaço para moer cerca de ${miT(c - m)} a mais, o que mostra que hoje o limite está no campo (oferta de cana), e não na indústria` : ''}.`); }
  const cal = R.calendario, ct = cal.reduce((t, v) => t + v, 0);
  if (ct > 0) { let ac = 0; const acum = cal.map(v => (ac += v) / ct * 100), pico = cal.indexOf(Math.max(...cal)), meio = acum.findIndex(v => v >= 50);
    ind.push(`Pelo calendário informado, a colheita se concentra entre ${MESES_EXT[cal.findIndex(v => v / ct >= .05)]} e ${MESES_EXT[11 - [...cal].reverse().findIndex(v => v / ct >= .05)]}, com pico em ${MESES_EXT[pico]}. Metade da área costuma estar colhida ao fim de ${MESES_EXT[meio]}${acum[5] != null ? `, e ${n0(acum[5])}% até o fim de junho` : ''}.`); }
  const tr = R.atual.tr, trT = tr[0] + tr[1] + tr[2]; if (trT > 0) ind.push(`Na logística, ${n0(100 * tr[2] / trT)}% da cana percorre mais de 40 km até a indústria, e ${n0(100 * tr[0] / trT)}% vem de até 20 km.`);
  const mec = R.usinas.reduce((t, u) => t + (u.mecCrua || 0), 0), totC = R.usinas.reduce((t, u) => t + (u.mecCrua || 0) + (u.mecQueim || 0) + (u.manCrua || 0) + (u.manQueim || 0), 0);
  if (totC > 0 && mec / totC > .9) ind.push(`A colheita é praticamente toda mecanizada e sem queima (${n0(100 * mec / totC)}% da cana).`);
  if (ind.length) T.industria = [ind.join(' ')];
  return T;
}

// leitura das planilhas da pasta 03_Planilha_Usinas (só no navegador; nada é publicado)
let USINAS = null;
async function carregarUsinas(lista) {
  USINAS = null; if (!lista.length) return;
  const porSafra = {}, arquivos = [];
  for (const a of lista) {
    try { const f = await a.obter(), wb = XLSX.read(await f.arrayBuffer(), {cellDates: true}), doArq = [];
      for (const nome of wb.SheetNames) { const ws = wb.Sheets[nome]; if (!ws['!ref']) continue; const rg = XLSX.utils.decode_range(ws['!ref']); rg.s.c = 0; rg.s.r = 0;
        const u = lerQuestionario(XLSX.utils.sheet_to_json(ws, {header: 1, raw: true, defval: null, range: rg})); if (u && u.cod) { u.arquivo = f.name; doArq.push(u); } }
      // a safra vale para o arquivo inteiro: pelo nome (…25_26…) ou pela mais citada nos questionários (o campo costuma ficar desatualizado)
      const nS = s => { const m = String(s || '').replace(/\s/g, '').match(/(20\d{2})\D?(\d{2})(\d{2})?$/); return m ? `${m[1]}/${(m[3] || m[2]).padStart(2, '0')}` : null; };
      const mN = f.name.match(/(?:^|\D)(\d{2})[_\-.](\d{2})(?:\D|$)/), porNome = mN && +mN[2] === (+mN[1] + 1) % 100 ? `20${mN[1]}/${mN[2]}` : null;
      const cont = {}; doArq.forEach(u => { const k = nS(u.safra); if (k) cont[k] = (cont[k] || 0) + 1; }); const moda = Object.entries(cont).sort((x, y) => y[1] - x[1])[0]?.[0];
      const sA = porNome || moda || '?'; doArq.forEach(u => { u.safraInformada = u.safra; u.safra = sA; (porSafra[sA] ??= {})[u.cod] = u; });   // mesma usina em dois arquivos da mesma safra: vale o último lido
      arquivos.push(`${f.name} (${doArq.length} questionários, safra ${sA})`); }
    catch (e) { console.warn('planilha de usina não lida', a.caminho, e); arquivos.push(`${a.caminho.split('/').pop()}: não foi possível ler`); }
  }
  const safras = Object.keys(porSafra).filter(s => s !== '?').sort(); if (!safras.length) return;
  const s = safras.at(-1), US = Object.values(porSafra[s]), avisos = checarUsinas(US);
  let R = null; try { R = analisarUsinas(US, 'cana'); R.textos = textosUsinas(R); } catch (e) { console.warn('análise das usinas falhou', e); }
  USINAS = {safra: s, safras, US, R, avisos, arquivos};
  const st = $('st-pasta'); st.innerHTML += `<br>Usinas: ${US.length} questionários da safra ${esc(s)}${avisos.length ? ` · ${avisos.length} ajuste${avisos.length > 1 ? 's' : ''} de consistência` : ''}`;
}
// relatos de cana contados como texto corrido e cruzados com as planilhas das usinas, o clima e os mapas
async function prosaRelatosCana(filtro, R) {
  // regras: o relatório traz o que é novo; as planilhas (safra passada) e os mapas só entram para confirmar,
  // dar escala ou explicar uma diferença, sem repetir números já apresentados nas seções anteriores
  const out = [];
  for (const rel of RELATOS.filter(r => r.grupo === 'cana' && (!filtro || filtro(r)) && r.fatos?.length)) {
    const fs = rel.fatos, um = k => fs.filter(f => f.cat === k), um1 = k => um(k)[0];
    const rot = [...new Set(fs.filter(f => f.tipoEsc === 'regiao').flatMap(f => f.escopo))], escp = rot.length ? rot : [...rel.muns];
    const tn = norm(rel.texto), mq = tn.match(/(primeira|segunda|terceira|quarta|ultima) semana de ([a-z]+)/), mE = /entre os dias (\d{1,2}) e (\d{1,2}) de ([a-zç]+)/i.exec(rel.texto);
    const ano = rel.data.getFullYear(), mes = rel.data.getMonth(), quando = mq ? `Na ${mq[1] === 'ultima' ? 'última' : mq[1]} semana de ${MESES_EXT[mes]} de ${ano}` : mE ? `Entre ${mE[1]} e ${mE[2]} de ${mE[3].toLowerCase()} de ${ano}` : `Em ${dExt(rel.data)} de ${ano}`;
    const mS = rel.texto.match(/safra[^.\n]{0,40}?(20\d{2})\s*\/\s*(20\d{2}|\d{2})/i), safraRel = mS ? `${mS[1]}/${mS[2].slice(-2)}` : null;
    const usR = R ? R.usinas.filter(u => u.cd && escp.includes(u.cd) && u.temCanaAlgum) : [], outraSafra = R && safraRel && safraRel !== R.safra;
    const passada = outraSafra ? 'na safra passada' : 'na mesma safra', passadaDa = outraSafra ? 'da safra passada' : 'da mesma safra';
    const p1 = [`${quando}, a equipe visitou usinas de açúcar e etanol em ${lista(escp.map(nmMun).filter(Boolean))}${safraRel ? `, no levantamento da safra ${safraRel}` : ''}.${outraSafra ? ` Como as planilhas mais recentes das usinas são da safra ${R.safra}, elas servem aqui apenas como referência do que é habitual para essas unidades.` : ''}`];
    // colheita: relato × calendário das mesmas usinas
    const co = um1('colheita'), ce = um1('colheitaEsperada'), ac = um1('atrasoColheita'), cm = um1('climaMes');
    if (co) { let t = `A colheita estava ${ac || (ce && ce.pct > co.pct) ? 'atrasada' : 'em andamento'}: ${n0(co.pct)}% da área havia sido colhida${ce ? `, quando o normal para a época seria ${ce.pct === 50 ? 'cerca de metade' : `${n0(ce.pct)}%`}, segundo as usinas` : ''}${cm?.acima ? `, por causa das chuvas acima da média de ${MESES_EXT[cm.mes]}` : ''}.`;
      const cal = new Array(12).fill(0); usR.forEach(u => (u.calendario || []).forEach((v, i) => cal[i] += v || 0)); const tot = cal.reduce((a, b) => a + b, 0);
      if (tot > 0) { let acu = 0; for (let i = 0; i < mes; i++) acu += cal[i]; acu += cal[mes] * Math.min(1, rel.data.getDate() / 30); const esp = 100 * acu / tot, ref = ce?.pct;
        const qd = rel.data.getDate() <= 10 ? `o início de ${MESES_EXT[mes]}` : rel.data.getDate() <= 20 ? `meados de ${MESES_EXT[mes]}` : `o fim de ${MESES_EXT[mes]}`;
        if (ref == null || Math.abs(esp - ref) <= 8) t += ` O calendário de colheita que essas usinas planejaram ${passada} confirma a referência.`;
        else if (esp > co.pct + 2) t += ` O calendário que essas usinas planejaram ${passada} previa um ritmo ${esp < ref ? 'mais lento' : 'mais rápido'}, com cerca de ${n0(esp)}% colhido até ${qd}; mesmo por essa referência a colheita estava atrás do previsto, e o atraso fica entre ${n0(Math.min(esp, ref) - co.pct)} e ${n0(Math.max(esp, ref) - co.pct)} pontos percentuais, conforme a referência adotada.`;
        else t += ` Pelo calendário que essas usinas planejaram ${passada}, porém, elas costumam ter cerca de ${n0(esp)}% colhido até ${qd}, praticamente o que foi observado. A percepção de atraso deve refletir um plano mais acelerado para esta safra, que as chuvas impediram de cumprir; por isso o resumo trata o atraso como moderado.`; }
      p1.push(t); }
    // chuva do mês citado: dado do modelo × média histórica das usinas
    if (cm && i1ok(ano, cm.mes)) { const i0 = new Date(ano, cm.mes, 1, 12), i1 = new Date(ano, cm.mes + 1, 0, 12), dc = await climaDiario(i0, i1), sr = serieDias(dc, Object.fromEntries(escp.map(cd => [cd, 1])), i0, i1);
      const hs = usR.map(u => u.chuvaHist?.[cm.mes]).filter(v => v > 0), h = hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : null;
      if (sr.length >= 25 && h) { const p = sr.reduce((t, x) => t + x.p, 0), dch = sr.filter(x => x.p >= 1).length;
        if (!cm.acima || p >= h * 1.2) p1.push(`Os dados de clima confirmam: em ${MESES_EXT[cm.mes]} choveu ${n0(p)} mm nesses municípios, ${p >= h ? `${n1(p / h).replace(',0', '')} vez${p / h >= 1.95 ? 'es' : ''} a média histórica informada pelas usinas` : `${n0(100 * p / h)}% da média`}.`);
        else if (dch >= 12) p1.push(`No total do mês, os dados de clima mostram ${n0(p)} mm, perto da média de ${n0(h)} mm informada pelas usinas, mas distribuídos em ${dch} dias. Para a colheita, o que pesa é a frequência da chuva, que interrompe as máquinas e encharca os carreadores, mais do que o volume: o relato é coerente com essa distribuição.`);
        else p1.push(`Os dados de clima, por sua vez, não mostram um ${MESES_EXT[cm.mes]} chuvoso (${n0(p)} mm, contra média de ${n0(h)} mm, em ${dch} dias). Como o dado vem de um modelo, com pontos espaçados de 10 a 25 km, chuvas localizadas sobre as áreas das usinas podem não aparecer; o resumo mantém a informação de campo, que é observação direta, mas ela merece confirmação nas próximas visitas.`); } }
    // qualidade
    const p2 = [], ai = um1('atrImpacto'), pg = [...new Set(um('pragas').flatMap(f => f.itens))];
    const atrRef = usR.length ? (() => { let w = 0, s = 0; for (const u of usR) { const k = ['a3', 'a2', 'a1'].find(x => u.periodos[x].temCana); const P = k && u.periodos[k]; if (!P) continue; for (const [a, m] of [[P.atrP, P.moidaP], [P.atrF, P.moidaF]]) if (a && m) { s += a * m; w += m; } } return w ? s / w : null; })() : null;
    if (ai) { const atrMin = atrRef ? atrRef * (1 - ai.pct / 100) : null;
      p2.push(`As chuvas fora de época também pesam na qualidade: as usinas falam em perda de até ${ai.pct}% no ATR${atrMin ? `. Aplicada ao ATR habitual dessas usinas, uma perda desse tamanho levaria a cerca de ${n0(atrMin)} kg de açúcares por tonelada${atrMin < 110 ? ', nível que seria excepcionalmente baixo; por isso o número deve ser lido como o pior cenário para as áreas mais afetadas, e não como a média da região' : ''}` : ''}.`); }
    const prag = pg.filter(x => !/isopor/.test(x)); if (prag.length) p2.push(`Foram citados ainda problemas com ${lista(prag)}.`);
    if (pg.some(x => /isopor/.test(x))) { let t = 'Nos solos mais arenosos, a preocupação é a isoporização, anomalia em que o colmo perde caldo e fica esponjoso, ligada a variedades predispostas e a condições climáticas adversas, com perdas de ATR e de produtividade.';
      const tx = (() => { let a = 0, ar = 0, me = 0; for (const cd of escp) { const r = soloClasse('Cana-de-açúcar', cd); if (!r) continue; a += r.area; ar += r.area * (r.textura['Arenosa'] || 0) / 100; me += r.area * (r.textura['Média'] || 0) / 100; } return a ? {ar: 100 * ar / a, me: 100 * me / a} : null; })();
      if (tx) t += tx.ar < 3 ? ` O mapa de solos não indica cana em solos arenosos nesses municípios, mas ${n0(tx.me)}% dela está em textura média; o problema tende a se concentrar em manchas arenosas pequenas demais para a escala do mapa (1:5.000.000).` : ` Nesses municípios, ${n0(tx.ar)}% da cana mapeada está em solos arenosos e ${n0(tx.me)}% em textura média.`;
      p2.push(t + ' As usinas apontam a necessidade de variedades adaptadas a esses solos.'); }
    // manejo, produtividade, mix e preços: só o que é novo; a planilha entra para confirmar ou explicar
    const p3 = [], va = um1('variedades'), tc = um1('tch'), mx = um1('mix'), ps = um1('precoSent');
    if (va) p3.push(`As usinas trabalham com cerca de ${va.n} variedades por safra e substituem as menos produtivas a cada ano.`);
    const tchR = usR.length ? (() => { let a = 0, p = 0; for (const u of usR) { const k = ['a3', 'a2', 'a1'].find(x => u.periodos[x].temArea); if (!k) continue; const P = u.periodos[k]; for (const pf of ['p', 'f']) for (const [c, ar] of Object.entries(P.area[pf])) { const t = P.tch[pf][c]; if (ar > 0 && t > 0) { a += ar; p += ar * t; } } } return a ? p / a : null; })() : null;
    if (tc) { const d = tchR ? tc.v / tchR - 1 : 0; p3.push(`A produtividade média da região gira em torno de ${n0(tc.v)} toneladas por hectare${!tchR ? '' : Math.abs(d) <= .06 ? `, semelhante à ${passadaDa}` : `, ${d > 0 ? 'acima' : 'abaixo'} ${passadaDa} (${n0(tchR)} t/ha)${Math.abs(d) > .15 ? '; a diferença é grande e deve ser confirmada' : ''}`}.`); }
    const mixR = usR.length ? (() => { let ac = 0, tot = 0; for (const u of usR) { const k = ['a3', 'a2', 'a1'].find(x => u.periodos[x].temProd); if (!k) continue; const P = u.periodos[k]; const a = (P.acucar || 0) * ATR_ACUCAR, e = (P.anidro || 0) * ATR_ANIDRO + (P.hidratado || 0) * ATR_HIDRATADO; ac += a; tot += a + e; } return tot ? 100 * ac / tot : null; })() : null;
    const sa = ps ? ((rel.texto.match(/de ([^.,;]{4,40}?) para o açúcar/i) || [])[1] || ps.acucar).trim() : null, se = ps ? ((rel.texto.match(/de ([^.,;]{4,40}?) para o etanol/i) || [])[1] || ps.etanol || '').trim() : null;
    if (mx) { let t = `O mix previsto é de ${mx.acucar}% para o açúcar e ${100 - mx.acucar}% para o etanol`;
      if (mixR != null && mx.acucar - mixR >= 5) t += `, mais açucareiro que ${passada} (${n0(mixR)}% do ATR nessas usinas)${ps && /insatisf/i.test(sa) ? `, embora o sentimento das usinas em relação ao preço do açúcar seja de ${sa}. Como as duas informações apontam em direções opostas, é provável que o percentual citado se refira ao volume de produtos, e não ao ATR; o dado deve ser confirmado` : '. A diferença pode vir da base de cálculo (volume ou ATR) ou de uma mudança de estratégia'}`;
      else if (mixR != null && mixR - mx.acucar >= 5) t += `, mais alcooleiro que ${passada} (${n0(mixR)}% do ATR para o açúcar)`;
      p3.push(t + '.'); if (ps && !(mixR != null && mx.acucar - mixR >= 5 && /insatisf/i.test(sa))) p3.push(`Quanto ao preço, o sentimento é de ${sa} para o açúcar${se ? ` e de ${se} para o etanol` : ''}.`); }
    else if (ps) p3.push(`Quanto ao preço, o sentimento é de ${sa} para o açúcar${se ? ` e de ${se} para o etanol` : ''}.`);
    // etanol de milho, biomassa e sorgo
    const p4 = [], mc = um1('milhoCompra'), ct = um1('milhoContrato'), sb = um1('siloBag'), es = um1('estoque'), cv = um1('cavaco'), so = um1('sorgoPct');
    if (mc || ct || es) { let t = 'Nas usinas de etanol de milho'; t += mc ? `, cerca de ${mc.pct}% do milho necessário para a safra já estava comprado` : ', a compra do milho segue em andamento';
      if (ct) t += `, de ${ct.min}% a ${ct.max}% por contratos futuros e o restante no mercado à vista`; if (um1('milhoOrigem')) t += '; metade vem diretamente de produtores e metade de cooperativas'; t += '.';
      if (sb) t += ` Até ${sb.pct}% do volume fica em silos-bolsa.`; if (es) t += ` O estoque garante ${es.min === es.max ? es.min : `de ${es.min} a ${es.max}`} meses de produção.`;
      const dem = R?.atualMilho?.milho; if (mc && dem) { const falta = dem * (1 - mc.pct / 100); t += ` Na escala de consumo das usinas, isso significa que ainda ${mc.pct >= 50 ? 'restam' : 'faltavam'} cerca de ${miT(falta)} por comprar, volume ligado diretamente à colheita do milho de segunda safra.`; }
      p4.push(t); }
    if (cv) { const eu = soloClasse('Eucalipto', null)?.area; p4.push(`A principal fonte de energia dessas usinas é o cavaco de madeira${cv.celulose ? ', o que as coloca em disputa por madeira com as novas fábricas de celulose' : ''}${eu ? `; o estado tem ${haTxt(eu)} de eucalipto mapeados, base para os dois usos` : ''}. Mesmo assim, as usinas veem o cenário como promissor e sinalizam novos investimentos.`); }
    if (so) { const sa2 = soloClasse('Sorgo', null)?.area; p4.push(`O sorgo entra no máximo com ${so.pct}% do volume, e só nas usinas mais novas, por exigir adaptações nos equipamentos. A expansão do sorgo no estado${sa2 ? ` (${haTxt(sa2)} mapeados na segunda safra de 2025)` : ''} responde mais à janela de plantio do produtor que à demanda das usinas.`); }
    for (const p of [p1, p2, p3, p4]) if (p.length) out.push(p.join(' '));
  }
  return out;
  function i1ok(a, m) { return new Date(a, m + 1, 0, 12) < HOJE && typeof climaDiario === 'function'; }
}
// ---------- gráficos da cana ----------
function graficoRevisoesPDF(doc, rv, ctx) {   // três painéis: moagem, produtividade, ATR, por etapa
  const {M, W, CINZA} = ctx; if (!rv) return; ctx.garantir(48); const y0 = ctx.y() + 2, gh = 26, gap = 8, pw = (W - 2 * M - 2 * gap) / 3;
  const ks = ['ant', 'a1', 'a2', 'a3'], rot = ['Safra ant.', '1ª aval.', '2ª aval.', '3ª aval.'];
  const pain = [['Moagem (milhões de t)', k => rv[k].moida / 1000, 1], ['Produtividade (t/ha)', k => rv[k].tch, 0], ['ATR (kg/t)', k => rv[k].atr, 1]];
  pain.forEach(([tit, f, dec], i) => { const x0 = M + i * (pw + gap), vs = ks.map(f), ok = vs.filter(v => v != null); if (!ok.length) return; const mn = Math.min(...ok) * .9, mx = Math.max(...ok) * 1.02, bw = pw / 4 * .62;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(38, 44, 36); doc.text(tit, x0, y0);
    vs.forEach((v, j) => { if (v == null) return; const xc = x0 + (j + .5) * pw / 4, h = gh * (v - mn) / (mx - mn); doc.setFillColor(...(j ? [47, 107, 58] : [190, 190, 182])); doc.rect(xc - bw / 2, y0 + 3 + gh - h, bw, h, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.3); doc.setTextColor(38, 44, 36); doc.text(v.toLocaleString('pt-BR', {minimumFractionDigits: dec, maximumFractionDigits: dec}), xc, y0 + 2 + gh - h, {align: 'center'});
      doc.setTextColor(...CINZA); doc.text(rot[j], xc, y0 + gh + 6.5, {align: 'center'}); }); });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CINZA); doc.text(`Mesmas ${rv.n} usinas em todas as etapas. Barras começam acima de zero para destacar a variação.`, M, y0 + gh + 11); ctx.setY(y0 + gh + 16);
}
function graficoChuvaUsinasPDF(doc, C, ctx) {   // chuva ocorrida × média histórica, por mês
  const {M, W, CINZA} = ctx; if (!C?.meses?.length) return; ctx.garantir(44); const y0 = ctx.y() + 2, gh = 26, gx = M + 8, gw = W - 2 * M - 10, n = C.meses.length, cw = gw / n, bw = cw * .32;
  const mx = Math.max(...C.meses.map(m => Math.max(m.o, m.h))) * 1.1, Y = v => y0 + gh - v / mx * gh;
  doc.setDrawColor(232); doc.setLineWidth(.15); doc.line(gx, y0 + gh, gx + gw, y0 + gh);
  C.meses.forEach((m, j) => { const xc = gx + (j + .5) * cw; doc.setFillColor(200, 200, 192); doc.rect(xc - bw - .3, Y(m.h), bw, y0 + gh - Y(m.h), 'F'); doc.setFillColor(...(m.o < m.h * .7 ? [196, 120, 60] : m.o > m.h * 1.3 ? [33, 113, 181] : [110, 160, 210])); doc.rect(xc + .3, Y(m.o), bw, y0 + gh - Y(m.o), 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.3); doc.setTextColor(...CINZA); doc.text(MESES_EXT[m.i].slice(0, 3), xc, y0 + gh + 3.5, {align: 'center'}); const d = (m.o - m.h) / m.h * 100; doc.setTextColor(38, 44, 36); doc.text(`${d > 0 ? '+' : ''}${n0(d)}%`, xc, Y(Math.max(m.o, m.h)) - 1, {align: 'center'}); });
  legendaPDF(doc, [['b', [200, 200, 192], 'média histórica'], ['b', [110, 160, 210], 'chuva ocorrida (mm)'], ['b', [196, 120, 60], 'mais de 30% abaixo'], ['b', [33, 113, 181], 'mais de 30% acima']], gx, y0 + gh + 8, CINZA); ctx.setY(y0 + gh + 13);
}
function graficoIdadePDF(doc, I, ctx) {   // área por idade (barras) e produtividade própria × fornecedor (linhas)
  const {M, W, CINZA} = ctx; if (!I) return; ctx.garantir(50); const y0 = ctx.y() + 2, gh = 30, gx = M + 8, gw = W - 2 * M - 16, n = I.g.length, cw = gw / n, bw = cw * .5;
  const mxA = Math.max(...I.g.map(g => g.pct)) * 1.15, tchs = I.g.flatMap(g => [g.tchP, g.tchF]).filter(Boolean), mxT = Math.max(...tchs) * 1.1, YT = v => y0 + gh - v / mxT * gh;
  I.g.forEach((g, j) => { const xc = gx + (j + .5) * cw, h = gh * g.pct / mxA; doc.setFillColor(214, 226, 208); doc.rect(xc - bw / 2, y0 + gh - h, bw, h, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.3);
    doc.setTextColor(...CINZA); doc.text(g.nome, xc, y0 + gh + 3.5, {align: 'center'}); doc.setTextColor(90, 110, 85); doc.text(`${n0(g.pct)}% da área`, xc, y0 + gh + 6.6, {align: 'center'}); });
  const linha = (k, cor, dash) => { doc.setDrawColor(...cor); doc.setLineWidth(.8); if (dash) doc.setLineDashPattern([1.2, .8], 0); let ant = null; I.g.forEach((g, j) => { const v = g[k]; if (!v) { ant = null; return; } const p = [gx + (j + .5) * cw, YT(v)]; if (ant) doc.line(...ant, ...p); doc.setFillColor(...cor); doc.circle(...p, .7, 'F'); ant = p; }); doc.setLineDashPattern([], 0); };
  linha('tchP', [47, 107, 58]); linha('tchF', [184, 116, 26], true);
  I.g.forEach((g, j) => { if (g.tchP) { doc.setFontSize(6.3); doc.setTextColor(47, 107, 58); doc.text(n0(g.tchP), gx + (j + .5) * cw + 1.3, YT(g.tchP) - 1); } });
  legendaPDF(doc, [['b', [214, 226, 208], '% da área do canavial'], ['l', [47, 107, 58], 'produtividade, cana própria (t/ha)'], ['t', [184, 116, 26], 'produtividade, fornecedores (t/ha)']], gx, y0 + gh + 11.5, CINZA); ctx.setY(y0 + gh + 16);
}
function graficoEtanolPDF(doc, R, ctx) {   // etanol por origem: safra anterior × atual (mesmas usinas)
  const {M, W, CINZA} = ctx, cP = R.compProd, cM = R.compMilho; if (!cP.n && !cM.n) return; ctx.garantir(40); const y0 = ctx.y() + 2, gx = M + 26, gw = W - 2 * M - 40, bh = 7;
  const lin = [['Safra anterior', cP.ant, cM.ant], ['Safra atual', cP.atu, cM.atu]], mx = Math.max(...lin.map(([, p, m]) => p.anidro + p.hidratado + m.etanolMilho)) * 1.05;
  const cores = [[47, 107, 58], [140, 185, 120], [232, 170, 60]];
  lin.forEach(([nome, p, m], j) => { const yy = y0 + j * (bh + 5); let x = gx; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(38, 44, 36); doc.text(nome, M, yy + bh * .7);
    [p.anidro, p.hidratado, m.etanolMilho].forEach((v, k) => { const w = gw * v / mx; doc.setFillColor(...cores[k]); doc.rect(x, yy, w, bh, 'F'); if (w > 14) { doc.setFontSize(6.5); doc.setTextColor(k === 1 ? 38 : 255, k === 1 ? 44 : 255, k === 1 ? 36 : 255); doc.text(`${n2(v / 1e6)}`, x + w / 2, yy + bh * .68, {align: 'center'}); } x += w; });
    doc.setFontSize(7.5); doc.setTextColor(38, 44, 36); doc.text(`${n2((p.anidro + p.hidratado + m.etanolMilho) / 1e6)} bi L`, x + 2, yy + bh * .7); });
  legendaPDF(doc, [['b', cores[0], 'anidro de cana'], ['b', cores[1], 'hidratado de cana'], ['b', cores[2], 'etanol de milho']], gx, y0 + 2 * (bh + 5) + 4, CINZA);
  doc.setFontSize(6.5); doc.setTextColor(...CINZA); doc.text(`Bilhões de litros; mesmas usinas nos dois anos (${cP.n} de cana e ${cM.n} de milho).`, gx, y0 + 2 * (bh + 5) + 8.5); ctx.setY(y0 + 2 * (bh + 5) + 13);
}

// =====================================================================
// RESUMO DA SAFRA (PDF) — texto corrido, em ordem cronológica, com dois gráficos por cultura
// (semeadura semana a semana e restrição hídrica no período); tabelas de apoio vão para o anexo
// =====================================================================
// texto para as fontes padrão do jsPDF (WinAnsi): tira HTML e troca símbolos que a fonte não tem
const pdfTxt = t => String(t ?? '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[−‐‑]/g, '-').replace(/≈/g, '~').replace(/[   ]/g, ' ').replace(/[^\x00-\xff–—‘’“”•…€]/g, '');
const MESES_EXT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dExt = d => d ? `${d.getDate() === 1 ? '1º' : d.getDate()} de ${MESES_EXT[d.getMonth()]}` : '';
const lista = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' e ' + a.at(-1);
const haTxt = v => v >= 1e6 ? `${n1(v / 1e6)} ${v >= 1.95e6 ? 'milhões' : 'milhão'} de hectares` : v >= 1e4 ? `${n0(v / 1e3)} mil hectares` : v >= 1e3 ? `${n1(v / 1e3)} mil hectares` : `${n0(v)} hectares`;
const nmMun = cd => MUN_IDX[cd]?.properties.NM_MUN;
const maiusc = t => t ? t[0].toUpperCase() + t.slice(1) : t;
const safraAnterior = s => { const m = /^(\d{4})\/(\d{2})$/.exec(s || ''); return m ? `${+m[1] - 1}/${m[1].slice(2)}` : null; };
// série diária ponderada (chuva, ET0) a partir de climaDiario
function serieDias(dias, pesos, ini, fim) {
  const out = []; for (const d of Object.keys(dias).sort()) { if (ini && d < dISO(ini)) continue; if (fim && d > dISO(fim)) continue; const D = dias[d]; let sw = 0, p = 0, e = 0;
    for (const cd in pesos) { const v = D.mun[cd]; if (!v) continue; sw += pesos[cd]; p += (v.p || 0) * pesos[cd]; e += (v.et0 || 0) * pesos[cd]; }
    if (sw) out.push({d, p: p / sw, e: e / sw, prev: D.fonte === 'previsão'}); }
  return out;
}
// história do tempo por quinzena, em texto corrido
function historiaTempo(serie) {
  const q = []; for (const x of serie.filter(x => !x.prev)) { const dt = deISO(x.d), k = `${x.d.slice(0, 7)}-${dt.getDate() <= 15 ? 1 : 2}`;
    if (!q.length || q.at(-1).k !== k) q.push({k, ini: dt, p: 0, e: 0, ch: 0, n: 0}); const b = q.at(-1); b.p += x.p; b.e += x.e; b.n++; if (x.p >= 1) b.ch++; }
  const blocos = q.filter(b => b.n >= 5); if (!blocos.length) return '';
  const nome = b => `${b.ini.getDate() <= 15 ? 'primeira' : 'segunda'} quinzena de ${MESES_EXT[b.ini.getMonth()]}`;
  const tipo = b => { const r = b.p / Math.max(1, b.e); return r >= 1.5 ? 'farta' : r >= .8 ? 'regular' : r >= .4 ? 'fraca' : 'seca'; };
  const fr = []; let ant = null;
  blocos.forEach((b, i) => { const t = tipo(b), mm = `${n0(b.p)} mm, distribuídos em ${b.ch} dia${b.ch === 1 ? '' : 's'}`;
    const desc = {farta: `a chuva foi farta (${mm}), bem acima do que as plantas e o solo perdem por evaporação`, regular: `choveu de forma regular (${mm}), em volume próximo ao que as lavouras consomem`, fraca: `a chuva ficou abaixo do que as lavouras consomem (${mm})`, seca: `o tempo foi seco (${b.p < 1 ? 'praticamente sem chuva' : mm})`}[t];
    if (i === 0) fr.push(`Na ${nome(b)}, ${desc}.`);
    else if (t === ant) fr.push(`O padrão se repetiu na ${nome(b)}${b.p >= 1 ? ` (${n0(b.p)} mm)` : ''}.`);
    else fr.push(`${['Já na', 'Na', 'Em seguida, na'][i % 3]} ${nome(b)}, ${desc}.`);
    ant = t; });
  return fr.join(' ');
}
// restrição hídrica diária no período (balanço FAO-56 por município com a mesma regra da camada "Água no solo")
function restricaoPeriodo(c, cid, ini, dc) {
  const ds = Object.keys(dc).sort(), out = ds.filter(d => d >= dISO(ini)).map(d => ({d, campo: 0, cls: [0, 0, 0, 0], prev: dc[d].fonte === 'previsão'})), idx = Object.fromEntries(out.map((o, i) => [o.d, i]));
  const pTab = paramsKc(c).p;
  for (const [cd, m] of Object.entries(c.mun)) { const TAW = cadMun(cid, cd), w = m.area || 1; let Dr = TAW * .5;
    for (const d of ds) { const v = dc[d].mun[cd]; if (!v) continue; let kc = KC_PALHADA, campo = 0; const k = kcInfo(c, m, deISO(d)); if (k) { kc = k.kc; campo = k.campo; }
      const etc = (v.et0 || 0) * kc, p = Math.min(.8, Math.max(.1, pTab + .04 * (5 - etc))), ks = Dr <= p * TAW ? 1 : Math.max(0, (TAW - Dr) / ((1 - p) * TAW));
      Dr = Math.min(TAW, Math.max(0, Dr - (v.p || 0) + ks * etc));
      const i = idx[d]; if (i == null || campo <= 0) continue; const a = w * Math.min(100, campo) / 100; out[i].campo += a; out[i].cls[classeKs(ks)] += a; } }
  return out.map(o => ({...o, r: o.campo ? 100 * (o.campo - o.cls[0]) / o.campo : null, sev: o.campo ? 100 * (o.cls[2] + o.cls[3]) / o.campo : null, pct: o.campo ? o.cls.map(v => 100 * v / o.campo) : null}));
}
// leitura da restrição: quando apareceu, quanto durou, em que fase e o que significa para a produtividade
function historiaAgua(R, critDe, nomeC, cana) {
  const pas = R.filter(x => !x.prev && x.r != null), fut = R.filter(x => x.prev && x.r != null); if (!pas.length) return {txt: '', dest: null};
  const ondas = []; let o = null; for (const x of pas) { if (x.r >= 20) { if (!o) ondas.push(o = {a: x, b: x, pico: x}); o.b = x; if (x.r > o.pico.r) o.pico = x; } else o = null; }
  const fr = [], hoje = pas.at(-1), maxF = fut.length ? fut.reduce((b, x) => x.r > b.r ? x : b) : null; let dest = null;
  if (!ondas.length) fr.push(`Ao longo de todo o período, não faltou água para a maior parte das lavouras de ${nomeC}: em nenhum dia mais de 20% da área cultivada ficou com falta de água.`);
  else { ondas.slice(0, 3).forEach((w, i) => { const dur = Math.round((deISO(w.b.d) - deISO(w.a.d)) / 864e5) + 1, cr = critDe(deISO(w.pico.d));
      const desdeIni = w.a === pas[0], ateHoje = w.b === pas.at(-1);
      fr.push(`${desdeIni ? `A falta de água já estava presente no início do período e ${ateHoje ? 'continua até hoje' : `durou ${dur} dia${dur === 1 ? '' : 's'}`}` : `${i === 0 ? 'A falta de água começou a aparecer' : 'Um novo período de falta de água começou'} em ${dExt(deISO(w.a.d))} e ${ateHoje ? 'continua até hoje' : `durou ${dur} dia${dur === 1 ? '' : 's'}`}`}. No pior momento, em ${dExt(deISO(w.pico.d))}, atingiu ${n0(w.pico.r)}% da área cultivada${w.pico.sev >= 5 ? `, sendo ${n0(w.pico.sev)}% em nível moderado ou severo` : ''}${cr >= 10 ? `, justamente quando cerca de ${n0(cr)}% da área atravessava fases críticas` : ''}.`); });
    if (ondas.length > 3) fr.push(`Houve ainda outros ${ondas.length - 3} episódios menores.`); }
  fr.push(hoje.r >= 5 ? `Hoje, ${n0(hoje.r)}% da área cultivada está com alguma falta de água.` : 'Hoje, o solo tem água suficiente para praticamente toda a área cultivada.');
  if (maxF) fr.push(maxF.r > hoje.r + 5 ? `A previsão indica piora, com até ${n0(maxF.r)}% da área com falta de água por volta de ${dExt(deISO(maxF.d))}.`
    : maxF.r >= 20 ? `A previsão indica que o quadro deve continuar nos próximos dias, com cerca de ${n0(maxF.r)}% da área nessa situação.`
    : hoje.r >= 20 ? 'A previsão indica melhora nos próximos dias, com a volta da chuva.' : 'A previsão dos próximos dias não indica falta de água relevante.');
  // efeito provável na safra
  const pico = ondas.reduce((b, w) => !b || w.pico.r > b.pico.r ? w : b, null), crP = pico ? critDe(deISO(pico.pico.d)) : 0, crF = maxF ? critDe(deISO(maxF.d)) : 0;
  let ef;
  if (cana) ef = !pico ? 'Para a cana, isso significa crescimento dos colmos sem freio hídrico, bom sinal para a produtividade da próxima colheita.'
    : [4, 5, 6, 7, 8].includes(deISO(pico.pico.d).getMonth()) ? 'Na cana, a restrição na época seca é esperada e até ajuda a concentrar açúcar e a manter o ritmo do corte; o risco está em se prolongar a ponto de comprometer a rebrota das soqueiras.'
    : 'Na cana, falta de água fora da época seca freia o crescimento dos colmos e tende a reduzir a tonelagem por hectare da próxima colheita, sobretudo nos solos arenosos.';
  else if (!pico && !(maxF && maxF.r >= 20)) ef = 'Do ponto de vista da água, o potencial produtivo segue preservado até aqui.';
  else if (pico && crP < 10 && !(maxF && maxF.r >= 20 && crF >= 10)) ef = 'Como a falta de água pegou as lavouras ainda no início do ciclo, quando a planta exige pouca água e se recupera bem com a volta da chuva, o efeito sobre a produtividade tende a ser pequeno; o ponto de atenção é o estande, com possíveis falhas de germinação nos solos arenosos.';
  else ef = `A falta de água coincidiu ${maxF && maxF.r >= 20 && crF >= 10 ? 'e pode voltar a coincidir ' : ''}com fases em que a planta define o número e o peso dos grãos (florescimento e enchimento). É nesse momento que a restrição mais pesa: se persistir, pode reduzir a produtividade, o que precisa ser confirmado nas vistorias.`;
  if (pico && pico.pico.r >= 25) dest = `no pior momento do período, em ${dExt(deISO(pico.pico.d))}, ${n0(pico.pico.r)}% da área ficou com falta de água`;
  if (maxF && maxF.r >= 25 && maxF.r > hoje.r + 5) dest = `a previsão indica até ${n0(maxF.r)}% da área com falta de água por volta de ${dExt(deISO(maxF.d))}`;
  return {txt: fr.join(' '), efeito: ef, dest, pico: pico?.pico};
}
// relatos de viagem contados como texto corrido, já cruzados com os dados do painel
function prosaRelatos(cid, filtro) {
  const out = [], nomeC = (CULT[cid] || OUTRA).nome.toLowerCase();
  for (const rel of RELATOS.filter(r => (!filtro || filtro(r)) && (r.fatos || []).some(f => f.cid === cid))) {
    const fs = rel.fatos.filter(f => f.cid === cid), um = k => fs.filter(f => f.cat === k), um1 = k => um(k)[0];
    const rot = [...new Set(fs.filter(f => f.tipoEsc === 'regiao').flatMap(f => f.escopo))], escp = rot.length ? rot : [...new Set(fs.flatMap(f => f.escopo))];
    const regs = [...new Set(escp.map(cd => MUN_IDX[cd]?.properties.NM_RGI).filter(Boolean))];
    const mE = /entre os dias (\d{1,2}) e (\d{1,2}) de ([a-zç]+)/i.exec(rel.texto), quando = mE ? `Entre ${mE[1]} e ${mE[2]} de ${mE[3].toLowerCase()}` : `Em ${dExt(rel.data)}`;
    const onde = escp.length > 3 ? `${escp.length} municípios${regs.length ? ` das regiões de ${lista(regs)}` : ''}` : lista(escp.map(nmMun).filter(Boolean));
    const cl = new Set(um('clima').map(f => f.tipo)), motivo = cl.has('excesso') ? 'por causa das chuvas frequentes' : cl.has('falta') ? 'por falta de chuva' : '';
    const pl = um1('plantio'), at = um1('atraso'), pa = um1('paralisacao'), rp = um1('replantio'), pg = um('pragas'), es = [...new Set(um('estadio').flatMap(f => f.itens))];
    const p1 = [`${quando}, a equipe percorreu ${onde}.`];
    if (pl || at || pa) { let t = 'Nos municípios visitados, ';
      if (pl) t += `o plantio de ${nomeC} estava em cerca de ${pl.pct}% da área prevista${at ? ', com' : ''}`; else if (at) t += `o plantio de ${nomeC} acumulava`;
      if (at) t += ` atraso ${at.min != null ? (at.min === at.max ? `de cerca de ${at.min}%` : `de ${at.min}% a ${at.max}%`) : ''} em relação ao esperado`;
      if (pa) t += `${pl || at ? ', depois de' : `as operações de ${nomeC} ficaram paradas por`} ${pa.dias} dias${pl || at ? ' de máquinas paradas' : ''}`;
      if (motivo && (at || pa)) t += ` ${motivo}`; p1.push(t.replace(/\s+/g, ' ') + '.');
      if (motivo && !at && !pa) p1.push(cl.has('excesso') ? 'As chuvas frequentes têm dificultado o avanço das operações.' : 'A falta de chuva tem limitado o avanço das operações.'); }
    else if (motivo) p1.push(`Os produtores relatam ${cl.has('excesso') ? 'chuvas frequentes' : 'falta de chuva'} na região.`);
    const c = cultDaData(cid, rel.data), sub = c && !c.semFenologia ? {mun: Object.fromEntries(escp.filter(cd => c.mun[cd]).map(cd => [cd, c.mun[cd]]))} : null;
    const aReg = sub ? Object.values(sub.mun).reduce((t, m) => t + (m.area || 0), 0) : 0;
    if (rp || pg.length) { const pr = []; if (rp) pr.push(`houve replantio em cerca de ${n0(rp.ha)} hectares${aReg ? `, o que representa só ${n1(100 * rp.ha / aReg)}% da área de ${nomeC} nesses municípios` : ''}`);
      if (pg.length) { const it = [...new Set(pg.flatMap(f => f.itens))], nv = [...new Set(pg.map(f => f.nivel).filter(Boolean))]; pr.push(`${rp ? 'os produtores' : 'Os produtores'} relatam ${lista(it)}${nv.length ? ` em intensidade ${nv.map(x => ({moderado: 'moderada', alto: 'alta', baixo: 'baixa'})[x] || x).join(' a ')}` : ''}`); }
      p1.push(maiusc(pr.join(', e ')) + '.'); }
    if (es.length) p1.push(`As lavouras mais adiantadas já estavam em ${lista(es)}.`);
    const milHa = v => v >= 1000 ? `${n0(v / 1000)} mil` : n0(v);
    for (const f of um('conversao')) { const dst = /pecu/.test(f.para) ? 'à pecuária' : /euca/.test(f.para) ? 'ao eucalipto' : 'à cana', loc = f.escopo.length === 1 ? `Em ${nmMun(f.escopo[0])}` : 'Na região';
      p1.push(f.min ? `${loc}, ${f.max && f.max !== f.min ? `entre ${milHa(f.min)} e ${milHa(f.max)}` : `cerca de ${milHa(f.min)}`} hectares de ${nomeC} estão dando lugar ${dst}.` : `${loc}, parte da área de ${nomeC} está dando lugar ${dst}.`); }
    const ant = um('area').find(f => f.anterior), atu = um('area').find(f => !f.anterior);
    if (ant && atu) p1.push(`A área deve passar de cerca de ${haTxt(ant.ha)} na safra passada para ${haTxt(atu.ha)} nesta, ${atu.ha > ant.ha ? 'um aumento' : 'uma queda'} de ${n0(Math.abs(100 * (atu.ha - ant.ha) / ant.ha))}%.`);
    const cu = um('custo').find(f => f.valor), prc = um1('preco'), pd = um1('produtividade');
    if (cu && prc) { const kgNec = cu.valor / prc.valor * prc.kgSaca, queda = ant && atu && atu.ha < ant.ha;
      let t = `${queda ? 'Os números levantados na viagem ajudam a explicar essa redução' : 'Os números levantados na viagem mostram a situação econômica da cultura'}: com custo de R$ ${n0(cu.valor)} por hectare e preço de R$ ${prc.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} por ${prc.unid === 'kg' ? 'quilo' : `saca de ${prc.kgSaca} kg`}, o produtor precisa colher cerca de ${n0(kgNec)} kg por hectare só para cobrir os custos`;
      if (pd) { const kg = pd.unid === 'kg/ha' ? pd.valor : pd.valor * 60, marg = kg / prc.kgSaca * prc.valor - cu.valor;
        t += marg < 0 ? `, mas a produtividade média fica em torno de ${n0(kg)} kg. A conta não fecha: o prejuízo estimado é de cerca de R$ ${n0(-marg)} por hectare` : `, e a produtividade média, de cerca de ${n0(kg)} kg, deixa margem estimada de R$ ${n0(marg)} por hectare`; }
      p1.push(t + '.'); }
    if (um('credito').length) p1.push('O financiamento da lavoura depende sobretudo de revendas e cooperativas, com acesso difícil ao crédito bancário.');
    // cruzamento com o painel
    const p2 = [], pz = um1('prazo');
    if (sub && Object.keys(sub.mun).length) { const j = semanaDe(c, rel.data), pR = mediaMS(sub, m => acum(m.serie, j)), pE = mediaMS(c, m => acum(m.serie, j)), pA = mediaMS(sub, m => acum(m.serie, j - 2));
      if (pR) { if (pl) p2.push(Math.abs(pl.pct - pR.v) <= 12 ? `O número é consistente com o restante do levantamento: ${n0(pR.v)}% semeado nesses municípios na mesma semana.` : `O levantamento semanal indicava ${n0(pR.v)}% nesses municípios na mesma semana, ${pR.v > pl.pct ? 'mais' : 'menos'} do que o observado em campo; vale conferir esses municípios.`);
        if (at && pE) p2.push(pR.v < pE.v - 5 ? `Esses municípios estão ${n0(pE.v - pR.v)} pontos percentuais atrás da média do estado, o que confirma o atraso.` : `Apesar do atraso relatado, esses municípios avançam no mesmo ritmo do restante do estado (${n0(pR.v)}% semeado, contra ${n0(pE.v)}% na média estadual), o que indica que o atraso é em relação ao calendário habitual da região, e não aos demais municípios.`);
        if (pA && pR.v < 95) { const rit = (pR.v - pA.v) / 2; if (rit >= 1) { const d95 = addD(dataSem(c, j), 7 * Math.ceil((95 - pR.v) / rit));
          p2.push(`No ritmo das duas últimas semanas, de cerca de ${n0(rit)} pontos percentuais por semana, a região deve ultrapassar 95% da área semeada por volta de ${dExt(d95)}${pz ? (d95 > pz.data ? `, depois do prazo de ${dExt(pz.data)} esperado pelos produtores` : `, dentro do prazo de ${dExt(pz.data)} esperado pelos produtores`) : ''}.`); } } } }
    else if (pz) p2.push(`A expectativa é concluir o plantio até ${dExt(pz.data)}.`);
    const cj = (cl.has('excesso') || cl.has('falta')) && CL ? climaJanela(escp, rel.data, 30) : null;
    if (cj) { const umid = pg.some(f => f.itens.some(x => /lesma|caramujo|mofo|antracnose|ferrugem/.test(x)));
      if (cl.has('excesso')) p2.push(cj.p > cj.e * 1.2 || cj.dch >= 12 || cj.maxSeq >= 4 ? `O clima confirma o relato: nos 30 dias anteriores à viagem, ${cj.dch >= cj.dias ? 'choveu todos os dias' : `choveu em ${cj.dch} dos ${cj.dias} dias`}${umid ? ', ambiente úmido que favorece lesmas, caramujos e doenças, como relatado' : ''}.` : `O clima, no entanto, não mostra chuva fora do normal nos 30 dias anteriores (${n0(cj.p)} mm), o que sugere excesso localizado ou concentrado em poucos dias.`);
      else p2.push(cj.p - cj.e < -30 || cj.dch <= 4 ? `O clima confirma o relato: nos 30 dias anteriores choveu só ${n0(cj.p)} mm, para uma demanda de ${n0(cj.e)} mm.` : `O clima, porém, indica ${n0(cj.p)} mm nos 30 dias anteriores; a falta de água pode ser localizada.`); }
    for (const f of um('conversao')) if (f.escopo.length === 1) { const cd = f.escopo[0], eu = soloClasse('Eucalipto', cd)?.area, sj = soloCultura(cid, cd)?.area;
      if (eu || sj) p2.push(`${nmMun(cd)} tem hoje cerca de ${eu ? `${haTxt(eu)} de eucalipto` : 'pouca área de eucalipto'}${sj ? ` e ${haTxt(sj)} de ${nomeC}` : ''}${sj && f.max ? `; a troca relatada corresponderia a ${n0(100 * f.min / sj)}%${f.max !== f.min ? ` a ${n0(100 * f.max / sj)}%` : ''} da área de ${nomeC} do município, algo a acompanhar nas próximas safras` : ''}.`); }
    out.push(p1.join(' ')); if (p2.length) out.push(p2.join(' '));
  }
  return out;
}
// análise de uma cultura com fenologia
async function analisePDFCultura(c, s, n, ini, fim, dias, opts) {
  const cid = c.cid, nomeC = n.toLowerCase().replace(/ \(.*\)$/, ''), ja = Math.max(1, semanaDe(c, ini)), jb = Math.max(1, semanaDe(c, fim));
  const a = {c, s, n, cid, ja, jb, nomeC, nMun: Object.keys(c.mun).length, area: Object.values(c.mun).reduce((t, m) => t + (m.area || 0), 0)};
  a.pa = mediaMS(c, m => acum(m.serie, ja)); a.pb = mediaMS(c, m => acum(m.serie, jb)); a.crb = mediaMS(c, m => pctCritico(c, m, jb));
  let jUlt = 0; for (const m of Object.values(c.mun)) m.serie.forEach((v, i) => { if (v != null) jUlt = Math.max(jUlt, i + 1); }); a.jUlt = jUlt;
  const nS = Math.max(8, Math.min(30, Math.max(jb, jUlt) + 2));
  const prev = PL[safraAnterior(s)]?.[n]; let jUltP = 0; if (prev) for (const m of Object.values(prev.mun)) m.serie.forEach((v, i) => { if (v != null) jUltP = Math.max(jUltP, i + 1); });
  a.sem = [];
  for (let j = 1; j <= nS; j++) { const d = dataSem(c, j), pl = j <= jUlt ? mediaMS(c, m => acum(m.serie, j))?.v ?? 0 : null, plA = j === 1 ? 0 : a.sem[j - 2].pl;
    let ant = null; if (prev && Object.keys(prev.mun).length) { const jp = semanaDe(prev, addD(d, -364)); if (jp >= 1 && jp <= jUltP) ant = mediaMS(prev, m => acum(m.serie, jp))?.v ?? null; }
    a.sem.push({j, d, pl, inc: pl != null && plA != null ? Math.max(0, pl - plA) : null, cr: mediaMS(c, m => pctCritico(c, m, j))?.v ?? 0, ant}); }
  a.temAnt = a.sem.some(x => x.ant != null);
  const critDe = d => { const j = semanaDe(c, d); return a.sem[Math.min(a.sem.length, Math.max(1, j)) - 1]?.cr ?? (mediaMS(c, m => pctCritico(c, m, j))?.v || 0); };
  const pesos = Object.fromEntries(Object.entries(c.mun).map(([cd, m]) => [cd, m.area || 1])); a.pesos = pesos;
  // clima: semanas da planilha, período e restrição hídrica (com 30 dias antes para o solo "aquecer")
  if (opts.clima) { const ini0 = addD(ini < c.inicio ? ini : c.inicio, -30), fim0 = addD(HOJE, 16); const dc = await climaDiario(ini0, fim0);
    for (const x of a.sem) { let p = 0, nd = 0, pv = false; for (let k = 6; k >= 0; k--) { const D = dc[dISO(addD(x.d, -k))]; if (!D) continue; let sw = 0, sp = 0; for (const cd in pesos) { const v = D.mun[cd]; if (!v) continue; sw += pesos[cd]; sp += (v.p || 0) * pesos[cd]; } if (!sw) continue; p += sp / sw; nd++; if (D.fonte === 'previsão') pv = true; }
      if (nd >= 4) { x.chuva = p * 7 / nd; x.prev = pv; } }
    a.semClima = a.sem.some(x => x.chuva != null);
    a.serie = serieDias(dc, pesos, ini, fim < HOJE ? fim : addD(HOJE, -1));
    a.R = restricaoPeriodo(c, cid, ini, dc).filter(x => deISO(x.d) <= addD(fim > HOJE ? fim : HOJE, 15));
    a.agua = historiaAgua(a.R, critDe, nomeC, false); }
  // --- texto: semeadura, em ordem cronológica
  const S = a.sem, fr = [], comD = S.filter(x => x.pl != null);
  const j1 = comD.find(x => x.pl >= 1);
  if (a.pa?.v >= 5) fr.push(`O período começou, em ${dExt(ini)}, com ${n0(a.pa.v)}% da área de ${nomeC} já semeada.`);
  else if (j1) fr.push(j1.pl >= 3 ? `Na semana encerrada em ${dExt(j1.d)}, a semeadura da ${nomeC} já alcançava ${n0(j1.pl)}% da área.` : `A semeadura da ${nomeC} começou de forma tímida na semana encerrada em ${dExt(j1.d)}.`);
  const ativas = S.filter(x => x.j >= Math.max(ja, j1?.j || 1) && x.j <= Math.min(jb, jUlt) && x.inc != null);
  if (ativas.length >= 2) { const pico = ativas.reduce((b, x) => x.inc > b.inc ? x : b), lento = ativas.filter(x => x.inc < 3 && x.j < pico.j);
    if (lento.length) fr.push(`Nas primeiras semanas o avanço foi lento${lento.some(x => x.chuva >= 30) ? ', com chuva atrapalhando a entrada das máquinas' : lento.some(x => x.chuva != null && x.chuva < 5) ? ', com o solo ainda seco à espera de chuva' : ''}.`);
    fr.push(`O ritmo ${lento.length ? 'ganhou força' : 'foi mais forte'} na semana encerrada em ${dExt(pico.d)}, quando ${n0(pico.inc)}% da área foi semeada em apenas sete dias${pico.chuva != null ? (pico.chuva >= 30 ? `, mesmo com ${n0(pico.chuva)} mm de chuva` : pico.chuva >= 8 ? `, aproveitando a umidade de ${n0(pico.chuva)} mm de chuva` : ', em uma semana de tempo firme') : ''}.`);
    const dep = ativas.filter(x => x.j > pico.j), trava = dep.find(x => x.inc < pico.inc * .4);
    if (trava) fr.push(`Depois disso, a semeadura perdeu fôlego na semana encerrada em ${dExt(trava.d)}, com apenas ${n0(trava.inc)}% da área semeada${trava.chuva >= 30 ? `, quando ${n0(trava.chuva)} mm de chuva seguraram as operações` : ''}.`); }
  const ult = S[jUlt - 1], u2 = S[jUlt - 3];
  if (ult) { let t = `Em ${dExt(ult.d)}, ${n0(ult.pl)}% da área estava semeada`;
    if (ult.ant != null) { const dl = ult.pl - ult.ant; t += Math.abs(dl) < 3 ? `, praticamente o mesmo da safra passada na mesma data (${n0(ult.ant)}%)` : `, ${dl > 0 ? 'à frente' : 'atrás'} da safra passada, que na mesma data tinha ${n0(ult.ant)}%`; a.destAnt = Math.abs(dl) >= 5 ? `${dl > 0 ? 'à frente' : 'atrás'} da safra passada (${n0(ult.ant)}%)` : null; }
    fr.push(t + '.');
    if (u2 && ult.pl < 95) { const rit = (ult.pl - u2.pl) / 2; if (rit >= 1) { const alvo = ult.pl < 85 ? 90 : 100; a.dFim = addD(ult.d, 7 * Math.ceil((alvo - ult.pl) / rit)); a.alvo = alvo; a.ritmo = rit;
      fr.push(`Mantido o ritmo recente, de cerca de ${n0(rit)} pontos percentuais por semana, a semeadura deve chegar a ${alvo}% por volta de ${dExt(a.dFim)}.`); }
      else fr.push('Nas duas últimas semanas, porém, a semeadura praticamente não avançou.'); }
    else if (ult.pl >= 95) fr.push('A semeadura está praticamente encerrada.');
  }
  // regiões, numa frase
  const reg = {}; for (const [cd, m] of Object.entries(c.mun)) { const r = MUN_IDX[cd]?.properties.NM_RGI || '—'; (reg[r] ??= []).push(m); }
  a.regs = Object.entries(reg).map(([r, ms]) => { const cc = {mun: Object.fromEntries(ms.map((m, i) => [i, m]))};
    return {r, n: ms.length, area: ms.reduce((t, m) => t + (m.area || 0), 0), a: mediaMS(cc, m => acum(m.serie, ja))?.v ?? 0, b: mediaMS(cc, m => acum(m.serie, jb))?.v ?? 0, k: mediaMS(cc, m => pctCritico(c, m, jb))?.v ?? 0}; }).sort((x, y) => y.area - x.area || x.r.localeCompare(y.r));
  const rs = a.regs.filter(r => r.area > 0), ord = [...rs].sort((x, y) => y.b - x.b);
  if (ord.length >= 3) { const sp = ord[0].b - ord.at(-1).b;
    const rg = r => r.replace(/ - /g, '-');
    fr.push(sp >= 20 ? `O avanço não é uniforme no estado: a região de ${rg(ord[0].r)} está à frente, com ${n0(ord[0].b)}% da área semeada, enquanto a de ${rg(ord.at(-1).r)} está em ${n0(ord.at(-1).b)}%. A região de ${rg(rs[0].r)}, que concentra a maior área, está em ${n0(rs[0].b)}%.` : `As regiões avançam em ritmo parecido, entre ${n0(ord.at(-1).b)}% (${rg(ord.at(-1).r)}) e ${n0(ord[0].b)}% (${rg(ord[0].r)}).`); }
  a.txtPlantio = fr.join(' ');
  // --- tempo e água
  if (a.serie?.length) { const p = a.serie.reduce((t, x) => t + x.p, 0), e = a.serie.reduce((t, x) => t + x.e, 0); a.chuvaTot = p;
    a.txtTempo = `${historiaTempo(a.serie)} No balanço do período, choveu ${n0(p)} mm nas áreas de ${nomeC}, ${p > e * 1.15 ? 'mais do que' : p < e * .85 ? 'menos do que' : 'praticamente o mesmo que'} o solo e as plantas perderam por evaporação (${n0(e)} mm).`; }
  // --- o que vem pela frente
  const cal = calendarioCritico(c, serieEstado(c)).filter(x => x[1] && x[1] >= addD(HOJE, -3)); let crit3 = 0; for (let j = semanaDe(c, HOJE); j <= semanaDe(c, HOJE) + 3; j++) crit3 = Math.max(crit3, mediaMS(c, m => pctCritico(c, m, j))?.v || 0);
  const dist = new Array(c.estadios.length).fill(0); let sw = 0; const jh = semanaDe(c, HOJE);
  for (const m of Object.values(c.mun)) { const w = m.area || 1; sw += w; distrib(c, m, jh).forEach((v, i) => dist[i] += v * w); }
  a.dist = dist.map(v => sw ? v / sw : 0); const top = a.dist.map((v, i) => [v, c.estadios[i].nome]).filter(x => x[0] >= 5).sort((x, y) => y[0] - x[0]);
  const fr2 = [];
  const fase = nm => { const t = nm.toLowerCase().replace(/\s*\(.*\)/, ''); return /semead|emerg/.test(t) ? 'entre a semeadura e a emergência' : /vegetat/.test(t) ? 'em fase vegetativa' : /matur|colh/.test(t) ? 'em maturação' : `em ${t}`; };
  if (top.length) fr2.push(`Hoje, a maior parte das lavouras semeadas está ${fase(top[0][1])}${top[1] ? `, e cerca de ${n0(top[1][0])}% ${fase(top[1][1])}` : ''}.`);
  if (cal.length) fr2.push(`A expectativa é que metade da área semeada chegue ao ${cal[0][0].toLowerCase().replace(/\s*\(.*\)/, '')} por volta de ${dExt(cal[0][1])}${cal[1] ? ` e ao ${cal.at(-1)[0].toLowerCase().replace(/\s*\(.*\)/, '')} perto de ${dExt(cal.at(-1)[1])}` : ''}. A partir daí, o clima passa a pesar mais na produtividade.`);
  if (CL) { const mc = climaPonderado(pesos)?.mc, h0 = iHoje(); if (mc) { const p15 = mc.p.slice(h0, h0 + 15).reduce((t, x) => t + (x || 0), 0), cc = concordancia(totaisModelos(mc, h0, h0 + 7));
    fr2.push(`Para os próximos 15 dias, a previsão indica ${n0(p15)} mm de chuva nas áreas de ${nomeC}${cc ? (cc.nivel === 'alta' ? ', com boa concordância entre as previsões' : cc.nivel === 'baixa' ? ', mas com bastante incerteza' : '') : ''}.`); a.p15 = p15; } }
  a.txtFrente = fr2.join(' '); a.crit3 = crit3;
  // --- campo
  const noP = r => r.data >= ini && r.data <= addD(fim, 1);
  a.rels = RELATOS.filter(r => r.cults.has(cid) && noP(r));
  a.prosa = opts.campo ? prosaRelatos(cid, noP) : [];
  // frase-resumo para a primeira página
  let m = ult ? `A ${nomeC} chegou a ${n0(ult.pl)}% da área semeada${a.destAnt ? `, ${a.destAnt}` : ''}${a.dFim ? ` e, no ritmo atual, deve alcançar ${a.alvo}% por volta de ${dExt(a.dFim)}` : ''}` : `A semeadura de ${nomeC} ainda não começou`;
  if (a.agua?.dest) m += `; ${a.agua.dest}`; else if (a.agua) m += ', sem falta de água relevante até aqui';
  a.manchete = m.replace(/^A (milho|feijão|sorgo|trigo|arroz|amendoim|algodão)/i, 'O $1') + '.'; a.sc = soloCultura(cid, null); a.rc = opts.clima ? resumoClima(dias, pesos) : null;
  return a;
}
async function analisePDFCana(ini, fim, dias, opts) {
  const c = CANA, a = {cana: true, c, cid: 'cana', nomeC: 'cana', n: 'Cana-de-açúcar'}; const l = Object.entries(c.mun).filter(([cd]) => MUN_IDX[cd]);
  a.area = l.reduce((t, [, m]) => t + m.area, 0); a.nMun = l.length; const pesos = Object.fromEntries(l.map(([cd, m]) => [cd, m.area])); a.pesos = pesos;
  const reg = {}; l.forEach(([cd, m]) => { const r = MUN_IDX[cd].properties.NM_RGI || '—'; reg[r] = (reg[r] || 0) + m.area; });
  a.regs = Object.entries(reg).sort((x, y) => y[1] - x[1]); const top = a.regs.slice(0, 3);
  a.txtArea = `O mapeamento da Aprosoja-MS identifica ${haTxt(a.area)} de cana em ${a.nMun} municípios. A cultura se concentra nas regiões de ${lista(top.map(([r]) => r))}, que somam ${n0(100 * top.reduce((t, x) => t + x[1], 0) / a.area)}% da área; os maiores municípios são ${lista(l.sort((x, y) => y[1].area - x[1].area).slice(0, 3).map(([cd]) => nmMun(cd)))}.`;
  if (opts.clima) { const dc = await climaDiario(addD(ini, -30), addD(HOJE, 16)); a.serie = serieDias(dc, pesos, ini, fim < HOJE ? fim : addD(HOJE, -1));
    a.R = restricaoPeriodo(c, 'cana', ini, dc).filter(x => deISO(x.d) <= addD(fim > HOJE ? fim : HOJE, 15)); a.agua = historiaAgua(a.R, () => 0, 'cana', true);
    if (a.serie.length) { const p = a.serie.reduce((t, x) => t + x.p, 0), e = a.serie.reduce((t, x) => t + x.e, 0); a.chuvaTot = p; a.txtTempo = `${historiaTempo(a.serie)} No balanço do período, choveu ${n0(p)} mm nos canaviais, ${p > e * 1.15 ? 'mais do que' : p < e * .85 ? 'menos do que' : 'praticamente o mesmo que'} o solo e as plantas perderam por evaporação (${n0(e)} mm).`; } }
  // relatos de cana: os do período ou, se não houver, os dos últimos seis meses (o levantamento de cana é menos frequente)
  const noP = r => r.data >= ini && r.data <= addD(fim, 1), recente = r => r.data >= addD(fim < HOJE ? fim : HOJE, -200) && r.data <= addD(fim, 1);
  const relCana = RELATOS.filter(r => r.grupo === 'cana'), filtroC = relCana.some(noP) ? noP : recente;
  a.rels = RELATOS.filter(r => r.cults.has('cana') && (r.grupo === 'cana' ? filtroC(r) : noP(r)));
  a.U = USINAS?.R || null; a.UT = a.U?.textos || null; a.Uav = USINAS?.avisos || [];
  a.prosa = opts.campo ? [...await prosaRelatosCana(filtroC, a.U), ...prosaRelatos('cana', r => noP(r) && r.grupo !== 'cana')] : [];
  a.sc = soloCultura('cana', null); a.rc = opts.clima ? resumoClima(dias, pesos) : null;
  const hoje = a.R?.filter(x => !x.prev && x.r != null).at(-1);
  const U = a.U; let mU = '';
  if (U?.atual?.moida) { const vM = varPct(U.compCana.ant.moida, U.compCana.atu.moida), etT = (U.atualProd.etanol || 0) + (U.atualMilho.etanolMilho || 0);
    const encU = safraEncerrada(U.safra); mU = `${encU ? `Na safra ${U.safra}, encerrada em março, as usinas moeram cerca de ${miT(U.atual.moida)} de cana` : `As usinas estimam moer ${miT(U.atual.moida)} de cana na safra ${U.safra}`}${vM != null && U.compCana.n >= 3 ? ` (${Math.abs(vM) < 1 ? 'estável' : `${n0(Math.abs(vM))}% ${vM > 0 ? 'a mais' : 'a menos'}`} que na safra anterior, nas mesmas usinas)` : ''} e ${encU ? 'produziram' : 'produzir'} ${litros(etT)} de etanol, ${U.atualMilho.etanolMilho ? `${n0(100 * U.atualMilho.etanolMilho / etT)}% deles a partir do milho` : 'todos de cana'}. `; }
  a.manchete = mU + `Nos ${haTxt(a.area)} de cana mapeados, ${hoje ? (hoje.r >= 5 ? `${n0(hoje.r)}% dos canaviais estão hoje com falta de água` : 'a água do solo atende hoje praticamente todos os canaviais') : 'a água no solo não pôde ser avaliada'}${hoje?.r >= 5 && a.agua?.pico?.r >= hoje.r + 10 ? `; no pior momento do período, em ${dExt(deISO(a.agua.pico.d))}, essa parcela chegou a ${n0(a.agua.pico.r)}%` : a.agua?.dest ? `; ${a.agua.dest}` : ''}.`;
  return a;
}
// estado da água no solo hoje (balanço FAO-56 por município) — tabela do anexo
function aguaPDF(c, cid) {
  if (!CL) return null; const cls = [0, 0, 0, 0], clsF = [0, 0, 0, 0]; let tw = 0, twF = 0; const pior = [];
  for (const [cd, m] of Object.entries(c.mun)) { const mc = CL.mun[cd], f = MUN_IDX[cd]; if (!mc || !f) continue;
    const bh = balancoHidrico(mc, cadMun(cid, cd), c, m, cd), w = m.area || 1;
    if (bh.campoAtual > 0 && bh.ksAtual != null) { tw += w; cls[classeKs(bh.ksAtual)] += w; }
    if (bh.ksMinFutCampo != null) { twF += w; clsF[classeKs(bh.ksMinFutCampo)] += w; }
    if ((bh.ksMinFutCampo ?? 1) < .99 || (bh.campoAtual > 0 && bh.ksAtual < .99)) pior.push([f.properties.NM_MUN, bh, w]); }
  if (!tw && !twF) return null;
  pior.sort((a, b) => (a[1].ksMinFutCampo ?? 1) - (b[1].ksMinFutCampo ?? 1) || a[1].atual - b[1].atual);
  return {h: cls.map(v => tw ? 100 * v / tw : 0), f: clsF.map(v => twF ? 100 * v / twF : 0), pior: pior.slice(0, 10), tw, twF};
}
// ---------- gráficos ----------
function graficoSemeaduraPDF(doc, a, ctx) {
  const {M, W, CINZA} = ctx, S = a.sem, nS = S.length, gh = 42, ghC = a.semClima ? 11 : 0; ctx.garantir(gh + ghC + 20);
  const gx = M + 8, gy = ctx.y() + 2, gw = W - 2 * M - 16, X = j => gx + (j - .5) * gw / nS, bw = gw / nS * .58, Y = v => gy + gh - Math.max(0, Math.min(100, v)) / 100 * gh;
  const mInc = Math.max(8, Math.ceil(Math.max(...S.map(x => x.inc || 0)) * 1.15 / 4) * 4), YI = v => gy + gh - v / mInc * gh;
  doc.setDrawColor(232); doc.setLineWidth(.15); [0, 50, 100].forEach(v => { doc.line(gx, Y(v), gx + gw, Y(v)); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CINZA); doc.text(v + '%', gx - 1.5, Y(v) + 1, {align: 'right'}); });
  S.forEach(x => { if (!(x.inc > 0)) return; doc.setFillColor(168, 205, 160); doc.rect(X(x.j) - bw / 2, YI(x.inc), bw, gy + gh - YI(x.inc), 'F'); if (x.inc >= 1.5) { doc.setFontSize(6); doc.setTextColor(70, 120, 70); doc.text(x.inc.toFixed(0), X(x.j), YI(x.inc) - .8, {align: 'center'}); } });
  const linha = (pts, cor, lw, dash) => { doc.setDrawColor(...cor); doc.setLineWidth(lw); if (dash) doc.setLineDashPattern(dash, 0); for (let i = 1; i < pts.length; i++) if (pts[i - 1] && pts[i]) doc.line(...pts[i - 1], ...pts[i]); doc.setLineDashPattern([], 0); };
  if (a.temAnt) linha(S.map(x => x.ant == null ? null : [X(x.j), Y(x.ant)]), [160, 160, 160], .5, [1.5, 1]);
  linha(S.map(x => x.pl == null ? null : [X(x.j), Y(x.pl)]), [47, 107, 58], 1);
  const uj = S.filter(x => x.pl != null).at(-1); if (uj) { doc.setFillColor(47, 107, 58); doc.circle(X(uj.j), Y(uj.pl), .9, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(47, 107, 58); doc.text(uj.pl.toFixed(0) + '%', X(uj.j) + 1.8, Y(uj.pl) + 1); }
  let yb = gy + gh;
  if (a.semClima) { const g2 = yb + 2.5, mP = Math.max(20, ...S.map(x => x.chuva || 0)), YP = v => g2 + ghC - v / mP * ghC;
    S.forEach(x => { if (x.chuva == null) return; if (x.prev) doc.setFillColor(190, 214, 238); else doc.setFillColor(110, 160, 210); doc.rect(X(x.j) - bw / 2, YP(x.chuva), bw, g2 + ghC - YP(x.chuva), 'F'); if (x.chuva >= 15) { doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(60, 110, 160); doc.text(x.chuva.toFixed(0), X(x.j), YP(x.chuva) - .6, {align: 'center'}); } });
    yb = g2 + ghC; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CINZA); const passo = Math.ceil(nS / 9);
  S.forEach((x, i) => { if (i % passo === 0) doc.text(fmtD(x.d).slice(0, 5), X(x.j), yb + 3.3, {align: 'center'}); });
  const jh = semanaDe(a.c, HOJE); if (jh >= 1 && jh <= nS) { doc.setDrawColor(150); doc.setLineWidth(.2); doc.setLineDashPattern([.6, .8], 0); doc.line(X(jh), gy, X(jh), yb); doc.setLineDashPattern([], 0); doc.text('hoje', X(jh) + .8, gy + 2.2); }
  const leg = [['b', [168, 205, 160], '% semeado na semana'], ['l', [47, 107, 58], '% semeado acumulado']]; if (a.temAnt) leg.push(['t', [160, 160, 160], `safra ${safraAnterior(a.s)}`]); if (a.semClima) leg.push(['b', [110, 160, 210], 'chuva na semana (mm)']);
  legendaPDF(doc, leg, gx, yb + 8, CINZA); ctx.setY(yb + 13);
}
function graficoRestricaoPDF(doc, a, ctx) {
  const {M, W, CINZA} = ctx, R = a.R.filter(x => x.pct), n = R.length; if (n < 5) return; const gh = 34; ctx.garantir(gh + 20);
  const gx = M + 8, gy = ctx.y() + 2, gw = W - 2 * M - 16, X = i => gx + i / (n - 1) * gw, Y = v => gy + gh - v / 100 * gh;
  const iP = R.findIndex(x => x.prev); if (iP >= 0) { doc.setFillColor(246, 245, 241); doc.rect(X(iP), gy, gx + gw - X(iP), gh, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CINZA); doc.text('previsão', X(iP) + 1, gy + 2.6); }
  doc.setDrawColor(232); doc.setLineWidth(.15); [0, 50, 100].forEach(v => { doc.line(gx, Y(v), gx + gw, Y(v)); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CINZA); doc.text(v + '%', gx - 1.5, Y(v) + 1, {align: 'right'}); });
  // áreas empilhadas: severa (embaixo), moderada, leve
  const cores = [null, [240, 197, 65], [232, 128, 63], [196, 61, 43]], base = new Array(n).fill(0);
  for (const k of [3, 2, 1]) { doc.setFillColor(...cores[k]); for (let i = 1; i < n; i++) { const a0 = base[i - 1], a1 = base[i], b0 = a0 + R[i - 1].pct[k], b1 = a1 + R[i].pct[k];
      if (b0 - a0 < .05 && b1 - a1 < .05) continue; doc.triangle(X(i - 1), Y(a0), X(i), Y(a1), X(i), Y(b1), 'F'); doc.triangle(X(i - 1), Y(a0), X(i), Y(b1), X(i - 1), Y(b0), 'F'); }
    R.forEach((x, i) => base[i] += x.pct[k]); }
  if (Math.max(...R.map(x => x.r || 0)) < 2) { doc.setFont('times', 'italic'); doc.setFontSize(9.5); doc.setTextColor(...CINZA); doc.text('sem falta de água nas lavouras durante todo o período', gx + gw / 2, Y(55), {align: 'center'}); }
  if (!a.cana) { doc.setDrawColor(47, 107, 58); doc.setLineWidth(.45); doc.setLineDashPattern([1.2, .8], 0); for (let i = 1; i < n; i++) { const c0 = a.critDe ? a.critDe(deISO(R[i - 1].d)) : 0, c1 = a.critDe ? a.critDe(deISO(R[i].d)) : 0; doc.line(X(i - 1), Y(c0), X(i), Y(c1)); } doc.setLineDashPattern([], 0); }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CINZA); const passo = Math.max(1, Math.round(n / 8));
  R.forEach((x, i) => { if (i % passo === 0) doc.text(fmtD(deISO(x.d)).slice(0, 5), X(i), gy + gh + 3.3, {align: 'center'}); });
  const leg = [['b', cores[1], 'restrição leve'], ['b', cores[2], 'moderada'], ['b', cores[3], 'severa']]; if (!a.cana) leg.push(['t', [47, 107, 58], '% da área em fase crítica']);
  legendaPDF(doc, leg, gx, gy + gh + 8, CINZA); doc.text('% da área cultivada', gx + gw, gy + gh + 8, {align: 'right'}); ctx.setY(gy + gh + 13);
}
function legendaPDF(doc, itens, x, y, CINZA) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
  for (const [t, cor, txt] of itens) { if (t === 'b') { doc.setFillColor(...cor); doc.rect(x, y - 2, 3, 2.3, 'F'); } else { doc.setDrawColor(...cor); doc.setLineWidth(t === 't' ? .5 : 1); if (t === 't') doc.setLineDashPattern([1.2, .8], 0); doc.line(x, y - .9, x + 4, y - .9); doc.setLineDashPattern([], 0); }
    doc.setTextColor(...CINZA); doc.text(txt, x + 5, y); x += 8 + doc.getTextWidth(txt); }
}
// ---------- documento ----------
async function gerarPDF(ini, fim, sel, opts) {
  await carregarScript(LIBS.jspdf); await carregarScript(LIBS.autotable);
  const {jsPDF} = window.jspdf, doc = new jsPDF({unit: 'mm', format: 'a4'}), W = 210, M = 18;
  const logo = await imagemDataURL('img/logo_conab.png').catch(() => null);
  const VERDE = [47, 107, 58], CINZA = [120, 128, 116], TINTA = [38, 44, 36];
  const cab = () => { if (logo) doc.addImage(logo, 'PNG', M, 9, 6.5, 9.6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...TINTA); doc.text('Conab · Superintendência Regional de Mato Grosso do Sul', M + 9, 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA); doc.text('Setor de Apoio à Logística e à Gestão de Oferta – SEGEO-MS', M + 9, 16.8);
    doc.setDrawColor(225); doc.setLineWidth(.2); doc.line(M, 21, W - M, 21); };
  let y = 0;
  const novaPag = () => { doc.addPage(); cab(); y = 30; }, garantir = h => { if (y + h > 278) novaPag(); };
  const ctx = {M, W, CINZA, y: () => y, setY: v => y = v, garantir};
  const h1 = t => { garantir(16); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...TINTA); doc.text(pdfTxt(t), M, y); y += 7; };
  const linhaSub = t => { doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...CINZA); const ls = doc.splitTextToSize(pdfTxt(t), W - 2 * M); doc.text(ls, M, y); y += ls.length * 4.2 + 3; };
  const h2 = t => { garantir(18); y += 2; doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...VERDE); doc.text(pdfTxt(t), M, y); y += 5.5; };
  const txt = (t, tam = 10.5, cor = TINTA) => { if (!t) return; doc.setFont('times', 'normal'); doc.setFontSize(tam); doc.setTextColor(...cor); const lh = tam * .47;
    for (const l of doc.splitTextToSize(pdfTxt(t), W - 2 * M)) { garantir(lh); doc.setFont('times', 'normal'); doc.setFontSize(tam); doc.setTextColor(...cor); doc.text(l, M, y); y += lh; } y += 2.6; };
  const destaque = t => { if (!t) return; doc.setFont('times', 'italic'); doc.setFontSize(10.5); const ls = doc.splitTextToSize(pdfTxt(t), W - 2 * M - 6), lh = 4.9; garantir(ls.length * lh + 2);
    doc.setDrawColor(...VERDE); doc.setLineWidth(.6); doc.line(M, y - 3.4, M, y - 3.4 + ls.length * lh); doc.setTextColor(...TINTA); ls.forEach((l, i) => doc.text(l, M + 5, y + i * lh)); y += ls.length * lh + 3; };
  const nota = t => { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...CINZA); const ls = doc.splitTextToSize(pdfTxt(t), W - 2 * M); garantir(ls.length * 3); doc.text(ls, M, y); y += ls.length * 3 + 2; };
  const numeros = itens => { garantir(17); const w = (W - 2 * M) / itens.length;
    itens.forEach(([v, l], i) => { const x = M + i * w; if (i) { doc.setDrawColor(225); doc.setLineWidth(.2); doc.line(x - 3, y - 1, x - 3, y + 12); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...VERDE); doc.text(pdfTxt(v), x, y + 5.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.3); doc.setTextColor(...CINZA); doc.text(doc.splitTextToSize(pdfTxt(l), w - 5), x, y + 9.6); }); y += 17; };
  const sub2 = t => { garantir(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...TINTA); doc.text(pdfTxt(t), M, y); y += 4.2; };
  const tabela = (head, body, extra = {}) => { garantir(14); doc.autoTable(Object.assign({head: [head], body: body.map(r => r.map(pdfTxt)), startY: y, margin: {left: M, right: M, top: 30}, theme: 'plain',
    styles: {font: 'helvetica', fontSize: 7.5, cellPadding: {top: 1.1, bottom: 1.1, left: 1, right: 1}, textColor: TINTA, lineColor: [228, 228, 222], lineWidth: {bottom: .1}},
    headStyles: {textColor: VERDE, fontStyle: 'bold', lineColor: VERDE, lineWidth: {bottom: .3}}, didDrawPage: d => { if (d.pageNumber > 1) cab(); }}, extra)); y = doc.lastAutoTable.finalY + 5; };
  // ---------- análise ----------
  const dias = opts.clima ? await climaDiario(ini, fim) : {};
  const A = []; for (const [s, n] of sel) A.push(n === CANA_SEL ? await analisePDFCana(ini, fim, dias, opts) : await analisePDFCultura(PL[s][n], s, n, ini, fim, dias, opts));
  A.forEach(a => { if (!a.cana) a.critDe = d => { const j = semanaDe(a.c, d); return a.sem[Math.min(a.sem.length, Math.max(1, j)) - 1]?.cr ?? 0; }; });
  const cidsSel = new Set(A.map(a => a.cid)), noP = r => r.data >= ini && r.data <= addD(fim, 1);
  const outras = opts.campo ? [...new Set(RELATOS.filter(noP).flatMap(r => (r.fatos || []).map(f => f.cid)))].filter(cid => cid && !cidsSel.has(cid) && CULT[cid]) : [];
  // ---------- página 1: panorama ----------
  cab(); y = 38;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...VERDE); doc.text('RESUMO DA SAFRA · MATO GROSSO DO SUL', M, y); y += 9;
  h1(`${dExt(ini)} a ${dExt(fim)} de ${fim.getFullYear()}`.replace(/^(\d)/, '$1'));
  linhaSub(`${A.map(a => a.n).join(', ')} · gerado em ${fmtDL(new Date())}`); y += 3;
  const pesosT = {}; A.forEach(a => { for (const [cd, w] of Object.entries(a.pesos || {})) pesosT[cd] = (pesosT[cd] || 0) + w; });
  const serieT = opts.clima ? serieDias(dias, pesosT, ini, fim < HOJE ? fim : addD(HOJE, -1)) : [];
  h2('Panorama');
  if (serieT.length) { const p = serieT.reduce((t, x) => t + x.p, 0), e = serieT.reduce((t, x) => t + x.e, 0);
    txt(`Entre ${dExt(ini)} e ${dExt(fim)}, as áreas agrícolas do estado receberam em média ${n0(p)} mm de chuva, ${p > e * 1.15 ? 'mais do que' : p < e * .85 ? 'menos do que' : 'praticamente o mesmo que'} o solo e as plantas perderam por evaporação no mesmo período (${n0(e)} mm). ${historiaTempo(serieT)}`); }
  txt(A.map(a => a.manchete).join(' '));
  y += 2;
  for (const a of A) { garantir(24); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TINTA); doc.text(pdfTxt(a.n), M, y); y += 4.5;
    const hj = a.R?.filter(x => !x.prev && x.r != null).at(-1);
    numeros(a.cana ? [...(a.U?.atual?.moida ? [[`${n1(a.U.atual.moida / 1000)} mi t`, `de cana a moer (safra ${a.U.safra})`], [`${n2(((a.U.atualProd.etanol || 0) + (a.U.atualMilho.etanolMilho || 0)) / 1e6)} bi L`, 'de etanol (cana e milho)']] : [[haTxt(a.area).replace(' de hectares', ' ha').replace(' hectares', ' ha'), 'mapeados (Aprosoja-MS)']]), [hj ? n0(hj.r) + '%' : '—', 'dos canaviais com falta de água hoje'], [a.chuvaTot != null ? n0(a.chuvaTot) + ' mm' : '—', 'de chuva no período']]
      : [[a.jUlt ? n0(a.sem[a.jUlt - 1].pl) + '%' : '—', `semeado (${a.jUlt ? fmtD(a.sem[a.jUlt - 1].d).slice(0, 5) : ''})`], [a.pa && a.pb ? '+' + n0(a.pb.v - a.pa.v) : '—', 'pontos percentuais de avanço no período'], [hj ? n0(hj.r) + '%' : '—', 'da área cultivada com falta de água hoje'], [a.chuvaTot != null ? n0(a.chuvaTot) + ' mm' : '—', 'de chuva no período']]); }
  nota('Números do estado ponderados pela área de cada cultura. Semeadura: planilha semanal da SEGEO-MS. Clima: reanálise ERA5 e modelos numéricos (Open-Meteo), com evapotranspiração ajustada pelas estações do INMET. Falta de água: balanço hídrico do solo por município (FAO-56). Dados preliminares, sujeitos a revisão; associações entre indicadores não implicam causa.');
  // ---------- uma seção por cultura ----------
  for (const a of A) {
    novaPag(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...VERDE); doc.text(a.cana ? 'CANA-DE-AÇÚCAR E BIOENERGIA' : `SAFRA ${a.s}`, M, y); y += 8;
    h1(a.cana ? 'Cana-de-açúcar' : a.n.replace(/ \(.*\)$/, ''));
    linhaSub(a.cana ? `${haTxt(a.area)} em ${a.nMun} municípios` : `${a.area ? haTxt(a.area) + ' em' : 'Presente em'} ${a.nMun} municípios`);
    if (a.cana) { h2('Onde está a cana'); txt(a.txtArea);
      const U = a.U, UT = a.UT;
      if (UT) { if (UT.safra) { h2(`A safra ${U.safra} nas usinas`); txt(UT.safra[0]); txt(UT.safra[1]); graficoRevisoesPDF(doc, UT.rev, ctx); if (UT.safra[2]) { txt(UT.safra[2]); graficoChuvaUsinasPDF(doc, U.chuva, ctx); } }
        if (UT.canavial) { h2('O canavial: idade, renovação e produtividade'); txt(UT.canavial[0]); graficoIdadePDF(doc, idadeResumo(U.atualArea), ctx); UT.canavial.slice(1).forEach(p => txt(p)); }
        if (UT.produtos) { h2('Açúcar, etanol e energia'); UT.produtos.forEach(p => txt(p)); }
        if (UT.milho) { h2('Etanol de milho'); UT.milho.forEach(p => txt(p)); graficoEtanolPDF(doc, U, ctx); }
        if (UT.polos) { h2('Os polos produtores'); UT.polos.forEach(p => txt(p)); }
        if (UT.industria) { h2('A indústria'); UT.industria.forEach(p => txt(p)); } } }
    else { h2('Como andou a semeadura'); txt(a.txtPlantio); graficoSemeaduraPDF(doc, a, ctx); }
    if (opts.clima && (a.txtTempo || a.R)) { h2('O tempo e a água no solo'); txt(a.txtTempo); txt(a.agua?.txt);
      if (a.R) graficoRestricaoPDF(doc, a, ctx); destaque(a.agua?.efeito); }
    if (!a.cana && a.txtFrente) { h2('O que vem pela frente'); txt(a.txtFrente); }
    if (opts.campo && (a.prosa.length || a.rels.length)) { h2('Levantamento de campo'); a.prosa.forEach(p => txt(p));
      if (!a.prosa.length && a.rels.length) txt(`${a.rels.length === 1 ? 'A cultura foi citada em uma viagem a campo' : `A cultura foi citada em ${a.rels.length} viagens a campo`} no período, sem informações quantitativas.`); }
  }
  if (outras.length) { novaPag(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...VERDE); doc.text('RELATÓRIOS DE VIAGEM', M, y); y += 8; h1('Outras culturas no campo');
    linhaSub('O que as viagens a campo do período mostraram sobre outras culturas.');
    for (const cid of outras) { const ps = prosaRelatos(cid, noP); if (!ps.length) continue; h2(CULT[cid].nome); ps.forEach(p => txt(p)); } }
  // ---------- anexo: tabelas de apoio (nenhum dado omitido) ----------
  novaPag(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...VERDE); doc.text('ANEXO', M, y); y += 8; h1('Tabelas de apoio'); y += 2;
  tabela(['Cultura', 'Área (ha)', 'Municípios', 'Semeado no início do período', 'Semeado no fim do período', 'Em fase crítica no fim do período'], A.map(a => a.cana ? [a.n + ' (mapeada)', n0(a.area), a.nMun, '—', '—', '—'] : [`${a.n} (${a.s})`, a.area ? n0(a.area) : '—', a.nMun, a.pa ? n0(a.pa.v) + '%' : '—', a.pb ? n0(a.pb.v) + '%' : '—', a.crb ? n0(a.crb.v) + '%' : '—']));
  for (const a of A) { h2(a.n);
    if (a.cana) { tabela(['Região imediata', 'Área mapeada (ha)', '% da cana'], a.regs.map(([r, v]) => [r, n0(v), n1(100 * v / a.area) + '%']));
      const U = a.U; if (U) { sub2(`Planilhas das usinas, safra ${U.safra}`);
        tabela(['Polo', 'Usinas', 'Moagem (mil t)', 'Var. mesmas usinas', 'TCH (t/ha)', 'ATR (kg/t)', 'Açúcar no mix (ATR)', 'Chuva jan-jul x média', 'Área informada (ha)', 'Área mapeada (ha)'],
          U.polos.map(p => [p.polo, p.atual.n, n0(p.atual.moida), p.comp.n ? sinal(varPct(p.comp.ant.moida, p.comp.atu.moida)) : '—', p.area.tch ? n1(p.area.tch) : '—', p.atual.atr ? n1(p.atual.atr) : '—', p.prod.mix != null ? n0(100 * p.prod.mix) + '%' : '—', p.chuva?.desvio != null ? sinal(100 * p.chuva.desvio) : '—', n0(p.area.areaT), U.mapa ? n0(U.mapa[p.polo] || 0) : '—']), {styles: {font: 'helvetica', fontSize: 7, cellPadding: 1, textColor: TINTA, lineColor: [228, 228, 222], lineWidth: {bottom: .1}}});
        const rv = a.UT?.rev; if (rv) tabela(['Etapa (mesmas ' + rv.n + ' usinas)', 'Moagem (mil t)', 'Produtividade (t/ha)', 'ATR (kg/t)'], ['ant', 'a1', 'a2', 'a3'].map(k => [nomePer[k], n0(rv[k].moida), rv[k].tch ? n1(rv[k].tch) : '—', rv[k].atr ? n1(rv[k].atr) : '—']), {tableWidth: 140});
        const cP = U.compProd, cM = U.compMilho, cE = U.compEnergia, lin = (nome, x, y, f = v => n0(v)) => [nome, x ? f(x) : '—', y ? f(y) : '—', x && y ? sinal(varPct(x, y)) : '—'];
        tabela(['Produção (mesmas usinas nos dois anos)', 'Safra anterior', 'Safra atual', 'Variação'], [lin('Cana moída (mil t)', U.compCana.ant.moida, U.compCana.atu.moida), lin('Açúcar (mil t)', cP.ant.acucar / 1e3, cP.atu.acucar / 1e3), lin('Etanol anidro de cana (milhões de litros)', cP.ant.anidro / 1e3, cP.atu.anidro / 1e3), lin('Etanol hidratado de cana (milhões de litros)', cP.ant.hidratado / 1e3, cP.atu.hidratado / 1e3),
          lin('Milho moído (mil t)', cM.ant.milho, cM.atu.milho), lin('Etanol de milho (milhões de litros)', cM.ant.etanolMilho / 1e3, cM.atu.etanolMilho / 1e3), lin('DDG (mil t)', cM.ant.ddg, cM.atu.ddg), lin('Energia vendida (mil MWh)', cE.ant.venda / 1e3, cE.atu.venda / 1e3)], {tableWidth: 150});
        nota(`Estimativa atual = avaliação mais recente preenchida por cada usina. Comparações com a safra anterior usam só as usinas que informaram os dois anos (${U.compCana.n} de cana; ${U.compMilho.n} de milho). Mix em ATR com fatores Consecana (1,0495 kg de ATR por kg de açúcar; 1,7651 e 1,6913 kg por litro de etanol anidro e hidratado). Polos: Centro-Sul (regiões de Dourados, Ponta Porã e Campo Grande), Vale do Ivinhema (Nova Andradina e Naviraí-Mundo Novo) e Norte e Bolsão (Coxim, Paranaíba-Chapadão do Sul-Cassilândia e Três Lagoas). Dados de cada usina não são divulgados.`);
        if (a.Uav.length) { sub2('Checagem das planilhas'); const gr = {}; a.Uav.forEach(t => { const m = t.match(/^([A-Z]{2}-\d+): (.*)$/); if (m) (gr[m[1]] ??= []).push(m[2].replace(/\.$/, '')); }); nota('Ajustes feitos automaticamente na leitura, por código de questionário (dados de cada usina não são divulgados). ' + Object.entries(gr).map(([c, l]) => `${c}: ${l.join('; ')}.`).join(' ')); } } }
    else tabela(['Região imediata', 'Municípios', 'Área (ha)', 'Semeado no início do período', 'Semeado no fim do período', 'Em fase crítica no fim do período'], a.regs.map(r => [r.r, r.n, n0(r.area), n0(r.a) + '%', n0(r.b) + '%', n0(r.k) + '%']));
    if (a.sc) tabela(['Textura do solo nas áreas da cultura', '% da área', 'Classe de solo', '% da área'], (() => { const t = Object.entries(a.sc.textura).sort((x, y) => y[1] - x[1]), o = Object.entries(a.sc.ordem).sort((x, y) => y[1] - x[1]).filter(([, v]) => v >= .1);
      return Array.from({length: Math.max(t.length, o.length)}, (_, i) => [t[i]?.[0] || '', t[i] ? n1(t[i][1]) + '%' : '', o[i]?.[0] || '', o[i] ? n1(o[i][1]) + '%' : '']); })());
    if (a.rc) tabela(['Clima do período (média ponderada pela área)', 'Valor'], [['Chuva', n0(a.rc.p) + ' mm'], ['Evapotranspiração de referência', n0(a.rc.et0) + ' mm'], ['Dias com chuva', String(a.rc.chuvosos)], ['Maior sequência sem chuva', a.rc.seco + ' dias'], ['Temperatura máxima / mínima', `${n1(a.rc.txMax)} / ${n1(a.rc.tnMin)} °C`], ['Dias com máxima de 35 °C ou mais / mínima de 3 °C ou menos (em algum município)', `${a.rc.quente} / ${a.rc.geada}`]], {tableWidth: 125});
    if (opts.clima) { const ag = aguaPDF(a.c, a.cid); if (ag?.pior.length) { tabela(['Municípios com mais falta de água', 'Água disponível no solo hoje', 'Índice de estresse hoje', 'Pior índice nos próximos 15 dias'], ag.pior.map(([nm, b]) => [nm, n0(b.atual) + '%', n2(b.ksAtual), n2(b.ksMinFutCampo)]), {tableWidth: 140}); nota('Água disponível: percentual da reserva de água do solo ainda disponível para as plantas. Índice de estresse: 1 significa que a lavoura recebe toda a água de que precisa; quanto menor o valor, maior a falta de água (abaixo de 0,7, falta moderada; abaixo de 0,4, severa).'); } }
    if (opts.campo && a.rels.length) tabela(['Data', 'Relatório de viagem', 'Municípios citados'], a.rels.map(r => [fmtD(r.data), r.nome.replace(/\.(docx?|pdf|txt|md)$/i, ''), [...r.muns].map(nmMun).filter(Boolean).join(', ') || '—']), {columnStyles: {0: {cellWidth: 16}, 1: {cellWidth: 55}}});
    if (opts.mun && !a.cana) { const js = Array.from({length: Math.min(22, Math.max(1, a.jb))}, (_, k) => k + 1).filter(k => k >= Math.max(1, a.ja - 1));
      sub2('Evolução da semeadura por município');
      nota(`Cada coluna de data mostra o percentual da área do município já semeado até aquela semana (valor acumulado). Uma célula vazia indica que não houve informação naquela semana. A última coluna traz a parcela da área que estava em fase crítica em ${fmtD(fim)}, segundo o calendário médio da cultura.`);
      tabela(['Município', 'Área (ha)', ...js.map(k => fmtD(dataSem(a.c, k)).slice(0, 5)), 'Em fase crítica'], Object.entries(a.c.mun).sort((x, y) => (nmMun(x[0]) || '').localeCompare(nmMun(y[0]) || '', 'pt')).map(([cd, m]) => [nmMun(cd) || cd, m.area ? n0(m.area) : '—', ...js.map(k => m.serie[k - 1] == null ? '' : String(Math.round(m.serie[k - 1]))), pctCritico(a.c, m, a.jb).toFixed(0) + '%']), {styles: {font: 'helvetica', fontSize: 6.3, cellPadding: .7, textColor: TINTA, lineColor: [235, 235, 230], lineWidth: {bottom: .1}}});
    }
    if (opts.mun && a.cana) { sub2('Área de cana por município'); } tabela(['Município', 'Região imediata', 'Área de cana (ha)', '% da cana do MS'], Object.entries(a.c.mun).filter(([cd]) => MUN_IDX[cd]).sort((x, y) => nmMun(x[0]).localeCompare(nmMun(y[0]), 'pt')).map(([cd, m]) => [nmMun(cd), MUN_IDX[cd].properties.NM_RGI || '—', n0(m.area), n1(100 * m.area / a.area) + '%']), {styles: {font: 'helvetica', fontSize: 6.5, cellPadding: .8, textColor: TINTA, lineColor: [235, 235, 230], lineWidth: {bottom: .1}}});
  }
  h2('Como os números foram obtidos');
  nota('Semeadura: planilha semanal da SEGEO-MS; percentuais do estado e das regiões ponderados pela área informada. Estádios e fases críticas: projeção pelo calendário médio da aba Parâmetros (dias após a semeadura), sem graus-dia. Clima por município no ponto central: histórico com reanálise ERA5 e, nos dias recentes e na previsão, modelos numéricos (Open-Meteo, média de até seis modelos), com evapotranspiração ajustada pelas estações do INMET. Falta de água: balanço hídrico diário do solo (FAO-56), com reserva de água estimada pela textura do solo nas áreas da cultura e demanda pela fase da lavoura; "falta de água" = coeficiente de estresse Ks abaixo de 1 (leve 0,7-0,99; moderada 0,4-0,7; severa abaixo de 0,4), em % da área com lavoura em campo. Relatórios de viagem lidos por regras automáticas e cruzados com a planilha, o clima e os mapas de uso; confira o texto original. ' + (A.some(a => a.cana) ? `Cana: área do mapeamento de uso e cobertura da Aprosoja-MS 2025/26, Kc médio anual de ${n2(KC_CANA)}, raízes até ${PROF_CANA} cm. ` : '') + 'Os indicadores apontam situações a verificar e não representam estimativa oficial de área, produtividade ou produção.');
  const tot = doc.getNumberOfPages();
  for (let i = 1; i <= tot; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...CINZA);
    doc.text('Painel de Levantamento de Safras MS · dados preliminares', M, 288); doc.text(`${i} / ${tot}`, W - M, 288, {align: 'right'}); }
  doc.save(`Resumo_Safra_MS_${dISO(ini)}_a_${dISO(fim)}.pdf`);
}

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================
document.querySelectorAll('#fundo button').forEach(b => b.onclick = () => { document.querySelectorAll('#fundo button').forEach(x => x.classList.toggle('on', x === b)); [fundos.claro, fundos.sat, fundos.osm].forEach(l => { if (mapa.hasLayer(l)) mapa.removeLayer(l); }); errosFundo = 0; fundoAtual = fundos[b.dataset.f] || null; if (fundoAtual) fundoAtual.addTo(mapa).bringToBack(); });
$('menu').onclick = () => $('lado').classList.toggle('fechado');
$('bt-estado').onclick = () => { $('busca').value = ''; mapa.fitBounds(L.geoJSON(dadosMun).getBounds(), {paddingBottomRight: [400, 0]}); selecionar(ESTADO); };
$('busca').onchange = e => { const f = dadosMun?.features.find(x => norm(x.properties.NM_MUN) === norm(e.target.value)); if (f) { mapa.fitBounds(L.geoJSON(f).getBounds(), {paddingBottomRight: [400, 0]}); selecionar(f); } };
(async () => {
  const [man, mun, solo] = await Promise.all([pegar('dados/manifesto.json'), pegar('dados/municipios.geojson'), pegar('dados/solos.geojson')]);
  MAN = man; dadosMun = mun; dadosSolo = solo;
  if (man) $('atualizado').textContent = 'atualizado ' + new Date(man.atualizado_em).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'});
  if (!mun) { $('atualizado').textContent = 'erro ao carregar os dados'; return; }
  mun.features.forEach(f => MUN_IDX[String(+f.properties.CD_MUN)] = f);
  $('lista-mun').innerHTML = mun.features.map(f => f.properties.NM_MUN).sort((a, b) => a.localeCompare(b, 'pt')).map(n => `<option value="${esc(n)}">`).join('');
  // camadas publicadas pela rotina
  const lista = man?.camadas || [];
  if (lista.includes('infra_rodovias_federais')) camRodovia('rodfed', 'infra_rodovias_federais', 'Rodovias federais');
  if (lista.includes('infra_rodovias_estaduais')) camRodovia('rodest', 'infra_rodovias_estaduais', 'Rodovias estaduais');
  // culturas anuais primeiro (1ª safra antes da 2ª), depois as demais ocupações (pastagem, vegetação, florestas plantadas, outros)
  const ehCultura = n => (man?.classes?.[n] || [n.replace(/^uso_/, '')]).some(cl => { const c = culturaDe(cl); return c && c.id !== 'outra'; });
  lista.filter(c => c.startsWith('uso_')).sort((a, b) => (ehCultura(b) - ehCultura(a)) || (/2a_safra/.test(a) - /2a_safra/.test(b)) || rotuloUso(a).localeCompare(rotuloUso(b), 'pt')).forEach(n => camUso(n, ehCultura(n) ? 'uso' : 'uso2'));
  lista.filter(c => c.startsWith('infra_') && !/rodovias_(federais|estaduais)/.test(c)).forEach(c => camRodovia('i_' + c, c, c.slice(6).replace(/_/g, ' ')));
  if (!solo) delete CAM.solo;
  renderCamadas();
  for (const c of Object.values(CAM)) if (c.on) { c.on = false; await ligar(c.id, true); }
  // camada invisível para cliques e dicas
  L.geoJSON(mun, {pane: 'clique', style: {stroke: false, fill: true, fillOpacity: 0}, onEachFeature: (f, l) => {
    l.on('click', e => selecionar(f, e.originalEvent && (e.originalEvent.ctrlKey || e.originalEvent.metaKey))); l.bindTooltip(() => dicaMun(f), {sticky: true, direction: 'top', opacity: .9}); }}).addTo(mapa);
  mapa.fitBounds(L.geoJSON(mun).getBounds(), {padding: [10, 10]});
  garantirClima(); pegar('dados/clima/estacoes_inmet.json').then(e => { EST = e; }); pegar('dados/clima/validacao_et0.json').then(v => { VAL = v; for (const k in _fat) delete _fat[k]; atualizarAgua(); }); pegar('dados/solo_cultura.json').then(v => { SOLO_CULT = v; Object.keys(CAM).filter(k => k.startsWith('u_')).forEach(atualizarSub); montarCana(); montarControlesCult(); });
})();
