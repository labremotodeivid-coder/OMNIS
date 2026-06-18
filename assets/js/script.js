// ============================================================
// OMNIS — script.js
// Comportamentos globais de UI compartilhados por todas as
// páginas do site (efeitos de navbar, etc).
// ============================================================

(function () {
  'use strict';

  const navbar = document.querySelector('.navbar');

  // Páginas sem navbar (ex: telas de overlay isoladas) não devem
  // quebrar o script — encerra cedo se o elemento não existir.
  if (!navbar) return;

  // Acima deste scroll, a navbar fica num tom mais escuro/opaco
  // para se destacar do conteúdo que passa por baixo dela.
  const LIMIAR_SCROLL = 50;

  /**
   * Aplica a cor de fundo correta na navbar de acordo com a posição
   * de scroll atual. Usa classList em vez de manipular `style`
   * diretamente — mantém a cor definida no CSS, fácil de tematizar.
   */
  function atualizarNavbarNoScroll() {
    navbar.classList.toggle('navbar--scrolled', window.scrollY > LIMIAR_SCROLL);
  }

  // `passive: true` informa ao navegador que este listener nunca
  // chama preventDefault() — permite que o scroll renderize sem
  // esperar o handler, evitando travamentos (jank) durante o gesto.
  window.addEventListener('scroll', atualizarNavbarNoScroll, { passive: true });

  // Garante o estado correto também ao recarregar a página já
  // rolada (ex: usuário volta com o histórico do navegador).
  atualizarNavbarNoScroll();

})();