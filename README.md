# hcman

`hcman` 是一个可全局安装的 npm CLI，用来把本地的 `Codex`、`Claude Code`、`Gemini CLI`、`OpenCode` 配置切换到你的服务商域名。这个示例默认预设是 `https://www.hicode.codes`，用途和 `ccman` 属于同一类，但实现是从零写的，更适合你二次修改和发布。

## 内测

如果你准备先让少量用户从 GitHub 安装并试用，请先看 [BETA_TESTING.md](./BETA_TESTING.md)。

## 功能

- 管理多个 provider 配置
- 一键写入 `Codex / Claude Code / Gemini CLI / OpenCode`
- 默认使用 `https://www.hicode.codes`
- OpenAI 风格工具默认补成 `https://www.hicode.codes/v1`
- 配置存储在 `~/.hcman/providers.json`

## 安装

```bash
npm install
npm link
```

安装后就可以直接执行：

```bash
hcman --help
```

也可以直接进入交互式菜单：

```bash
hcman
```

## 快速开始

首次初始化并立即写入本机配置：

```bash
hcman init --api-key sk-your-key
```

进入交互式主菜单，然后按提示操作：

```bash
hcman
```

直接进入某个工具的交互式菜单：

```bash
hcman cx
hcman cc
hcman gm
hcman oc
```

只保存 provider，不立即切换：

```bash
hcman provider add hicode-backup --api-key sk-backup-key
```

把某个 provider 应用到所有工具：

```bash
hcman provider use hicode
```

只切换 Codex：

```bash
hcman cx use hicode
```

列出、编辑、克隆、删除某个工具下可见的 provider：

```bash
hcman cx list
hcman cx edit hicode
hcman cx clone hicode hicode-backup
hcman cx remove hicode-backup
```

查看当前选择：

```bash
hcman provider current
```

## 默认写入路径

- `Codex`: `~/.codex/config.toml` 和 `~/.codex/auth.json`
- `Claude Code`: `~/.claude/settings.json`
- `Gemini CLI`: `~/.gemini/settings.json` 和 `~/.gemini/.env`
- `OpenCode`: `~/.config/opencode/opencode.json`

## 关于域名

这个脚手架做了一个合理默认值：

- `Codex` / `OpenCode`: `https://www.hicode.codes/v1`
- `Claude Code` / `Gemini CLI`: `https://www.hicode.codes`

如果你的网关并不是这个规则，可以显式覆盖：

```bash
hcman init \
  --api-key sk-your-key \
  --openai-base-url https://www.hicode.codes/custom/v1 \
  --anthropic-base-url https://www.hicode.codes/anthropic \
  --gemini-base-url https://www.hicode.codes/gemini \
  --opencode-base-url https://www.hicode.codes/custom/v1
```

## 发布到 npm

1. 注册 npm 账号，并登录：

```bash
npm login
```

2. 检查包名是否可用：

```bash
npm view hcman version
```

3. 如果包名被占用，改 `package.json` 里的 `name`。

4. 发布：

```bash
npm publish --access public
```

5. 别人安装：

```bash
npm i -g hcman
```

## 常见修改点

- 改默认域名：`src/constants.js`
- 改命令名：`package.json` 的 `name` 和 `bin`
- 增加更多客户端：`src/writers.js`
- 改交互或命令结构：`src/cli.js`
