// YouTube Player Manager
// YouTube Player Manager
// Attach to window to avoid redeclaration errors when script is loaded multiple times
window.YouTubePlayer = window.YouTubePlayer || {
    player: null,
    _playerInitialized: false,
    
    loadAPI() {
        if (window.YT) return Promise.resolve();
        
        return new Promise((resolve) => {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            window.onYouTubeIframeAPIReady = () => {
                resolve();
            };
        });
    },
    
    async initPlayer(videoId, title = '') {
        try {
            // Prevent concurrent initializations
            if (this._initializing) {
                console.log('YouTubePlayer: init already in progress, skipping');
                return;
            }
            this._initializing = true;
            await this.loadAPI();
            
            // Verificar se container existe
            const container = document.getElementById('youtubePlayer');
            if (!container) {
                console.log('YouTubePlayer: container não encontrado');
                return;
            }
            
            // Se player existe e container ainda está válido, tentar reutilizar
            if (this.player && this._playerInitialized && container.innerHTML.includes('iframe')) {
                try {
                    console.log('YouTubePlayer: reusando player existente');
                    this.player.loadVideoById(videoId);
                    if (title) {
                        const titleEl = document.querySelector('.live-modal-title');
                        if (titleEl) titleEl.textContent = title;
                    }
                    return;
                } catch (e) {
                    console.log('YouTubePlayer: falha ao reusar player, recriando...');
                    this.destroyPlayer();
                }
            }
            
            // Limpar container e criar novo player
            container.innerHTML = '';
            
            console.log('YouTubePlayer: criando novo player para vídeo:', videoId);
            
            this.player = new YT.Player('youtubePlayer', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: Object.assign({
                    autoplay: 1,
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    // Provide the page origin so iframe messaging targets the correct origin
                    origin: window.location.origin
                }, {}),
                events: {
                    onReady: (event) => {
                        console.log('YouTubePlayer: player pronto');
                        this._playerInitialized = true;
                        event.target.playVideo();
                        this._initializing = false;
                    },
                    onError: (event) => {
                        console.error('YouTubePlayer: erro', event.data);
                        this._initializing = false;
                    }
                }
            });
            
            if (title) {
                const titleEl = document.querySelector('.live-modal-title');
                if (titleEl) titleEl.textContent = title;
            }
            
        } catch (error) {
            console.error('Error initializing YouTube player:', error);
            this._initializing = false;
        }
    },
    
    destroyPlayer() {
        try {
            if (this.player && typeof this.player.destroy === 'function') {
                this.player.destroy();
            }
            this.player = null;
            this._playerInitialized = false;
            
            // Limpar container
            const container = document.getElementById('youtubePlayer');
            if (container) {
                container.innerHTML = '';
            }
            
            console.log('YouTubePlayer: player destruído');
        } catch (e) {
            console.error('YouTubePlayer: erro ao destruir player', e);
        }
    },
    
    stopVideo() {
        if (this.player && typeof this.player.stopVideo === 'function') {
            try {
                this.player.stopVideo();
            } catch (e) {
                console.error('YouTubePlayer: erro ao parar vídeo', e);
            }
        }
    }
};