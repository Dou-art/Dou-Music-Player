let player;
let currentView = 'home';
let searchTimeout = null;
let pageHistory = [];
let currentPage = { type: 'home', data: null };

async function init() {
    player = new MusicPlayer();
    
    setupEventListeners();
    setupKeyboardShortcuts();
    setupBackgroundEffects();
    setupBackButton();
    
    currentPage = { type: 'home', data: null };
    await loadInitialContent();
}

function setupBackButton() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', goBack);
    }
}

function navigateTo(type, data = null) {
    if (currentPage.type !== 'home') {
        pageHistory.push({ ...currentPage });
    }
    currentPage = { type, data };
    updateBackButton();
}

function goBack() {
    if (pageHistory.length > 0) {
        const prevPage = pageHistory.pop();
        currentPage = prevPage;
        
        loadPageByType(prevPage.type, prevPage.data);
        updateBackButton();
    } else {
        currentPage = { type: 'home', data: null };
        loadInitialContent();
        updateBackButton();
    }
}

async function loadPageByType(type, data) {
    switch (type) {
        case 'home':
            await loadInitialContent();
            break;
        case 'liked':
            await loadLikedSongs();
            break;
        case 'history':
            await loadRecentSongs();
            break;
        case 'discover':
            await loadToplist();
            break;
        case 'toplist':
            await loadToplistPage();
            break;
        case 'fm':
            await loadPersonalFM();
            break;
        case 'artists':
            await loadArtistsPage();
            break;
        case 'playlists':
            await loadMyPlaylists();
            break;
        case 'playlist':
            if (data?.id) await loadPlaylist(data.id, true);
            break;
        case 'search':
            if (data?.keywords) await handleSearch(data.keywords, true);
            break;
    }
}

function updateBackButton() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        const shouldShow = pageHistory.length > 0 || currentPage.type !== 'home';
        backBtn.style.display = shouldShow ? 'flex' : 'none';
        
        if (shouldShow) {
            backBtn.classList.add('visible');
        } else {
            backBtn.classList.remove('visible');
        }
    }
}

async function loadInitialContent() {
    showLoading(true);
    
    try {
        const [personalizedRes, newSongsRes] = await Promise.all([
            api.getPersonalized(10),
            api.getPersonalizedNewSong(20)
        ]);

        if (newSongsRes.result) {
            const tracks = newSongsRes.result.map(item => api.formatTrack(item.song));
            player.setPlaylist(tracks);
            
            updatePlaylistHeader({
                name: '推荐新歌',
                description: '每日为你推荐新鲜音乐',
                coverUrl: tracks[0]?.cover || '',
                trackCount: tracks.length
            });
        }

        if (personalizedRes.result) {
            renderRecommendedPlaylists(personalizedRes.result);
        }

    } catch (error) {
        console.error('Failed to load initial content:', error);
        player.showToast('加载失败，请检查网络连接');
    }
    
    showLoading(false);
}

function updatePlaylistHeader(info) {
    document.querySelector('.playlist-title').textContent = info.name;
    document.querySelector('.playlist-meta .song-count').textContent = `${info.trackCount}首歌曲`;
    
    if (info.coverUrl) {
        document.querySelector('.playlist-cover img').src = info.coverUrl + '?param=400y400';
    }

    const gradient = getRandomGradient();
    document.querySelector('.header-gradient').style.background = gradient;
}

function showRecommendedSection(show) {
    const section = document.querySelector('.section-header');
    const container = document.querySelector('.recommended-playlists');
    if (section) section.style.display = show ? '' : 'none';
    if (container) container.style.display = show ? '' : 'none';
}

function renderRecommendedPlaylists(playlists) {
    const container = document.querySelector('.recommended-playlists');
    if (!container) return;
    showRecommendedSection(true);

    container.innerHTML = playlists.map(playlist => `
        <div class="playlist-card" data-id="${playlist.id}">
            <div class="playlist-card-cover">
                <img src="${playlist.picUrl}?param=300y300" alt="${playlist.name}">
                <button class="card-play-btn">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"/>
                    </svg>
                </button>
                <span class="play-count">${formatPlayCount(playlist.playCount)}</span>
            </div>
            <div class="playlist-card-name">${playlist.name}</div>
        </div>
    `).join('');

    container.querySelectorAll('.playlist-card').forEach(card => {
        card.addEventListener('click', () => {
            navigateTo('playlist', { id: card.dataset.id });
            loadPlaylist(card.dataset.id);
        });
    });
}

async function loadPlaylist(id, skipHistory = false) {
    showLoading(true);
    
    try {
        const [detailRes, tracksRes] = await Promise.all([
            api.getPlaylistDetail(id),
            api.getPlaylistTracks(id, 100)
        ]);

        if (tracksRes.songs) {
            const tracks = tracksRes.songs.map(song => api.formatTrack(song));
            player.setPlaylist(tracks);
            
            if (detailRes.playlist) {
                updatePlaylistHeader({
                    name: detailRes.playlist.name,
                    description: detailRes.playlist.description,
                    coverUrl: detailRes.playlist.coverImgUrl,
                    trackCount: tracks.length
                });
            }
        }
    } catch (error) {
        console.error('Failed to load playlist:', error);
        player.showToast('加载歌单失败');
    }
    
    showLoading(false);
}

async function handleSearch(keywords, skipHistory = false) {
    if (!keywords.trim()) return;
    
    if (!skipHistory) {
        navigateTo('search', { keywords });
    }
    
    showLoading(true);
    
    try {
        const res = await api.search(keywords, { limit: 50 });
        
        if (res.result && res.result.songs) {
            const tracks = res.result.songs.map(song => api.formatTrack(song));
            player.setPlaylist(tracks);
            
            updatePlaylistHeader({
                name: `搜索: ${keywords}`,
                description: '',
                coverUrl: tracks[0]?.cover || '',
                trackCount: tracks.length
            });
        } else {
            player.showToast('未找到相关歌曲');
        }
    } catch (error) {
        console.error('Search failed:', error);
        player.showToast('搜索失败，请重试');
    }
    
    showLoading(false);
}

async function loadToplist() {
    showLoading(true);
    
    try {
        const res = await api.getToplistDetail();
        
        if (res.list && res.list.length > 0) {
            const hotList = res.list[0];
            await loadPlaylist(hotList.id);
        }
    } catch (error) {
        console.error('Failed to load toplist:', error);
        player.showToast('加载排行榜失败');
    }
    
    showLoading(false);
}

async function loadToplistPage() {
    showLoading(true);
    
    try {
        const res = await api.getToplistDetail();
        
        if (res.list && res.list.length > 0) {
            const toplists = res.list;
            
            updatePlaylistHeader({
                name: '排行榜',
                description: '各类音乐榜单',
                coverUrl: toplists[0]?.coverImgUrl || '',
                trackCount: toplists.length,
                isToplistPage: true
            });
            
            renderToplistGrid(toplists);
        }
    } catch (error) {
        console.error('Failed to load toplist page:', error);
        player.showToast('加载排行榜失败');
    }
    
    showLoading(false);
}

function renderToplistGrid(toplists) {
    const container = document.getElementById('trackList');
    if (!container) return;
    
    const officialLists = toplists.filter(t => t.ToplistType);
    const globalLists = toplists.filter(t => !t.ToplistType);
    
    let html = `
        <div class="toplist-page">
            <div class="toplist-section">
                <h3 class="toplist-section-title">官方榜</h3>
                <div class="toplist-grid official">
                    ${officialLists.slice(0, 4).map(list => `
                        <div class="toplist-card official-card" data-id="${list.id}">
                            <div class="toplist-cover">
                                <img src="${list.coverImgUrl}?param=200y200" alt="${list.name}">
                                <div class="toplist-play-btn">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"/>
                                    </svg>
                                </div>
                                <span class="toplist-update">${list.updateFrequency || ''}</span>
                            </div>
                            <div class="toplist-info">
                                <div class="toplist-name">${list.name}</div>
                                <div class="toplist-tracks">
                                    ${(list.tracks || []).slice(0, 3).map((t, i) => `
                                        <div class="toplist-track-item">${i + 1}. ${t.first} - ${t.second}</div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="toplist-section">
                <h3 class="toplist-section-title">精选榜</h3>
                <div class="toplist-grid global">
                    ${globalLists.map(list => `
                        <div class="toplist-card" data-id="${list.id}">
                            <div class="toplist-cover small">
                                <img src="${list.coverImgUrl}?param=150y150" alt="${list.name}">
                                <div class="toplist-play-btn">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"/>
                                    </svg>
                                </div>
                            </div>
                            <div class="toplist-name">${list.name}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    container.querySelectorAll('.toplist-card').forEach(card => {
        card.addEventListener('click', async () => {
            const id = card.dataset.id;
            navigateTo('playlist', { id });
            await loadPlaylist(id);
        });
    });
}

async function loadNewSongs() {
    showLoading(true);
    
    try {
        const res = await api.getNewSongs(0);
        
        if (res.data) {
            const tracks = res.data.map(song => api.formatTrack(song));
            player.setPlaylist(tracks);
            
            updatePlaylistHeader({
                name: '新歌速递',
                description: '最新发行的华语歌曲',
                coverUrl: tracks[0]?.cover || '',
                trackCount: tracks.length
            });
        }
    } catch (error) {
        console.error('Failed to load new songs:', error);
        player.showToast('加载新歌失败');
    }
    
    showLoading(false);
}

// 每日推荐（需登录）
async function loadDailyRecommend() {
    showLoading(true);
    
    try {
        const res = await api.getDailyRecommendSongs();
        
        if (res && res.data && res.data.dailySongs) {
            const tracks = res.data.dailySongs.map(song => api.formatTrack(song));
            player.setPlaylist(tracks);
            
            updatePlaylistHeader({
                name: '每日推荐',
                description: '根据你的口味生成，每天6:00更新',
                coverUrl: tracks[0]?.cover || '',
                trackCount: tracks.length
            });
        } else {
            player.showToast('请先登录以获取每日推荐');
        }
    } catch (error) {
        console.error('Failed to load daily recommend:', error);
        player.showToast('加载每日推荐失败，请先登录');
    }
    
    showLoading(false);
}

// 播放历史（本地+云端）
async function loadRecentSongs() {
    showLoading(true);
    
    // 获取本地播放历史
    const localHistory = player.getHistory();
    let tracks = [...localHistory];
    
    // 尝试获取云端播放记录（需要登录）
    try {
        const res = await api.getRecentSongs(100);
        if (res && res.data && res.data.list) {
            const cloudTracks = res.data.list.map(item => api.formatTrack(item.data));
            const existingIds = new Set(tracks.map(t => t.id));
            cloudTracks.forEach(track => {
                if (!existingIds.has(track.id)) {
                    tracks.push(track);
                }
            });
        }
    } catch (error) {
        console.log('Cloud history not available, using local only');
    }
    
    if (tracks.length > 0) {
        player.playlist = tracks;
        player.renderTrackList({ showDelete: true });
        updatePlaylistHeader({
            name: '播放历史',
            description: `共 ${tracks.length} 首`,
            coverUrl: tracks[0]?.cover || '',
            trackCount: tracks.length
        });
        addClearHistoryButton();
    } else {
        player.setPlaylist([]);
        updatePlaylistHeader({
            name: '播放历史',
            description: '还没有播放过任何歌曲',
            coverUrl: '',
            trackCount: 0
        });
    }
    
    showLoading(false);
}

// 添加清空历史按钮
function addClearHistoryButton() {
    const header = document.querySelector('.playlist-header');
    if (!header) return;
    
    const existingBtn = header.querySelector('.clear-history-btn');
    if (existingBtn) existingBtn.remove();
    
    const btn = document.createElement('button');
    btn.className = 'clear-history-btn';
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        清空历史
    `;
    btn.addEventListener('click', () => {
        if (confirm('确定要清空播放历史吗？')) {
            player.clearHistory();
            player.showToast('播放历史已清空');
            loadRecentSongs();
        }
    });
    
    const actions = header.querySelector('.playlist-actions');
    if (actions) {
        actions.appendChild(btn);
    }
}

// 我的歌单
async function loadMyPlaylists() {
    const userInfo = localStorage.getItem('user_info');
    if (!userInfo) {
        player.showToast('请先登录');
        return;
    }

    showLoading(true);

    try {
        const res = await api.getMyPlaylists();
        const user = JSON.parse(userInfo);

        if (res?.playlist) {
            // 分离创建的和收藏的歌单
            const created = res.playlist.filter(p => p.creator?.userId === user.userId);
            const subscribed = res.playlist.filter(p => p.creator?.userId !== user.userId);

            // 更新头部
            document.querySelector('.playlist-type').textContent = '我的';
            document.querySelector('.playlist-title').textContent = '我的歌单';
            document.querySelector('.playlist-meta').innerHTML = `
                <span class="creator">创建 ${created.length} 个</span>
                <span class="dot">·</span>
                <span class="song-count">收藏 ${subscribed.length} 个</span>
            `;

            // 使用第一个歌单封面
            if (created.length > 0) {
                document.querySelector('.playlist-cover img').src = created[0].coverImgUrl + '?param=400y400';
            }

            const gradient = getRandomGradient();
            document.querySelector('.header-gradient').style.background = gradient;

            // 渲染歌单网格
            renderMyPlaylistsGrid(created, subscribed);
        }
    } catch (error) {
        console.error('Failed to load my playlists:', error);
        player.showToast('加载歌单失败');
    }

    showLoading(false);
}

// 渲染我的歌单网格
function renderMyPlaylistsGrid(created, subscribed) {
    const trackList = document.getElementById('trackList');
    if (!trackList) return;

    let html = `
        <div class="my-playlists-section">
            <div class="my-playlists-header">
                <h3>创建的歌单</h3>
                <button class="create-playlist-header-btn" onclick="showCreatePlaylistModal()">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    新建歌单
                </button>
            </div>
            <div class="my-playlists-grid">
                ${created.map(playlist => `
                    <div class="my-playlist-card" data-playlist-id="${playlist.id}">
                        <div class="my-playlist-card-cover">
                            <img src="${playlist.coverImgUrl}?param=200y200" alt="${playlist.name}">
                            <div class="my-playlist-card-overlay">
                                <button class="my-playlist-card-btn play-btn" data-action="play" title="播放">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                        <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"/>
                                    </svg>
                                </button>
                                ${playlist.name !== '我喜欢的音乐' ? `
                                <button class="my-playlist-card-btn delete-btn" data-action="delete" data-name="${playlist.name}" title="删除">
                                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </button>
                                ` : ''}
                            </div>
                        </div>
                        <div class="my-playlist-card-info">
                            <div class="my-playlist-card-name">${playlist.name}</div>
                            <div class="my-playlist-card-count">${playlist.trackCount} 首</div>
                        </div>
                    </div>
                `).join('')}
            </div>
    `;

    // 收藏的歌单
    if (subscribed.length > 0) {
        html += `
            <div class="my-playlists-header" style="margin-top: 32px;">
                <h3>收藏的歌单</h3>
            </div>
            <div class="my-playlists-grid">
                ${subscribed.map(playlist => `
                    <div class="my-playlist-card" data-playlist-id="${playlist.id}">
                        <div class="my-playlist-card-cover">
                            <img src="${playlist.coverImgUrl}?param=200y200" alt="${playlist.name}">
                            <div class="my-playlist-card-overlay">
                                <button class="my-playlist-card-btn play-btn" data-action="play" title="播放">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                        <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="my-playlist-card-info">
                            <div class="my-playlist-card-name">${playlist.name}</div>
                            <div class="my-playlist-card-count">${playlist.trackCount} 首</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    html += '</div>';
    trackList.innerHTML = html;

    // 绑定事件
    trackList.querySelectorAll('.my-playlist-card').forEach(card => {
        // 点击卡片加载歌单
        card.addEventListener('click', (e) => {
            if (e.target.closest('.my-playlist-card-btn')) return;
            const playlistId = card.dataset.playlistId;
            if (playlistId) {
                navigateTo('playlist', { id: parseInt(playlistId) });
                loadPlaylist(parseInt(playlistId));
            }
        });

        // 播放按钮
        card.querySelector('.play-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const playlistId = card.dataset.playlistId;
            if (playlistId) {
                loadPlaylistAndPlay(parseInt(playlistId));
            }
        });

        // 删除按钮
        card.querySelector('.delete-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const playlistId = card.dataset.playlistId;
            const playlistName = e.currentTarget.dataset.name;
            if (playlistId && typeof deletePlaylist === 'function') {
                deletePlaylist(parseInt(playlistId), playlistName);
            }
        });
    });
}

// 加载歌单并播放
async function loadPlaylistAndPlay(id) {
    navigateTo('playlist', { id });
    await loadPlaylist(id);
    if (player.playlist.length > 0) {
        player.playTrack(0);
    }
}

// 私人FM
async function loadPersonalFM() {
    showLoading(true);
    
    try {
        const res = await api.getPersonalFM();
        
        if (res && res.data) {
            const tracks = res.data.map(song => api.formatTrack(song));
            player.setPlaylist(tracks);
            
            updatePlaylistHeader({
                name: '私人FM',
                description: '根据你的喜好智能推荐',
                coverUrl: tracks[0]?.cover || '',
                trackCount: tracks.length
            });
            
            // 自动播放
            if (tracks.length > 0) {
                player.playTrack(0);
            }
        } else {
            player.showToast('请先登录以使用私人FM');
        }
    } catch (error) {
        console.error('Failed to load personal FM:', error);
        player.showToast('加载私人FM失败');
    }
    
    showLoading(false);
}

// 我喜欢的音乐
async function loadLikedSongs() {
    const userInfo = localStorage.getItem('user_info');
    if (!userInfo) {
        player.showToast('请先登录');
        return;
    }
    
    showLoading(true);
    try {
        const user = JSON.parse(userInfo);
        const likeRes = await api.getLikeList(user.userId);
        
        if (likeRes && likeRes.ids && likeRes.ids.length > 0) {
            // 获取前100首歌曲详情
            const ids = likeRes.ids.slice(0, 100);
            const detailRes = await api.getSongDetail(ids.join(','));
            
            if (detailRes && detailRes.songs) {
                const tracks = detailRes.songs.map(song => api.formatTrack(song));
                player.setPlaylist(tracks);
                
                updatePlaylistHeader({
                    name: '我喜欢的音乐',
                    description: `共 ${likeRes.ids.length} 首`,
                    coverUrl: tracks[0]?.cover || '',
                    trackCount: likeRes.ids.length
                });
            }
        } else {
            player.setPlaylist([]);
            updatePlaylistHeader({
                name: '我喜欢的音乐',
                description: '还没有喜欢的歌曲',
                coverUrl: '',
                trackCount: 0
            });
        }
    } catch (error) {
        console.error('Failed to load liked songs:', error);
        player.showToast('加载失败');
    }
    showLoading(false);
}

// 当前评论的歌曲ID（用于加载楼层回复）
let currentCommentTrackId = null;

// 显示评论弹窗
async function showComments(trackId, trackName) {
    currentCommentTrackId = trackId;
    
    let modal = document.getElementById('commentsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'commentsModal';
        modal.className = 'comments-modal';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="comments-modal-overlay"></div>
        <div class="comments-modal-content">
            <div class="comments-header">
                <h3>评论 - ${trackName}</h3>
                <button class="comments-close">
                    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div class="comment-input-area" data-track-id="${trackId}">
                <div class="comment-input-wrap">
                    <textarea class="comment-input" placeholder="说点什么吧..." maxlength="140"></textarea>
                    <button class="comment-send-btn" disabled>发送</button>
                </div>
                <div class="comment-input-hint">
                    <span class="char-count">0/140</span>
                    <span class="reply-hint" style="display:none;">回复 <span class="reply-to-user"></span> <button class="cancel-reply">取消</button></span>
                </div>
            </div>
            <div class="comments-body">
                <div class="comments-loading">加载中...</div>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
    
    // 关闭事件
    modal.querySelector('.comments-close').onclick = () => modal.classList.remove('active');
    modal.querySelector('.comments-modal-overlay').onclick = () => modal.classList.remove('active');
    
    // 评论输入框事件
    setupCommentInput(modal, trackId);
    
    // 加载评论
    try {
        const [hotRes, newRes] = await Promise.all([
            api.getHotComments(trackId, 30),     // 热门评论30条
            api.getComments(trackId, 50, 0, 3)   // 最新评论50条
        ]);
        
        const body = modal.querySelector('.comments-body');
        let html = '';
        
        // 热门评论（新版接口返回 data.comments）
        const hotComments = hotRes?.data?.comments || [];
        if (hotComments.length > 0) {
            html += '<div class="comments-section"><h4>热门评论</h4>';
            html += hotComments.map(c => renderComment(c, trackId)).join('');
            html += '</div>';
        }
        
        // 最新评论
        const newComments = newRes?.data?.comments || [];
        if (newComments.length > 0) {
            // 过滤掉已在热门中显示的评论
            const hotIds = new Set(hotComments.map(c => c.commentId));
            const filteredNew = newComments.filter(c => !hotIds.has(c.commentId));
            if (filteredNew.length > 0) {
                html += '<div class="comments-section"><h4>最新评论</h4>';
                html += filteredNew.map(c => renderComment(c, trackId)).join('');
                html += '</div>';
            }
        }
        
        body.innerHTML = html || '<div class="no-comments">暂无评论</div>';
        
        // 绑定展开回复事件
        bindReplyEvents(body);
        
    } catch (error) {
        console.error('Failed to load comments:', error);
        modal.querySelector('.comments-body').innerHTML = '<div class="comments-error">加载失败</div>';
    }
}

function renderComment(comment, trackId) {
    const time = new Date(comment.time).toLocaleDateString('zh-CN');
    // 兼容新旧API：新版用replyCount，旧版用showFloorComment.replyCount
    const replyCount = comment.replyCount || comment.showFloorComment?.replyCount || 0;
    
    // 渲染被回复的评论（如果有）
    let beRepliedHtml = '';
    if (comment.beReplied && comment.beReplied.length > 0) {
        const replied = comment.beReplied[0];
        if (replied.content) {
            beRepliedHtml = `
                <div class="comment-replied">
                    <span class="replied-user">@${replied.user?.nickname || '用户'}：</span>
                    <span class="replied-text">${replied.content}</span>
                </div>
            `;
        }
    }
    
    // 回复按钮（只在有回复时显示）
    const replyBtnHtml = replyCount > 0 ? `
        <span class="comment-reply-btn" data-comment-id="${comment.commentId}" data-track-id="${trackId}">
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            ${replyCount}条回复
        </span>
    ` : '';
    
    const isLiked = comment.liked ? 'liked' : '';
    
    return `
        <div class="comment-item" data-comment-id="${comment.commentId}" data-user-name="${comment.user.nickname}">
            <img class="comment-avatar" src="${comment.user.avatarUrl}?param=80y80" alt="">
            <div class="comment-content">
                <div class="comment-header">
                    <span class="comment-user">${comment.user.nickname}</span>
                    <span class="comment-time">${time}</span>
                </div>
                <div class="comment-text">${comment.content}</div>
                ${beRepliedHtml}
                <div class="comment-actions">
                    <span class="comment-like-btn ${isLiked}" data-comment-id="${comment.commentId}" data-liked="${comment.liked ? 'true' : 'false'}" data-count="${comment.likedCount || 0}">
                        <svg viewBox="0 0 24 24" fill="${comment.liked ? 'currentColor' : 'none'}" width="14" height="14">
                            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="like-count">${comment.likedCount || 0}</span>
                    </span>
                    <span class="comment-reply-to-btn" data-comment-id="${comment.commentId}" data-user-name="${comment.user.nickname}">
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                            <path d="M3 10h10a5 5 0 015 5v6M3 10l6 6M3 10l6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        回复
                    </span>
                    ${replyBtnHtml}
                </div>
                <div class="comment-replies-container" data-comment-id="${comment.commentId}"></div>
            </div>
        </div>
    `;
}

// 渲染楼层回复
function renderReplyComment(reply) {
    const time = new Date(reply.time).toLocaleDateString('zh-CN');
    
    // 被回复信息
    let beRepliedHtml = '';
    if (reply.beRepliedUser && reply.beRepliedUser.nickname) {
        beRepliedHtml = `<span class="reply-to">回复 @${reply.beRepliedUser.nickname}</span>`;
    }
    
    return `
        <div class="reply-item">
            <img class="reply-avatar" src="${reply.user.avatarUrl}?param=60y60" alt="">
            <div class="reply-content">
                <div class="reply-header">
                    <span class="reply-user">${reply.user.nickname}</span>
                    ${beRepliedHtml}
                    <span class="reply-time">${time}</span>
                </div>
                <div class="reply-text">${reply.content}</div>
                <div class="reply-actions">
                    <span class="reply-likes">
                        <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
                            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        ${reply.likedCount || 0}
                    </span>
                </div>
            </div>
        </div>
    `;
}

// 绑定加载更多回复
function bindLoadMoreReplies(container) {
    container.querySelectorAll('.replies-more').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const commentId = btn.dataset.commentId;
            const trackId = btn.dataset.trackId;
            const time = btn.dataset.time;
            
            btn.textContent = '加载中...';
            btn.style.pointerEvents = 'none';
            
            try {
                const res = await api.getFloorComments(commentId, trackId, 20, time);
                
                if (res && res.data && res.data.comments && res.data.comments.length > 0) {
                    const replies = res.data.comments;
                    const totalCount = res.data.totalCount || 0;
                    const repliesList = container.querySelector('.replies-list');
                    
                    // 移除旧的"加载更多"按钮
                    btn.remove();
                    
                    // 添加新回复
                    const newRepliesHtml = replies.map(r => renderReplyComment(r)).join('');
                    repliesList.insertAdjacentHTML('beforeend', newRepliesHtml);
                    
                    // 计算已加载数量
                    const loadedCount = repliesList.querySelectorAll('.reply-item').length;
                    
                    // 如果还有更多
                    if (loadedCount < totalCount) {
                        const moreBtn = document.createElement('div');
                        moreBtn.className = 'replies-more';
                        moreBtn.dataset.commentId = commentId;
                        moreBtn.dataset.trackId = trackId;
                        moreBtn.dataset.time = replies[replies.length - 1].time;
                        moreBtn.textContent = `查看更多回复 (${totalCount - loadedCount}条)`;
                        repliesList.appendChild(moreBtn);
                        bindLoadMoreReplies(container);
                    }
                }
            } catch (error) {
                console.error('Failed to load more replies:', error);
                btn.textContent = '加载失败，点击重试';
                btn.style.pointerEvents = 'auto';
            }
        });
    });
}

// 设置评论输入框事件
function setupCommentInput(modal, trackId) {
    const inputArea = modal.querySelector('.comment-input-area');
    const textarea = modal.querySelector('.comment-input');
    const sendBtn = modal.querySelector('.comment-send-btn');
    const charCount = modal.querySelector('.char-count');
    const replyHint = modal.querySelector('.reply-hint');
    const replyToUser = modal.querySelector('.reply-to-user');
    const cancelReplyBtn = modal.querySelector('.cancel-reply');
    
    let replyToCommentId = null;
    
    // 字数统计
    textarea.addEventListener('input', () => {
        const len = textarea.value.length;
        charCount.textContent = `${len}/140`;
        sendBtn.disabled = len === 0;
    });
    
    // 取消回复
    cancelReplyBtn.addEventListener('click', () => {
        replyToCommentId = null;
        replyHint.style.display = 'none';
        textarea.placeholder = '说点什么吧...';
    });
    
    // 发送评论
    sendBtn.addEventListener('click', async () => {
        const content = textarea.value.trim();
        if (!content) return;
        
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) {
            player.showToast('请先登录');
            return;
        }
        
        sendBtn.disabled = true;
        sendBtn.textContent = '发送中...';
        
        try {
            const res = await api.sendComment(trackId, content, replyToCommentId);
            if (res && res.code === 200) {
                player.showToast(replyToCommentId ? '回复成功' : '评论成功');
                textarea.value = '';
                charCount.textContent = '0/140';
                replyToCommentId = null;
                replyHint.style.display = 'none';
                textarea.placeholder = '说点什么吧...';
                
                // 刷新评论列表
                const trackName = modal.querySelector('.comments-header h3').textContent.replace('评论 - ', '');
                modal.classList.remove('active');
                setTimeout(() => showComments(trackId, trackName), 300);
            } else {
                player.showToast(res?.message || '发送失败');
            }
        } catch (error) {
            console.error('Failed to send comment:', error);
            player.showToast('发送失败，请重试');
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = '发送';
        }
    });
    
    // 存储设置回复目标的方法
    inputArea.setReplyTarget = (commentId, userName) => {
        replyToCommentId = commentId;
        replyToUser.textContent = `@${userName}`;
        replyHint.style.display = 'inline';
        textarea.placeholder = `回复 @${userName}...`;
        textarea.focus();
    };
}

// 绑定评论点赞和回复事件
function bindReplyEvents(container) {
    const modal = document.getElementById('commentsModal');
    const inputArea = modal?.querySelector('.comment-input-area');
    const trackId = inputArea?.dataset.trackId;
    
    // 点赞事件
    container.querySelectorAll('.comment-like-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            const cookie = localStorage.getItem('music_cookie');
            if (!cookie) {
                player.showToast('请先登录');
                return;
            }
            
            const commentId = btn.dataset.commentId;
            const isLiked = btn.dataset.liked === 'true';
            let count = parseInt(btn.dataset.count) || 0;
            
            btn.style.pointerEvents = 'none';
            
            try {
                const res = await api.likeComment(trackId, commentId, !isLiked);
                if (res && res.code === 200) {
                    const newLiked = !isLiked;
                    count = newLiked ? count + 1 : count - 1;
                    
                    btn.dataset.liked = newLiked.toString();
                    btn.dataset.count = count.toString();
                    btn.classList.toggle('liked', newLiked);
                    btn.querySelector('.like-count').textContent = count;
                    btn.querySelector('svg').setAttribute('fill', newLiked ? 'currentColor' : 'none');
                } else {
                    player.showToast('操作失败');
                }
            } catch (error) {
                console.error('Failed to like comment:', error);
                player.showToast('操作失败');
            } finally {
                btn.style.pointerEvents = 'auto';
            }
        });
    });
    
    // 回复按钮事件
    container.querySelectorAll('.comment-reply-to-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const cookie = localStorage.getItem('music_cookie');
            if (!cookie) {
                player.showToast('请先登录');
                return;
            }
            
            const commentId = btn.dataset.commentId;
            const userName = btn.dataset.userName;
            
            if (inputArea && inputArea.setReplyTarget) {
                inputArea.setReplyTarget(commentId, userName);
            }
        });
    });
    
    // 展开楼层回复事件
    container.querySelectorAll('.comment-reply-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const commentId = btn.dataset.commentId;
            const btnTrackId = btn.dataset.trackId;
            const repliesContainer = container.querySelector(`.comment-replies-container[data-comment-id="${commentId}"]`);
            
            if (!repliesContainer) return;
            
            // 切换展开/收起
            if (repliesContainer.classList.contains('expanded')) {
                repliesContainer.classList.remove('expanded');
                repliesContainer.innerHTML = '';
                btn.classList.remove('active');
                return;
            }
            
            // 加载回复
            btn.classList.add('loading');
            try {
                const res = await api.getFloorComments(commentId, btnTrackId, 20);
                
                if (res && res.data && res.data.comments && res.data.comments.length > 0) {
                    const replies = res.data.comments;
                    const totalCount = res.data.totalCount || replies.length;
                    
                    let html = '<div class="replies-list">';
                    html += replies.map(r => renderReplyComment(r)).join('');
                    
                    if (replies.length < totalCount) {
                        html += `<div class="replies-more" data-comment-id="${commentId}" data-track-id="${btnTrackId}" data-time="${replies[replies.length - 1].time}">
                            查看更多回复 (${totalCount - replies.length}条)
                        </div>`;
                    }
                    html += '</div>';
                    
                    repliesContainer.innerHTML = html;
                    repliesContainer.classList.add('expanded');
                    btn.classList.add('active');
                    
                    bindLoadMoreReplies(repliesContainer);
                } else {
                    repliesContainer.innerHTML = '<div class="replies-empty">暂无回复</div>';
                    repliesContainer.classList.add('expanded');
                }
            } catch (error) {
                console.error('Failed to load replies:', error);
                repliesContainer.innerHTML = '<div class="replies-error">加载失败</div>';
            } finally {
                btn.classList.remove('loading');
            }
        });
    });
}

// 显示歌手页面
async function showArtist(artistId, artistName) {
    if (!artistId) {
        player.showToast('无效的歌手信息');
        return;
    }
    
    showLoading(true);
    
    try {
        // 并行获取歌手详情和专辑
        const [detailRes, albumsRes, songsRes] = await Promise.all([
            api.getArtistDetail(artistId),
            api.getArtistAlbums(artistId, 50),
            api.getArtistSongs(artistId, 50)
        ]);
        
        const artist = detailRes?.data?.artist || { name: artistName, id: artistId };
        const albums = albumsRes?.hotAlbums || [];
        const songs = songsRes?.songs || [];
        
        // 获取歌曲ID列表，批量获取详情以获得封面
        let tracks = songs.map(song => api.formatTrack(song));
        
        // 如果歌曲没有封面，尝试获取详情
        if (songs.length > 0) {
            const songIds = songs.slice(0, 50).map(s => s.id).join(',');
            try {
                const detailSongsRes = await api.getSongDetail(songIds);
                if (detailSongsRes?.songs) {
                    tracks = detailSongsRes.songs.map(song => api.formatTrack(song));
                }
            } catch (e) {
                console.log('Failed to get song details, using original data');
            }
        }
        
        // 显示歌手页面
        showArtistPage(artist, albums, tracks);
        
    } catch (error) {
        console.error('Failed to load artist:', error);
        player.showToast('加载歌手信息失败');
    }
    
    showLoading(false);
}

// 渲染歌手页面
function showArtistPage(artist, albums, tracks) {
    // 更新头部信息
    document.querySelector('.playlist-type').textContent = '歌手';
    document.querySelector('.playlist-title').textContent = artist.name;
    
    const meta = document.querySelector('.playlist-meta');
    const albumCount = albums.length;
    const songCount = artist.musicSize || tracks.length;
    meta.innerHTML = `
        <span class="creator">${artist.alias?.join(' / ') || ''}</span>
        <span class="dot">·</span>
        <span class="song-count">${songCount} 首歌曲</span>
        <span class="dot">·</span>
        <span class="duration">${albumCount} 张专辑</span>
    `;
    
    // 更新封面
    const coverImg = document.querySelector('.playlist-cover img');
    if (artist.cover || artist.picUrl) {
        coverImg.src = (artist.cover || artist.picUrl) + '?param=400y400';
    }
    
    // 设置渐变背景
    const gradient = getRandomGradient();
    document.querySelector('.header-gradient').style.background = gradient;
    
    // 渲染专辑网格和歌曲列表
    renderArtistContent(artist, albums, tracks);
}

// 渲染歌手内容区域（专辑 + 热门歌曲）
function renderArtistContent(artist, albums, tracks) {
    const trackList = document.getElementById('trackList');
    if (!trackList) return;
    
    // 先设置歌曲到播放器
    player.playlist = tracks;
    
    let html = '';
    
    // 专辑部分
    if (albums.length > 0) {
        html += `
            <div class="artist-albums-section">
                <h3 class="section-title">专辑作品</h3>
                <div class="artist-albums-grid">
                    ${albums.slice(0, 12).map(album => {
                        const albumCover = album.picUrl || album.blurPicUrl || '';
                        const publishYear = album.publishTime ? new Date(album.publishTime).getFullYear() : '';
                        return `
                        <div class="artist-album-card" data-album-id="${album.id}">
                            <div class="album-card-cover">
                                <img src="${albumCover}?param=200y200" alt="${album.name}" onerror="this.src='https://via.placeholder.com/200?text=Album'">
                                <button class="album-play-btn">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                        <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="album-card-info">
                                <div class="album-card-name">${album.name}</div>
                                <div class="album-card-date">${publishYear}</div>
                            </div>
                        </div>
                    `}).join('')}
                </div>
                ${albums.length > 12 ? `<div class="show-more-albums" data-artist-id="${artist.id}">查看全部 ${albums.length} 张专辑</div>` : ''}
            </div>
        `;
    }
    
    // 热门歌曲部分
    if (tracks.length > 0) {
        html += `
            <div class="artist-songs-section">
                <h3 class="section-title">热门歌曲</h3>
                <div class="artist-tracks-list">
                    ${tracks.map((track, index) => {
                        const artistsHtml = (track.artists && track.artists.length > 0) 
                            ? track.artists.map(a => 
                                `<span class="artist-link" data-artist-id="${a.id}" data-artist-name="${a.name}">${a.name}</span>`
                            ).join(' / ')
                            : `<span>${track.artist}</span>`;
                        
                        const isPlaying = player.currentIndex === index && player.isPlaying;
                        const coverUrl = track.cover ? track.cover + '?param=80y80' : '';
                        return `
                        <div class="track-item ${isPlaying ? 'playing' : ''}" data-index="${index}" data-id="${track.id}" data-mvid="${track.mvid || ''}">
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
                                    <img src="${coverUrl}" alt="" onerror="this.style.display='none'">
                                </div>
                                <div class="track-details">
                                    <div class="track-title">${track.title}</div>
                                    <div class="track-artist">${artistsHtml}</div>
                                </div>
                            </div>
                            <div class="track-album">${track.album}</div>
                            <div class="track-actions">
                                <button class="track-action-btn like-btn ${player.likedSongs.has(track.id) ? 'liked' : ''}" data-action="like" title="喜欢">
                                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="1.5"/>
                                    </svg>
                                </button>
                                <button class="track-action-btn comment-btn" data-action="comment" title="评论">
                                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                                        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" stroke-width="1.5"/>
                                    </svg>
                                </button>
                                ${track.mvid ? `<button class="track-action-btn mv-btn" data-action="mv" title="播放MV">
                                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                                        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/>
                                        <path d="M10 9l5 3-5 3V9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                                    </svg>
                                </button>` : ''}
                            </div>
                            <div class="track-duration">${track.duration}</div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    }
    
    trackList.innerHTML = html;
    
    // 绑定事件
    bindArtistPageEvents(trackList, tracks);
}

// 绑定歌手页面事件
function bindArtistPageEvents(container, tracks) {
    // 歌曲点击播放
    container.querySelectorAll('.artist-tracks-list .track-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.track-action-btn') || e.target.closest('.artist-link')) return;
            const index = parseInt(item.dataset.index);
            
            // 更新播放状态UI
            container.querySelectorAll('.artist-tracks-list .track-item').forEach(el => {
                el.classList.remove('playing');
            });
            item.classList.add('playing');
            
            player.playTrack(index);
        });
    });
    
    // 歌手链接点击
    container.querySelectorAll('.artist-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
            const artistId = link.dataset.artistId;
            const artistName = link.dataset.artistName;
            if (artistId) {
                showArtist(parseInt(artistId), artistName);
            }
        });
    });
    
    // 喜欢按钮
    container.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const item = btn.closest('.track-item');
            const trackId = parseInt(item.dataset.id);
            const track = tracks[parseInt(item.dataset.index)];
            await player.toggleLike(trackId, track.title);
            btn.classList.toggle('liked', player.likedSongs.has(trackId));
        });
    });
    
    // 评论按钮
    container.querySelectorAll('.comment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = btn.closest('.track-item');
            const trackId = parseInt(item.dataset.id);
            const track = tracks[parseInt(item.dataset.index)];
            if (typeof showComments === 'function') {
                showComments(trackId, track.title);
            }
        });
    });
    
    // MV按钮
    container.querySelectorAll('.mv-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = btn.closest('.track-item');
            const mvid = item.dataset.mvid;
            if (mvid && typeof playMV === 'function') {
                playMV(parseInt(mvid));
            }
        });
    });
    
    // 专辑卡片点击
    container.querySelectorAll('.artist-album-card').forEach(card => {
        card.addEventListener('click', () => {
            const albumId = card.dataset.albumId;
            if (albumId) {
                loadAlbum(parseInt(albumId));
            }
        });
    });
    
    // 查看更多专辑
    const showMoreBtn = container.querySelector('.show-more-albums');
    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', () => {
            const artistId = showMoreBtn.dataset.artistId;
            if (artistId) {
                showAllAlbums(parseInt(artistId));
            }
        });
    }
}

// 加载专辑
async function loadAlbum(albumId) {
    showLoading(true);
    try {
        const res = await api.getAlbum(albumId);
        if (res && res.songs) {
            let tracks = res.songs.map(song => api.formatTrack(song));
            
            // 获取歌曲详情以获得完整封面
            if (res.songs.length > 0) {
                const songIds = res.songs.map(s => s.id).join(',');
                try {
                    const detailRes = await api.getSongDetail(songIds);
                    if (detailRes?.songs) {
                        tracks = detailRes.songs.map(song => api.formatTrack(song));
                    }
                } catch (e) {
                    console.log('Failed to get song details for album');
                }
            }
            
            player.setPlaylist(tracks);
            
            const album = res.album;
            updatePlaylistHeader({
                name: album.name,
                description: album.description || `${album.artist?.name || ''} · ${new Date(album.publishTime).getFullYear()}`,
                coverUrl: album.picUrl,
                trackCount: tracks.length
            });
            
            document.querySelector('.playlist-type').textContent = '专辑';
        }
    } catch (error) {
        console.error('Failed to load album:', error);
        player.showToast('加载专辑失败');
    }
    showLoading(false);
}

// 显示所有专辑
async function showAllAlbums(artistId) {
    showLoading(true);
    try {
        const res = await api.getArtistAlbums(artistId, 100);
        const albums = res?.hotAlbums || [];
        
        if (albums.length > 0) {
            const trackList = document.getElementById('trackList');
            trackList.innerHTML = `
                <div class="artist-albums-section full">
                    <h3 class="section-title">全部专辑</h3>
                    <div class="artist-albums-grid">
                        ${albums.map(album => {
                            const albumCover = album.picUrl || album.blurPicUrl || '';
                            const publishYear = album.publishTime ? new Date(album.publishTime).getFullYear() : '';
                            return `
                            <div class="artist-album-card" data-album-id="${album.id}">
                                <div class="album-card-cover">
                                    <img src="${albumCover}?param=200y200" alt="${album.name}" onerror="this.src='https://via.placeholder.com/200?text=Album'">
                                    <button class="album-play-btn">
                                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                            <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"/>
                                        </svg>
                                    </button>
                                </div>
                                <div class="album-card-info">
                                    <div class="album-card-name">${album.name}</div>
                                    <div class="album-card-date">${publishYear}</div>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;
            
            // 绑定专辑点击事件
            trackList.querySelectorAll('.artist-album-card').forEach(card => {
                card.addEventListener('click', () => {
                    const albumId = card.dataset.albumId;
                    if (albumId) {
                        loadAlbum(parseInt(albumId));
                    }
                });
            });
        }
    } catch (error) {
        console.error('Failed to load all albums:', error);
        player.showToast('加载专辑列表失败');
    }
    showLoading(false);
}

// 歌手发现页面
async function loadArtistsPage(offset = 0) {
    showLoading(true);
    
    // 更新头部
    document.querySelector('.playlist-type').textContent = '发现';
    document.querySelector('.playlist-title').textContent = '热门歌手';
    document.querySelector('.playlist-meta').innerHTML = `
        <span class="creator">发现你喜欢的歌手</span>
    `;
    
    const gradient = getRandomGradient();
    document.querySelector('.header-gradient').style.background = gradient;
    
    try {
        // 获取热门歌手列表，使用offset实现刷新不同歌手
        const res = await api.request('/top/artists', { limit: 50, offset });
        const artists = res?.artists || [];
        
        if (artists.length > 0) {
            // 使用第一个歌手的封面作为头部封面
            const coverImg = document.querySelector('.playlist-cover img');
            if (artists[0].picUrl) {
                coverImg.src = artists[0].picUrl + '?param=400y400';
            }
            
            renderArtistsGrid(artists, offset);
        } else {
            document.getElementById('trackList').innerHTML = '<div class="no-content">暂无歌手数据</div>';
        }
    } catch (error) {
        console.error('Failed to load artists:', error);
        player.showToast('加载歌手列表失败');
    }
    
    showLoading(false);
}

// 搜索歌手
async function searchArtists(keywords) {
    if (!keywords.trim()) return;
    
    showLoading(true);
    
    try {
        const res = await api.searchArtists(keywords, 50);
        const artists = res?.result?.artists || [];
        
        if (artists.length > 0) {
            document.querySelector('.playlist-title').textContent = `搜索: ${keywords}`;
            renderArtistsGrid(artists, -1); // -1表示搜索结果，不显示刷新按钮
        } else {
            document.getElementById('trackList').innerHTML = '<div class="no-content">未找到相关歌手</div>';
        }
    } catch (error) {
        console.error('Failed to search artists:', error);
        player.showToast('搜索失败');
    }
    
    showLoading(false);
}

// 渲染歌手网格
// 当前歌手页面偏移量
let currentArtistsOffset = 0;

function renderArtistsGrid(artists, offset = 0) {
    const trackList = document.getElementById('trackList');
    const isSearchResult = offset === -1;
    
    trackList.innerHTML = `
        <div class="artists-discover-section">
            <div class="artists-toolbar">
                <div class="artists-search-box">
                    <svg class="search-icon" viewBox="0 0 24 24" fill="none" width="18" height="18">
                        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M16 16l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <input type="text" class="artists-search-input" placeholder="搜索歌手...">
                </div>
                <div class="artists-actions">
                    ${!isSearchResult ? `
                    <button class="artists-refresh-btn" title="换一批">
                        <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                            <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>换一批</span>
                    </button>
                    ` : `
                    <button class="artists-back-btn" title="返回热门">
                        <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>返回热门</span>
                    </button>
                    `}
                </div>
            </div>
            <div class="artists-grid">
                ${artists.map(artist => `
                    <div class="artist-card" data-artist-id="${artist.id}" data-artist-name="${artist.name}">
                        <div class="artist-card-avatar">
                            <img data-src="${artist.picUrl || artist.img1v1Url}?param=200y200" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect fill='%23222' width='200' height='200'/%3E%3C/svg%3E" alt="${artist.name}" class="lazy-img">
                            <div class="artist-card-overlay">
                                <button class="artist-play-btn">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                        <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="artist-card-info">
                            <div class="artist-card-name">${artist.name}</div>
                            <div class="artist-card-alias">${artist.alias?.[0] || ''}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // 绑定搜索事件
    const searchInput = trackList.querySelector('.artists-search-input');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        if (e.target.value.trim()) {
            searchTimeout = setTimeout(() => {
                searchArtists(e.target.value);
            }, 500);
        }
    });
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            clearTimeout(searchTimeout);
            searchArtists(e.target.value);
        }
    });
    
    // 绑定刷新按钮
    const refreshBtn = trackList.querySelector('.artists-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            currentArtistsOffset += 50;
            if (currentArtistsOffset > 200) currentArtistsOffset = 0; // 循环
            loadArtistsPage(currentArtistsOffset);
        });
    }
    
    // 绑定返回按钮
    const backBtn = trackList.querySelector('.artists-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            currentArtistsOffset = 0;
            loadArtistsPage(0);
        });
    }
    
    // 绑定歌手卡片点击事件
    trackList.querySelectorAll('.artist-card').forEach(card => {
        card.addEventListener('click', () => {
            const artistId = card.dataset.artistId;
            const artistName = card.dataset.artistName;
            if (artistId) {
                showArtist(parseInt(artistId), artistName);
            }
        });
    });
    
    // 图片懒加载
    if (window.lazyLoader) {
        window.lazyLoader.observeAll(trackList);
    }
}

// 播放MV
async function playMV(mvid) {
    if (!mvid) {
        player.showToast('该歌曲没有MV');
        return;
    }
    
    try {
        const [detailRes, urlRes] = await Promise.all([
            api.getMvDetail(mvid),
            api.getMvUrl(mvid, 1080)
        ]);
        
        if (!urlRes || !urlRes.data || !urlRes.data.url) {
            player.showToast('MV暂不可用');
            return;
        }
        
        let modal = document.getElementById('mvModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mvModal';
            modal.className = 'mv-modal';
            document.body.appendChild(modal);
        }
        
        const mvData = detailRes.data;
        modal.innerHTML = `
            <div class="mv-modal-overlay"></div>
            <div class="mv-modal-content">
                <div class="mv-header">
                    <h3>${mvData.name} - ${mvData.artistName}</h3>
                    <button class="mv-close">
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div class="mv-video-container">
                    <video class="mv-video" controls autoplay>
                        <source src="${urlRes.data.url}" type="video/mp4">
                    </video>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
        player.pause();
        
        const video = modal.querySelector('video');
        modal.querySelector('.mv-close').onclick = () => {
            video.pause();
            modal.classList.remove('active');
        };
        modal.querySelector('.mv-modal-overlay').onclick = () => {
            video.pause();
            modal.classList.remove('active');
        };
        
    } catch (error) {
        console.error('Failed to play MV:', error);
        player.showToast('MV加载失败');
    }
}

function setupEventListeners() {
    document.getElementById('playBtn').addEventListener('click', () => player.toggle());
    document.getElementById('fullscreenPlayBtn').addEventListener('click', () => player.toggle());

    document.querySelectorAll('.prev-btn').forEach(btn => {
        btn.addEventListener('click', () => player.prev());
    });

    document.querySelectorAll('.next-btn').forEach(btn => {
        btn.addEventListener('click', () => player.next());
    });

    document.querySelectorAll('.shuffle-btn').forEach(btn => {
        btn.addEventListener('click', () => player.toggleShuffle());
    });

    document.querySelectorAll('.repeat-btn').forEach(btn => {
        btn.addEventListener('click', () => player.toggleRepeat());
    });

    document.getElementById('fullscreenBtn').addEventListener('click', openFullscreen);
    document.getElementById('fullscreenClose').addEventListener('click', closeFullscreen);
    document.getElementById('nowPlayingCover').addEventListener('click', openFullscreen);

    document.getElementById('fullscreenPlayer').addEventListener('click', (e) => {
        if (e.target.id === 'fullscreenPlayer') {
            closeFullscreen();
        }
    });

    // 翻译切换按钮
    const transToggleBtn = document.getElementById('transToggleBtn');
    if (transToggleBtn) {
        transToggleBtn.classList.toggle('active', player.showTrans);
        transToggleBtn.addEventListener('click', () => {
            player.toggleTranslation();
            transToggleBtn.classList.toggle('active', player.showTrans);
        });
    }

    const progressBar = document.querySelector('.progress-bar-container');
    progressBar.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        player.seek(percent);
    });

    const fullscreenProgressBar = document.querySelector('.fullscreen-progress-bar');
    fullscreenProgressBar.addEventListener('click', (e) => {
        const rect = fullscreenProgressBar.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        player.seek(percent);
    });

    const volumeSlider = document.querySelector('.volume-slider');
    volumeSlider.addEventListener('click', (e) => {
        const rect = volumeSlider.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        player.setVolume(percent);
    });

    const fullscreenVolumeBar = document.querySelector('.fullscreen-volume-bar');
    if (fullscreenVolumeBar) {
        fullscreenVolumeBar.addEventListener('click', (e) => {
            const rect = fullscreenVolumeBar.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            player.setVolume(percent);
        });
    }

    const searchInput = document.querySelector('.search-input');
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        if (e.target.value.trim()) {
            searchTimeout = setTimeout(() => {
                handleSearch(e.target.value);
            }, 500);
        }
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            clearTimeout(searchTimeout);
            handleSearch(e.target.value);
        }
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // 返回按钮有单独的处理
            if (this.id === 'backBtn') return;
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            const page = this.dataset.page;
            pageHistory = [];
            
            if (page === 'liked') {
                currentPage = { type: 'liked', data: null };
                await loadLikedSongs();
            } else if (page === 'history') {
                currentPage = { type: 'history', data: null };
                await loadRecentSongs();
            } else if (page === 'discover') {
                currentPage = { type: 'discover', data: null };
                await loadToplist();
            } else if (page === 'fm') {
                currentPage = { type: 'fm', data: null };
                await loadPersonalFM();
            } else if (page === 'artists') {
                currentPage = { type: 'artists', data: null };
                await loadArtistsPage();
            } else if (page === 'playlists') {
                currentPage = { type: 'playlists', data: null };
                await loadMyPlaylists();
            } else if (page === 'toplist') {
                currentPage = { type: 'toplist', data: null };
                await loadToplistPage();
            } else {
                currentPage = { type: 'home', data: null };
                await loadInitialContent();
            }
            updateBackButton();
        });
    });

    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.classList.toggle('active');
            this.classList.add('animating');
            setTimeout(() => this.classList.remove('animating'), 600);
            
            if (this.classList.contains('active')) {
                player.showToast('已添加到我喜欢的音乐');
            }
        });
    });

    // 播放队列面板
    document.querySelector('.queue-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleQueuePanel();
    });
    document.getElementById('queueClose')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleQueuePanel();
    });

    // 歌词按钮 - 打开全屏
    document.querySelector('.lyrics-btn')?.addEventListener('click', openFullscreen);

    // 进度条拖拽
    setupProgressDrag();
    
    // 音量拖拽
    setupVolumeDrag();

    document.querySelector('.cover-play-btn')?.addEventListener('click', () => {
        if (player.playlist.length > 0) {
            player.playTrack(0);
        }
    });

    document.querySelector('.btn-primary')?.addEventListener('click', () => {
        if (player.playlist.length > 0) {
            player.playTrack(0);
        }
    });

    document.querySelector('.btn-secondary')?.addEventListener('click', () => {
        if (player.playlist.length > 0) {
            player.toggleShuffle();
            if (!player.isShuffle) player.toggleShuffle();
            player.playTrack(Math.floor(Math.random() * player.playlist.length));
        }
    });
}

function setupBackgroundEffects() {
    const cursorGlow = document.getElementById('cursorGlow');
    const app = document.getElementById('app');
    
    document.addEventListener('mousemove', (e) => {
        if (cursorGlow) {
            cursorGlow.style.left = e.clientX + 'px';
            cursorGlow.style.top = e.clientY + 'px';
            cursorGlow.classList.add('active');
        }
    });

    document.addEventListener('mouseleave', () => {
        if (cursorGlow) {
            cursorGlow.classList.remove('active');
        }
    });
}

class ColorExtractor {
    static async extractColors(imgSrc) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const size = 100;
                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(img, 0, 0, size, size);
                
                try {
                    const imageData = ctx.getImageData(0, 0, size, size).data;
                    const colors = this.getColorPalette(imageData);
                    resolve(colors);
                } catch (e) {
                    resolve(this.getDefaultColors());
                }
            };
            
            img.onerror = () => resolve(this.getDefaultColors());
            img.src = imgSrc;
        });
    }
    
    static getColorPalette(imageData) {
        const colorMap = new Map();
        
        for (let i = 0; i < imageData.length; i += 16) {
            const r = Math.round(imageData[i] / 32) * 32;
            const g = Math.round(imageData[i + 1] / 32) * 32;
            const b = Math.round(imageData[i + 2] / 32) * 32;
            
            if (r + g + b < 50 || r + g + b > 700) continue;
            
            const key = `${r},${g},${b}`;
            colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }
        
        const sorted = [...colorMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([color]) => color.split(',').map(Number));
        
        if (sorted.length < 2) {
            return this.getDefaultColors();
        }
        
        const primary = this.toNeonColor(sorted[0]);
        const secondary = this.toNeonColor(sorted[Math.min(1, sorted.length - 1)]);
        const tertiary = this.toNeonColor(sorted[Math.min(2, sorted.length - 1)] || sorted[0]);
        
        return {
            primary,
            secondary,
            tertiary,
            accent: this.blendColors(primary, secondary)
        };
    }
    
    static toNeonColor([r, g, b]) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        
        let h, s;
        if (max === min) {
            h = 0;
            s = 0;
        } else {
            const d = max - min;
            s = l > 127 ? d / (510 - max - min) : d / (max + min);
            
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }
        
        const newS = Math.min(1, s * 1.8 + 0.3);
        const newL = Math.max(0.5, Math.min(0.7, l / 255 + 0.2));
        
        return this.hslToRgb(h, newS, newL);
    }
    
    static hslToRgb(h, s, l) {
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }
    
    static blendColors(c1, c2) {
        return [
            Math.round((c1[0] + c2[0]) / 2),
            Math.round((c1[1] + c2[1]) / 2),
            Math.round((c1[2] + c2[2]) / 2)
        ];
    }
    
    static getDefaultColors() {
        return {
            primary: [0, 255, 200],
            secondary: [255, 100, 200],
            tertiary: [100, 200, 255],
            accent: [128, 178, 200]
        };
    }
}

function applyDynamicColors(colors) {
    const root = document.documentElement;
    const { primary, secondary, tertiary, accent } = colors;
    
    const blobPrimary = document.getElementById('blobPrimary');
    const blobSecondary = document.getElementById('blobSecondary');
    const blobTertiary = document.getElementById('blobTertiary');
    
    if (blobPrimary) {
        blobPrimary.style.background = `radial-gradient(circle, 
            rgba(${primary.join(',')}, 0.7) 0%, 
            rgba(${primary.join(',')}, 0.4) 30%,
            rgba(${accent.join(',')}, 0.2) 60%,
            transparent 70%
        )`;
    }
    
    if (blobSecondary) {
        blobSecondary.style.background = `radial-gradient(circle, 
            rgba(${secondary.join(',')}, 0.6) 0%, 
            rgba(${secondary.join(',')}, 0.35) 30%,
            rgba(${tertiary.join(',')}, 0.15) 60%,
            transparent 70%
        )`;
    }
    
    if (blobTertiary) {
        blobTertiary.style.background = `radial-gradient(circle, 
            rgba(${tertiary.join(',')}, 0.5) 0%, 
            rgba(${accent.join(',')}, 0.25) 40%,
            transparent 70%
        )`;
    }
    
    root.style.setProperty('--header-glow-color', `rgba(${primary.join(',')}, 0.2)`);
    root.style.setProperty('--player-glow-color', `rgba(${primary.join(',')}, 0.5)`);
    root.style.setProperty('--cursor-glow-color', `rgba(${accent.join(',')}, 0.25)`);
    root.style.setProperty('--accent-rgb', primary.join(','));
    
    const headerGradient = document.querySelector('.header-gradient');
    if (headerGradient) {
        headerGradient.style.background = 
            `linear-gradient(180deg, rgba(${primary.join(',')}, 0.25) 0%, transparent 100%)`;
    }
}

async function updateAuroraFromCover(coverUrl) {
    if (!coverUrl) return;
    
    try {
        const colors = await ColorExtractor.extractColors(coverUrl);
        applyDynamicColors(colors);
    } catch (e) {
        console.error('Failed to extract colors:', e);
        applyDynamicColors(ColorExtractor.getDefaultColors());
    }
}

// 更新全屏播放器背景颜色
async function updateFullscreenColors(coverUrl) {
    if (!coverUrl) return;
    
    try {
        const colors = await ColorExtractor.extractColors(coverUrl);
        applyFullscreenColors(colors);
    } catch (e) {
        console.error('Failed to extract fullscreen colors:', e);
        applyFullscreenColors(ColorExtractor.getDefaultColors());
    }
}

// 应用颜色到全屏播放器背景光斑 - 与主界面完全一致
function applyFullscreenColors(colors) {
    const { primary, secondary, tertiary, accent } = colors;
    
    const fsBlobPrimary = document.getElementById('fsBlobPrimary');
    const fsBlobSecondary = document.getElementById('fsBlobSecondary');
    const fsBlobTertiary = document.getElementById('fsBlobTertiary');
    
    // 与主界面 applyDynamicColors 完全相同的渐变
    if (fsBlobPrimary) {
        fsBlobPrimary.style.background = `radial-gradient(circle, 
            rgba(${primary.join(',')}, 0.7) 0%, 
            rgba(${primary.join(',')}, 0.4) 30%,
            rgba(${accent.join(',')}, 0.2) 60%,
            transparent 70%
        )`;
    }
    
    if (fsBlobSecondary) {
        fsBlobSecondary.style.background = `radial-gradient(circle, 
            rgba(${secondary.join(',')}, 0.6) 0%, 
            rgba(${secondary.join(',')}, 0.35) 30%,
            rgba(${tertiary.join(',')}, 0.15) 60%,
            transparent 70%
        )`;
    }
    
    if (fsBlobTertiary) {
        fsBlobTertiary.style.background = `radial-gradient(circle, 
            rgba(${tertiary.join(',')}, 0.5) 0%, 
            rgba(${accent.join(',')}, 0.25) 40%,
            transparent 70%
        )`;
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;

        switch(e.code) {
            case 'Space':
                e.preventDefault();
                player.toggle();
                break;
            case 'ArrowRight':
                if (e.ctrlKey) {
                    player.next();
                } else {
                    player.seek((player.audio.currentTime / player.audio.duration * 100) + 5);
                }
                break;
            case 'ArrowLeft':
                if (e.ctrlKey) {
                    player.prev();
                } else {
                    player.seek((player.audio.currentTime / player.audio.duration * 100) - 5);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                player.setVolume(Math.min(100, player.volume * 100 + 5));
                break;
            case 'ArrowDown':
                e.preventDefault();
                player.setVolume(Math.max(0, player.volume * 100 - 5));
                break;
            case 'KeyM':
                player.setVolume(player.volume > 0 ? 0 : 70);
                break;
            case 'KeyF':
                if (!e.ctrlKey) {
                    const fullscreen = document.getElementById('fullscreenPlayer');
                    if (fullscreen.classList.contains('active')) {
                        closeFullscreen();
                    } else {
                        openFullscreen();
                    }
                }
                break;
            case 'Escape':
                closeFullscreen();
                break;
        }
    });
}

function openFullscreen() {
    document.getElementById('fullscreenPlayer').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeFullscreen() {
    document.getElementById('fullscreenPlayer').classList.remove('active');
    document.body.style.overflow = '';
    
    // 取消歌词滚动动画
    if (player && player.lyricScrollAnimation) {
        cancelAnimationFrame(player.lyricScrollAnimation);
        player.lyricScrollAnimation = null;
    }
}

function toggleQueuePanel() {
    const panel = document.getElementById('queuePanel');
    panel.classList.toggle('active');
    
    if (panel.classList.contains('active')) {
        renderQueuePanel();
        setupQueueScrollAnimation();
    }
}

function setupQueueScrollAnimation() {
    const container = document.getElementById('queueContent');
    if (!container) return;
    
    // 移除旧的监听器
    container.onscroll = () => {
        requestAnimationFrame(() => updateQueueItemsOnScroll(container));
    };
    
    // 初始化
    requestAnimationFrame(() => updateQueueItemsOnScroll(container));
}

function updateQueueItemsOnScroll(container) {
    const items = container.querySelectorAll('.queue-item');
    const containerRect = container.getBoundingClientRect();
    const viewTop = containerRect.top;
    const viewBottom = containerRect.bottom;
    const viewHeight = containerRect.height;
    
    items.forEach(item => {
        const rect = item.getBoundingClientRect();
        const itemCenter = rect.top + rect.height / 2;
        
        // 计算距离视口中心的比例 (0=中心, 1=边缘)
        const centerY = viewTop + viewHeight / 2;
        const distanceFromCenter = Math.abs(itemCenter - centerY);
        const maxDistance = viewHeight / 2;
        const ratio = Math.min(distanceFromCenter / maxDistance, 1);
        
        // 简单的缩放和透明度
        const scale = 1 - ratio * 0.08;
        const opacity = 1 - ratio * 0.4;
        
        item.style.transform = `scale(${scale})`;
        item.style.opacity = opacity;
    });
}

function playFromQueue(index) {
    if (typeof index === 'number' && index >= 0 && index < player.playlist.length) {
        player.playTrack(index);
        setTimeout(renderQueuePanel, 300);
    }
}

// 暴露到全局
window.playFromQueue = playFromQueue;

function renderQueuePanel() {
    const container = document.getElementById('queueContent');
    const countEl = document.getElementById('queueCount');
    
    if (!container) return;
    
    if (!player.playlist.length) {
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-tertiary);">播放列表为空</div>';
        if (countEl) countEl.textContent = '0首歌曲';
        return;
    }

    if (countEl) countEl.textContent = `${player.playlist.length}首歌曲`;

    let html = '';
    for (let i = 0; i < player.playlist.length; i++) {
        const track = player.playlist[i];
        const isActive = i === player.currentIndex;
        html += `
        <div class="queue-item ${isActive ? 'active' : ''}" onclick="playFromQueue(${i})" style="animation-delay: ${i * 0.03}s">
            <div class="queue-item-index">${isActive ? '<span class="playing-bars"><span></span><span></span><span></span></span>' : i + 1}</div>
            <div class="queue-item-cover">
                <img src="${track.cover ? track.cover + '?param=80y80' : 'https://via.placeholder.com/80'}" alt="">
            </div>
            <div class="queue-item-info">
                <div class="queue-item-title">${track.title}</div>
                <div class="queue-item-artist">${track.artist}</div>
            </div>
            <div class="queue-item-duration">${track.duration}</div>
        </div>`;
    }
    container.innerHTML = html;



    // 滚动到当前播放
    setTimeout(() => {
        const activeItem = container.querySelector('.queue-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 50);
}

function setupProgressDrag() {
    const progressBar = document.querySelector('.progress-bar-container');
    const fullscreenProgressBar = document.querySelector('.fullscreen-progress-bar');
    
    let isDragging = false;
    let activeBar = null;

    const handleDrag = (e) => {
        if (!activeBar) return;
        const rect = activeBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        player.seek(percent);
    };

    [progressBar, fullscreenProgressBar].forEach(bar => {
        if (!bar) return;
        
        bar.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isDragging = true;
            activeBar = bar;
            handleDrag(e);
        });
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        handleDrag(e);
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        activeBar = null;
    });
}

function setupVolumeDrag() {
    const volumeSlider = document.querySelector('.volume-slider');
    if (!volumeSlider) return;

    let isDraggingVolume = false;

    const handleVolumeDrag = (e) => {
        if (!isDraggingVolume) return;
        const rect = volumeSlider.getBoundingClientRect();
        const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        player.setVolume(percent);
    };

    volumeSlider.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDraggingVolume = true;
        handleVolumeDrag(e);
    });

    document.addEventListener('mousemove', (e) => {
        handleVolumeDrag(e);
    });

    document.addEventListener('mouseup', () => {
        isDraggingVolume = false;
    });

    // 音量按钮静音切换
    document.querySelector('.volume-btn')?.addEventListener('click', () => {
        if (player.volume > 0) {
            player.lastVolume = player.volume;
            player.setVolume(0);
        } else {
            player.setVolume((player.lastVolume || 0.7) * 100);
        }
    });
}

function showLoading(show) {
    let loader = document.querySelector('.loader');
    if (!loader && show) {
        loader = document.createElement('div');
        loader.className = 'loader';
        loader.innerHTML = '<div class="loader-spinner"></div>';
        document.body.appendChild(loader);
    }
    
    if (show) {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.scrollTop = 0;
        
        // 根据页面类型显示/隐藏推荐区域
        showRecommendedSection(currentPage.type === 'home');
    }
    
    if (loader) {
        loader.classList.toggle('active', show);
    }
}

function formatPlayCount(count) {
    if (count >= 100000000) {
        return (count / 100000000).toFixed(1) + '亿';
    } else if (count >= 10000) {
        return (count / 10000).toFixed(1) + '万';
    }
    return count.toString();
}

function getRandomGradient() {
    const colors = [
        'rgba(255, 59, 92, 0.15)',
        'rgba(88, 86, 214, 0.15)',
        'rgba(52, 199, 89, 0.15)',
        'rgba(255, 149, 0, 0.15)',
        'rgba(0, 199, 190, 0.15)',
        'rgba(175, 82, 222, 0.15)'
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];
    return `linear-gradient(180deg, ${color} 0%, transparent 70%)`;
}

// ============================================
// 登录功能
// ============================================

let userInfo = null;
let qrCheckInterval = null;
let currentQRKey = null;

function setupLoginEvents() {
    const userBtn = document.getElementById('userBtn');
    const loginModal = document.getElementById('loginModal');
    const loginClose = document.getElementById('loginClose');
    const loginQR = document.getElementById('loginQR');
    const loginOverlay = document.querySelector('.login-modal-overlay');

    // 点击用户按钮
    userBtn?.addEventListener('click', () => {
        if (userInfo) {
            // 已登录，显示用户菜单
            showUserMenu();
        } else {
            // 未登录，显示登录弹窗
            openLoginModal();
        }
    });

    // 关闭登录弹窗
    loginClose?.addEventListener('click', closeLoginModal);
    loginOverlay?.addEventListener('click', closeLoginModal);

    // 点击过期二维码刷新
    loginQR?.addEventListener('click', () => {
        if (loginQR.classList.contains('expired')) {
            generateQRCode();
        }
    });

    // 检查本地存储的登录状态
    checkStoredLogin();
}

async function openLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.classList.add('active');
    await generateQRCode();
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.classList.remove('active');
    
    // 停止轮询
    if (qrCheckInterval) {
        clearInterval(qrCheckInterval);
        qrCheckInterval = null;
    }
}

async function generateQRCode() {
    const loginQR = document.getElementById('loginQR');
    const loginStatus = document.getElementById('loginStatus');
    
    // 显示加载状态
    loginQR.innerHTML = `
        <div class="qr-loading">
            <div class="qr-spinner"></div>
            <p>正在获取二维码...</p>
        </div>
    `;
    loginQR.classList.remove('expired');
    loginStatus.textContent = '等待扫描';
    loginStatus.className = 'login-status';

    try {
        // 获取key
        const keyRes = await api.getQRKey();
        if (keyRes.code !== 200 || !keyRes.data?.unikey) {
            throw new Error('获取二维码key失败');
        }
        
        currentQRKey = keyRes.data.unikey;
        
        // 生成二维码
        const qrRes = await api.createQR(currentQRKey);
        if (qrRes.code !== 200 || !qrRes.data?.qrimg) {
            throw new Error('生成二维码失败');
        }
        
        // 显示二维码
        loginQR.innerHTML = `<img src="${qrRes.data.qrimg}" alt="登录二维码">`;
        
        // 开始轮询检查扫码状态
        startQRCheck();
        
    } catch (error) {
        console.error('生成二维码失败:', error);
        loginQR.innerHTML = `
            <div class="qr-loading">
                <p style="color: #f87171;">获取二维码失败</p>
                <p style="font-size: 12px;">点击重试</p>
            </div>
        `;
        loginQR.classList.add('expired');
    }
}

function startQRCheck() {
    // 清除之前的轮询
    if (qrCheckInterval) {
        clearInterval(qrCheckInterval);
    }
    
    const loginStatus = document.getElementById('loginStatus');
    const loginQR = document.getElementById('loginQR');
    
    qrCheckInterval = setInterval(async () => {
        if (!currentQRKey) return;
        
        try {
            const res = await api.checkQR(currentQRKey);
            
            switch (res.code) {
                case 800:
                    // 二维码过期
                    loginQR.classList.add('expired');
                    loginStatus.textContent = '二维码已过期，点击刷新';
                    clearInterval(qrCheckInterval);
                    break;
                    
                case 801:
                    // 等待扫描
                    loginStatus.textContent = '等待扫描';
                    loginStatus.className = 'login-status';
                    break;
                    
                case 802:
                    // 已扫描，等待确认
                    loginStatus.textContent = '已扫描，请在手机上确认登录';
                    loginStatus.className = 'login-status waiting';
                    break;
                    
                case 803:
                    // 登录成功
                    clearInterval(qrCheckInterval);
                    loginStatus.textContent = '登录成功！';
                    loginStatus.className = 'login-status success';
                    
                    // 保存cookie
                    if (res.cookie) {
                        localStorage.setItem('music_cookie', res.cookie);
                        await handleLoginSuccess(res.cookie);
                    }
                    break;
            }
        } catch (error) {
            console.error('检查二维码状态失败:', error);
        }
    }, 2000);
}

async function handleLoginSuccess(cookie) {
    try {
        // 获取登录状态
        const statusRes = await api.getLoginStatus(cookie);
        
        if (statusRes.data?.profile) {
            userInfo = statusRes.data.profile;
            localStorage.setItem('user_info', JSON.stringify(userInfo));
            
            updateUserUI();
            
            setTimeout(() => {
                closeLoginModal();
                player.showToast(`欢迎回来，${userInfo.nickname}`);
            }, 1000);
        }
    } catch (error) {
        console.error('获取用户信息失败:', error);
    }
}

function checkStoredLogin() {
    const storedCookie = localStorage.getItem('music_cookie');
    const storedUser = localStorage.getItem('user_info');
    
    if (storedCookie && storedUser) {
        try {
            userInfo = JSON.parse(storedUser);
            updateUserUI();
            
            // 验证登录状态并刷新用户信息
            api.getLoginStatus(storedCookie).then(res => {
                if (res.data?.profile) {
                    // 更新用户信息（头像、昵称等可能在其他平台修改过）
                    userInfo = res.data.profile;
                    localStorage.setItem('user_info', JSON.stringify(userInfo));
                    updateUserUI();
                } else {
                    // 登录已过期
                    handleLogout(true);
                }
            }).catch(() => {
                // 验证失败不处理，保持当前状态
            });
        } catch (e) {
            localStorage.removeItem('user_info');
        }
    }
}

function updateUserUI() {
    const userBtn = document.getElementById('userBtn');
    const userAvatar = document.getElementById('userAvatar');
    const userIconDefault = userBtn?.querySelector('.user-icon-default');
    const logoAvatar = document.getElementById('logoAvatar');
    const logoIconDefault = document.getElementById('logoIconDefault');
    
    if (userInfo) {
        userBtn?.classList.add('logged-in');
        userBtn?.setAttribute('title', userInfo.nickname);
        
        if (userAvatar && userInfo.avatarUrl) {
            userAvatar.src = userInfo.avatarUrl + '?param=80y80';
            userAvatar.style.display = 'block';
        }
        if (userIconDefault) {
            userIconDefault.style.display = 'none';
        }
        
        // 更新logo头像
        if (logoAvatar && userInfo.avatarUrl) {
            logoAvatar.src = userInfo.avatarUrl + '?param=80y80';
            logoAvatar.style.display = 'block';
        }
        if (logoIconDefault) {
            logoIconDefault.style.display = 'none';
        }
    } else {
        userBtn?.classList.remove('logged-in');
        userBtn?.setAttribute('title', '登录');
        
        if (userAvatar) {
            userAvatar.style.display = 'none';
        }
        if (userIconDefault) {
            userIconDefault.style.display = 'block';
        }
        
        // 未登录时显示默认图标
        if (logoAvatar) {
            logoAvatar.style.display = 'none';
        }
        if (logoIconDefault) {
            logoIconDefault.style.display = 'block';
        }
    }
}

function showUserMenu() {
    // 移除已存在的菜单
    document.querySelector('.user-menu')?.remove();
    
    const userBtn = document.getElementById('userBtn');
    const menu = document.createElement('div');
    menu.className = 'user-menu';
    menu.innerHTML = `
        <div class="user-menu-header">
            <img class="user-menu-avatar" src="${userInfo.avatarUrl}?param=80y80" alt="">
            <div class="user-menu-info">
                <div class="user-menu-name">${userInfo.nickname}</div>
            </div>
        </div>
        <div class="user-menu-item" onclick="loadUserPlaylists()">
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.5"/></svg>
            <span>我的歌单</span>
        </div>
        <div class="user-menu-item logout" onclick="handleLogout()">
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>退出登录</span>
        </div>
    `;
    
    userBtn.parentElement.style.position = 'relative';
    userBtn.parentElement.appendChild(menu);
    
    // 显示菜单
    requestAnimationFrame(() => menu.classList.add('active'));
    
    // 点击外部关闭
    const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== userBtn) {
            menu.classList.remove('active');
            setTimeout(() => menu.remove(), 200);
            document.removeEventListener('click', closeMenu);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 100);
}

async function loadUserPlaylists() {
    const cookie = localStorage.getItem('music_cookie');
    if (!userInfo || !cookie) return;
    
    document.querySelector('.user-menu')?.remove();
    
    try {
        showLoading(true);
        const res = await api.getUserPlaylist(userInfo.userId, cookie, 30);
        
        if (res.playlist) {
            // 更新侧边栏歌单列表
            const playlistList = document.querySelector('.playlist-list');
            if (playlistList) {
                playlistList.innerHTML = res.playlist.map(pl => `
                    <a href="#" class="playlist-item" data-id="${pl.id}">
                        <img src="${pl.coverImgUrl}?param=40y40" alt="" style="width:24px;height:24px;border-radius:4px;">
                        <span class="playlist-name">${pl.name}</span>
                    </a>
                `).join('');
                
                // 绑定点击事件
                playlistList.querySelectorAll('.playlist-item').forEach(item => {
                    item.addEventListener('click', async (e) => {
                        e.preventDefault();
                        const id = item.dataset.id;
                        await loadPlaylistById(id);
                    });
                });
            }
            
            player.showToast(`已加载 ${res.playlist.length} 个歌单`);
        }
    } catch (error) {
        console.error('加载歌单失败:', error);
        player.showToast('加载歌单失败');
    } finally {
        showLoading(false);
    }
}

async function loadPlaylistById(id) {
    try {
        showLoading(true);
        const [detailRes, tracksRes] = await Promise.all([
            api.getPlaylistDetail(id),
            api.getPlaylistTracks(id, 100)
        ]);
        
        if (tracksRes.songs) {
            const tracks = tracksRes.songs.map(s => api.formatTrack(s));
            player.setPlaylist(tracks);
            
            if (detailRes.playlist) {
                updatePlaylistHeader({
                    name: detailRes.playlist.name,
                    description: detailRes.playlist.description,
                    coverUrl: detailRes.playlist.coverImgUrl,
                    trackCount: tracks.length
                });
            }
        }
    } catch (error) {
        console.error('加载歌单失败:', error);
        player.showToast('加载歌单失败');
    } finally {
        showLoading(false);
    }
}

function handleLogout(silent = false) {
    const cookie = localStorage.getItem('music_cookie');
    
    // 清除本地存储
    localStorage.removeItem('music_cookie');
    localStorage.removeItem('user_info');
    userInfo = null;
    
    // 更新UI
    updateUserUI();
    
    // 关闭菜单
    document.querySelector('.user-menu')?.remove();
    
    if (!silent) {
        player.showToast('已退出登录');
    }
    
    // 调用API退出
    if (cookie) {
        api.logout(cookie).catch(() => {});
    }
}

// 暴露给全局
window.handleLogout = handleLogout;
window.loadUserPlaylists = loadUserPlaylists;

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupLoginEvents();
});
