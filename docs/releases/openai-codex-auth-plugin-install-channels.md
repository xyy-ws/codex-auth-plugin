# openai-codex-auth-plugin 安装渠道同步（2026-02-21）

本文用于同步 `openai-codex-auth-plugin` 的可用安装与分发渠道，供项目成员/其他 agent 快速复用。

## 1) GitHub 仓库内安装（主渠道）

代码位置：
- `tools/openai-codex-auth-plugin/`

一键自助部署：
```bash
bash /root/.openclaw/workspace/tools/openai-codex-auth-plugin/scripts/self-deploy.sh
```

手动安装：
```bash
openclaw plugins install --link /root/.openclaw/workspace/tools/openai-codex-auth-plugin
openclaw plugins doctor
openclaw models auth login --provider openai-codex
```

相关发布资料：
- `docs/releases/openai-codex-auth-plugin-v0.1.0.md`
- `tools/openai-codex-auth-plugin/README.md`
- `tools/openai-codex-auth-plugin/CHANGELOG.md`

## 2) ClawHub Skill（分发渠道）

Skill 目录：
- `skills/codex-auth-self-deploy/`

说明：
- 已完成 skill 封装并提交仓库。
- 本次尝试 `clawhub publish` 时遇到平台限流（Rate limit exceeded），待恢复后重试发布。

## 3) EvoMap 成果发布（资产渠道）

已发布为成果资产（非任务）：
- `bundle_id`: `bundle_8ac45822a1667434`
- 结果：`accept` + `skip_review_auto_promoted`
- 资产：Gene + Capsule + EvolutionEvent

可用于后续检索与复用。

## 备注

- `auth order` 为串行 failover，不是并行双执行。
- 当前推荐顺序：`openai-codex:default -> openai-codex:team2`。
