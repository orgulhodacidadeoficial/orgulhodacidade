// Playlist simplificada - toca música direto sem baixar
(function(){
    let playlistData = [];
    const STORAGE_KEY = 'boiPlaylist';
    
    // Inicializa a playlist
    async function init() {
        loadPlaylistFromStorage();
        await setupUI();
    }

    // Carrega playlist do localStorage
    function loadPlaylistFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                playlistData = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Erro ao carregar playlist:', e);
            playlistData = [];
        }
    }

    // Salva playlist no localStorage
    function savePlaylistToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(playlistData));
        } catch (e) {
            console.error('Erro ao salvar playlist:', e);
        }
    }

    // Cria a interface de playlist
    async function setupUI() {
        const container = document.getElementById('playlistContainer');
        if (!container) return;

        // HTML da interface
        container.innerHTML = `
            <div class="playlist-section">
                <h2>Minha Playlist</h2>
                
                <div class="add-music-form">
                    <h3>Adicionar Música</h3>
                    <form id="addMusicForm">
                        <input type="text" id="musicTitle" placeholder="Título" required>
                        <input type="text" id="musicArtist" placeholder="Artista" required>
                        <input type="file" id="musicFile" accept="audio/*" required>
                        <button type="submit">Adicionar à Playlist</button>
                    </form>
                </div>

                <div id="playlistList" class="playlist-list">
                    <p class="empty-message">Nenhuma música na playlist</p>
                </div>
            </div>
        `;

        // Adiciona event listeners
        document.getElementById('addMusicForm').addEventListener('submit', handleAddMusic);
        renderPlaylist();
    }

    // Adiciona música à playlist
    async function handleAddMusic(e) {
        e.preventDefault();
        
        const title = document.getElementById('musicTitle').value;
        const artist = document.getElementById('musicArtist').value;
        const fileInput = document.getElementById('musicFile');
        const file = fileInput.files[0];

        if (!file) {
            showNotification('❌ Selecione um arquivo de áudio', 'warning');
            return;
        }

        const btn = e.target.querySelector('button');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⏳ Enviando...';

        try {
            // Upload do arquivo
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', title);
            formData.append('artist', artist);

            const response = await fetch('/api/upload-audio', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Erro ao fazer upload');
            }

            const result = await response.json();
            
            // Adiciona à playlist (apenas URL, sem armazenar arquivo localmente)
            const musicId = 'music_' + Date.now();
            const music = {
                id: musicId,
                title: title,
                artist: artist,
                fileName: file.name,
                serverUrl: result.url, // URL para tocar direto
                addedAt: new Date().toISOString()
            };

            playlistData.push(music);
            savePlaylistToStorage();
            renderPlaylist();

            // Limpa formulário
            document.getElementById('addMusicForm').reset();
            showNotification('✅ Música adicionada com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao adicionar música:', err);
            showNotification('❌ Erro ao adicionar música', 'warning');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    // Toca uma música
    function playMusic(musicId) {
        const music = playlistData.find(m => m.id === musicId);
        if (!music || !music.serverUrl) {
            showNotification('❌ Música não encontrada', 'warning');
            return;
        }

        const audioPlayer = document.getElementById('audioPlayer');
        if (!audioPlayer) {
            showNotification('❌ Player de áudio não encontrado', 'warning');
            return;
        }

        // Define a fonte e toca
        audioPlayer.src = music.serverUrl;
        audioPlayer.play().catch(err => {
            console.error('Erro ao tocar música:', err);
            showNotification('❌ Erro ao tocar a música. Verifique sua conexão.', 'warning');
        });

        // Atualiza UI
        updatePlaylistUI(musicId);
    }

    // Remove uma música da playlist
    function removeMusic(musicId) {
        playlistData = playlistData.filter(m => m.id !== musicId);
        savePlaylistToStorage();
        renderPlaylist();
        showNotification('✅ Música removida', 'success');
    }

    // Renderiza a lista de playlist
    function renderPlaylist() {
        const listContainer = document.getElementById('playlistList');
        if (!listContainer) return;

        if (playlistData.length === 0) {
            listContainer.innerHTML = '<p class="empty-message">Nenhuma música na playlist</p>';
            return;
        }

        listContainer.innerHTML = `
            <ul class="music-list">
                ${playlistData.map(music => `
                    <li class="music-item" data-id="${music.id}">
                        <div class="music-info">
                            <div class="music-title">${escapeHtml(music.title)}</div>
                            <div class="music-artist">${escapeHtml(music.artist)}</div>
                        </div>
                        <div class="music-actions">
                            <button class="play-btn" onclick="window.playMusic('${music.id}')">▶ Tocar</button>
                            <button class="delete-btn" onclick="window.removeMusic('${music.id}')">🗑 Remover</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    // Atualiza UI ao tocar uma música
    function updatePlaylistUI(musicId) {
        document.querySelectorAll('.music-item').forEach(item => {
            item.classList.remove('playing');
        });
        const playingItem = document.querySelector(`[data-id="${musicId}"]`);
        if (playingItem) {
            playingItem.classList.add('playing');
        }
    }

    // Escapa HTML para segurança
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Mostra notificação
    function showNotification(message, type = 'info') {
        console.log(message);
        // Se existir função global, usa ela
        if (window.showNotification && typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        }
    }

    // Expõe funções globais
    window.playMusic = playMusic;
    window.removeMusic = removeMusic;

    // Inicializa quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
