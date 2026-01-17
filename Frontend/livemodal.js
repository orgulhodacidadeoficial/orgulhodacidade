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
        currentVideoId: null,
        messages: [],
        userName: null,
        userEmail: null,
        userRole: 'USUARIO', // USUARIO, ADM, PROPRIETARIO
        syncInterval: null,
        lastSyncTime: 0,
        authenticated: false,
        silencedUsers: {}, // { email: timestamp_fim }
        proprietarioName: null, // Será carregado do sessionStorage
        serverProprietario: null, // Proprietário definido no servidor (em tempo real)
        chatWs: null, // WebSocket para chat em tempo real
        wsConnecting: false, // Flag para evitar múltiplas conexões

        /**
         * Inicializa o modal
         */
        init() {
            console.log('[LiveModal] Inicializando...');
            this.createModal();
            this.setupEventListeners();
            this.loadUserData();
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
                    <button class="live-modal-logout-btn" aria-label="Logout">
                        <i class="fas fa-sign-out-alt"></i> Sair
                    </button>
                </div>
                <h2 class="live-modal-title">Transmissão ao vivo</h2>
                <div class="live-modal-header-right">
                    <span class="live-modal-user-display"></span>
                    <button class="live-modal-close-btn" aria-label="Fechar transmissão">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            this.closeBtn = header.querySelector('.live-modal-close-btn');
            const logoutBtn = header.querySelector('.live-modal-logout-btn');
            logoutBtn.addEventListener('click', () => this.logout());

            // Content (vídeo + chat)
            const content = document.createElement('div');
            content.className = 'live-modal-content';

            // Video container
            this.videoContainer = document.createElement('div');
            this.videoContainer.className = 'live-modal-video-container';
            this.videoContainer.innerHTML = '<div id="youtubePlayer"></div>';

            // Chat container
            const chatContainer = document.createElement('div');
            chatContainer.className = 'live-modal-chat-container';

            const chatHeader = document.createElement('div');
            chatHeader.className = 'live-modal-chat-header';
            chatHeader.innerHTML = `
                <i class="fas fa-comments"></i> Chat ao vivo
            `;

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

            content.appendChild(this.videoContainer);
            content.appendChild(chatContainer);

            this.container.appendChild(header);
            this.container.appendChild(content);

            this.overlay.appendChild(this.container);
            document.body.appendChild(this.overlay);

            console.log('[LiveModal] Estrutura HTML criada');
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

            // Detectar eventos de outras abas (ex: /clear)
            window.addEventListener('storage', (e) => {
                if (e.key === 'liveModalChatCleared') {
                    const data = JSON.parse(e.newValue || '{}');
                    if (data.videoId === this.currentVideoId && data.timestamp > (this.lastSyncTime - 1000)) {
                        console.log('[LiveModal] Chat limpo por outra aba, recarregando...');
                        this.messages = [];
                        this.renderChat();
                        this.loadChatFromServer(); // Recarregar do servidor
                    }
                }
            });
        },

        /**
         * Carrega dados do usuário do storage
         */
        loadUserData() {
            this.userName = sessionStorage.getItem('liveModalUserName') || null;
            this.userEmail = sessionStorage.getItem('liveModalUserEmail') || null;
            this.proprietarioName = sessionStorage.getItem('liveModalProprietarioName') || null; // Carregar proprietário
            this.authenticated = !!(this.userName && this.userEmail);
            
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
                        console.log(`[ADMINS LOADED] ${data.admins.length} ADMs carregados do servidor`);
                    }
                } else {
                    console.warn('[ADMINS LOADED] Erro ao carregar lista de ADMs do servidor');
                }
            } catch (err) {
                console.error('[ADMINS LOADED] Erro ao conectar com servidor:', err);
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
         * Abre o modal com um vídeo do YouTube
         */
        async open(youtubeUrl, title = 'Transmissão ao vivo') {
            console.log('[LiveModal] Abrindo para URL:', youtubeUrl);

            // Se não autenticado, mostrar login primeiro
            if (!this.authenticated) {
                await this.showLoginModal();
                if (!this.authenticated) {
                    console.log('[LiveModal] Usuário cancelou login');
                    return;
                }
            }

            // Extrair video ID
            const videoId = this.extractVideoId(youtubeUrl);
            if (!videoId) {
                console.error('[LiveModal] ID de vídeo inválido');
                alert('URL do YouTube inválida');
                return;
            }

            this.currentVideoId = videoId;

            // Atualizar título
            const titleEl = this.container.querySelector('.live-modal-title');
            if (titleEl) titleEl.textContent = title;

            // Atualizar info do usuário no header
            const userDisplay = this.container.querySelector('.live-modal-user-display');
            if (userDisplay) {
                userDisplay.innerHTML = `<i class="fas fa-user-circle"></i> <strong>${this.escapeHtml(this.userName)}</strong>`;
            }

            // Mostrar overlay
            this.overlay.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Carregar vídeo
            await this.loadVideo(videoId);

            // Carregar mensagens do servidor
            await this.loadChatFromServer();

            // Iniciar sincronização em tempo real
            this.startSync();

            console.log('[LiveModal] Modal aberto para:', this.userName);
        },

        /**
         * Mostra modal de login/entrada de nome
         */
        showLoginModal() {
            return new Promise((resolve) => {
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
                    <h2 style="margin: 0 0 10px 0; text-align: center; font-size: 24px;">
                        <i class="fas fa-comments"></i> Entrar no Chat
                    </h2>
                    <p style="text-align: center; opacity: 0.9; margin: 0 0 25px 0; font-size: 14px;">
                        Defina seu nome para participar da transmissão ao vivo
                    </p>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                            <i class="fas fa-user"></i> Seu Nome *
                        </label>
                        <input 
                            type="text" 
                            id="login-name" 
                            placeholder="Digite seu nome"
                            autocomplete="off"
                            style="
                                width: 100%;
                                padding: 10px 12px;
                                border: 1px solid rgba(255, 255, 255, 0.3);
                                border-radius: 6px;
                                background: rgba(255, 255, 255, 0.1);
                                color: white;
                                font-size: 14px;
                                box-sizing: border-box;
                                font-family: inherit;
                            "
                        >
                        <small style="opacity: 0.8; display: block; margin-top: 4px;">Mínimo 3 caracteres</small>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                            <i class="fas fa-envelope"></i> Email (Opcional)
                        </label>
                        <input 
                            type="email" 
                            id="login-email" 
                            placeholder="seu@email.com"
                            autocomplete="email"
                            style="
                                width: 100%;
                                padding: 10px 12px;
                                border: 1px solid rgba(255, 255, 255, 0.3);
                                border-radius: 6px;
                                background: rgba(255, 255, 255, 0.1);
                                color: white;
                                font-size: 14px;
                                box-sizing: border-box;
                                font-family: inherit;
                            "
                        >
                        <small style="opacity: 0.8; display: block; margin-top: 4px;">Para recuperar sua conta depois</small>
                    </div>
                    
                    <button id="login-submit" style="
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
                    ">
                        <i class="fas fa-sign-in-alt"></i> Entrar
                    </button>
                    
                    <button id="login-cancel" style="
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
                    ">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.2); font-size: 12px; opacity: 0.8; text-align: center;">
                        Seus dados são salvos localmente no navegador
                    </div>
                `;

                document.body.appendChild(loginOverlay);
                loginOverlay.appendChild(loginBox);

                const inputName = loginBox.querySelector('#login-name');
                const inputEmail = loginBox.querySelector('#login-email');
                const btnSubmit = loginBox.querySelector('#login-submit');
                const btnCancel = loginBox.querySelector('#login-cancel');

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

                // Focus no input
                setTimeout(() => inputName.focus(), 100);

                // Submeter
                const handleSubmit = () => {
                    const name = inputName.value.trim();
                    const email = inputEmail.value.trim();

                    if (!name || name.length < 3) {
                        alert('Por favor, digite seu nome (mínimo 3 caracteres)');
                        inputName.focus();
                        return;
                    }

                    if (name.length > 50) {
                        alert('Nome muito longo (máximo 50 caracteres)');
                        inputName.focus();
                        return;
                    }

                    if (email && !this.isValidEmail(email)) {
                        alert('Por favor, digite um email válido');
                        inputEmail.focus();
                        return;
                    }

                    // Salvar dados
                    this.userName = name;
                    this.userEmail = email || `usuario_${Date.now()}@chat.local`;
                    this.authenticated = true;

                    // Salvar localmente (sessionStorage para essa sessão)
                    sessionStorage.setItem('liveModalUserName', this.userName);
                    sessionStorage.setItem('liveModalUserEmail', this.userEmail);

                    console.log('[LiveModal] Usuário autenticado:', this.userName);

                    // Remover modal
                    loginOverlay.remove();
                    resolve(true);
                };

                btnSubmit.addEventListener('click', handleSubmit);
                inputName.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') handleSubmit();
                });

                // Cancelar
                btnCancel.addEventListener('click', () => {
                    loginOverlay.remove();
                    resolve(false);
                });
            });
        },

        /**
         * Valida email
         */
        isValidEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
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
                text: text,
                timestamp: new Date().toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                })
            };

            // Limpar input imediatamente
            this.chatInput.value = '';

            // Adicionar localmente para feedback instantâneo
            const localMsg = {
                id: Date.now(),
                ...message
            };
            this.messages.push(localMsg);
            this.renderChat();

            // Auto-scroll
            setTimeout(() => {
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }, 0);
            // Salvar no servidor
            try {
                await this.saveChatToServer(message);
                
                // ✨ Também enviar via WebSocket para sincronização em tempo real
                if (this.chatWs && this.chatWs.readyState === WebSocket.OPEN) {
                    const wsMessage = {
                        type: 'message',
                        data: {
                            ...localMsg,
                            videoId: this.currentVideoId
                        }
                    };
                    this.chatWs.send(JSON.stringify(wsMessage));
                    console.log('[LiveModal] Mensagem enviada via WebSocket');
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

            this.chatMessages.innerHTML = this.messages.map(msg => {
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
                
                let roleColor = '#666';
                let roleIcon = '';
                let roleBadge = '';
                
                if (role === 'PROPRIETARIO') {
                    roleColor = '#ff6b6b';
                    roleIcon = '👑';
                    roleBadge = '<span style="color: #ff6b6b; font-weight: bold; font-size: 11px; margin-left: 8px;">[PROPRIETARIO]</span>';
                } else if (role === 'ADM') {
                    roleColor = '#ffd700';
                    roleIcon = '⚡';
                    roleBadge = '<span style="color: #ffd700; font-weight: bold; font-size: 11px; margin-left: 8px;">[ADM]</span>';
                }
                
                return `
                    <div class="live-modal-chat-message" style="border-left-color: ${isMine ? '#ff9800' : '#0b5cff'}; opacity: ${isMine ? '1' : '0.95'};">
                        <div>
                            <span class="live-modal-chat-user" style="${role !== 'USUARIO' ? `color: ${roleColor};` : ''}">${roleIcon} ${this.escapeHtml(msg.user)}</span>
                            ${roleBadge}
                            <span class="live-modal-chat-timestamp">${msg.timestamp}</span>
                        </div>
                        <div class="live-modal-chat-text">${this.escapeHtml(msg.text)}</div>
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
                const apiUrl = window.location.origin + '/api/chat';
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(message)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[LiveModal] Erro ao salvar mensagem:', response.status, errorText);
                    return;
                }
                
                const data = await response.json();
                console.log('[LiveModal] Mensagem salva com sucesso:', data);
            } catch (error) {
                console.error('[LiveModal] Erro de conexão ao salvar mensagem:', error);
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
                    this.renderChat();
                    this.lastSyncTime = Date.now();
                    console.log(`[LiveModal] Carregadas ${this.messages.length} mensagens`);
                }
            } catch (error) {
                console.log('[LiveModal] Usando chat local (sem sincronização)');
            }
        },

        /**
         * Conecta ao WebSocket de chat em tempo real
         */
        connectChatWebSocket() {
            if (this.wsConnecting || this.chatWs) return; // Já está conectado ou conectando
            
            this.wsConnecting = true;
            
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/ws/chat?videoId=${encodeURIComponent(this.currentVideoId)}`;
                
                console.log('[LiveModal] Conectando ao WebSocket:', wsUrl);
                
                this.chatWs = new WebSocket(wsUrl);
                
                this.chatWs.onopen = () => {
                    console.log('[LiveModal WS] Conectado com sucesso');
                    this.wsConnecting = false;
                };
                
                this.chatWs.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        console.log('[LiveModal WS] Mensagem recebida:', message.type);
                        
                        if (message.type === 'message' && message.data) {
                            // Adicionar mensagem recebida do servidor
                            const incomingMsg = message.data;
                            
                            // Verificar se já existe (evitar duplicatas)
                            const exists = this.messages.find(m => m.id === incomingMsg.id);
                            if (!exists) {
                                this.messages.push(incomingMsg);
                                this.renderChat();
                                setTimeout(() => {
                                    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                                }, 0);
                            }
                        }
                    } catch (e) {
                        console.warn('[LiveModal WS] Erro ao processar mensagem:', e);
                    }
                };
                
                this.chatWs.onerror = (error) => {
                    console.error('[LiveModal WS] Erro:', error);
                    this.wsConnecting = false;
                };
                
                this.chatWs.onclose = () => {
                    console.log('[LiveModal WS] Desconectado');
                    this.chatWs = null;
                    this.wsConnecting = false;
                };
            } catch (e) {
                console.error('[LiveModal WS] Erro ao criar WebSocket:', e);
                this.wsConnecting = false;
            }
        },

        /**
         * Inicia sincronização automática de chat
         */
        startSync() {
            // ✨ Conectar ao WebSocket de chat
            this.connectChatWebSocket();
            
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
                            console.log(`[DEBUG] Proprietário do servidor:`, propData);
                            if (propData.name) {
                                this.serverProprietario = propData.name;
                            }
                        }
                    } catch (e) {
                        console.error(`[DEBUG] Erro ao sincronizar proprietário:`, e);
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
                    } else if (this.serverProprietario) {
                        // Se há proprietário no servidor, re-renderizar para atualizar badges
                        this.renderChat();
                    }
                } catch (error) {
                    // Silenciosamente ignorar erros
                }
            }, 1000); // Aumentado para 1 segundo para sincronização mais rápida
        },

        /**
         * Para sincronização
         */
        stopSync() {
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
            }
            
            // ✨ Fechar WebSocket
            if (this.chatWs) {
                try {
                    this.chatWs.close();
                } catch (e) {
                    console.warn('[LiveModal] Erro ao fechar WebSocket:', e);
                }
                this.chatWs = null;
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
