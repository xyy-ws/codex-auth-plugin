# openai-codex-auth-plugin v0.1.0

首个可用发布版，目标是让 `openclaw models auth login --provider openai-codex` 在本地环境稳定可用，并支持多 profile 登录写入。

## 包含内容
- `openai-codex` provider auth 插件
- 登录时选择目标 profile（default/team2）
- OAuth 流程可用（URL + 回调粘贴）
- 基础日志可观测（start/success/failure）

## 快速部署（自助）
```bash
openclaw plugins install --link /root/.openclaw/workspace/tools/openai-codex-auth-plugin
openclaw plugins doctor
openclaw models auth login --provider openai-codex
```

## 建议配置
```bash
openclaw models auth order set --provider openai-codex \
  openai-codex:default \
  openai-codex:team2
```

## 回滚
- `openclaw plugins remove openai-codex-auth-plugin`
- 恢复 `~/.openclaw/openclaw.json` 备份
