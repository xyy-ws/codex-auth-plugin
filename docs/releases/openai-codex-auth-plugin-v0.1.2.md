# openai-codex-auth-plugin v0.1.2

Runtime hotfix 发布：补齐 `deactivated_workspace` 在当前 OpenClaw 运行时版本下的可复现修复脚本与文档。

## 变更摘要
- 新增运行时补丁脚本：
  - `tools/patch-deactivated-workspace-runtime.sh`
- 脚本行为：
  1. 动态定位当前版本的 `pi-embedded-helpers-*.js`
  2. 将 `deactivated_workspace / workspace deactivated` 注入 failover 识别词
  3. 自动备份原文件（带时间戳）
  4. 重启 gateway 并输出状态
- 更新文档：
  - `HOTFIX-deactivated-workspace.md`
  - 记录当前主机实际补丁命中文件，并说明不同 OpenClaw 版本文件名可能变化

## 适用场景
- 新会话/嵌入式 run 出现：
  - `{"detail":{"code":"deactivated_workspace"}}`
- 预期行为：
  - 将该 profile 归类为 failover 触发错误，避免继续复用失效 profile

## 使用方法
```bash
cd /root/.openclaw/repos/codex-auth-plugin
./tools/patch-deactivated-workspace-runtime.sh
```

## 验证
```bash
openclaw gateway status
grep -RIn "deactivated_workspace\|workspace deactivated" \
  /root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist/pi-embedded-helpers-*.js
```

## 影响文件
- `tools/patch-deactivated-workspace-runtime.sh`
- `HOTFIX-deactivated-workspace.md`
- `docs/releases/openai-codex-auth-plugin-v0.1.2.md`

## 风险与说明
- 此版本为“运行时热补丁编排”方案，不是上游 OpenClaw 源码正式发版。
- OpenClaw 升级后建议重新执行脚本并复核命中。
