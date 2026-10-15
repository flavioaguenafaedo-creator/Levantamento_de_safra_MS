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
const GRUPOS = [['lav', 'Lavouras'], ['clima', 'Clima'], ['campo', 'Campo'], ['uso', 'Uso e cobertura do solo'], ['solo', 'Solos'], ['ref', 'Referência']];
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
  const base = cid.replace(/\d$/, ''), nome = Object.keys(SOLO_CULT.culturas).find(n => { const c = culturaDe(n); return c && c.id.replace(/\d$/, '') === base; });
  if (!nome) return null;
  const r = cd ? SOLO_CULT.culturas[nome].mun[cd] : SOLO_CULT.culturas[nome].estado; if (!r || !r.area) return null;
  const pct = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, 100 * v / r.area]));
  const textura = pct(r.textura);
  return {nome, area: r.area, ordem: pct(r.ordem), textura, cad: cadDe(textura)};
}
function htmlSoloCultura(cd) {
  if (!SOLO_CULT) return '';
  const tb = (o, cores) => Object.entries(o).filter(([, v]) => v >= .5).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td><i style="background:${cores[k] || '#bdbdbd'}"></i>${esc(k)}</td><td>${v.toFixed(0)}%</td></tr>`).join('');
  const blocos = Object.keys(SOLO_CULT.culturas).map(n => { const c = culturaDe(n); const r = soloCultura(c?.id, cd); if (!r) return '';
    return `<div class="nota" style="margin-top:8px;color:var(--tinta)"><b>${esc(n)}</b> · ${n0(r.area)} ha mapeados</div><table>${tb(r.textura, CORES_TEX)}</table><table style="margin-top:4px">${tb(r.ordem, CORES_ORDEM)}</table>`; }).join('');
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
const CORES_USO = {"Soja": "#e0a526", "Cana-de-açúcar": "#3f9a5a", "Milho": "#d4694a", "Pastagem": "#c9d99a", "Remanescente/vegetação": "#2f5d3a", "Eucalipto": "#6d8fbf", "Pinus": "#a37fbf", "Seringueira": "#8a6f4e", "Outros usos": "#bdbdbd"};
const PALETA = ["#e3b23c", "#4f8a3c", "#9ccf7f", "#d4694a", "#6d8fbf", "#a37fbf", "#c4c4a0", "#3f6f6a"];
function camUso(nome) {
  const id = 'u_' + nome, rot = nome.slice(4).replace(/_/g, ' ');
  let classes = null;
  const cor = c => CORES_USO[c] || PALETA[(classes || []).indexOf(c) % PALETA.length];
  defCam(id, {grupo: 'uso', nome: rot.charAt(0).toUpperCase() + rot.slice(1), op: .85,
    estilo: f => ({pane: 'uso', fillColor: cor(f.properties.classe || ''), fillOpacity: OPC(id), weight: 0}),
    montar: async () => { const d = await pegar(`dados/${nome}.geojson`); if (!d) return null;
      classes = [...new Set(d.features.map(f => f.properties.classe))];
      CAM[id].legenda = d.features.map(f => `<div><i style="background:${cor(f.properties.classe)}"></i>${esc(f.properties.classe)}${f.properties.area_ha ? ' · ' + (f.properties.area_ha / 1e6).toLocaleString('pt-BR', {maximumFractionDigits: 2}) + ' mi ha' : ''}</div>`).join('');
      atualizarSub(id);
      return L.geoJSON(d, {style: CAM[id].estilo, interactive: false}); },
    sub: () => `<div class="leg">${CAM[id].legenda || ''}</div>${solosNaCamada(classes)}<div class="nota">Fonte: ${esc(fonteUso(nome))}.</div>`});
}
function fonteUso(nome) { return /soja|cana|ms26/i.test(nome) ? 'mapeamento de uso e cobertura da Aprosoja-MS' : 'mapeamento de uso e cobertura enviado à SEGEO-MS'; }
function barraSolo(o, cores) {
  const it = Object.entries(o).filter(([, v]) => v >= .5).sort((a, b) => b[1] - a[1]);
  return `<div class="barra" style="height:12px">${it.map(([k, v]) => `<i title="${esc(k)}: ${v.toFixed(0)}%" style="width:${v}%;background:${cores[k] || '#bdbdbd'}"></i>`).join('')}</div>
    <div class="leg" style="display:flex;flex-wrap:wrap;gap:0 10px">${it.slice(0, 4).map(([k, v]) => `<div><i style="background:${cores[k] || '#bdbdbd'}"></i>${esc(k)} ${v.toFixed(0)}%</div>`).join('')}</div>`;
}
function solosNaCamada(classes) {
  if (!SOLO_CULT || !classes) return '';
  return classes.map(cl => { const c = culturaDe(cl), r = c && soloCultura(c.id, null); if (!r) return '';
    const cd = selecionado && selecionado !== ESTADO ? String(+selecionado.properties.CD_MUN) : null, rm = cd ? soloCultura(c.id, cd) : null;
    return `<div style="margin-top:8px;font-size:12px"><b>Solos sob ${esc(cl.toLowerCase())}</b> · MS, ${n0(r.area)} ha</div>
      <div class="nota" style="margin:2px 0 0">Textura</div>${barraSolo(r.textura, CORES_TEX)}<div class="nota" style="margin:2px 0 0">Classe</div>${barraSolo(r.ordem, CORES_ORDEM)}
      ${rm ? `<div style="margin-top:6px;font-size:12px"><b>${esc(selecionado.properties.NM_MUN)}</b> · ${n0(rm.area)} ha</div>${barraSolo(rm.textura, CORES_TEX)}${barraSolo(rm.ordem, CORES_ORDEM)}` : '<div class="nota">Selecione um município para ver os solos sob a cultura nele.</div>'}`; }).join('');
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
  const mun = {};
  for (const [cd, m] of Object.entries(c.mun)) { const mc = CL.mun[cd]; if (mc) mun[cd] = balancoHidrico(mc, cadMun(c.cid, cd), c, m, cd); }
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
    if (!c || !B || !c.mun[cd]) return {pane: 'clima', fill: false, stroke: false};
    const k = classeAgua(B[cd]); if (k == null) return {pane: 'clima', fill: false, stroke: false};
    return {pane: 'clima', fill: true, fillColor: k < 0 ? COR_SEMCAMPO : CLS_AG[k].cor, fillOpacity: OPC('agua') * (k < 0 ? .6 : 1), weight: 0, stroke: false}; },
  montar: async () => { await garantirClima(); const c = cultAtual(); if (!c || !CL) { setSt('agua', !CL ? 'sem clima ainda' : 'escolha a cultura'); return null; }
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
  if (CAM.agua.layer) CAM.agua.layer.setStyle(CAM.agua.estilo); else if (CAM.agua.on) redesenhar('agua');
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
const CACHE_FOTOS = 'painel-safra.fotos.v3';
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
  const t = String(txt || '').replace(/[Oo](?=\d)/g, '0').replace(/[‐‑–—~]/g, '-'), out = {};
  // 1) formato normal: lat [S] [,;] lon [W]
  const m = t.match(/(-?\d{1,2}[.,]\d{2,7})\s*°?\s*([NS])?\s*[,;]?\s+(-?\d{1,3}[.,]\d{2,7})\s*°?\s*([EWLO])?/i)
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
defCam('fotos', {grupo: 'campo', nome: 'Fotos de campo', desab: true, st: 'conecte a pasta', seguir: true,
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
const PALAVRAS_CULT = {soja: ['soja'], milho1: ['milho'], milho2: ['milho', 'safrinha'], sorgo: ['sorgo'], amendoim: ['amendoim'], arroz: ['arroz'],
  feijao1: ['feijao'], feijao2: ['feijao'], algodao: ['algodao'], trigo: ['trigo'], aveia: ['aveia'], cana: ['cana-de-acucar', 'cana de acucar', 'canavial', 'cana ']};
async function extrairTexto(a) {
  const f = await a.obter(), ext = f.name.toLowerCase().split('.').pop();
  if (ext === 'txt' || ext === 'md') return await f.text();
  if (ext === 'docx') { await carregarScript(LIBS.mammoth); return (await mammoth.extractRawText({arrayBuffer: await f.arrayBuffer()})).value; }
  if (ext === 'pdf') {
    await carregarScript(LIBS.pdfjs); pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfjsWorker;
    const pdf = await pdfjsLib.getDocument({data: await f.arrayBuffer()}).promise; let t = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) { const pg = await pdf.getPage(i); t += (await pg.getTextContent()).items.map(x => x.str).join(' ') + '\n'; }
    return t;
  }
  return '';
}
function dataDoRelato(nome, texto, f) {
  let m = nome.match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})/); if (m) return new Date(+m[1], m[2] - 1, +m[3], 12);
  m = nome.match(/(\d{2})[-_.](\d{2})[-_.](20\d{2})/); if (m) return new Date(+m[3], m[2] - 1, +m[1], 12);
  m = texto.slice(0, 600).match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/); if (m) return new Date(+m[3], m[2] - 1, +m[1], 12);
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
      const cults = Object.entries(PALAVRAS_CULT).filter(([, ps]) => ps.some(p => tn.includes(p))).map(([k]) => k);
      RELATOS.push({caminho: a.caminho, nome: a.caminho.split('/').pop(), data: dataDoRelato(a.caminho.split('/').pop(), texto, f), texto, muns: new Set(muns), cults: new Set(cults)});
    } catch (e) { console.warn('relato não lido', a.caminho, e); }
  }
  RELATOS.sort((p, q) => q.data - p.data);
  if (selecionado) abrirFicha(selecionado, true);
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
  const relatos = lista.filter(a => ['docx', 'txt', 'md', 'pdf'].includes(ext(a)) && !tmp(a));
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
function selecionar(f) {
  selecionado = f;
  if (camDestaque) mapa.removeLayer(camDestaque);
  if (f === ESTADO) { camDestaque = null; abrirFicha(f); return; }
  camDestaque = L.geoJSON(f, {pane: 'destaque', interactive: false, style: {fill: false, color: getComputedStyle(document.documentElement).getPropertyValue('--acento2').trim() || '#b5882c', weight: 3}}).addTo(mapa);
  abrirFicha(f);
  Object.keys(CAM).filter(k => k.startsWith('u_') && CAM[k].on).forEach(atualizarSub);
}
$('f-fechar').onclick = () => { $('ficha').hidden = true; selecionado = null; if (camDestaque) mapa.removeLayer(camDestaque); };
document.querySelectorAll('.abas button').forEach(b => b.onclick = () => { abaFicha = b.dataset.a; document.querySelectorAll('.abas button').forEach(x => x.classList.toggle('on', x === b)); $('f-geral').hidden = abaFicha !== 'geral'; $('f-analise').hidden = abaFicha !== 'analise'; abrirFicha(selecionado, true); });
async function abrirFicha(f, manter) {
  if (!f) return;
  $('ficha').hidden = false;
  if (f === ESTADO) {
    $('f-nome').textContent = 'Mato Grosso do Sul'; $('f-sub').textContent = `Visão estadual · ${dadosMun.features.length} municípios`;
    await garantirClima();
    if (abaFicha === 'geral') { $('f-geral').innerHTML = htmlGeralEstado(); const b = $('bt-clima'); if (b) b.onclick = () => abrirClima(ESTADO); }
    else { $('f-analise').innerHTML = '<div class="nota">Calculando a análise de todos os municípios…</div>'; setTimeout(() => { $('f-analise').innerHTML = `<div class="analise">${gerarAnaliseEstado()}</div>`; ligarCopiar(); }, 30); }
    return;
  }
  const p = f.properties;
  $('f-nome').textContent = p.NM_MUN; $('f-sub').textContent = `IBGE ${p.CD_MUN} · ${p.NM_RGI || ''}${p.AREA_KM2 ? ' · ' + Number(p.AREA_KM2).toLocaleString('pt-BR') + ' km²' : ''}`;
  await garantirClima();
  if (abaFicha === 'geral') { $('f-geral').innerHTML = htmlGeral(f); const b = $('bt-clima'); if (b) b.onclick = () => abrirClima(f); }
  else $('f-analise').innerHTML = `<div class="analise">${gerarAnalise(f)}</div>`;
}
// gráfico de chuva (barras) e temperaturas máxima/mínima (linhas) num intervalo de dias [a, b)
function graficoClima(m, a, b, W = 300, H = 90) {
  const h = iHoje(); a = Math.max(0, a ?? h - 30); b = Math.min(CL.datas.length, b ?? h);
  const idx = [...Array(b - a).keys()].map(i => i + a);
  const bw = W / idx.length, pm = Math.max(20, ...idx.map(i => m.p[i] || 0));
  const tmin = Math.min(...idx.map(i => m.tn[i] ?? 99)) - 2, tmax = Math.max(...idx.map(i => m.tx[i] ?? 0)) + 2;
  const y = t => H - (t - tmin) / (tmax - tmin) * H, lin = k => idx.map((i, j) => m[k][i] == null ? '' : `${j ? 'L' : 'M'}${((j + .5) * bw).toFixed(1)},${y(m[k][i]).toFixed(1)}`).join('');
  return `<svg class="graf" viewBox="0 0 ${W} ${H + 28}" width="100%" font-size="10" style="overflow:visible">
    ${idx.map((i, j) => { const p = m.p[i] || 0, hh = H * .6 * p / pm; return `<rect x="${(j * bw + .5).toFixed(1)}" y="${(H - hh).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${hh.toFixed(1)}" fill="#2171b5"><title>${fmtD(deISO(CL.datas[i]))}: ${n1(p)} mm · ${n1(m.tn[i])} a ${n1(m.tx[i])} °C</title></rect>`; }).join('')}
    <path d="${lin('tx')}" fill="none" stroke="#d9472b" stroke-width="1.5"/><path d="${lin('tn')}" fill="none" stroke="#3b6fb6" stroke-width="1.5"/>
    <line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="#bbb"/>
    <text x="0" y="${H + 12}">${fmtD(deISO(CL.datas[a]))}</text><text x="${W}" y="${H + 12}" text-anchor="end">${fmtD(deISO(CL.datas[b - 1]))}</text>
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
function htmlJanelaClima(alvo) {
  const c = cultAtual(), h0 = iHoje(), est = alvo === ESTADO;
  let mc, cd = null, f = null;
  if (est) { const pesos = {}; if (c) for (const [k, m] of Object.entries(c.mun)) pesos[k] = m.area || 1; else for (const k in CL.mun) pesos[k] = 1; mc = climaPonderado(pesos)?.mc; }
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
  // 2. últimos 30 dias
  let tr = `<p>Chuva: <b>${soma('p', h0 - 30, h0).toFixed(0)} mm</b> · ET0: ${soma('et0', h0 - 30, h0).toFixed(0)} mm${est ? '' : ` · ${diasSecos(mc)} dia${diasSecos(mc) === 1 ? '' : 's'} seguidos sem chuva até hoje`}.</p><div class="nota">Dias passados: estimativa do modelo de maior resolução para o local (não é medição nem média de modelos). Após ~5 dias, o histórico permanente passa a usar a reanálise ERA5.</div>`;
  if (!est) {
    const ct = centroMun(cd), ep = estacaoProxima(ct[1], ct[0]);
    if (ep) { const ds = Object.keys(ep.e.serie).slice(-30), pe = ds.reduce((t, d) => t + (ep.e.serie[d].p || 0), 0), v = VAL?.estacoes.find(x => x.codigo === ep.e.codigo);
      tr += `<h4>Estação INMET mais próxima: ${esc(ep.e.nome)} (${ep.d.toFixed(0)} km)</h4><p>Registrou ${pe.toFixed(0)} mm nos últimos 30 dias com dados (até ${fmtD(deISO(ds.at(-1)))}).</p>${htmlValChuva(v)}${valEst(ep.e.codigo)}`; }
    else tr += `<div class="nota">Nenhuma estação INMET a menos de 70 km.</div>`;
  } else tr += htmlValChuvaEstado();
  out.push(`<section class="jc"><h3>Últimos 30 dias</h3>${graficoClima(mc, h0 - 30, h0, 470, 110)}${tr}</section>`);
  // 3. água no solo
  if (!c) out.push(`<section class="jc larga"><h3>Água no solo</h3><p>Escolha uma cultura em “Safra e cultura” para ver o balanço hídrico.</p></section>`);
  else if (est) out.push(`<section class="jc larga">${htmlAguaEstado(c)}</section>`);
  else { const m = c.mun[cd]; out.push(`<section class="jc larga">${m ? htmlAgua(f, c, m, mc, 900) : `<h3>Água no solo · ${esc(c.nome)}</h3><p>Sem ${esc(c.nome.toLowerCase())} ${c.semFenologia ? 'mapeada' : 'na planilha'} para este município.</p>`}</section>`); }
  return `<div class="janela-clima">${out.join('')}</div><div class="nota" style="margin-top:10px">${esc(CL.fonte || 'Open-Meteo')} Atualizado em ${new Date(CL.gerado).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}.</div>`;
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
  const l = Object.entries(B).map(([cd, bh]) => ({cd, nome: MUN_IDX[cd]?.properties.NM_MUN, bh, w: c.mun[cd]?.area || 1, k: bh.campoAtual > 0 ? classeKs(bh.ksAtual) : -1, kf: bh.ksMinFutCampo == null ? -1 : classeKs(bh.ksMinFutCampo)})).filter(x => x.nome);
  const tot = l.filter(x => x.k >= 0).reduce((t, x) => t + x.w, 0), totF = l.filter(x => x.kf >= 0).reduce((t, x) => t + x.w, 0);
  const pct = (arr, key, T) => CLS_AG.map((_, k) => T ? 100 * arr.filter(x => x[key] === k).reduce((t, x) => t + x.w, 0) / T : 0);
  const barra = v => `<div class="barra">${v.map((p, k) => `<i title="${CLS_AG[k].nome}: ${p.toFixed(0)}%" style="width:${p}%;background:${CLS_AG[k].cor}"></i>`).join('')}</div>`;
  const ph = pct(l, 'k', tot), pf = pct(l, 'kf', totF);
  const piores = l.filter(x => x.k >= 0 || x.kf >= 0).sort((a, b) => (a.bh.ksMinFutCampo ?? 1) - (b.bh.ksMinFutCampo ?? 1) || a.bh.atual - b.bh.atual).slice(0, 12);
  return `<h3>Água no solo · ${esc(c.nome)} (estado)</h3><p>Hoje: ${ph.map((p, k) => `${CLS_AG[k].nome.toLowerCase()} <b>${p.toFixed(0)}%</b>`).join(' · ')} da área com lavoura em campo.</p>${barra(ph)}
    <p style="margin-top:8px">Pior dia nos próximos 15 dias: ${pf.map((p, k) => `${CLS_AG[k].nome.toLowerCase()} <b>${p.toFixed(0)}%</b>`).join(' · ')}.</p>${barra(pf)}
    <h4>Municípios com a situação mais restrita</h4><table class="tab-ag"><tr><th>Município</th><th>Água hoje</th><th>Ks hoje</th><th>Pior Ks 15 dias</th><th>Demanda atendida 30 d</th></tr>${piores.map(x => `<tr><td><a href="#" data-cd="${x.cd}" class="lk-mun">${esc(x.nome)}</a></td><td>${n0(x.bh.atual)}%</td><td>${x.k >= 0 ? `<span style="color:${CLS_AG[x.k].cor};font-weight:600">${n2(x.bh.ksAtual)}</span>` : '—'}</td><td>${x.kf >= 0 ? `<span style="color:${CLS_AG[x.kf].cor};font-weight:600">${n2(x.bh.ksMinFutCampo)}</span>` : '—'}</td><td>${x.bh.atend30 != null ? n0(x.bh.atend30) + '%' : '—'}</td></tr>`).join('')}</table>
    <div class="nota">Porcentagens ponderadas pela área ${c.semFenologia ? 'mapeada' : 'informada na planilha'}. Clique no município para abrir a ficha dele.</div>`;
}
function abrirClima(alvo) {
  const nome = alvo === ESTADO ? 'Mato Grosso do Sul' : alvo.properties.NM_MUN, c = cultAtual();
  abrirModal(`Clima e água no solo · ${nome}${c ? ' · ' + c.nome : ''}`, htmlJanelaClima(alvo), 'larga');
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
  if (sc) h += `<h3>Solos sob ${esc(c.nome.toLowerCase())} (${n0(sc.area)} ha mapeados)</h3><table>${tb(sc.textura, CORES_TEX)}</table><table style="margin-top:6px">${tb(sc.ordem, CORES_ORDEM)}</table><div class="nota">Mapa de uso da Aprosoja-MS × solos 1:5.000.000. Água disponível ~${(sc.cad * profRaiz(c) / 60).toFixed(0)} mm em ${profRaiz(c)} cm.</div>`;
  else if (so) h += `<h3>Solos do município (1:5.000.000)</h3><table>${tb(so.ordem, CORES_ORDEM)}</table><table style="margin-top:6px">${tb(so.textura, CORES_TEX)}</table><div class="nota">${c ? `${esc(c.nome)} não tem mapa de uso: valores do município inteiro. ` : ''}Água disponível estimada: ~${so.cad.toFixed(0)} mm em 60 cm (pela textura).</div>`;
  const fts = FOTOS.filter(p => p.mun && String(+p.mun.properties.CD_MUN) === cd && (!cid || p.cult === cid)), rel = RELATOS.filter(r => r.muns.has(cd) && (!cid || r.cults.has(cid)));
  const outros = cid ? RELATOS.filter(r => r.muns.has(cd) && !r.cults.has(cid)).length : 0;
  if (fts.length || rel.length || outros) h += `<h3>Campo${c ? ' · ' + esc(c.nome.toLowerCase()) : ''}</h3><div class="nota">${fts.length} foto${fts.length === 1 ? '' : 's'}${fts.length ? ' (última em ' + fmtD(new Date(Math.max(...fts.map(p => p.data)))) + ')' : ''} · ${rel.length} relato${rel.length === 1 ? '' : 's'}${rel.length ? ' (último: ' + esc(rel[0].nome) + ', ' + fmtD(rel[0].data) + ')' : ''}${outros ? ` · ${outros} outro${outros > 1 ? 's' : ''} cita${outros > 1 ? 'm' : ''} o município sem mencionar a cultura` : ''}</div>`;
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
  const pesos = {}; if (c) for (const [cd, m] of Object.entries(c.mun)) pesos[cd] = m.area || 1; else for (const cd in CL.mun) pesos[cd] = 1;
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
  const c = cultAtual(), cid = c?.cid; let h = '';
  if (c?.semFenologia) {
    const l = Object.entries(c.mun).map(([cd, m]) => ({cd, m, f: MUN_IDX[cd]})).filter(x => x.f), tot = l.reduce((t, x) => t + x.m.area, 0);
    const reg = {}; l.forEach(x => { const r = x.f.properties.NM_RGI || '—'; reg[r] = (reg[r] || 0) + x.m.area; });
    h += `<h3>${esc(c.nome)}</h3><div class="kpis"><div class="kpi"><b>${n1(tot / 1e6)} mi</b><span>ha mapeados no MS</span></div><div class="kpi"><b>${l.filter(x => x.m.area >= 100).length}</b><span>municípios com ≥ 100 ha</span></div><div class="kpi"><b>${Object.keys(reg).length}</b><span>regiões imediatas com cana</span></div></div>
      <h3>Maiores áreas</h3><table>${l.sort((a, b) => b.m.area - a.m.area).slice(0, 8).map(x => `<tr><td>${esc(x.f.properties.NM_MUN)}</td><td>${n0(x.m.area)} ha · ${n1(100 * x.m.area / tot)}%</td></tr>`).join('')}</table>
      <h3>Por região imediata</h3><table>${Object.entries(reg).sort((a, b) => b[1] - a[1]).map(([r, v]) => `<tr><td>${esc(r)}</td><td>${n0(v)} ha · ${n1(100 * v / tot)}%</td></tr>`).join('')}</table>
      <div class="nota">Mapeamento de uso e cobertura da Aprosoja-MS.</div>`;
  } else if (c) {
    const pl = mediaMS(c, m => acum(m.serie, semSel)), cr = mediaMS(c, m => pctCritico(c, m, semSel)), se = serieEstado(c), n = Object.keys(c.mun).length;
    h += `<h3>${esc(c.nome)} · semana de ${fmtD(dataSem(c, semSel))}${dataSem(c, semSel) > HOJE ? ' (projeção)' : ''}</h3>`;
    h += `<div class="kpis"><div class="kpi"><b>${pl ? pl.v.toFixed(0) : 0}%</b><span>plantado no MS${pl && !pl.pond ? ' (média simples)' : ''}</span></div><div class="kpi"><b>${cr ? cr.v.toFixed(0) : 0}%</b><span>em fase crítica</span></div><div class="kpi"><b>${se.area ? (se.area / 1e6).toLocaleString('pt-BR', {maximumFractionDigits: 1}) + ' mi' : '—'}</b><span>ha informados · ${n} munic.</span></div></div>`;
    const dist = new Array(c.estadios.length).fill(0); let sw = 0;
    for (const m of Object.values(c.mun)) { const w = m.area || 1; sw += w; distrib(c, m, semSel).forEach((v, i) => dist[i] += v * w); }
    h += `<table>${c.estadios.map((e, i) => dist[i] / sw >= .5 ? `<tr><td><i style="background:${corEstadio(c, i)}"></i>${esc(e.nome)}${e.critico ? ' ⚠' : ''}</td><td>${(dist[i] / sw).toFixed(0)}%</td></tr>` : '').join('')}</table>`;
    const cal = calendarioCritico(c, se);
    if (cal.length) h += `<div class="nota" style="margin-top:8px">Metade da área semeada no estado atinge (projeção):</div><table>${cal.map(([e, dt]) => `<tr><td>${esc(e)}</td><td>${dt ? fmtD(dt) : '—'}</td></tr>`).join('')}</table>`;
    h += `<h3>Por região imediata</h3><table>${regioes(c, semSel).sort((a, b) => b.area - a.area || a.r.localeCompare(b.r)).map(r => `<tr><td>${esc(r.r)} <span class="nota" style="margin:0">(${r.n})</span></td><td>${r.pl.toFixed(0)}% · crít. ${r.cr.toFixed(0)}%</td></tr>`).join('')}</table>`;
  } else h += `<div class="aviso">Escolha uma cultura em “Safra e cultura” para filtrar a visão do estado${PL ? '' : ' (as culturas anuais aparecem ao conectar a pasta da equipe)'}.</div>`;
  if (CL) { const pesos = {}; if (c) for (const [k, m] of Object.entries(c.mun)) pesos[k] = m.area || 1; else for (const k in CL.mun) pesos[k] = 1;
    const ce = climaPonderado(pesos);
    if (ce) { let k3 = null; if (c) { let sw = 0, sr = 0; for (const [k, b] of Object.entries(bhCultura(c) || {})) { if (!(b.campoAtual > 0)) continue; const w = c.mun[k]?.area || 1; sw += w; if (b.ksAtual < .99) sr += w; }
        if (sw) k3 = `<div class="kpi"><b style="color:${sr / sw >= .2 ? CLS_AG[2].cor : 'var(--tinta)'}">${(100 * sr / sw).toFixed(0)}%</b><span>da área com restrição hídrica hoje</span></div>`; }
      h += htmlClimaResumo(ce.mc, null, c, k3).replace('<h3>Clima e água no solo</h3>', `<h3>Clima e água no solo${c ? ' · áreas de ' + esc(c.nome.toLowerCase()) : ''}</h3>`); } }
  const sc = c ? soloCultura(cid, null) : null;
  if (sc) { const tb = (o, cores) => Object.entries(o).filter(([, v]) => v >= .5).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td><i style="background:${cores[k] || '#bdbdbd'}"></i>${esc(k)}</td><td>${v.toFixed(0)}%</td></tr>`).join('');
    h += `<h3>Solos sob ${esc(c.nome.toLowerCase())} no MS</h3><table>${tb(sc.textura, CORES_TEX)}</table><table style="margin-top:6px">${tb(sc.ordem, CORES_ORDEM)}</table><div class="nota">${n0(sc.area)} ha mapeados (Aprosoja-MS) × solos 1:5.000.000.</div>`; }
  else if (!c) h += htmlSoloCultura(null);
  const fts = FOTOS.filter(p => !cid || p.cult === cid), rels = RELATOS.filter(r => !cid || r.cults.has(cid));
  if (fts.length || rels.length) { const pc = {}; fts.forEach(p => pc[p.cult] = (pc[p.cult] || 0) + 1);
    h += `<h3>Campo${c ? ' · ' + esc(c.nome.toLowerCase()) : ''}</h3><div class="nota">${fts.length} foto${fts.length === 1 ? '' : 's'}${c ? '' : ` (${Object.entries(pc).map(([k, v]) => `${esc((CULT[k] || OUTRA).nome)} ${v}`).join(', ')})`} · ${rels.length} relato${rels.length === 1 ? '' : 's'}${rels.length ? ' (último: ' + esc(rels[0].nome) + ', ' + fmtD(rels[0].data) + ')' : ''}</div>`; }
  return h;
}
function trechosCultura(rel, cid, max = 2) {
  const ps = PALAVRAS_CULT[cid] || []; if (!ps.length) return [];
  return rel.texto.split(/(?<=[.!?;])\s+|\n+/).map(x => x.trim()).filter(x => x.length > 25 && ps.some(p => norm(x).includes(p))).slice(0, max).map(x => x.length > 320 ? x.slice(0, 317) + '…' : x);
}
function gerarAnaliseEstado() {
  const c = cultAtual(), out = [], cid = c?.cid, cult = c ? esc(c.nome.toLowerCase()) : null;
  out.push(`<div class="aviso">Análise automática do estado gerada em ${fmtDL(HOJE)} a partir dos dados do painel. Indica situações a verificar e não substitui o levantamento de campo; associações entre indicadores não implicam causa.</div>`);
  if (!c) { out.push('<p>Conecte a pasta da equipe para gerar a análise estadual por cultura.</p>'); return out.join(''); }
  // 1. plantio (cana: área mapeada)
  if (c.semFenologia) {
    const l = Object.entries(c.mun).filter(([cd]) => MUN_IDX[cd]).sort((a, b) => b[1].area - a[1].area), tot = l.reduce((t, [, m]) => t + m.area, 0);
    out.push(`<h4>Área da cultura</h4><p>O mapeamento da Aprosoja-MS indica <b>${n1(tot / 1e6)} milhão${tot >= 2e6 ? 'ões' : ''} de ha</b> de cana-de-açúcar em Mato Grosso do Sul. Os maiores municípios são ${l.slice(0, 5).map(([cd, m]) => `${esc(MUN_IDX[cd].properties.NM_MUN)} (${n0(m.area / 1000)} mil ha)`).join(', ')}. A cana não tem acompanhamento fenológico na planilha; as demais seções usam a área mapeada como peso.</p>`);
  } else {
  const pl = mediaMS(c, m => acum(m.serie, semSel)), ant = mediaMS(c, m => acum(m.serie, semSel - 1)), se = serieEstado(c), dS = dataSem(c, semSel);
  const regs = regioes(c, semSel).filter(r => r.area || r.n).sort((a, b) => b.pl - a.pl);
  let t = `${dS > HOJE ? 'A projeção para a semana de ' + fmtD(dS) + ' indica' : 'Até a semana de ' + fmtD(dS) + ', a semeadura de ' + cult + ' em Mato Grosso do Sul atingiu'} <b>${pl ? pl.v.toFixed(0) : 0}%</b> da área${pl?.pond ? ' (média ponderada pela área informada)' : ''}, com avanço de ${pl && ant ? (pl.v - ant.v).toFixed(0) : 0} pontos percentuais na última semana.`;
  if (regs.length > 2) t += ` As regiões mais adiantadas são ${regs.slice(0, 2).map(r => `${esc(r.r)} (${r.pl.toFixed(0)}%)`).join(' e ')}; as mais atrasadas, ${regs.slice(-2).reverse().map(r => `${esc(r.r)} (${r.pl.toFixed(0)}%)`).join(' e ')}.`;
  out.push(`<h4>Situação da safra no estado</h4><p>${t}</p>`);
  const cal = calendarioCritico(c, se).filter(x => x[1]); let crit15 = 0; for (let j = semSel; j <= semSel + 2; j++) crit15 = Math.max(crit15, mediaMS(c, m => pctCritico(c, m, j))?.v || 0);
  if (cal.length) out.push(`<p>Pela projeção, metade da área semeada no estado entra em ${esc(cal[0][0])} por volta de <b>${fmtD(cal[0][1])}</b>${cal.length > 1 ? ` e em ${esc(cal.at(-1)[0])} por volta de ${fmtD(cal.at(-1)[1])}` : ''}. ${crit15 >= 1 ? `Nas próximas três semanas, até <b>${crit15.toFixed(0)}%</b> da área estará em fases críticas.` : 'Nas próximas três semanas, a área ainda não deve estar em fases críticas.'}</p>`);
  }
  // 2. solos da cultura
  const sc = soloCultura(cid, null);
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
  const fts = FOTOS.filter(x => x.cult === cid), rels = RELATOS.filter(r => r.cults.has(cid));
  let tc = `<p>${fts.length} foto${fts.length === 1 ? '' : 's'} de ${cult} e ${rels.length} relato${rels.length === 1 ? '' : 's'} que citam a cultura.</p>`;
  rels.slice(0, 3).forEach(r => { const tr = trechosCultura(r, cid); if (tr.length) tc += `<div class="nota"><b>${esc(r.nome)}</b> · ${fmtD(r.data)}</div>${tr.map(x => `<div class="trecho">“${esc(x)}”</div>`).join('')}`; });
  out.push(`<h4>Informações de campo</h4>${tc}`);
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
<tr><td>Uso e cobertura (soja, cana etc.)</td><td>Mapeamento vetorial de uso e cobertura de soja e cana-de-açúcar da Aprosoja-MS (arquivo MS26S1UCS), safra 2025/26; cada classe é exibida como camada</td><td>Quando novos arquivos são enviados</td></tr>
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
<p><b>Janela de clima.</b> O botão “Abrir clima e água no solo”, na ficha do município ou do estado, abre a previsão por modelo, os últimos 30 dias, a comparação com a estação INMET mais próxima e o balanço hídrico da cultura escolhida. No estado, os valores são médias dos municípios ponderadas pela área da cultura.</p>
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
<p>Para as culturas com mapa de uso e cobertura (atualmente soja e cana-de-açúcar, do mapeamento da Aprosoja-MS), a rotina automática sobrepõe os polígonos da cultura ao mapa de solos e à malha municipal, em projeção de áreas iguais, e soma a área (ha) por classe e por textura de solo, em cada município e no estado. Esses percentuais aparecem na camada de uso (barras de textura e classe, no estado e no município selecionado), na ficha, na análise e no resumo em PDF. Na análise, a água disponível usada no balanço hídrico passa a ser a das áreas ocupadas pela cultura, e não a do município inteiro. A escala do mapa de solos (1:5.000.000) limita a interpretação ao nível regional.</p>
<h3>8b. Visão do estado</h3>
<p>A ficha do estado agrega os municípios com dados: médias ponderadas pela área informada, distribuição por estádio, calendário das fases críticas a partir da curva estadual de semeadura e indicadores por região imediata. O clima é a média diária dos municípios com a cultura, ponderada pela área. A análise estadual roda o balanço hídrico de cada município, informa a fração da área com restrição hídrica (Ks &lt; 1) hoje e na previsão, e ordena os municípios pela pontuação de prioridade de vistoria.</p>
<h3>9. Relatos de viagem</h3>
<p>São lidos arquivos .docx, .pdf, .txt e .md. A data vem do nome do arquivo (AAAA-MM-DD), da primeira data no texto ou da data de modificação. Os municípios citados são identificados pelo nome (com inicial maiúscula, ignorando acentos) e as culturas por palavras-chave. A análise mostra os trechos que citam o município e a cultura.</p>
<h3>10. Análise agronômica automática e prioridade de vistoria</h3>
<p>O texto da análise é montado por regras explícitas a partir dos itens acima. A prioridade de vistoria soma pontos para: área em fases críticas nas próximas três semanas (≥ 30%), restrição hídrica atual (Ks &lt; 1), calor ≥ 35 °C ou déficit hídrico previsto durante fases críticas, risco de geada em culturas sensíveis, chuva elevada na maturação ou colheita, semeadura atrasada em relação ao estado e ausência de informação de campo nos últimos 30 dias (Alta ≥ 5 pontos; Média 3–4; Baixa ≤ 2).</p>
<h3>11. Resumo da safra (PDF)</h3>
<p>O resumo usa o período e as culturas escolhidos. Para cada cultura, apresenta a evolução da semeadura no estado e por região imediata, a distribuição por estádio, o clima do período nas áreas da cultura (ponderado pela área) e as informações de campo do período. O clima vem do histórico permanente; dias futuros vêm da previsão e são identificados como tal.</p>
<h3>12. Limitações</h3>
<ul><li>A projeção fenológica usa calendário médio, sem considerar temperatura (graus-dia), cultivar ou grupo de maturação.</li>
<li>Os dados de clima por município são estimativas em um ponto e não captam a variabilidade da chuva dentro do município. A média de modelos suaviza chuvas intensas e localizadas.</li>
<li>O mapa de solos é de escala muito pequena (1:5.000.000) e não representa o solo das lavouras.</li>
<li>Correlação entre indicadores não implica causa; as indicações do painel devem ser confirmadas em campo e com as fontes do levantamento.</li></ul>`;

// =====================================================================
// RESUMO DA SAFRA EM PDF
// =====================================================================
$('bt-resumo').onclick = () => {
  if (!PL) { abrirModal('Resumo da safra (PDF)', '<p>Conecte a pasta da equipe para gerar o resumo: ele depende das planilhas de plantio.</p>'); return; }
  const itens = []; Object.keys(PL).sort().reverse().forEach(s => Object.keys(PL[s]).forEach(n => { if (Object.keys(PL[s][n].mun).length) itens.push([s, n]); }));
  const c0 = cultAtual(), ini = c0?.inicio || addD(HOJE, -60);
  abrirModal('Resumo da safra (PDF)', `<div class="form-pdf">
    <div class="datas"><div><label for="pdf-ini">Início do período</label><input type="date" id="pdf-ini" class="campo" value="${dISO(ini)}"></div>
    <div><label for="pdf-fim">Fim do período</label><input type="date" id="pdf-fim" class="campo" value="${dISO(HOJE)}"></div></div>
    <label>Culturas (marque quantas quiser)</label>
    <div class="lista">${itens.map(([s, n], i) => `<label><input type="checkbox" class="pdf-c" data-s="${esc(s)}" data-n="${esc(n)}" ${s === safraSel && n === cultSel ? 'checked' : ''}> ${esc(n)} <span class="nota" style="margin:0">${esc(s)}</span></label>`).join('') || '<span class="nota">Nenhuma cultura com dados.</span>'}</div>
    <div class="mini"><a id="pdf-todas">marcar todas</a><a id="pdf-nenhuma">desmarcar</a></div>
    <label>Incluir</label>
    <div class="lista"><label><input type="checkbox" id="pdf-mun" checked> Tabela completa por município</label><label><input type="checkbox" id="pdf-clima" checked> Clima do período</label><label><input type="checkbox" id="pdf-campo" checked> Fotos e relatos do período</label></div>
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
  const agg = {p: 0, et0: 0, txMax: -99, tnMin: 99, geada: 0, quente: 0, seco: 0, fontes: {}}; let sp = 0;
  const cds = Object.keys(pesos).filter(cd => pesos[cd] > 0); sp = cds.reduce((t, cd) => t + pesos[cd], 0);
  let secoAtual = 0;
  for (const d of ds) {
    const D = dias[d]; agg.fontes[D.fonte] = (agg.fontes[D.fonte] || 0) + 1;
    let p = 0, e = 0, w = 0, g = false, q = false;
    for (const cd of cds) { const v = D.mun[cd]; if (!v) continue; w += pesos[cd]; p += (v.p || 0) * pesos[cd]; e += (v.et0 || 0) * pesos[cd]; if (v.tx != null) agg.txMax = Math.max(agg.txMax, v.tx); if (v.tn != null) agg.tnMin = Math.min(agg.tnMin, v.tn); if (v.tn != null && v.tn <= 3) g = true; if (v.tx != null && v.tx >= 35) q = true; }
    if (!w) continue; p /= w; e /= w; agg.p += p; agg.et0 += e; if (g) agg.geada++; if (q) agg.quente++;
    secoAtual = p < 1 ? secoAtual + 1 : 0; agg.seco = Math.max(agg.seco, secoAtual);
  }
  agg.dias = ds.length; agg.ini = ds[0]; agg.fim = ds.at(-1); return agg;
}
async function gerarPDF(ini, fim, sel, opts) {
  await carregarScript(LIBS.jspdf); await carregarScript(LIBS.autotable);
  const {jsPDF} = window.jspdf, doc = new jsPDF({unit: 'mm', format: 'a4'}), W = 210, M = 15;
  const logo = await imagemDataURL('img/logo_conab.png').catch(() => null);
  const VERDE = [47, 107, 58], CINZA = [93, 107, 88];
  const cab = () => {
    if (logo) doc.addImage(logo, 'PNG', M, 9, 9, 13.3);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(31, 42, 29); doc.text('Companhia Nacional de Abastecimento – Conab', M + 13, 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
    doc.text('Superintendência Regional de Mato Grosso do Sul', M + 13, 17.2); doc.text('Setor de Apoio à Logística e à Gestão de Oferta – SEGEO-MS', M + 13, 21.2);
    doc.setDrawColor(...VERDE); doc.setLineWidth(.6); doc.line(M, 25.5, W - M, 25.5);
  };
  let y = 0;
  const novaPag = () => { doc.addPage(); cab(); y = 32; };
  const garantir = h => { if (y + h > 280) novaPag(); };
  const tit = (t, tam = 13) => { garantir(12); doc.setFont('helvetica', 'bold'); doc.setFontSize(tam); doc.setTextColor(31, 42, 29); doc.text(t, M, y); y += tam * .5 + 2; };
  const par = (t, tam = 9.5, cor = [31, 42, 29]) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(tam); doc.setTextColor(...cor); const ls = doc.splitTextToSize(t, W - 2 * M); garantir(ls.length * tam * .42 + 2); doc.text(ls, M, y); y += ls.length * tam * .42 + 2.5; };
  const tabela = (head, body, extra = {}) => { doc.autoTable(Object.assign({head: [head], body, startY: y, margin: {left: M, right: M, top: 32}, styles: {font: 'helvetica', fontSize: 8, cellPadding: 1.4, textColor: [31, 42, 29]},
    headStyles: {fillColor: VERDE, textColor: 255, fontStyle: 'bold'}, alternateRowStyles: {fillColor: [244, 242, 236]}, didDrawPage: d => { if (d.pageNumber > 1) cab(); }}, extra)); y = doc.lastAutoTable.finalY + 5; };
  cab(); y = 36;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(31, 42, 29); doc.text('Resumo da Safra – Mato Grosso do Sul', M, y); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...CINZA);
  doc.text(`Período analisado: ${fmtDL(ini)} a ${fmtDL(fim)}   ·   Gerado em ${new Date().toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}`, M, y); y += 5;
  doc.text(`Culturas: ${sel.map(([s, n]) => `${n} (${s})`).join(', ')}`, M, y, {maxWidth: W - 2 * M}); y += 9;
  const dias = opts.clima ? await climaDiario(ini, fim) : {};
  // visão geral
  const linhasGeral = sel.map(([s, n]) => {
    const c = PL[s][n], ja = semanaDe(c, ini), jb = semanaDe(c, fim);
    const pa = mediaMS(c, m => acum(m.serie, ja)), pb = mediaMS(c, m => acum(m.serie, jb)), cr = mediaMS(c, m => pctCritico(c, m, jb));
    const area = Object.values(c.mun).reduce((t, m) => t + (m.area || 0), 0);
    return [`${n} (${s})`, area ? n0(area) : '—', String(Object.keys(c.mun).length), pa ? pa.v.toFixed(0) + '%' : '—', pb ? pb.v.toFixed(0) + '%' : '—', pa && pb ? '+' + (pb.v - pa.v).toFixed(0) + ' p.p.' : '—', cr ? cr.v.toFixed(0) + '%' : '—', fim > HOJE ? 'sim' : 'não'];
  });
  tit('1. Visão geral', 12);
  tabela(['Cultura (safra)', 'Área informada (ha)', 'Municípios', '% plantado no início', '% plantado no fim', 'Avanço', '% em fase crítica no fim', 'Fim projetado?'], linhasGeral);
  par('Percentuais do estado ponderados pela área estimada informada na planilha (média simples quando a área não foi informada). Fases críticas e estádios são projeções pelo calendário médio da aba Parâmetros.', 8, CINZA);
  let secao = 2;
  for (const [s, n] of sel) {
    const c = PL[s][n], ja = Math.max(1, semanaDe(c, ini)), jb = semanaDe(c, fim), cid = c.cid;
    novaPag(); tit(`${secao++}. ${n} – safra ${s}`, 13);
    // curva do estado
    const semanas = []; for (let j = 1; j <= Math.max(jb + 2, 24); j++) { const v = mediaMS(c, m => acum(m.serie, j)), k = mediaMS(c, m => pctCritico(c, m, j)); semanas.push({j, d: dataSem(c, j), pl: v?.v ?? 0, cr: k?.v ?? 0}); }
    const pb = mediaMS(c, m => acum(m.serie, jb)), pa = mediaMS(c, m => acum(m.serie, ja)), crb = mediaMS(c, m => pctCritico(c, m, jb));
    par(`Entre ${fmtDL(ini)} e ${fmtDL(fim)}, a semeadura de ${n.toLowerCase()} no estado passou de ${pa ? pa.v.toFixed(0) : 0}% para ${pb ? pb.v.toFixed(0) : 0}% da área${pb && !pb.pond ? ' (média simples)' : ''}. Ao fim do período, ${crb ? crb.v.toFixed(0) : 0}% da área estava em fases críticas (${c.estadios.filter(e => e.critico).map(e => e.nome).join(', ') || '—'}).${fim > HOJE ? ' O fim do período está no futuro: valores projetados.' : ''}`);
    // gráfico
    garantir(68); const gx = M + 8, gy = y + 2, gw = W - 2 * M - 10, gh = 50, nS = semanas.length;
    const X = j => gx + (j - 1) / (nS - 1) * gw, Y = v => gy + gh - v / 100 * gh;
    doc.setFillColor(244, 242, 236); doc.rect(X(Math.max(1, ja)), gy, Math.max(.5, X(Math.min(nS, Math.max(ja, jb))) - X(Math.max(1, ja))), gh, 'F');
    doc.setDrawColor(200); doc.setLineWidth(.2); [0, 25, 50, 75, 100].forEach(v => { doc.line(gx, Y(v), gx + gw, Y(v)); doc.setFontSize(7); doc.setTextColor(...CINZA); doc.text(v + '%', gx - 1.5, Y(v) + 1, {align: 'right'}); });
    const linha = (k, cor) => { doc.setDrawColor(...cor); doc.setLineWidth(.7); for (let i = 1; i < nS; i++) doc.line(X(semanas[i - 1].j), Y(semanas[i - 1][k]), X(semanas[i].j), Y(semanas[i][k])); };
    linha('pl', [184, 116, 26]); linha('cr', [196, 71, 43]);
    for (let i = 0; i < nS; i += Math.ceil(nS / 8)) { doc.setFontSize(7); doc.setTextColor(...CINZA); doc.text(fmtD(semanas[i].d), X(semanas[i].j), gy + gh + 4, {align: 'center'}); }
    doc.setFontSize(7.5); doc.setTextColor(184, 116, 26); doc.text('— % plantado (MS)', gx, gy + gh + 9); doc.setTextColor(196, 71, 43); doc.text('— % em fase crítica (MS)', gx + 35, gy + gh + 9); doc.setTextColor(...CINZA); doc.text('faixa cinza: período analisado', gx + 78, gy + gh + 9);
    y = gy + gh + 14;
    // estádios no fim
    const dist = new Array(c.estadios.length).fill(0); let sw = 0;
    for (const m of Object.values(c.mun)) { const w = m.area || 1; sw += w; distrib(c, m, jb).forEach((v, i) => dist[i] += v * w); }
    tabela(['Estádio em ' + fmtD(fim), '% da área da cultura', 'Crítico?'], c.estadios.map((e, i) => [e.nome, (dist[i] / sw).toFixed(0) + '%', e.critico ? 'sim' : '']).filter(r => r[1] !== '0%'), {tableWidth: 120});
    // solos ocupados pela cultura (mapa de uso x solos)
    const scP = soloCultura(cid, null);
    if (scP) { tabela(['Textura do solo (áreas de ' + scP.nome.toLowerCase() + ' mapeadas)', '% da área'], Object.entries(scP.textura).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v.toFixed(1) + '%']), {tableWidth: 120});
      tabela(['Classe de solo', '% da área'], Object.entries(scP.ordem).sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= .1).map(([k, v]) => [k, v.toFixed(1) + '%']), {tableWidth: 120});
      par(`Cruzamento de ${n0(scP.area)} ha de ${scP.nome.toLowerCase()} do mapa de uso da Aprosoja-MS com o mapa de solos IBGE/Embrapa 1:5.000.000.`, 7.5, CINZA); }
    // regiões imediatas
    const reg = {}; for (const [cd, m] of Object.entries(c.mun)) { const r = MUN_IDX[cd]?.properties.NM_RGI || '—'; (reg[r] ??= []).push(m); }
    tabela(['Região imediata', 'Municípios', 'Área (ha)', '% plantado no início', '% plantado no fim', '% fase crítica no fim'], Object.entries(reg).sort().map(([r, ms]) => {
      const cc = {mun: Object.fromEntries(ms.map((m, i) => [i, m]))}, a = mediaMS(cc, m => acum(m.serie, ja)), b = mediaMS(cc, m => acum(m.serie, jb)), k = mediaMS(cc, m => pctCritico(c, m, jb));
      return [r, ms.length, n0(ms.reduce((t, m) => t + (m.area || 0), 0)) , a ? a.v.toFixed(0) + '%' : '—', b ? b.v.toFixed(0) + '%' : '—', k ? k.v.toFixed(0) + '%' : '—']; }));
    // clima do período
    if (opts.clima) {
      tit('Clima do período nas áreas da cultura', 10.5);
      const pesos = Object.fromEntries(Object.entries(c.mun).map(([cd, m]) => [cd, m.area || 1]));
      const rc = resumoClima(dias, pesos);
      if (!rc) par('Sem dados de clima no histórico para este período.', 9, CINZA);
      else {
        tabela(['Indicador', 'Valor'], [['Dias com dados', `${rc.dias} (${fmtD(deISO(rc.ini))} a ${fmtD(deISO(rc.fim))})`], ['Chuva acumulada (média ponderada pela área)', n0(rc.p) + ' mm'], ['Evapotranspiração de referência (ajustada pelas estações INMET)', n0(rc.et0) + ' mm'],
          ['Chuva menos evapotranspiração', n0(rc.p - rc.et0) + ' mm'], ['Maior sequência de dias sem chuva (média da área)', rc.seco + (rc.seco === 1 ? ' dia' : ' dias')], ['Temperatura máxima registrada', n1(rc.txMax) + ' °C'], ['Temperatura mínima registrada', n1(rc.tnMin) + ' °C'],
          ['Dias com máxima de 35 °C ou mais em algum município', String(rc.quente)], ['Dias com mínima de 3 °C ou menos em algum município', String(rc.geada)],
          ['Fonte dos dias', Object.entries(rc.fontes).map(([f, n]) => `${f === 'era5' ? 'reanálise ERA5' : f === 'modelo' ? 'análise do modelo' : 'previsão'}: ${n}`).join('; ')]], {tableWidth: 150});
      }
    }
    // campo
    if (opts.campo) {
      const fts = FOTOS.filter(p => p.cult === cid && p.data >= ini && p.data <= addD(fim, 1)), rels = RELATOS.filter(r => r.cults.has(cid) && r.data >= ini && r.data <= addD(fim, 1));
      tit('Informações de campo no período', 10.5);
      par(`${fts.length} fotos de ${n.toLowerCase()} e ${rels.length} relatos que citam a cultura.`, 9);
      if (fts.length) { const pm = {}; fts.forEach(p => { const k = p.mun ? p.mun.properties.NM_MUN : 'Fora do MS'; pm[k] = (pm[k] || 0) + 1; });
        tabela(['Município', 'Fotos'], Object.entries(pm).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]), {tableWidth: 90}); }
      if (rels.length) tabela(['Data', 'Relato', 'Municípios citados'], rels.map(r => [fmtD(r.data), r.nome, [...r.muns].map(cd => MUN_IDX[cd]?.properties.NM_MUN).filter(Boolean).join(', ') || '—']), {columnStyles: {0: {cellWidth: 18}, 1: {cellWidth: 60}}});
    }
    // tabela completa por município (nenhum dado omitido)
    if (opts.mun) {
      tit('Dados por município', 10.5);
      tabela(['Município', 'Área (ha)', ...Array.from({length: Math.min(22, Math.max(1, jb))}, (_, k) => k + 1).filter(k => k >= Math.max(1, ja - 1)).map(k => fmtD(dataSem(c, k)).slice(0, 5)), 'Fase crítica no fim'],
        Object.entries(c.mun).sort((a, b) => (MUN_IDX[a[0]]?.properties.NM_MUN || '').localeCompare(MUN_IDX[b[0]]?.properties.NM_MUN || '', 'pt')).map(([cd, m]) => [MUN_IDX[cd]?.properties.NM_MUN || cd, m.area ? n0(m.area) : '—',
          ...Array.from({length: Math.min(22, Math.max(1, jb))}, (_, k) => k + 1).filter(k => k >= Math.max(1, ja - 1)).map(k => m.serie[k - 1] == null ? '' : String(Math.round(m.serie[k - 1]))), pctCritico(c, m, jb).toFixed(0) + '%']),
        {styles: {font: 'helvetica', fontSize: 6.5, cellPadding: .9}});
      par('Colunas de datas: % acumulado informado pela equipe em cada semana do período (célula vazia = semana não preenchida).', 7.5, CINZA);
    }
  }
  novaPag(); tit(`${secao}. Notas metodológicas`, 12);
  par('Fonte da evolução do plantio: planilha semanal da SEGEO-MS. Projeção fenológica pelo calendário médio (dias após a semeadura) da aba Parâmetros, sem considerar graus-dia. Clima por município no ponto central: histórico permanente com reanálise ERA5 (Copernicus/ECMWF, via Open-Meteo), complementado pela análise e previsão de modelos numéricos (Open-Meteo). Fotos e relatos: pasta da equipe no ConabCloud. Os indicadores apontam situações a verificar; não representam estimativa oficial de área, produtividade ou produção, e associações entre indicadores não implicam causa.', 9);
  const tot = doc.getNumberOfPages();
  for (let i = 1; i <= tot; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
    doc.text('Painel de Levantamento de Safras MS · dados preliminares, sujeitos a revisão', M, 290); doc.text(`Página ${i} de ${tot}`, W - M, 290, {align: 'right'}); }
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
  lista.filter(c => c.startsWith('uso_')).forEach(camUso);
  lista.filter(c => c.startsWith('infra_') && !/rodovias_(federais|estaduais)/.test(c)).forEach(c => camRodovia('i_' + c, c, c.slice(6).replace(/_/g, ' ')));
  if (!solo) delete CAM.solo;
  renderCamadas();
  for (const c of Object.values(CAM)) if (c.on) { c.on = false; await ligar(c.id, true); }
  // camada invisível para cliques e dicas
  L.geoJSON(mun, {pane: 'clique', style: {stroke: false, fill: true, fillOpacity: 0}, onEachFeature: (f, l) => {
    l.on('click', () => selecionar(f)); l.bindTooltip(() => dicaMun(f), {sticky: true, direction: 'top', opacity: .9}); }}).addTo(mapa);
  mapa.fitBounds(L.geoJSON(mun).getBounds(), {padding: [10, 10]});
  garantirClima(); pegar('dados/clima/estacoes_inmet.json').then(e => { EST = e; }); pegar('dados/clima/validacao_et0.json').then(v => { VAL = v; for (const k in _fat) delete _fat[k]; atualizarAgua(); }); pegar('dados/solo_cultura.json').then(v => { SOLO_CULT = v; Object.keys(CAM).filter(k => k.startsWith('u_')).forEach(atualizarSub); montarCana(); montarControlesCult(); });
})();
