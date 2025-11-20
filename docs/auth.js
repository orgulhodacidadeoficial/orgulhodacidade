// Gerenciamento de autenticação
const Auth = {
    currentUser: null,
    authModal: null,
    loginForm: null,
    registerForm: null,
    activeTab: 'login',

    init() {
        // Validate session with server; do NOT auto-login from localStorage.
        // This ensures only server-validated logins are treated as authenticated.
        this.checkSession().then((ok) => {
            if (ok && window.LiveChat && typeof window.LiveChat.connect === 'function') {
                try { window.LiveChat.connect(); } catch(e) { console.warn('LiveChat.connect error after session check', e); }
            }
        }).catch(e => console.warn('Auth.init: checkSession error', e));

        // Inicializar elementos
        this.authModal = document.getElementById('authModal');
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');

        // Event listeners
        this.setupEventListeners();
        this.setupTabSwitching();
    },

    setupEventListeners() {
        // Forms
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        this.registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Remove/disable guest button if present (visitor mode removed)
        const guestButton = document.getElementById('guestButton');
        if (guestButton) {
            console.log('Auth: guestButton found — removing guest/visitor option');
            try { guestButton.remove(); } catch (e) { guestButton.style.display = 'none'; }
        }

        // Fechar modal quando clicar fora
        this.authModal.addEventListener('click', (e) => {
            if (e.target === this.authModal) {
                this.hideModal();
            }
        });

        // Fechar via botão 'x' se existir
        const closeBtn = document.getElementById('authModalClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideModal();
            });
        }
    },

    setupTabSwitching() {
        const tabs = document.querySelectorAll('.auth-tab');
        const tabLinks = document.querySelectorAll('.auth-info a');

        // Click nos botões de tab
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // Click nos links "Criar conta" / "Entrar"
        tabLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(link.dataset.tab);
            });
        });
    },

    switchTab(tab) {
        if (tab === this.activeTab) return;

        // Update active tab
        document.querySelector(`.auth-tab[data-tab="${this.activeTab}"]`).classList.remove('active');
        document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');

        // Show/hide forms
        if (tab === 'login') {
            this.registerForm.style.display = 'none';
            this.loginForm.style.display = 'block';
        } else {
            this.loginForm.style.display = 'none';
            this.registerForm.style.display = 'block';
        }

        // Clear messages
        this.clearMessages();
        this.activeTab = tab;
    },

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const button = this.loginForm.querySelector('button');

        try {
            this.setLoading(button, true);
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Erro ao fazer login');

            // Salvar usuário e conectar ao chat
            this.setCurrentUser(data.user);
            this.hideModal();

            // Se o modal de live estiver aberto, reconectar o chat
            if (window.LiveChat && typeof window.LiveChat.connect === 'function') {
                window.LiveChat.connect();
            }
        } catch (err) {
            this.showError(this.loginForm, err.message);
        } finally {
            this.setLoading(button, false);
        }
    },

    async handleRegister() {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const button = this.registerForm.querySelector('button');

        try {
            this.setLoading(button, true);
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Erro ao criar conta');

            // Registro bem sucedido: salvar usuário e conectar
            this.setCurrentUser(data.user);
            this.hideModal();

            // Se o modal de live estiver aberto, conectar ao chat
            if (window.LiveChat && typeof window.LiveChat.connect === 'function') {
                window.LiveChat.connect();
            }
        } catch (err) {
            this.showError(this.registerForm, err.message);
        } finally {
            this.setLoading(button, false);
        }
    },

    // visitor/guest flow removed — please authenticate via login/register

    setCurrentUser(user) {
        // Restaurar roles (isAdmin, isPresident) do localStorage se não virem do servidor
        try {
            const savedUser = localStorage.getItem('chatUser');
            if (savedUser) {
                const localUser = JSON.parse(savedUser);
                if (localUser.isAdmin && !user.isAdmin) {
                    user.isAdmin = localUser.isAdmin;
                    console.log('Auth: restaurando isAdmin do localStorage');
                }
                if (localUser.isPresident && !user.isPresident) {
                    user.isPresident = localUser.isPresident;
                    console.log('Auth: restaurando isPresident do localStorage');
                }
            }
        } catch (e) {
            console.warn('Auth: erro ao restaurar roles do localStorage', e);
        }

        // Padronizar nome: primeira letra maiúscula
        if (user && user.name) {
            user.name = user.name.charAt(0).toUpperCase() + user.name.slice(1).toLowerCase();
        }

        this.currentUser = user;
    localStorage.setItem('chatUser', JSON.stringify(user));
    // Persistir estado simples de sessão para manter botão Sair visível após reload/fechar chat
    try { localStorage.setItem('userLogged', 'true'); } catch(e) { console.warn('Auth: não foi possível setar userLogged no localStorage', e); }
        // Propagate to LiveChat (if loaded) and enable chat input
        try {
            if (window.LiveChat) {
                // Enable authenticated mode and reconnect with user credentials
                if (typeof window.LiveChat.enableAuthenticatedMode === 'function') {
                    try { window.LiveChat.enableAuthenticatedMode(); } catch(e) { console.warn('LiveChat.enableAuthenticatedMode error', e); }
                }
                // Prefer calling the LiveChat API so it can reconcile state and connect if needed
                if (typeof window.LiveChat.setCurrentUser === 'function') {
                    try { window.LiveChat.setCurrentUser(user); } catch(e) { console.warn('LiveChat.setCurrentUser error', e); }
                } else {
                    window.LiveChat.currentUser = user;
                }
                // ensure event listeners exist (in case modal was created after login)
                if (typeof window.LiveChat.setupEventListeners === 'function') {
                    try { window.LiveChat.setupEventListeners(); } catch(e) { console.warn('LiveChat.setupEventListeners error', e); }
                }
                const input = document.querySelector('.live-chat-input input');
                const btn = document.querySelector('.live-chat-input button');
                const authBtn = document.getElementById('chatAuthButton');
                const logoutBtn = document.getElementById('chatLogoutButton');
                if (input) {
                    input.disabled = false;
                    try { input.focus(); } catch(e) {}
                }
                if (btn) btn.disabled = false;
                if (authBtn) authBtn.textContent = user.name || 'Sair';
                if (logoutBtn) logoutBtn.classList.add('visible');

                // Populate chat user info element (avatar + name)
                try {
                    const userInfo = document.getElementById('chatUserInfo');
                    if (userInfo) {
                        const avatarSrc = (user && user.avatar) ? user.avatar : '/images/logo.png';
                        let titleHtml = '';
                        try {
                            if (user.isPresident) titleHtml = '<span class="role-title president-title">Presidente</span>';
                            else if (user.isAdmin) titleHtml = '<span class="role-title admin-title">ADM</span>';
                        } catch (e) {}
                        userInfo.innerHTML = `<img src="${avatarSrc}" alt="${(user && user.name) || 'Usuário'}"><div class="chat-user-name"><span class="user-name-display">${(user && user.name) || 'Usuário'}</span>${titleHtml}</div>`;
                        userInfo.style.display = '';
                    }
                } catch (e) { console.warn('Auth: erro ao popular chatUserInfo', e); }
            }
        } catch (e) {
            // ignore
        }
    },

    showModal() {
        this.authModal.classList.add('active');
        // Resetar para o tab de login
        this.switchTab('login');
    },

    hideModal() {
        this.authModal.classList.remove('active');
        this.clearMessages();
        this.loginForm.reset();
        this.registerForm.reset();
    },

    showError(form, message) {
        const msgEl = form.querySelector('.auth-message');
        msgEl.textContent = message;
        msgEl.className = 'auth-message error';
    },

    showSuccess(form, message) {
        const msgEl = form.querySelector('.auth-message');
        msgEl.textContent = message;
        msgEl.className = 'auth-message success';
    },

    clearMessages() {
        const messages = this.authModal.querySelectorAll('.auth-message');
        messages.forEach(msg => {
            msg.textContent = '';
            msg.className = 'auth-message';
        });
    },

    setLoading(button, isLoading) {
        button.disabled = isLoading;
        button.classList.toggle('loading', isLoading);
    },

    async checkSession() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();
            
            if (data.user) {
                this.setCurrentUser(data.user);
                return true;
            }
            
            // Sem sessão: limpar localStorage
            localStorage.removeItem('chatUser');
            this.currentUser = null;
            return false;
        } catch (err) {
            console.error('Erro verificando sessão:', err);
            return false;
        }
    },

    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            console.error('Erro no logout:', e);
        }
        
    // Limpar completamente todo armazenamento do usuário anterior
    localStorage.removeItem('chatUser');
    // Remover flag de login persistente
    try { localStorage.removeItem('userLogged'); } catch(e) { console.warn('Auth.logout: não foi possível remover userLogged', e); }
        sessionStorage.clear();
        this.currentUser = null;
        
        try {
            if (window.LiveChat) {
                // Desconectar WebSocket e limpar estado do chat
                if (window.LiveChat.ws && window.LiveChat.ws.readyState === WebSocket.OPEN) {
                    console.log('Auth.logout: fechando WebSocket do chat');
                    window.LiveChat.ws.close();
                    window.LiveChat.ws = null;
                }
                
                // Resetar estado completo do LiveChat
                window.LiveChat.currentUser = null;
                window.LiveChat._users = new Map();
                window.LiveChat.messageHistory = [];
                window.LiveChat.admins = new Set();
                window.LiveChat.bannedUsers = new Map();
                
                // Limpar elementos da UI do chat
                const input = document.querySelector('.live-chat-input input');
                const btn = document.querySelector('.live-chat-input button');
                const authBtn = document.getElementById('chatAuthButton');
                const logoutBtn = document.getElementById('chatLogoutButton');
                
                if (input) {
                    input.disabled = true;
                    input.value = '';
                }
                if (btn) btn.disabled = true;
                if (authBtn) authBtn.textContent = 'Entrar no Chat';
                if (logoutBtn) logoutBtn.classList.remove('visible');
                
                // Limpar histórico de mensagens e usuários do chat
                const messagesContainer = document.querySelector('.live-chat-messages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                }
                
                // Resetar contador de usuários online
                const counterEl = document.querySelector('.chat-online-counter');
                if (counterEl) counterEl.textContent = '0';
                
                // Resetar status online
                const onlineDot = document.querySelector('.online-dot');
                if (onlineDot) onlineDot.style.backgroundColor = '#e74c3c';
                
                // Hide chat user info
                try {
                    const ui = document.getElementById('chatUserInfo');
                    if (ui) {
                        ui.style.display = 'none';
                        ui.innerHTML = '';
                    }
                } catch (e) {}
            }
        } catch (e) {
            console.error('Auth.logout: erro ao limpar estado do LiveChat:', e);
        }
    }
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});

// Exportar para uso em outros módulos
window.Auth = Auth;