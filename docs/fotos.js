document.addEventListener('DOMContentLoaded', function(){
  console.log('=== fotos.js iniciando ===');
  const gallery = document.getElementById('gallery');
  const modal = document.getElementById('media-modal');
  const modalContent = document.getElementById('modal-content');
  const modalClose = document.getElementById('modal-close');

  // === ADMIN MODE TOGGLE ===
  // Verifica se usuário é proprietário (baseado em admin status)
  let isOwner = false;
  let adminModeActive = false;

  // Tenta detectar se é proprietário
  function checkIfOwner(){
    try {
      // Verifica localStorage (onde auth.js armazena dados do usuário)
      const userStr = localStorage.getItem('user');
      if(userStr){
        const user = JSON.parse(userStr);
        isOwner = !!(user.isAdmin || user.isPresident);
        console.log('Fotos: isOwner =', isOwner, '(user:', user.name, ')');
        return;
      }
    } catch(e) {
      console.log('Fotos: Erro ao verificar owner:', e);
    }
    // Se nenhum dado encontrado, assume que não é proprietário
    console.log('Fotos: isOwner = false (sem dados)');
    isOwner = false;
  }

  checkIfOwner();

  // === CÓDIGO SECRETO PARA VIRAR ADMIN ===
  // Use no console: makeAdmin() para virar admin
  window.makeAdmin = function(){
    const senha = prompt('Digite o código secreto para virar admin:');
    // Código secreto: "boi2025" (customize como quiser)
    const codigoCorreto = 'boi2025';
    
    if(senha === codigoCorreto){
      const user = JSON.parse(localStorage.getItem('user') || '{"name":"Visitante"}');
      user.isAdmin = true;
      user.isPresident = true;
      localStorage.setItem('user', JSON.stringify(user));
      console.log('✅ Você é admin agora! Atualize a página (F5)');
      showToast('✅ Código correto! Você é admin. Recarregue a página (F5)');
      isOwner = true;
      checkIfOwner();
      // Ativa o modo admin de fotos (mostra control bar)
      adminModeActive = true;
      updateControlBarVisibility();
      return true;
    } else {
      console.warn('❌ Código incorreto!');
      showToast('❌ Código incorreto!');
      return false;
    }
  };

  // Função exposta para admin.js ativar/desativar modo admin
  window.activatePhotoAdminMode = function(isActive){
    if(isActive){
      isOwner = true;
      adminModeActive = true;
      updateControlBarVisibility();
    } else {
      adminModeActive = false;
      updateControlBarVisibility();
    }
  };

  let items = [];
  let storyOnlyItems = [];

  const SEEN_KEY = 'seenPhotos_v1';
  function getSeen(){
    try{ return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); }catch(e){ return []; }
  }
  function saveSeen(list){ try{ localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(new Set(list)))); }catch(e){} }

  // simple toast for confirmations
  function showToast(text, duration = 2200){
    try{
      let t = document.getElementById('fotos-toast');
      if(!t){
        t = document.createElement('div');
        t.id = 'fotos-toast';
        t.style.position = 'fixed';
        t.style.left = '50%';
        t.style.top = '50%';        
        t.style.transform = 'translateX(-50%)';
        t.style.background = 'rgba(0,0,0,0.8)';
        t.style.color = '#fff';
        t.style.padding = '10px 14px';
        t.style.borderRadius = '8px';
        t.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
        t.style.zIndex = 9999;
        t.style.fontSize = '13px';
        document.body.appendChild(t);
      }
      t.textContent = text;
      t.style.opacity = '1';
      clearTimeout(t._timeout);
      t._timeout = setTimeout(()=>{ t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, duration);
    }catch(e){ console.warn('toast failed', e); }
  }

  // === ADMIN MODE TOGGLE (após showToast estar definida) ===
  // Função para alternar modo admin
  function toggleAdminMode(){
    if(!isOwner) {
      showToast('Você não tem permissão para acessar modo admin', 2000);
      return;
    }
    adminModeActive = !adminModeActive;
    updateControlBarVisibility();
    showToast(adminModeActive ? '✓ Modo admin ativado' : '✗ Modo admin desativado', 1800);
  }

  // Atualiza visibilidade da control bar
  function updateControlBarVisibility(){
    const controlBar = document.querySelector('.control-bar');
    if(!controlBar) return;
    controlBar.style.display = adminModeActive ? 'flex' : 'none';
  }

  // Listener para Ctrl+Shift+A
  document.addEventListener('keydown', function(e){
    if(e.ctrlKey && e.shiftKey && e.key === 'A'){
      e.preventDefault();
      toggleAdminMode();
    }
  });

  // Inicializa visibilidade (oculta por padrão)
  updateControlBarVisibility();

  function createGalleryItem(item){
    const wrap = document.createElement('div');
    wrap.className = 'gallery-item';

    if(item.type && item.type.startsWith('video') || (item.src && item.src.match(/\.mp4$|\.webm$|\.ogg$/i))){
      const vid = document.createElement('video');
      vid.className = 'media';
      vid.src = item.src;
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.preload = 'metadata';
      // try autoplay for a small preview
      vid.autoplay = true;
      vid.setAttribute('aria-label', item.alt || 'video');
      wrap.appendChild(vid);

      const overlay = document.createElement('div');
      overlay.className = 'overlay';
      overlay.innerHTML = '<i class="fas fa-play play-icon" aria-hidden="true"></i>';
      wrap.appendChild(overlay);

      wrap.addEventListener('click', function(){ openModal('video', item.src); });

    } else {
      const img = document.createElement('img');
      img.className = 'media';
      img.src = item.src;
      img.alt = item.alt || '';
      wrap.appendChild(img);
      const overlay = document.createElement('div');
      overlay.className = 'overlay';
      wrap.appendChild(overlay);
      wrap.addEventListener('click', function(){ openModal('image', item.src); });
    }

    // Admin delete button for images/videos (sempre criado; visibilidade controlada por CSS)
      try{
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-delete admin-only';
        del.title = 'Deletar imagem';
        del.innerHTML = '<i class="fas fa-trash"></i>';
        del.style.position = 'absolute';
        del.style.top = '8px';
        del.style.right = '8px';
        del.style.zIndex = '12';
        del.style.width = '38px';
        del.style.height = '38px';
        del.style.borderRadius = '8px';
        del.style.border = 'none';
        del.style.background = 'rgba(220,38,38,0.95)';
        del.style.color = '#fff';
        del.style.cursor = 'pointer';
        del.addEventListener('click', async function(ev){
          ev.stopPropagation();
          const ok = confirm('Confirmar exclusão desta imagem?');
          if(!ok) return;
          try{
            wrap.remove();
            items = items.filter(it => it.src !== item.src);
            try{
              const resp = await fetch('/api/photos/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ src: item.src }), credentials: 'same-origin' });
              if(!resp.ok) throw new Error('server delete failed');
              showToast('Imagem deletada com sucesso');
            } catch(err){
              console.error('Erro ao deletar no servidor', err);
              showToast('Erro ao deletar no servidor');
            }
          }catch(e){ console.error('erro ao remover imagem', e); }
        });
        wrap.style.position = 'relative';
        wrap.appendChild(del);
      }catch(e){ console.warn('não foi possível adicionar botão deletar', e); }

    return wrap;
  }

  function render(){
    gallery.innerHTML = '';
    items.forEach(it => gallery.appendChild(createGalleryItem(it)));
  }

  /* --- Stories (highlights) --- */
  const storiesContainer = document.getElementById('stories');
  let stories = [];

  // server upload input (hidden) and helper
  const serverFileInput = document.getElementById('server-file-input');
  const addPhotoServerMainBtn = document.getElementById('add-photo-server-main');
  if(serverFileInput && addPhotoServerMainBtn){
    addPhotoServerMainBtn.addEventListener('click', ()=>{
      // Sempre salvar imagens adicionadas via botão + Imagem na pasta 'galeria'
      serverFileInput._targetCategoria = 'galeria';
      serverFileInput._storyOnly = false;
      serverFileInput.click();
    });
    serverFileInput.addEventListener('change', function(e){
      const files = Array.from(e.target.files || []);
      if(files.length === 0) return;
      const categoria = serverFileInput._targetCategoria || '';
      const storyOnly = !!serverFileInput._storyOnly;
      uploadFilesToServer(files, categoria, storyOnly).then(()=>{ loadPhotosFromJSON(); }).catch(err=>{ showToast('Erro ao enviar imagens ao servidor'); console.error(err); });
      serverFileInput.value = '';
    });
  }

  function createStoryItem(s){
    const li = document.createElement('div');
    li.className = 'story-item';

    const ring = document.createElement('div');
    ring.className = 'story-ring';

    const avatar = document.createElement('div');
    avatar.className = 'story-avatar';
    const img = document.createElement('img');
    img.src = s.srcThumb || s.src; img.alt = s.title || 'story';
    avatar.appendChild(img);
    ring.appendChild(avatar);
    li.appendChild(ring);

    const label = document.createElement('div');
    label.className = 'story-label';
    label.textContent = s.title || '';
    li.appendChild(label);

    // add a translucent + button overlay to allow adding photos to this category
    // ⭐ Botões admin são sempre criados; visibilidade é controlada por CSS (body.is-admin)
      try{
        const plus = document.createElement('button');
        plus.className = 'story-add admin-only';
        plus.type = 'button';
        plus.title = 'Adicionar foto nesta categoria';
        plus.innerHTML = '<i class="fas fa-plus"></i>';
        plus.style.position = 'absolute';
        plus.style.right = '-8px';
        plus.style.top = '-8px';
        plus.style.width = '36px';
        plus.style.height = '36px';
        plus.style.borderRadius = '50%';
        plus.style.border = '2px solid #fff';
        plus.style.background = 'linear-gradient(135deg, #ff8a00 0%, #e52e71 50%, #6a00ff 100%)';
        plus.style.color = '#fff';
        plus.style.fontSize = '16px';
        plus.style.cursor = 'pointer';
        plus.style.backdropFilter = 'blur(8px)';
        plus.style.display = 'flex';
        plus.style.alignItems = 'center';
        plus.style.justifyContent = 'center';
        plus.style.boxShadow = '0 8px 24px rgba(229, 46, 113, 0.4)';
        plus.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        plus.style.fontWeight = 'bold';
        plus.style.zIndex = '10';
        
        // Efeito hover
        plus.addEventListener('mouseenter', function(){
          plus.style.transform = 'scale(1.15) rotate(90deg)';
          plus.style.boxShadow = '0 12px 32px rgba(229, 46, 113, 0.6)';
        });
        
        plus.addEventListener('mouseleave', function(){
          plus.style.transform = 'scale(1) rotate(0deg)';
          plus.style.boxShadow = '0 8px 24px rgba(229, 46, 113, 0.4)';
        });
        
        // Efeito click
        plus.addEventListener('mousedown', function(){
          plus.style.transform = 'scale(0.95)';
        });
        
        plus.addEventListener('mouseup', function(){
          plus.style.transform = 'scale(1.15) rotate(90deg)';
        });
        
        ring.style.position = 'relative';
        ring.appendChild(plus);
        plus.addEventListener('click', function(ev){
          ev.stopPropagation();
          if(!serverFileInput) return showToast('Upload ao servidor indisponível');
          serverFileInput._targetCategoria = (s.categoria || s.title || '');
          serverFileInput._storyOnly = true;
          serverFileInput.click();
        });
      }catch(e){ console.warn('could not add plus button', e); }

      // Add delete button for this story/category (admin only)
      try{
        const rem = document.createElement('button');
        rem.type = 'button';
        rem.className = 'story-remove admin-only';
        rem.title = 'Remover categoria';
        rem.innerHTML = '<i class="fas fa-trash"></i>';
        rem.style.position = 'absolute';
        rem.style.left = '-8px';
        rem.style.top = '-8px';
        rem.style.zIndex = '10';
        rem.style.width = '36px';
        rem.style.height = '36px';
        rem.style.borderRadius = '8px';
        rem.style.border = '2px solid rgba(255,255,255,0.12)';
        rem.style.background = 'rgba(220,38,38,0.92)';
        rem.style.color = '#fff';
        rem.style.cursor = 'pointer';
        rem.addEventListener('click', async function(ev){
          ev.stopPropagation();
          const key = (s.categoria || s.title || '');
          if(!key){ showToast('Categoria inválida'); return; }
          if(!confirm('Deseja realmente remover a categoria "' + key + '" e suas fotos?')) return;
          // optimistic UI: remove the story from list and re-render
          try{
            stories = stories.filter(st => (st.categoria || st.title) !== key);
            renderStories();
            // notify server
            try{
              const r = await fetch('/api/delete-story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: key }), credentials: 'same-origin' });
              if(!r.ok) throw new Error('delete failed');
              showToast('Categoria removida');
            } catch(err){ console.error('Erro ao remover categoria no servidor', err); showToast('Erro ao remover no servidor'); }
          }catch(e){ console.error('erro ao remover categoria', e); }
        });
        ring.style.position = 'relative';
        ring.appendChild(rem);
      }catch(e){ console.warn('could not add remove button', e); }

    // detecta se existem fotos novas para esta categoria e aplica classe visual
    const categoriaKey = s.categoria || s.title;
    const combinedForCategoryCheck = items.concat(storyOnlyItems);
    const hasNew = combinedForCategoryCheck.some(it => (it.categoria === categoriaKey || it.title === categoriaKey) && it.new);
    if(hasNew) ring.classList.add('story-ring--new');

    li.addEventListener('click', function(){
      // Ao clicar, abrir stories da categoria (máx 10)
      const categoria = categoriaKey;
      // Filtra itens da categoria (inclui os marcados apenas para stories)
      const imagensDaCategoria = combinedForCategoryCheck.filter(img => img.categoria === categoria || img.title === categoria);
      const imagensLimitadas = imagensDaCategoria.slice(0, 10);
      if(imagensLimitadas.length > 0){
        // limpar flag "new" das imagens exibidas (marcadas como lidas)
        const seen = getSeen();
        imagensDaCategoria.forEach(i=>{ if(i.new) { i.new = false; if(i.src) seen.push(i.src); } });
        saveSeen(seen);
        // atualiza visual das bolinhas
        renderStories();
        openModal('stories', imagensLimitadas);
      } else {
        // fallback: mostra só o story
        const kind = (s.type && s.type.startsWith('video')) || (s.src && s.src.match(/\.mp4$|\.webm$|\.ogg$/i)) ? 'video' : 'image';
        // marca como visto
        try{ const seen = getSeen(); if(s.src) { seen.push(s.src); saveSeen(seen); } }catch(e){}
        openModal(kind, s.src);
      }
    });

    return li;
  }

  function renderStories(){
    if(!storiesContainer) {
      console.warn('storiesContainer não encontrado');
      return;
    }
    console.log('renderStories chamado com', stories.length, 'stories');
    storiesContainer.innerHTML = '';
    stories.forEach(s => {
      try {
        storiesContainer.appendChild(createStoryItem(s));
      } catch(e) {
        console.error('erro ao criar story:', s, e);
      }
    });
  }

  // carregar stories.json (opcional)
  function loadStoriesFromJSON(){
    fetch('/api/historias', {cache: 'no-store'}).then(r=>{ if(!r.ok) throw new Error('no stories'); return r.json(); }).then(list=>{
      console.log('stories.json carregado:', list);
      if(Array.isArray(list)){
        stories = list;
        renderStories();
      }
    }).catch((err)=>{
      // sem stories.json — nada a fazer
      console.info('stories.json não encontrado ou erro:', err);
    });
  }

  loadStoriesFromJSON();

  // helper to upload files to server endpoint /api/upload
  function uploadFilesToServer(files, categoria, storyOnly){
    const fd = new FormData();
    files.forEach(f=> fd.append('photos', f));
    if(categoria) fd.append('categoria', categoria);
    if(storyOnly) fd.append('storyOnly', '1');
    return fetch('/api/upload', { method: 'POST', body: fd }).then(r=>{ if(!r.ok) throw new Error('upload failed'); return r.json(); });
  }

  // handler for add story button
  const addStoryBtn = document.getElementById('add-story-btn');
  if(addStoryBtn){
    addStoryBtn.addEventListener('click', ()=>{
      // Open file picker first (must be a direct user action). After the user
      // selects a file, ask for the title and then upload. This avoids the
      // "File chooser dialog can only be shown with a user activation" error
      // which happens when calling fileInput.click() after a prompt/async action.
      const storyFileInput = document.createElement('input');
      storyFileInput.type = 'file';
      storyFileInput.accept = 'image/*,video/*';
      storyFileInput.addEventListener('change', function(e){
        const file = e.target.files[0];
        if(!file) return;
        // ask for title AFTER file selection (still in user-initiated flow)
        const title = prompt('Nome da nova categoria (ex: Carnaval 2025)');
        if(!title) return;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('title', title);
        fetch('/api/create-story', { method: 'POST', body: fd, credentials: 'same-origin' })
          .then(async r=>{
            if(!r.ok){
              const text = await r.text().catch(()=>null);
              const msg = text || ('status:' + r.status);
              throw new Error('create-story failed: ' + msg);
            }
            return r.json();
          })
          .then(data=>{ showToast('Categoria criada: ' + title); loadStoriesFromJSON(); })
          .catch(err=>{ showToast('Erro ao criar categoria'); console.error('create-story error:', err); });
      });
      // trigger file picker as direct response to click
      storyFileInput.click();
    });
  }

  // navigation buttons for stories (desktop)
  const storiesPrev = document.getElementById('stories-prev');
  const storiesNext = document.getElementById('stories-next');
  if(storiesPrev && storiesNext && storiesContainer){
    const scrollAmount = 96; // 84px (bolinha) + 12px (gap) = scroll 1 bolinha at a time
    storiesPrev.addEventListener('click', ()=>{
      storiesContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    storiesNext.addEventListener('click', ()=>{
      storiesContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
  }

  function openModal(kind, src){
    // Novo stories modal: recebe array de imagens/videos
    if(Array.isArray(src)) {
      let current = 0;
      let timer = null;
      modalContent.innerHTML = '';

    // Elementos persistentes do modal stories
    const mediaWrapper = document.createElement('div');
    mediaWrapper.className = 'stories-media';
    const mediaContentWrapper = document.createElement('div');
    mediaContentWrapper.className = 'stories-media-content';
    const indicator = document.createElement('div');
    indicator.className = 'stories-indicator';

    // colocar indicador dentro do wrapper da mídia para que acompanhe a largura da imagem
    mediaWrapper.style.position = 'relative';
    modalContent.appendChild(mediaWrapper);
    mediaWrapper.appendChild(mediaContentWrapper);
    mediaWrapper.appendChild(indicator);

      // Preload sizes to adaptar largura dos segmentos conforme proporção horizontal
      function preloadSizes(list){
        return Promise.all(list.map(item => new Promise(resolve=>{
          // imagens
          if(item.type && item.type.startsWith('video') || (item.src && item.src.match(/\.mp4$|\.webm$|\.ogg$/i))){
            // vídeo: tentar metadata
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.src = item.src;
            v.addEventListener('loadedmetadata', function(){
              const w = v.videoWidth || 16; const h = v.videoHeight || 9;
              resolve(w / h);
            });
            // fallback se erro
            setTimeout(()=> resolve(16/9), 1500);
          } else {
            const im = new Image();
            im.onload = function(){ resolve(im.naturalWidth / im.naturalHeight || 3/4); };
            im.onerror = function(){ resolve(3/4); };
            im.src = item.src;
          }
        })));
      }

      // duração em ms de cada slide
      const DURATION = 3500;
      let progressInterval = null;
      function show(idx) {
        mediaContentWrapper.innerHTML = '';
        const item = src[idx];
        if(item.type === 'video' || (item.src && item.src.match(/\.mp4$|\.webm$|\.ogg$/i))) {
          const v = document.createElement('video');
          v.src = item.src; v.controls = true; v.autoplay = true; v.style.maxHeight = '90vh';
          v.playsInline = true; v.setAttribute('aria-label','video');
          mediaContentWrapper.appendChild(v);
        } else {
          const i = document.createElement('img');
          i.src = item.src; mediaContentWrapper.appendChild(i);
        }
        // Construir indicadores como segmentos com preenchimento
        indicator.innerHTML = src.map((_item,i)=>`<span class="segment"><div class="fill" style="width:0%"></div></span>`).join('');
        // destaca o atual via data-attr
        const segments = Array.from(indicator.querySelectorAll('.segment'));
        segments.forEach((s,si)=> s.dataset.index = si);
      }

      function next() {
        current = (current+1)%src.length;
        show(current);
      }
      function prev() {
        current = (current-1+src.length)%src.length;
        show(current);
      }

      // clique no mediaWrapper: lado esquerdo volta, direito avança
      mediaWrapper.addEventListener('click', function(e){
        const rect = mediaWrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if(x < rect.width/2){
          // prev
          if(progressInterval) clearInterval(progressInterval);
          prev();
          resetAuto();
        } else {
          // next
          if(progressInterval) clearInterval(progressInterval);
          next();
          resetAuto();
        }
      });

      function resetAuto() {
        // limpa interval anterior
        if(progressInterval) clearInterval(progressInterval);
        const segments = Array.from(indicator.querySelectorAll('.segment .fill'));
        // zera todos
        segments.forEach(s=> s.style.width = '0%');
        const currentFill = segments[current];
        if(!currentFill) return;
        const start = Date.now();
        progressInterval = setInterval(()=>{
          const elapsed = Date.now() - start;
          const pct = Math.min(100, (elapsed / DURATION) * 100);
          currentFill.style.width = pct + '%';
          if(pct >= 100){
            clearInterval(progressInterval);
            next();
            resetAuto();
          }
        }, 50);
        window.storiesTimer = progressInterval;
      }

      // carrega tamanhos e monta indicadores com flex proporcional
      preloadSizes(src).then(ratios => {
        // normaliza e cria segmentos
        const sum = ratios.reduce((a,b)=>a+b, 0) || ratios.length;
        indicator.innerHTML = '';
        ratios.forEach(r => {
          const seg = document.createElement('span');
          seg.className = 'segment';
          // flex proporcional à razão horizontal da mídia
          seg.style.flex = (r / sum).toString();
          const fill = document.createElement('div');
          fill.className = 'fill';
          fill.style.width = '0%';
          seg.appendChild(fill);
          indicator.appendChild(seg);
        });

        show(current);
        resetAuto();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden','false');
      }).catch(()=>{
        // fallback: monta indicadores iguais
        indicator.innerHTML = src.map(()=>`<span class="segment"><div class="fill" style="width:0%"></div></span>`).join('');
        show(current);
        resetAuto();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden','false');
      });
    } else {
      modalContent.innerHTML = '';
      if(kind === 'video'){
        const v = document.createElement('video');
        v.src = src; v.controls = true; v.autoplay = true; v.style.maxHeight = '90vh';
        v.playsInline = true; v.setAttribute('aria-label','video');
        modalContent.appendChild(v);
      } else {
        const i = document.createElement('img');
        i.src = src; modalContent.appendChild(i);
      }
      modal.classList.add('open');
      modal.setAttribute('aria-hidden','false');
      // marca como visto se for imagem única (open via galeria)
      try{
        let it = items.find(x=>x.src === src);
        if(!it) it = storyOnlyItems.find(x=>x.src === src);
        if(it && it.new){
          it.new = false;
          const seen = getSeen(); if(src) seen.push(src); saveSeen(seen);
          renderStories();
          render();
        }
      }catch(e){}
    }
  }

  function closeModal(){
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  modalContent.innerHTML = '';
  // Limpa timer do stories
  if(window.storiesTimer) clearTimeout(window.storiesTimer);
  }

  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', function(e){ if(e.target === modal) closeModal(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeModal(); });

  // --- FUNÇÃO PARA RECARREGAR FOTOS (substitui polling automático) ---
  function loadPhotosFromJSON(){
    fetch('/api/fotos', {cache: 'no-store'}).then(function(r){
      if(!r.ok) throw new Error('no json');
      return r.json();
    }).then(function(list){
      if(Array.isArray(list)){
        // Preserva categoria e título para permitir agrupar por categoria ao abrir stories
        const seen = getSeen();
        const oldCount = items.length + storyOnlyItems.length;
        items = [];
        storyOnlyItems = [];
        const added = [];
        
        list.forEach(i=>{
          const obj = {
            src: i.src,
            type: i.type || '',
            new: (('new' in i) ? i.new : (!seen.includes(i.src))),
            categoria: i.categoria || i.category || '',
            title: i.title || ''
          };
          // Não incluir imagens usadas no carrossel de título ou no carrossel de brincantes na galeria pública
          if(obj.categoria === 'titulo' || obj.categoria === 'carrossel-brincantes'){
            // skip entirely (do not add to items or storyOnlyItems)
            return;
          }
          // se o JSON marcar explicitamente que este item não deve ir para a galeria
          if(i.storyOnly === true || i.gallery === false){
            storyOnlyItems.push(obj);
          } else {
            items.push(obj);
          }
          if(obj.new) added.push(obj);
        });
        
        render();
        renderStories();
        
        const newCount = items.length + storyOnlyItems.length;
        if(newCount > oldCount){
          showToast((newCount - oldCount) + ' foto(s) adicionada(s) com sucesso!');
        }
      }
    }).catch(function(err){
      // sem photos.json — manter galeria vazia até upload do usuário
      console.warn('photos.json não encontrado ou erro:', err);
      showToast('Erro ao carregar fotos');
    });
  }

  // carregar fotos inicialmente
  loadPhotosFromJSON();

  // === SSE REAL-TIME SYNC: ouvir mudanças de outros clientes ===
  try {
    const sse = new EventSource('/sse');
    
    // Ouve evento de remoção de foto
    sse.addEventListener('photos-update', function(e) {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'delete' && data.src) {
          console.log('[SSE] Foto deletada por outro admin:', data.src);
          // Recarrega fotos em tempo real
          loadPhotosFromJSON();
        }
      } catch (err) {
        console.error('[SSE photos-update] erro ao parsear:', err);
      }
    });
    
    // Ouve evento de remoção de categoria
    sse.addEventListener('stories-update', function(e) {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'delete' && data.title) {
          console.log('[SSE] Categoria deletada por outro admin:', data.title);
          // Recarrega stories em tempo real
          loadStoriesFromJSON();
          loadPhotosFromJSON(); // também recarrega fotos pq elas tavam nessa categoria
        }
      } catch (err) {
        console.error('[SSE stories-update] erro ao parsear:', err);
      }
    });
    
    sse.addEventListener('error', function(e) {
      console.warn('[SSE] Conexão perdida, tentando reconectar em 3s...');
      sse.close();
      // Reconnect after 3 seconds
      setTimeout(() => {
        try {
          new EventSource('/sse');
          console.log('[SSE] Reconectado');
        } catch (err) {
          console.error('[SSE reconnect] erro:', err);
        }
      }, 3000);
    });
    
    console.log('[SSE] Listener configurado para atualizações em tempo real');
  } catch (err) {
    console.warn('[SSE] Não foi possível conectar ao SSE:', err);
  }

  // Botão para recarregar fotos manualmente

});
