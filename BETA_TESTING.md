# hcman 内测说明

这份说明用于 `hcman` 在正式发布到 npm 之前的 GitHub 内测分发。

仓库地址：

- `https://github.com/lianshanspeak/hcman`

## 适合谁参与

- 能在终端里执行 `npm` 和 `git`
- 本机已安装 `Node.js 18+`
- 愿意测试 CLI 安装、交互菜单、配置写入

## 注意事项

- `hcman` 会写入你当前用户目录下的工具配置文件
- 如果你本机已经在用 `Codex`、`Claude Code`、`Gemini CLI`、`OpenCode`，建议先备份现有配置
- 更推荐在测试机、云主机或新用户环境里试用

默认会写入这些路径：

- `~/.codex/config.toml`
- `~/.codex/auth.json`
- `~/.claude/settings.json`
- `~/.gemini/settings.json`
- `~/.gemini/.env`
- `~/.config/opencode/opencode.json`

## 安装方式

推荐直接从 GitHub 安装当前测试版：

```bash
npm i -g git+https://github.com/lianshanspeak/hcman.git#main
```

安装完成后先确认命令可用：

```bash
hcman --help
hcman
```

如果需要更新到最新测试代码：

```bash
npm i -g git+https://github.com/lianshanspeak/hcman.git#main
```

如果需要卸载：

```bash
npm rm -g hcman
```

## 建议测试流程

### 1. 验证安装和启动

执行：

```bash
hcman --help
hcman
```

重点看：

- 是否能正常安装
- 是否能正常进入主菜单
- 菜单是否能上下选择并返回

### 2. 验证一键初始化

执行：

```bash
hcman init --api-key sk-test-demo
```

重点看：

- 是否能成功写入配置
- 输出里是否列出了写入的文件
- 再执行 `hcman status` 是否能看到当前 provider

### 3. 验证 HiCode 快捷配置

执行：

```bash
hcman hicode
```

重点看：

- 是否会先提示选择服务
- 输入 API Key 后，是否只写入选中的服务配置
- `https://www.hicode.codes` 是否被自动带入

也可以测试非交互模式：

```bash
hcman hicode sk-test-demo --platform codex,claude
```

### 4. 验证交互式菜单

依次测试：

```bash
hcman
hcman cx
hcman cc
hcman gm
hcman oc
```

重点看：

- 主菜单是否能进入各工具子菜单
- 子菜单里的 `添加 / 切换 / 列表 / 当前 / 编辑 / 克隆 / 删除` 是否可用
- 操作后是否会出现异常退出或卡死

### 5. 验证 provider 管理命令

建议按顺序执行：

```bash
hcman provider add backup --api-key sk-backup --domain https://api.example.com
hcman provider list
hcman provider current
hcman cx use backup
hcman cx current
hcman cx clone backup backup-copy
hcman cx list
```

重点看：

- provider 是否能成功保存
- 当前 provider 是否会正确变化
- 克隆后是否会出现重名覆盖
- 列表显示是否清楚

### 6. 验证配置文件实际内容

建议检查这些文件是否真的被更新：

```bash
cat ~/.codex/auth.json
cat ~/.claude/settings.json
cat ~/.gemini/.env
cat ~/.config/opencode/opencode.json
```

重点看：

- 配置文件是否存在
- API Key 和 Base URL 是否写到了预期位置
- 再次切换 provider 后内容是否跟着变化

### 7. 验证编辑和回写

重点测试：

- 编辑当前正在使用的 provider 后，本地配置文件是否同步变化
- 删除未使用 provider 是否正常
- 删除当前 provider 后，程序是否有合理提示

## 重点关注的问题

请优先关注这些风险：

- 安装失败
- `hcman` 命令找不到
- 交互菜单无法操作
- 写入了错误的配置路径
- 覆盖了不该覆盖的已有配置
- 切换 provider 后配置内容没变
- 编辑当前 provider 后配置没有同步更新
- Windows、macOS、Linux 上行为不一致
- 错误提示太少，无法定位问题

## 反馈方式

推荐直接到 GitHub 提 issue：

- `https://github.com/lianshanspeak/hcman/issues`

仓库里已经提供了 `Beta Feedback` 模板。反馈时请尽量带上这些信息：

- 操作系统和版本
- Node.js 版本
- 安装命令
- 复现步骤
- 期望结果
- 实际结果
- 终端完整报错
- 被影响的配置文件路径
- 你的机器上这些配置文件在测试前是否已经存在

## 反馈示例

标题：

```text
[Beta] hcman cx use backup 在 Ubuntu 24.04 下没有更新 auth.json
```

正文：

```text
环境:
- OS: Ubuntu 24.04
- Node: v22.15.0

安装方式:
- npm i -g git+https://github.com/lianshanspeak/hcman.git#main

复现步骤:
1. hcman provider add backup --api-key sk-backup --domain https://api.example.com
2. hcman cx use backup
3. cat ~/.codex/auth.json

期望结果:
- auth.json 里的 OPENAI_API_KEY 变成 sk-backup

实际结果:
- 文件内容没有变化

补充信息:
- ~/.codex/auth.json 在测试前已经存在
- 终端没有报错
```

## 内测结束后的下一步

如果内测稳定，再进入正式发布流程：

1. 修复测试反馈的问题
2. 更新 `package.json` 版本号
3. 打正式 tag
4. 发布到 npm
