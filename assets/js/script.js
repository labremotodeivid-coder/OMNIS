// ============================================================
// OMNIS — script.js
// Comportamentos globais de UI compartilhados por todas as
// páginas do site: efeito de scroll na navbar, transição entre
// páginas e toggle do menu mobile.
//
// Exposto em window.OmnisUI para que páginas específicas (teoria,
// matéria, experimentos...) possam chamar `navegarComTransicao`
// sem duplicar a implementação.
// ============================================================

(function () {
  'use strict';

  // --------------------------------------------------------
  // Efeito de scroll na navbar
  // --------------------------------------------------------
  const navbar = document.querySelector('.navbar');

  if (navbar) {
    // Acima deste scroll, a navbar fica num tom mais escuro/opaco
    // para se destacar do conteúdo que passa por baixo dela.
    const LIMIAR_SCROLL = 50;

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
  }

  // --------------------------------------------------------
  // Transição de saída entre páginas
  // Usada tanto pelos links da navbar quanto por navegação
  // disparada via JS (ex: clique num card de matéria).
  // --------------------------------------------------------
  const DURACAO_TRANSICAO_MS = 400;

  /**
   * Navega para `destino` com um fade/slide de saída, em vez de
   * trocar de página instantaneamente.
   *
   * `destino` vazio, ausente ou "#" é ignorado — usado para links
   * placeholder (ex: "Entrar"/"Cadastrar" ainda sem rota definida).
   */
  function navegarComTransicao(destino) {
    if (!destino || destino === '#') return;

    document.body.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    document.body.style.opacity    = '0';
    document.body.style.transform  = 'translateY(-20px)';

    setTimeout(() => { window.location.href = destino; }, DURACAO_TRANSICAO_MS);
  }

  // --------------------------------------------------------
  // Menu mobile (hamburguer)
  // Liga automaticamente se os elementos existirem na página —
  // páginas sem navbar mobile simplesmente não fazem nada aqui.
  // --------------------------------------------------------
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const aberto = mobileMenu.classList.toggle('aberto');
      hamburger.setAttribute('aria-expanded', String(aberto));
    });

    // Um único listener delegado cobre a navbar desktop e o menu
    // mobile — evita duplicar a mesma lógica de transição nos dois.
    document
      .querySelectorAll('.nav-links a, .nav-mobile-menu a')
      .forEach((link) => {
        link.addEventListener('click', (event) => {
          mobileMenu.classList.remove('aberto');

          const href = link.getAttribute('href');
          if (href && href !== '#') {
            event.preventDefault();
            navegarComTransicao(href);
          }
        });
      });
  }

  // --------------------------------------------------------
  // API pública mínima para outras páginas (teoria.js, materia.js...)
  // --------------------------------------------------------
  window.OmnisUI = { navegarComTransicao };

})();