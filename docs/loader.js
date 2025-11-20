// Carregador de módulos
(function(){
    console.log('Iniciando carregamento de módulos...');
    const scripts = [
        'navigation.js',
        'player.js',
        'gallery.js',
        'events.js', 
        'main.js'
    ];

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            console.log('Carregando:', src);
            const s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = () => {
                console.log('Carregado com sucesso:', src);
                resolve(src);
            };
            s.onerror = () => {
                console.error('Falha ao carregar:', src);
                reject(new Error('Falha ao carregar ' + src));
            };
            document.head.appendChild(s);
        });
    }

    async function loadAll() {
        console.log('Iniciando carregamento sequencial...');
        for (const src of scripts) {
            try {
                await loadScript(src);
            } catch (err) {
                console.error('Erro ao carregar módulo:', err);
            }
        }

        console.log('Todos os módulos carregados, iniciando App.boot()');
        if (window.App && typeof window.App.boot === 'function') {
            try {
                window.App.boot();
                console.log('App.boot() executado com sucesso');
            } catch (e) {
                console.error('Erro em App.boot():', e);
            }
        } else {
            console.error('window.App.boot não encontrado!');
        }
        // Ensure BoiEvents is initialized after scripts are loaded
        if (window.BoiEvents && typeof window.BoiEvents.init === 'function') {
            try {
                window.BoiEvents.init();
                console.log('BoiEvents.init() executado com sucesso');
            } catch (e) {
                console.error('Erro em BoiEvents.init():', e);
            }
        }
    }

    if (document.readyState === 'loading') {
        console.log('DOM ainda carregando, aguardando DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', loadAll);
    } else {
        console.log('DOM já carregado, iniciando carregamento...');
        loadAll();
    }
})();