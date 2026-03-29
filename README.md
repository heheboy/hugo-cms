<div align="center">

<img src="./public/favicon.png" width="120" height="120" alt="Hugo CMS Logo">

# Hugo CMS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-000000?logo=rust)](https://www.rust-lang.org)

**为 [Hugo](https://gohugo.io) 静态网站生成器打造的现代化桌面 CMS**

可视化内容管理 · 实时预览 · Git 集成 · 主题管理

[下载](#-下载) · [快速开始](#-快速开始) · [功能特性](#-功能特性) · [文档](#-文档)

</div>

---

## 📸 界面预览

<div align="center">

| 文件管理 | Markdown 编辑 | 主题管理 |
|---------|--------------|---------|
| 树形文件浏览器，支持右键操作 | Monaco Editor 分屏编辑，实时预览 | 内置主题市场，一键安装切换 |

</div>

---

## ✨ 功能特性

### 📝 内容编辑
- **Monaco Editor** - VS Code 同款编辑器，支持语法高亮、自动补全
- **分屏预览** - Markdown 编辑与实时预览并排显示
- **Front Matter 编辑** - 可视化编辑文章元数据
- **自动保存** - 防止数据丢失

### 🌐 实时预览
- **独立预览窗口** - 使用 Tauri Webview 打开独立预览窗口
- **Hugo Server 集成** - 内置 hugo server，支持热重载
- **多设备预览** - 同时查看桌面和移动端效果

### 📁 项目管理
- **可视化文件树** - 树形结构浏览项目文件，支持展开/折叠
- **右键菜单** - 新建文件/文件夹、重命名、删除、复制、粘贴
- **快速导航** - 面包屑导航，快速切换目录

### 🎨 主题系统
- **主题市场** - 内置官方主题列表，一键安装
- **多安装方式** - 支持 Git、ZIP、本地文件夹安装
- **一键切换** - 快速切换已安装主题
- **主题管理** - 查看、更新、卸载主题

### 🔧 开发工具
- **集成终端** - 内置终端，直接执行 Hugo 命令
- **Git 集成** - 完整的 Git 工作流（提交、推送、拉取、分支管理）
- **媒体管理** - 图片上传、预览、复制路径
- **站点统计** - 文章数量、字数统计、草稿管理

### 🌍 国际化
- **多语言支持** - 中文/英文界面切换
- **响应式设计** - 适配各种屏幕尺寸

---

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) 最新稳定版
- [Hugo](https://gohugo.io/installation/) 全局安装

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/heheboy/hugo-cms.git
cd hugo-cms

# 2. 安装依赖
npm install

# 3. 运行开发模式
npm run tauri:dev
```

### 构建生产版本

```bash
npm run tauri:build
```

构建后的应用位于 `src-tauri/target/release/bundle/`。

---

## 📦 下载

### 预编译版本

| 平台 | 下载 |
|------|------|
| Windows | [hugo-cms-setup.exe](#) |
| macOS | [hugo-cms.dmg](#) |
| Linux | [hugo-cms.AppImage](#) |

> 注意：预编译版本即将发布，目前请从源码构建。

---

## 📋 使用指南

### 打开 Hugo 项目

1. 点击"打开项目"选择你的 Hugo 站点文件夹
2. 或者点击"新建站点"创建新的 Hugo 项目
3. 文件树会自动加载，显示项目结构

### 创建新文章

1. 点击顶部"新建文章"按钮
2. 输入文章标题，自动生成 slug
3. 选择内容类型（默认使用 `hugo new`）
4. 文章会自动在编辑器中打开

### 启动预览

1. 点击"打开预览窗口"按钮
2. Hugo server 会在后台启动
3. 独立预览窗口自动打开，显示站点效果
4. 保存文件时会自动刷新

### 配置主题

1. 点击左侧"主题"图标
2. 浏览已安装主题或访问主题市场
3. 点击主题卡片可预览详情
4. 点击"安装"或"启用"应用主题

---

## 🛠️ 技术栈

<div align="center">

| 前端 | 后端 | 工具 |
|------|------|------|
| ![React](https://img.shields.io/badge/React-20232A?logo=react) | ![Tauri](https://img.shields.io/badge/Tauri-FFC131?logo=tauri) | ![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite) |
| ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript) | ![Rust](https://img.shields.io/badge/Rust-000000?logo=rust) | ![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?logo=tailwindcss) |
| ![Monaco](https://img.shields.io/badge/Monaco_Editor-007ACC) | | ![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000000) |

</div>

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + S` | 保存文件 |
| `Ctrl + O` | 打开项目 |
| `Ctrl + N` | 新建文章 |
| `Ctrl + W` | 关闭当前标签 |
| `Ctrl + Tab` | 切换标签 |
| `Ctrl + +` / `Ctrl + -` | 编辑器字体放大/缩小 |
| `F5` | 刷新文件树 |

---

## 📁 项目结构

```
hugo-cms/
├── src/                    # React 前端源码
│   ├── components/         # UI 组件
│   │   ├── ui/            # shadcn/ui 基础组件
│   │   ├── layout/        # 布局组件（侧边栏、头部）
│   │   ├── editor/        # Markdown 编辑器
│   │   ├── theme/         # 主题管理
│   │   ├── media/         # 媒体浏览器
│   │   └── terminal/      # 集成终端
│   ├── stores/            # Zustand 状态管理
│   ├── hooks/             # Tauri API 封装
│   ├── lib/               # 工具函数
│   └── i18n/              # 国际化配置
├── src-tauri/             # Rust 后端源码
│   └── src/
│       ├── commands/      # Tauri 命令模块
│       │   ├── project.rs # 项目管理
│       │   ├── hugo.rs    # Hugo 命令
│       │   ├── file.rs    # 文件系统操作
│       │   ├── git.rs     # Git 操作
│       │   ├── theme.rs   # 主题管理
│       │   └── media.rs   # 媒体管理
│       └── main.rs
└── package.json
```

---

## 📚 文档

- [详细安装指南](./SETUP.md) - 完整的开发和生产环境配置
- [主题开发文档](./docs/theme-development.md) - 创建自定义主题
- [API 参考](./docs/api-reference.md) - Rust 后端命令参考

---

## 🤝 贡献指南

欢迎贡献！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解如何参与项目。

### 提交 Issue

- 使用 [GitHub Issues](https://github.com/yourusername/hugo-cms/issues) 报告 bug 或请求新功能
- 提交前请先搜索是否已有相关问题

### 开发流程

```bash
# Fork 并克隆仓库
git clone https://github.com/yourusername/hugo-cms.git

# 创建功能分支
git checkout -b feature/your-feature

# 提交更改
git commit -m "feat: add some feature"

# 推送到分支
git push origin feature/your-feature

# 创建 Pull Request
```

---

## 📝 更新日志

查看 [CHANGELOG.md](./CHANGELOG.md) 了解每个版本的详细更改。

---

## 🙏 致谢

- [Tauri](https://tauri.app) - 跨平台桌面应用框架
- [Hugo](https://gohugo.io) - 世界上最快的静态网站生成器
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - 代码编辑器
- [shadcn/ui](https://ui.shadcn.com) - 高质量的 React 组件

---

## 📄 许可证

[MIT](./LICENSE) © 2024 Hugo CMS Contributors

---

<div align="center">

**如果喜欢这个项目，请给它一个 ⭐️ Star！**

</div>
