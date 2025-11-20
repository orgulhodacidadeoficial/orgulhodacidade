document.addEventListener('DOMContentLoaded', function() {
    const track = document.querySelector('.carousel-track');
    const nextButton = document.querySelector('.carousel-button.next');
    const prevButton = document.querySelector('.carousel-button.prev');

    let currentIndex = 0;
    let slideWidth = 0;
    let slidesPerView = 0;
    let maxIndex = 0;
    let syncInterval = null;
    let lastSyncHash = ''; // Previne rerender desnecessário

    // ===== LOAD BRINCANTES FROM BACKEND =====
    async function loadBrincantesFromBackend() {
        try {
            const resp = await fetch('/api/brincantes', { cache: 'no-store' });
            if (!resp.ok) {
                console.warn('Failed to load brincantes:', resp.status);
                return [];
            }
            const data = await resp.json();
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error loading brincantes from backend:', err);
            return [];
        }
    }

    // ===== CAROUSEL LOGIC =====
    function initDimensions() {
        const slides = Array.from(track.children);
        if (!slides.length) return;
        slideWidth = slides[0].getBoundingClientRect().width;
        slidesPerView = Math.floor(track.getBoundingClientRect().width / slideWidth);
        maxIndex = Math.max(0, slides.length - slidesPerView);
        if (currentIndex > maxIndex) currentIndex = maxIndex;
        updateSlidePosition();
    }

    initDimensions();

    nextButton.addEventListener('click', () => {
        if (currentIndex < maxIndex) {
            currentIndex++;
            updateSlidePosition();
        }
    });

    prevButton.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            updateSlidePosition();
        }
    });

    function updateSlidePosition() {
        const offset = -slideWidth * currentIndex;
        track.style.transform = `translateX(${offset}px)`;
        prevButton.style.opacity = currentIndex === 0 ? '0.5' : '1';
        nextButton.style.opacity = currentIndex === maxIndex ? '0.5' : '1';
    }

    // Touch support
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
    });

    track.addEventListener('touchmove', e => {
        touchEndX = e.touches[0].clientX;
    });

    track.addEventListener('touchend', () => {
        const difference = touchStartX - touchEndX;
        if (Math.abs(difference) > 50) {
            if (difference > 0) {
                if (currentIndex < maxIndex) {
                    currentIndex++;
                    updateSlidePosition();
                }
            } else {
                if (currentIndex > 0) {
                    currentIndex--;
                    updateSlidePosition();
                }
            }
        }
    });

    window.addEventListener('resize', () => {
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(initDimensions, 250);
    });

    // ===== ADMIN: FORM SUBMISSION & MANAGEMENT =====
    const adminFormOverlay = document.getElementById('admin-form-overlay');
    const adminForm = document.getElementById('admin-brincante-form');
    const photoInput = document.getElementById('brincante-photo');
    const nameInput = document.getElementById('brincante-name');
    const roleInput = document.getElementById('brincante-role');
    const photoPreview = document.getElementById('photo-preview');
    const btnSave = document.getElementById('btn-save-brincante');

    // Drag & drop para foto
    if (photoPreview) {
        photoPreview.addEventListener('dragover', (e) => {
            e.preventDefault();
            photoPreview.style.background = 'rgba(33, 150, 243, 0.1)';
        });

        photoPreview.addEventListener('dragleave', () => {
            photoPreview.style.background = '';
        });

        photoPreview.addEventListener('drop', (e) => {
            e.preventDefault();
            photoPreview.style.background = '';
            if (e.dataTransfer.files.length > 0) {
                photoInput.files = e.dataTransfer.files;
                updatePhotoPreview();
            }
        });

        photoPreview.addEventListener('click', () => {
            photoInput.click();
        });
    }

    photoInput.addEventListener('change', updatePhotoPreview);

    function updatePhotoPreview() {
        const file = photoInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            photoPreview.innerHTML = `<img src="${e.target.result}" alt="preview" style="max-width:100%; max-height:200px; border-radius:8px;">`;
        };
        reader.readAsDataURL(file);
    }

    // Submeter formulário
    if (adminForm) {
        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const file = photoInput.files[0];
            const name = nameInput.value.trim();
            const role = roleInput.value.trim();

            if (!file || !name || !role) {
                alert('Preencha todos os campos!');
                return;
            }

            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

            try {
                const fd = new FormData();
                fd.append('photos', file);
                // Save brincantes carousel images under Frontend/images/carrossel-brincantes
                fd.append('categoria', 'carrossel-brincantes');
                fd.append('name', name);
                fd.append('role', role);

                const resp = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'same-origin' });

                if (!resp.ok) {
                    alert('Erro ao enviar. Status: ' + resp.status);
                    return;
                }

                let js;
                try {
                    js = await resp.json();
                } catch (err) {
                    alert('Erro ao processar resposta do servidor');
                    return;
                }

                if (!js || !js.added || !js.added.length) {
                    alert('Nenhuma imagem foi adicionada');
                    return;
                }

                // Resetar form
                adminForm.reset();
                photoPreview.innerHTML = '<i class="fas fa-cloud-upload-alt"></i>';
                alert('✓ Brincante adicionado com sucesso!');

                // Recarregar carrossel do backend
                await syncBrincantes();

            } catch (err) {
                console.error('Upload error:', err);
                alert('Erro ao enviar imagem');
            } finally {
                btnSave.disabled = false;
                btnSave.innerHTML = '<i class="fas fa-save"></i> Salvar Brincante';
            }
        });
    }

    // ===== CREATE SLIDE DYNAMICALLY =====
    function createSlide(src, name, role) {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';

        const img = document.createElement('img');
        // preserve the original (relative) src in a data attribute so delete handlers can send the correct path
        img.dataset.src = src;
        img.src = src.replace(/\\/g, '/');
        img.alt = name || 'Brincante';
        img.loading = 'lazy';
        slide.appendChild(img);

        const info = document.createElement('div');
        info.className = 'brincante-info';

        const h3 = document.createElement('h3');
        h3.textContent = name || 'Novo';

        const p = document.createElement('p');
        p.textContent = role || '';

        info.appendChild(h3);
        info.appendChild(p);
        slide.appendChild(info);

        // Admin buttons: Edit & Delete
        const isAdmin = document.body.classList.contains('is-admin');
        if (isAdmin) {
            const btnContainer = document.createElement('div');
            btnContainer.className = 'admin-slide-buttons';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            // use the discreet icon-only delete style
            deleteBtn.className = 'carousel-delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            // assign onclick (not addEventListener) and store a marker to avoid duplicates
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                const slide = deleteBtn.closest('.carousel-slide');
                const imgEl = slide ? slide.querySelector('img') : null;
                const srcToDelete = imgEl ? (imgEl.dataset.src || imgEl.getAttribute('src')) : src;
                if (srcToDelete && confirm('Remover este brincante?')) {
                    await deleteSlide(srcToDelete);
                }
            };
            deleteBtn.dataset.deleteHandler = '1';

            slide.style.position = 'relative';
            slide.appendChild(deleteBtn);
        }

        return slide;
    }

    // ===== SYNC & RENDER FROM BACKEND =====
    async function syncBrincantes() {
        try {
            const brincantes = await loadBrincantesFromBackend();
            const newHash = JSON.stringify(brincantes);
            
            // Evita rerender se não há mudanças
            if (newHash === lastSyncHash) return;
            lastSyncHash = newHash;

            // Limpar track (mantém botões de nav)
            const slides = Array.from(track.querySelectorAll('.carousel-slide'));
            slides.forEach(s => s.remove());

            // Renderizar novos slides
            brincantes.forEach(b => {
                track.appendChild(createSlide(b.src, b.name || '', b.role || ''));
            });

            // Reinit carousel
            currentIndex = 0;
            initDimensions();
            attachDeleteHandlers();
            updateAdminButtons();
        } catch (err) {
            console.error('syncBrincantes error:', err);
        }
    }

    async function deleteSlide(src) {
        try {
            const resp = await fetch('/api/brincantes/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ src }),
                credentials: 'same-origin'
            });

            if (!resp.ok) {
                alert('Erro ao remover brincante');
                return;
            }

            // Recarregar carrossel do backend
            await syncBrincantes();
        } catch (err) {
            console.error('Delete error:', err);
            alert('Erro ao remover');
        }
    }

    function attachDeleteHandlers() {
        const deleteBtns = track.querySelectorAll('.carousel-delete-btn');
        deleteBtns.forEach(btn => {
            // avoid adding duplicate handlers; createSlide already sets onclick and marks dataset
            if (btn.dataset.deleteHandler === '1') return;
            btn.onclick = async (e) => {
                e.stopPropagation();
                const slide = btn.closest('.carousel-slide');
                const img = slide ? slide.querySelector('img') : null;
                const src = img ? (img.dataset.src || img.getAttribute('src')) : null;
                if (src && confirm('Remover este brincante?')) {
                    await deleteSlide(src);
                }
            };
            btn.dataset.deleteHandler = '1';
        });
    }

    function updateAdminButtons() {
        const isAdmin = document.body.classList.contains('is-admin');
        const deleteBtns = track.querySelectorAll('.carousel-delete-btn');
        deleteBtns.forEach(btn => {
            btn.style.display = isAdmin ? '' : 'none';
        });

        if (adminFormOverlay) {
            adminFormOverlay.style.display = isAdmin ? 'block' : 'none';
        }
    }

    // ===== REALTIME SYNC (polling every 3 seconds) =====
    function startSyncInterval() {
        if (syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(() => {
            syncBrincantes().catch(err => console.error('Sync interval error:', err));
        }, 3000);
    }

    // Verificar admin status a cada 2 segundos para atualizar UI
    setInterval(() => {
        updateAdminButtons();
    }, 2000);

    // ===== INIT =====
    syncBrincantes().then(() => {
        startSyncInterval();
    });
});

