# Dou 网易云播放器 🎵

一款基于 NeteaseCloudMusicApi 的现代化网易云音乐播放器，拥有精美的 UI 设计和流畅的动画效果。

## ✨ 功能特点

- 🎨 **精美界面** - 流光背景、毛玻璃效果、动态光效
- 🎵 **完整播放** - 播放、暂停、上一首、下一首、进度控制
- 📝 **歌词显示** - 支持逐字歌词(YRC)和普通歌词(LRC)，带动画效果
- 🔍 **搜索功能** - 搜索歌曲、歌手、专辑
- 📋 **歌单浏览** - 推荐歌单、排行榜
- 🖥️ **全屏模式** - 沉浸式播放体验
- 🔄 **播放模式** - 顺序播放、随机播放、单曲循环
- 💾 **播放列表** - 查看和管理当前播放队列

## 📦 安装

### 1. 克隆项目
```bash
git clone https://github.com/Dou-art/Dou-Music-Player.git
cd Dou-Music-Player
```

### 2. 安装依赖
需要先安装 [Node.js](https://nodejs.org/)

```bash
cd NeteaseCloudMusicApi
npm install
```

### 3. 启动

**方式一：使用启动脚本（推荐）**
- 双击 `melodia/启动Melodia.bat`

**方式二：手动启动**
```bash
cd NeteaseCloudMusicApi
node app.js
```
然后访问 http://localhost:3000/melodia/

## 📁 项目结构

```
Dou-Music-Player/
├── melodia/                # 前端播放器
│   ├── css/               # 样式文件
│   ├── js/                # JavaScript 文件
│   ├── index.html         # 主页面
│   └── 启动Melodia.bat    # 启动脚本
├── NeteaseCloudMusicApi/  # 后端 API
└── 使用说明.txt
```

## 🛠️ 技术栈

- **前端**: HTML5, CSS3, JavaScript (原生)
- **后端**: Node.js, Express
- **API**: [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)

## 📸 预览

启动后访问 http://localhost:3000/melodia/ 即可体验

## 🙏 致谢

- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) - 网易云音乐 API

## 📄 许可证

MIT License

---

如果觉得不错，欢迎 ⭐ Star 支持！
