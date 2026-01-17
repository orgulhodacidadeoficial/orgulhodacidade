// Carregador de módulos
(function(){
    const scripts = [
        'navigation.js',  // Menu mobile
        'player.js',      // Player de música
        'gallery.js',     // Galeria de fotos
        'main.clean.js'   // Módulo principal
    ];

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            
            script.onload = () => {
                console.log('Carregado:', src);
                resolve();
            };
            
            script.onerror = () => {
                console.error('Erro ao carregar:', src);
                reject(new Error('Falha ao carregar ' + src));
            };

            document.head.appendChild(script);
        });
    }

    async function loadAll() {
        console.log('Iniciando carregamento de módulos...');
        
        for (const src of scripts) {
            try {
                await loadScript(src);
            } catch (err) {
                console.error('Erro ao carregar módulo:', err);
            }
        }

        console.log('Módulos carregados, iniciando aplicação...');
        
        if (window.App && typeof window.App.boot === 'function') {
            try {
                window.App.boot();
                console.log('Aplicação iniciada com sucesso');
            } catch (err) {
                console.error('Erro ao iniciar aplicação:', err);
            }
        } else {
            console.error('Erro: window.App.boot não encontrado');
        }
    }

    // Inicia carregamento quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAll);
    } else {
        loadAll();
    }
})();

// Função global usada pelo formulário em inscricao.html
// Retorna false para evitar submissão tradicional.
window.handleInscricao = async function handleInscricao(e) {
    e.preventDefault();
    const form = document.getElementById('inscricaoForm');
    if (!form) return false;

    const submitBtn = form.querySelector('button[type="submit"]');
    const messageId = 'inscricao-message';
    // remover mensagem anterior se existir
    const prev = document.getElementById(messageId);
    if (prev) prev.remove();

    // bloquear botão
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.origText = submitBtn.textContent;
        submitBtn.textContent = 'Enviando...';
    }

    const payload = {
        nome: (form.nome && form.nome.value || '').trim(),
        idade: (form.idade && form.idade.value) ? Number(form.idade.value) : null,
        tipo_participacao: (form.tipo_participacao && form.tipo_participacao.value) || '',
        telefone: (form.telefone && form.telefone.value || '').trim(),
        bairro: (form.bairro && form.bairro.value || '').trim(),
        Rede_sociais: (form.Rede_sociais && form.Rede_sociais.value || '').trim(),
        email: (form.email && form.email.value || '').trim()
    };

    // Mostra um modal de confirmação com botão OK (acessível)
    function showModal(text, type, onConfirm) {
        // evita criar múltiplos modais
        if (document.getElementById(messageId + '-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = messageId + '-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;';

        const modal = document.createElement('div');
        modal.id = messageId + '-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
    modal.style.cssText = 'max-width:720px;width:100%;background:#fff;border-radius:10px;padding:20px 22px;box-shadow:0 8px 30px rgba(0,0,0,0.3);font-weight:600;color:#07336a;text-align:center;';

    const title = document.createElement('div');
    title.className = 'inscricao-modal-title';
    title.style.cssText = 'margin-bottom:8px;font-size:1.02rem;';
        title.textContent = (type === 'success') ? 'Inscrição enviada' : (type === 'error' ? 'Erro' : 'Aviso');

    const msg = document.createElement('div');
    msg.className = 'inscricao-modal-text';
    msg.style.cssText = 'margin-bottom:18px;font-weight:500;color:#1b344f;';
        msg.textContent = text;

    const btn = document.createElement('button');
    btn.type = 'button';
    // aplica classe padrão do site e nossa classe específica do modal
    btn.className = 'btn-primary modal-ok-btn';
    btn.textContent = 'OK';

        // fechar modal e focar de volta no formulário
        function closeModal() {
            try { overlay.remove(); } catch (err) {}
            if (submitBtn) submitBtn.focus();
        }

        btn.addEventListener('click', () => {
            try { if (typeof onConfirm === 'function') onConfirm(); } catch (err) { console.error(err); }
            closeModal();
        });

        // fechar ao apertar ESC
        function onKey(e) {
            if (e.key === 'Escape') closeModal();
        }
        document.addEventListener('keydown', onKey);

        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) closeModal();
        });

        modal.appendChild(title);
        modal.appendChild(msg);
        modal.appendChild(btn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // foco no botão OK
        btn.focus();

        // quando fechar, remover listener
        const origClose = closeModal;
        closeModal = function() {
            document.removeEventListener('keydown', onKey);
            try { overlay.remove(); } catch (err) {}
            if (submitBtn) submitBtn.focus();
        };

        return { close: closeModal };
    }

    try {
        const res = await fetch('/api/inscricao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

    if (!res.ok) {
            // tenta ler mensagem do servidor
            let errText = 'Ocorreu um erro ao enviar sua inscrição. Tente novamente mais tarde.';
            try { const j = await res.json(); if (j && j.error) errText = j.error; } catch (err) {}
            showModal(errText, 'error');
            return false;
        }
        
        showModal('Sua inscrição foi enviada com sucesso! Em breve entraremos em contato.', 'success', () => {
            try { form.reset(); } catch (err) {}
        });
    } catch (err) {
        console.error('Erro ao enviar inscrição:', err);
        showModal('Ocorreu um erro de rede ao enviar sua inscrição. Verifique sua conexão e tente novamente.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.origText || 'Enviar Inscrição';
        }
    }

    return false;
};