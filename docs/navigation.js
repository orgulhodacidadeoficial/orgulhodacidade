// Módulo de navegação mobile
(function(){
    function init() {
        const mobileMenu = document.querySelector('.mobile-menu');
        const nav = document.querySelector('.nav-links');

        if (mobileMenu && nav) {
            mobileMenu.addEventListener('click', () => {
                nav.classList.toggle('active');
                mobileMenu.classList.toggle('active');
            });

            // Fecha menu ao clicar fora
            document.addEventListener('click', (e) => {
                if (!nav.contains(e.target) && !mobileMenu.contains(e.target)) {
                    nav.classList.remove('active');
                    mobileMenu.classList.remove('active');
                }
            });

            // Fecha menu ao clicar em links
            nav.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    nav.classList.remove('active');
                    mobileMenu.classList.remove('active');
                });
            });
        }
    }

    // Expõe API pública
    window.Navigation = { init };
})();
