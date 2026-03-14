# Profiled Codex OAuth Login

用于 OpenClaw `2026.3.12+` 场景下的应急独立入口。

背景：
- 默认 `openclaw models auth login --provider openai-codex` 已被 OpenClaw 内置登录链接管；
- 该默认链路当前不会显式让你选择 `team1/team2/team3/...` 目标 profile；
- 本脚本通过“先选 profile -> 调默认 OAuth -> 回填到目标 profile”的方式，恢复旧插件时代的按 profile 登录体验。

## 用法

```bash
cd /root/.openclaw/repos/codex-auth-plugin
npm run login:profiled
```

或：

```bash
node ./tools/login-profiled-codex.mjs
```

## 行为

1. 读取 `~/.openclaw/agents/main/agent/auth-profiles.json`
2. 列出候选 profile（优先 team1/team2/team3/default）
3. 备份 auth 文件
4. 调起当前内置 `openai-codex` OAuth 登录
5. 比较登录前后变化，将新增/更新的 OAuth 凭据复制到你选择的目标 profile
6. 同步修正该 provider 的 `order` 与 `lastGood`

## 注意
- 这是兼容性应急方案，不是 OpenClaw 官方内置 profile-aware OAuth 入口。
- 若 OpenClaw 后续恢复原生 profile 选择，这个脚本可以下线。
