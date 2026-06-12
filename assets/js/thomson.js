// =====================================================================
// thomson.js — Anel de Thomson
// =====================================================================

const PROXY = 'https://omnis-proxy.labremotodeivid.workers.dev';
const BASE  = 'https://aneldethomson-panel.unifei.edu.br';

// Envia a URL alvo no header X-Target-URL
// Assim evita qualquer problema de encode/decode na query string
function proxyFetch(path, opts = {}) {
  return fetch(PROXY, {
    ...opts,
    headers: {
      'Content-Type':  'application/json',
      'X-Target-URL':  BASE + path,
      ...(opts.headers || {}),
    },
  });
}

const TUTORIAL_URL = 'https://raw.githubusercontent.com/labremotodeivid-coder/labremoto/main/experimentos_info/anel_de_thomson_info.md';
const WS_URL       = 'wss://aneldethomson-cam.unifei.edu.br';

// ── Estado de sessão ─────────────────────────────────────────────────
let experimentoPronto    = false;
let experimentoOcupado   = false;
let servidorIndisponivel = false;
let sessaoExpiraEm       = null;
let ocupadoExpiraEm      = null;
let sessaoSegundos       = 600;

// ── Timers ───────────────────────────────────────────────────────────
let timerKeepAlive  = null;
let timerSessao     = null;
let timerOcupado    = null;
let timerPreparando = null;
let resetCancelado  = false;

// ── Estado do hardware ───────────────────────────────────────────────
let bobinaALigada = false;
let bobinaBLigada = false;
let correnteA     = null;
let correnteB     = null;
let lendoA        = false;
let lendoB        = false;
let statusAtual   = '000';

// ── Câmera WebSocket ─────────────────────────────────────────────────
let wsCamera      = null;
let camReconexoes = 0;
let camTimer      = null;
let camAtual      = 0;
let totalCameras  = 1;
const MAX_CAM_REC = 5;

// =====================================================================
// INIT
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
  fetchTutorial();
  resetInicial();
});

// =====================================================================
// FLUXO PRINCIPAL
// =====================================================================
async function resetInicial() {
  experimentoPronto    = false;
  experimentoOcupado   = false;
  servidorIndisponivel = false;
  atualizarUI();

  // Etapa 1: beacon
  try {
    const res = await fetchComTimeout('/beacon', { method: 'POST' }, 5000);
    if (!res.ok) throw new Error('beacon falhou');
  } catch (_) {
    servidorIndisponivel = true;
    mostrarOverlay('overlayIndisponivel');
    setTimeout(() => { if (!experimentoPronto) resetInicial(); }, 15000);
    return;
  }

  // Etapa 2: session/enter
  try {
    const res = await fetchComTimeout('/session/enter', { method: 'POST' }, 8000);
    if (res.status === 409) {
      const data     = await res.json();
      const restante = data.remaining || 0;
      experimentoOcupado = true;
      ocupadoExpiraEm    = Date.now() + restante * 1000;
      mostrarOverlay('overlayOcupado');
      iniciarTimerOcupado();
      return;
    }
  } catch (_) {
    experimentoOcupado = true;
    ocupadoExpiraEm    = Date.now() + 15000;
    mostrarOverlay('overlayOcupado');
    iniciarTimerOcupado();
    return;
  }

  // Etapa 3: sessão concedida
  iniciarKeepAlive();
  iniciarTimerSessao();
  resetCancelado = false;
  executarResetHardware();
  iniciarPreparacao();
  conectarCamera();
}

// =====================================================================
// KEEP-ALIVE
// =====================================================================
function iniciarKeepAlive() {
  clearInterval(timerKeepAlive);
  timerKeepAlive = setInterval(async () => {
    try { await fetchComTimeout('/arduino/api/v1/read', { method: 'POST' }, 3000); } catch (_) {}
  }, 5000);
}

// =====================================================================
// TIMER DE SESSÃO
// =====================================================================
function iniciarTimerSessao() {
  clearInterval(timerSessao);
  sessaoSegundos = 600;
  sessaoExpiraEm = Date.now() + 600000;
  timerSessao = setInterval(() => {
    const restante = Math.max(0, Math.floor((sessaoExpiraEm - Date.now()) / 1000));
    sessaoSegundos = restante;
    atualizarTimer();
    if (restante <= 0) { clearInterval(timerSessao); expirarSessao(); }
  }, 1000);
}

function atualizarTimer() {
  const box  = document.getElementById('timerBox');
  const disp = document.getElementById('timerDisplay');
  if (!box || !disp) return;
  if (!experimentoPronto) { box.style.display = 'none'; return; }
  box.style.display = 'flex';
  const m = String(Math.floor(sessaoSegundos / 60)).padStart(2, '0');
  const s = String(sessaoSegundos % 60).padStart(2, '0');
  disp.textContent = `${m}:${s}`;
  box.className = 'thomson-timer';
  if (sessaoSegundos <= 60)       box.classList.add('vermelho');
  else if (sessaoSegundos <= 120) box.classList.add('laranja');
}

function expirarSessao() {
  if (confirm('Seu tempo de 10 minutos expirou.\nClique OK para sair.')) sair();
}

// =====================================================================
// TIMER DE OCUPADO
// =====================================================================
function iniciarTimerOcupado() {
  clearInterval(timerOcupado);
  timerOcupado = setInterval(() => {
    const seg = Math.max(0, Math.floor((ocupadoExpiraEm - Date.now()) / 1000));
    atualizarTimerOcupado(seg);
    if (seg <= 0) { clearInterval(timerOcupado); reverificarEEntrar(); }
  }, 500);
}

function atualizarTimerOcupado(seg) {
  const m  = String(Math.floor(seg / 60)).padStart(2, '0');
  const s  = String(seg % 60).padStart(2, '0');
  const el = document.getElementById('timerOcupado');
  if (!el) return;
  el.textContent = `${m}:${s}`;
  el.className   = 'timer-card-valor';
  if (seg <= 30)      el.classList.add('vermelho');
  else if (seg <= 60) el.classList.add('laranja');
}

async function reverificarEEntrar() {
  try {
    const res = await fetchComTimeout('/session/status', { method: 'POST' }, 6000);
    if (res.ok) {
      const data     = await res.json();
      const ocupado  = data.busy      || false;
      const restante = data.remaining || 0;
      if (ocupado && restante > 0) {
        ocupadoExpiraEm = Date.now() + restante * 1000;
        iniciarTimerOcupado();
        return;
      }
    }
  } catch (_) {
    ocupadoExpiraEm = Date.now() + 15000;
    iniciarTimerOcupado();
    return;
  }
  esconderOverlay('overlayOcupado');
  experimentoOcupado = false;
  resetInicial();
}

// =====================================================================
// PREPARAÇÃO
// =====================================================================
function iniciarPreparacao() {
  mostrarOverlay('overlayPreparando');
  let contagem = 10;
  atualizarPreparando(contagem);
  clearInterval(timerPreparando);
  timerPreparando = setInterval(() => {
    contagem--;
    atualizarPreparando(contagem);
    if (contagem <= 0) {
      clearInterval(timerPreparando);
      resetCancelado = true;
      esconderOverlay('overlayPreparando');
      experimentoPronto = true;
      desbloquearControles();
      atualizarTimer();
    }
  }, 1000);
}

function atualizarPreparando(n) {
  const numEl  = document.getElementById('preparandoNum');
  const ringFg = document.getElementById('ringFg');
  const contEl = document.getElementById('preparandoContador');
  if (numEl) numEl.textContent = n;
  const perim  = 138.2;
  const offset = perim - (n / 10) * perim;
  if (ringFg) {
    ringFg.style.strokeDashoffset = offset;
    ringFg.style.stroke = n > 5 ? 'rgba(255,255,255,0.7)' : n > 3 ? 'orange' : '#f87171';
  }
  if (contEl) contEl.style.color = n > 5 ? 'var(--cor-ambar)' : n > 3 ? 'orange' : '#f87171';
}

// =====================================================================
// RESET DE HARDWARE
// =====================================================================
async function executarResetHardware() {
  if (resetCancelado) return;
  try { await fetchComTimeout('/arduino/api/v1/write/888;', { method: 'POST' }, 10000); } catch (_) {}
}

// =====================================================================
// DESBLOQUEAR CONTROLES
// =====================================================================
function desbloquearControles() {
  ['switchA','switchB','btnLerA','btnLerB'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
  ['panelA','panelB'].forEach(id => {
    document.getElementById(id)?.classList.remove('bloqueado');
  });
}

// =====================================================================
// COMANDOS DAS BOBINAS — URLs corretas com ; preservado
// =====================================================================
async function toggleBobinaA(ligar) {
  const cmd = ligar ? '001' : '002';
  await postCmd(cmd);
  bobinaALigada = ligar;
  atualizarEstadoBobina('A', ligar);
}

async function toggleBobinaB(ligar) {
  const cmd = ligar ? '003' : '004';
  await postCmd(cmd);
  bobinaBLigada = ligar;
  atualizarEstadoBobina('B', ligar);
}

function atualizarEstadoBobina(bob, ligada) {
  const panel  = document.getElementById(`panel${bob}`);
  const estado = document.getElementById(`estado${bob}`);
  if (panel) {
    panel.classList.remove('ligada-azul','ligada-ambar');
    if (ligada) panel.classList.add(bob === 'A' ? 'ligada-azul' : 'ligada-ambar');
  }
  if (estado) {
    estado.textContent = ligada ? 'LIGADA' : 'DESLIGADA';
    estado.className   = 'bobina-estado';
    if (ligada) estado.classList.add(bob === 'A' ? 'ligado-azul' : 'ligado-ambar');
  }
}

// =====================================================================
// LEITURA DE CORRENTE
// =====================================================================
async function lerCorrenteA() {
  if (lendoA) return;
  lendoA = true;
  document.getElementById('btnLerA').disabled = true;
  document.getElementById('correnteADisplay').textContent = '...';
  try {
    await fetchComTimeout('/arduino/api/v1/write/006;', { method: 'POST' }, 5000);
    await delay(1200);
    const res  = await fetchComTimeout('/arduino/api/v1/read', { method: 'POST' }, 5000);
    const body = await res.text();
    correnteA  = parseCorrente(body);
    exibirCorrente('A', correnteA);
  } catch (_) {}
  lendoA = false;
  if (!document.getElementById('btnLerA').disabled === false)
    document.getElementById('btnLerA').disabled = false;
}

async function lerCorrenteB() {
  if (lendoB) return;
  lendoB = true;
  document.getElementById('btnLerB').disabled = true;
  document.getElementById('correnteBDisplay').textContent = '...';
  try {
    await fetchComTimeout('/arduino/api/v1/write/005;', { method: 'POST' }, 5000);
    await delay(1200);
    const res  = await fetchComTimeout('/arduino/api/v1/read', { method: 'POST' }, 5000);
    const body = await res.text();
    correnteB  = parseCorrente(body);
    exibirCorrente('B', correnteB);
  } catch (_) {}
  lendoB = false;
  document.getElementById('btnLerB').disabled = false;
}

// =====================================================================
// EXIBIR CORRENTE
// =====================================================================
function exibirCorrente(bob, val) {
  const dispEl = document.getElementById(`corrente${bob}Display`);
  const subEl  = document.getElementById(`corrente${bob}Sub`);
  const cor    = bob === 'A' ? 'azul' : 'ambar';
  if (!dispEl) return;
  if (val === null) {
    dispEl.textContent = '—';
    dispEl.className   = 'corrente-valor';
    if (subEl) subEl.textContent = '';
    return;
  }
  const LIMIAR  = 50;
  const ehRuido = val < LIMIAR;
  const valorA  = ehRuido ? '0,00' : (val / 1000).toFixed(2).replace('.', ',');
  dispEl.textContent = `${valorA} A`;
  dispEl.className   = `corrente-valor ${cor}`;
  if (subEl) {
    subEl.textContent     = ehRuido ? 'ruído do sensor' : `${val} mA`;
    subEl.style.fontStyle = ehRuido ? 'italic' : 'normal';
  }
}

function parseCorrente(body) {
  if (!body) return null;
  for (const seg of body.split(';').map(s => s.trim())) {
    if (seg.includes(':')) {
      const partes = seg.split(':');
      if (partes.length >= 2) {
        const val = parseInt(partes[1].trim());
        if (!isNaN(val)) return val;
      }
    }
  }
  return null;
}

// =====================================================================
// POST DE COMANDO — URL com ; preservado
// =====================================================================
async function postCmd(cmd) {
  statusAtual = cmd;
  atualizarSinal();
  try {
    const path = `/arduino/api/v1/write/${cmd};`;
    console.log('Enviando comando:', BASE + path);
    const res = await fetchComTimeout(path, { method: 'POST' }, 10000);
    console.log('Resposta:', res.status);
  } catch (e) {
    console.error('Erro comando:', e);
    statusAtual = 'ERRO';
    atualizarSinal(true);
  }
}

function atualizarSinal(erro = false) {
  const dot = document.getElementById('sinalDot');
  const txt = document.getElementById('sinalTexto');
  if (dot) dot.className = `sinal-dot ${erro ? 'vermelho' : 'verde'}`;
  if (txt) txt.textContent = `SINAL: ${statusAtual}`;
}

// =====================================================================
// CÂMERA WEBSOCKET
// =====================================================================
function conectarCamera() {
  desconectarCamera();
  camReconexoes = 0;
  tentarConectarCamera();
}

function tentarConectarCamera() {
  if (camReconexoes >= MAX_CAM_REC) {
    setCameraStatus('Câmera indisponível no momento.', true);
    return;
  }
  try {
    wsCamera = new WebSocket(WS_URL);
    wsCamera.binaryType = 'arraybuffer';
    wsCamera.onopen = () => {
      camReconexoes = 0;
      wsCamera.send('get n');
      setCameraStatus('', false, true);
    };
    wsCamera.onmessage = (ev) => {
      camReconexoes = 0;
      if (typeof ev.data === 'string') {
        if (ev.data.toLowerCase().startsWith('cameras available:')) {
          const n = parseInt(ev.data.split(':')[1].trim()) || 1;
          totalCameras = n; camAtual = 0;
          atualizarSeletorCamera();
          selecionarCamera(0);
        } else if (ev.data.startsWith('data:image/')) {
          mostrarFrameCamera(ev.data);
        }
      } else {
        const bytes  = new Uint8Array(ev.data);
        let binary   = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        mostrarFrameCamera('data:image/jpeg;base64,' + btoa(binary));
      }
    };
    wsCamera.onerror = () => agendarReconexaoCamera();
    wsCamera.onclose = () => agendarReconexaoCamera();
  } catch (_) { agendarReconexaoCamera(); }
}

function agendarReconexaoCamera() {
  camReconexoes++;
  if (camReconexoes >= MAX_CAM_REC) { setCameraStatus('Câmera indisponível no momento.', true); return; }
  setCameraStatus(`Reconectando... (tentativa ${camReconexoes})`);
  clearTimeout(camTimer);
  camTimer = setTimeout(tentarConectarCamera, camReconexoes * 2000);
}

function desconectarCamera() {
  clearTimeout(camTimer);
  if (wsCamera) { try { wsCamera.close(); } catch (_) {} wsCamera = null; }
}

function selecionarCamera(idx) {
  camAtual = idx;
  if (wsCamera && wsCamera.readyState === WebSocket.OPEN) wsCamera.send(`camera ${idx}`);
  document.querySelectorAll('.cam-btn').forEach((b, i) => b.classList.toggle('ativo', i === idx));
}

function atualizarSeletorCamera() {
  const sel = document.getElementById('cameraSelector');
  if (!sel) return;
  if (totalCameras <= 1) { sel.style.display = 'none'; return; }
  sel.style.display = 'flex';
  sel.innerHTML = Array.from({ length: totalCameras }, (_, i) =>
    `<button class="cam-btn${i === camAtual ? ' ativo' : ''}" onclick="selecionarCamera(${i})">${i+1}</button>`
  ).join('');
}

function mostrarFrameCamera(src) {
  const img = document.getElementById('cameraFeed');
  const ph  = document.getElementById('cameraPlaceholder');
  if (img) { img.src = src; img.style.display = 'block'; }
  if (ph)  ph.style.display = 'none';
}

function setCameraStatus(msg, mostrarBotao = false, ocultar = false) {
  const ph    = document.getElementById('cameraPlaceholder');
  const retry = document.getElementById('camRetry');
  const img   = document.getElementById('cameraFeed');
  if (!ph) return;
  if (ocultar) { ph.style.display = 'none'; return; }
  ph.style.display = 'flex';
  ph.innerHTML = mostrarBotao
    ? `<span style="margin-bottom:8px">${msg}</span>`
    : `<div class="cam-spinner"></div><span>${msg}</span>`;
  if (img)   img.style.display   = 'none';
  if (retry) retry.style.display = mostrarBotao ? 'block' : 'none';
}

function reconectarCameraManual() {
  camReconexoes = 0;
  document.getElementById('camRetry').style.display = 'none';
  setCameraStatus('Conectando à câmera...');
  tentarConectarCamera();
}

// =====================================================================
// SAÍDA
// =====================================================================
function sair() {
  clearInterval(timerKeepAlive);
  clearInterval(timerSessao);
  clearInterval(timerOcupado);
  clearInterval(timerPreparando);
  resetCancelado = true;
  desconectarCamera();
  setTimeout(() => { 
    proxyFetch('/arduino/api/v1/write/888;', { method: 'POST' }).catch(() => {}); 
  }, 600);
  document.body.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  document.body.style.opacity    = '0';
  document.body.style.transform  = 'translateY(-20px)';
  setTimeout(() => { window.location.href = 'experimentos.html'; }, 400);
}

function sairSemSessao() {
  clearInterval(timerOcupado);
  clearInterval(timerPreparando);
  document.body.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  document.body.style.opacity    = '0';
  document.body.style.transform  = 'translateY(-20px)';
  setTimeout(() => { window.location.href = 'experimentos.html'; }, 400);
}

function tentarNovamente() {
  esconderOverlay('overlayIndisponivel');
  servidorIndisponivel = false;
  resetInicial();
}

// =====================================================================
// TUTORIAL
// =====================================================================
async function fetchTutorial() {
  const body = document.getElementById('tutorialBody');
  if (!body) return;
  body.innerHTML = '<div class="cam-spinner"></div>';
  try {
    const res  = await fetchComTimeout(TUTORIAL_URL, {}, 10000);
    const text = await res.text();
    body.textContent = res.ok ? text : 'Tutorial indisponível';
  } catch (_) { body.textContent = 'Erro ao carregar tutorial'; }
}

function abrirTutorial()  { mostrarOverlay('overlayTutorial'); }
function fecharTutorial() { esconderOverlay('overlayTutorial'); }

// =====================================================================
// DRAWER
// =====================================================================
function toggleDrawer() {
  document.getElementById('drawer').classList.toggle('aberto');
  document.getElementById('drawerOverlay').classList.toggle('aberta');
}

// =====================================================================
// OVERLAYS
// =====================================================================
function mostrarOverlay(id)  { const el = document.getElementById(id); if (el) el.style.display = 'flex'; }
function esconderOverlay(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function atualizarUI() {
  if (servidorIndisponivel) { mostrarOverlay('overlayIndisponivel'); return; }
  if (experimentoOcupado)   { mostrarOverlay('overlayOcupado');     return; }
}

// =====================================================================
// HELPERS
// =====================================================================
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Todas as chamadas ao servidor passam pelo proxyFetch com timeout
async function fetchComTimeout(path, opts = {}, ms = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await proxyFetch(path, { ...opts, signal: controller.signal });
  } finally { clearTimeout(id); }
}