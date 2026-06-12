// =====================================================================
// experimentos.js — OMNIS | Tela de Experimentos
// Fiel ao experimentos_screen.dart
// =====================================================================

const EXPERIMENTOS = [
  {
    id:        'trilho',
    titulo:    'Trilho de Ar',
    descricao: 'Estudo de MRU e Leis de Newton com carrinho em trilho de ar comprimido.',
    imagemUrl: 'https://raw.githubusercontent.com/labremotodeivid-coder/labremoto/main/experimentos_imagens/trilho-de-ar.jpg',
    serverUrl: 'https://trilhodear-panel.unifei.edu.br',
    pagina:    null,
  },
  {
    id:        'thomson',
    titulo:    'Anel de Thomson',
    descricao: 'Experimento sobre eletromagnetismo e indução magnética.',
    imagemUrl: 'https://raw.githubusercontent.com/labremotodeivid-coder/labremoto/main/experimentos_imagens/anel-de-thomson.jpg',
    serverUrl: 'https://aneldethomson-panel.unifei.edu.br',
    pagina:    'anel-de-thomson.html',
  },
  {
    id:        'titulacao',
    titulo:    'Titulação',
    descricao: 'Experimento de titulação ácido-base com HCl e NaOH.',
    imagemUrl: 'https://raw.githubusercontent.com/labremotodeivid-coder/labremoto/main/experimentos_imagens/titulacao.jpg',
    serverUrl: 'https://titulacao-panel.unifei.edu.br',
    pagina:    null,
  },
];

// ── Estado ────────────────────────────────────────────────────────────
let statusMap      = {};   // id → { ocupado, carregando, expiraEm }
let countdownItvs  = {};   // id → setInterval
let favoritos      = JSON.parse(localStorage.getItem('omnis_favoritos') || '[]');
let refreshItv     = null;
let contagemItv    = null;

// ── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderCards();
  atualizarFavoritos();
  fetchTodosStatus();

  // Atualiza status a cada 10s (igual ao Dart)
  refreshItv = setInterval(fetchTodosStatus, 10000);

  // Força rerender dos countdowns a cada 1s (igual ao _timerContagem Dart)
  contagemItv = setInterval(atualizarCountdowns, 1000);
});

// =====================================================================
// RENDER DOS CARDS
// =====================================================================
function renderCards() {
  const grid = document.getElementById('expGrid');
  grid.innerHTML = EXPERIMENTOS.map(exp => `
    <div class="exp-card" id="card-${exp.id}" onclick="abrirExperimento('${exp.id}')">
      <div class="exp-card-img">
        <img src="${exp.imagemUrl}" alt="${exp.titulo}"
             onerror="this.style.display='none';this.parentElement.classList.add('sem-imagem')" />
        ${exp.serverUrl ? `<div class="exp-badge carregando" id="badge-${exp.id}">
          <span class="badge-spinner"></span>
        </div>` : ''}
        <button class="exp-favorito" id="fav-${exp.id}"
          onclick="toggleFavorito(event,'${exp.id}')">☆</button>
      </div>
      <div class="exp-card-body">
        <h3>${exp.titulo}</h3>
        <p>${exp.descricao}</p>
        <div class="exp-tempo" id="tempo-${exp.id}" style="display:none">
          ⏱ Disponível em <span id="countdown-${exp.id}">--:--</span>
        </div>
        <div class="exp-card-footer">Ver experimento →</div>
      </div>
    </div>
  `).join('');
  atualizarFavoritos();
}

// =====================================================================
// STATUS — fiel ao _fetchStatus / _fetchStatusExperimento do Dart
// =====================================================================
async function fetchTodosStatus() {
  const btn = document.getElementById('btnRefresh');
  if (btn) btn.classList.add('girando');
  await Promise.all(EXPERIMENTOS.filter(e => e.serverUrl).map(fetchStatusExp));
  if (btn) btn.classList.remove('girando');
}

async function fetchStatusExp(exp) {
  try {
    const res = await fetch(`${exp.serverUrl}/session/status`, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const ocupado   = data.busy      || false;
      const restante  = data.remaining || 0;
      statusMap[exp.id] = {
        ocupado,
        carregando: false,
        expiraEm: ocupado ? Date.now() + restante * 1000 : null,
      };
      setBadge(exp.id);
      return;
    }
  } catch (_) {}
  // Falha de rede — remove spinner, mantém último status
  if (!statusMap[exp.id] || statusMap[exp.id].carregando) {
    statusMap[exp.id] = { ocupado: false, carregando: false, expiraEm: null };
    setBadge(exp.id);
  }
}

function setBadge(id) {
  const badge = document.getElementById(`badge-${id}`);
  const tempo = document.getElementById(`tempo-${id}`);
  const st    = statusMap[id];
  if (!badge || !st) return;

  if (st.carregando) {
    badge.className = 'exp-badge carregando';
    badge.innerHTML = '<span class="badge-spinner"></span>';
    return;
  }

  if (st.ocupado) {
    badge.className = 'exp-badge ocupado';
    badge.innerHTML = '🔒 OCUPADO';
    if (tempo) tempo.style.display = 'block';
  } else {
    badge.className = 'exp-badge disponivel';
    badge.innerHTML = '✔ DISPONÍVEL';
    if (tempo) tempo.style.display = 'none';
  }
}

// Atualiza os countdowns a cada 1s — igual ao _timerContagem Dart
function atualizarCountdowns() {
  EXPERIMENTOS.forEach(exp => {
    const st = statusMap[exp.id];
    if (!st || !st.ocupado || !st.expiraEm) return;
    const seg = Math.max(0, Math.floor((st.expiraEm - Date.now()) / 1000));
    const m   = String(Math.floor(seg / 60)).padStart(2, '0');
    const s   = String(seg % 60).padStart(2, '0');
    const el  = document.getElementById(`countdown-${exp.id}`);
    if (el) el.textContent = `${m}:${s}`;
    if (seg <= 0) fetchStatusExp(exp);
  });
}

// =====================================================================
// FAVORITOS
// =====================================================================
function toggleFavorito(e, id) {
  e.stopPropagation();
  favoritos = favoritos.includes(id)
    ? favoritos.filter(f => f !== id)
    : [...favoritos, id];
  localStorage.setItem('omnis_favoritos', JSON.stringify(favoritos));
  atualizarFavoritos();
}

function atualizarFavoritos() {
  EXPERIMENTOS.forEach(({ id }) => {
    const btn = document.getElementById(`fav-${id}`);
    if (!btn) return;
    btn.textContent = favoritos.includes(id) ? '★' : '☆';
    btn.classList.toggle('ativo', favoritos.includes(id));
  });
}

// =====================================================================
// ABRIR EXPERIMENTO — fiel ao _abrirExperimento Dart
// Se ocupado → verifica status fresco antes de navegar
// =====================================================================
async function abrirExperimento(id) {
  const exp = EXPERIMENTOS.find(e => e.id === id);
  if (!exp || !exp.serverUrl) return;

  const st = statusMap[id];
  if (st && st.ocupado) {
    await fetchStatusExp(exp);
    const atualizado = statusMap[id];
    if (atualizado && atualizado.ocupado) {
      const seg = Math.max(0, Math.floor((atualizado.expiraEm - Date.now()) / 1000));
      const m   = String(Math.floor(seg / 60)).padStart(2, '0');
      const s   = String(seg % 60).padStart(2, '0');
      mostrarToast(`Ocupado. Disponível em ${m}:${s}`);
      return;
    }
  }

  if (exp.pagina) {
    document.body.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    document.body.style.opacity    = '0';
    document.body.style.transform  = 'translateY(-20px)';
    setTimeout(() => { window.location.href = exp.pagina; }, 400);
  } else {
    mostrarToast('Página deste experimento em breve!');
  }
}

// =====================================================================
// TOAST (substitui SnackBar do Flutter)
// =====================================================================
function mostrarToast(msg) {
  let t = document.getElementById('omnis-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'omnis-toast';
    t.style.cssText = `
      position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
      background:rgba(220,38,38,0.92);color:#fff;padding:12px 24px;
      border-radius:10px;font-size:14px;font-weight:600;z-index:9999;
      transition:opacity 0.3s;pointer-events:none;`;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 3000);
}