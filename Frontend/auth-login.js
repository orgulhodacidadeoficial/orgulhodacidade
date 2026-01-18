/**
 * Auth Login Module - Gerencia login na página inicial
 */

window.AuthLogin = (function() {
    'use strict';

    const module = {
        authenticated: false,
        userName: null,
        userId: null,
        userEmail: null,

        init() {
            console.log('[AuthLogin] Inicializando...');
            
            // Verificar se já está autenticado
            const savedName = sessionStorage.getItem('liveModalUserName');
            const savedId = sessionStorage.getItem('liveModalUserId');
            
            if (savedName && savedId) {
                this.authenticated = true;
                this.userName = savedName;
                this.userId = savedId;
                this.userEmail = sessionStorage.getItem('liveModalUserEmail');
                this.hideLoginSection();
            } else {
                this.setupLoginListeners();
            }
        },

        hideLoginSection() {
            const section = document.getElementById('auth-login-section');
            if (section) {
                section.style.display = 'none';
            }
        },

        showLoginSection() {
            const section = document.getElementById('auth-login-section');
            if (section) {
                section.style.display = 'block';
            }
        },

        setupLoginListeners() {
            const btnLogin = document.getElementById('auth-login-btn');
            const btnCreate = document.getElementById('auth-create-account-btn');
            const inputId = document.getElementById('auth-login-id');
            const inputPassword = document.getElementById('auth-login-password');
            const errorDiv = document.getElementById('auth-login-error');

            if (btnLogin) {
                btnLogin.addEventListener('click', () => this.handleLogin());
            }

            if (btnCreate) {
                btnCreate.addEventListener('click', () => this.handleCreateAccount());
            }

            if (inputPassword) {
                inputPassword.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.handleLogin();
                });
            }

            if (inputId) {
                inputId.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        inputPassword.focus();
                    }
                });
            }
        },

        showError(message) {
            const errorDiv = document.getElementById('auth-login-error');
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.classList.add('show');
                setTimeout(() => {
                    errorDiv.classList.remove('show');
                }, 5000);
            }
        },

        async handleLogin() {
            const inputId = document.getElementById('auth-login-id');
            const inputPassword = document.getElementById('auth-login-password');
            const btnLogin = document.getElementById('auth-login-btn');
            const formContainer = document.getElementById('auth-login-form-container');

            const username = inputId.value.trim();
            const password = inputPassword.value.trim();

            if (!username) {
                this.showError('Por favor, digite seu usuário');
                inputId.focus();
                return;
            }

            if (!password) {
                this.showError('Por favor, digite sua senha');
                inputPassword.focus();
                return;
            }

            // Desabilitar botão durante requisição
            btnLogin.disabled = true;
            formContainer.classList.add('auth-login-loading');
            btnLogin.textContent = '⏳ Autenticando...';

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username, password: password })
                });

                const data = await response.json();

                if (data.ok && data.userName) {
                    // Login bem-sucedido
                    this.userName = data.userName;
                    this.userId = data.id;
                    this.userEmail = data.email || `${username}@chat.local`;
                    this.authenticated = true;

                    // Salvar dados localmente
                    sessionStorage.setItem('liveModalUserName', this.userName);
                    sessionStorage.setItem('liveModalUserEmail', this.userEmail);
                    sessionStorage.setItem('liveModalUserId', data.id);

                    console.log('[AuthLogin] Login bem-sucedido para:', this.userName);

                    // Limpar formulário e ocultar seção
                    inputId.value = '';
                    inputPassword.value = '';
                    this.hideLoginSection();

                    // Notificar usuário
                    window.notify && window.notify.success(`Bem-vindo, ${this.userName}!`);
                } else {
                    this.showError(data.error || 'Falha na autenticação');
                    btnLogin.disabled = false;
                    formContainer.classList.remove('auth-login-loading');
                    btnLogin.textContent = '✓ Entrar';
                    inputPassword.value = '';
                    inputPassword.focus();
                }
            } catch (error) {
                console.error('[AuthLogin] Erro ao fazer login:', error);
                this.showError('Erro ao conectar ao servidor. Tente novamente.');
                btnLogin.disabled = false;
                formContainer.classList.remove('auth-login-loading');
                btnLogin.textContent = '✓ Entrar';
            }
        },

        handleCreateAccount() {
            // Abrir modal de criar conta do LiveModal (se disponível)
            if (window.LiveModal && typeof window.LiveModal.showCreateAccountModal === 'function') {
                window.LiveModal.showCreateAccountModal().then((created) => {
                    if (created) {
                        // Conta criada com sucesso
                        this.init(); // Reinicializar para refletir o novo login
                    }
                });
            } else {
                // Se LiveModal não está disponível, criar modal simples
                this.showSimpleCreateAccountModal();
            }
        },

        showSimpleCreateAccountModal() {
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
                <h2 style="margin: 0 0 10px 0; text-align: center; font-size: 24px;">
                    <i class="fas fa-user-plus"></i> Criar Conta
                </h2>
                <p style="text-align: center; opacity: 0.9; margin: 0 0 25px 0; font-size: 14px;">
                    Registre-se para participar do chat
                </p>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                        <i class="fas fa-id-card"></i> ID *
                    </label>
                    <input 
                        type="text" 
                        id="create-id" 
                        placeholder="Seu ID"
                        autocomplete="username"
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

                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                        <i class="fas fa-user-tie"></i> Nome *
                    </label>
                    <input 
                        type="text" 
                        id="create-name" 
                        placeholder="Seu nome completo"
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
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                        <i class="fas fa-lock"></i> Senha *
                    </label>
                    <input 
                        type="password" 
                        id="create-password" 
                        placeholder="Crie uma senha"
                        autocomplete="new-password"
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
                    <small style="opacity: 0.8; display: block; margin-top: 4px;">Mínimo 4 caracteres</small>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                        <i class="fas fa-lock-open"></i> Confirmar Senha *
                    </label>
                    <input 
                        type="password" 
                        id="create-confirm-password" 
                        placeholder="Confirme a senha"
                        autocomplete="new-password"
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
                </div>

                <div id="create-error" style="
                    margin-bottom: 15px;
                    padding: 10px;
                    border-radius: 4px;
                    background: rgba(255, 100, 100, 0.2);
                    color: #ffcccc;
                    font-size: 13px;
                    display: none;
                    text-align: center;
                "></div>
                
                <button id="create-submit" style="
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
                    <i class="fas fa-check"></i> Criar Conta
                </button>
                
                <button id="create-cancel" style="
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
                    <i class="fas fa-arrow-left"></i> Voltar
                </button>
            `;

            document.body.appendChild(createOverlay);
            createOverlay.appendChild(createBox);

            const inputId = createBox.querySelector('#create-id');
            const inputName = createBox.querySelector('#create-name');
            const inputPassword = createBox.querySelector('#create-password');
            const inputConfirmPassword = createBox.querySelector('#create-confirm-password');
            const btnSubmit = createBox.querySelector('#create-submit');
            const btnCancel = createBox.querySelector('#create-cancel');
            const errorDiv = createBox.querySelector('#create-error');

            const showError = (msg) => {
                errorDiv.textContent = msg;
                errorDiv.style.display = 'block';
                setTimeout(() => {
                    errorDiv.style.display = 'none';
                }, 5000);
            };

            const handleSubmit = async () => {
                const userId = inputId.value.trim();
                const name = inputName.value.trim();
                const password = inputPassword.value.trim();
                const confirmPassword = inputConfirmPassword.value.trim();

                if (!userId || !name || !password || !confirmPassword) {
                    showError('Todos os campos são obrigatórios');
                    return;
                }

                if (userId.length < 3) {
                    showError('ID deve ter no mínimo 3 caracteres');
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
                            id: userId,
                            name: name,
                            password: password
                        })
                    });

                    const data = await response.json();

                    if (data.ok) {
                        // Conta criada com sucesso
                        module.userName = data.userName || name;
                        module.userId = userId;
                        module.userEmail = data.email || `${userId}@chat.local`;
                        module.authenticated = true;

                        sessionStorage.setItem('liveModalUserName', module.userName);
                        sessionStorage.setItem('liveModalUserEmail', module.userEmail);
                        sessionStorage.setItem('liveModalUserId', userId);

                        console.log('[AuthLogin] Conta criada:', module.userName);
                        createOverlay.remove();

                        // Atualizar página
                        module.hideLoginSection();
                        window.notify && window.notify.success(`Conta criada com sucesso! Bem-vindo, ${module.userName}!`);
                    } else {
                        showError(data.error || 'Erro ao criar conta');
                        btnSubmit.disabled = false;
                        btnSubmit.style.opacity = '1';
                        btnSubmit.textContent = '✓ Criar Conta';
                    }
                } catch (error) {
                    console.error('[AuthLogin] Erro ao criar conta:', error);
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
            });

            setTimeout(() => inputId.focus(), 100);
        }
    };

    return module;
})();

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    if (window.AuthLogin) {
        window.AuthLogin.init();
    }
});
