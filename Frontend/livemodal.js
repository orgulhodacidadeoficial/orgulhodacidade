/**
 * Live Modal Manager with Authentication
 * Gerencia o modal com vídeo do YouTube, autenticação e chat em tempo real
 */

window.LiveModal = (function () {
    'use strict';

    const modal = {
        overlay: null,
        container: null,
        closeBtn: null,
        videoContainer: null,
        chatMessages: null,
        chatInput: null,
        chatSendBtn: null,
        chatHeaderOnlineCount: null, // Elemento para exibir contagem online
        currentVideoId: null,
        messages: [],
        userName: null,
        userEmail: null,
        userAvatar: null, // Avatar do usuário em base64
        userRole: 'USUARIO', // USUARIO, ADM, PROPRIETARIO
        syncInterval: null,
        lastSyncTime: 0,
        authenticated: false,
        silencedUsers: {}, // { email: timestamp_fim }
        proprietarioName: null, // Será carregado do sessionStorage
        serverProprietario: null, // Proprietário definido no servidor (em tempo real)
        userColors: {}, // Cache de cores dos usuários

        /**
         * Inicializa o modal
         */
        init() {
            this.createModal();
            this.setupEventListeners();
            this.loadUserData();
            // ensure each tab has a unique presence id (per-tab)
            let pid = sessionStorage.getItem('liveModalPresenceId');
            if (!pid) {
                pid = 'pm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
                sessionStorage.setItem('liveModalPresenceId', pid);
            }
            this.presenceId = pid;
        },

        /**
         * Cria a estrutura HTML do modal
         */
        createModal() {
            // Criar overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'live-modal-overlay';
            this.overlay.id = 'live-modal-overlay';

            // Criar container
            this.container = document.createElement('div');
            this.container.className = 'live-modal-container';

            // Header
            const header = document.createElement('div');
            header.className = 'live-modal-header';
            header.innerHTML = `
                <div class="live-modal-header-left">
                    <h2 class="live-modal-title">Transmissão ao vivo</h2>
                    <span class="live-modal-user-display" style="margin-left: 20px; font-size: 14px; display: flex; align-items: center; gap: 8px;"></span>
                </div>
                <div class="live-modal-header-right">
                    <button class="live-modal-settings-btn" aria-label="Configurações">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="live-modal-close-btn" aria-label="Fechar transmissão">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            this.closeBtn = header.querySelector('.live-modal-close-btn');
            const settingsBtn = header.querySelector('.live-modal-settings-btn');
            
            if (settingsBtn) {
                settingsBtn.addEventListener('click', () => this.showSettingsModal());
            }

            // Content (vídeo + chat)
            const content = document.createElement('div');
            content.className = 'live-modal-content';

            // Video container
            this.videoContainer = document.createElement('div');
            this.videoContainer.className = 'live-modal-video-container';
            this.videoContainer.innerHTML = '<div id="youtubePlayer"></div>';
            // Desktop title placed inside video container so it overlays the video correctly
            this.videoContainer.insertAdjacentHTML('beforeend', '<h2 class="live-modal-title--desktop" aria-hidden="true">Transmissão ao vivo</h2>');

            // Chat container
            const chatContainer = document.createElement('div');
            chatContainer.className = 'live-modal-chat-container';
            // keep reference for resizing logic
            this.chatContainer = chatContainer;

            // Resize handle (drag to resize chat) - placed above chat header
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'live-modal-chat-resize-handle';
            resizeHandle.innerHTML = `<div class="live-modal-chat-resize-icon">⇅</div>`;
            this.chatResizeHandle = resizeHandle;

            const chatHeader = document.createElement('div');
            chatHeader.className = 'live-modal-chat-header';
            chatHeader.innerHTML = `
                <div class="live-modal-chat-header-content">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-comments"></i> Chat ao vivo
                    </div>
                    <div class="live-modal-online-indicator">
                        <div class="live-modal-online-dot"></div>
                        <span id="live-modal-online-count">1 online</span>
                    </div>
                </div>
            `;
            this.chatHeaderOnlineCount = chatHeader.querySelector('#live-modal-online-count');

            this.chatMessages = document.createElement('div');
            this.chatMessages.className = 'live-modal-chat-messages';
            this.chatMessages.innerHTML = '<div class="live-modal-chat-empty"><i class="fas fa-comments"></i> Nenhuma mensagem ainda</div>';

            const chatInputArea = document.createElement('div');
            chatInputArea.className = 'live-modal-chat-input-container';
            chatInputArea.innerHTML = `
                <input 
                    type="text" 
                    class="live-modal-chat-input" 
                    placeholder="Enviar mensagem..."
                    maxlength="200"
                >
                <button class="live-modal-chat-send-btn">
                    <i class="fas fa-paper-plane"></i>
                </button>
            `;

            this.chatInput = chatInputArea.querySelector('.live-modal-chat-input');
            this.chatSendBtn = chatInputArea.querySelector('.live-modal-chat-send-btn');

            chatContainer.appendChild(chatHeader);
            chatContainer.appendChild(this.chatMessages);
            chatContainer.appendChild(chatInputArea);

            // insert resize handle at top of chat (above header)
            chatContainer.insertBefore(this.chatResizeHandle, chatHeader);

            content.appendChild(this.videoContainer);
            content.appendChild(chatContainer);

            this.container.appendChild(header);
            this.container.appendChild(content);

            this.overlay.appendChild(this.container);
            document.body.appendChild(this.overlay);
        },

        /**
         * Configura os event listeners
         */
        setupEventListeners() {
            // Fechar modal
            this.closeBtn.addEventListener('click', () => this.close());
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.close();
            });

            // Fechar com ESC
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                    this.close();
                }
            });

            // Chat
            this.chatSendBtn.addEventListener('click', () => this.sendMessage());
            this.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });

            // Ensure chat scrolls to bottom when input receives focus (mobile keyboards)
            this.chatInput.addEventListener('focus', () => {
                setTimeout(() => {
                    try {
                        if (this.chatMessages) this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                    } catch (e) {
                        // ignore
                    }
                }, 300);
            });

            // On resize (keyboard open/close or orientation change), keep chat scrolled
            window.addEventListener('resize', () => {
                setTimeout(() => {
                    try {
                        if (this.overlay && this.overlay.classList.contains('active') && this.chatMessages) {
                            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                        }
                    } catch (e) {
                        // ignore
                    }
                }, 200);
            });

            // Detectar eventos de outras abas (ex: /clear)
            window.addEventListener('storage', (e) => {
                if (e.key === 'liveModalChatCleared') {
                    const data = JSON.parse(e.newValue || '{}');
                    if (data.videoId === this.currentVideoId && data.timestamp > (this.lastSyncTime - 1000)) {
                        this.messages = [];
                        this.renderChat();
                        this.loadChatFromServer(); // Recarregar do servidor
                    }
                }
            });

            // Quando a aba fica visível, enviar presença imediata
            document.addEventListener('visibilitychange', () => {
                try {
                    if (document.visibilityState === 'visible' && this.overlay && this.overlay.classList.contains('active')) {
                        this.pingPresence().catch(()=>{});
                    }
                } catch (e) {}
            });

            // Resize (drag) handlers for chat
            this.minChatHeightPx = 120;
            this.maxChatHeightPx = Math.round(window.innerHeight * 0.9);
            this._onChatResizeMove = this.onChatResizeMove.bind(this);
            this._onChatResizeEnd = this.onChatResizeEnd.bind(this);

            if (this.chatResizeHandle) {
                this.chatResizeHandle.addEventListener('mousedown', (e) => this.onChatResizeStart(e));
                // allow preventing default so touch dragging won't immediately scroll the page
                this.chatResizeHandle.addEventListener('touchstart', (e) => this.onChatResizeStart(e), {passive: false});
                // pointer events for broader device support
                this.chatResizeHandle.addEventListener('pointerdown', (e) => this.onChatResizeStart(e));
            }
        },

        onChatResizeStart(e) {
            // Only enable resize on narrow/mobile screens
            if (window.innerWidth > 768) {
                return; // ignore on desktop
            }

            e.preventDefault && e.preventDefault();
            this.isResizingChat = true;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            this._chatResizeStartY = clientY;
            const rect = this.chatContainer.getBoundingClientRect();
            this._chatResizeStartHeight = rect.height;
            // recompute limits
            this.maxChatHeightPx = Math.round(window.innerHeight * 0.95);
            document.addEventListener('mousemove', this._onChatResizeMove);
            document.addEventListener('touchmove', this._onChatResizeMove, {passive: false});
            document.addEventListener('pointermove', this._onChatResizeMove);
            document.addEventListener('mouseup', this._onChatResizeEnd);
            document.addEventListener('pointerup', this._onChatResizeEnd);
            document.addEventListener('touchend', this._onChatResizeEnd);
            document.body.style.userSelect = 'none';
        },

        onChatResizeMove(e) {
            if (!this.isResizingChat) return;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const dy = this._chatResizeStartY - clientY; // drag up => positive
            let newHeight = this._chatResizeStartHeight + dy;
            newHeight = Math.max(this.minChatHeightPx, Math.min(this.maxChatHeightPx, newHeight));

            // apply height to chat container and adjust messages area
            try {
                this.chatContainer.style.height = newHeight + 'px';
                const headerEl = this.chatContainer.querySelector('.live-modal-chat-header');
                const inputEl = this.chatContainer.querySelector('.live-modal-chat-input-container');
                const headerH = headerEl ? headerEl.getBoundingClientRect().height : 56;
                const inputH = inputEl ? inputEl.getBoundingClientRect().height : 60;
                if (this.chatMessages) {
                    const pad = 28; // estimated paddings
                    const messagesMax = Math.max(40, newHeight - headerH - inputH - pad);
                    this.chatMessages.style.maxHeight = messagesMax + 'px';
                }
            } catch (err) {
                // ignore
            }

            // Prevent page scroll while dragging on touch
            if (e.cancelable) e.preventDefault();
        },

        onChatResizeEnd() {
            if (!this.isResizingChat) return;
            this.isResizingChat = false;
            document.removeEventListener('mousemove', this._onChatResizeMove);
            document.removeEventListener('touchmove', this._onChatResizeMove);
            document.removeEventListener('pointermove', this._onChatResizeMove);
            document.removeEventListener('mouseup', this._onChatResizeEnd);
            document.removeEventListener('pointerup', this._onChatResizeEnd);
            document.removeEventListener('touchend', this._onChatResizeEnd);
            document.body.style.userSelect = '';
            // leave the inline height as-is so it stays where the user left it
        },

        /**
         * Carrega dados do usuário do storage
         */
        loadUserData() {
            this.userName = sessionStorage.getItem('liveModalUserName') || localStorage.getItem('liveModalUserName') || null;
            this.userEmail = sessionStorage.getItem('liveModalUserEmail') || localStorage.getItem('liveModalUserEmail') || null;
            this.userAvatar = sessionStorage.getItem('liveModalUserAvatar') || localStorage.getItem('liveModalUserAvatar') || null;
            this.proprietarioName = sessionStorage.getItem('liveModalProprietarioName') || localStorage.getItem('liveModalProprietarioName') || null; // Carregar proprietário
            this.authenticated = !!(this.userName && this.userEmail);
            
            console.log('[LiveModal] loadUserData:', {
                userName: this.userName,
                hasAvatar: !!this.userAvatar,
                avatarLength: this.userAvatar ? this.userAvatar.length : 0
            });
            
            // Carregar lista de ADMs do servidor
            this.loadAdmListFromServer();
            
            this.setUserRole();
        },

        /**
         * Carrega a lista de ADMs do servidor e salva em sessionStorage
         */
        async loadAdmListFromServer() {
            try {
                const response = await fetch('/api/chat/admins-list');
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data.admins)) {
                        sessionStorage.setItem('liveModalAdmList', JSON.stringify(data.admins));
                    }
                }
            } catch (err) {
                // Erro ao conectar - falha silenciosa
            }
        },

        /**
         * Define o role do usuário baseado no email e status admin
         */
        async setUserRole() {
            // Recarregar lista de ADMs do servidor para garantir que temos dados atualizados
            await this.loadAdmListFromServer();
            
            // Normalizar para comparação case-insensitive
            const userNameNorm = (this.userName || '').toLowerCase().trim();
            const propNameNorm = (this.proprietarioName || '').toLowerCase().trim();
            
            // Primeiro: Verificar se é admin no painel administrativo
            let isAdmin = false;
            try {
                const resp = await fetch('/api/admin/status', { credentials: 'same-origin' });
                if (resp.ok) {
                    const js = await resp.json();
                    isAdmin = !!js.admin;
                }
            } catch (e) {
                // Silenciosamente ignorar erro
            }
            
            // Se é admin no painel, é PROPRIETARIO no chat
            if (isAdmin) {
                this.userRole = 'PROPRIETARIO';
                
                // Notificar servidor que você é o proprietário
                try {
                    const propUrl = '/api/chat/proprietario';
                    console.log(`[DEBUG] Enviando proprietário para servidor: ${this.userName} em videoId: ${this.currentVideoId}`);
                    
                    const response = await fetch(propUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userName: this.userName,
                            videoId: this.currentVideoId || 'global'
                        })
                    });
                    
                    if (response.ok) {
                        console.log(`[DEBUG] Proprietário enviado com sucesso para servidor`);
                    } else {
                        console.error(`[DEBUG] Erro ao enviar proprietário: ${response.status}`);
                    }
                } catch (e) {
                    console.error(`[DEBUG] Erro de conexão ao enviar proprietário:`, e);
                }
            } else if (userNameNorm === propNameNorm) {
                this.userRole = 'PROPRIETARIO';
            } else if (this.hasAdmRole(this.userEmail)) {
                this.userRole = 'ADM';
            } else {
                this.userRole = 'USUARIO';
            }
            
            sessionStorage.setItem('liveModalUserRole', this.userRole);
        },

        /**
         * Verifica se um email é ADM (lista pode vir do servidor)
         */
        hasAdmRole(email) {
            const admList = JSON.parse(sessionStorage.getItem('liveModalAdmList') || '[]');
            return admList.includes(email);
        },

        /**
         * Gera uma cor NEON única baseada no nome do usuário
         */
        getUserColor(userName) {
            if (!userName) return '#00ff00';
            
            // Retornar cor em cache se existir
            if (this.userColors[userName]) {
                return this.userColors[userName];
            }

            // Cores NEON vibrantes
            const neonColors = [
                '#00ff00', // Verde NEON
                '#00ffff', // Azul Ciano NEON
                '#ff00ff', // Magenta NEON
                '#ffff00', // Amarelo NEON
                '#ff0080', // Rosa NEON
                '#00ff80', // Verde-Azul NEON
                '#ff8000', // Laranja NEON
                '#8000ff', // Roxo NEON
                '#ff0040', // Rosa Vermelho NEON
                '#00ff40', // Verde Claro NEON
                '#ff4000', // Vermelho Laranja NEON
                '#0080ff'  // Azul NEON
            ];

            // Gerar hash do nome para selecionar cor consistente
            let hash = 0;
            for (let i = 0; i < userName.length; i++) {
                const char = userName.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Converter para inteiro 32-bit
            }

            const colorIndex = Math.abs(hash) % neonColors.length;
            const color = neonColors[colorIndex];
            
            // Cachear cor para este usuário
            this.userColors[userName] = color;
            
            return color;
        },

        /**
         * Abre o modal com um vídeo do YouTube
         */
        async open(youtubeUrl, title = 'Transmissão ao vivo') {
            // Se não autenticado, mostrar login primeiro
            if (!this.authenticated) {
                await this.showLoginModal();
                if (!this.authenticated) {
                    return;
                }
            }

            // Recarregar dados do usuário (importante para manter avatar e nome sincronizados)
            this.loadUserData();

            // Extrair video ID
            const videoId = this.extractVideoId(youtubeUrl);
            if (!videoId) {
                console.error('[LiveModal] ID de vídeo inválido');
                alert('URL do YouTube inválida');
                return;
            }

            this.currentVideoId = videoId;

            // Atualizar título (mobile & desktop variations)
            const titleEl = this.container.querySelector('.live-modal-title');
            const titleDesktopEl = this.container.querySelector('.live-modal-title--desktop');
            if (titleEl) titleEl.textContent = title;
            if (titleDesktopEl) titleDesktopEl.textContent = title;

            // Atualizar info do usuário no header (com avatar se disponível)
            const userDisplay = this.container.querySelector('.live-modal-user-display');
            if (userDisplay) {
                let displayHtml = '';
                if (this.userAvatar && this.userAvatar.length > 0) {
                    displayHtml += `<img src="${this.userAvatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid #fff;">`;
                    console.log('[LiveModal] Avatar carregado no header');
                } else {
                    displayHtml += `<i class="fas fa-user-circle"></i>`;
                    console.log('[LiveModal] Avatar não disponível, usando ícone');
                }
                displayHtml += ` <strong>${this.escapeHtml(this.userName)}</strong>`;
                userDisplay.innerHTML = displayHtml;
            }

            // Mostrar overlay
            this.overlay.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Carregar vídeo
            await this.loadVideo(videoId);

            // Carregar mensagens do servidor
            await this.loadChatFromServer();

            // Enviar presença imediata ao abrir modal
            try { await this.pingPresence(); } catch (e) { /* ignore */ }

            // Iniciar sincronização em tempo real
            this.startSync();

            console.log('[LiveModal] Modal aberto para:', this.userName);
        },

        /**
         * Mostra modal de login/entrada de nome
         */
        showLoginModal() {
            return new Promise((resolve) => {
                // Remover qualquer modal de login anterior
                const existingModals = document.querySelectorAll('div[style*="position: fixed"][style*="z-index: 10000"]');
                existingModals.forEach(modal => {
                    if (modal.querySelector('#login-id') || modal.querySelector('#login-submit')) {
                        modal.remove();
                    }
                });

                // Criar overlay do login
                const loginOverlay = document.createElement('div');
                loginOverlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.95);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                `;

                const loginBox = document.createElement('div');
                loginBox.style.cssText = `
                    background: linear-gradient(135deg, #0b5cff 0%, #0b3a91 100%);
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
                    width: 90%;
                    max-width: 400px;
                    color: white;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                `;

                loginBox.innerHTML = `
                    <h2 style='margin: 0 0 10px 0; text-align: center; font-size: 24px;'>
                        <i class="fas fa-comments"></i> Entrar no Chat
                    </h2>
                    <p style='text-align: center; opacity: 0.9; margin: 0 0 25px 0; font-size: 14px;'>
                        Faça login para participar da transmissão ao vivo
                    </p>
                    
                    <div style='margin-bottom: 15px;'>
                        <label style='display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;'>
                            <i class="fas fa-user"></i> Usuário *
                        </label>
                        <input 
                            type="text" 
                            id="login-id" 
                            placeholder="Seu usuário"
                            autocomplete="username"
                            style='
                                width: 100%;
                                padding: 10px 12px;
                                border: 1px solid rgba(255, 255, 255, 0.3);
                                border-radius: 6px;
                                background: rgba(255, 255, 255, 0.1);
                                color: white;
                                font-size: 14px;
                                box-sizing: border-box;
                                font-family: inherit;
                            '
                        >
                    </div>
                    
                    <div style='margin-bottom: 20px;'>
                        <label style='display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;'>
                            <i class="fas fa-lock"></i> Senha *
                        </label>
                        <input 
                            type="password" 
                            id="login-password" 
                            placeholder="Sua senha"
                            autocomplete="current-password"
                            style='
                                width: 100%;
                                padding: 10px 12px;
                                border: 1px solid rgba(255, 255, 255, 0.3);
                                border-radius: 6px;
                                background: rgba(255, 255, 255, 0.1);
                                color: white;
                                font-size: 14px;
                                box-sizing: border-box;
                                font-family: inherit;
                            '
                        >
                    </div>

                    <div id="login-error" style='
                        margin-bottom: 15px;
                        padding: 10px;
                        border-radius: 4px;
                        background: rgba(255, 100, 100, 0.2);
                        color: #ffcccc;
                        font-size: 13px;
                        display: none;
                        text-align: center;
                    '></div>
                    
                    <button id="login-submit" style='
                        width: 100%;
                        padding: 12px;
                        background: rgba(255, 255, 255, 0.25);
                        border: 1px solid rgba(255, 255, 255, 0.5);
                        border-radius: 6px;
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                        margin-bottom: 10px;
                        font-size: 14px;
                        font-family: inherit;
                    '>
                        <i class="fas fa-sign-in-alt"></i> Entrar
                    </button>

                    <button id="login-create-account" style='
                        width: 100%;
                        padding: 12px;
                        background: rgba(100, 255, 100, 0.2);
                        border: 1px solid rgba(100, 255, 100, 0.5);
                        border-radius: 6px;
                        color: #ccffcc;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                        margin-bottom: 10px;
                        font-size: 14px;
                        font-family: inherit;
                    '>
                        <i class="fas fa-user-plus"></i> Criar Conta
                    </button>
                    
                    <button id="login-cancel" style='
                        width: 100%;
                        padding: 12px;
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        border-radius: 6px;
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                        font-size: 14px;
                        font-family: inherit;
                    '>
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    
                    <div style='margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.2); font-size: 12px; opacity: 0.8; text-align: center;'>
                        Seus dados são salvos localmente no navegador
                    </div>
                `;

                document.body.appendChild(loginOverlay);
                loginOverlay.appendChild(loginBox);

                const inputId = loginBox.querySelector('#login-id');
                const inputPassword = loginBox.querySelector('#login-password');
                const btnSubmit = loginBox.querySelector('#login-submit');
                const btnCreateAccount = loginBox.querySelector('#login-create-account');
                const btnCancel = loginBox.querySelector('#login-cancel');
                const errorDiv = loginBox.querySelector('#login-error');

                // Hover effects
                btnSubmit.addEventListener('mouseover', () => {
                    btnSubmit.style.background = 'rgba(255, 255, 255, 0.35)';
                });
                btnSubmit.addEventListener('mouseout', () => {
                    btnSubmit.style.background = 'rgba(255, 255, 255, 0.25)';
                });

                btnCreateAccount.addEventListener('mouseover', () => {
                    btnCreateAccount.style.background = 'rgba(100, 255, 100, 0.3)';
                });
                btnCreateAccount.addEventListener('mouseout', () => {
                    btnCreateAccount.style.background = 'rgba(100, 255, 100, 0.2)';
                });

                btnCancel.addEventListener('mouseover', () => {
                    btnCancel.style.background = 'rgba(255, 255, 255, 0.15)';
                });
                btnCancel.addEventListener('mouseout', () => {
                    btnCancel.style.background = 'rgba(255, 255, 255, 0.1)';
                });

                // Focus no input
                setTimeout(() => inputId.focus(), 100);

                // Mostrar erro
                const showError = (msg) => {
                    errorDiv.textContent = msg;
                    errorDiv.style.display = 'block';
                    setTimeout(() => {
                        errorDiv.style.display = 'none';
                    }, 5000);
                };

                // Submeter login
                const handleSubmit = async () => {
                    const username = inputId.value.trim();
                    const password = inputPassword.value.trim();

                    if (!username) {
                        showError('Por favor, digite seu usuário');
                        inputId.focus();
                        return;
                    }

                    if (!/^[a-zA-Z0-9]+$/.test(username)) {
                        showError('Nome deve conter apenas letras e números');
                        inputId.focus();
                        return;
                    }

                    if (!password) {
                        showError('Por favor, digite sua senha');
                        inputPassword.focus();
                        return;
                    }

                    if (username.length < 3) {
                        showError('Usuário deve ter no mínimo 3 caracteres');
                        inputId.focus();
                        return;
                    }

                    // Desabilitar botão durante requisição
                    btnSubmit.disabled = true;
                    btnSubmit.style.opacity = '0.6';
                    btnSubmit.textContent = '⏳ Autenticando...';

                    try {
                        // Validar senha no servidor
                        const response = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: username, password: password })
                        });

                        const data = await response.json();

                        if (data.ok && data.userName) {
                            // Login bem-sucedido
                            this.userName = data.userName;
                            this.userEmail = data.email || `${username}@chat.local`;
                            this.authenticated = true;

                            // Salvar dados localmente (em session e localStorage para persistência)
                            sessionStorage.setItem('liveModalUserName', this.userName);
                            sessionStorage.setItem('liveModalUserEmail', this.userEmail);
                            sessionStorage.setItem('liveModalUserId', data.id);
                            localStorage.setItem('liveModalUserName', this.userName);
                            localStorage.setItem('liveModalUserEmail', this.userEmail);
                            localStorage.setItem('liveModalUserId', data.id);

                            // Recarregar dados para garantir que authenticated está true
                            this.loadUserData();

                            console.log('[LiveModal] Usuário autenticado:', this.userName);

                            // Remover modal
                            loginOverlay.remove();
                            resolve(true);
                        } else {
                            // Falha na autenticação
                            showError(data.error || 'Falha na autenticação');
                            btnSubmit.disabled = false;
                            btnSubmit.style.opacity = '1';
                            btnSubmit.textContent = '✓ Entrar';
                            inputPassword.value = '';
                            inputPassword.focus();
                        }
                    } catch (error) {
                        console.error('[LiveModal] Erro ao fazer login:', error);
                        showError('Erro ao conectar ao servidor. Tente novamente.');
                        btnSubmit.disabled = false;
                        btnSubmit.style.opacity = '1';
                        btnSubmit.textContent = '✓ Entrar';
                    }
                };

                btnSubmit.addEventListener('click', handleSubmit);
                inputPassword.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') handleSubmit();
                });

                // Criar conta
                btnCreateAccount.addEventListener('click', () => {
                    loginOverlay.remove();
                    this.showCreateAccountModal().then((created) => {
                        if (created) {
                            resolve(true);
                        } else {
                            // Se cancelou criar conta, reabre login
                            this.showLoginModal().then(resolve);
                        }
                    });
                });

                // Cancelar
                btnCancel.addEventListener('click', () => {
                    loginOverlay.remove();
                    resolve(false);
                });
            });
        },

        /**
         * Mostra modal para criar conta
         */
        showCreateAccountModal() {
            return new Promise((resolve) => {
                // Remover qualquer modal de criar conta anterior
                const existingModals = document.querySelectorAll('div[style*="position: fixed"][style*="z-index: 10000"]');
                existingModals.forEach(modal => {
                    if (modal.querySelector('#create-id') || modal.querySelector('#create-submit')) {
                        modal.remove();
                    }
                });

                const createOverlay = document.createElement('div');
                createOverlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.95);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                `;

                const createBox = document.createElement('div');
                createBox.style.cssText = `
                    background: linear-gradient(135deg, #0b5cff 0%, #0b3a91 100%);
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
                    width: 90%;
                    max-width: 400px;
                    color: white;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                `;

                createBox.innerHTML = `
                    <h2 style='margin: 0 0 10px 0; text-align: center; font-size: 24px;'>
                        <i class="fas fa-user-plus"></i> Criar Conta
                    </h2>
                    <p style='text-align: center; opacity: 0.9; margin: 0 0 25px 0; font-size: 14px;'>
                        Registre-se para participar do chat
                    </p>
                    
                    <div style='margin-bottom: 15px;'>
                        <label style='display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;'>
                            <i class="fas fa-user"></i> Usuário *
                        </label>
                        <input 
                            type="text" 
                            id="create-id" 
                            placeholder="Seu usuário"
                            autocomplete="username"
                            style='
                                width: 100%;
                                padding: 10px 12px;
                                border: 1px solid rgba(255, 255, 255, 0.3);
                                border-radius: 6px;
                                background: rgba(255, 255, 255, 0.1);
                                color: white;
                                font-size: 14px;
                                box-sizing: border-box;
                                font-family: inherit;
                            '
                        >
                        <small style='opacity: 0.8; display: block; margin-top: 4px;'>Mínimo 3 caracteres</small>
                    </div>
                    
                    <div style='margin-bottom: 15px;'>
                        <label style='display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;'>
                            <i class="fas fa-lock"></i> Senha *
                        </label>
                        <input 
                            type="password" 
                            id="create-password" 
                            placeholder="Crie uma senha"
                            autocomplete="new-password"
                            style='
                                width: 100%;
                                padding: 10px 12px;
                                border: 1px solid rgba(255, 255, 255, 0.3);
                                border-radius: 6px;
                                background: rgba(255, 255, 255, 0.1);
                                color: white;
                                font-size: 14px;
                                box-sizing: border-box;
                                font-family: inherit;
                            '
                        >
                        <small style='opacity: 0.8; display: block; margin-top: 4px;'>Mínimo 4 caracteres</small>
                    </div>

                    <div style='margin-bottom: 20px;'>
                        <label style='display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;'>
                            <i class="fas fa-lock-open"></i> Confirmar Senha *
                        </label>
                        <input 
                            type="password" 
                            id="create-confirm-password" 
                            placeholder="Confirme a senha"
                            autocomplete="new-password"
                            style='
                                width: 100%;
                                padding: 10px 12px;
                                border: 1px solid rgba(255, 255, 255, 0.3);
                                border-radius: 6px;
                                background: rgba(255, 255, 255, 0.1);
                                color: white;
                                font-size: 14px;
                                box-sizing: border-box;
                                font-family: inherit;
                            '
                        >
                    </div>

                    <div id="create-error" style='
                        margin-bottom: 15px;
                        padding: 10px;
                        border-radius: 4px;
                        background: rgba(255, 100, 100, 0.2);
                        color: #ffcccc;
                        font-size: 13px;
                        display: none;
                        text-align: center;
                    '></div>
                    
                    <button id="create-submit" style='
                        width: 100%;
                        padding: 12px;
                        background: rgba(255, 255, 255, 0.25);
                        border: 1px solid rgba(255, 255, 255, 0.5);
                        border-radius: 6px;
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                        margin-bottom: 10px;
                        font-size: 14px;
                        font-family: inherit;
                    '>
                        <i class="fas fa-check"></i> Criar Conta
                    </button>
                    
                    <button id="create-cancel" style='
                        width: 100%;
                        padding: 12px;
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        border-radius: 6px;
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                        font-size: 14px;
                        font-family: inherit;
                    '>
                        <i class="fas fa-arrow-left"></i> Voltar
                    </button>
                `;

                document.body.appendChild(createOverlay);
                createOverlay.appendChild(createBox);

                const inputId = createBox.querySelector('#create-id');
                const inputPassword = createBox.querySelector('#create-password');
                const inputConfirmPassword = createBox.querySelector('#create-confirm-password');
                const btnSubmit = createBox.querySelector('#create-submit');
                const btnCancel = createBox.querySelector('#create-cancel');
                const errorDiv = createBox.querySelector('#create-error');

                // Hover effects
                btnSubmit.addEventListener('mouseover', () => {
                    btnSubmit.style.background = 'rgba(255, 255, 255, 0.35)';
                });
                btnSubmit.addEventListener('mouseout', () => {
                    btnSubmit.style.background = 'rgba(255, 255, 255, 0.25)';
                });

                btnCancel.addEventListener('mouseover', () => {
                    btnCancel.style.background = 'rgba(255, 255, 255, 0.15)';
                });
                btnCancel.addEventListener('mouseout', () => {
                    btnCancel.style.background = 'rgba(255, 255, 255, 0.1)';
                });

                setTimeout(() => inputId.focus(), 100);

                const showError = (msg) => {
                    errorDiv.textContent = msg;
                    errorDiv.style.display = 'block';
                    setTimeout(() => {
                        errorDiv.style.display = 'none';
                    }, 5000);
                };

                const handleSubmit = async () => {
                    const username = inputId.value.trim();
                    const password = inputPassword.value.trim();
                    const confirmPassword = inputConfirmPassword.value.trim();

                    if (!username || !password || !confirmPassword) {
                        showError('Todos os campos são obrigatórios');
                        return;
                    }

                    if (username.length < 3) {
                        showError('Usuário deve ter no mínimo 3 caracteres');
                        inputId.focus();
                        return;
                    }

                    if (password.length < 4) {
                        showError('Senha deve ter no mínimo 4 caracteres');
                        inputPassword.focus();
                        return;
                    }

                    if (password !== confirmPassword) {
                        showError('As senhas não correspondem');
                        inputPassword.value = '';
                        inputConfirmPassword.value = '';
                        inputPassword.focus();
                        return;
                    }

                    btnSubmit.disabled = true;
                    btnSubmit.style.opacity = '0.6';
                    btnSubmit.textContent = '⏳ Criando...';

                    try {
                        const response = await fetch('/api/auth/register', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: username,
                                password: password
                            })
                        });

                        const data = await response.json();

                        if (data.ok) {
                            // Conta criada com sucesso, fazer login automático
                            this.userName = data.userName || username;
                            this.userEmail = data.email || `${username}@chat.local`;
                            this.authenticated = true;

                            sessionStorage.setItem('liveModalUserName', this.userName);
                            sessionStorage.setItem('liveModalUserEmail', this.userEmail);
                            sessionStorage.setItem('liveModalUserId', data.id);
                            localStorage.setItem('liveModalUserName', this.userName);
                            localStorage.setItem('liveModalUserEmail', this.userEmail);
                            localStorage.setItem('liveModalUserId', data.id);

                            // Recarregar dados para garantir que authenticated está true
                            this.loadUserData();

                            console.log('[LiveModal] Conta criada e usuário autenticado:', this.userName);
                            createOverlay.remove();
                            resolve(true);
                        } else {
                            showError(data.error || 'Erro ao criar conta');
                            btnSubmit.disabled = false;
                            btnSubmit.style.opacity = '1';
                            btnSubmit.textContent = '✓ Criar Conta';
                        }
                    } catch (error) {
                        console.error('[LiveModal] Erro ao criar conta:', error);
                        showError('Erro ao conectar ao servidor. Tente novamente.');
                        btnSubmit.disabled = false;
                        btnSubmit.style.opacity = '1';
                        btnSubmit.textContent = '✓ Criar Conta';
                    }
                };

                btnSubmit.addEventListener('click', handleSubmit);
                inputConfirmPassword.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') handleSubmit();
                });

                btnCancel.addEventListener('click', () => {
                    createOverlay.remove();
                    resolve(false);
                });
            });
        },

        /**
         * Mostra o menu de configurações (dropdown)
         */
        showSettingsModal() {
            // Remover menu anterior se existir
            const existingMenu = document.querySelector('.live-modal-settings-menu');
            if (existingMenu) {
                existingMenu.remove();
                return;
            }

            const settingsBtn = document.querySelector('.live-modal-settings-btn');
            if (!settingsBtn) return;

            // Criar menu dropdown
            const menu = document.createElement('div');
            menu.className = 'live-modal-settings-menu';
            menu.innerHTML = `
                <div style="padding: 12px; min-width: 280px;">
                    <div style="font-size: 13px; color: #666; margin-bottom: 12px; font-weight: bold;">Meu Perfil</div>
                    
                    <!-- Avatar Preview -->
                    <div style="text-align: center; margin-bottom: 12px;">
                        <div class="avatar-preview" style="width: 70px; height: 70px; background: #e0e0e0; border-radius: 50%; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-size: 30px; overflow: hidden;">
                            👤
                        </div>
                    </div>

                    <!-- Upload Avatar -->
                    <div style="margin-bottom: 10px;">
                        <input 
                            type="file" 
                            class="settings-menu-avatar-input" 
                            accept="image/*"
                            style="display: none;"
                        >
                        <button class="settings-menu-avatar-btn" style="width: 100%; padding: 8px; background: #9e9e9e; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; transition: background 0.2s;">
                            📷 Escolher Foto
                        </button>
                    </div>

                    <!-- Trocar Nome -->
                    <div style="margin-bottom: 10px;">
                        <input 
                            type="text" 
                            class="settings-menu-input" 
                            placeholder="Novo nome"
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
                        >
                    </div>

                    <div class="settings-menu-error" style="color: #e74c3c; font-size: 12px; margin-bottom: 10px; min-height: 16px;"></div>
                    
                    <button class="settings-menu-save-btn" style="width: 100%; padding: 8px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; transition: background 0.2s; margin-bottom: 12px;">
                        ✓ Salvar
                    </button>

                    <hr style="border: none; border-top: 1px solid #eee; margin: 8px 0;">

                    <!-- Botão Sair -->
                    <button class="settings-menu-logout-btn" style="width: 100%; padding: 8px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; transition: all 0.2s;">
                        🚪 Sair
                    </button>
                </div>
            `;

            const inputName = menu.querySelector('.settings-menu-input');
            const btnAvatar = menu.querySelector('.settings-menu-avatar-btn');
            const inputAvatar = menu.querySelector('.settings-menu-avatar-input');
            const btnSave = menu.querySelector('.settings-menu-save-btn');
            const btnLogout = menu.querySelector('.settings-menu-logout-btn');
            const errorDiv = menu.querySelector('.settings-menu-error');
            const avatarPreview = menu.querySelector('.avatar-preview');

            // Event listener para logout
            if (btnLogout) {
                btnLogout.addEventListener('click', () => {
                    this.logout();
                    menu.remove();
                });
            }

            let selectedAvatar = null;

            const showError = (msg) => {
                errorDiv.textContent = msg;
                setTimeout(() => {
                    errorDiv.textContent = '';
                }, 2000);
            };

            // Carregar dados atuais
            inputName.value = this.userName || '';
            console.log('[Settings] Nome carregado:', this.userName);
            
            if (this.userAvatar) {
                avatarPreview.innerHTML = '';
                const img = document.createElement('img');
                img.src = this.userAvatar;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '50%';
                avatarPreview.appendChild(img);
                console.log('[Settings] Avatar carregado');
            }

            // Handle avatar upload
            btnAvatar.addEventListener('click', () => {
                console.log('[Settings] Clicou em escolher foto');
                inputAvatar.click();
            });

            inputAvatar.addEventListener('change', (e) => {
                console.log('[Settings] Change event disparado');
                const file = e.target.files[0];
                if (!file) {
                    console.log('[Settings] Nenhum arquivo selecionado');
                    return;
                }

                console.log('[Settings] Arquivo:', file.name, 'Size:', file.size);

                // Validar tipo
                if (!file.type.startsWith('image/')) {
                    showError('Selecione uma imagem válida');
                    return;
                }

                // Validar tamanho (máximo 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    showError('Foto muito grande (máx 5MB)');
                    return;
                }

                // Ler arquivo como base64
                const reader = new FileReader();
                reader.onerror = (err) => {
                    console.error('[Settings] Erro ao ler:', err);
                    showError('Erro ao carregar foto');
                };
                reader.onload = (event) => {
                    const originalDataUrl = event.target.result;
                    // Resize image client-side to max 128px (keeps aspect ratio) to reduce base64 size
                    const resizeMax = 128;
                    const img = new Image();
                    img.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            let w = img.width;
                            let h = img.height;
                            if (w > resizeMax || h > resizeMax) {
                                if (w > h) {
                                    h = Math.round((resizeMax / w) * h);
                                    w = resizeMax;
                                } else {
                                    w = Math.round((resizeMax / h) * w);
                                    h = resizeMax;
                                }
                            }
                            canvas.width = w;
                            canvas.height = h;
                            const ctx = canvas.getContext('2d');
                            ctx.clearRect(0, 0, w, h);
                            ctx.drawImage(img, 0, 0, w, h);
                            // Prefer JPEG for smaller size if original was not PNG with transparency
                            const isPng = file.type === 'image/png';
                            const quality = 0.8;
                            selectedAvatar = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);
                        } catch (e) {
                            console.warn('[Settings] Resize falhou, usando original:', e);
                            selectedAvatar = originalDataUrl;
                        }

                        console.log('[Settings] Base64 (resized) gerado, tamanho:', selectedAvatar.length);
                        // Atualizar preview
                        avatarPreview.innerHTML = '';
                        const pimg = document.createElement('img');
                        pimg.src = selectedAvatar;
                        pimg.style.width = '100%';
                        pimg.style.height = '100%';
                        pimg.style.objectFit = 'cover';
                        pimg.style.borderRadius = '50%';
                        avatarPreview.appendChild(pimg);

                        btnAvatar.textContent = '✓ Foto selecionada';
                        btnAvatar.style.background = '#27ae60';
                        console.log('[Settings] Preview atualizado (resized)');
                    };
                    img.onerror = (err) => {
                        console.error('[Settings] Erro ao carregar imagem para resize:', err);
                        selectedAvatar = originalDataUrl;
                        avatarPreview.innerHTML = '';
                        const pimg = document.createElement('img');
                        pimg.src = selectedAvatar;
                        pimg.style.width = '100%';
                        pimg.style.height = '100%';
                        pimg.style.objectFit = 'cover';
                        pimg.style.borderRadius = '50%';
                        avatarPreview.appendChild(pimg);
                        btnAvatar.textContent = '✓ Foto selecionada';
                        btnAvatar.style.background = '#27ae60';
                    };
                    img.src = originalDataUrl;
                };
                reader.readAsDataURL(file);
            });

            const handleSave = async () => {
                const newName = inputName.value.trim();
                console.log('[Settings] Salvando - Nome:', newName, 'Avatar:', selectedAvatar ? 'sim' : 'não');

                if (!newName && !selectedAvatar) {
                    showError('Digite um nome ou escolha uma foto');
                    return;
                }

                if (newName && newName.length < 3) {
                    showError('Mínimo 3 caracteres');
                    inputName.focus();
                    return;
                }

                if (newName && !/^[a-zA-Z0-9 _-]+$/i.test(newName)) {
                    showError('Nome deve conter apenas letras, números, espaço, _ e -');
                    inputName.focus();
                    return;
                }

                btnSave.disabled = true;
                btnSave.textContent = '⏳ Salvando...';

                try {
                    const payload = {
                        userId: sessionStorage.getItem('liveModalUserId'),
                        newName: newName || this.userName,
                        avatar: selectedAvatar
                    };
                    console.log('[Settings] Enviando para servidor:', {userId: payload.userId, newName: payload.newName, avatarSize: payload.avatar ? payload.avatar.length : 0});

                    const response = await fetch('/api/user/update-profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await response.json();
                    console.log('[Settings] Resposta:', data);

                    if (data.ok) {
                        if (newName) {
                            this.userName = newName;
                            sessionStorage.setItem('liveModalUserName', newName);
                            localStorage.setItem('liveModalUserName', newName);
                        }
                        if (selectedAvatar) {
                            this.userAvatar = selectedAvatar;
                            sessionStorage.setItem('liveModalUserAvatar', selectedAvatar);
                            localStorage.setItem('liveModalUserAvatar', selectedAvatar);
                            console.log('[Settings] Avatar salvo:', {
                                tamanho: selectedAvatar.length,
                                tipo: selectedAvatar.substring(0, 50)
                            });
                        }
                        
                        const userDisplay = document.querySelector('.live-modal-user-display');
                        if (userDisplay) {
                            let displayHtml = '';
                            if (this.userAvatar) {
                                displayHtml += `<img src="${this.userAvatar}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; margin-right: 4px;">`;
                            }
                            displayHtml += `${this.userName}`;
                            userDisplay.innerHTML = displayHtml;
                        }

                        console.log('[LiveModal] Perfil atualizado');
                        setTimeout(() => {
                            menu.remove();
                            this.renderChat(); // Atualizar chat com novo avatar
                        }, 500);
                    } else {
                        console.error('[Settings] Erro:', data.error);
                        showError(data.error || 'Erro ao atualizar');
                        btnSave.disabled = false;
                        btnSave.textContent = '✓ Salvar';
                    }
                } catch (error) {
                    console.error('[Settings] Erro de conexão:', error);
                    showError('Erro na conexão');
                    btnSave.disabled = false;
                    btnSave.textContent = '✓ Salvar';
                }
            };

            btnSave.addEventListener('click', handleSave);
            inputName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                }
            });

            // Fechar menu ao clicar fora
            const closeMenuOnClickOutside = (e) => {
                if (!menu.contains(e.target) && e.target !== settingsBtn) {
                    menu.remove();
                    document.removeEventListener('click', closeMenuOnClickOutside);
                }
            };

            document.addEventListener('click', closeMenuOnClickOutside);

            // Posicionar menu - adiciona ao body com posição fixa
            menu.style.position = 'fixed';
            const btnRect = settingsBtn.getBoundingClientRect();
            menu.style.top = (btnRect.bottom + 8) + 'px';
            menu.style.right = (window.innerWidth - btnRect.right) + 'px';
            menu.style.zIndex = '10001';
            document.body.appendChild(menu);
            inputName.focus();
        },

        /**
         * Carrega o vídeo do YouTube
         */
        async loadVideo(videoId) {
            try {
                if (window.YouTubePlayer && typeof window.YouTubePlayer.initPlayer === 'function') {
                    await window.YouTubePlayer.initPlayer(videoId);
                    console.log('[LiveModal] Vídeo carregado com YouTubePlayer');
                } else {
                    console.error('[LiveModal] YouTubePlayer não disponível');
                }
            } catch (error) {
                console.error('[LiveModal] Erro ao carregar vídeo:', error);
            }
        },

        /**
         * Extrai o ID do vídeo de uma URL do YouTube
         */
        extractVideoId(url) {
            const patterns = [
                /youtu\.be\/([a-zA-Z0-9_-]{11})/,
                /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
                /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
                /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) return match[1];
            }
            return null;
        },

        /**
         * Envia uma mensagem no chat
         */
        async sendMessage() {
            const text = this.chatInput.value.trim();
            if (!text) return;

            // Verificar se usuário está silenciado
            if (this.isUserSilenced(this.userEmail)) {
                alert('Você foi silenciado. Tente novamente em alguns minutos.');
                return;
            }

            // Recarregar avatar do storage antes de enviar
            this.userAvatar = sessionStorage.getItem('liveModalUserAvatar') || localStorage.getItem('liveModalUserAvatar') || this.userAvatar;
            console.log('[LiveModal] Avatar antes de enviar:', {
                length: this.userAvatar ? this.userAvatar.length : 0,
                hasValue: !!this.userAvatar
            });

            // Verificar se é comando
            if (text.startsWith('/')) {
                this.handleCommand(text);
                this.chatInput.value = '';
                return;
            }

            const message = {
                videoId: this.currentVideoId,
                user: this.userName,
                email: this.userEmail,
                role: this.userRole,
                avatar: this.userAvatar,
                text: text,
                timestamp: new Date().toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                })
            };

            console.log('[LiveModal] Enviando mensagem:', {
                user: this.userName,
                avatarLength: this.userAvatar ? this.userAvatar.length : 0,
                hasAvatar: !!this.userAvatar
            });

            // Limpar input imediatamente
            this.chatInput.value = '';

            // Salvar no servidor (sem adicionar localmente para evitar duplicatas)
            try {
                const response = await this.saveChatToServer(message);
                // Após salvar no servidor, recarregar chat para sincronizar
                if (response) {
                    await this.loadChatFromServer();
                }
            } catch (error) {
                console.error('[LiveModal] Erro ao salvar mensagem:', error);
            }
        },

        /**
         * Processa comandos (/, /adm, /silenciar, /clear)
         */
        handleCommand(text) {
            const parts = text.split(' ');
            const command = parts[0].toLowerCase();

            if (command === '/clear') {
                this.commandClear();
            } else if (command === '/adm') {
                this.commandAdm(parts.slice(1).join(' '));
            } else if (command === '/removeadm') {
                this.commandRemoveAdm(parts.slice(1).join(' '));
            } else if (command === '/silenciar') {
                this.commandSilenciar(parts.slice(1));
            } else if (command === '/admins') {
                this.commandListAdmins();
            } else if (command === '/email') {
                this.commandShowEmail();
            } else if (command === '/setproprietario') {
                this.commandSetProprietario(parts.slice(1).join(' '));
            } else if (command === '/proprietario') {
                this.commandShowProprietario();
            } else if (command === '/debug') {
                this.commandDebug();
            } else {
                alert('Comando desconhecido. Tente: /clear, /adm, /removeadm, /silenciar, /admins, /setproprietario, /proprietario, /debug');
            }
        },

        /**
         * /email - Mostra o email do usuário (DEBUG)
         */
        commandShowEmail() {
            alert(`� Seu nome: ${this.userName}\n👑 Nome proprietário: ${this.proprietarioName}\n\nComparação (case-insensitive):\n${(this.userName || '').toLowerCase().trim()} === ${(this.proprietarioName || '').toLowerCase().trim()}\nResultado: ${((this.userName || '').toLowerCase().trim()) === ((this.proprietarioName || '').toLowerCase().trim())}`);
        },

        /**         * /setproprietario nome - Define quem é o proprietário
         */
        commandSetProprietario(name) {
            if (!name) {
                alert('Use: /setproprietario nome_da_pessoa');
                return;
            }
            
            this.proprietarioName = name;
            sessionStorage.setItem('liveModalProprietarioName', name);
            this.setUserRole(); // Recalcular role do usuário atual
            this.renderChat(); // Atualizar chat para mostrar badges corretamente
            
            console.log(`[SISTEMA] Proprietário definido como: ${name}`);
            alert(`✅ Proprietário definido como: "${name}"\nQualquer pessoa que faça login com este nome terá badge 👑`);
        },

        /**
         * /debug - Debug info
         */
        commandDebug() {
            alert(`Debug Info:
- Seu nome: ${this.userName}
- Seu role: ${this.userRole}
- Proprietário local: ${this.proprietarioName}
- Proprietário servidor: ${this.serverProprietario}
- Video ID: ${this.currentVideoId}`);
        },

        /**
         * /proprietario - Mostra quem é o proprietário atual
         */
        commandShowProprietario() {
            if (!this.proprietarioName) {
                alert('❌ Nenhum proprietário definido ainda. Use: /setproprietario nome');
            } else {
                alert(`👑 Proprietário atual: ${this.proprietarioName}`);
            }
        },

        /**         * /clear - Limpa todo o chat (apenas ADM e PROPRIETARIO)
         */
        async commandClear() {
            if (this.userRole === 'USUARIO') {
                alert('❌ Apenas ADM e PROPRIETARIO podem usar este comando');
                return;
            }
            if (confirm('⚠️ Tem certeza que deseja limpar todo o chat?')) {
                try {
                    // Enviar comando para servidor
                    const response = await fetch('/api/chat/clear', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',  // Importante: enviar cookies de sessão
                        body: JSON.stringify({
                            videoId: this.currentVideoId,
                            userRole: this.userRole,
                            userName: this.userName,
                            clearedBy: this.userName
                        })
                    });

                    if (response.ok) {
                        // Limpar localmente
                        this.messages = [];
                        this.renderChat();
                        
                        // Notificar outras abas sobre o clear
                        sessionStorage.setItem('liveModalChatCleared', JSON.stringify({
                            videoId: this.currentVideoId,
                            clearedBy: this.userName,
                            timestamp: Date.now()
                        }));
                        
                        console.log(`[COMANDO] ${this.userName} (${this.userRole}) limpou o chat`);
                        alert('✅ Chat limpo com sucesso!');
                    } else {
                        const errorData = await response.json();
                        console.error('[ERRO CLEAR]', response.status, errorData);
                        alert(`❌ Erro ao limpar chat: ${errorData.error || 'Erro desconhecido'}`);
                    }
                } catch (error) {
                    console.error('Erro ao limpar chat:', error);
                    alert('❌ Erro ao limpar o chat: ' + error.message);
                }
            }
        },

        /**
         * /adm nome_pessoa - Torna alguém ADM (apenas PROPRIETARIO)
         */
        async commandAdm(userName) {
            if (this.userRole !== 'PROPRIETARIO') {
                alert('❌ Apenas PROPRIETARIO pode usar este comando');
                return;
            }
            if (!userName) {
                alert('Use: /adm nome_pessoa');
                return;
            }
            const user = this.messages.find(m => m.user.toLowerCase().includes(userName.toLowerCase()));
            if (!user) {
                alert(`❌ Usuário "${userName}" não encontrado no chat`);
                return;
            }
            
            try {
                // Chamar endpoint do servidor para promover ADM (persistir no banco de dados)
                const response = await fetch('/api/chat/promote-admin', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    alert(`❌ Erro ao promover: ${errorData.error || 'Erro desconhecido'}`);
                    return;
                }

                // Também salvar em sessionStorage (para UI imediata)
                const admList = JSON.parse(sessionStorage.getItem('liveModalAdmList') || '[]');
                if (!admList.includes(user.email)) {
                    admList.push(user.email);
                    sessionStorage.setItem('liveModalAdmList', JSON.stringify(admList));
                }

                console.log(`[COMANDO] ${this.userName} tornou ${user.user} (${user.email}) ADM`);
                
                // Enviar notificação para o usuário
                await this.sendNotification(user.email, `🎉 Parabéns! Você foi promovido a ADM por ${this.userName}`);
                
                alert(`✅ ${user.user} agora é ADM e a mudança foi salva no servidor!`);
            } catch (err) {
                console.error('[ERRO] Falha ao promover ADM:', err);
                alert(`❌ Erro ao promover: ${err.message}`);
            }
        },

        /**
         * /removeadm nome_pessoa - Remove alguém de ADM (apenas PROPRIETARIO)
         */
        async commandRemoveAdm(userName) {
            if (this.userRole !== 'PROPRIETARIO') {
                alert('❌ Apenas PROPRIETARIO pode usar este comando');
                return;
            }
            if (!userName) {
                alert('Use: /removeadm nome_pessoa');
                return;
            }
            const user = this.messages.find(m => m.user.toLowerCase().includes(userName.toLowerCase()));
            if (!user) {
                alert(`❌ Usuário "${userName}" não encontrado no chat`);
                return;
            }

            try {
                // Chamar endpoint do servidor para remover ADM (persistir no banco de dados)
                const response = await fetch('/api/chat/demote-admin', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    alert(`❌ Erro ao remover ADM: ${errorData.error || 'Erro desconhecido'}`);
                    return;
                }

                // Também remover do sessionStorage (para UI imediata)
                const admList = JSON.parse(sessionStorage.getItem('liveModalAdmList') || '[]');
                const index = admList.indexOf(user.email);
                if (index > -1) {
                    admList.splice(index, 1);
                    sessionStorage.setItem('liveModalAdmList', JSON.stringify(admList));
                }

                console.log(`[COMANDO] ${this.userName} removeu ${user.user} (${user.email}) de ADM`);
                
                // Enviar notificação para o usuário
                await this.sendNotification(user.email, `⚠️ Sua permissão de ADM foi removida por ${this.userName}`);
                
                alert(`✅ ${user.user} não é mais ADM e a mudança foi salva no servidor!`);
            } catch (err) {
                console.error('[ERRO] Falha ao remover ADM:', err);
                alert(`❌ Erro ao remover ADM: ${err.message}`);
            }
        },

        /**
         * /silenciar nome_pessoa tempo - Silencia alguém (apenas ADM e PROPRIETARIO)
         */
        commandSilenciar(args) {
            if (this.userRole === 'USUARIO') {
                alert('❌ Apenas ADM e PROPRIETARIO podem usar este comando');
                return;
            }
            if (args.length < 2) {
                alert('Use: /silenciar nome_pessoa tempo (ex: /silenciar João 5m ou 1h)');
                return;
            }
            const userName = args.slice(0, -1).join(' ');
            const timeStr = args[args.length - 1];
            const user = this.messages.find(m => m.user.toLowerCase().includes(userName.toLowerCase()));
            if (!user) {
                alert(`❌ Usuário "${userName}" não encontrado`);
                return;
            }
            const minutes = this.parseTime(timeStr);
            if (minutes === null) {
                alert('Formato inválido. Use: 5m (minutos) ou 1h (horas)');
                return;
            }
            const endTime = Date.now() + minutes * 60 * 1000;
            this.silencedUsers[user.email] = endTime;
            console.log(`[COMANDO] ${this.userName} (${this.userRole}) silenciou ${user.user} por ${minutes} minutos`);
            alert(`🔇 ${user.user} foi silenciado por ${minutes} minuto(s)`);
        },

        /**
         * /admins - Lista todos os ADMs
         */
        commandListAdmins() {
            const admList = JSON.parse(sessionStorage.getItem('liveModalAdmList') || '[]');
            if (admList.length === 0) {
                alert('Nenhum ADM registrado (apenas PROPRIETARIO)');
            } else {
                alert('ADMs: ' + admList.join(', '));
            }
        },

        /**
         * Envia notificação para um usuário específico
         */
        async sendNotification(userEmail, message) {
            try {
                const notification = {
                    videoId: this.currentVideoId,
                    user: 'SISTEMA',
                    email: userEmail,
                    role: 'SISTEMA',
                    text: message,
                    isNotification: true,
                    timestamp: new Date().toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })
                };
                
                await this.saveChatToServer(notification);
                console.log(`[NOTIFICAÇÃO] Enviada para ${userEmail}: ${message}`);
            } catch (error) {
                console.error('[LiveModal] Erro ao enviar notificação:', error);
            }
        },

        /**
         * Parse tempo (5m = 5 minutos, 1h = 60 minutos)
         */
        parseTime(timeStr) {
            const match = timeStr.match(/(\d+)([mh])/i);
            if (!match) return null;
            const value = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            return unit === 'h' ? value * 60 : value;
        },

        /**
         * Verifica se usuário está silenciado
         */
        isUserSilenced(email) {
            if (!this.silencedUsers[email]) return false;
            if (Date.now() > this.silencedUsers[email]) {
                delete this.silencedUsers[email];
                return false;
            }
            return true;
        },

        /**
         * Renderiza as mensagens do chat
         */
        renderChat() {
            if (this.messages.length === 0) {
                this.chatMessages.innerHTML = '<div class="live-modal-chat-empty"><i class="fas fa-comments"></i> Nenhuma mensagem ainda</div>';
                return;
            }

            // Debug: verificar avatares nas mensagens
            const avatarCount = this.messages.filter(m => m.avatar && m.avatar.length > 0).length;
            console.log(`[LiveModal] Renderizando ${this.messages.length} mensagens - ${avatarCount} com avatar`);

            this.chatMessages.innerHTML = this.messages.map((msg, idx) => {
                // Verifica se é uma notificação do sistema
                if (msg.role === 'SISTEMA' || msg.user === 'SISTEMA') {
                    return `
                        <div class="live-modal-chat-message" style="border-left-color: #9C27B0; background-color: rgba(156, 39, 176, 0.05); opacity: 1;">
                            <div>
                                <span class="live-modal-chat-user" style="color: #9C27B0; font-weight: bold;">🔔 NOTIFICAÇÃO</span>
                                <span class="live-modal-chat-timestamp">${msg.timestamp}</span>
                            </div>
                            <div class="live-modal-chat-text" style="color: #9C27B0; font-weight: 500;">${this.escapeHtml(msg.text)}</div>
                        </div>
                    `;
                }

                if (idx === 0) {
                    console.log('[LiveModal] Primeira mensagem:', {user: msg.user, hasAvatar: !!msg.avatar, avatarLength: msg.avatar ? msg.avatar.length : 0});
                }

                const isMine = msg.email === this.userEmail;
                let role = 'USUARIO';
                
                // Normalizar nomes para comparação (lowercase, sem espaços)
                const msgName = (msg.user || '').toLowerCase().trim();
                const propName = (this.proprietarioName || '').toLowerCase().trim();
                const serverPropName = (this.serverProprietario || '').toLowerCase().trim();
                
                // Sempre determina o role baseado no NOME (proprietário do servidor tem prioridade)
                if (serverPropName && msgName === serverPropName) {
                    // Se há proprietário definido no servidor, usa ele
                    role = 'PROPRIETARIO';
                } else if (msgName === propName) {
                    role = 'PROPRIETARIO';
                } else {
                    const admList = JSON.parse(sessionStorage.getItem('liveModalAdmList') || '[]');
                    // Normalizar emails na lista de ADMs também
                    const normalizedAdmList = admList.map(e => (e || '').toLowerCase().trim());
                    const msgEmail = (msg.email || '').toLowerCase().trim();
                    
                    // Debug
                    if (msg.role === 'ADM') {
                        console.log(`[DEBUG RENDER] msgEmail: ${msgEmail}, admList: ${JSON.stringify(normalizedAdmList)}, isADM: ${normalizedAdmList.includes(msgEmail)}`);
                    }
                    
                    if (normalizedAdmList.includes(msgEmail)) {
                        role = 'ADM';
                    } else if (msg.role === 'ADM' || msg.role === 'PROPRIETARIO') {
                        // Se a mensagem tem role salvo, usa como fallback
                        role = msg.role;
                    }
                }
                
                let roleColor = this.getUserColor(msg.user);
                let roleIcon = '';
                let roleBadge = '';
                let textShadow = `0 0 10px ${roleColor}`;

                // Ajusta cor/ícone de role antes de renderizar avatar (usa cor correta na borda)
                if (role === 'PROPRIETARIO') {
                    roleColor = '#ff6b6b';
                    roleIcon = '👑';
                    roleBadge = '';
                    textShadow = '0 0 10px #ff6b6b';
                } else if (role === 'ADM') {
                    roleColor = '#ffd700';
                    roleIcon = '⚡';
                    roleBadge = '';
                    textShadow = '0 0 10px #ffd700';
                }

                // Avatar da imagem de configurações — prioriza avatar da mensagem,
                // se não existir usa o avatar configurado do usuário ao enviar (mensagens próprias),
                // caso contrário mostra o placeholder circular.
                let avatarImg = '';
                if (msg.avatar && msg.avatar.length > 0) {
                    avatarImg = `<img src="${msg.avatar}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid ${roleColor};" alt="${msg.user}" title="${msg.user}">`;
                } else if (isMine && this.userAvatar) {
                    // Usa avatar configurado nas settings para as próprias mensagens
                    avatarImg = `<img src="${this.userAvatar}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid ${roleColor};" alt="${this.userName}" title="${this.userName}">`;
                } else {
                    // Círculo vazio se não tiver avatar
                    avatarImg = `<div style="width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0; flex-shrink: 0; border: 2px solid ${roleColor};"></div>`;
                }
                
                return `
                    <div class="live-modal-chat-message" style="border-left-color: ${isMine ? '#ff9800' : '#0b5cff'}; opacity: ${isMine ? '1' : '0.95'};">
                        <div class="avatar-wrap">${avatarImg}</div>
                        <div class="live-modal-chat-body" style="flex: 1; min-width: 0;">
                            <div class="live-modal-chat-meta" style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
                                <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                                    <span class="live-modal-chat-user" style="color: ${roleColor}; text-shadow: ${textShadow}; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${roleIcon} ${this.escapeHtml(msg.user)}</span>
                                </div>
                                <span class="live-modal-chat-timestamp">${this.escapeHtml(msg.timestamp || '')}</span>
                            </div>
                            <div class="live-modal-chat-text" style="color: #fff; font-size: 14px; word-wrap: break-word; word-break: break-word;">${this.escapeHtml(msg.text)}</div>
                        </div>
                    </div>
                `;
            }).join('');

            // Auto-scroll
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        },

        /**
         * Salva mensagem no servidor
         */
        async saveChatToServer(message) {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(message)
                });

                if (!response.ok) {
                    console.error('[LiveModal] Erro ao salvar mensagem:', response.status);
                    return false;
                }
                return true;
            } catch (error) {
                console.error('[LiveModal] Erro de conexão ao salvar mensagem:', error);
                return false;
            }
        },

        /**
         * Carrega mensagens do servidor
         */
        async loadChatFromServer() {
            try {
                if (!this.currentVideoId) return;

                const response = await fetch(`/api/chat?videoId=${encodeURIComponent(this.currentVideoId)}&limit=100`);
                if (!response.ok) {
                    console.warn('[LiveModal] Não foi possível carregar chat do servidor');
                    return;
                }

                const messages = await response.json();
                if (Array.isArray(messages)) {
                    this.messages = messages.map(msg => ({
                        ...msg,
                        timestamp: msg.timestamp || new Date(msg.createdAt).toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        })
                    }));
                    console.log(`[LiveModal] ${this.messages.length} mensagens carregadas - ${this.messages.filter(m => m.avatar).length} com avatar`);
                    this.renderChat();
                    this.lastSyncTime = Date.now();
                    
                    // Atualizar contagem de usuários online
                    this.updateOnlineCount();
                }
            } catch (error) {
                console.log('[LiveModal] Usando chat local (sem sincronização)');
            }
        },

        /**
         * Inicia sincronização automática de chat
         */
        startSync() {
            if (this.syncInterval) clearInterval(this.syncInterval);
            
            this.syncInterval = setInterval(async () => {
                if (!this.currentVideoId) return;
                
                try {
                    // Verificar status de admin periodicamente (a cada 5 segundos)
                    if (Date.now() % 5000 < 1000) {
                        await this.setUserRole();
                    }
                    
                    // Sincronizar proprietário do servidor
                    try {
                        const propUrl = `/api/chat/proprietario?videoId=${encodeURIComponent(this.currentVideoId)}`;
                        const propResp = await fetch(propUrl);
                        if (propResp.ok) {
                            const propData = await propResp.json();
                            if (propData.name) {
                                this.serverProprietario = propData.name;
                            }
                        }
                    } catch (e) {
                        // Erro silencioso ao sincronizar proprietário
                    }
                    
                    const response = await fetch(`/api/chat?videoId=${encodeURIComponent(this.currentVideoId)}&limit=100`);
                    if (!response.ok) return;

                    const serverMessages = await response.json();
                    if (!Array.isArray(serverMessages)) return;

                    // SEMPRE sincronizar (comparar por IDs para evitar duplicatas)
                    const serverIds = serverMessages.map(m => m.id);
                    const localIds = this.messages.map(m => m.id);
                    
                    // Se há mensagens novas no servidor ou foi removida alguma
                    const hasNewMessages = serverIds.some(id => !localIds.includes(id));
                    const hasRemovedMessages = localIds.some(id => !serverIds.includes(id));
                    
                    if (serverMessages.length !== this.messages.length || hasNewMessages || hasRemovedMessages) {
                        this.messages = serverMessages.map(msg => ({
                            ...msg,
                            timestamp: msg.timestamp || new Date(msg.createdAt).toLocaleTimeString('pt-BR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            })
                        }));
                        this.renderChat();
                        setTimeout(() => {
                            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                        }, 0);
                    }
                    
                    // Atualizar contagem de usuários online localmente
                    this.updateOnlineCount();

                    // Enviar presença ao servidor a cada 5 segundos para contagem real
                    if (!this._lastPresencePing) this._lastPresencePing = 0;
                    if (Date.now() - this._lastPresencePing > 5000) {
                        this._lastPresencePing = Date.now();
                        this.pingPresence().catch(()=>{});
                    }
                } catch (error) {
                    // Silenciosamente ignorar erros
                }
            }, 1000); // Aumentado para 1 segundo para sincronização mais rápida
        },

        /**
         * Atualiza a contagem de usuários online baseado no servidor (presenceId)
         * Esta função é usada como fallback quando o server está disponível
         */
        updateOnlineCount() {
            if (!this.chatHeaderOnlineCount) return;
            // Apenas chamar pingPresence para obter contagem atualizada do servidor
            this.pingPresence().catch(()=>{});
        },

        /**
         * Envia presença ao servidor e atualiza contagem baseada no servidor
         */
        async pingPresence() {
            if (!this.currentVideoId || !this.chatHeaderOnlineCount) return;
            try {
                const id = this.presenceId || this.userEmail || this.userName || (sessionStorage.getItem('liveModalGuestId') || 'guest');
                const resp = await fetch('/api/chat/presence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ videoId: this.currentVideoId, id, email: this.userEmail || null })
                });
                if (!resp.ok) return;
                const data = await resp.json();
                if (data && typeof data.count === 'number') {
                    const c = Math.max(1, data.count);
                    this.chatHeaderOnlineCount.textContent = c === 1 ? '1 online' : `${c} online`;
                }
            } catch (e) {
                // ignore
            }
        },

        /**
         * Para sincronização
         */
        stopSync() {
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
            }
        },

        /**
         * Fecha o modal
         */
        close() {
            console.log('[LiveModal] Fechando modal');

            this.stopSync();

            if (window.YouTubePlayer && typeof window.YouTubePlayer.stopVideo === 'function') {
                window.YouTubePlayer.stopVideo();
            }

            this.overlay.classList.remove('active');
            document.body.style.overflow = '';

            this.currentVideoId = null;
            this.messages = [];

            console.log('[LiveModal] Modal fechado');
        },

        /**
         * Escapa caracteres HTML
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        /**
         * Logout do usuário
         */
        logout() {
            // Limpar dados do usuário
            this.userName = null;
            this.userEmail = null;
            this.authenticated = false;
            this.userRole = 'USUARIO';
            sessionStorage.removeItem('liveModalUserName');
            sessionStorage.removeItem('liveModalUserEmail');
            sessionStorage.removeItem('liveModalUserRole');
            
            // Parar sincronização
            this.stopSync();
            
            // Fechar modal
            this.close();
            
            console.log('[LiveModal] Usuário desconectado');
            
            // Reabrir modal para login novamente
            setTimeout(() => {
                this.open();
            }, 100);
        }
    };

    return modal;
})();

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.LiveModal) {
            window.LiveModal.init();
        }
    });
} else {
    if (window.LiveModal) {
        window.LiveModal.init();
    }
}
