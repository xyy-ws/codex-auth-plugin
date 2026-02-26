# openai-codex-auth-plugin v0.1.1

Hotfix 版本：修复 `deactivated_workspace` 场景下不会自动切换到下一个 profile/token 的问题。

## 变更摘要
- 新增失败识别：`deactivated_workspace` / `workspace_deactivated`
- failover 决策更新：上述错误将触发当前 profile 冷却并切换到下一可用 profile
- 新增测试：覆盖 `{"detail":{"code":"deactivated_workspace"}}` 报文识别与切换逻辑

## 影响文件
- `tools/codex-failover/src/failover.mjs`
- `tools/codex-failover/test/failover.test.mjs`
- `tools/codex-failover/src/cli.mjs`
- `tools/codex-failover/README.md`

## 验证
```bash
node --test tools/codex-failover/test/failover.test.mjs
```

## 升级说明
如果你已通过仓库拉取 `main`，直接更新到最新提交即可，无需额外配置变更。
