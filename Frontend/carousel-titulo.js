// Consolidated carousel script with admin/upload integrated
document.addEventListener('DOMContentLoaded', function () {
    const carousel = document.querySelector('.carousel-titulo');
    if (!carousel) return;

    // Wrap existing slides in an inner flex container
    const inner = document.createElement('div');
    inner.className = 'carousel-titulo-inner';
    const existingSlides = Array.from(carousel.querySelectorAll('.carousel-titulo-slide'));
    existingSlides.forEach(s => inner.appendChild(s));
    // ensure any existing slide images show full image (no crop)
    existingSlides.forEach(s => {
        const im = s.querySelector('img');
        if (im) {
            im.style.maxWidth = '100%';
            im.style.maxHeight = '100%';
            im.style.width = 'auto';
            im.style.height = 'auto';
            im.style.objectFit = 'contain';
        }
    });
    carousel.appendChild(inner);

    let slides = inner.querySelectorAll('.carousel-titulo-slide');
    let totalSlides = slides.length;
    let currentSlide = 0;
    let autoplayInterval = null;
    let lastSyncHash = '';
    let isUploading = false;

    function updateSlidesReference() {
        slides = inner.querySelectorAll('.carousel-titulo-slide');
        totalSlides = slides.length;
    }

    // Navigation buttons
    const prevButton = document.createElement('button');
    prevButton.className = 'carousel-titulo-nav prev';
    prevButton.type = 'button';
    prevButton.setAttribute('aria-label', 'Anterior');
    prevButton.innerHTML = '&#10094;';

    const nextButton = document.createElement('button');
    nextButton.className = 'carousel-titulo-nav next';
    nextButton.type = 'button';
    nextButton.setAttribute('aria-label', 'Próxima');
    nextButton.innerHTML = '&#10095;';

    carousel.appendChild(prevButton);
    carousel.appendChild(nextButton);

    // Indicators
    const indicators = document.createElement('div');
    indicators.className = 'carousel-titulo-indicators';
    carousel.appendChild(indicators);

    function renderIndicators() {
        indicators.innerHTML = '';
        for (let i = 0; i < totalSlides; i++) {
            const dot = document.createElement('button');
            dot.className = 'carousel-titulo-dot';
            dot.type = 'button';
            dot.setAttribute('aria-label', `Ir para slide ${i + 1}`);
            if (i === currentSlide) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(i));
            indicators.appendChild(dot);
        }
    }

    function goToSlide(n) {
        updateSlidesReference();
        if (totalSlides === 0) return;
        const dots = indicators.querySelectorAll('.carousel-titulo-dot');
        if (slides[currentSlide]) slides[currentSlide].classList.remove('active');
        if (dots[currentSlide]) dots[currentSlide].classList.remove('active');

        currentSlide = n;
        if (currentSlide >= totalSlides) currentSlide = 0;
        if (currentSlide < 0) currentSlide = totalSlides - 1;

        if (slides[currentSlide]) slides[currentSlide].classList.add('active');
        if (dots[currentSlide]) dots[currentSlide].classList.add('active');
        inner.style.transform = `translateX(-${currentSlide * 100}%)`;
    }

    function nextSlide() { goToSlide(currentSlide + 1); }
    function prevSlide() { goToSlide(currentSlide - 1); }

    prevButton.addEventListener('click', () => { prevSlide(); resetAutoplay(); });
    nextButton.addEventListener('click', () => { nextSlide(); resetAutoplay(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { prevSlide(); resetAutoplay(); }
        if (e.key === 'ArrowRight') { nextSlide(); resetAutoplay(); }
    });

    function startAutoplay() { clearInterval(autoplayInterval); autoplayInterval = setInterval(nextSlide, 5000); }
    function resetAutoplay() { startAutoplay(); }
    startAutoplay();

    // ===== Optimistic admin helpers (add/replace/remove temp slides) =====
    function addSlideToCarousel(imageSrc, imageAlt, tempId) {
        const slide = document.createElement('div');
        slide.className = 'carousel-titulo-slide';
        if (tempId) slide.dataset.tempId = tempId;

        const img = document.createElement('img');
        img.src = imageSrc.replace(/\\/g, '/');
        img.alt = imageAlt || 'Banner';
        // inline styles to prevent global CSS from forcing cover/crop
        img.style.maxWidth = '100%'; img.style.maxHeight = '100%'; img.style.width = 'auto'; img.style.height = 'auto'; img.style.objectFit = 'contain';
        slide.appendChild(img);
        attachSizeBadge(slide, img);

        // Add at the end but before any existing temp slides
        const firstTemp = inner.querySelector('[data-temp-id]');
        if (firstTemp) inner.insertBefore(slide, firstTemp);
        else inner.appendChild(slide);

        updateSlidesReference();
        renderIndicators();
        currentSlide = 0; goToSlide(0);
    }

    function replaceTemporarySlide(tempId, realSrc, realAlt) {
        const tempSlide = inner.querySelector(`[data-temp-id="${tempId}"]`);
        if (!tempSlide) return;
        const img = tempSlide.querySelector('img');
        if (img) {
            img.src = realSrc.replace(/\\/g, '/');
            img.alt = realAlt || img.alt || 'Banner';
            img.style.maxWidth = '100%'; img.style.maxHeight = '100%'; img.style.width = 'auto'; img.style.height = 'auto'; img.style.objectFit = 'contain';
        }
        attachSizeBadge(tempSlide, tempSlide.querySelector('img'));
        delete tempSlide.dataset.tempId;
    }

    function removeTemporarySlide(tempId) {
        const tempSlide = inner.querySelector(`[data-temp-id="${tempId}"]`);
        if (tempSlide) { tempSlide.remove(); updateSlidesReference(); renderIndicators(); if (totalSlides > 0) { currentSlide = Math.min(currentSlide, totalSlides - 1); goToSlide(currentSlide); } }
    }

    // Remove slide and notify server
    // Accepts either an index or the slide element itself
    async function removeSlideFromCarousel(target) {
        updateSlidesReference();
        let slide;
        if (typeof target === 'number') {
            const index = target;
            if (index < 0 || index >= totalSlides) return;
            slide = slides[index];
        } else if (target instanceof Element) {
            slide = target;
        } else {
            return;
        }

        const imgEl = slide.querySelector('img');
        const imgSrc = imgEl?.src || '';
        // compute a relative src that matches photos.json entries (e.g. 'images/1234.png')
        let requestSrc = imgSrc;
        try {
            if (imgSrc && (imgSrc.startsWith('http://') || imgSrc.startsWith('https://'))) {
                const u = new URL(imgSrc);
                requestSrc = u.pathname.replace(/^\//, '');
            } else if (imgSrc.startsWith('/')) {
                requestSrc = imgSrc.replace(/^\//, '');
            }
        } catch (e) {
            // fallback: keep original
            requestSrc = imgSrc;
        }
        // remove from DOM immediately
        try {
            slide.remove();
        } catch (err) {
            console.warn('Falha ao remover slide do DOM:', err);
        }

        updateSlidesReference();
        renderIndicators();
        if (totalSlides > 0 && currentSlide >= totalSlides) currentSlide = totalSlides - 1;
        goToSlide(currentSlide);

        if (imgSrc) {
            try {
                const resp = await fetch('/api/carousel-titulo/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ src: requestSrc }), credentials: 'same-origin' });
                if (!resp.ok) {
                    console.error('Erro ao remover do servidor', resp.status);
                    // re-sync to restore state from server
                    await syncCarouselFromServer();
                }
            } catch (err) { console.error('Erro ao remover do servidor', err); }
        }
    }

    // ===== Server sync =====
    // Attach a small badge showing the natural image resolution (e.g. 1920x1080)
    function attachSizeBadge(slide, imgEl) {
        if (!slide || !imgEl) return;
        // remove existing badge if present
        const existing = slide.querySelector('.carousel-titulo-size-badge');
        if (existing) existing.remove();
        // Size badge removed - dimensions no longer displayed
    }

    async function syncCarouselFromServer() {
        try {
            const resp = await fetch('/api/carousel-titulo/list', { cache: 'no-store' });
            if (!resp.ok) return;
            const data = await resp.json();
            const serverImgs = Array.isArray(data) ? data : (data.images || []);
            const newHash = JSON.stringify(serverImgs);
            if (newHash === lastSyncHash) return;
            lastSyncHash = newHash;

            // preserve temp slides
            const tempSlides = Array.from(inner.querySelectorAll('[data-temp-id]'));
            Array.from(inner.querySelectorAll('.carousel-titulo-slide:not([data-temp-id])')).forEach(s => s.remove());

            serverImgs.forEach(img => {
                const slide = document.createElement('div');
                slide.className = 'carousel-titulo-slide';
                const imgEl = document.createElement('img');
                imgEl.src = img.src || img; imgEl.alt = img.alt || 'Banner';
                slide.appendChild(imgEl);
                attachSizeBadge(slide, imgEl);
                if (tempSlides.length > 0) inner.insertBefore(slide, tempSlides[0]); else inner.appendChild(slide);
            });

            updateSlidesReference(); renderIndicators(); if (totalSlides > 0) { currentSlide = Math.min(currentSlide, totalSlides - 1); goToSlide(currentSlide); }
        } catch (err) { console.error('Erro na sincronização do carousel:', err); }
    }

    // initial sync for everyone
    syncCarouselFromServer();

    // poll every 3s while admin
    setInterval(() => { if (document.body.classList.contains('is-admin')) syncCarouselFromServer(); }, 3000);

    // Server-Sent Events for realtime updates (works for all users)
    if (window.EventSource) {
        try {
            const es = new EventSource('/sse');
            es.addEventListener('carousel-update', (e) => {
                // When server notifies of changes, fetch latest carousel
                try { syncCarouselFromServer(); } catch (err) { console.error('SSE sync error', err); }
            });
            es.addEventListener('error', (err) => {
                // EventSource will auto-reconnect; log for debug
                // console.warn('SSE error', err);
            });
        } catch (e) {
            console.warn('SSE not available', e);
        }
    }

    // ===== Admin UI (upload & preview) integrated =====
    const adminForm = document.getElementById('carousel-titulo-admin-form');
    const fileInput = document.getElementById('carousel-titulo-file');
    const altInput = document.getElementById('carousel-titulo-alt');
    const preview = document.getElementById('carousel-titulo-preview');
    const cancelBtn = document.getElementById('carousel-titulo-cancel');
    const submitBtn = adminForm ? adminForm.querySelector('button[type="submit"]') : null;

    if (adminForm && fileInput && preview) {
        // ensure the file input is not nested inside a <label> (clicks inside
        // the preview/editor should not automatically trigger the file chooser)
        try {
            const parent = fileInput.parentElement;
            if (parent && parent.tagName === 'LABEL') {
                parent.parentElement.insertBefore(fileInput, parent.nextSibling);
            }
        } catch (e) { /* ignore if DOM changes unexpected */ }
        // drag & drop preview
        preview.addEventListener('dragover', (e) => { e.preventDefault(); preview.style.background = 'rgba(11, 92, 255, 0.06)'; preview.style.borderColor = '#0b5cff'; });
        preview.addEventListener('dragleave', () => { preview.style.background = ''; preview.style.borderColor = ''; });
        preview.addEventListener('drop', (e) => { e.preventDefault(); preview.style.background = ''; preview.style.borderColor = ''; if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; updatePreview(); } });
        // Only open file chooser when preview is in placeholder state (no editor present)
        preview.addEventListener('click', (ev) => {
            // if editor UI exists inside preview, do not trigger file input
            if (preview.querySelector('.carousel-titulo-editor')) return;
            fileInput.click();
        });
        fileInput.addEventListener('change', updatePreview);

        // Editor state
        let editorState = {
            img: null,        // Image object
            rotation: 0,      // degrees
            scale: 1,         // zoom
            editedBlob: null, // Blob after applying edits
            originalName: ''  // original filename
        };

        function createEditorUI(dataURL, filename) {
            preview.innerHTML = '';
            const container = document.createElement('div');
            container.className = 'carousel-titulo-editor';

            const canvasWrap = document.createElement('div');
            canvasWrap.className = 'carousel-titulo-editor-canvas';
            const canvas = document.createElement('canvas');
            canvas.style.maxWidth = '100%';
            canvas.style.maxHeight = '100%';
            canvasWrap.appendChild(canvas);

            const toolbar = document.createElement('div');
            toolbar.className = 'carousel-titulo-editor-toolbar';

            const btnRotateLeft = document.createElement('button'); btnRotateLeft.type = 'button'; btnRotateLeft.textContent = '⟲';
            const btnRotateRight = document.createElement('button'); btnRotateRight.type = 'button'; btnRotateRight.textContent = '⟳';
            const zoomLabel = document.createElement('label'); zoomLabel.textContent = 'Zoom';
            const zoomRange = document.createElement('input'); zoomRange.type = 'range'; zoomRange.min = '0.5'; zoomRange.max = '2'; zoomRange.step = '0.01'; zoomRange.value = '1';
            const btnApply = document.createElement('button'); btnApply.type = 'button'; btnApply.className = 'primary'; btnApply.textContent = 'Aplicar';
            const btnReset = document.createElement('button'); btnReset.type = 'button'; btnReset.textContent = 'Reset';

            toolbar.appendChild(btnRotateLeft);
            toolbar.appendChild(btnRotateRight);
            toolbar.appendChild(zoomLabel);
            toolbar.appendChild(zoomRange);
            toolbar.appendChild(btnApply);
            toolbar.appendChild(btnReset);

            container.appendChild(canvasWrap);
            container.appendChild(toolbar);
            preview.appendChild(container);

            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                editorState.img = img;
                editorState.rotation = 0;
                editorState.scale = 1;
                editorState.editedBlob = null;
                editorState.originalName = filename || '';
                fitCanvas();
                draw();
            };
            img.src = dataURL;

            function fitCanvas() {
                // fit canvas to container while preserving full image (contain)
                const rect = canvasWrap.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                const iw = editorState.img ? editorState.img.width : 1;
                const ih = editorState.img ? editorState.img.height : 1;
                const containerW = Math.max(120, rect.width);
                const containerH = Math.max(80, rect.height);
                const imgRatio = iw / ih;
                let desiredW, desiredH;
                if (containerW / containerH > imgRatio) {
                    // container is wider: fit by height
                    desiredH = containerH;
                    desiredW = desiredH * imgRatio;
                } else {
                    // fit by width
                    desiredW = containerW;
                    desiredH = desiredW / imgRatio;
                }
                canvas.width = Math.max(300, Math.floor(desiredW * dpr));
                canvas.height = Math.max(200, Math.floor(desiredH * dpr));
                canvas.style.width = desiredW + 'px';
                canvas.style.height = desiredH + 'px';
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }

            function draw() {
                if (!editorState.img) return;
                // clear
                ctx.clearRect(0,0,canvas.width,canvas.height);
                // compute center and draw with rotation and scale
                const cw = canvas.width / (window.devicePixelRatio || 1);
                const ch = canvas.height / (window.devicePixelRatio || 1);
                ctx.save();
                ctx.translate(cw/2, ch/2);
                const rad = editorState.rotation * Math.PI / 180;
                ctx.rotate(rad);
                const iw = editorState.img.width;
                const ih = editorState.img.height;
                // scale to fit canvas (contain) so image is not cropped by default
                const scaleToFit = Math.min(cw/iw, ch/ih);
                const finalScale = scaleToFit * editorState.scale;
                const dw = iw * finalScale;
                const dh = ih * finalScale;
                ctx.drawImage(editorState.img, -dw/2, -dh/2, dw, dh);
                ctx.restore();
            }

            // Controls
            btnRotateLeft.addEventListener('click', () => { editorState.rotation = (editorState.rotation - 90) % 360; draw(); });
            btnRotateRight.addEventListener('click', () => { editorState.rotation = (editorState.rotation + 90) % 360; draw(); });
            zoomRange.addEventListener('input', () => { editorState.scale = Number(zoomRange.value); draw(); });
            btnReset.addEventListener('click', () => { editorState.rotation = 0; editorState.scale = 1; zoomRange.value = '1'; draw(); editorState.editedBlob = null; });

            btnApply.addEventListener('click', () => {
                // generate blob from canvas at reasonable quality
                try {
                    const quality = 0.9;
                    canvas.toBlob((blob) => {
                        if (blob) {
                            // store edited blob for upload
                            editorState.editedBlob = new File([blob], editorState.originalName || ('edited-' + Date.now() + '.jpg'), { type: blob.type });
                            showToast('Edits aplicados. Pronto para salvar.');
                        } else {
                            showToast('Falha ao aplicar edição', false);
                        }
                    }, 'image/jpeg', quality);
                } catch (e) { console.error('apply error', e); showToast('Erro ao aplicar edição', false); }
            });

            // handle resize of container
            let resizeObserver = null;
            try {
                resizeObserver = new ResizeObserver(() => { fitCanvas(); draw(); });
                resizeObserver.observe(canvasWrap);
            } catch (e) { window.addEventListener('resize', () => { fitCanvas(); draw(); }); }
        }

        function updatePreview() {
            const file = fileInput.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => { createEditorUI(e.target.result, file.name); };
            reader.readAsDataURL(file);
        }

        cancelBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            adminForm.reset();
            preview.innerHTML = '<i class="fas fa-cloud-upload-alt"></i>';
            fileInput.value = '';
            altInput.value = '';
            // clear editor state
            editorState.img = null;
            editorState.rotation = 0;
            editorState.scale = 1;
            editorState.editedBlob = null;
            editorState.originalName = '';
        });

        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const origFile = fileInput.files[0];
            const altText = (altInput.value || '').trim() || 'Banner';
            // prefer edited blob if present
            const fileToUpload = (editorState && editorState.editedBlob) ? editorState.editedBlob : origFile;
            if (!fileToUpload) { alert('Selecione uma imagem primeiro!'); return; }
            if (!fileToUpload.type || !fileToUpload.type.startsWith('image/')) { alert('Selecione um arquivo de imagem.'); return; }

            // choose edited blob if user applied edits
            const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const previewUrl = ev.target.result;
                // optimistic
                addSlideToCarousel(previewUrl, altText, tempId);
                submitBtn && (submitBtn.disabled = true);
                const originalText = submitBtn ? submitBtn.innerHTML : null;
                if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

                try {
                    const fd = new FormData(); fd.append('photos', fileToUpload, fileToUpload.name || origFile.name); fd.append('categoria', 'titulo'); fd.append('alt', altText);
                    const resp = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
                    if (!resp.ok) throw new Error('Status: ' + resp.status);
                    const js = await resp.json();
                    if (!js || !js.added || !js.added.length) throw new Error('Nenhuma imagem adicionada pelo servidor');
                    const uploadedImg = js.added[0];
                    replaceTemporarySlide(tempId, uploadedImg.src, uploadedImg.alt || altText);
                    adminForm.reset(); preview.innerHTML = '<i class="fas fa-cloud-upload-alt"></i>'; fileInput.value = ''; altInput.value = '';
                    showToast('✓ Imagem adicionada com sucesso!', true);
                    syncCarouselFromServer();
                } catch (err) {
                    console.error('Upload error:', err);
                    removeTemporarySlide(tempId);
                    showToast('✗ Erro: ' + (err.message || 'upload'), false);
                } finally {
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
                }
            };
            // show optimistic preview from the fileToUpload (if edited blob present, read that)
            reader.readAsDataURL(fileToUpload);
        });
    }

    function showToast(msg, success) {
        const el = document.createElement('div'); el.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 16px;border-radius:6px;z-index:10000;color:white;';
        el.style.background = success ? '#4CAF50' : '#f44336'; el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 3500);
    }

    // Single centered admin delete button appended to carousel (simpler stacking)
    let globalDeleteBtn = null;
    function ensureGlobalDeleteButton() {
        if (globalDeleteBtn && carousel.contains(globalDeleteBtn)) return globalDeleteBtn;
        // remove any stray per-slide buttons
        Array.from(document.querySelectorAll('.carousel-titulo-delete-btn')).forEach(b => b.remove());
        globalDeleteBtn = document.createElement('button');
        globalDeleteBtn.id = 'carousel-titulo-delete-global';
        globalDeleteBtn.type = 'button';
        globalDeleteBtn.className = 'carousel-titulo-delete-btn';
        globalDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        globalDeleteBtn.title = 'Remover imagem';
        globalDeleteBtn.setAttribute('aria-label', 'Remover imagem');
        globalDeleteBtn.style.display = 'none';
        globalDeleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!document.body.classList.contains('is-admin')) return;
            const activeSlide = inner.querySelector('.carousel-titulo-slide.active');
            if (!activeSlide) return;
            if (!confirm('Remover esta imagem?')) return;
            await removeSlideFromCarousel(activeSlide);
        });
        carousel.appendChild(globalDeleteBtn);
        return globalDeleteBtn;
    }

    function attachDeleteHandlers() {
        updateSlidesReference();
        const btn = ensureGlobalDeleteButton();
        if (document.body.classList.contains('is-admin')) btn.style.display = '';
        else btn.style.display = 'none';
    }

    setInterval(() => {
        if (document.body.classList.contains('is-admin')) { attachDeleteHandlers(); const formEl = document.getElementById('carousel-titulo-admin-form'); if (formEl) formEl.style.display = 'flex'; }
        else { const formEl = document.getElementById('carousel-titulo-admin-form'); if (formEl) formEl.style.display = 'none'; }
    }, 2000);

    // Expose public API
    window.CarouselTitulo = {
        addSlide: addSlideToCarousel,
        replaceTemp: replaceTemporarySlide,
        removeTemp: removeTemporarySlide,
        removeSlide: removeSlideFromCarousel,
        sync: syncCarouselFromServer,
        next: nextSlide,
        prev: prevSlide,
        goTo: goToSlide,
        isUploading: () => isUploading,
        setUploading: (v) => { isUploading = !!v; }
    };
});