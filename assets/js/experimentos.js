// =====================================================================
// experimentos.js — OMNIS Experimentos Remotos
// =====================================================================

// ── Configurações dos experimentos ──────────────────────────────────
const EXPERIMENTOS = {
  trilho: {
    titulo:    'Trilho de Ar',
    serverUrl: 'https://trilhodear-panel.unifei.edu.br',
    wsUrl:     'wss://trilhodear-panel.unifei.edu.br/ws',
    cameras:   1,
    render:    renderTrilho,
  },
  thomson: {
    titulo:    'Anel de Thomson',
    serverUrl: 'https://aneldethomson-panel.unifei.edu.br',
    wsUrl:     'wss://aneldethomson-panel.unifei.edu.br/ws',
    cameras:   1,
    render:    renderThomson,
  },
  titulacao: {
    titulo:    'Titulação',
    serverUrl: 'https://titulacao-panel.unifei.edu.br',
    wsUrl:     'wss://titulacao-panel.unifei.edu.br/ws',
    cameras:   1,
    render:    renderTitulacao,
  },
};

// ── Estado global ────────────────────────────────────────────────────
let wsCamera       = null;   // WebSocket da câmera ativa
let reconexoes     = 0;
let timerReconexao = null;
let cameraAtual    = 0;
let totalCameras   = 1;
let countdownTimers = {};    // id → setInterval de countdown
let favoritos      = JSON.parse(localStorage.getItem('omnis_favoritos') || '[]');
let expAtual       = null;   // id do experimento aberto no modal

const MAX_RECONEXOES   = 5;
const DELAY_BASE_MS    = 2000;

// ── Inicialização ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  atualizarFavoritos();
  atualizarStatus();
});

// =====================================================================
// STATUS (disponível / ocupado)
// =====================================================================

async function atualizarStatus() {
  const btn = document.getElementById('btnRefresh');
  if (btn) btn.classList.add('girando');

  await Promise.all(Object.keys(EXPERIMENTOS).map(fetchStatusExp));

  if (btn) btn.classList.remove('girando');
}

async function fetchStatusExp(id) {
  const exp = EXPERIMENTOS[id];
  try {
    const res = await fetch(`${exp.serverUrl}/session/status`, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      setBadge(id, data.busy, data.remaining || 0);
      return;
    }
  } catch (_) {}
  // Falha de rede → remove spinner, marca sem status
  setBadge(id, false, 0, true);
}

function setBadge(id, ocupado, segundos, erro = false) {
  const badge = document.getElementById(`badge-${id}`);
  const tempo = document.getElementById(`tempo-${id}`);
  if (!badge) return;

  if (erro) {
    badge.innerHTML = '';
    badge.className = 'exp-badge';
    return;
  }

  if (ocupado) {
    badge.className = 'exp-badge ocupado';
    badge.innerHTML = '🔒 OCUPADO';

    // Inicia countdown no card
    if (tempo) {
      tempo.style.display = 'block';
      let restante = segundos;
      clearInterval(countdownTimers[id]);
      countdownTimers[id] = setInterval(() => {
        restante--;
        const m = String(Math.floor(restante / 60)).padStart(2, '0');
        const s = String(restante % 60).padStart(2, '0');
        const el = document.getElementById(`countdown-${id}`);
        if (el) el.textContent = `${m}:${s}`;
        if (restante <= 0) {
          clearInterval(countdownTimers[id]);
          fetchStatusExp(id);
        }
      }, 1000);
    }
  } else {
    badge.className = 'exp-badge disponivel';
    badge.innerHTML = '✔ DISPONÍVEL';
    clearInterval(countdownTimers[id]);
    if (tempo) tempo.style.display = 'none';
  }
}

// =====================================================================
// FAVORITOS
// =====================================================================

function toggleFavorito(e, id) {
  e.stopPropagation();
  if (favoritos.includes(id)) {
    favoritos = favoritos.filter(f => f !== id);
  } else {
    favoritos.push(id);
  }
  localStorage.setItem('omnis_favoritos', JSON.stringify(favoritos));
  atualizarFavoritos();
}

function atualizarFavoritos() {
  Object.keys(EXPERIMENTOS).forEach(id => {
    const btn = document.getElementById(`fav-${id}`);
    if (!btn) return;
    if (favoritos.includes(id)) {
      btn.textContent = '★';
      btn.classList.add('ativo');
    } else {
      btn.textContent = '☆';
      btn.classList.remove('ativo');
    }
  });
}

// =====================================================================
// MODAL — abrir / fechar
// =====================================================================

function abrirExperimento(id) {
  const exp = EXPERIMENTOS[id];
  if (!exp) return;

  expAtual = id;
  const modal   = document.getElementById('expModal');
  const content = document.getElementById('expModalContent');

  content.innerHTML = `
    <button class="modal-fechar" onclick="fecharModal()">✕</button>
    <h2 style="margin-bottom:20px; font-size:24px;">${exp.titulo}</h2>

    <!-- CÂMERA -->
    <div class="camera-container" id="cameraBox">
      <img id="cameraFeed" alt="Feed da câmera" />
      <div class="camera-status" id="cameraStatus">
        <div class="camera-spinner"></div>
        Conectando à câmera...
      </div>
      <div class="camera-selector" id="cameraSelector" style="display:none"></div>
    </div>

    <!-- CONTROLES ESPECÍFICOS -->
    <div id="controlesEspecificos"></div>
  `;

  // Renderiza controles do experimento
  exp.render(document.getElementById('controlesEspecificos'));

  modal.classList.add('aberto');
  document.body.style.overflow = 'hidden';

  // Conecta câmera WebSocket
  conectarCamera(exp.wsUrl);
}

function fecharModal() {
  document.getElementById('expModal').classList.remove('aberto');
  document.body.style.overflow = '';
  desconectarCamera();
  expAtual = null;
}

// Fechar ao clicar fora do modal
document.getElementById('expModal').addEventListener('click', function(e) {
  if (e.target === this) fecharModal();
});

// =====================================================================
// CÂMERA WEBSOCKET
// =====================================================================

function conectarCamera(wsUrl) {
  desconectarCamera();
  reconexoes = 0;
  _tentarConectarCamera(wsUrl);
}

function _tentarConectarCamera(wsUrl) {
  if (reconexoes >= MAX_RECONEXOES) {
    setCameraStatus('Câmera indisponível no momento.', true);
    return;
  }

  try {
    wsCamera = new WebSocket(wsUrl);
    wsCamera.binaryType = 'arraybuffer';

    wsCamera.onopen = () => {
      reconexoes = 0;
      wsCamera.send('get n');
      setCameraStatus('Câmera conectada');
    };

    wsCamera.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        if (ev.data.toLowerCase().startsWith('cameras available:')) {
          const n = parseInt(ev.data.split(':')[1].trim()) || 1;
          totalCameras = n;
          cameraAtual  = 0;
          atualizarSeletorCamera();
          selecionarCamera(0);
        }
        // frame base64
        else if (ev.data.startsWith('data:image/')) {
          mostrarFrame(ev.data);
        }
      } else {
        // bytes crus → converte para base64
        const bytes  = new Uint8Array(ev.data);
        const binary = bytes.reduce((acc, b) => acc + String.fromCharCode(b), '');
        mostrarFrame('data:image/jpeg;base64,' + btoa(binary));
      }
    };

    wsCamera.onerror = () => agendarReconexao(wsUrl);
    wsCamera.onclose = () => agendarReconexao(wsUrl);

  } catch (_) {
    agendarReconexao(wsUrl);
  }
}

function agendarReconexao(wsUrl) {
  if (!expAtual) return; // modal já fechou
  reconexoes++;
  if (reconexoes >= MAX_RECONEXOES) {
    setCameraStatus('Câmera indisponível no momento.', true);
    return;
  }
  setCameraStatus(`Reconectando... (tentativa ${reconexoes})`);
  clearTimeout(timerReconexao);
  timerReconexao = setTimeout(() => _tentarConectarCamera(wsUrl), reconexoes * DELAY_BASE_MS);
}

function desconectarCamera() {
  clearTimeout(timerReconexao);
  if (wsCamera) { try { wsCamera.close(); } catch (_) {} wsCamera = null; }
}

function selecionarCamera(index) {
  cameraAtual = index;
  if (wsCamera && wsCamera.readyState === WebSocket.OPEN) {
    wsCamera.send(`camera ${index}`);
  }
  document.querySelectorAll('.cam-btn').forEach((b, i) => {
    b.classList.toggle('ativo', i === index);
  });
}

function atualizarSeletorCamera() {
  const sel = document.getElementById('cameraSelector');
  if (!sel) return;
  if (totalCameras <= 1) { sel.style.display = 'none'; return; }
  sel.style.display = 'flex';
  sel.innerHTML = Array.from({ length: totalCameras }, (_, i) =>
    `<button class="cam-btn${i === cameraAtual ? ' ativo' : ''}" onclick="selecionarCamera(${i})">${i + 1}</button>`
  ).join('');
}

function mostrarFrame(src) {
  const img = document.getElementById('cameraFeed');
  const sta = document.getElementById('cameraStatus');
  if (!img) return;
  img.src = src;
  img.style.display = 'block';
  if (sta) sta.style.display = 'none';
}

function setCameraStatus(msg, mostrarBotao = false) {
  const sta = document.getElementById('cameraStatus');
  if (!sta) return;
  sta.style.display = 'flex';
  sta.style.flexDirection = 'column';
  sta.style.alignItems = 'center';
  sta.innerHTML = mostrarBotao
    ? `<span style="margin-bottom:10px">${msg}</span>
       <button class="btn-acao secundario" onclick="reconectarManual()">↻ Tentar novamente</button>`
    : `<div class="camera-spinner"></div><span>${msg}</span>`;

  const img = document.getElementById('cameraFeed');
  if (img) img.style.display = 'none';
}

function reconectarManual() {
  if (!expAtual) return;
  reconexoes = 0;
  setCameraStatus('Conectando à câmera...');
  _tentarConectarCamera(EXPERIMENTOS[expAtual].wsUrl);
}

// =====================================================================
// CONTROLES — TRILHO DE AR
// =====================================================================

function renderTrilho(container) {
  container.innerHTML = `
    <div class="controles-grid">
      <div class="controle-card">
        <label>Velocidade do Carrinho</label>
        <input type="range" min="0" max="100" value="50"
          oninput="this.nextElementSibling.textContent=this.value+'%'" />
        <div class="valor">50%</div>
      </div>
      <div class="controle-card">
        <label>Modo de Operação</label>
        <select>
          <option>MRU</option>
          <option>MRUV</option>
          <option>Colisão</option>
        </select>
      </div>
      <div class="controle-card">
        <label>Posição Inicial (cm)</label>
        <input type="range" min="0" max="200" value="0"
          oninput="this.nextElementSibling.textContent=this.value+'cm'" />
        <div class="valor">0cm</div>
      </div>
    </div>
    <div class="acoes-grid">
      <button class="btn-acao primario" onclick="log('Experimento iniciado')">▶ Iniciar</button>
      <button class="btn-acao secundario" onclick="log('Experimento pausado')">⏸ Pausar</button>
      <button class="btn-acao perigo" onclick="log('Experimento resetado')">↺ Resetar</button>
    </div>
    <div class="log-box" id="logBox">Sistema pronto...<br/></div>
  `;
}

// =====================================================================
// CONTROLES — ANEL DE THOMSON
// =====================================================================

function renderThomson(container) {
  container.innerHTML = `
    <div class="controles-grid">
      <div class="controle-card">
        <label>Corrente (A)</label>
        <input type="range" min="0" max="10" step="0.1" value="0"
          oninput="this.nextElementSibling.textContent=parseFloat(this.value).toFixed(1)+'A'" />
        <div class="valor">0.0A</div>
      </div>
      <div class="controle-card">
        <label>Tensão (V)</label>
        <input type="range" min="0" max="220" step="1" value="0"
          oninput="this.nextElementSibling.textContent=this.value+'V'" />
        <div class="valor">0V</div>
      </div>
      <div class="controle-card">
        <label>Frequência (Hz)</label>
        <input type="range" min="0" max="60" step="1" value="50"
          oninput="this.nextElementSibling.textContent=this.value+'Hz'" />
        <div class="valor">50Hz</div>
      </div>
      <div class="controle-card">
        <label>Modo</label>
        <select>
          <option>Indução</option>
          <option>Repulsão</option>
          <option>Manual</option>
        </select>
      </div>
    </div>
    <div class="acoes-grid">
      <button class="btn-acao primario" onclick="log('Corrente aplicada')">⚡ Aplicar Corrente</button>
      <button class="btn-acao secundario" onclick="log('Medição registrada')">📊 Medir</button>
      <button class="btn-acao perigo" onclick="log('Sistema desligado')">🔴 Desligar</button>
    </div>
    <div class="log-box" id="logBox">Sistema pronto...<br/></div>
  `;
}

// =====================================================================
// CONTROLES — TITULAÇÃO
// =====================================================================

function renderTitulacao(container) {
  container.innerHTML = `
    <div class="controles-grid">
      <div class="controle-card">
        <label>Volume HCl (mL)</label>
        <input type="range" min="0" max="50" step="0.5" value="25"
          oninput="this.nextElementSibling.textContent=this.value+'mL'" />
        <div class="valor">25mL</div>
      </div>
      <div class="controle-card">
        <label>Concentração NaOH (mol/L)</label>
        <input type="range" min="0.01" max="2" step="0.01" value="0.1"
          oninput="this.nextElementSibling.textContent=parseFloat(this.value).toFixed(2)+'M'" />
        <div class="valor">0.10M</div>
      </div>
      <div class="controle-card">
        <label>Velocidade de Gotejamento</label>
        <select>
          <option>Lento</option>
          <option>Médio</option>
          <option>Rápido</option>
        </select>
      </div>
      <div class="controle-card">
        <label>pH Atual</label>
        <div class="valor" id="phAtual">7.00</div>
      </div>
    </div>
    <div class="acoes-grid">
      <button class="btn-acao primario" onclick="iniciarTitulacao()">▶ Iniciar Titulação</button>
      <button class="btn-acao secundario" onclick="log('Ponto de equivalência marcado')">📍 Marcar Ponto</button>
      <button class="btn-acao perigo" onclick="log('Titulação reiniciada')">↺ Reiniciar</button>
    </div>
    <div class="log-box" id="logBox">Sistema pronto...<br/></div>
  `;
}

function iniciarTitulacao() {
  log('Titulação iniciada...');
  let ph = 2.0;
  const intervalo = setInterval(() => {
    ph += 0.15 + Math.random() * 0.1;
    const el = document.getElementById('phAtual');
    if (el) el.textContent = ph.toFixed(2);
    log(`pH = ${ph.toFixed(2)}`);
    if (ph >= 12) {
      clearInterval(intervalo);
      log('Ponto de equivalência atingido!');
    }
  }, 800);
}

// =====================================================================
// LOG
// =====================================================================

function log(msg) {
  const box = document.getElementById('logBox');
  if (!box) return;
  const time = new Date().toLocaleTimeString('pt-BR');
  box.innerHTML += `<span style="color:#b0c4de">[${time}]</span> ${msg}<br/>`;
  box.scrollTop = box.scrollHeight;
}