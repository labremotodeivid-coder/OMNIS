// =====================================================================
// materia.js — Página de matéria com 5 abas
// Puxa conteúdo do repositório OMNIS-ACADEMY no GitHub
// =====================================================================

const REPO = 'https://raw.githubusercontent.com/labremotodeivid-coder/OMNIS-ACADEMY/main';

// Pega parâmetros da URL
const params  = new URLSearchParams(window.location.search);
const MATERIA = params.get('materia') || 'Física';
const TOPICO  = params.get('topico')  || 'Mecânica';
const COR     = params.get('cor')     || '#42A5F5';
const ICONE   = params.get('icone')   || '⚛️';

// Cache de conteúdo já carregado
const cache = {};

// Caminhos exatos conforme GitHub
function path(pasta, arquivo) {
  return `${REPO}/${encodeURIComponent(MATERIA)}/${encodeURIComponent(TOPICO)}/${pasta}/${arquivo}`;
}

// =====================================================================
// INIT — abre direto na introdução
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('materiaNome').textContent     = MATERIA;
  document.getElementById('materiaIcone').textContent    = ICONE;
  document.getElementById('materiaTopicoNome').textContent = TOPICO;
  document.getElementById('materiaHeader').style.setProperty('--cor-materia', COR);
  document.querySelectorAll('.aba-btn').forEach(btn => {
    btn.style.setProperty('--cor-materia', COR);
  });
  document.title = `OMNIS - ${TOPICO}`;

  // Abre direto na introdução
  mostrarAba('introducao');
});

// =====================================================================
// MOSTRAR ABA
// =====================================================================
function mostrarAba(aba, el) {
  document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('ativo'));
  if (el) el.classList.add('ativo');
  else {
    const btns = document.querySelectorAll('.aba-btn');
    const map  = ['introducao','modulos','videoaulas','formulas','exercicios'];
    const idx  = map.indexOf(aba);
    if (idx >= 0) btns[idx]?.classList.add('ativo');
  }

  mostrarLoading();

  switch (aba) {
    case 'introducao': carregarIntroducao(); break;
    case 'modulos':    carregarModulos();    break;
    case 'videoaulas': carregarVideoaulas(); break;
    case 'formulas':   carregarFormulas();   break;
    case 'exercicios': carregarExercicios(); break;
  }
}

// =====================================================================
// ABA 1 — INTRODUÇÃO
// introdução com ç minúsculo conforme GitHub
// =====================================================================
async function carregarIntroducao() {
  const url = path('introdu%C3%A7%C3%A3o', 'intro.md');
  const md  = await fetchMd(url);
  if (!md) { mostrarErro('Introdução não encontrada.'); return; }
  document.getElementById('abaConteudo').innerHTML = `
    <div class="conteudo-md">${renderMd(md)}</div>
  `;
}

// =====================================================================
// ABA 2 — MÓDULOS (teoria minúsculo)
// =====================================================================
async function carregarModulos() {
  const caps = [];
  for (let i = 1; i <= 10; i++) {
    const url = path('teoria', `Cap${i}.md`);
    const md  = await fetchMd(url);
    if (!md) break;
    caps.push({ numero: i, conteudo: md, titulo: extrairTitulo(md) });
  }
  if (caps.length === 0) { mostrarErro('Nenhum módulo encontrado.'); return; }
  cache.caps = caps;
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
}

async function abrirModulo(num) {
  const cap = (cache.caps || []).find(c => c.numero === num);
  if (!cap) return;
  document.getElementById('abaConteudo').innerHTML = `
    <div class="modulo-aberto">
      <button class="btn-voltar-modulo" onclick="carregarModulos()">← Voltar aos módulos</button>
      <div class="conteudo-md">${renderMd(cap.conteudo)}</div>
    </div>
  `;
}

// =====================================================================
// ABA 3 — VIDEOAULAS (videoaulas minúsculo)
// =====================================================================
async function carregarVideoaulas() {
  const url  = path('videoaulas', 'videos.json');
  const data = await fetchJson(url);
  if (!data) { mostrarErro('Videoaulas não encontradas.'); return; }
  const videos = data.videoaulas || [];
  document.getElementById('abaConteudo').innerHTML = `
    <div class="videos-grid">
      ${videos.map(v => `
        <div class="video-card" onclick="abrirVideo('${v.youtube_id}','${v.titulo}')">
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
// ABA 4 — FÓRMULAS (formulas sem acento)
// =====================================================================
async function carregarFormulas() {
  const url = path('formulas', 'formulas.md');
  const md  = await fetchMd(url);
  if (!md) { mostrarErro('Fórmulas não encontradas.'); return; }
  document.getElementById('abaConteudo').innerHTML = `
    <div class="conteudo-md formulas-conteudo">${renderMd(md)}</div>
  `;
}

// =====================================================================
// ABA 5 — EXERCÍCIOS (exercicios sem acento)
// =====================================================================
async function carregarExercicios() {
  const exercicios = [];
  for (let i = 1; i <= 10; i++) {
    const url = path('exercicios', `ex${i}.md`);
    const md  = await fetchMd(url);
    if (!md) break;
    exercicios.push({ numero: i, conteudo: md, titulo: extrairTitulo(md) });
  }
  if (exercicios.length === 0) { mostrarErro('Exercícios não encontrados.'); return; }
  cache.exercicios = exercicios;
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
}

async function abrirExercicio(num) {
  const ex = (cache.exercicios || []).find(e => e.numero === num);
  if (!ex) return;
  document.getElementById('abaConteudo').innerHTML = `
    <div class="modulo-aberto">
      <button class="btn-voltar-modulo" onclick="carregarExercicios()">← Voltar aos exercícios</button>
      <div class="conteudo-md exercicios-conteudo">${renderMd(ex.conteudo)}</div>
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
    <div class="erro-box"><span>⚠️ ${msg}</span></div>
  `;
}

// Renderizador de Markdown
function renderMd(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/<details>\n<summary>(.+?)<\/summary>\n([\s\S]*?)<\/details>/g,
      '<details><summary>$1</summary><div class="gabarito">$2</div></details>')
    .replace(/^\|(.+)\|$/gm, (match) => {
      if (match.includes('---')) return '';
      const cols = match.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cols}</tr>`;
    })
    .replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, m => `<table>${m}</table>`)
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/^---$/gm, '<hr/>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^(?!<[huptbcdl])(.+)$/gm, m => m.startsWith('<') ? m : `<p>${m}</p>`)
    .replace(/<p><\/p>/g, '');
}