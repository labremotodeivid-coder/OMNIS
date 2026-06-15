// =====================================================================
// teoria.js — Puxe dados do JSON no GitHub OMNIS-ACADEMY
// =====================================================================

const JSON_URL = 'https://raw.githubusercontent.com/labremotodeivid-coder/OMNIS-ACADEMY/main/teoria_lista.json';

let materias     = [];
let materiaAtiva = 0;

// ── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', carregarTeoria);

// =====================================================================
// CARREGAR JSON DO GITHUB
// =====================================================================
async function carregarTeoria() {
  try {
    const res  = await fetch(JSON_URL);
    const data = await res.json();
    materias   = data.materias;
    renderTabs();
    mostrarMateria(0);
  } catch (e) {
    document.getElementById('materiasTabs').innerHTML =
      '<p style="color:#f87171;text-align:center">Erro ao carregar conteúdo. Verifique sua conexão.</p>';
  }
}

// =====================================================================
// RENDER DAS ABAS
// =====================================================================
function renderTabs() {
  const tabs = document.getElementById('materiasTabs');
  tabs.innerHTML = materias.map((m, i) => `
    <button
      class="tab-btn ${i === 0 ? 'ativo' : ''}"
      onclick="mostrarMateria(${i})"
      id="tab-${i}"
      style="--cor-materia: ${m.cor}"
    >
      ${m.icone} ${m.nome}
    </button>
  `).join('');
}

// =====================================================================
// MOSTRAR TÓPICOS DA MATÉRIA
// =====================================================================
function mostrarMateria(idx) {
  materiaAtiva = idx;
  const materia = materias[idx];

  // Atualiza tabs
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('ativo', i === idx);
  });

  // Renderiza cards
  const container = document.getElementById('topicosContainer');
  container.innerHTML = `
    <div class="cards-teoria" id="cardsTeoria">
      ${materia.topicos.map(t => `
        <div class="card-teoria" onclick="abrirTopico('${t.link}')" style="--cor-materia: ${materia.cor}">
          <div class="card-teoria-img">
            <img src="${t.imagem}" alt="${t.titulo}"
              onerror="this.style.display='none';this.parentElement.classList.add('sem-imagem')" />
            <div class="card-teoria-overlay">
              <span>Ver conteúdo →</span>
            </div>
          </div>
          <div class="card-teoria-body">
            <h3>${t.titulo}</h3>
            <p>${t.descricao}</p>
            <a href="${t.link}" class="btn-card" onclick="event.stopPropagation()">Acessar</a>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Animação de entrada
  setTimeout(() => {
    document.getElementById('cardsTeoria')?.classList.add('visivel');
  }, 10);
}

// =====================================================================
// ABRIR TÓPICO
// =====================================================================
function abrirTopico(link) {
  if (!link || link === '#') return;
  window.location.href = link;
}