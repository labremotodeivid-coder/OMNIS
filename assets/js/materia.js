// =====================================================================
// materia.js — Página de matéria com 5 abas
// Puxa conteúdo do repositório OMNIS-ACADEMY no GitHub
// =====================================================================

const REPO = 'https://raw.githubusercontent.com/labremotodeivid-coder/OMNIS-ACADEMY/main';

// Pega parâmetros da URL: ?materia=Física&topico=Mecânica
const params   = new URLSearchParams(window.location.search);
const MATERIA  = params.get('materia')  || 'Física';
const TOPICO   = params.get('topico')   || 'Mecânica';
const COR      = params.get('cor')      || '#42A5F5';
const ICONE    = params.get('icone')    || '⚛️';

// Aba atual
let abaAtiva = 'introducao';

// Cache de conteúdo já carregado
const cache = {};

// =====================================================================
// INIT
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Atualiza header
  document.getElementById('materiaNome').textContent    = MATERIA;
  document.getElementById('materiaIcone').textContent   = ICONE;
  document.getElementById('materiaTopicoNome').textContent = TOPICO;
  document.getElementById('materiaHeader').style.setProperty('--cor-materia', COR);
  document.title = `OMNIS - ${TOPICO}`;

  // Aplica cor nos botões de aba
  document.querySelectorAll('.aba-btn').forEach(btn => {
    btn.style.setProperty('--cor-materia', COR);
  });

  // Carrega aba inicial
  mostrarAba('introducao');
});

// =====================================================================
// MOSTRAR ABA
// =====================================================================
async function mostrarAba(aba) {
  abaAtiva = aba;

  // Atualiza botões
  document.querySelectorAll('.aba-btn').forEach(btn => {
    btn.classList.remove('ativo');
  });
  event?.target?.classList.add('ativo');

  // Mostra loading
  mostrarLoading();

  // Carrega conteúdo
  switch (aba) {
    case 'introducao': await carregarIntroducao(); break;
    case 'modulos':    await carregarModulos();    break;
    case 'videoaulas': await carregarVideoaulas(); break;
    case 'formulas':   await carregarFormulas();   break;
    case 'exercicios': await carregarExercicios(); break;
  }
}

// =====================================================================
// ABA 1 — INTRODUÇÃO
// =====================================================================
async function carregarIntroducao() {
  const url = `${REPO}/${MATERIA}/${TOPICO}/Introdução/intro.md`;
  const md  = await fetchMd(url);
  if (!md) { mostrarErro('Introdução não encontrada.'); return; }

  document.getElementById('abaConteudo').innerHTML = `
    <div class="conteudo-md">
      ${renderMd(md)}
    </div>
  `;
}

// =====================================================================
// ABA 2 — MÓDULOS DE TEORIA
// =====================================================================
async function carregarModulos() {
  // Tenta carregar Cap1, Cap2, Cap3... até não encontrar
  const caps = [];
  for (let i = 1; i <= 10; i++) {
    const url = `${REPO}/${MATERIA}/${TOPICO}/Teoria/Cap${i}.md`;
    const md  = await fetchMd(url);
    if (!md) break;
    caps.push({ numero: i, conteudo: md, titulo: extrairTitulo(md) });
  }

  if (caps.length === 0) { mostrarErro('Nenhum módulo encontrado.'); return; }

  // Se nenhum cap aberto, mostra lista de cards
  document.getElementById('abaConteudo').innerHTML = `
    <div class="modulos-lista">
      ${caps.map(c => `
        <div class="modulo-card" onclick="abrirModulo(${c.numero})">
          <div class="modulo-num" style="background:${COR}">Cap ${c.numero}</div>
          <div class="modulo-info">
            <h3>${c.titulo}</h3>
            <span>Clique para ler →</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Salva caps no cache
  cache.caps = caps;
}

async function abrirModulo(num) {
  const caps = cache.caps || [];
  const cap  = caps.find(c => c.numero === num);
  if (!cap) return;

  document.getElementById('abaConteudo').innerHTML = `
    <div class="modulo-aberto">
      <button class="btn-voltar-modulo" onclick="carregarModulos()">← Voltar aos módulos</button>
      <div class="conteudo-md">
        ${renderMd(cap.conteudo)}
      </div>
    </div>
  `;
}

// =====================================================================
// ABA 3 — VIDEOAULAS
// =====================================================================
async function carregarVideoaulas() {
  const url  = `${REPO}/${MATERIA}/${TOPICO}/Videoaulas/videos.json`;
  const data = await fetchJson(url);
  if (!data) { mostrarErro('Videoaulas não encontradas.'); return; }

  const videos = data.videoaulas || [];

  document.getElementById('abaConteudo').innerHTML = `
    <div class="videos-grid">
      ${videos.map(v => `
        <div class="video-card" onclick="abrirVideo('${v.youtube_id}', '${v.titulo}')">
          <div class="video-thumb">
            <img src="https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg" alt="${v.titulo}" />
            <div class="video-play">▶</div>
            <span class="video-duracao">${v.duracao}</span>
          </div>
          <div class="video-info">
            <h3>${v.titulo}</h3>
            <p>${v.descricao}</p>
            <span class="video-nivel" style="background:${COR}">${v.nivel}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function abrirVideo(youtubeId, titulo) {
  document.getElementById('abaConteudo').innerHTML = `
    <div class="video-player-container">
      <button class="btn-voltar-modulo" onclick="carregarVideoaulas()">← Voltar às videoaulas</button>
      <h2 class="video-player-titulo">${titulo}</h2>
      <div class="video-player-wrapper">
        <iframe
          src="https://www.youtube.com/embed/${youtubeId}?autoplay=1"
          title="${titulo}"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen>
        </iframe>
      </div>
    </div>
  `;
}

// =====================================================================
// ABA 4 — FÓRMULAS
// =====================================================================
async function carregarFormulas() {
  const url = `${REPO}/${MATERIA}/${TOPICO}/Fórmulas/formulas.md`;
  const md  = await fetchMd(url);
  if (!md) { mostrarErro('Fórmulas não encontradas.'); return; }

  document.getElementById('abaConteudo').innerHTML = `
    <div class="conteudo-md formulas-conteudo">
      ${renderMd(md)}
    </div>
  `;
}

// =====================================================================
// ABA 5 — EXERCÍCIOS
// =====================================================================
async function carregarExercicios() {
  const exercicios = [];
  for (let i = 1; i <= 10; i++) {
    const url = `${REPO}/${MATERIA}/${TOPICO}/Exercícios/ex${i}.md`;
    const md  = await fetchMd(url);
    if (!md) break;
    exercicios.push({ numero: i, conteudo: md, titulo: extrairTitulo(md) });
  }

  if (exercicios.length === 0) { mostrarErro('Exercícios não encontrados.'); return; }

  document.getElementById('abaConteudo').innerHTML = `
    <div class="modulos-lista">
      ${exercicios.map(e => `
        <div class="modulo-card" onclick="abrirExercicio(${e.numero})">
          <div class="modulo-num" style="background:${COR}">Ex ${e.numero}</div>
          <div class="modulo-info">
            <h3>${e.titulo}</h3>
            <span>Clique para resolver →</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  cache.exercicios = exercicios;
}

async function abrirExercicio(num) {
  const exercicios = cache.exercicios || [];
  const ex         = exercicios.find(e => e.numero === num);
  if (!ex) return;

  document.getElementById('abaConteudo').innerHTML = `
    <div class="modulo-aberto">
      <button class="btn-voltar-modulo" onclick="carregarExercicios()">← Voltar aos exercícios</button>
      <div class="conteudo-md exercicios-conteudo">
        ${renderMd(ex.conteudo)}
      </div>
    </div>
  `;
}

// =====================================================================
// HELPERS
// =====================================================================
async function fetchMd(url) {
  if (cache[url]) return cache[url];
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    cache[url] = text;
    return text;
  } catch (_) { return null; }
}

async function fetchJson(url) {
  if (cache[url]) return cache[url];
  try {
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    cache[url] = data;
    return data;
  } catch (_) { return null; }
}

function extrairTitulo(md) {
  const match = md.match(/^#\s+(.+)/m);
  return match ? match[1] : 'Sem título';
}

function mostrarLoading() {
  document.getElementById('abaConteudo').innerHTML = `
    <div class="loading-box">
      <div class="loading-spinner"></div>
      <span>Carregando...</span>
    </div>
  `;
}

function mostrarErro(msg) {
  document.getElementById('abaConteudo').innerHTML = `
    <div class="erro-box">
      <span>⚠️ ${msg}</span>
    </div>
  `;
}

// Renderizador de Markdown simples
function renderMd(md) {
  return md
    // Títulos
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    // Negrito e itálico
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    // Código inline
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Bloco de código
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Details/summary (gabarito)
    .replace(/<details>\n<summary>(.+?)<\/summary>\n([\s\S]*?)<\/details>/g,
      '<details><summary>$1</summary><div class="gabarito">$2</div></details>')
    // Tabelas
    .replace(/^\|(.+)\|$/gm, (match) => {
      if (match.includes('---')) return '';
      const cols = match.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cols}</tr>`;
    })
    // Envolve linhas de tabela em <table>
    .replace(/(<tr>.*<\/tr>\n?)+/g, m => `<table>${m}</table>`)
    // Listas não ordenadas
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    // Listas ordenadas
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Linha horizontal
    .replace(/^---$/gm, '<hr/>')
    // Parágrafos
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[huptbcdl])(.+)$/gm, (m) => m.startsWith('<') ? m : `<p>${m}</p>`)
    // Limpa p vazios
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[huptbcdl])/g, '$1')
    .replace(/(<\/[huptbcdl][^>]*>)<\/p>/g, '$1');
}