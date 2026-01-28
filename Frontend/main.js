// Módulo principal
(function(){
    // Notificações
    const notify = {
        show(message, type = 'success') {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + type;
            messageDiv.textContent = message;
            // Add a helper class so CSS can animate it
            document.body.appendChild(messageDiv);
            // Use a small tick to allow CSS transitions
            requestAnimationFrame(() => messageDiv.classList.add('show'));
            // Remove after timeout with fade out
            setTimeout(() => {
                messageDiv.classList.remove('show');
                setTimeout(() => messageDiv.remove(), 260);
            }, 4500);
        },
        success(msg) { this.show(msg, 'success'); },
        error(msg) { this.show(msg, 'error'); }
    };

    // Handlers de formulários
    async function handleFormSubmit(endpoint, form, successMessage) {
        try {
            const formData = new FormData(form);
            const payload = Object.fromEntries(
                Array.from(formData.entries()).map(([k,v]) => [k, String(v).trim()])
            );
            // Inline form status (if present)
            const statusEl = form.querySelector('.form-status');
            const submitBtn = form.querySelector('button[type="submit"]');
            function showStatus(text, kind){
                if(!statusEl) return;
                statusEl.hidden = false;
                statusEl.classList.remove('success','error','sending');
                if(kind) statusEl.classList.add(kind);
                statusEl.textContent = text;
            }
            try{ if(submitBtn){ submitBtn.disabled = true; submitBtn.classList.add('loading'); } }catch(e){}
            showStatus('Enviando...', 'sending');

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (data && data.ok) {
                // show inline success (and only show global toast when no inline status exists)
                showStatus(successMessage || 'Enviado com sucesso!', 'success');
                if(!statusEl) notify.success(successMessage);
                form.reset();
                // re-enable submit button and remove loading state so user can send again
                try{ if(submitBtn){ submitBtn.disabled = false; submitBtn.classList.remove('loading'); } }catch(e){}
                // pequena animação e depois esconder
                setTimeout(() => {
                    if(statusEl){ statusEl.hidden = true; statusEl.classList.remove('success'); }
                }, 3000);
            } else {
                throw new Error(data?.error || 'Erro desconhecido');
            }
        } catch (e) {
            console.error('Erro no formulário:', e);
            // show inline error if available
            try {
                const statusEl = (e && e.target) ? null : null;
            } catch (err) {}
            const statusElLocal = (arguments && arguments[1] && arguments[1].querySelector) ? null : null;
            try{
                const s = form.querySelector('.form-status');
                if(s){ s.hidden = false; s.classList.remove('sending'); s.classList.add('error'); s.textContent = 'Erro ao enviar. Tente novamente.'; }
            }catch(err){}
            notify.error('Erro ao processar formulário. Tente novamente.');
            if(form && form.querySelector){ const btn = form.querySelector('button[type="submit"]'); if(btn){ btn.disabled = false; btn.classList.remove('loading'); } }
        }
        return false;
    }

    // Handler de contato
    function handleContato(e) {
        e.preventDefault();
        return handleFormSubmit('/api/contato', e.target, 'Mensagem enviada com sucesso!');
    }

    // Handler de contratação
    function handleContratacao(e) {
        e.preventDefault();
        return handleFormSubmit('/api/contratacao', e.target, 'Solicitação de orçamento enviada com sucesso!');
    }

    // Inicialização
    function boot() {
        // Inicializa módulos
        if (window.Navigation && typeof window.Navigation.init === 'function') {
            window.Navigation.init();
        }

        if (window.Player && typeof window.Player.init === 'function') {
            window.Player.init();
        }

        if (window.Gallery && typeof window.Gallery.init === 'function') {
            window.Gallery.init();
        }

        // Configura formulários
        document.querySelectorAll('form.contato-form').forEach(form => {
            form.addEventListener('submit', handleContato);
        });

        document.querySelectorAll('form.contratacao-form').forEach(form => {
            form.addEventListener('submit', handleContratacao);
        });
    }

    // Controle de visibilidade do header ao fazer scroll (apenas desktop)
    function initHeaderScroll() {
        // Apenas desktop (>= 769px)
        if (window.innerWidth < 769) return;
        
        let lastScrollY = 0;
        const header = document.querySelector('.main-header');
        
        if (!header) return;
        
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            
            // Se está scrollando para baixo, esconde o header
           // if (currentScrollY > lastScrollY && currentScrollY > 100) {
              //  header.style.transform = 'translateY(-100%)';
               // header.style.opacity = '0';
         //   } else {
                // Se está scrollando para cima, mostra o header
             //   header.style.transform = 'translateY(0)';
              //  header.style.opacity = '1';
          //  }
            
            lastScrollY = currentScrollY;
        };
        
        // Adiciona transição suave ao header
        header.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Reinicializa ao redimensionar a janela
        window.addEventListener('resize', () => {
            if (window.innerWidth < 769) {
                window.removeEventListener('scroll', handleScroll);
                header.style.transform = 'translateY(0)';
                header.style.opacity = '1';
            }
        });
    }

    // API pública
    window.App = {
        boot,
        notify,
        handleFormSubmit,
        handleContato,
        handleContratacao,
        initHeaderScroll
    };
    
    // Inicia o comportamento de scroll do header após carregar a página
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderScroll);
    } else {
        initHeaderScroll();
    }
})();