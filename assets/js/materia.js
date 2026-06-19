// ============================================================
// OMNIS — materia.js
// Página de uma matéria específica (ex: Física > Mecânica) com
// 5 abas: Introdução, Módulos, Videoaulas, Fórmulas, Exercícios.
//
// Todo o conteúdo é buscado em tempo real do repositório
// OMNIS-ACADEMY no GitHub — esta página não tem conteúdo fixo.
// ============================================================

(function () {
  'use strict';

  const REPO = 'https://raw.githubusercontent.com/labremotodeivid-coder/OMNIS-ACADEMY/main';

  // --------------------------------------------------------
  // Parâmetros recebidos via URL (definidos por teoria.js ao
  // navegar para esta página)
  // --------------------------------------------------------
  const params  = new URLSearchParams(window.location.search);
  const MATERIA = params.get('materia') || 'Física';
  const TOPICO  = params.get('topico')  || 'Mecânica';
  const PASTA   = params.get('pasta')   || TOPICO; // nome da pasta no GitHub (pode diferir do título exibido)
  const COR     = params.get('cor')     || '#42A5F5';
  const ICONE   = params.get('icone')   || '⚛️';
  const CAPA    = params.get('capa')    || ''; // imagem de capa do tópico, usada como banner do header

  // Cache simples em memória: evita refazer fetch/parse ao
  // alternar de volta para uma aba já visitada nesta sessão.
  const cache = {};

  const elConteudo = document.getElementById('abaConteudo');

  /**
   * Monta a URL de um arquivo dentro da pasta da matéria/tópico atual.
   * Usa PASTA (nome real da pasta no GitHub) em vez de TOPICO (título
   * exibido na tela) — os dois podem ser diferentes, ex: título
   * "Mecânica Quântica" mas pasta "Quântica".
   */
  function path(pasta, arquivo) {
    return `${REPO}/${encodeURIComponent(MATERIA)}/${encodeURIComponent(PASTA)}/${pasta}/${arquivo}`;
  }

  // --------------------------------------------------------
  // Inicialização
  // --------------------------------------------------------
  document.addEventListener('DOMContentLoaded', inicializar);

  function inicializar() {
    preencherHeader();
    ligarEventosDeAba();
    ligarBotaoVoltar();
    mostrarAba('introducao');
  }

  function preencherHeader() {
    document.getElementById('materiaNome').textContent       = MATERIA;
    document.getElementById('materiaIcone').textContent      = ICONE;
    document.getElementById('materiaTopicoNome').textContent = TOPICO;

    const header = document.getElementById('materiaHeader');
    header.style.setProperty('--cor-materia', COR);

    // Banner de capa é opcional — se a URL não trouxe uma imagem,
    // o header cai de volta no fundo de gradiente padrão (definido
    // em materia.css), sem deixar um espaço vazio ou erro de imagem.
    if (CAPA) {
      header.style.setProperty('--imagem-capa', `url('${CAPA}')`);
      header.classList.add('materia-header--com-capa');
    }

    document.querySelectorAll('.aba-btn').forEach((botao) => {
      botao.style.setProperty('--cor-materia', COR);
    });

    document.title = `OMNIS - ${TOPICO}`;
  }

  function ligarBotaoVoltar() {
    document.getElementById('btnVoltar').addEventListener('click', () => {
      window.OmnisUI.navegarComTransicao('teoria.html');
    });
  }

  function ligarEventosDeAba() {
    document.querySelectorAll('.aba-btn').forEach((botao) => {
      botao.addEventListener('click', () => mostrarAba(botao.dataset.aba, botao));
    });
  }

  // --------------------------------------------------------
  // Roteamento entre abas
  // --------------------------------------------------------

  const CARREGADORES_POR_ABA = {
    introducao: carregarIntroducao,
    modulos:    carregarModulos,
    videoaulas: carregarVideoaulas,
    formulas:   carregarFormulas,
    exercicios: carregarExercicios,
  };

  function mostrarAba(aba, botaoClicado) {
    document.querySelectorAll('.aba-btn').forEach((b) => b.classList.remove('ativo'));

    // Se a função foi chamada por um clique, marca o próprio botão;
    // se foi chamada programaticamente (ex: estado inicial), encontra
    // o botão correspondente por data-aba.
    const botaoAtivo = botaoClicado || document.querySelector(`[data-aba="${aba}"]`);
    botaoAtivo?.classList.add('ativo');

    mostrarLoading();

    const carregar = CARREGADORES_POR_ABA[aba];
    if (carregar) carregar();
  }

  // --------------------------------------------------------
  // ABA: Introdução
  // Pasta no GitHub é "introdução" (com ç) — daí o %C3%A7%C3%A3o
  // hardcoded, já que encodeURIComponent não ajuda dentro de uma
  // string que já é literal.
  // --------------------------------------------------------
  async function carregarIntroducao() {
    const md = await fetchMd(path('introdu%C3%A7%C3%A3o', 'intro.md'));
    if (!md) return mostrarErro('Introdução não encontrada.');

    elConteudo.innerHTML = `<div class="conteudo-md">${renderMd(md)}</div>`;
    renderizarFormulasLatex();
  }

  // --------------------------------------------------------
  // ABA: Módulos (capítulos de teoria, cada um com subtópicos)
  //
  // Estrutura no GitHub: teoria/Cap1/subt1.md, teoria/Cap1/subt2.md,
  // teoria/Cap2/subt1.md... Não há como "listar" uma pasta via
  // raw.githubusercontent.com, então a existência de cada capítulo/
  // subtópico é descoberta tentando buscar subt1, subt2... até
  // receber 404 — mesma técnica usada nos outros loops numerados
  // deste arquivo (ver carregarSequenciaNumerada).
  // --------------------------------------------------------
  async function carregarModulos() {
    const capitulos = await descobrirCapitulosComSubtopicos();
    if (capitulos.length === 0) return mostrarErro('Nenhum módulo encontrado.');

    cache.capitulos = capitulos;
    elConteudo.innerHTML = renderizarListaDeItens(capitulos, 'Cap', 'Clique para ver os tópicos →');
    ligarCliquesNaLista('.modulo-card', capitulos, abrirCapitulo);
  }

  /**
   * Descobre quais capítulos existem e, para cada um, quantos
   * subtópicos ele tem — sem nunca carregar o conteúdo (.md) em si,
   * só confirmando existência. O conteúdo de cada subtópico só é
   * buscado quando o usuário efetivamente clica nele.
   *
   * Os títulos exibidos para cada capítulo vêm de teoria/capitulos.json
   * (ex: {"numero": 1, "titulo": "Princípios da Mecânica Quântica"}).
   * Se esse arquivo não existir ou não tiver entrada para um capítulo,
   * cai no fallback "Capítulo N".
   */
  async function descobrirCapitulosComSubtopicos() {
    const tituloPorNumero = await carregarTitulosDosCapitulos();
    const capitulos = [];

    for (let numCap = 1; numCap <= 10; numCap++) {
      const primeiroSubt = await fetchMd(path(`teoria/Cap${numCap}`, 'subt1.md'));
      if (!primeiroSubt) break; // capítulo Cap{numCap} não existe — para a busca

      const subtopicos = [{ numero: 1, conteudo: primeiroSubt, titulo: extrairTitulo(primeiroSubt) }];

      for (let numSubt = 2; numSubt <= 20; numSubt++) {
        const md = await fetchMd(path(`teoria/Cap${numCap}`, `subt${numSubt}.md`));
        if (!md) break;
        subtopicos.push({ numero: numSubt, conteudo: md, titulo: extrairTitulo(md) });
      }

      capitulos.push({
        numero: numCap,
        titulo: tituloPorNumero[numCap] || `Capítulo ${numCap}`,
        subtopicos,
      });
    }

    return capitulos;
  }

  /**
   * Busca teoria/capitulos.json e retorna um mapa { numero: titulo }
   * para lookup rápido. Retorna objeto vazio se o arquivo não existir
   * — assim capítulos sem entrada no JSON simplesmente usam o
   * fallback "Capítulo N" em vez de quebrar a página.
   */
  async function carregarTitulosDosCapitulos() {
    const dados = await fetchJson(path('teoria', 'capitulos.json'));
    if (!dados?.capitulos) return {};

    const mapa = {};
    dados.capitulos.forEach((c) => { mapa[c.numero] = c.titulo; });
    return mapa;
  }

  /** Mostra a lista de subtópicos de um capítulo (2º nível da hierarquia). */
  function abrirCapitulo(capitulo) {
    cache.capituloAtual = capitulo;

    elConteudo.innerHTML = `
      <div class="modulo-aberto">
        <button class="btn-voltar-modulo" id="btnVoltarModulos">← Voltar aos módulos</button>
        <h2 class="subtopicos-titulo">${escapeHtml(capitulo.titulo)}</h2>
        ${renderizarListaDeItens(capitulo.subtopicos, 'A', 'Clique para ler →')}
      </div>
    `;

    document.getElementById('btnVoltarModulos').addEventListener('click', carregarModulos);
    ligarCliquesNaLista('.modulo-card', capitulo.subtopicos, abrirSubtopico);
  }

  /** Mostra o conteúdo de um subtópico específico (3º nível da hierarquia). */
  function abrirSubtopico(subtopico) {
    const capitulo = cache.capituloAtual;

    elConteudo.innerHTML = `
      <div class="modulo-aberto">
        <button class="btn-voltar-modulo" id="btnVoltarSubtopicos">← Voltar a ${escapeHtml(capitulo.titulo)}</button>
        <div class="conteudo-md">${renderMd(subtopico.conteudo)}</div>
      </div>
    `;

    document.getElementById('btnVoltarSubtopicos').addEventListener('click', () => abrirCapitulo(capitulo));
    renderizarFormulasLatex();
  }

  // --------------------------------------------------------
  // ABA: Videoaulas
  // --------------------------------------------------------
  async function carregarVideoaulas() {
    const dados = await fetchJson(path('videoaulas', 'videos.json'));
    if (!dados) return mostrarErro('Videoaulas não encontradas.');

    const videos = dados.videoaulas || [];
    cache.videos = videos;

    elConteudo.innerHTML = `
      <div class="videos-grid">
        ${videos.map((v, i) => renderizarCardDeVideo(v, i)).join('')}
      </div>
    `;

    elConteudo.querySelectorAll('.video-card').forEach((card) => {
      card.addEventListener('click', () => abrirVideo(videos[Number(card.dataset.indice)]));
    });
  }

  function renderizarCardDeVideo(video, indice) {
    return `
      <div class="video-card" data-indice="${indice}">
        <div class="video-thumb">
          <img src="https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg" alt="${escapeHtml(video.titulo)}" />
          <div class="video-play">▶</div>
          <span class="video-duracao">${video.duracao}</span>
        </div>
        <div class="video-info">
          <h3>${escapeHtml(video.titulo)}</h3>
          <p>${escapeHtml(video.descricao)}</p>
          <span class="video-nivel" style="background:${COR}">${escapeHtml(video.nivel)}</span>
        </div>
      </div>
    `;
  }

  function abrirVideo(video) {
    elConteudo.innerHTML = `
      <div class="video-player-container">
        <button class="btn-voltar-modulo" id="btnVoltarVideos">← Voltar às videoaulas</button>
        <h2 class="video-player-titulo">${escapeHtml(video.titulo)}</h2>
        <div class="video-player-wrapper">
          <iframe
            src="https://www.youtube.com/embed/${video.youtube_id}?autoplay=1"
            title="${escapeHtml(video.titulo)}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      </div>
    `;
    document.getElementById('btnVoltarVideos').addEventListener('click', carregarVideoaulas);
  }

  // --------------------------------------------------------
  // ABA: Fórmulas
  // --------------------------------------------------------
  async function carregarFormulas() {
    const md = await fetchMd(path('formulas', 'formulas.md'));
    if (!md) return mostrarErro('Fórmulas não encontradas.');

    elConteudo.innerHTML = `<div class="conteudo-md formulas-conteudo">${renderMd(md)}</div>`;
    renderizarFormulasLatex();
  }

  // --------------------------------------------------------
  // ABA: Exercícios
  // --------------------------------------------------------
  async function carregarExercicios() {
    const exercicios = await carregarSequenciaNumerada('exercicios', 'ex');
    if (exercicios.length === 0) return mostrarErro('Exercícios não encontrados.');

    cache.exercicios = exercicios;
    elConteudo.innerHTML = renderizarListaDeItens(exercicios, 'Ex', 'Clique para resolver →');
    ligarCliquesNaLista('.modulo-card', exercicios, abrirExercicio);
  }

  function abrirExercicio(exercicio) {
    elConteudo.innerHTML = `
      <div class="modulo-aberto">
        <button class="btn-voltar-modulo" id="btnVoltarExercicios">← Voltar aos exercícios</button>
        <div class="conteudo-md exercicios-conteudo">${renderMd(exercicio.conteudo)}</div>
      </div>
    `;
    document.getElementById('btnVoltarExercicios').addEventListener('click', carregarExercicios);
    renderizarFormulasLatex();
  }

  // --------------------------------------------------------
  // Helpers compartilhados entre Módulos e Exercícios
  // (mesmo padrão: arquivos numerados Cap1.md, Cap2.md... ou
  // ex1.md, ex2.md..., busca sequencial até a 1ª falha)
  // --------------------------------------------------------

  /**
   * Busca arquivos numerados sequencialmente (ex: Cap1.md, Cap2.md...)
   * dentro de `pasta`, parando no primeiro número que não existir.
   * Limite de 10 é uma salvaguarda — nenhum tópico tem mais que isso
   * hoje, e evita loop indefinido se o GitHub responder de forma
   * inesperada para todos os números.
   */
  async function carregarSequenciaNumerada(pasta, prefixoArquivo) {
    const itens = [];
    for (let numero = 1; numero <= 10; numero++) {
      const md = await fetchMd(path(pasta, `${prefixoArquivo}${numero}.md`));
      if (!md) break;
      itens.push({ numero, conteudo: md, titulo: extrairTitulo(md) });
    }
    return itens;
  }

  function renderizarListaDeItens(itens, rotuloPrefixo, textoAcao) {
    return `
      <div class="modulos-lista">
        ${itens.map((item) => `
          <div class="modulo-card" data-numero="${item.numero}">
            <div class="modulo-num" style="background:${COR}">${rotuloPrefixo} ${item.numero}</div>
            <div class="modulo-info">
              <h3>${escapeHtml(item.titulo)}</h3>
              <span>${textoAcao}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function ligarCliquesNaLista(seletor, itens, aoClicar) {
    elConteudo.querySelectorAll(seletor).forEach((card) => {
      card.addEventListener('click', () => {
        const item = itens.find((i) => i.numero === Number(card.dataset.numero));
        if (item) aoClicar(item);
      });
    });
  }

  // --------------------------------------------------------
  // Fetch com cache + tratamento de erro
  // --------------------------------------------------------

  async function fetchMd(url) {
    return fetchComCache(url, (res) => res.text());
  }

  async function fetchJson(url) {
    return fetchComCache(url, (res) => res.json());
  }

  async function fetchComCache(url, parser) {
    if (cache[url]) return cache[url];
    try {
      const res = await fetch(url);
      if (!res.ok) return null; // 404 é esperado (ex: Cap5.md não existe) — não é erro de verdade
      const dados = await parser(res);
      cache[url] = dados;
      return dados;
    } catch (_erro) {
      return null; // falha de rede — tratada como "conteúdo ausente" pela UI
    }
  }

  // --------------------------------------------------------
  // Estados de UI: loading / erro
  // --------------------------------------------------------

  function mostrarLoading() {
    elConteudo.innerHTML = `
      <div class="loading-box">
        <div class="loading-spinner"></div>
        <span>Carregando...</span>
      </div>
    `;
  }

  function mostrarErro(mensagem) {
    elConteudo.innerHTML = `<div class="erro-box"><span>⚠️ ${escapeHtml(mensagem)}</span></div>`;
  }

  // --------------------------------------------------------
  // Utilitários de texto
  // --------------------------------------------------------

  function extrairTitulo(md) {
    const match = md.match(/^#\s+(.+)/m);
    return match ? match[1] : 'Sem título';
  }

  /**
   * Escapa caracteres especiais de HTML antes de injetar texto vindo
   * de fontes externas (título/descrição de vídeo, título de
   * capítulo) — sem isso, um "&" ou "<" no .md quebraria o layout,
   * e em tese permitiria injetar HTML arbitrário.
   */
  function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
  }

  /** Dispara o MathJax só se ele já tiver terminado de carregar da CDN. */
  function renderizarFormulasLatex() {
    if (window.MathJax?.typesetPromise) MathJax.typesetPromise();
  }

  // --------------------------------------------------------
  // Renderizador de Markdown → HTML
  //
  // É uma cadeia de regex (não um parser real), então a ORDEM das
  // substituições importa: por exemplo, listas (<li>) precisam ser
  // agrupadas em <ul> ANTES de tabelas, e blocos de código (```)
  // precisam ser tratados antes do code inline (`), senão um come
  // o delimitador do outro.
  // --------------------------------------------------------
  function renderMd(md) {
    return md
      // Cabeçalhos
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
      .replace(/^# (.+)$/gm,   '<h1>$1</h1>')

      // Ênfase
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')

      // Bloco de código antes de code inline — caso contrário a regex
      // de crase simples capturaria as crases de abertura/fechamento
      // do bloco e quebraria o resultado.
      .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`(.+?)`/g, '<code>$1</code>')

      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

      // Gabarito (usado nos exercícios) — sintaxe HTML literal no .md
      .replace(
        /<details>\n<summary>(.+?)<\/summary>\n([\s\S]*?)<\/details>/g,
        '<details><summary>$1</summary><div class="gabarito">$2</div></details>'
      )

      // Tabelas: cada linha "| a | b |" vira uma <tr>; a linha
      // separadora "|---|---|" é descartada.
      .replace(/^\|(.+)\|$/gm, (linha) => {
        if (linha.includes('---')) return '';
        const celulas = linha.split('|').filter((c) => c.trim()).map((c) => `<td>${c.trim()}</td>`);
        return `<tr>${celulas.join('')}</tr>`;
      })
      .replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, (bloco) => `<table>${bloco}</table>`)

      // Listas — precisa vir depois das tabelas para não confundir
      // uma linha "- item" com conteúdo de tabela.
      .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (bloco) => `<ul>${bloco}</ul>`)

      .replace(/^---$/gm, '<hr/>')

      // Parágrafos: linhas em branco separam blocos; qualquer linha
      // que já comece com uma tag HTML (de uma substituição anterior)
      // é deixada como está, para não ficar envolta num <p> indevido.
      .replace(/\n\n+/g, '</p><p>')
      .replace(/^(?!<[a-z])(.+)$/gm, (linha) => (linha.startsWith('<') ? linha : `<p>${linha}</p>`))
      .replace(/<p><\/p>/g, '');
  }

})();