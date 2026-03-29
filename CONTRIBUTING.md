# 贡献指南

感谢您对 Hugo CMS 的兴趣！我们欢迎所有形式的贡献。

## 如何贡献

### 报告 Bug

1. 使用 [GitHub Issues](https://github.com/yourusername/hugo-cms/issues) 创建问题
2. 使用 "bug" 标签
3. 提供以下信息：
   - 操作系统和版本
   - Hugo CMS 版本
   - 复现步骤
   - 期望行为 vs 实际行为
   - 错误截图（如适用）

### 建议新功能

1. 先搜索是否已有类似建议
2. 创建 Issue 并添加 "enhancement" 标签
3. 描述功能用途和预期行为
4. 如果可能，提供 UI 设计草图

### 提交代码

1. **Fork 仓库**
   ```bash
   git clone https://github.com/heheboy/hugo-cms.git
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/bug-description
   ```

3. **提交规范**
   - 使用 [Conventional Commits](https://www.conventionalcommits.org/)
   - 格式：`<type>(<scope>): <description>`
   - 示例：
     - `feat(editor): add word count display`
     - `fix(theme): resolve dark mode toggle issue`
     - `docs(readme): update installation guide`

4. **代码风格**
   - TypeScript/React：使用项目 ESLint 配置
   - Rust：使用 `cargo fmt` 和 `cargo clippy`
   - 提交前运行 `cargo check` 确保无编译错误

5. **测试**
   - 确保修改不会破坏现有功能
   - 手动测试主要功能流程
   - 如果添加新功能，请考虑添加测试

6. **创建 Pull Request**
   - 填写 PR 模板
   - 关联相关 Issue
   - 等待代码审查

## 开发环境设置

### 前置要求

- Node.js v18+
- Rust 最新稳定版
- Hugo 全局安装
- Git

### 本地开发

```bash
# 安装前端依赖
npm install

# 运行开发服务器（前端热重载）
npm run dev

# 运行完整应用（包括 Rust 后端）
npm run tauri:dev

# 构建生产版本
npm run tauri:build
```

### 项目结构说明

- `src/` - React 前端代码
- `src-tauri/src/` - Rust 后端代码
- `src/components/ui/` - shadcn/ui 组件
- `src/hooks/` - Tauri API 封装

## 代码审查流程

1. 所有 PR 需要至少 1 个审查者批准
2. 确保 CI 检查通过
3. 解决所有审查意见
4. 维护者会合并到 main 分支

## 行为准则

- 尊重所有贡献者
- 接受建设性批评
- 关注问题本身而非个人
- 使用包容性语言

## 问题?

如有疑问，欢迎：
- 在 Issue 中提问
- 加入我们的讨论区
- 发送邮件到 [bengbeng9548@qq.com]

再次感谢您的贡献！
