const API_BASE = 'http://localhost:3000';

// 音质级别优先级（从高到低）
const QUALITY_LEVELS = ['jymaster', 'sky', 'jyeffect', 'hires', 'lossless', 'exhigh', 'higher', 'standard'];

const api = {
    async request(endpoint, params = {}) {
        const url = new URL(`${API_BASE}${endpoint}`);
        // 使用本地真实IP（VIP账号）
        // params.randomCNIP = true;
        params.timestamp = Date.now();
        
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                mode: 'cors'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },

    // POST 请求方法（用于写操作，如创建/删除歌单等）
    async postRequest(endpoint, params = {}) {
        const url = new URL(`${API_BASE}${endpoint}`);
        // 添加时间戳到URL（使用本地真实IP）
        url.searchParams.append('timestamp', Date.now());
        // url.searchParams.append('randomCNIP', 'true');

        try {
            const response = await fetch(url.toString(), {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params)
            });
            
            // 即使 HTTP 状态码不是 200，也尝试解析响应体以获取错误信息
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API POST request failed:', error);
            throw error;
        }
    },

    async search(keywords, options = {}) {
        const params = {
            keywords,
            limit: options.limit || 30,
            offset: options.offset || 0,
            type: options.type || 1
        };
        return this.request('/cloudsearch', params);
    },

    async getSongUrl(id, level = 'exhigh') {
        const cookie = localStorage.getItem('music_cookie');
        const params = { id, level };
        if (cookie) {
            params.cookie = cookie;
        }
        return this.request('/song/url/v1', params);
    },

    async getSongDetail(ids) {
        const idsStr = Array.isArray(ids) ? ids.join(',') : ids;
        return this.request('/song/detail', { ids: idsStr });
    },

    async getLyric(id) {
        // 检查缓存
        if (window.dataCache) {
            const cached = window.dataCache.get(window.CacheTypes.LYRICS, id);
            if (cached) {
                console.log('[Cache] 歌词命中缓存:', id);
                return cached;
            }
        }
        
        const cookie = localStorage.getItem('music_cookie');
        const params = { id };
        if (cookie) {
            params.cookie = cookie;
        }
        const result = await this.request('/lyric', params);
        
        // 缓存歌词(30分钟)
        if (window.dataCache && result) {
            window.dataCache.set(window.CacheTypes.LYRICS, id, result, 30 * 60 * 1000);
        }
        return result;
    },

    // 新版歌词接口（支持逐字歌词）
    async getLyricNew(id) {
        // 检查缓存
        if (window.dataCache) {
            const cached = window.dataCache.get(window.CacheTypes.LYRICS + '_new', id);
            if (cached) {
                console.log('[Cache] 新版歌词命中缓存:', id);
                return cached;
            }
        }
        
        const cookie = localStorage.getItem('music_cookie');
        const params = { id };
        if (cookie) {
            params.cookie = cookie;
        }
        const result = await this.request('/lyric/new', params);
        
        // 缓存歌词(30分钟)
        if (window.dataCache && result) {
            window.dataCache.set(window.CacheTypes.LYRICS + '_new', id, result, 30 * 60 * 1000);
        }
        return result;
    },

    async getPersonalized(limit = 10) {
        return this.request('/personalized', { limit });
    },

    async getPersonalizedNewSong(limit = 10) {
        return this.request('/personalized/newsong', { limit });
    },

    async getPlaylistDetail(id) {
        // 检查缓存
        if (window.dataCache) {
            const cached = window.dataCache.get(window.CacheTypes.PLAYLIST, id);
            if (cached) {
                console.log('[Cache] 歌单详情命中缓存:', id);
                return cached;
            }
        }
        
        const result = await this.request('/playlist/detail', { id });
        
        // 缓存歌单详情(10分钟)
        if (window.dataCache && result) {
            window.dataCache.set(window.CacheTypes.PLAYLIST, id, result, 10 * 60 * 1000);
        }
        return result;
    },

    async getPlaylistTracks(id, limit = 50, offset = 0) {
        // 缓存key包含分页参数
        const cacheKey = `${id}_${limit}_${offset}`;
        if (window.dataCache) {
            const cached = window.dataCache.get(window.CacheTypes.PLAYLIST + '_tracks', cacheKey);
            if (cached) {
                console.log('[Cache] 歌单歌曲命中缓存:', cacheKey);
                return cached;
            }
        }
        
        const result = await this.request('/playlist/track/all', { id, limit, offset });
        
        // 缓存歌单歌曲(10分钟)
        if (window.dataCache && result) {
            window.dataCache.set(window.CacheTypes.PLAYLIST + '_tracks', cacheKey, result, 10 * 60 * 1000);
        }
        return result;
    },

    async getToplist() {
        return this.request('/toplist');
    },

    async getToplistDetail() {
        return this.request('/toplist/detail');
    },

    async getHotSearch() {
        return this.request('/search/hot/detail');
    },

    async getNewSongs(type = 0) {
        return this.request('/top/song', { type });
    },

    async getArtistSongs(id, limit = 50, offset = 0) {
        return this.request('/artist/songs', { id, limit, offset, order: 'hot' });
    },

    async getArtistDetail(id) {
        return this.request('/artist/detail', { id });
    },

    // 获取歌手专辑
    async getArtistAlbums(id, limit = 50, offset = 0) {
        return this.request('/artist/album', { id, limit, offset });
    },

    // 搜索歌手
    async searchArtists(keywords, limit = 30, offset = 0) {
        return this.request('/cloudsearch', { keywords, type: 100, limit, offset });
    },

    async getAlbum(id) {
        return this.request('/album', { id });
    },

    async getRecommendSongs() {
        return this.request('/recommend/songs');
    },

    async getSimilarSong(id) {
        return this.request('/simi/song', { id });
    },

    async checkMusic(id) {
        return this.request('/check/music', { id });
    },

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
    },

    formatTrack(song) {
        // 解析所有艺术家
        const artists = song.ar || song.artists || [];
        const artistsList = artists.map(a => ({ id: a.id, name: a.name }));
        
        // 处理封面URL - 兼容不同API返回格式
        let cover = '';
        if (song.al) {
            if (song.al.picUrl) {
                cover = song.al.picUrl;
            } else if (song.al.pic_str) {
                // 歌手歌曲API返回pic_str，需要构造URL
                cover = `https://p1.music.126.net/${song.al.pic_str}/${song.al.pic_str}.jpg`;
            } else if (song.al.pic) {
                cover = `https://p1.music.126.net/${song.al.pic}/${song.al.pic}.jpg`;
            }
        } else if (song.album?.picUrl) {
            cover = song.album.picUrl;
        }
        
        return {
            id: song.id,
            title: song.name,
            artist: artistsList.map(a => a.name).join(' / ') || '未知艺人',
            artistId: artistsList[0]?.id || null,
            artists: artistsList,  // 保存完整的艺术家列表
            album: song.al ? song.al.name : (song.album ? song.album.name : '未知专辑'),
            albumId: song.al ? song.al.id : (song.album ? song.album.id : null),
            cover: cover,
            duration: this.formatDuration(song.dt || song.duration),
            durationMs: song.dt || song.duration,
            mvid: song.mv || song.mvid || 0
        };
    },

    parseLyric(lyricStr) {
        if (!lyricStr) return [];
        
        const lines = lyricStr.split('\n');
        const lyrics = [];
        const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

        lines.forEach(line => {
            const matches = [...line.matchAll(timeRegex)];
            if (matches.length === 0) return;

            const text = line.replace(timeRegex, '').trim();
            if (!text) return;

            matches.forEach(match => {
                const min = parseInt(match[1]);
                const sec = parseInt(match[2]);
                const ms = parseInt(match[3].padEnd(3, '0'));
                const time = min * 60 + sec + ms / 1000;
                
                lyrics.push({ time, text });
            });
        });

        return lyrics.sort((a, b) => a.time - b.time);
    },

    // ============ 登录相关接口 ============
    
    // 获取二维码key
    async getQRKey() {
        return this.request('/login/qr/key');
    },

    // 生成二维码
    async createQR(key) {
        return this.request('/login/qr/create', { key, qrimg: true });
    },

    // 检查二维码扫描状态
    async checkQR(key) {
        return this.request('/login/qr/check', { key, noCookie: true });
    },

    // 获取登录状态
    async getLoginStatus(cookie) {
        return this.request('/login/status', { cookie });
    },

    // 获取用户详情
    async getUserDetail(uid, cookie) {
        return this.request('/user/detail', { uid, cookie });
    },

    // 获取用户歌单
    async getUserPlaylist(uid, cookie, limit = 30, offset = 0) {
        return this.request('/user/playlist', { uid, limit, offset, cookie });
    },

    // 退出登录
    async logout(cookie) {
        return this.request('/logout', { cookie });
    },

    // 游客登录
    async anonimousLogin() {
        return this.request('/register/anonimous');
    },

    // 喜欢音乐
    async likeSong(id, like = true, cookie) {
        return this.request('/like', { id, like, cookie });
    },

    // 获取喜欢列表
    async getLikeList(uid, cookie) {
        return this.request('/likelist', { uid, cookie });
    },

    // ============ 新增接口 ============

    // 刷新登录状态
    async refreshLogin() {
        const cookie = localStorage.getItem('music_cookie');
        if (cookie) {
            return this.request('/login/refresh', { cookie });
        }
        return null;
    },

    // 每日推荐歌曲（需登录）
    async getDailyRecommendSongs() {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/recommend/songs', { cookie });
    },

    // 每日推荐歌单（需登录）
    async getDailyRecommendPlaylists() {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/recommend/resource', { cookie });
    },

    // 用户播放记录
    async getUserRecord(uid, type = 1) {
        const cookie = localStorage.getItem('music_cookie');
        const params = { uid, type };
        if (cookie) {
            params.cookie = cookie;
        }
        return this.request('/user/record', params);
    },

    // 私人FM
    async getPersonalFM() {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/personal_fm', { cookie });
    },

    // 私人FM - 垃圾桶（不再播放）
    async fmTrash(id) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/fm_trash', { id, cookie });
    },

    // 歌曲评论
    async getSongComments(id, limit = 20, offset = 0) {
        return this.request('/comment/music', { id, limit, offset });
    },

    // 热门评论
    async getHotComments(id, type = 0, limit = 20, offset = 0) {
        return this.request('/comment/hot', { id, type, limit, offset });
    },

    // 心动模式/智能播放
    async getIntelligenceList(songId, playlistId, startSongId) {
        const cookie = localStorage.getItem('music_cookie');
        const params = { id: songId, pid: playlistId };
        if (startSongId) params.sid = startSongId;
        if (cookie) params.cookie = cookie;
        return this.request('/playmode/intelligence/list', params);
    },

    // 获取音质详情（用于降级策略）
    async getSongQuality(id) {
        return this.request('/song/music/detail', { id });
    },

    // 带降级策略的获取歌曲URL
    async getSongUrlWithFallback(id, preferredLevel = 'exhigh') {
        const cookie = localStorage.getItem('music_cookie');
        const startIndex = QUALITY_LEVELS.indexOf(preferredLevel);
        const levels = startIndex >= 0 ? QUALITY_LEVELS.slice(startIndex) : QUALITY_LEVELS;
        
        for (const level of levels) {
            try {
                const params = { id, level };
                if (cookie) params.cookie = cookie;
                const res = await this.request('/song/url/v1', params);
                
                if (res.data?.[0]?.url) {
                    return { ...res, actualLevel: level };
                }
            } catch (e) {
                console.warn(`Quality ${level} failed, trying next...`);
            }
        }
        return { data: [{ url: null }], actualLevel: null };
    },

    // 解析逐字歌词
    parseYrc(yrcStr) {
        if (!yrcStr) return [];
        
        const lyrics = [];
        const lines = yrcStr.split('\n');
        
        lines.forEach(line => {
            const lineMatch = line.match(/^\[(\d+),(\d+)\]/);
            if (!lineMatch) return;
            
            const startTime = parseInt(lineMatch[1]) / 1000;
            const duration = parseInt(lineMatch[2]) / 1000;
            const content = line.slice(lineMatch[0].length);
            
            const words = [];
            const wordRegex = /\((\d+),(\d+),\d+\)([^(]*)/g;
            let match;
            
            while ((match = wordRegex.exec(content)) !== null) {
                words.push({
                    time: parseInt(match[1]) / 1000,
                    duration: parseInt(match[2]) / 1000,
                    text: match[3]
                });
            }
            
            if (words.length > 0) {
                lyrics.push({
                    time: startTime,
                    duration: duration,
                    text: words.map(w => w.text).join(''),
                    words: words
                });
            }
        });
        
        return lyrics.sort((a, b) => a.time - b.time);
    },

    // 搜索建议
    async getSearchSuggest(keywords) {
        return this.request('/search/suggest', { keywords, type: 'mobile' });
    },

    // 默认搜索关键词
    async getSearchDefault() {
        return this.request('/search/default');
    },

    // 云盘歌曲
    async getUserCloud(limit = 30, offset = 0) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/user/cloud', { limit, offset, cookie });
    },

    // 最近播放-歌曲
    async getRecentSongs(limit = 100) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/record/recent/song', { limit, cookie });
    },

    // 最近播放-歌单
    async getRecentPlaylists(limit = 100) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/record/recent/playlist', { limit, cookie });
    },

    // 听歌打卡
    async scrobble(id, sourceid, time) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/scrobble', { id, sourceid, time, cookie });
    },

    // ============ 喜欢歌曲相关 ============
    
    // 喜欢/取消喜欢歌曲
    async likeTrack(id, like = true) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/like', { id, like, cookie });
    },

    // 获取喜欢列表
    async getLikeList(uid) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/likelist', { uid, cookie });
    },

    // 检查歌曲是否已喜欢
    async checkLiked(ids) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        const idsStr = Array.isArray(ids) ? JSON.stringify(ids) : `[${ids}]`;
        return this.request('/song/like/check', { ids: idsStr, cookie });
    },

    // ============ 评论相关 ============
    
    // 获取歌曲评论
    async getComments(id, limit = 20, offset = 0, sortType = 2) {
        return this.request('/comment/new', { 
            id, 
            type: 0, 
            pageSize: limit, 
            pageNo: Math.floor(offset / limit) + 1,
            sortType 
        });
    },

    // 获取热门评论（使用新版接口，包含replyCount）
    async getHotComments(id, limit = 15) {
        // 检查缓存
        const cacheKey = `hot_${id}_${limit}`;
        if (window.dataCache) {
            const cached = window.dataCache.get(window.CacheTypes.COMMENTS, cacheKey);
            if (cached) {
                console.log('[Cache] 热门评论命中缓存:', id);
                return cached;
            }
        }
        
        // 使用新版接口，sortType=2 按热度排序
        const result = await this.request('/comment/new', { 
            id, 
            type: 0, 
            pageSize: limit, 
            pageNo: 1,
            sortType: 2
        });
        
        // 缓存评论(5分钟，评论更新较频繁)
        if (window.dataCache && result) {
            window.dataCache.set(window.CacheTypes.COMMENTS, cacheKey, result, 5 * 60 * 1000);
        }
        return result;
    },

    // 获取楼层评论（评论的回复）
    async getFloorComments(parentCommentId, id, limit = 20, time = -1) {
        // 检查缓存
        const cacheKey = `floor_${parentCommentId}_${id}_${limit}`;
        if (window.dataCache) {
            const cached = window.dataCache.get(window.CacheTypes.COMMENTS, cacheKey);
            if (cached) {
                console.log('[Cache] 楼层评论命中缓存:', parentCommentId);
                return cached;
            }
        }
        
        const result = await this.request('/comment/floor', { 
            parentCommentId, 
            id, 
            type: 0,  // 0表示歌曲
            limit,
            time
        });
        
        // 缓存楼层评论(5分钟)
        if (window.dataCache && result) {
            window.dataCache.set(window.CacheTypes.COMMENTS, cacheKey, result, 5 * 60 * 1000);
        }
        return result;
    },

    // 评论点赞
    async likeComment(id, cid, like = true) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/comment/like', { id, cid, t: like ? 1 : 0, type: 0, cookie });
    },

    // 发送评论 (t=1 发送新评论, t=2 回复评论)
    async sendComment(id, content, commentId = null) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        const params = {
            t: commentId ? 2 : 1,  // 2=回复, 1=发送
            type: 0,  // 0=歌曲
            id,
            content,
            cookie
        };
        if (commentId) {
            params.commentId = commentId;
        }
        return this.request('/comment', params);
    },

    // 删除评论
    async deleteComment(id, commentId) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/comment', {
            t: 0,  // 0=删除
            type: 0,
            id,
            commentId,
            cookie
        });
    },

    // ============ MV相关 ============
    
    // 获取歌曲MV信息
    async getMvDetail(mvid) {
        return this.request('/mv/detail', { mvid });
    },

    // 获取MV播放地址
    async getMvUrl(id, r = 1080) {
        return this.request('/mv/url', { id, r });
    },

    // 获取相似MV
    async getSimiMv(mvid) {
        return this.request('/simi/mv', { mvid });
    },

    // ============ 翻译歌词 ============
    // getLyricNew 已包含翻译，这里添加解析方法
    
    // 解析翻译歌词（时间单位：秒，与parseLyric一致）
    parseTransLyric(lyricStr) {
        if (!lyricStr) return [];
        const lines = lyricStr.split('\n');
        const result = [];
        const timeExp = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
        
        lines.forEach(line => {
            const match = line.match(timeExp);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const millis = parseInt(match[3].padEnd(3, '0'));
                const time = minutes * 60 + seconds + millis / 1000;
                const text = line.replace(timeExp, '').trim();
                if (text) {
                    result.push({ time, text });
                }
            }
        });
        
        return result.sort((a, b) => a.time - b.time);
    },

    // ============ 下载相关 ============
    
    // 获取不同音质的下载URL
    async getDownloadUrl(id, level = 'exhigh') {
        const cookie = localStorage.getItem('music_cookie');
        const params = { id, level };
        if (cookie) params.cookie = cookie;
        return this.request('/song/download/url/v1', params);
    },

    // 获取歌曲可用音质信息
    async getSongQualityDetail(id) {
        return this.request('/song/detail', { ids: id });
    },

    // ============ 歌单管理相关 ============

    // 创建歌单 (使用 GET 请求，避免某些环境下 POST 的问题)
    async createPlaylist(name, privacy = false, type = 'NORMAL') {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) {
            return { code: -1, message: '请先登录' };
        }
        return this.request('/playlist/create', { 
            name, 
            privacy: privacy ? 10 : 0,
            type,
            cookie
        });
    },

    // 删除歌单
    async deletePlaylist(id) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return { code: -1, message: '请先登录' };
        return this.request('/playlist/delete', { id, cookie });
    },

    // 更新歌单信息
    async updatePlaylist(id, name, desc = '', tags = '') {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return { code: -1, message: '请先登录' };
        return this.request('/playlist/update', { id, name, desc, tags, cookie });
    },

    // 添加/删除歌单歌曲
    async updatePlaylistTracks(pid, trackIds, op = 'add') {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return { code: -1, message: '请先登录' };
        const tracks = Array.isArray(trackIds) ? trackIds.join(',') : trackIds;
        return this.request('/playlist/tracks', { op, pid, tracks, cookie });
    },

    // 收藏/取消收藏歌单
    async subscribePlaylist(id, subscribe = true) {
        const cookie = localStorage.getItem('music_cookie');
        if (!cookie) return null;
        return this.request('/playlist/subscribe', { 
            id, 
            t: subscribe ? 1 : 2, 
            cookie 
        });
    },

    // 获取用户创建的歌单
    async getMyPlaylists() {
        const userInfo = localStorage.getItem('user_info');
        if (!userInfo) return null;
        const user = JSON.parse(userInfo);
        const cookie = localStorage.getItem('music_cookie');
        return this.request('/user/playlist', { uid: user.userId, cookie });
    },

    // ============ MV相关增强 ============
    
    // 获取MV所有分辨率
    async getMvAllUrl(id) {
        const resolutions = [1080, 720, 480, 240];
        const urls = {};
        for (const r of resolutions) {
            try {
                const res = await this.getMvUrl(id, r);
                if (res && res.data && res.data.url) {
                    urls[r] = res.data.url;
                }
            } catch (e) {
                console.log(`Resolution ${r} not available`);
            }
        }
        return urls;
    },

    // 获取MV评论
    async getMvComments(id, limit = 20, offset = 0) {
        return this.request('/comment/mv', { id, limit, offset });
    },

    // 获取相关MV推荐
    async getRelatedMv(mvid) {
        return this.request('/simi/mv', { mvid });
    }
};

window.api = api;
window.QUALITY_LEVELS = QUALITY_LEVELS;
