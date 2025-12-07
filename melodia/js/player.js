class MusicPlayer {
    constructor() {
        this.audio = new Audio();
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.isShuffle = false;
        this.repeatMode = 0;
        this.volume = 0.7;
        this.lyrics = [];
        this.transLyrics = [];
        this.yrcLyrics = [];
        this.hasYrc = false;
        this.hasTrans = false;
        this.showTrans = true;
        this.currentLyricIndex = -1;
        this.currentQuality = 'standard';
        this.preferredQuality = 'exhigh';
        this.likedSongs = new Set();

        this.audio.volume = this.volume;
        this.setupAudioEvents();
        this.loadLikedSongs();
    }

    async loadLikedSongs() {
        const userInfo = localStorage.getItem('user_info');
        if (!userInfo) return;
        try {
            const user = JSON.parse(userInfo);
            const res = await api.getLikeList(user.userId);
            if (res && res.ids) {
                this.likedSongs = new Set(res.ids);
            }
        } catch (e) {
            console.error('Failed to load liked songs:', e);
        }
    }

    isLiked(id) {
        return this.likedSongs.has(id);
    }

    async toggleLike(id) {
        const isCurrentlyLiked = this.isLiked(id);
        try {
            const res = await api.likeTrack(id, !isCurrentlyLiked);
            if (res && res.code === 200) {
                if (isCurrentlyLiked) {
                    this.likedSongs.delete(id);
                } else {
                    this.likedSongs.add(id);
                }
                this.updateLikeUI(id);
                this.showToast(isCurrentlyLiked ? '已取消喜欢' : '已添加到我喜欢的音乐');
                return true;
            }
        } catch (e) {
            console.error('Failed to toggle like:', e);
            this.showToast('操作失败，请先登录');
        }
        return false;
    }

    updateLikeUI(id) {
        const isLiked = this.isLiked(id);
        document.querySelectorAll('.like-btn').forEach(btn => {
            if (this.currentTrack && this.currentTrack.id === id) {
                btn.classList.toggle('liked', isLiked);
                const svg = btn.querySelector('svg path');
                if (svg) {
                    svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
                }
            }
        });
    }

    setupAudioEvents() {
        this.audio.addEventListener('timeupdate', () => {
            this.onTimeUpdate();
        });

        this.audio.addEventListener('ended', () => {
            this.onTrackEnded();
        });

        this.audio.addEventListener('loadedmetadata', () => {
            this.onMetadataLoaded();
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.onAudioError();
        });

        this.audio.addEventListener('canplay', () => {
            if (this.isPlaying) {
                this.audio.play().catch(console.error);
            }
        });
    }

    async loadTrack(track) {
        try {
            // 使用带降级策略的API
            const urlRes = await api.getSongUrlWithFallback(track.id, this.preferredQuality);
            console.log('Song URL response:', urlRes);
            
            if (urlRes.data && urlRes.data[0] && urlRes.data[0].url) {
                const songData = urlRes.data[0];
                this.currentQuality = urlRes.actualLevel || 'standard';
                console.log('Playing quality:', this.currentQuality);
                
                this.audio.src = songData.url;
                this.currentTrack = track;
                
                this.loadLyrics(track.id);
                this.updateNowPlayingUI();
                this.updateQualityIndicator();
                this.addToHistory(track);
                
                return true;
            } else {
                console.error('No valid URL for track:', track.title);
                this.showToast('该歌曲暂无音源');
                return false;
            }
        } catch (error) {
            console.error('Failed to load track:', error);
            this.showToast('加载失败，请重试');
            return false;
        }
    }

    updateQualityIndicator() {
        const qualityLabels = {
            'jymaster': '臻品母带',
            'sky': '沉浸环绕',
            'jyeffect': '高清环绕',
            'hires': 'Hi-Res',
            'lossless': '无损',
            'exhigh': '极高',
            'higher': '较高',
            'standard': '标准'
        };
        const label = qualityLabels[this.currentQuality] || this.currentQuality;
        console.log('Current quality:', label);
    }

    async loadLyrics(id) {
        try {
            // 优先尝试获取逐字歌词
            const newRes = await api.getLyricNew(id);
            
            if (newRes.yrc && newRes.yrc.lyric) {
                // 有逐字歌词
                this.yrcLyrics = api.parseYrc(newRes.yrc.lyric);
                this.hasYrc = this.yrcLyrics.length > 0;
                console.log('Loaded YRC lyrics:', this.yrcLyrics.length, 'lines');
            } else {
                this.yrcLyrics = [];
                this.hasYrc = false;
            }
            
            // 同时加载普通歌词作为备用
            if (newRes.lrc && newRes.lrc.lyric) {
                this.lyrics = api.parseLyric(newRes.lrc.lyric);
            } else {
                // 回退到旧接口
                const res = await api.getLyric(id);
                if (res.lrc && res.lrc.lyric) {
                    this.lyrics = api.parseLyric(res.lrc.lyric);
                } else {
                    this.lyrics = [];
                }
            }
            
            // 加载翻译歌词
            if (newRes.tlyric && newRes.tlyric.lyric) {
                this.transLyrics = api.parseTransLyric(newRes.tlyric.lyric);
                this.hasTrans = this.transLyrics.length > 0;
                console.log('Loaded translation:', this.transLyrics.length, 'lines');
            } else {
                this.transLyrics = [];
                this.hasTrans = false;
            }
            
            this.updateLyricsDisplay();
        } catch (error) {
            console.error('Failed to load lyrics:', error);
            this.lyrics = [];
            this.yrcLyrics = [];
            this.transLyrics = [];
            this.hasYrc = false;
            this.hasTrans = false;
        }
    }
    
    getTranslation(time) {
        if (!this.hasTrans || !this.showTrans) return null;
        let translation = null;
        for (let i = 0; i < this.transLyrics.length; i++) {
            if (this.transLyrics[i].time <= time) {
                translation = this.transLyrics[i].text;
            } else {
                break;
            }
        }
        return translation;
    }

    toggleTranslation() {
        this.showTrans = !this.showTrans;
        this.updateLyricsDisplay();
        this.showToast(this.showTrans ? '已开启翻译' : '已关闭翻译');
    }

    async play() {
        if (!this.audio.src && this.playlist.length > 0) {
            await this.playTrack(this.currentIndex);
            return;
        }

        try {
            await this.audio.play();
            this.isPlaying = true;
            this.updatePlayButtonUI();
        } catch (error) {
            console.error('Play failed:', error);
        }
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayButtonUI();
    }

    toggle() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    async playTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        this.currentIndex = index;
        const track = this.playlist[index];
        
        const loaded = await this.loadTrack(track);
        if (loaded) {
            this.isPlaying = true;
            this.audio.play().catch(console.error);
            this.updatePlayButtonUI();
            this.updateTrackListUI();
        }
    }

    async next() {
        let nextIndex;
        
        if (this.isShuffle) {
            nextIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            nextIndex = (this.currentIndex + 1) % this.playlist.length;
        }
        
        await this.playTrack(nextIndex);
    }

    async prev() {
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }
        
        let prevIndex;
        if (this.isShuffle) {
            prevIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            prevIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        }
        
        await this.playTrack(prevIndex);
    }

    seek(percent) {
        if (this.audio.duration) {
            this.audio.currentTime = (percent / 100) * this.audio.duration;
        }
    }

    setVolume(percent) {
        this.volume = percent / 100;
        this.audio.volume = this.volume;
        this.updateVolumeUI();
    }

    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        document.querySelectorAll('.shuffle-btn').forEach(btn => {
            btn.classList.toggle('active', this.isShuffle);
        });
    }

    toggleRepeat() {
        this.repeatMode = (this.repeatMode + 1) % 3;
        document.querySelectorAll('.repeat-btn').forEach(btn => {
            btn.classList.toggle('active', this.repeatMode > 0);
            if (this.repeatMode === 2) {
                btn.classList.add('repeat-one');
            } else {
                btn.classList.remove('repeat-one');
            }
        });
    }

    setPlaylist(tracks, startIndex = 0) {
        this.playlist = tracks;
        this.currentIndex = startIndex;
        this.renderTrackList();
    }

    addToPlaylist(track) {
        this.playlist.push(track);
        this.renderTrackList();
    }

    onTimeUpdate() {
        if (!this.audio.duration) return;

        const percent = (this.audio.currentTime / this.audio.duration) * 100;
        const currentTime = this.formatTime(this.audio.currentTime);
        const totalTime = this.formatTime(this.audio.duration);

        document.getElementById('progressPlayed').style.width = `${percent}%`;
        document.getElementById('progressHandle').style.left = `${percent}%`;
        document.querySelector('.fullscreen-progress-played').style.width = `${percent}%`;

        document.querySelector('.time-current').textContent = currentTime;
        document.querySelector('.time-total').textContent = totalTime;
        document.querySelector('.fullscreen-time span:first-child').textContent = currentTime;
        document.querySelector('.fullscreen-time span:last-child').textContent = totalTime;

        this.updateCurrentLyric();
    }

    onTrackEnded() {
        if (this.repeatMode === 2) {
            this.audio.currentTime = 0;
            this.audio.play();
        } else if (this.repeatMode === 1 || this.currentIndex < this.playlist.length - 1) {
            this.next();
        } else {
            this.isPlaying = false;
            this.updatePlayButtonUI();
        }
    }

    onMetadataLoaded() {
        const totalTime = this.formatTime(this.audio.duration);
        document.querySelector('.time-total').textContent = totalTime;
        document.querySelector('.fullscreen-time span:last-child').textContent = totalTime;
    }

    onAudioError() {
        this.showToast('播放出错，尝试下一首');
        setTimeout(() => this.next(), 2000);
    }

    updateNowPlayingUI() {
        const track = this.currentTrack;
        if (!track) return;

        const coverSmall = track.cover ? `${track.cover}?param=100y100` : 'https://via.placeholder.com/100';
        const coverMedium = track.cover ? `${track.cover}?param=200y200` : 'https://via.placeholder.com/200';
        const coverLarge = track.cover ? `${track.cover}?param=400y400` : 'https://via.placeholder.com/400';

        document.querySelector('.now-playing-title').textContent = track.title;
        document.querySelector('.now-playing-artist').textContent = `${track.artist} · ${track.album}`;
        document.querySelector('.now-playing-cover img').src = coverSmall;

        document.querySelector('.fullscreen-title').textContent = track.title;
        document.querySelector('.fullscreen-artist').textContent = `${track.artist} · ${track.album}`;
        document.getElementById('fullscreenCoverImg').src = coverLarge;

        document.title = `${track.title} - ${track.artist} | Dou`;

        // 更新背景光效颜色
        if (typeof updateAuroraFromCover === 'function' && track.cover) {
            updateAuroraFromCover(coverSmall);
        }
        if (typeof updateFullscreenColors === 'function' && track.cover) {
            updateFullscreenColors(coverSmall);
        }
    }

    updatePlayButtonUI() {
        const playBtns = document.querySelectorAll('.btn-play, .btn-play-large');
        playBtns.forEach(btn => {
            const playIcon = btn.querySelector('.icon-play');
            const pauseIcon = btn.querySelector('.icon-pause');
            if (this.isPlaying) {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            } else {
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            }
        });

        const coverEl = document.querySelector('.now-playing-cover');
        if (coverEl) {
            coverEl.classList.toggle('playing', this.isPlaying);
        }

        const app = document.querySelector('.app');
        if (app) {
            app.classList.toggle('playing', this.isPlaying);
        }

        // 更新音量图标
        this.updateVolumeIcon();
    }

    updateVolumeIcon() {
        const volumeBtn = document.querySelector('.volume-btn');
        if (!volumeBtn) return;

        const icon = volumeBtn.querySelector('svg');
        if (this.volume === 0) {
            icon.innerHTML = `
                <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M23 9l-6 6M17 9l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            `;
        } else if (this.volume < 0.5) {
            icon.innerHTML = `
                <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            `;
        } else {
            icon.innerHTML = `
                <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            `;
        }
    }

    updateVolumeUI() {
        const percent = this.volume * 100;
        const volumeFill = document.querySelector('.volume-fill');
        const fullscreenVolumeFill = document.querySelector('.fullscreen-volume-fill');
        if (volumeFill) volumeFill.style.width = `${percent}%`;
        if (fullscreenVolumeFill) fullscreenVolumeFill.style.width = `${percent}%`;
        this.updateVolumeIcon();
    }

    updateTrackListUI() {
        document.querySelectorAll('.track-item').forEach((item, index) => {
            item.classList.toggle('playing', index === this.currentIndex);
        });
    }

    updateCurrentLyric() {
        const lyricsToUse = this.hasYrc ? this.yrcLyrics : this.lyrics;
        if (!lyricsToUse.length) return;

        const currentTime = this.audio.currentTime;
        let newIndex = -1;

        for (let i = lyricsToUse.length - 1; i >= 0; i--) {
            if (currentTime >= lyricsToUse[i].time) {
                newIndex = i;
                break;
            }
        }

        if (newIndex !== this.currentLyricIndex) {
            this.currentLyricIndex = newIndex;
            this.highlightCurrentLyric();
        }

        // 逐字歌词高亮
        if (this.hasYrc && newIndex >= 0) {
            this.updateYrcWordHighlight(currentTime, newIndex);
        }
    }

    updateYrcWordHighlight(currentTime, lineIndex) {
        const scroll = document.getElementById('lyricsScroll');
        if (!scroll) return;

        const activeLine = scroll.querySelector(`.lyric-line[data-index="${lineIndex}"]`);
        if (!activeLine) return;

        const words = activeLine.querySelectorAll('.yrc-word');
        let currentWordIndex = -1;
        
        // 找到当前正在唱的字
        words.forEach((wordEl, index) => {
            const wordTime = parseFloat(wordEl.dataset.time);
            const wordDuration = parseFloat(wordEl.dataset.duration);
            const wordEnd = wordTime + wordDuration;
            
            if (currentTime >= wordTime && currentTime < wordEnd) {
                currentWordIndex = index;
            }
        });
        
        // 更新class
        words.forEach((wordEl, index) => {
            const wordTime = parseFloat(wordEl.dataset.time);
            const wordDuration = parseFloat(wordEl.dataset.duration);
            const wordEnd = wordTime + wordDuration;
            
            if (index === currentWordIndex) {
                // 当前字
                wordEl.classList.add('yrc-current');
                wordEl.classList.remove('yrc-passed');
            } else if (currentTime >= wordEnd) {
                // 已唱完的字
                wordEl.classList.remove('yrc-current');
                wordEl.classList.add('yrc-passed');
            } else {
                // 未唱到的字
                wordEl.classList.remove('yrc-current', 'yrc-passed');
            }
        });
    }

    updateLyricsDisplay() {
        const scroll = document.getElementById('lyricsScroll');
        if (!scroll) return;

        const lyricsToUse = this.hasYrc ? this.yrcLyrics : this.lyrics;

        if (!lyricsToUse.length) {
            scroll.innerHTML = `
                <div class="no-lyrics">
                    <span>纯音乐，请欣赏</span>
                </div>
            `;
            return;
        }

        // 构建翻译映射
        const transMap = new Map();
        if (this.hasTrans && this.showTrans) {
            this.transLyrics.forEach(t => {
                transMap.set(t.time, t.text);
            });
        }

        if (this.hasYrc) {
            // 逐字歌词显示
            scroll.innerHTML = lyricsToUse.map((line, index) => {
                const wordsHtml = line.words ? line.words.map((word, wi) => 
                    `<span class="yrc-word" data-time="${word.time}" data-duration="${word.duration}">${word.text}</span>`
                ).join('') : `<span class="yrc-word">${line.text}</span>`;
                
                // 查找对应翻译
                const trans = this.findTranslation(line.time);
                const transHtml = trans ? `<span class="lyric-trans">${trans}</span>` : '';
                
                return `<div class="lyric-line yrc-line" data-index="${index}" data-time="${line.time}" data-duration="${line.duration}">
                    <span class="lyric-text">${wordsHtml}</span>
                    ${transHtml}
                </div>`;
            }).join('');
        } else {
            // 普通歌词显示
            scroll.innerHTML = lyricsToUse.map((line, index) => {
                const trans = this.findTranslation(line.time);
                const transHtml = trans ? `<span class="lyric-trans">${trans}</span>` : '';
                
                return `<div class="lyric-line" data-index="${index}" data-time="${line.time}">
                    <span class="lyric-text">${line.text || '...'}</span>
                    ${transHtml}
                </div>`;
            }).join('');
        }

        scroll.querySelectorAll('.lyric-line').forEach(line => {
            line.addEventListener('click', () => {
                const time = parseFloat(line.dataset.time);
                if (!isNaN(time)) {
                    this.audio.currentTime = time;
                }
            });
        });
    }
    
    findTranslation(time) {
        if (!this.hasTrans || !this.showTrans) return null;
        // 找到时间最接近的翻译（容差1秒）
        let bestMatch = null;
        let minDiff = 1;
        for (const t of this.transLyrics) {
            const diff = Math.abs(t.time - time);
            if (diff < minDiff) {
                minDiff = diff;
                bestMatch = t.text;
            }
        }
        return bestMatch;
    }

    highlightCurrentLyric() {
        const scroll = document.getElementById('lyricsScroll');
        if (!scroll) return;

        const lines = scroll.querySelectorAll('.lyric-line');
        lines.forEach((line, index) => {
            const isActive = index === this.currentLyricIndex;
            const isPassed = index < this.currentLyricIndex;
            
            line.classList.toggle('active', isActive);
            line.classList.toggle('passed', isPassed);
        });

        const activeLine = scroll.querySelector('.lyric-line.active');
        if (activeLine) {
            const container = document.getElementById('lyricsContainer');
            const containerHeight = container.offsetHeight;
            const lineTop = activeLine.offsetTop;
            const lineHeight = activeLine.offsetHeight;
            const targetScroll = lineTop - (containerHeight / 2) + (lineHeight / 2);
            
            this.smoothScrollLyrics(scroll, targetScroll, 500);
        }
    }

    smoothScrollLyrics(element, target, duration) {
        if (this.lyricScrollAnimation) {
            cancelAnimationFrame(this.lyricScrollAnimation);
        }
        
        const start = element.scrollTop;
        const distance = target - start;
        
        // 如果距离很小，直接跳转
        if (Math.abs(distance) < 5) {
            element.scrollTop = target;
            return;
        }
        
        const startTime = performance.now();
        
        // easeOutExpo - 更流畅的减速曲线
        const easeOutExpo = (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutExpo(progress);
            
            element.scrollTop = start + (distance * eased);
            
            if (progress < 1) {
                this.lyricScrollAnimation = requestAnimationFrame(animate);
            }
        };
        
        this.lyricScrollAnimation = requestAnimationFrame(animate);
    }

    renderTrackList(options = {}) {
        const container = document.getElementById('trackList');
        if (!container) return;

        const { showDelete = false } = options;

        container.innerHTML = this.playlist.map((track, index) => {
            // 生成可点击的歌手链接
            const artistsHtml = (track.artists && track.artists.length > 0) 
                ? track.artists.map(a => 
                    `<span class="artist-link" data-artist-id="${a.id}" data-artist-name="${a.name}">${a.name}</span>`
                ).join(' / ')
                : `<span>${track.artist}</span>`;
            
            return `
            <div class="track-item ${index === this.currentIndex && this.isPlaying ? 'playing' : ''}" data-index="${index}" data-id="${track.id}" data-mvid="${track.mvid || ''}">
                <div class="track-index">
                    <span class="index-number">${index + 1}</span>
                    <span class="play-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"/>
                        </svg>
                    </span>
                    <span class="playing-icon">
                        <span class="bar"></span>
                        <span class="bar"></span>
                        <span class="bar"></span>
                    </span>
                </div>
                <div class="track-info">
                    <div class="track-cover">
                        <img data-src="${track.cover ? track.cover + '?param=80y80' : ''}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect fill='%23222' width='80' height='80'/%3E%3C/svg%3E" alt="${track.title}" class="lazy-img">
                    </div>
                    <div class="track-details">
                        <div class="track-title">${track.title}</div>
                        <div class="track-artist">${artistsHtml}</div>
                    </div>
                </div>
                <div class="track-album">${track.album}</div>
                <div class="track-actions">
                    <button class="track-action-btn like-btn ${this.likedSongs.has(track.id) ? 'liked' : ''}" data-action="like" title="喜欢">
                        <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                    </button>
                    <button class="track-action-btn comment-btn" data-action="comment" title="评论">
                        <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                    </button>
                    <button class="track-action-btn add-to-playlist-btn" data-action="add-to-playlist" title="添加到歌单">
                        <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                    <button class="track-action-btn download-btn" data-action="download" title="下载">
                        <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    ${track.mvid ? `<button class="track-action-btn mv-btn" data-action="mv" title="播放MV">
                        <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                            <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M10 9l5 3-5 3V9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                        </svg>
                    </button>` : ''}
                    ${showDelete ? `<button class="track-action-btn delete-btn" data-action="delete" title="从历史中删除">
                        <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>` : ''}
                </div>
                <div class="track-duration">${track.duration}</div>
            </div>
        `}).join('');

        container.querySelectorAll('.track-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 如果点击的是操作按钮或歌手链接，不触发播放
                if (e.target.closest('.track-action-btn') || e.target.closest('.artist-link')) return;
                const index = parseInt(item.dataset.index);
                this.playTrack(index);
            });
        });

        // 歌手链接点击事件
        container.querySelectorAll('.artist-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation();
                const artistId = link.dataset.artistId;
                const artistName = link.dataset.artistName;
                if (artistId && typeof showArtist === 'function') {
                    showArtist(parseInt(artistId), artistName);
                }
            });
        });

        // 喜欢按钮事件
        container.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const item = btn.closest('.track-item');
                const trackId = parseInt(item.dataset.id);
                const track = this.playlist[parseInt(item.dataset.index)];
                await this.toggleLike(trackId, track.title);
                btn.classList.toggle('liked', this.likedSongs.has(trackId));
            });
        });

        // 评论按钮事件
        container.querySelectorAll('.comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.track-item');
                const trackId = parseInt(item.dataset.id);
                const track = this.playlist[parseInt(item.dataset.index)];
                if (typeof showComments === 'function') {
                    showComments(trackId, track.title);
                }
            });
        });

        // MV按钮事件
        container.querySelectorAll('.mv-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.track-item');
                const mvid = item.dataset.mvid;
                if (mvid && typeof playMVEnhanced === 'function') {
                    playMVEnhanced(parseInt(mvid));
                } else if (mvid && typeof playMV === 'function') {
                    playMV(parseInt(mvid));
                }
            });
        });

        // 下载按钮事件
        container.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.track-item');
                const track = this.playlist[parseInt(item.dataset.index)];
                if (typeof showDownloadModal === 'function') {
                    showDownloadModal(track);
                }
            });
        });

        // 添加到歌单按钮事件
        container.querySelectorAll('.add-to-playlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.track-item');
                const track = this.playlist[parseInt(item.dataset.index)];
                if (typeof showAddToPlaylistModal === 'function') {
                    showAddToPlaylistModal(track);
                }
            });
        });

        // 删除按钮事件（历史记录）
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.track-item');
                const trackId = parseInt(item.dataset.id);
                this.removeFromHistory(trackId);
                item.style.transition = 'opacity 0.2s, transform 0.2s';
                item.style.opacity = '0';
                item.style.transform = 'translateX(20px)';
                setTimeout(() => {
                    item.remove();
                    // 更新索引
                    container.querySelectorAll('.track-item').forEach((el, i) => {
                        el.dataset.index = i;
                        el.querySelector('.index-number').textContent = i + 1;
                    });
                }, 200);
            });
        });
        
        // 图片懒加载
        if (window.lazyLoader) {
            window.lazyLoader.observeAll(container);
        }
    }

    formatTime(seconds) {
        if (!seconds || !isFinite(seconds)) return '0:00';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    }

    showToast(message, duration = 3000) {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    // 添加到播放历史
    addToHistory(track) {
        // 验证必须是有效歌曲（有id、title、artist）
        if (!track || !track.id || !track.title || !track.artist) return;
        // 排除占位数据
        if (track.title === '未播放' || track.title === '夜空中最亮的星') return;
        
        const maxHistory = 200;
        let history = this.getHistory();
        
        // 移除已存在的相同歌曲
        history = history.filter(item => item.id !== track.id);
        
        // 添加到开头，包含播放时间
        history.unshift({
            ...track,
            playedAt: Date.now()
        });
        
        // 限制数量
        if (history.length > maxHistory) {
            history = history.slice(0, maxHistory);
        }
        
        localStorage.setItem('play_history', JSON.stringify(history));
    }

    // 获取播放历史
    getHistory() {
        try {
            const history = localStorage.getItem('play_history');
            const parsed = history ? JSON.parse(history) : [];
            // 过滤无效数据
            return parsed.filter(item => 
                item && item.id && item.title && item.artist &&
                item.title !== '未播放' && item.title !== '夜空中最亮的星'
            );
        } catch (e) {
            console.error('Failed to parse play history:', e);
            return [];
        }
    }

    // 清空播放历史
    clearHistory() {
        localStorage.removeItem('play_history');
    }

    // 从历史记录中删除单首歌曲
    removeFromHistory(trackId) {
        let history = this.getHistory();
        history = history.filter(t => t.id !== trackId);
        localStorage.setItem('play_history', JSON.stringify(history));
        // 同步更新播放列表
        this.playlist = this.playlist.filter(t => t.id !== trackId);
        this.showToast('已从历史记录中删除');
    }
}

window.MusicPlayer = MusicPlayer;
