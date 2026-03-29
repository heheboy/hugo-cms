# 安装说明

## 环境要求

1. **安装 Rust**（如果尚未安装）：
   ```bash
   # Windows (PowerShell)
   winget install Rustlang.Rustup

   # macOS/Linux
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **安装 Node.js**（v18 或更高版本）：
   - 从 [nodejs.org](https://nodejs.org/) 下载
   - 或使用 nvm：`nvm install 18`

3. **安装 Hugo**：
   ```bash
   # Windows (PowerShell)
   winget install Hugo.Hugo.Extended

   # macOS
   brew install hugo

   # Linux
   sudo snap install hugo
   ```

## 开发环境配置

1. **安装前端依赖**：
   ```bash
   cd hugo-cms
   npm install
   ```

2. **安装 Tauri CLI**（可选但推荐）：
   ```bash
   cargo install tauri-cli
   ```

3. **运行开发服务器**：
   ```bash
   # 方式一：使用 npm 脚本
   npm run tauri:dev

   # 方式二：直接使用 cargo
   cargo tauri dev
   ```

## 项目结构

```
hugo-cms/
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   ├── hooks/              # Tauri API 封装
│   ├── stores/             # Zustand 状态管理
│   └── types/              # TypeScript 类型定义
├── src-tauri/              # Rust 后端
│   └── src/
│       └── commands/       # Tauri 命令
└── package.json
```

## 功能特性

- ✅ 文件树浏览器
- ✅ Monaco 编辑器（VS Code 同款）
- ✅ 集成终端
- ✅ Hugo 服务器控制
- ✅ Git 集成
- ✅ 项目管理

## 构建生产版本

```bash
npm run tauri:build
```

构建输出位于 `src-tauri/target/release/`。

## 常见问题解决

### Windows: "Failed to run hugo" 错误
请确保 Hugo 已添加到系统 PATH：
```powershell
hugo version
```

### Rust 编译错误
尝试更新 Rust：
```bash
rustup update
```

### Node 模块问题
清除并重新安装：
```bash
rm -rf node_modules package-lock.json
npm install
```

### Tauri 窗口无法显示
确保已安装 WebView2（Windows）：
```powershell
winget install Microsoft.Edge.WebView2Runtime
```

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **后端**: Rust + Tauri v2
- **状态管理**: Zustand
- **编辑器**: Monaco Editor（VS Code 同款）

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+S | 保存文件 |
| Ctrl+O | 打开项目 |
| Ctrl+N | 新建文章 |
| Ctrl+R | 刷新文件树 |

## 下一步

1. 运行 `npm run tauri:dev` 启动应用
2. 点击 "Open" 按钮选择 Hugo 项目
3. 开始编辑内容！
