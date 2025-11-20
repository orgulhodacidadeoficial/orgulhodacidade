document.addEventListener('DOMContentLoaded', function () {
    const track = document.querySelector('.carousel-track');
    const nextButton = document.querySelector('.carousel-button.next');
    const prevButton = document.querySelector('.carousel-button.prev');
    const indicatorsContainer = document.querySelector('.carousel-indicators');

    // Configurável: número de slides visíveis (4 conforme solicitado)
    const VISIBLE = 5;
    let isAnimating = false;

    if (!track) return;

    // Transformar coleção em array dinâmico
    function slidesArray() {
        return Array.from(track.children);
    }

    const slides = slidesArray();
    const total = slides.length;

    // Se houver menos slides do que o visível, ajusta e desabilita navegação
    if (total <= 1) {
        if (nextButton) nextButton.style.display = 'none';
        if (prevButton) prevButton.style.display = 'none';
    }

    // Inicializa data-index e largura dos slides
    slides.forEach((slide, index) => {
        slide.dataset.index = index;
        const widthPercent = 100 / VISIBLE;
        slide.style.flex = `0 0 ${widthPercent}%`;
        slide.style.minWidth = `${widthPercent}%`;
    });

    // Cria indicadores (um por slide original) e gerencia clique
    if (indicatorsContainer) {
        for (let i = 0; i < total; i++) {
            const btn = document.createElement('button');
            btn.setAttribute('aria-label', `Slide ${i + 1}`);
            btn.addEventListener('click', () => goToIndex(i));
            indicatorsContainer.appendChild(btn);
        }
    }

    function updateIndicators() {
        if (!indicatorsContainer) return;
        const indicators = Array.from(indicatorsContainer.children);
        const firstIndex = parseInt(track.firstElementChild.dataset.index, 10);
        indicators.forEach((btn, i) => btn.classList.toggle('active', i === firstIndex));
    }

    // Avança um slide: anima para a esquerda, ao fim move o primeiro para o final e reseta
    function slideNext() {
        if (isAnimating) return;
        isAnimating = true;
        const widthPercent = 100 / VISIBLE;
        track.style.transition = 'transform 0.5s ease-in-out';
        track.style.transform = `translateX(-${widthPercent}%)`;

        function onNext() {
            track.removeEventListener('transitionend', onNext);
            // mover o primeiro elemento para o fim
            const first = track.firstElementChild;
            if (first) track.appendChild(first);
            // reset sem transição
            track.style.transition = 'none';
            track.style.transform = 'translateX(0)';
            // forçar reflow antes de permitir novas animações
            void track.offsetWidth;
            isAnimating = false;
            updateIndicators();
        }

        track.addEventListener('transitionend', onNext);
    }

    // Volta um slide: move o último para frente, posiciona com translate negativo e anima para 0
    function slidePrev() {
        if (isAnimating) return;
        isAnimating = true;
        const widthPercent = 100 / VISIBLE;
        const last = track.lastElementChild;
        if (last) track.insertBefore(last, track.firstElementChild);
        // posiciona à esquerda sem animação
        track.style.transition = 'none';
        track.style.transform = `translateX(-${widthPercent}%)`;
        // forçar reflow
        void track.offsetWidth;
        // anima para posição 0
        track.style.transition = 'transform 0.5s ease-in-out';
        track.style.transform = 'translateX(0)';

        function onPrev() {
            track.removeEventListener('transitionend', onPrev);
            // fim da animação
            track.style.transition = 'none';
            isAnimating = false;
            updateIndicators();
        }

        track.addEventListener('transitionend', onPrev);
    }

    // Vai direto para um índice: reorganiza DOM de forma instantânea (sem animação)
    function goToIndex(index) {
        if (index < 0 || index >= total) return;
        // move elementos do começo para o fim até que o primeiro tenha dataset.index == index
        while (parseInt(track.firstElementChild.dataset.index, 10) !== index) {
            track.appendChild(track.firstElementChild);
        }
        // reset transform e atualiza indicadores
        track.style.transition = 'none';
        track.style.transform = 'translateX(0)';
        updateIndicators();
    }

    // Eventos dos botões
    if (nextButton) nextButton.addEventListener('click', slideNext);
    if (prevButton) prevButton.addEventListener('click', slidePrev);

    // Suporte simples ao toque: swipe left/right
    let touchStartX = 0;
    track.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, {passive:true});
    track.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (dx < -30) slideNext();
        if (dx > 30) slidePrev();
    });

    // Autoplay
    let autoplay = setInterval(slideNext, 5000);
    track.addEventListener('mouseenter', () => clearInterval(autoplay));
    track.addEventListener('mouseleave', () => { autoplay = setInterval(slideNext, 5000); });

    // Inicializa indicadores
    updateIndicators();
});