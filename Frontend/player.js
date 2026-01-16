// Music player module
(function(){
    // Music player module

    const playlist = [
        { title: 'PRA TE ENCANTAR', artist: 'ORGULHO DA CIDADE', file: '/audio/MASTER%2001.mp3' },
        { title: 'LÁGRIMAS DE SAUDADE', artist: 'ORGULHO DA CIDADE', file: '/audio/MASTER%2002.mp3' },
        { title: 'PROMESSA', artist: 'ORGULHO DA CIDADE', file: '/audio/MASTER%2003.mp3' },
        { title: 'GUERREIRO', artist: 'ORGULHO DA CIDADE', file: '/audio/MASTER%2004.mp3' },
        { title: 'MORENA', artist: 'ORGULHO DA CIDADE', file: '/audio/MASTER%2005.mp3' }
    ];

    let currentTrackIndex = 0;
    let audioPlayer;
    let playPauseBtn;
    let prevBtn;
    let nextBtn;
    let progressBar;
    let volumeSlider;
    let volumeBtn;
    let currentTimeSpan;
    let totalTimeSpan;
    let songTitleSpan;
    let songArtistSpan;

    function init() {
        console.log('Inicializando player...');
        
        // Inicializa elementos
        audioPlayer = document.getElementById('audioPlayer');
        playPauseBtn = document.querySelector('.play-pause');
        prevBtn = document.querySelector('.previous');
        nextBtn = document.querySelector('.next');
        progressBar = document.querySelector('.progress-current');
        volumeSlider = document.querySelector('.volume-slider');
        volumeBtn = document.querySelector('.volume');
        currentTimeSpan = document.querySelector('.current-time');
        totalTimeSpan = document.querySelector('.total-time');
        songTitleSpan = document.querySelector('.current-song-title');
        songArtistSpan = document.querySelector('.current-song-artist');

        if (!audioPlayer) {
            console.info('Player: elemento <audio> não encontrado — pulando inicialização do player.');
            return;
        }

        // Configura eventos
        if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);
        if (prevBtn) prevBtn.addEventListener('click', playPrevious);
        if (nextBtn) nextBtn.addEventListener('click', playNext);
        if (volumeSlider) volumeSlider.addEventListener('input', handleVolumeChange);
        if (volumeBtn) volumeBtn.addEventListener('click', toggleMute);

        audioPlayer.addEventListener('timeupdate', updateProgress);
        audioPlayer.addEventListener('loadedmetadata', () => {
            if (totalTimeSpan) totalTimeSpan.textContent = formatTime(audioPlayer.duration);
        });

        document.querySelector('.progress-bar')?.addEventListener('click', (e) => {
            const progressBarEl = e.currentTarget;
            const clickPosition = e.offsetX / progressBarEl.offsetWidth;
            if (audioPlayer.duration) audioPlayer.currentTime = clickPosition * audioPlayer.duration;
        });

        // Carrega primeira música
        loadTrack(0);
        console.log('Player inicializado');
    }

    function loadTrack(index) {
        if (!audioPlayer) return;
        if (index >= 0 && index < playlist.length) {
            currentTrackIndex = index;
            const track = playlist[currentTrackIndex];
            console.log('Carregando música:', track.title);

            audioPlayer.src = track.file;
            if (songTitleSpan) songTitleSpan.textContent = track.title;
            if (songArtistSpan) songArtistSpan.textContent = track.artist;

            try {
                const coverEl = document.querySelector('.player-cover');
                if (coverEl) {
                    coverEl.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = 'images/logo.png';
                    img.alt = 'Logo - ' + track.title;
                    img.style.objectFit = 'contain';
                    img.style.padding = '8px';
                    img.style.background = '#fff';
                    coverEl.appendChild(img);
                }
            } catch (e) { console.warn('Erro ao atualizar capa:', e); }

            if (audioPlayer.paused && playPauseBtn) {
                playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        }
    }

    function togglePlay() {
        if (!audioPlayer || !playPauseBtn) return;
        if (audioPlayer.paused) {
            audioPlayer.play();
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            audioPlayer.pause();
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    }

    function playPrevious() {
        let newIndex = currentTrackIndex - 1;
        if (newIndex < 0) newIndex = playlist.length - 1;
        loadTrack(newIndex);
        if (audioPlayer) {
            audioPlayer.play();
            if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }
    }

    function playNext() {
        let newIndex = currentTrackIndex + 1;
        if (newIndex >= playlist.length) {
            // Playlist terminou - parar de tocar
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
                if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
            return;
        }
        loadTrack(newIndex);
        if (audioPlayer) {
            audioPlayer.play();
            if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }
    }

    function updateProgress() {
        if (!audioPlayer || !progressBar) return;
        const progress = (audioPlayer.currentTime / (audioPlayer.duration || 1)) * 100;
        progressBar.style.width = progress + '%';
        if (currentTimeSpan) currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
    }

    function handleVolumeChange() {
        if (!audioPlayer || !volumeSlider) return;
        audioPlayer.volume = volumeSlider.value / 100;
        updateVolumeIcon();
    }

    function toggleMute() {
        if (!audioPlayer) return;
        audioPlayer.muted = !audioPlayer.muted;
        updateVolumeIcon();
    }

    function updateVolumeIcon() {
        if (!volumeBtn || !audioPlayer) return;
        const volumeIcon = volumeBtn.querySelector('i');
        if (!volumeIcon) return;
        if (audioPlayer.muted || audioPlayer.volume === 0) {
            volumeIcon.className = 'fas fa-volume-mute';
        } else if (audioPlayer.volume < 0.5) {
            volumeIcon.className = 'fas fa-volume-down';
        } else {
            volumeIcon.className = 'fas fa-volume-up';
        }
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60) || 0;
        seconds = Math.floor(seconds % 60) || 0;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // Função para renderizar os links das plataformas
    function renderPlatformLinks() {
        const container = document.getElementById('platformLinks');
        if (!container) return;
        container.innerHTML = '';

        PLATFORMS.forEach(p => {
            const wrap = document.createElement('div');
            wrap.className = 'platform';

            const a = document.createElement('a');
            const url = PLATFORM_LINKS[p.key] || '';
            a.href = url || '#';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';

            const icon = document.createElement('img');
            icon.src = PLATFORM_ICONS[p.key];
            icon.alt = `${p.label} icon`;
            icon.className = 'platform-icon';
            a.appendChild(icon);

            if (!HIDE_LABELS.includes(p.key)) {
                const label = document.createElement('span');
                label.className = 'platform-label';
                label.textContent = p.label;
                a.appendChild(label);
            }

            wrap.appendChild(a);
            container.appendChild(wrap);
        });
    }

    // Expõe API pública
    window.Player = { 
        init: () => {
            init();
            renderPlatformLinks();
        }
    };
})();