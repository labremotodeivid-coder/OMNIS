// ===== OMNIS - script.js =====

// Efeito de scroll na navbar
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.style.background = 'rgba(8, 11, 21, 0.98)';
  } else {
    navbar.style.background = 'rgba(10, 14, 26, 0.95)';
  }
});