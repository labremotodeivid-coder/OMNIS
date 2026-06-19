// ============================================================
// OMNIS — teoria.js
// Busca a lista de matérias/tópicos em um JSON hospedado no
// repositório OMNIS-ACADEMY e renderiza as abas + cards.
//
// O conteúdo é editado direto no JSON (sem precisar tocar neste
// arquivo ou fazer deploy do site) — ver estrutura esperada em
// JSON_URL.
// ============================================================

(function () {
  'use strict';

  const JSON_URL = 'https://raw.githubusercontent.com/labremotodeivid-coder/OMNIS-ACADEMY/main/teoria_lista.json';

  const elTabs     = document.getElementById('materiasTabs');
  const elTopicos  = document.getElementById('topicosContainer');

  /** Lista de matérias carregada do JSON. Populada por carregarTeoria(). */
  let materias = [];

  // --------------------------------------------------------
  // Carregamento inicial
  // --------------------------------------------------------
  document.addEventListener('DOMContentLoaded', carregarTeoria);

  async function carregarTeoria() {
    try {
      const resposta = await fetch(JSON_URL);

      // fetch() só rejeita em falha de rede — uma resposta 404/500
      // chega aqui como "sucesso" com res.ok === false, então essa
      // checagem é necessária para não tentar parsear um erro como JSON.
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

      const dados = await resposta.json();
      materias = dados.materias;

      renderizarAbas();
      mostrarMateria(0);
    } catch (erro) {
      elTabs.innerHTML = '<p class="erro-carregamento">Erro ao carregar conteúdo. Verifique sua conexão.</p>';
    }
  }

  // --------------------------------------------------------
  // Renderização
  // --------------------------------------------------------

  function renderizarAbas() {
    elTabs.innerHTML = materias
      .map((materia, indice) => `
        <button
          class="tab-btn ${indice === 0 ? 'ativo' : ''}"
          style="--cor-materia: ${materia.cor}"
          data-indice="${indice}"
        >
          ${materia.icone} ${materia.nome}
        </button>
      `)
      .join('');

    // Delegação de evento única para todas as abas, em vez de um
    // onclick inline por botão — também evita reconstruir listeners
    // se as abas forem re-renderizadas no futuro.
    elTabs.querySelectorAll('.tab-btn').forEach((botao) => {
      botao.addEventListener('click', () => {
        mostrarMateria(Number(botao.dataset.indice));
      });
    });
  }

  function mostrarMateria(indice) {
    const materia = materias[indice];

    elTabs.querySelectorAll('.tab-btn').forEach((botao, i) => {
      botao.classList.toggle('ativo', i === indice);
    });

    elTopicos.innerHTML = `
      <div class="cards-teoria" id="cardsTeoria">
        ${materia.topicos.map((topico) => renderizarCard(materia, topico)).join('')}
      </div>
    `;

    // Liga os cliques via JS (não onclick inline) — assim os dados
    // do tópico não precisam ser serializados dentro de atributos
    // HTML, o que evitaria problemas com aspas/acentos em títulos.
    ligarCliquesDosCards(materia);

    // Pequeno delay antes de adicionar a classe que dispara a
    // transição de fade-in via CSS (ver .cards-teoria.visivel).
    requestAnimationFrame(() => {
      document.getElementById('cardsTeoria')?.classList.add('visivel');
    });
  }

  function renderizarCard(materia, topico) {
    return `
      <div class="card-teoria" style="--cor-materia: ${materia.cor}" data-topico-id="${topico.id}">
        <div class="card-teoria-img">
          <img
            src="${topico.imagem}"
            alt="${topico.titulo}"
            onerror="this.style.display='none'; this.parentElement.classList.add('sem-imagem')"
          />
          <div class="card-teoria-overlay">
            <span>Ver conteúdo →</span>
          </div>
        </div>
        <div class="card-teoria-body">
          <h3>${topico.titulo}</h3>
          <p>${topico.descricao}</p>
          <a class="btn-card" data-topico-id="${topico.id}">Acessar</a>
        </div>
      </div>
    `;
  }

  /**
   * Liga o clique do card inteiro e do botão "Acessar" à navegação
   * para materia.html, usando os dados de `materia` (já em memória)
   * em vez de reconstruí-los a partir de atributos HTML.
   */
  function ligarCliquesDosCards(materia) {
    const irParaTopico = (topicoId) => {
      const topico = materia.topicos.find((t) => t.id === topicoId);
      if (topico) abrirTopico(materia, topico);
    };

    elTopicos.querySelectorAll('.card-teoria').forEach((card) => {
      card.addEventListener('click', () => irParaTopico(card.dataset.topicoId));
    });

    // O botão "Acessar" fica dentro do card clicável — precisa
    // impedir a propagação para não disparar o clique do card pai
    // junto, o que abriria a navegação duas vezes em sequência.
    elTopicos.querySelectorAll('.btn-card').forEach((botao) => {
      botao.addEventListener('click', (evento) => {
        evento.stopPropagation();
        irParaTopico(botao.dataset.topicoId);
      });
    });
  }

  // --------------------------------------------------------
  // Navegação para a página de matéria
  // --------------------------------------------------------

  function abrirTopico(materia, topico) {
    const params = new URLSearchParams({
      materia: materia.nome,
      topico:  topico.titulo,
      cor:     materia.cor,
      icone:   materia.icone,
      capa:    topico.imagem, // mesma imagem já usada no card da listagem — reaproveitada como banner do header
    });

    window.OmnisUI.navegarComTransicao(`materia.html?${params.toString()}`);
  }

})();