// ============================================
// 新功能模块 - 下载、歌单管理、MV播放增强
// ============================================

// ============================================
// 1. 下载功能
// ============================================
const QUALITY_INFO = {
    'jymaster': { name: '臻品母带', badge: 'VIP', vip: true },
    'sky': { name: '沉浸环绕', badge: 'VIP', vip: true },
    'jyeffect': { name: '高清环绕', badge: 'VIP', vip: true },
    'hires': { name: 'Hi-Res', badge: 'VIP', vip: true },
    'lossless': { name: '无损', badge: 'SQ', vip: true },
    'exhigh': { name: '极高', badge: '320k', vip: false },
    'higher': { name: '较高', badge: '192k', vip: false },
    'standard': { name: '标准', badge: '128k', vip: false }
};

// 显示下载弹窗
async function showDownloadModal(track) {
    if (!track) {
        player.showToast('请选择要下载的歌曲');
        return;
    }

    let modal = document.getElementById('downloadModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'downloadModal';
        modal.className = 'download-modal';
        document.body.appendChild(modal);
    }

    const coverUrl = track.cover ? track.cover + '?param=128y128' : '';
    
    modal.innerHTML = `
        <div class="download-modal-overlay"></div>
        <div class="download-modal-content">
            <div class="download-header">
                <h3>下载歌曲</h3>
                <button class="download-close">
                    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div class="download-track-info">
                <div class="download-track-cover">
                    <img src="${coverUrl}" alt="${track.title}">
                </div>
                <div class="download-track-details">
                    <div class="download-track-title">${track.title}</div>
                    <div class="download-track-artist">${track.artist}</div>
                </div>
            </div>
            <div class="download-quality-list" id="downloadQualityList">
                <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                    正在获取可用音质...
                </div>
            </div>
        </div>
    `;

    modal.classList.add('active');
    
    // 关闭事件
    modal.querySelector('.download-close').onclick = () => modal.classList.remove('active');
    modal.querySelector('.download-modal-overlay').onclick = () => modal.classList.remove('active');

    // 获取可用音质
    await loadDownloadQualities(track.id);
}

// 加载可用下载音质
async function loadDownloadQualities(trackId) {
    const container = document.getElementById('downloadQualityList');
    if (!container) return;

    try {
        // 获取歌曲详情来判断可用音质
        const detailRes = await api.getSongDetail(trackId);
        const song = detailRes?.songs?.[0];
        
        const qualities = [];
        
        // 检查各音质可用性
        for (const [level, info] of Object.entries(QUALITY_INFO)) {
            const quality = { level, ...info, available: false, size: '' };
            
            // 根据歌曲信息判断音质可用性
            if (song) {
                switch(level) {
                    case 'hires':
                        quality.available = song.hr !== null;
                        if (song.hr) quality.size = formatFileSize(song.hr.size);
                        break;
                    case 'lossless':
                        quality.available = song.sq !== null;
                        if (song.sq) quality.size = formatFileSize(song.sq.size);
                        break;
                    case 'exhigh':
                        quality.available = song.h !== null;
                        if (song.h) quality.size = formatFileSize(song.h.size);
                        break;
                    case 'higher':
                        quality.available = song.m !== null;
                        if (song.m) quality.size = formatFileSize(song.m.size);
                        break;
                    case 'standard':
                        quality.available = song.l !== null;
                        if (song.l) quality.size = formatFileSize(song.l.size);
                        break;
                    default:
                        // 高级音质需要VIP，暂时标记为不可用
                        quality.available = false;
                }
            }
            
            qualities.push(quality);
        }

        // 渲染音质选项
        container.innerHTML = qualities.map(q => `
            <div class="quality-option ${!q.available ? 'disabled' : ''}" 
                 data-level="${q.level}" 
                 data-track-id="${trackId}">
                <div class="quality-option-left">
                    <span class="quality-badge ${q.vip ? 'vip' : ''}">${q.badge}</span>
                    <span class="quality-name">${q.name}</span>
                </div>
                <div class="quality-option-right">
                    <span class="quality-size">${q.size || (q.available ? '' : '不可用')}</span>
                    ${q.available ? `
                        <svg class="quality-download-icon" viewBox="0 0 24 24" fill="none">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" 
                                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // 绑定点击事件
        container.querySelectorAll('.quality-option:not(.disabled)').forEach(option => {
            option.addEventListener('click', () => downloadTrack(trackId, option.dataset.level));
        });

    } catch (error) {
        console.error('Failed to load qualities:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                获取音质信息失败
            </div>
        `;
    }
}

// 下载歌曲
async function downloadTrack(trackId, level) {
    const option = document.querySelector(`.quality-option[data-level="${level}"]`);
    if (!option || option.classList.contains('loading')) return;

    option.classList.add('loading');
    const rightEl = option.querySelector('.quality-option-right');
    const originalHtml = rightEl.innerHTML;
    rightEl.innerHTML = '<div class="quality-loading"></div>';

    try {
        // 获取下载URL
        const res = await api.getDownloadUrl(trackId, level);
        
        if (res?.data?.url) {
            // 获取歌曲信息用于文件名
            const detailRes = await api.getSongDetail(trackId);
            const song = detailRes?.songs?.[0];
            const fileName = song ? `${song.name} - ${song.ar?.map(a => a.name).join(', ')}.mp3` : `${trackId}.mp3`;
            
            // 创建下载链接
            const a = document.createElement('a');
            a.href = res.data.url;
            a.download = fileName;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            player.showToast('开始下载...');
            
            // 关闭弹窗
            setTimeout(() => {
                const modal = document.getElementById('downloadModal');
                if (modal) modal.classList.remove('active');
            }, 500);
        } else {
            player.showToast('获取下载链接失败');
        }
    } catch (error) {
        console.error('Download failed:', error);
        player.showToast('下载失败，请重试');
    } finally {
        option.classList.remove('loading');
        rightEl.innerHTML = originalHtml;
    }
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// ============================================
// 2. 歌单管理功能
// ============================================

// 显示添加到歌单弹窗
async function showAddToPlaylistModal(track) {
    if (!track) {
        player.showToast('请选择歌曲');
        return;
    }

    const cookie = localStorage.getItem('music_cookie');
    if (!cookie) {
        player.showToast('请先登录');
        return;
    }

    let modal = document.getElementById('playlistModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'playlistModal';
        modal.className = 'playlist-modal';
        document.body.appendChild(modal);
    }

    const coverUrl = track.cover ? track.cover + '?param=96y96' : '';

    modal.innerHTML = `
        <div class="playlist-modal-overlay"></div>
        <div class="playlist-modal-content">
            <div class="playlist-modal-header">
                <h3>添加到歌单</h3>
                <button class="playlist-modal-close">
                    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div class="add-to-playlist-track">
                <img src="${coverUrl}" alt="${track.title}">
                <div class="add-to-playlist-track-info">
                    <div class="add-to-playlist-track-title">${track.title}</div>
                    <div class="add-to-playlist-track-artist">${track.artist}</div>
                </div>
            </div>
            <div class="playlist-modal-body">
                <div class="create-playlist-btn" id="createPlaylistBtn">
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <span>创建新歌单</span>
                </div>
                <div class="playlist-list" id="playlistList">
                    <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                        加载中...
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.classList.add('active');
    modal.dataset.trackId = track.id;

    // 关闭事件
    modal.querySelector('.playlist-modal-close').onclick = () => modal.classList.remove('active');
    modal.querySelector('.playlist-modal-overlay').onclick = () => modal.classList.remove('active');

    // 创建歌单按钮
    document.getElementById('createPlaylistBtn').onclick = () => showCreatePlaylistModal(track.id);

    // 加载歌单列表
    await loadUserPlaylists(track.id);
}

// 加载用户歌单列表
async function loadUserPlaylists(trackId) {
    const container = document.getElementById('playlistList');
    if (!container) return;

    try {
        const res = await api.getMyPlaylists();
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        
        if (res?.playlist) {
            // 只显示用户创建的歌单（不显示收藏的）
            const myPlaylists = res.playlist.filter(p => p.creator?.userId === userInfo.userId);
            
            if (myPlaylists.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: var(--text-tertiary);">
                        暂无歌单，点击上方创建
                    </div>
                `;
                return;
            }

            container.innerHTML = myPlaylists.map(playlist => `
                <div class="playlist-list-item" data-playlist-id="${playlist.id}" data-track-id="${trackId}">
                    <div class="playlist-list-item-cover">
                        <img src="${playlist.coverImgUrl}?param=96y96" alt="${playlist.name}">
                    </div>
                    <div class="playlist-list-item-info">
                        <div class="playlist-list-item-name">${playlist.name}</div>
                        <div class="playlist-list-item-count">${playlist.trackCount} 首歌曲</div>
                    </div>
                    <div class="playlist-list-item-check">
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </div>
            `).join('');

            // 绑定点击事件
            container.querySelectorAll('.playlist-list-item').forEach(item => {
                item.addEventListener('click', () => addTrackToPlaylist(item.dataset.playlistId, item.dataset.trackId, item));
            });
        }
    } catch (error) {
        console.error('Failed to load playlists:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                加载失败
            </div>
        `;
    }
}

// 添加歌曲到歌单
async function addTrackToPlaylist(playlistId, trackId, itemEl) {
    if (itemEl.classList.contains('added')) {
        player.showToast('已在此歌单中');
        return;
    }

    try {
        const res = await api.updatePlaylistTracks(playlistId, trackId, 'add');
        
        if (res?.body?.code === 200 || res?.code === 200) {
            itemEl.classList.add('added');
            player.showToast('已添加到歌单');
            
            // 关闭弹窗
            setTimeout(() => {
                const modal = document.getElementById('playlistModal');
                if (modal) modal.classList.remove('active');
            }, 800);
        } else if (res?.body?.code === 502 || res?.code === 502) {
            player.showToast('歌曲已存在于该歌单');
            itemEl.classList.add('added');
        } else {
            player.showToast(res?.body?.message || res?.message || '添加失败');
        }
    } catch (error) {
        console.error('Failed to add track:', error);
        player.showToast('添加失败，请重试');
    }
}

// 显示创建歌单弹窗
function showCreatePlaylistModal(addTrackId = null) {
    let modal = document.getElementById('createPlaylistModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'createPlaylistModal';
        modal.className = 'playlist-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="playlist-modal-overlay"></div>
        <div class="playlist-modal-content" style="max-height: auto;">
            <div class="playlist-modal-header">
                <h3>创建歌单</h3>
                <button class="playlist-modal-close">
                    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <form class="create-playlist-form" id="createPlaylistForm">
                <div class="form-group">
                    <label>歌单名称</label>
                    <input type="text" id="playlistName" placeholder="输入歌单名称" maxlength="40" required>
                </div>
                <div class="form-group">
                    <label>简介（选填）</label>
                    <textarea id="playlistDesc" placeholder="介绍一下你的歌单" maxlength="300"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-checkbox">
                        <input type="checkbox" id="playlistPrivate">
                        <span>设为私密歌单</span>
                    </label>
                </div>
            </form>
            <div class="form-actions">
                <button class="btn-cancel" type="button">取消</button>
                <button class="btn-submit" type="submit" form="createPlaylistForm">创建</button>
            </div>
        </div>
    `;

    modal.classList.add('active');
    modal.dataset.addTrackId = addTrackId || '';

    // 关闭事件
    modal.querySelector('.playlist-modal-close').onclick = () => modal.classList.remove('active');
    modal.querySelector('.playlist-modal-overlay').onclick = () => modal.classList.remove('active');
    modal.querySelector('.btn-cancel').onclick = () => modal.classList.remove('active');

    // 提交事件
    document.getElementById('createPlaylistForm').onsubmit = async (e) => {
        e.preventDefault();
        await createNewPlaylist(addTrackId);
    };

    // 聚焦输入框
    setTimeout(() => document.getElementById('playlistName').focus(), 100);
}

// 创建新歌单
async function createNewPlaylist(addTrackId = null) {
    const name = document.getElementById('playlistName').value.trim();
    const desc = document.getElementById('playlistDesc').value.trim();
    const isPrivate = document.getElementById('playlistPrivate').checked;

    if (!name) {
        player.showToast('请输入歌单名称');
        return;
    }

    const submitBtn = document.querySelector('#createPlaylistModal .btn-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = '创建中...';

    try {
        const res = await api.createPlaylist(name, isPrivate);
        console.log('Create playlist response:', res);
        
        // 检查返回结果，API返回格式：{ code: 200, id: xxx, playlist: {...} }
        if (res?.code === 200 && (res?.id || res?.playlist?.id)) {
            const playlistId = res.id || res.playlist.id;
            player.showToast('歌单创建成功');
            
            // 如果有待添加的歌曲，添加到新歌单
            if (addTrackId) {
                await api.updatePlaylistTracks(playlistId, addTrackId, 'add');
                player.showToast('已添加歌曲到新歌单');
            }

            // 关闭弹窗
            const createModal = document.getElementById('createPlaylistModal');
            const addModal = document.getElementById('playlistModal');
            if (createModal) createModal.classList.remove('active');
            if (addModal) addModal.classList.remove('active');

            // 刷新我的歌单页面
            if (typeof loadMyPlaylists === 'function') {
                loadMyPlaylists();
            }
        } else {
            // 显示具体错误信息
            const errMsg = res?.message || res?.msg || `创建失败 (code: ${res?.code})`;
            player.showToast(errMsg);
            console.error('Create playlist failed:', res);
        }
    } catch (error) {
        console.error('Failed to create playlist:', error);
        player.showToast('创建失败，请重试');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '创建';
    }
}

// 删除歌单
async function deletePlaylist(playlistId, playlistName) {
    if (!confirm(`确定要删除歌单"${playlistName}"吗？此操作不可恢复。`)) {
        return;
    }

    try {
        const res = await api.deletePlaylist(playlistId);
        
        if (res?.code === 200) {
            player.showToast('歌单已删除');
            
            // 刷新页面
            if (typeof loadMyPlaylists === 'function') {
                loadMyPlaylists();
            }
            if (typeof loadSidebarPlaylists === 'function') {
                loadSidebarPlaylists();
            }
        } else {
            player.showToast(res?.message || '删除失败');
        }
    } catch (error) {
        console.error('Failed to delete playlist:', error);
        player.showToast('删除失败，请重试');
    }
}

// ============================================
// 3. MV播放增强
// ============================================

// 增强版MV播放
async function playMVEnhanced(mvid) {
    if (!mvid) {
        player.showToast('该歌曲没有MV');
        return;
    }

    let modal = document.getElementById('mvModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'mvModal';
        modal.className = 'mv-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="mv-modal-overlay"></div>
        <div class="mv-modal-content">
            <div class="mv-header">
                <h3>加载中...</h3>
                <button class="mv-close">
                    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div class="mv-video-container">
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-tertiary);">
                    正在加载MV...
                </div>
            </div>
        </div>
    `;

    modal.classList.add('active');
    player.pause();

    // 关闭事件
    const closeModal = () => {
        const video = modal.querySelector('video');
        if (video) video.pause();
        modal.classList.remove('active');
    };
    modal.querySelector('.mv-close').onclick = closeModal;
    modal.querySelector('.mv-modal-overlay').onclick = closeModal;

    try {
        // 并行获取MV详情和URL
        const [detailRes, urlRes] = await Promise.all([
            api.getMvDetail(mvid),
            api.getMvUrl(mvid, 1080)
        ]);

        if (!urlRes?.data?.url) {
            // 尝试降级到720p
            const url720 = await api.getMvUrl(mvid, 720);
            if (!url720?.data?.url) {
                player.showToast('MV暂不可用');
                modal.classList.remove('active');
                return;
            }
            urlRes.data = url720.data;
        }

        const mvData = detailRes?.data || {};
        const videoUrl = urlRes.data.url;

        // 更新标题
        modal.querySelector('.mv-header h3').textContent = 
            `${mvData.name || 'MV'} - ${mvData.artistName || ''}`;

        // 渲染视频
        const videoContainer = modal.querySelector('.mv-video-container');
        videoContainer.innerHTML = `
            <video class="mv-video" controls autoplay>
                <source src="${videoUrl}" type="video/mp4">
                您的浏览器不支持视频播放
            </video>
            <div class="mv-quality-selector" id="mvQualitySelector"></div>
        `;

        // 加载所有可用分辨率
        loadMvQualities(mvid, videoContainer.querySelector('video'));

        // MV信息
        if (mvData.playCount || mvData.subCount) {
            const infoDiv = document.createElement('div');
            infoDiv.className = 'mv-info';
            infoDiv.innerHTML = `
                <div class="mv-info-row">
                    <div class="mv-info-item">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                        <span>${formatPlayCount(mvData.playCount || 0)} 播放</span>
                    </div>
                    <div class="mv-info-item">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                        <span>${formatPlayCount(mvData.subCount || 0)} 收藏</span>
                    </div>
                    <div class="mv-info-item">
                        <svg viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        <span>${mvData.publishTime || ''}</span>
                    </div>
                </div>
                ${mvData.desc ? `<div class="mv-description">${mvData.desc}</div>` : ''}
            `;
            modal.querySelector('.mv-modal-content').appendChild(infoDiv);
        }

    } catch (error) {
        console.error('Failed to play MV:', error);
        player.showToast('MV加载失败');
        modal.classList.remove('active');
    }
}

// 加载MV可用分辨率
async function loadMvQualities(mvid, videoEl) {
    const selector = document.getElementById('mvQualitySelector');
    if (!selector) return;

    const resolutions = [1080, 720, 480, 240];
    const available = {};

    for (const r of resolutions) {
        try {
            const res = await api.getMvUrl(mvid, r);
            if (res?.data?.url) {
                available[r] = res.data.url;
            }
        } catch (e) {
            // 分辨率不可用
        }
    }

    const resLabels = { 1080: '1080P', 720: '720P', 480: '480P', 240: '240P' };
    let currentRes = Object.keys(available)[0] || '1080';

    selector.innerHTML = Object.keys(available).map(r => `
        <button class="mv-quality-btn ${r === currentRes ? 'active' : ''}" data-res="${r}">
            ${resLabels[r]}
        </button>
    `).join('');

    selector.querySelectorAll('.mv-quality-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const res = btn.dataset.res;
            if (available[res]) {
                const currentTime = videoEl.currentTime;
                const wasPlaying = !videoEl.paused;
                
                videoEl.src = available[res];
                videoEl.currentTime = currentTime;
                if (wasPlaying) videoEl.play();

                selector.querySelectorAll('.mv-quality-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    });
}

// 格式化播放量
function formatPlayCount(count) {
    if (!count) return '0';
    if (count >= 100000000) return (count / 100000000).toFixed(1) + '亿';
    if (count >= 10000) return (count / 10000).toFixed(1) + '万';
    return count.toString();
}

// ============================================
// 导出到全局
// ============================================
window.showDownloadModal = showDownloadModal;
window.showAddToPlaylistModal = showAddToPlaylistModal;
window.showCreatePlaylistModal = showCreatePlaylistModal;
window.deletePlaylist = deletePlaylist;
window.playMVEnhanced = playMVEnhanced;
window.formatPlayCount = formatPlayCount;
