// Gerenciador de Playlist com IndexedDB e WebSocket
(function(){
    // Objeto para armazenar a playlist em memória
    let playlistData = [];
    const STORAGE_KEY = 'boiPlaylist';
    const DB_NAME = 'BoiPlaylistDB';
    // Bump this when adding/removing object stores to trigger onupgradeneeded
    const DB_VERSION = 2;
    const STORE_NAME = 'musics';
    const AUDIO_STORE = 'audioFiles';
    
    let db = null;
    let isInitializing = false;
    let ws = null;
    let wsConnected = false;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000;
    
    // Controle de reprodução em sequência
    let currentPlayingIndex = -1;
    let autoPlayEnabled = false;

    // Inicializa IndexedDB
    function initIndexedDB() {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }

            if (!window.indexedDB) {
                console.warn('IndexedDB não suportado, usando localStorage');
                resolve(null);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.warn('Erro ao abrir IndexedDB:', request.error);
                resolve(null);
            };

            request.onsuccess = () => {
                db = request.result;
                console.log('IndexedDB inicializado');
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    console.log('Object Store criado: ' + STORE_NAME);
                }
                if (!database.objectStoreNames.contains(AUDIO_STORE)) {
                    // Store para guardar blobs de áudio separadamente
                    database.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
                    console.log('Object Store criado: ' + AUDIO_STORE);
                }
            };
        });
    }

    // Carrega playlist do IndexedDB ou localStorage e reconstrói Blob URLs
    function loadPlaylist() {
        return new Promise((resolve) => {
            if (!db) {
                // Fallback para localStorage
                try {
                    const stored = localStorage.getItem(STORAGE_KEY);
                    if (stored) {
                        playlistData = JSON.parse(stored);
                    } else {
                        playlistData = [];
                    }
                } catch (e) {
                    console.error('Erro ao carregar do localStorage:', e);
                    playlistData = [];
                }
                resolve();
                return;
            }

            // Carrega do IndexedDB
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const musicsWithMetadata = request.result;
                console.log('Playlist carregada do IndexedDB:', musicsWithMetadata.length, 'músicas');
                
                // Carrega os arquivos de áudio armazenados e cria Blob URLs
                const loadBlobPromises = musicsWithMetadata.map(m => 
                    loadAudioFile(m.id).then(blobUrl => ({
                        ...m,
                        blobUrl: blobUrl
                    }))
                );
                
                Promise.all(loadBlobPromises).then(musicsWithBlobs => {
                    playlistData = musicsWithBlobs;
                    console.log('Blob URLs recriadas para', playlistData.length, 'músicas');
                    resolve();
                }).catch(() => {
                    // Se falhar ao carregar blobs, carrega sem eles
                    playlistData = musicsWithMetadata.map(m => ({
                        ...m,
                        blobUrl: null
                    }));
                    resolve();
                });
            };

            request.onerror = () => {
                console.error('Erro ao carregar do IndexedDB');
                playlistData = [];
                resolve();
            };
        });
    }

    // Salva arquivo de áudio no IndexedDB com uma chave separada
    function saveAudioFile(musicId, file) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('IndexedDB não disponível'));
                return;
            }

            const transaction = db.transaction([AUDIO_STORE], 'readwrite');
            const store = transaction.objectStore(AUDIO_STORE);
            
            // Cria chave para o arquivo: "audio_" + musicId
            const audioKey = 'audio_' + musicId;
            
            const audioData = {
                id: audioKey,
                blob: file,
                originalId: musicId,
                savedAt: new Date().toISOString()
            };
            
            const request = store.put(audioData);
            
            request.onsuccess = () => {
                console.log('Arquivo de áudio salvo:', musicId);
                resolve();
            };
            
            request.onerror = () => {
                console.error('Erro ao salvar arquivo de áudio:', request.error);
                reject(request.error);
            };
        });
    }

    // Carrega arquivo de áudio do IndexedDB e cria um Blob URL
    function loadAudioFile(musicId) {
        return new Promise((resolve) => {
            if (!db) {
                resolve(null);
                return;
            }

            const transaction = db.transaction([AUDIO_STORE], 'readonly');
            const store = transaction.objectStore(AUDIO_STORE);
            
            const audioKey = 'audio_' + musicId;
            const request = store.get(audioKey);
            
            request.onsuccess = () => {
                const audioData = request.result;
                if (audioData && audioData.blob) {
                    // Cria um novo Blob URL a partir do Blob armazenado
                    const blobUrl = URL.createObjectURL(audioData.blob);
                    console.log('Arquivo de áudio carregado:', musicId);
                    resolve(blobUrl);
                } else {
                    console.warn('Arquivo de áudio não encontrado:', musicId);
                    resolve(null);
                }
            };
            
            request.onerror = () => {
                console.warn('Erro ao carregar arquivo de áudio:', request.error);
                resolve(null);
            };
        });
    }

    // Salva música no IndexedDB e localStorage (metadados)
    // Inicializa o gerenciador
    function init() {
        if (isInitializing) return;
        isInitializing = true;

        console.log('Inicializando gerenciador de playlist...');
        
        // Inicializa IndexedDB e carrega playlist
        initIndexedDB().then(() => {
            return loadPlaylist();
        }).then(() => {
            // Obtém elementos do DOM
            const form = document.getElementById('addMusicForm');
            const clearBtn = document.getElementById('clearPlaylistBtn');
            const audioPlayer = document.getElementById('audioPlayer');
            
            if (form) {
                form.addEventListener('submit', handleAddMusic);
            }
            
            if (clearBtn) {
                clearBtn.addEventListener('click', handleClearPlaylist);
            }
            
            // Adiciona listener para quando a música terminar
            if (audioPlayer) {
                audioPlayer.addEventListener('ended', handleMusicEnded);
            }
            
            // Renderiza a playlist inicial
            renderPlaylist();
            
            // Inicializa WebSocket
            initWebSocket();
            
            console.log('Gerenciador de playlist inicializado');
            isInitializing = false;
        });
    }

    // Manipula quando a música termina
    function handleMusicEnded() {
        if (autoPlayEnabled && currentPlayingIndex !== -1) {
            const nextIndex = currentPlayingIndex + 1;
            
            if (nextIndex < playlistData.length) {
                // Há próxima música na playlist
                const nextMusic = playlistData[nextIndex];
                handlePlayMusic(nextMusic.id);
            } else {
                // Chegou ao final da playlist - volta para o início (loop)
                console.log('Recomeçando playlist desde o início');
                if (playlistData.length > 0) {
                    const firstMusic = playlistData[0];
                    handlePlayMusic(firstMusic.id);
                } else {
                    autoPlayEnabled = false;
                    currentPlayingIndex = -1;
                }
            }
        }
    }

    // Atualiza indicador visual de sincronização
    function updateSyncStatus() {
        const syncStatusEl = document.getElementById('syncStatus');
        if (!syncStatusEl) return;

        if (wsConnected) {
            syncStatusEl.className = 'sync-status connected';
            syncStatusEl.innerHTML = '<span class="sync-indicator"></span><span>Sincronizando</span>';
        } else {
            syncStatusEl.className = 'sync-status disconnected';
            syncStatusEl.innerHTML = '<span class="sync-indicator"></span><span>Offline</span>';
        }
    }

    // Inicializa WebSocket para sincronização em tempo real
    function initWebSocket() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            return; // Já conectado
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/playlist`;

        console.log('Conectando ao WebSocket:', wsUrl);

        try {
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                wsConnected = true;
                reconnectAttempts = 0;
                updateSyncStatus();
                console.log('[Playlist WS] Conectado com sucesso');
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('[Playlist WS] Mensagem recebida:', message.action);

                    // Processa mensagens recebidas
                    if (message.action === 'connected') {
                        // Sincroniza playlist inicial do servidor
                        if (message.data && message.data.playlist) {
                            console.log('[Playlist WS] Sincronizando playlist do servidor:', message.data.playlist.length, 'músicas');
                            playlistData = message.data.playlist;
                            renderPlaylist();
                            showNotification('🔄 Sincronização ativa - mudanças serão compartilhadas em tempo real', 'success');
                        }
                    } else if (message.action === 'music_added') {
                        handleRemoteMusicsAdded(message.data);
                    } else if (message.action === 'music_removed') {
                        handleRemoteMusicRemoved(message.data);
                    } else if (message.action === 'playlist_cleared') {
                        handleRemotePlaylistCleared();
                    }
                } catch (e) {
                    console.warn('[Playlist WS] Erro ao processar mensagem:', e);
                }
            };

            ws.onerror = (error) => {
                console.error('[Playlist WS] Erro:', error);
                wsConnected = false;
                updateSyncStatus();
            };

            ws.onclose = () => {
                wsConnected = false;
                updateSyncStatus();
                console.warn('[Playlist WS] Desconectado');
                
                // Tenta reconectar
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    console.log(`[Playlist WS] Tentando reconectar (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) em ${RECONNECT_DELAY}ms...`);
                    setTimeout(initWebSocket, RECONNECT_DELAY);
                } else {
                    console.error('[Playlist WS] Máximo de tentativas de reconexão atingido');
                    showNotification('⚠️ Modo offline - mudanças serão sincronizadas quando reconectar', 'warning');
                }
            };
        } catch (e) {
            console.error('[Playlist WS] Erro ao criar WebSocket:', e);
            wsConnected = false;
            updateSyncStatus();
        }
    }

    // Envia evento via WebSocket
    function sendPlaylistEvent(action, data) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ action, data }));
                console.log(`[Playlist WS] Evento enviado: ${action}`);
            } catch (e) {
                console.error('[Playlist WS] Erro ao enviar evento:', e);
            }
        }
    }

    // Manipula música adicionada remotamente
    function handleRemoteMusicsAdded(remoteMusic) {
        // Verifica se a música já existe
        const exists = playlistData.some(m => m.id === remoteMusic.id);
        if (!exists) {
            // Adiciona metadados imediatamente
            playlistData.push({
                ...remoteMusic,
                blobUrl: null // Será baixado em breve
            });
            
            // Se houver serverUrl, faz download do arquivo
            if (remoteMusic.serverUrl) {
                console.log(`[Remote] Tentando fazer download de áudio: ${remoteMusic.id} de ${remoteMusic.serverUrl}`);
                fetch(remoteMusic.serverUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Download falhou com status ${response.status}`);
                        }
                        return response.blob();
                    })
                    .then(blob => {
                        // Salva o arquivo baixado no IndexedDB
                        console.log(`[Remote] Áudio baixado com sucesso: ${remoteMusic.id}`);
                        return saveAudioFile(remoteMusic.id, blob);
                    })
                    .then(() => {
                        return savePlaylistMetadata();
                    })
                    .then(() => {
                        renderPlaylist();
                        showNotification(`✨ Nova música adicionada: ${remoteMusic.title}`, 'success');
                        console.log(`[Remote] Música salva com sucesso: ${remoteMusic.id}`);
                    })
                    .catch(err => {
                        console.error(`[Remote] Erro ao baixar áudio (${remoteMusic.id}):`, err);
                        // Salva metadados mesmo que não conseguiu o áudio
                        savePlaylistMetadata().then(() => {
                            renderPlaylist();
                            showNotification(`⚠️ Música adicionada mas áudio não pôde ser baixado. Será baixado ao tentar reproduzir.`, 'warning');
                        });
                    });
            } else {
                // Se não há serverUrl, apenas salva metadados
                console.warn(`[Remote] Música recebida sem serverUrl: ${remoteMusic.id}`);
                savePlaylistMetadata().then(() => {
                    renderPlaylist();
                    showNotification(`✨ Nova música adicionada (sem áudio): ${remoteMusic.title}`, 'success');
                });
            }
        }
    }

    // Manipula remoção de música remotamente
    function handleRemoteMusicRemoved(musicId) {
        const hadMusic = playlistData.some(m => m.id === musicId);
        if (hadMusic) {
            playlistData = playlistData.filter(m => m.id !== musicId);
            savePlaylistMetadata().then(() => {
                renderPlaylist();
                showNotification('🗑️ Música removida', 'info');
            });
        }
    }

    // Manipula limpeza de playlist remotamente
    function handleRemotePlaylistCleared() {
        if (playlistData.length > 0) {
            playlistData = [];
            savePlaylistMetadata().then(() => {
                renderPlaylist();
                showNotification('🧹 Playlist foi limpa', 'info');
            });
        }
    }

    // Upload de arquivo de áudio para o servidor
    function uploadAudioToServer(file) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('audio', file);

            fetch('/api/upload-audio', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Upload failed with status ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.ok && data.url) {
                    resolve(data.url);
                } else {
                    reject(new Error('Server did not return upload URL'));
                }
            })
            .catch(error => {
                console.error('Upload error:', error);
                reject(error);
            });
        });
    }

    // Manipula adição de música
    function handleAddMusic(e) {
        e.preventDefault();

        const titleInput = document.getElementById('musicTitle');
        const artistInput = document.getElementById('musicArtist');
        const fileInput = document.getElementById('musicFile');

        if (!titleInput.value.trim() || !artistInput.value.trim() || !fileInput.files.length) {
            showNotification('Por favor, preencha todos os campos', 'warning');
            return;
        }

        const file = fileInput.files[0];
        
        // Valida tamanho do arquivo (máx 50MB)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            showNotification('Arquivo muito grande! Máximo: 50MB', 'warning');
            return;
        }

        // Mostra indicador de carregamento
        const btn = document.querySelector('.btn-add-music');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adicionando...';
        btn.disabled = true;

        // Cria um Blob URL do arquivo (não armazena, apenas referencia)
        const blobUrl = URL.createObjectURL(file);

        const musicData = {
            id: Date.now(),
            title: titleInput.value.trim(),
            artist: artistInput.value.trim(),
            blobUrl: blobUrl, // URL temporária do arquivo
            fileName: file.name,
            addedAt: new Date().toISOString(),
            serverUrl: null // Será preenchido após upload
        };

        playlistData.push(musicData);
        
        // Primeiro faz upload para o servidor
        uploadAudioToServer(file).then(serverUrl => {
            musicData.serverUrl = serverUrl;
            
            // Depois salva metadados e arquivo de áudio localmente
            return Promise.all([
                savePlaylistMetadata(),
                saveAudioFile(musicData.id, file)
            ]);
        }).then(() => {
            renderPlaylist();

            // Limpa formulário
            document.getElementById('addMusicForm').reset();
            // Restaura botão
            btn.innerHTML = originalText;
            btn.disabled = false;
            // Envia para outros clientes via WebSocket (incluindo serverUrl)
            sendPlaylistEvent('music_added', {
                id: musicData.id,
                title: musicData.title,
                artist: musicData.artist,
                fileName: musicData.fileName,
                addedAt: musicData.addedAt,
                serverUrl: musicData.serverUrl
            });
            // Mostra mensagem de sucesso
            showNotification('✅ Música adicionada com sucesso!', 'success');
        }).catch(err => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            // Remove a música da playlist se o upload falhar
            playlistData = playlistData.filter(m => m.id !== musicData.id);
            showNotification('❌ Erro ao salvar a música', 'warning');
            console.error('Erro ao salvar música:', err);
        });
    }

    // Salva apenas metadados da playlist (não o arquivo)
    function savePlaylistMetadata() {
        try {
            const metadata = playlistData.map(m => ({
                id: m.id,
                title: m.title,
                artist: m.artist,
                fileName: m.fileName,
                addedAt: m.addedAt,
                serverUrl: m.serverUrl || null
            }));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
        } catch (e) {
            console.warn('Erro ao salvar metadados no localStorage:', e);
        }

        // Salva metadados no IndexedDB também
        if (!db) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // Limpa dados antigos
            store.clear();
            
            // Adiciona todas as músicas (apenas metadados)
            playlistData.forEach(music => {
                const metadata = {
                    id: music.id,
                    title: music.title,
                    artist: music.artist,
                    fileName: music.fileName,
                    addedAt: music.addedAt
                };
                store.put(metadata);
            });

            transaction.oncomplete = () => {
                console.log('Metadados da playlist salvos no IndexedDB');
                resolve();
            };

            transaction.onerror = () => {
                console.error('Erro ao salvar no IndexedDB');
                resolve();
            };
        });
    }

    // Manipula remoção de música
    function handleRemoveMusic(id) {
        playlistData = playlistData.filter(music => music.id !== id);
        return savePlaylistMetadata().then(() => {
            renderPlaylist();
            
            // Envia para outros clientes via WebSocket
            sendPlaylistEvent('music_removed', { id });
            
            showNotification('🗑️ Música removida da playlist', 'info');
        });
    }

    // Função auxiliar para tocar música com o Blob URL
    function playMusicWithBlob(audioPlayer, music, musicIndex) {
        currentPlayingIndex = musicIndex;
        autoPlayEnabled = true;
        
        audioPlayer.src = music.blobUrl;
        
        // Atualiza informações da música
        const titleSpan = document.querySelector('.current-song-title');
        const artistSpan = document.querySelector('.current-song-artist');
        
        if (titleSpan) titleSpan.textContent = music.title;
        if (artistSpan) artistSpan.textContent = music.artist;
        
        audioPlayer.play().catch(err => {
            console.error('Erro ao reproduzir áudio:', err);
            showNotification('❌ Erro ao reproduzir a música', 'warning');
        });
        
        // Atualiza ícone do player
        const playBtn = document.querySelector('.play-pause');
        if (playBtn) {
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }
        
        showNotification(`🎵 Tocando: ${music.title}`, 'success');
    }

    // Faz download do arquivo de áudio e o toca
    function downloadAndPlayAudio(audioPlayer, music, musicIndex) {
        console.log('Iniciando download de áudio:', music.id, music.serverUrl);
        fetch(music.serverUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Download falhou com status ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                // Salva no IndexedDB para próximas vezes
                return saveAudioFile(music.id, blob).then(() => blob);
            })
            .then(blob => {
                // Cria Blob URL e toca
                music.blobUrl = URL.createObjectURL(blob);
                playMusicWithBlob(audioPlayer, music, musicIndex);
            })
            .catch(err => {
                console.error('Erro ao fazer download de áudio:', err);
                showNotification('❌ Erro ao baixar a música. Verifique sua conexão.', 'warning');
            });
    }

    // Manipula reprodução de música
    function handlePlayMusic(id) {
        const music = playlistData.find(m => m.id === id);
        const musicIndex = playlistData.findIndex(m => m.id === id);
        
        if (music && musicIndex !== -1) {
            const audioPlayer = document.getElementById('audioPlayer');
            if (audioPlayer) {
                // Para qualquer música tocando do player principal
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
                
                // Se não tem blobUrl, tenta carregar do IndexedDB
                if (!music.blobUrl) {
                    loadAudioFile(id).then(blobUrl => {
                        if (blobUrl) {
                            music.blobUrl = blobUrl;
                            playMusicWithBlob(audioPlayer, music, musicIndex);
                        } else {
                            // Se não conseguir do IndexedDB, tenta download direto do serverUrl
                            console.warn('Áudio não encontrado no IndexedDB:', id, '- tentando download de:', music.serverUrl);
                            if (music.serverUrl) {
                                downloadAndPlayAudio(audioPlayer, music, musicIndex);
                            } else {
                                showNotification('❌ Arquivo não está mais disponível. Adicione novamente.', 'warning');
                            }
                        }
                    }).catch(err => {
                        // Se erro ao carregar do IndexedDB, tenta serverUrl
                        console.error('Erro ao carregar arquivo do IndexedDB:', err);
                        if (music.serverUrl) {
                            console.log('Tentando download direto de:', music.serverUrl);
                            downloadAndPlayAudio(audioPlayer, music, musicIndex);
                        } else {
                            showNotification('❌ Erro ao carregar a música', 'warning');
                        }
                    });
                    return;
                }
                playMusicWithBlob(audioPlayer, music, musicIndex);
            } else {
                showNotification('❌ Player de áudio não encontrado', 'warning');
            }
        }
    }

    // Manipula limpeza da playlist
    function handleClearPlaylist() {
        if (playlistData.length === 0) {
            showNotification('Sua playlist já está vazia!', 'warning');
            return;
        }

        if (confirm('Tem certeza que deseja limpar toda a playlist? Esta ação não pode ser desfeita.')) {
            playlistData = [];
            savePlaylistMetadata().then(() => {
                renderPlaylist();
                
                // Envia para outros clientes via WebSocket
                sendPlaylistEvent('playlist_cleared', {});
                
                showNotification('🧹 Playlist limpa', 'info');
            });
        }
    }

    // Renderiza a playlist
    function renderPlaylist() {
        const container = document.getElementById('playlistContainer');
        const countSpan = document.getElementById('playlistCount');

        if (!container) {
            console.warn('Contenedor de playlist não encontrado');
            return;
        }

        // Atualiza contador
        if (countSpan) {
            countSpan.textContent = `(${playlistData.length})`;
        }

        // Se não há músicas, mostra mensagem vazia
        if (playlistData.length === 0) {
            container.innerHTML = `
                <div class="playlist-empty">
                    <i class="fas fa-compact-disc"></i>
                    <p>Sua playlist está vazia. Adicione músicas para começar!</p>
                </div>
            `;
            return;
        }

        // Renderiza cada música
        container.innerHTML = playlistData.map(music => `
            <div class="playlist-item" data-id="${music.id}">
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${escapeHtml(music.title)}</div>
                    <div class="playlist-item-artist">${escapeHtml(music.artist)}</div>
                    <small style="color: rgba(255, 255, 255, 0.4); font-size: 0.75em;">${music.fileName}</small>
                </div>
                <div class="playlist-item-actions">
                    <button class="btn-play-item" onclick="window.PlaylistManager.playMusic(${music.id})">
                        <i class="fas fa-play"></i> Tocar
                    </button>
                    <button class="btn-remove-item admin-only" style="display: none;" onclick="window.PlaylistManager.removeMusic(${music.id})" title="Remover">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Atualiza elementos admin-only após renderização
        if (window.AdminHelper && window.AdminHelper.updateAdminElements) {
            window.AdminHelper.updateAdminElements();
        }
    }

    // Função para escapar HTML (segurança)
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Função para mostrar notificações
    function showNotification(message, type = 'info') {
        // Cria elemento de notificação
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        let bgColor = 'rgba(23, 162, 184, 0.9)'; // info
        let textColor = 'white';
        
        if (type === 'success') {
            bgColor = 'rgba(40, 167, 69, 0.9)';
        } else if (type === 'warning') {
            bgColor = 'rgba(255, 152, 0, 0.9)';
            textColor = '#333';
        }
        
        notification.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            padding: 15px 20px;
            background: ${bgColor};
            color: ${textColor};
            border-radius: 8px;
            font-weight: 600;
            z-index: 1000;
            animation: slideInUp 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 300px;
        `;

        document.body.appendChild(notification);

        // Remove notificação após 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOutDown 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // API pública
    window.PlaylistManager = {
        init: init,
        addMusic: handleAddMusic,
        removeMusic: handleRemoveMusic,
        playMusic: handlePlayMusic,
        clearPlaylist: handleClearPlaylist,
        getPlaylist: () => playlistData,
        loadPlaylist: loadPlaylist,
        // Debug: lista chaves e entradas do object store de áudio
        debugListAudioFiles: function() {
            return new Promise((resolve) => {
                if (!db) {
                    console.warn('IndexedDB não inicializado');
                    resolve([]);
                    return;
                }
                const tx = db.transaction([AUDIO_STORE], 'readonly');
                const store = tx.objectStore(AUDIO_STORE);
                const req = store.getAll();
                req.onsuccess = () => {
                    console.log('audioFiles entries:', req.result);
                    resolve(req.result);
                };
                req.onerror = () => {
                    console.warn('Erro ao ler audioFiles:', req.error);
                    resolve([]);
                };
            });
        },
        toggleAutoplay: () => {
            autoPlayEnabled = !autoPlayEnabled;
            const btn = document.getElementById('autoplayBtn');
            if (btn) {
                if (autoPlayEnabled) {
                    btn.classList.add('active');
                    showNotification('🔄 Autoplay ativado - próximas músicas tocarão automaticamente', 'success');
                } else {
                    btn.classList.remove('active');
                    showNotification('⏸️ Autoplay desativado', 'info');
                }
            }
            return autoPlayEnabled;
        },
        getAutoplayStatus: () => autoPlayEnabled
    };
})();

// Inicializa quando o DOM está pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.PlaylistManager) {
            window.PlaylistManager.init();
        }
    });
} else {
    if (window.PlaylistManager) {
        window.PlaylistManager.init();
    }
}
