/**
 * Events/Apresentações Module
 * Gerencia apresentações com funcionalidades de:
 * - Carregar apresentações do events.json
 * - Adicionar novas apresentações
 * - Remover apresentações
 * - Verificar status de vídeos do YouTube
 * - Atualizar DOM em tempo real
 * - Sincronizar com servidor a cada 5 segundos para outros usuários
 */

(function () {
  'use strict';

  let apresentacoes = [];
  let nextId = 1;
  let editingId = null; // Rastreia qual apresentação está sendo editada
  let isEditing = false; // Protege contra sobrescrita por sincronização
  let lastSyncHash = ''; // Hash da última sincronização para evitar atualizações desnecessárias

  /**
   * Carrega as apresentações do arquivo events.json
   */
  async function loadEvents() {
    try {
      console.log('📂 [loadEvents] Iniciando carregamento...');
      const response = await fetch('/api/eventos');
      console.log('📂 [loadEvents] Response status:', response.status);
      if (!response.ok) {
        console.error('Erro ao carregar events.json:', response.status);
        apresentacoes = [];
        renderEvents();
        return;
      }

      const data = await response.json();
      console.log('📂 [loadEvents] Data carregado:', data);
      apresentacoes = Array.isArray(data) ? data : [];

      // Atualizar o próximo ID
      if (apresentacoes.length > 0) {
        nextId = Math.max(...apresentacoes.map(e => e.id || 0)) + 1;
      }

      console.log(`✅ Carregadas ${apresentacoes.length} apresentações`);
      
      // Limpar filtro de busca ao carregar
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.value = '';
        lastSearchTerm = '';
      }
      const searchPanel = document.getElementById('search-results');
      if (searchPanel) {
        searchPanel.style.display = 'none';
      }
      
      renderEvents();
      updateSyncHash();
    } catch (error) {
      console.error('Erro ao carregar apresentações:', error);
      apresentacoes = [];
      renderEvents();
    }
  }

  /**
   * Salva as apresentações no arquivo events.json
   */
  async function saveEvents() {
    try {
      // Tenta salvar via API primeiro (requer autenticação de admin)
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(apresentacoes, null, 2),
      });

      if (response.ok) {
        console.log('✅ Apresentações salvas via API com sucesso');
        return true;
      } else if (response.status === 401 || response.status === 403) {
        // Se não autenticado, tenta salvar localmente (apenas para teste)
        console.warn('Não autenticado para salvar via API. Salvando localmente...');
        return await saveEventsLocally();
      } else {
        console.error('Erro ao salvar eventos via API:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Erro ao salvar apresentações:', error);
      return false;
    }
  }

  /**
   * Salva os eventos localmente (fallback quando API não está disponível)
   */
  async function saveEventsLocally() {
    try {
      // Tenta PUT no arquivo events.json diretamente
      const response = await fetch('/api/eventos', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apresentacoes, null, 2),
      });

      if (response.ok) {
        console.log('✅ Apresentações salvas localmente');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao salvar localmente:', error);
      return false;
    }
  }

  /**
   * Adiciona ou edita uma apresentação
   * @param {Object} eventData
   * @param {number} [editIdOverride] explicit id to update (avoids race with global state)
   */
  function addEvent(eventData, editIdOverride) {
    try {
      // Validação básica
      if (!eventData.nome || !eventData.dia || !eventData.inicio) {
        console.error('Campos obrigatórios faltando');
        return false;
      }

      let isUpdating = false;
      let updatedEvento = null;
      // Prefer explicit override (from hidden form field) to avoid race conditions
      const currentEditingId = (typeof editIdOverride === 'number' && !isNaN(editIdOverride)) ? editIdOverride : editingId; // Capture o estado de edição ANTES de modificar

      // Se está editando, atualiza o evento existente
      if (currentEditingId !== null) {
        const index = apresentacoes.findIndex(e => e.id === currentEditingId);
        if (index !== -1) {
          updatedEvento = {
            id: currentEditingId,
            nome: eventData.nome.trim(),
            dia: eventData.dia,
            dia_fim: eventData.dia_fim || '',
            inicio: eventData.inicio,
            termino: eventData.termino || '',
            local: eventData.local || '',
            youtube: eventData.youtube || '',
          };
          apresentacoes[index] = updatedEvento;
          isUpdating = true;
          console.log(`✅ Apresentação atualizada:`, apresentacoes[index].nome);
        }
      } else {
        // Criar novo evento com ID único
        const novoEvento = {
          id: nextId++,
          nome: eventData.nome.trim(),
          dia: eventData.dia,
          dia_fim: eventData.dia_fim || '',
          inicio: eventData.inicio,
          termino: eventData.termino || '',
          local: eventData.local || '',
          youtube: eventData.youtube || '',
        };

        apresentacoes.push(novoEvento);
        updatedEvento = novoEvento;
        console.log(`✅ Apresentação adicionada:`, novoEvento.nome);
      }

      // Atualizar DOM em tempo real (apenas o card afetado)
      if (updatedEvento) {
        const container = document.getElementById('lista-apresentacoes');
        if (container) {
          if (isUpdating) {
            // Atualizar card existente
            const existingCard = container.querySelector(`[data-event-id="${updatedEvento.id}"]`);
            if (existingCard) {
              const newCardHtml = criarCardApresentacao(updatedEvento);
              existingCard.outerHTML = newCardHtml;
              // re-bind listeners para este card
              bindCardListeners(updatedEvento.id);
            }
          } else {
            // Adicionar novo card
            const newCardHtml = criarCardApresentacao(updatedEvento);
            container.innerHTML += newCardHtml;
            // re-bind listeners para este novo card
            bindCardListeners(updatedEvento.id);
          }
        }
      }

      // Salvar no servidor
      saveEvents();

      return true;
    } catch (error) {
      console.error('Erro ao adicionar/editar apresentação:', error);
      return false;
    }
  }

  /**
   * Inicia edição de uma apresentação
   */
  function editEvent(eventId) {
    try {
       console.log('🔍 [editEvent] Called with eventId:', eventId);
      const evento = apresentacoes.find(e => e.id === eventId);
      if (!evento) {
        console.error('Apresentação não encontrada');
        return false;
      }

      // Preencher o formulário com os dados
      const tituloEl = document.getElementById('titulo');
      const dataInicioEl = document.getElementById('data_inicio');
      const inicioEl = document.getElementById('inicio');
      const dataFimEl = document.getElementById('data_fim');
      const fimEl = document.getElementById('fim');
      const localEl = document.getElementById('local');
      const liveUrlEl = document.getElementById('liveUrl');

      if (tituloEl) tituloEl.value = evento.nome;
      if (dataInicioEl) dataInicioEl.value = evento.dia;
      if (inicioEl) inicioEl.value = evento.inicio;
      if (dataFimEl) dataFimEl.value = evento.dia_fim || '';
      if (fimEl) fimEl.value = evento.termino || '';
      if (localEl) localEl.value = evento.local || '';
      if (liveUrlEl) liveUrlEl.value = evento.youtube || '';

      // Marcar que está editando
      editingId = eventId;
      isEditing = true;
      console.log('✅ [editEvent] Set editingId to:', editingId, 'isEditing:', isEditing);
      try {
        const hidden = document.getElementById('editing_id');
        if (hidden) hidden.value = String(eventId);
      } catch (e) { /* ignore */ }
       console.log('✅ [editEvent] Set editingId to:', editingId);

      // Mudar o texto do botão de submit
      const form = document.getElementById('form-apresentacao');
      const submitBtn = form?.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-edit"></i><span>Atualizar Apresentação</span>';
      }

      // Nota: botão de cancelar edição removido por solicitação do admin

      form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      console.log('✏️ Editando:', evento.nome);
      return true;
    } catch (error) {
      console.error('Erro ao editar apresentação:', error);
      return false;
    }
  }

  /**
   * Cancela edição e limpa o formulário
   */
  function cancelEdit() {
    console.log('🔍 [cancelEdit] Called, current editingId:', editingId, 'isEditing:', isEditing);
    editingId = null; // Sempre resetar para null
    isEditing = false;
    console.log('✅ [cancelEdit] editingId reset to null and isEditing set to false');
    try {
      const hidden = document.getElementById('editing_id');
      if (hidden) hidden.value = '';
    } catch (e) { /* ignore */ }
    const form = document.getElementById('form-apresentacao');
    if (form) form.reset();

    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i><span>Salvar Apresentação</span>';

    const cancelBtn = document.getElementById('btn-cancelar-edicao');
    if (cancelBtn) cancelBtn.remove();

     console.log('✅ [cancelEdit] Form cleared and UI reset');
  }

  /**
   * Remove uma apresentação pelo ID
   */
  function removeEvent(eventId) {
    try {
      const index = apresentacoes.findIndex(e => e.id === eventId);

      if (index === -1) {
        console.error('Apresentação não encontrada');
        return false;
      }

      const removed = apresentacoes.splice(index, 1)[0];
      console.log(`✅ Apresentação removida:`, removed.nome);

      // Remover card do DOM em tempo real
      const card = document.querySelector(`[data-event-id="${eventId}"]`);
      if (card) {
        card.style.opacity = '0.5';
        card.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
          card.remove();
          // Se não há mais cards, mostrar mensagem
          const container = document.getElementById('lista-apresentacoes');
          if (container && container.children.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">Nenhuma apresentação agendada</p>';
          }
        }, 300);
      }

      // Salvar no servidor
      saveEvents();

      return true;
    } catch (error) {
      console.error('Erro ao remover apresentação:', error);
      return false;
    }
  }

  /**
   * Obtém todas as apresentações
   */
  function getEvents() {
    return [...apresentacoes];
  }

  // --- Busca / Filtro ---
  let lastSearchTerm = '';
  // Cache para conteúdo de páginas do site
  const pageCache = {};
  // Páginas a serem pesquisadas no site (ajuste conforme necessário)
  const sitePages = [
    { href: 'index.html', title: 'Início' },
    { href: 'fotos.html', title: 'Fotos' },
    { href: 'musicas.html', title: 'Músicas' },
    { href: 'inscricao.html', title: 'Inscrição / Seletiva' },
    { href: 'contato.html', title: 'Contato' },
    { href: 'sobre.html', title: 'Sobre' },
  ];

  function filterEvents(term) {
    if (!term) return apresentacoes;
       // Safe debug: show search term only
       console.log('🔍 [filterEvents] Called with term:', term);
    const q = String(term).toLowerCase().trim();
    return apresentacoes.filter(e => (e.nome || '').toLowerCase().includes(q) || (e.local || '').toLowerCase().includes(q));
  }

  function renderEventsFiltered(term) {
    const container = document.getElementById('lista-apresentacoes');
    if (!container) return;
    const list = filterEvents(term);
    if (!list || list.length === 0) {
       console.log('🔍 [renderEventsFiltered] no results for term:', term);
      container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">Nenhuma apresentação encontrada</p>';
      return;
    }
         console.log('🔍 [renderEventsFiltered] rendering', list.length, 'items for term:', term);
    container.innerHTML = list.map(evento => criarCardApresentacao(evento)).join('');
         console.log('🔍 [renderEventsFiltered] rendered list length:', list.length);

    // rebind listeners for edit/remove and assistir
    document.querySelectorAll('.btn-editar-apresentacao').forEach(btn => {
      btn.addEventListener('click', function () {
        const eventId = parseInt(this.dataset.eventId, 10);
        editEvent(eventId);
      });
    });
    document.querySelectorAll('.btn-remover-apresentacao').forEach(btn => {
      btn.addEventListener('click', function () {
        const eventId = parseInt(this.dataset.eventId, 10);
        if (confirm('Tem certeza que deseja remover esta apresentação?')) {
          removeEvent(eventId);
        }
         console.log('🔍 [renderEventsFiltered] remove requested for id:', eventId);
      });
    });
    document.querySelectorAll('.btn-assistir').forEach(btn => {
      const youtube = btn.dataset.youtube;
      if (youtube) checkLiveStatus(youtube, btn);
    });
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // Busca site-wide: obtém páginas (cache) e procura pelo termo
  async function fetchPageIfNeeded(href) {
    if (pageCache[href]) return pageCache[href];
    try {
      const r = await fetch(href, { cache: 'no-store' });
      if (!r.ok) return null;
      const txt = await r.text();
      pageCache[href] = txt;
      return txt;
    } catch (e) {
      return null;
    }
  }

  async function siteWideSearch(term) {
    const q = (term || '').toLowerCase().trim();
    if (!q) return [];
    const results = [];
    await Promise.all(sitePages.map(async (p) => {
      const txt = await fetchPageIfNeeded(p.href);
      if (!txt) return;
      const low = txt.toLowerCase();
      const idx = low.indexOf(q);
      if (idx !== -1) {
        // Extrair título do HTML
        let title = p.title;
        const m = txt.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (m && m[1]) title = m[1].trim();

        // trecho em volta do termo
        const start = Math.max(0, idx - 60);
        const snippet = txt.substr(start, 160).replace(/\s+/g, ' ').replace(/<[^>]+>/g, '').trim();
        results.push({ href: p.href, title, snippet });
      }
    }));
    return results;
  }

  function renderSearchResults(resultsPages, resultsApresentacoes) {
    const panel = document.getElementById('search-results');
    const content = document.getElementById('search-results-content');
    if (!panel || !content) return;
    content.innerHTML = '';

    // Mostrar apresentações encontradas (se houver)
    if (resultsApresentacoes && resultsApresentacoes.length > 0) {
      const h = document.createElement('div');
      h.style.padding = '6px 8px';
      h.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
      h.innerHTML = '<strong>Apresentações</strong>';
      content.appendChild(h);
      resultsApresentacoes.forEach(ev => {
        const item = document.createElement('a');
        item.href = '#';
        item.dataset.eventId = ev.id;
        item.style.display = 'block';
        item.style.padding = '8px';
        item.style.color = '#fff';
        item.style.textDecoration = 'none';
        item.style.borderBottom = '1px dashed rgba(255,255,255,0.02)';
        item.innerHTML = `<div style="font-weight:600">${escaparHTML(ev.nome)}</div><div style="font-size:12px;opacity:0.85">${ev.dia} • ${ev.local || ''}</div>`;
        item.addEventListener('click', (e) => { e.preventDefault(); // focar/exibir a apresentação na lista
          // rolar até o card correspondente
          const card = document.querySelector(`.apresentacao-card[data-event-id="${ev.id}"]`);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          panel.style.display = 'none';
        });
        content.appendChild(item);
      });
    }

    if (resultsPages && resultsPages.length > 0) {
      const h2 = document.createElement('div');
      h2.style.padding = '6px 8px';
      h2.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
      h2.innerHTML = '<strong>Páginas do site</strong>';
      content.appendChild(h2);
      resultsPages.forEach(p => {
        const item = document.createElement('a');
        item.href = p.href;
        item.style.display = 'block';
        item.style.padding = '8px';
        item.style.color = '#fff';
        item.style.textDecoration = 'none';
        item.style.borderBottom = '1px dashed rgba(255,255,255,0.02)';
        item.innerHTML = `<div style="font-weight:600">${escaparHTML(p.title)}</div><div style="font-size:12px;opacity:0.85">...${escaparHTML(p.snippet)}...</div>`;
        item.addEventListener('click', () => { panel.style.display = 'none'; });
        content.appendChild(item);
      });
    }

    if ((resultsPages && resultsPages.length) || (resultsApresentacoes && resultsApresentacoes.length)) {
      panel.style.display = '';
    } else {
      content.innerHTML = '<div style="padding:8px;color:#bbb">Nenhum resultado encontrado</div>';
      panel.style.display = '';
    }
  }

  /**
   * Checa status de admin no servidor e atualiza a UI
   */
  async function checkAdminStatus() {
    try {
      const resp = await fetch('/api/admin/status', { credentials: 'same-origin' });
      if (!resp.ok) return showAdminPanel(false);
      const js = await resp.json();
      return showAdminPanel(!!js.admin);
    } catch (e) {
      return showAdminPanel(false);
    }
  }

  function showAdminPanel(isAdmin) {
    // Painel admin removido - apenas ocultar/mostrar formulário
    const form = document.getElementById('form-apresentacao');
    if (!form) return;
    
    if (isAdmin) {
      form.classList.add('visible');
    } else {
      form.classList.remove('visible');
    }
  }

  async function doAdminLogin(password) {
    try {
      const resp = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      });
      if (!resp.ok) {
        alert('Senha inválida');
        return false;
      }
      return true;
    } catch (e) {
      console.error('Erro login admin', e);
      return false;
    }
  }

  async function doAdminLogout() {
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
      
      // Se estiver em admin.html, redireciona para admin-login.html
      if (window.location.pathname.includes('admin.html')) {
        window.location.href = 'admin-login.html';
      }
      
      return true;
    } catch (e) {
      console.error('Erro logout admin', e);
      return false;
    }
  }

  /**
   * Vincula listeners a um card específico (para atualização em tempo real)
   */
  function bindCardListeners(eventId) {
    // Botão editar
    const editBtn = document.querySelector(`.btn-editar-apresentacao[data-event-id="${eventId}"]`);
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        const eId = parseInt(this.dataset.eventId, 10);
        editEvent(eId);
      });
    }

    // Botão remover
    const removeBtn = document.querySelector(`.btn-remover-apresentacao[data-event-id="${eventId}"]`);
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        const eId = parseInt(this.dataset.eventId, 10);
        if (confirm('Tem certeza que deseja remover esta apresentação?')) {
          removeEvent(eId);
        }
      });
    }

    // Botão assistir
    const watchBtn = document.querySelector(`.btn-assistir[data-event-id="${eventId}"]`);
    if (watchBtn) {
      const youtube = watchBtn.dataset.youtube;
      if (youtube) checkLiveStatus(youtube, watchBtn);
    }
  }

  /**
   * Renderiza as apresentações no DOM
   */
  function renderEvents() {
    const container = document.getElementById('lista-apresentacoes');
    if (!container) {
      console.warn('Container #lista-apresentacoes não encontrado');
      return;
    }

    console.log('🎨 [renderEvents] Renderizando', apresentacoes.length, 'apresentações');

    if (apresentacoes.length === 0) {
      container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">Nenhuma apresentação agendada</p>';
      return;
    }

    container.innerHTML = apresentacoes.map(evento => criarCardApresentacao(evento)).join('');

    // Adicionar event listeners aos botões de editar
    document.querySelectorAll('.btn-editar-apresentacao').forEach(btn => {
      btn.addEventListener('click', function () {
        const eventId = parseInt(this.dataset.eventId, 10);
        editEvent(eventId);
      });
    });

    // Adicionar event listeners aos botões de remover
    document.querySelectorAll('.btn-remover-apresentacao').forEach(btn => {
      btn.addEventListener('click', function () {
        const eventId = parseInt(this.dataset.eventId, 10);
        if (confirm('Tem certeza que deseja remover esta apresentação?')) {
          removeEvent(eventId);
        }
      });
    });

    // Verificar status do YouTube para botões de assistir
    document.querySelectorAll('.btn-assistir').forEach(btn => {
      const youtube = btn.dataset.youtube;
      if (youtube) {
        checkLiveStatus(youtube, btn);
      }
    });

    // Ajusta comportamento de scroll: se houver 3 ou mais apresentações ativa o scroll
    try { adjustListScrolling(); } catch (e) { /* ignore */ }
  }

  /**
   * Ajusta a altura/scroll do container de apresentações quando houver 3 ou mais cards
   * Calcula a altura de 3 cards e aplica `max-height` e `overflow-y:auto` dinamicamente.
   */
  function adjustListScrolling() {
    const container = document.getElementById('lista-apresentacoes');
    if (!container) return;
    const cards = Array.from(container.querySelectorAll('.apresentacao-card'));
    if (!cards || cards.length < 3) {
      container.classList.remove('scrollable-list');
      container.style.maxHeight = '';
      container.style.overflowY = '';
      return;
    }

    // medir altura média do primeiro card
    const card = cards[0];
    const cardHeight = card.offsetHeight;
    // gap entre cards (css gap) — tentar ler, fallback 24
    let gap = 24;
    try {
      const cs = getComputedStyle(container);
      const g = cs.getPropertyValue('gap') || cs.getPropertyValue('row-gap');
      if (g) gap = parseFloat(g);
    } catch (e) { /* ignore */ }

    const visibleCount = 3;
    const totalHeight = (cardHeight * visibleCount) + (gap * (visibleCount - 1));
    container.classList.add('scrollable-list');
    container.style.maxHeight = totalHeight + 'px';
    container.style.overflowY = 'auto';
  }

  /**
   * Cria o HTML do card de uma apresentação
   */
  function criarCardApresentacao(evento) {
    let dataFormatada = '';
    if (evento.dia_fim && evento.dia_fim !== evento.dia) {
      dataFormatada = `${formatarData(evento.dia)} — ${formatarData(evento.dia_fim)}`;
    } else {
      dataFormatada = formatarData(evento.dia);
    }
    const status = getEventStatus(evento);
    let statusHTML = '';
    if (status === 'now') statusHTML = '<div class="status-badge status-now"><i class="fas fa-circle"></i> AGORA</div>';
    else if (status === 'upcoming') statusHTML = '<div class="status-badge status-upcoming"><i class="fas fa-clock"></i> EM BREVE</div>';
    else if (status === 'finished') statusHTML = '<div class="status-badge status-finished"><i class="fas fa-check-circle"></i> FINALIZADO</div>';

    let botaoAssistir = '';
    if (evento.youtube) {
      botaoAssistir = `
        <button class="btn-assistir" data-youtube="${evento.youtube}" data-event-id="${evento.id}" style="display:none;">
          <i class="fas fa-play"></i>
          Assistir ao vivo
        </button>
      `;
    }

    return `
      <div class="apresentacao-card" data-event-id="${evento.id}">
        ${statusHTML}
        <div>
          <h3 class="apresentacao-titulo">${escaparHTML(evento.nome)}</h3>
          <div class="apresentacao-detalhes">
            <span><i class="fas fa-calendar-alt"></i> ${dataFormatada}</span>
            <span><i class="fas fa-clock"></i> ${evento.inicio}${evento.termino ? ' - ' + evento.termino : ''}</span>
            ${evento.local ? `<span><i class="fas fa-map-marker-alt"></i> ${escaparHTML(evento.local)}</span>` : ''}
          </div>
        </div>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          ${botaoAssistir}
          <button class="btn-editar-apresentacao admin-only" data-event-id="${evento.id}">
            <i class="fas fa-edit"></i>
            <span class="btn-label">Editar</span>
          </button>
          <button class="btn-remover-apresentacao admin-only" data-event-id="${evento.id}">
            <i class="fas fa-trash"></i>
            <span class="btn-label">Remover</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Formata a data para exibição
   */
  function formatarData(dateStr) {
    try {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      const date = new Date(year, parseInt(month) - 1, day);
      return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * Verifica se a apresentação está acontecendo agora
   */
  function isApresentacaoAtiva(evento) {
    try {
      // Start datetime
      const [sy, sm, sd] = evento.dia.split('-');
      const [sh, smin] = (evento.inicio || '00:00').split(':');
      const dataInicio = new Date(sy, parseInt(sm) - 1, sd, sh, smin);

      // End datetime: if dia_fim provided, use that day with termino time; otherwise use same day
      let dataFim;
      if (evento.dia_fim) {
        const [ey, em, ed] = evento.dia_fim.split('-');
        if (evento.termino) {
          const [eh, emin] = evento.termino.split(':');
          dataFim = new Date(ey, parseInt(em) - 1, ed, eh, emin);
        } else {
          dataFim = new Date(ey, parseInt(em) - 1, ed, 23, 59, 59);
        }
      } else {
        if (evento.termino) {
          const [eh, emin] = evento.termino.split(':');
          dataFim = new Date(sy, parseInt(sm) - 1, sd, eh, emin);
        } else {
          dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000);
        }
      }

      const agora = new Date();
      return agora >= dataInicio && agora <= dataFim;
    } catch {
      return false;
    }
  }

  // Retorna status simples do evento: 'now' | 'upcoming' | 'finished'
  function getEventStatus(evento) {
    try {
      // Start
      const [sy, sm, sd] = (evento.dia || '').split('-');
      const [sh, smin] = (evento.inicio || '00:00').split(':');
      const start = new Date(sy, parseInt(sm) - 1, sd, sh, smin);

      // End (support dia_fim)
      let end;
      if (evento.dia_fim) {
        const [ey, em, ed] = evento.dia_fim.split('-');
        if (evento.termino) {
          const [eh, emin] = evento.termino.split(':');
          end = new Date(ey, parseInt(em) - 1, ed, eh, emin);
        } else {
          end = new Date(ey, parseInt(em) - 1, ed, 23, 59, 59);
        }
      } else {
        if (evento.termino) {
          const [eh, emin] = evento.termino.split(':');
          end = new Date(sy, parseInt(sm) - 1, sd, eh, emin);
        } else {
          end = new Date(start.getTime() + 60 * 60 * 1000);
        }
      }

      const now = new Date();
      if (now >= start && now <= end) return 'now';
      if (now < start) return 'upcoming';
      return 'finished';
    } catch (e) {
      return null;
    }
  }

  /**
   * Verifica o status de um vídeo do YouTube (se está "ao vivo")
   * Usa a API pública do YouTube (pode requerer API key para funcionamento completo)
   * Para simulação, considera vídeos recentes como "live"
   */
  async function checkLiveStatus(youtubeUrl, botaoElement) {
    try {
      // Extrair video ID da URL
      const videoId = extrairVideoIdYouTube(youtubeUrl);
      if (!videoId) {
        console.warn('ID de vídeo inválido:', youtubeUrl);
        botaoElement.style.display = 'none';
        return;
      }
      // Simulação: verifica se é uma URL válida
      if (!isValidYouTubeUrl(youtubeUrl)) {
        botaoElement.style.display = 'none';
        return;
      }

      // Mostrar o botão somente se o evento estiver em andamento (status 'now')
      const eventId = parseInt(botaoElement.dataset.eventId, 10);
      const evento = apresentacoes.find(e => e.id === eventId);
      const status = evento ? getEventStatus(evento) : null;
      if (status !== 'now') {
        botaoElement.style.display = 'none';
        return;
      }

      // Mantém o botão visível e vincula ação
      botaoElement.style.display = 'inline-flex';
      botaoElement.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        // Abrir o livemodal em vez de window.open
        if (window.LiveModal && typeof window.LiveModal.open === 'function') {
          const eventoTitle = evento ? evento.nome : 'Transmissão ao vivo';
          window.LiveModal.open(youtubeUrl, eventoTitle);
        } else {
          console.warn('LiveModal não está disponível, abrindo em nova aba');
          window.open(youtubeUrl, '_blank');
        }
      });
    } catch (error) {
      console.error('Erro ao verificar status do YouTube:', error);
      botaoElement.style.display = 'none';
    }
  }

  /**
   * Extrai o ID do vídeo de uma URL do YouTube
   */
  function extrairVideoIdYouTube(url) {
    try {
      // Padrões de URL do YouTube
      const patterns = [
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Valida se é uma URL do YouTube válida
   */
  function isValidYouTubeUrl(url) {
    if (!url) return false;
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\/.+/i;
    return youtubeRegex.test(url);
  }

  /**
   * Escapa caracteres HTML para evitar XSS
   */
  function escaparHTML(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Inicializa o módulo de apresentações
   */
  function init() {
    // Carrega apresentações ao abrir a página
    loadEvents();
    // Verifica se usuário está logado como admin e mostra painel de login inline
    checkAdminStatus();

    // Listener para limpar filtro quando página ganha foco (volta de outra página)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('📂 [visibilitychange] Página voltou a estar visível, limpando filtro');
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.value) {
          searchInput.value = '';
          lastSearchTerm = '';
          renderEvents();
          const searchPanel = document.getElementById('search-results');
          if (searchPanel) searchPanel.style.display = 'none';
        }
      }
    });


    // Configura o formulário de adição de apresentações
    const form = document.getElementById('form-apresentacao');
    if (form) {
      // garantir que exista um campo hidden para passar o id que está sendo editado
      let editHidden = form.querySelector('#editing_id');
      if (!editHidden) {
        editHidden = document.createElement('input');
        editHidden.type = 'hidden';
        editHidden.id = 'editing_id';
        editHidden.name = 'editing_id';
        editHidden.value = '';
        form.appendChild(editHidden);
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        const novaApresentacao = {
          nome: document.getElementById('titulo')?.value || '',
          dia: document.getElementById('data_inicio')?.value || '',
          dia_fim: document.getElementById('data_fim')?.value || '',
          inicio: document.getElementById('inicio')?.value || '',
          termino: document.getElementById('fim')?.value || '',
          local: document.getElementById('local')?.value || '',
          youtube: document.getElementById('liveUrl')?.value || '',
        };
        const editIdFromInput = parseInt(document.getElementById('editing_id')?.value || '', 10);
        const wasEditing = !isNaN(editIdFromInput);
        console.log('🔍 [formSubmit] Form submitted, editingId (global) is:', editingId, 'editing_id(input):', editIdFromInput);
        console.log('🔍 [formSubmit] Data to submit:', novaApresentacao);

        if (addEvent(novaApresentacao, wasEditing ? editIdFromInput : undefined)) {
          // Mostrar mensagem de sucesso (adicionado ou atualizado)
          const mensagem = document.createElement('div');
          mensagem.textContent = wasEditing ? '✅ Apresentação atualizada com sucesso!' : '✅ Apresentação adicionada com sucesso!';
          mensagem.style.cssText =
            'position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 15px 20px; border-radius: 8px; z-index: 9999;';
          document.body.appendChild(mensagem);

          setTimeout(() => mensagem.remove(), 3000);

          // Limpar formulário e cancelar edição (se estava editando)
          cancelEdit();
        }
      });

      // Nota: o botão "Criar Nova Apresentação" foi removido por solicitação
    }
  }

  /**
   * Gera um hash simples das apresentações para detectar mudanças
   */
  function updateSyncHash() {
    lastSyncHash = JSON.stringify(apresentacoes);
  }

  /**
   * Sincroniza com o servidor para buscar atualizações (para outros usuários)
   */
  async function syncWithServer() {
    try {
      if (isEditing) {
        console.log('⏸️ [syncWithServer] Currently editing (id=' + editingId + '), skipping sync to avoid overwriting changes');
        return;
      }
      const response = await fetch('/api/eventos', { credentials: 'same-origin' });
      if (!response.ok) {
        console.warn('Falha ao sincronizar com servidor');
        return;
      }

      const serverData = await response.json();
      const newHash = JSON.stringify(serverData);

      // Se nada mudou no servidor, não faz nada
      if (newHash === lastSyncHash) {
        return;
      }

       console.log('📡 [syncWithServer] Server data changed, updating local copy. editingId:', editingId);

      // Se houve mudanças, atualiza a lista local
      apresentacoes = Array.isArray(serverData) ? serverData : [];

      // Atualizar o próximo ID
      if (apresentacoes.length > 0) {
        nextId = Math.max(...apresentacoes.map(e => e.id || 0)) + 1;
      }

      // Renderiza os novos dados (somente se não estivermos no modo edição)
      console.log('✅ [syncWithServer] Not editing, re-rendering');
      renderEvents();

      updateSyncHash();
    } catch (error) {
      console.warn('Erro ao sincronizar com servidor:', error);
    }
  }

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Sincronizar com o servidor a cada 5 segundos para que outros usuários vejam atualizações em tempo real
  setInterval(syncWithServer, 5000);

  // Atualiza badges de status periodicamente e notifica quando um evento finalizar
  const prevStatuses = {};
  function updateStatusesAndNotify() {
    apresentacoes.forEach(ev => {
      const newStatus = getEventStatus(ev);
      const prev = prevStatuses[ev.id];
      prevStatuses[ev.id] = newStatus;

      // Atualiza o badge no card, se existir
      const card = document.querySelector(`.apresentacao-card[data-event-id="${ev.id}"]`);
      if (card) {
        let badge = card.querySelector('.status-badge');
        const txt = (newStatus === 'now') ? '<i class="fas fa-circle"></i> AGORA' : (newStatus === 'upcoming') ? '<i class="fas fa-clock"></i> EM BREVE' : (newStatus === 'finished') ? '<i class="fas fa-check-circle"></i> FINALIZADO' : '';
        const cls = (newStatus === 'now') ? 'status-now' : (newStatus === 'upcoming') ? 'status-upcoming' : (newStatus === 'finished') ? 'status-finished' : '';
        if (badge) {
          badge.className = 'status-badge ' + cls;
          badge.innerHTML = txt;
        } else if (txt) {
          const div = document.createElement('div');
          div.className = 'status-badge ' + cls;
          div.innerHTML = txt;
          card.insertBefore(div, card.firstChild);
        }

        // Atualizar visibilidade do botão 'assistir' também
        const watchBtn = card.querySelector('.btn-assistir');
        if (watchBtn) {
          // chama checkLiveStatus para aplicar lógica de exibição com base no status atual
          try { checkLiveStatus(watchBtn.dataset.youtube, watchBtn); } catch (e) { /* ignore */ }
        }
      }

      // Se mudou de 'now' or 'upcoming' para 'finished', notificar
      if (prev && prev !== 'finished' && newStatus === 'finished') {
        showTemporaryMessage(`Apresentação "${ev.nome}" finalizada.`);
      }
    });
  }

  function showTemporaryMessage(text) {
    try {
      const msg = document.createElement('div');
      msg.className = 'site-toast-message';
      msg.textContent = text;
      msg.style.cssText = 'position:fixed;right:20px;bottom:20px;background:#333;color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:30000;opacity:0;transition:opacity 0.25s ease';
      document.body.appendChild(msg);
      requestAnimationFrame(()=> { msg.style.opacity = '1'; });
      setTimeout(()=>{ msg.style.opacity = '0'; setTimeout(()=>msg.remove(),300); }, 4000);
    } catch (e) { console.error(e); }
  }

  // run status updater every 8 seconds
  setInterval(updateStatusesAndNotify, 8000);

  // Expor funções globalmente para uso externo
  window.EventsModule = {
    loadEvents,
    saveEvents,
    addEvent,
    removeEvent,
    editEvent,
    cancelEdit,
    getEvents,
    renderEvents,
  };

  // Alias para compatibilidade com loader.js (que procura por window.BoiEvents)
  window.BoiEvents = window.EventsModule;
})();
