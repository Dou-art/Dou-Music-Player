/**
 * 性能优化模块
 * 1. 图片懒加载
 * 2. 虚拟滚动
 * 3. 数据缓存
 */

// ============================================
// 1. 图片懒加载
// ============================================
class LazyImageLoader {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            this.loadImage(entry.target);
                            this.observer.unobserve(entry.target);
                        }
                    });
                },
                {
                    rootMargin: '100px 0px', // 提前100px开始加载
                    threshold: 0.01
                }
            );
        }
    }

    loadImage(img) {
        const src = img.dataset.src;
        if (!src) return;
        
        // 创建临时图片预加载
        const tempImg = new Image();
        tempImg.onload = () => {
            img.src = src;
            img.classList.add('loaded');
            img.removeAttribute('data-src');
        };
        tempImg.onerror = () => {
            img.src = 'https://via.placeholder.com/80?text=...';
            img.classList.add('error');
        };
        tempImg.src = src;
    }

    observe(img) {
        if (this.observer) {
            this.observer.observe(img);
        } else {
            // 降级：直接加载
            this.loadImage(img);
        }
    }

    // 观察容器内所有懒加载图片
    observeAll(container = document) {
        const images = container.querySelectorAll('img[data-src]');
        images.forEach(img => this.observe(img));
    }

    // 清理
    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}

// ============================================
// 2. 虚拟滚动列表
// ============================================
class VirtualScroller {
    constructor(options) {
        this.container = options.container;
        this.itemHeight = options.itemHeight || 64;
        this.buffer = options.buffer || 5; // 缓冲区项数
        this.items = [];
        this.renderItem = options.renderItem;
        this.onItemClick = options.onItemClick;
        
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = 0;
        
        this.wrapper = null;
        this.content = null;
        
        this.init();
    }

    init() {
        if (!this.container) return;
        
        // 创建包装结构
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'virtual-scroll-wrapper';
        this.wrapper.style.cssText = 'height: 100%; overflow-y: auto; position: relative;';
        
        this.content = document.createElement('div');
        this.content.className = 'virtual-scroll-content';
        this.content.style.cssText = 'position: relative;';
        
        this.wrapper.appendChild(this.content);
        this.container.innerHTML = '';
        this.container.appendChild(this.wrapper);
        
        // 监听滚动
        this.wrapper.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
        
        // 监听容器大小变化
        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver(() => this.updateContainerHeight());
            this.resizeObserver.observe(this.wrapper);
        }
    }

    setItems(items) {
        this.items = items;
        this.totalHeight = items.length * this.itemHeight;
        this.content.style.height = this.totalHeight + 'px';
        this.updateContainerHeight();
        this.render();
    }

    updateContainerHeight() {
        this.containerHeight = this.wrapper.clientHeight;
        this.render();
    }

    onScroll() {
        this.scrollTop = this.wrapper.scrollTop;
        this.render();
    }

    render() {
        if (!this.items.length) {
            this.content.innerHTML = '';
            return;
        }

        const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.buffer);
        const endIndex = Math.min(
            this.items.length,
            Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight) + this.buffer
        );

        const fragment = document.createDocumentFragment();
        
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.items[i];
            const element = this.renderItem(item, i);
            element.style.position = 'absolute';
            element.style.top = (i * this.itemHeight) + 'px';
            element.style.left = '0';
            element.style.right = '0';
            element.style.height = this.itemHeight + 'px';
            fragment.appendChild(element);
        }

        this.content.innerHTML = '';
        this.content.appendChild(fragment);

        // 绑定点击事件
        if (this.onItemClick) {
            this.content.querySelectorAll('.virtual-item').forEach(el => {
                el.addEventListener('click', (e) => {
                    const index = parseInt(el.dataset.index);
                    this.onItemClick(this.items[index], index, e);
                });
            });
        }
        
        // 懒加载图片
        if (window.lazyLoader) {
            window.lazyLoader.observeAll(this.content);
        }
    }

    scrollToIndex(index) {
        if (this.wrapper) {
            this.wrapper.scrollTop = index * this.itemHeight;
        }
    }

    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.wrapper.removeEventListener('scroll', this.onScroll);
    }
}

// ============================================
// 3. 数据缓存管理
// ============================================
class DataCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 50; // 最大缓存条目
        this.ttl = options.ttl || 5 * 60 * 1000; // 默认5分钟过期
        this.cache = new Map();
        this.accessOrder = []; // LRU顺序
    }

    // 生成缓存key
    generateKey(type, id) {
        return `${type}:${id}`;
    }

    // 获取缓存
    get(type, id) {
        const key = this.generateKey(type, id);
        const entry = this.cache.get(key);
        
        if (!entry) return null;
        
        // 检查是否过期
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            this.removeFromAccessOrder(key);
            return null;
        }
        
        // 更新访问顺序 (LRU)
        this.updateAccessOrder(key);
        
        return entry.data;
    }

    // 设置缓存
    set(type, id, data, customTtl) {
        const key = this.generateKey(type, id);
        const ttl = customTtl || this.ttl;
        
        // 如果达到最大容量，删除最旧的
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictOldest();
        }
        
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttl,
            timestamp: Date.now()
        });
        
        this.updateAccessOrder(key);
    }

    // 检查是否有缓存
    has(type, id) {
        return this.get(type, id) !== null;
    }

    // 删除缓存
    delete(type, id) {
        const key = this.generateKey(type, id);
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
    }

    // 清空某类型的所有缓存
    clearType(type) {
        const prefix = type + ':';
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                this.removeFromAccessOrder(key);
            }
        }
    }

    // 清空所有缓存
    clear() {
        this.cache.clear();
        this.accessOrder = [];
    }

    // LRU: 更新访问顺序
    updateAccessOrder(key) {
        this.removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }

    removeFromAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }

    // 驱逐最旧的条目
    evictOldest() {
        if (this.accessOrder.length > 0) {
            const oldestKey = this.accessOrder.shift();
            this.cache.delete(oldestKey);
        }
    }

    // 获取缓存统计
    getStats() {
        let validCount = 0;
        let expiredCount = 0;
        const now = Date.now();
        
        for (const entry of this.cache.values()) {
            if (now <= entry.expiry) {
                validCount++;
            } else {
                expiredCount++;
            }
        }
        
        return {
            total: this.cache.size,
            valid: validCount,
            expired: expiredCount,
            maxSize: this.maxSize
        };
    }
}

// ============================================
// 全局实例
// ============================================
const lazyLoader = new LazyImageLoader();
const dataCache = new DataCache({
    maxSize: 100,
    ttl: 10 * 60 * 1000 // 10分钟
});

// 缓存类型常量
const CacheTypes = {
    PLAYLIST: 'playlist',
    LYRICS: 'lyrics',
    COMMENTS: 'comments',
    ARTIST: 'artist',
    ALBUM: 'album',
    SONG_DETAIL: 'song_detail',
    HOT_ARTISTS: 'hot_artists'
};

// 导出到全局
window.lazyLoader = lazyLoader;
window.dataCache = dataCache;
window.CacheTypes = CacheTypes;
window.VirtualScroller = VirtualScroller;

console.log('[Performance] 性能优化模块已加载');
