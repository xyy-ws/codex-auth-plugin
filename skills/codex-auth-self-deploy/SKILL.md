---
name: codex-auth-self-deploy
description: 一键部署并验证 openai-codex auth 插件（适用于新 agent/新节点）
metadata: { "openclaw": { "emoji": "🧩", "requires": { "bins": ["bash", "openclaw"] } } }
---

# Codex Auth Self Deploy

用于把 `openai-codex-auth-plugin` 快速部署到当前 OpenClaw 节点，并完成最小验证。

## 一键执行

```bash
bash /root/.openclaw/workspace/tools/openai-codex-auth-plugin/scripts/self-deploy.sh
```

## 期望结果

- `openclaw plugins doctor` 无 plugin error
- `openclaw models auth login --provider openai-codex` 可进入 profile 选择 + OAuth URL 流程

## 可选：设置推荐顺序

```bash
openclaw models auth order set --provider openai-codex \
  openai-codex:default \
  openai-codex:team2
```

## 回滚

```bash
openclaw plugins remove openai-codex-auth-plugin
```

## 备注

- `auth order` 是串行 failover，不会并行双执行。
- 如遇本地路径不一致，可把脚本路径替换为你节点上的实际 workspace 路径。
