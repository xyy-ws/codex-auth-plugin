# openai-codex-auth-plugin v0.1.1

Hotfix 版本：修复 `deactivated_workspace` 场景下 profile 未正确失效/切换的问题。

## 变更摘要
- 新增失败识别：`deactivated_workspace` / `workspace_deactivated`
- 覆盖报文：`{"detail":{"code":"deactivated_workspace"}}`
- failover 策略更新：按 billing-style 处理（disabled/backoff），并切换到下一可用 profile
- 补充热修说明文档与插件 manifest

## 影响文件
- `tools/codex-failover/src/failover.mjs`
- `tools/codex-failover/test/failover.test.mjs`
- `tools/codex-failover/src/cli.mjs`
- `tools/codex-failover/README.md`
- `openclaw.plugin.json`
- `HOTFIX-deactivated-workspace.md`
- `package.json`（版本号 `0.1.1`）

## 验证
```bash
node --test tools/codex-failover/test/failover.test.mjs
openclaw gateway restart
openclaw models status --json
```
实测通过：`deactivated_workspace` 不再被重复使用，失败 profile 会进入不可用窗口并自动切换。
