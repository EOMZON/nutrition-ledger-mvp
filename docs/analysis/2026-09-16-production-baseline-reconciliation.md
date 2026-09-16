# 2026-09-16 营养系统 Production Baseline 汇合裁决

## 结论

后续营养系统的运行基线改为：

`codex/production-release-20260830` @ `8f7399f0b8c2f86ba2f1af9f18d0255774537e6a`

而不是 2026-09-14 分层改造时使用的旧 `main`：

`298cd1f1e46a62d1cd83efca79be73edbadd6c32`

当前 reconciliation 分支：

`codex/nutrition-reconcile-production-daily-v1-20260916`

它从已验证 production 分支直接创建，目标是把 9/14 的 Daily Nutrition v1 增量能力迁回正确运行基线。

## 为什么需要纠偏

2026-09-14 的判断“`nutrition-ledger-mvp` 是唯一可执行主线”仍然成立；错误在于当时没有把 `codex/production-release-20260830` 纳入运行基线判断。

8/31 production 分支已经实际完成：

- local browser E2E：5 passed
- Preview E2E：5 passed
- Production read-only canary：1 passed，4 write scenarios 按设计跳过
- Upstash / KV 持久化
- Preview / Production prefix 隔离
- Vercel SSO
- Evidence blob/KV 读回
- Today frozen snapshot
- edit / rollback / source switching
- Today recalc / resize / void
- append-only export audit
- readiness / async save race 修复

完整证据：

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/production-release-20260830/docs/analysis/2026-08-31-production-release.md

而 9/14 分支从旧 main 起步，主要增加：

- `src/domain`：营养素、餐次、provenance 语义
- `src/application`：capture normalization
- `src/infrastructure`：Open Food Facts / Ledger API adapter
- `src/presentation`：Today read-model
- barcode capture
- provider-agnostic AI estimate capture
- ledger audit
- unit tests
- visual test
- 数据源/国标/产品范围文档

两条分支共同祖先是旧 `main`，因此它们已经分叉，不能把 9/14 分支直接当成 production 的后继。

## 最初目标没有变化

目标不是构建大而全营养平台，而是：

`吃了什么 → 快速录入 → 来源可见 → 可修正 → Today 冻结历史 → 下次复用 → 能连续日用`

因此当前最重要的是“把已验证的运行能力和新的录入/分层能力放到同一个可验证 SHA”，而不是继续增加页面、推荐、菜谱或健康指导。

## Reconciliation 原则

### 1. Production runtime 优先保留

以下文件默认以 8/31 production 分支为真相来源，不从 9/14 旧基线覆盖：

- `server.mjs`
- `index.html`
- `playwright.config.mjs`
- `tests/e2e.spec.js`
- `api/index.js`
- `vercel.json`
- production release docs

理由：这些文件已经经过 local → Preview → Production 验证。

### 2. 9/14 新能力以增量模块迁入

优先迁移：

- `src/domain/*`
- `src/application/*`
- `src/infrastructure/*`
- `src/presentation/*`
- `lib/*` compatibility shims
- `tools/_cli.mjs`
- `tools/capture-barcode.mjs`
- `tools/capture-ai-estimate.mjs`
- `tools/audit-ledger.mjs`
- `tools/view-today.mjs`
- `tests/*.unit.test.mjs`
- `tests/visual.spec.js`
- `examples/ai-estimate.example.json`

这些文件不需要替换 production server/UI 才能存在，可以先作为独立边界和验证工具落地。

### 3. package.json 合并，不二选一

必须保留 production 命令：

- `npm run check`
- `npm run test:e2e`
- `npm run test:e2e:local`
- `npm run build:vercel`

并加入 Daily Nutrition 命令：

- `npm run test:unit`
- `npm run test:visual`
- `npm run capture:barcode`
- `npm run capture:ai`
- `npm run audit:data`
- `npm run view:today`
- `npm run verify:daily`

不新增按 push 自动运行的 GitHub Actions，不制造额外部署配额消耗。

## 当前优先级

### P0-A：基线汇合

追踪：
https://github.com/EOMZON/creationos-os/issues/52

完成条件：

- reconciliation 分支从 `8f7399f` 起步
- 迁入 9/14 可复用模块
- production runtime 文件未被旧基线覆盖
- package scripts 合并
- 输出差异和回退说明

### P0-B：组合验证

追踪：
https://github.com/EOMZON/creationos-os/issues/53

同一个固定 SHA 上执行：

```bash
npm ci
npm run check
npm run test:unit
npm run test:e2e:local
npm run test:visual
npm run audit:data
npm run capture:ai -- --file examples/ai-estimate.example.json --dry-run
npm run capture:barcode -- --barcode 3017620422003 --dry-run
npm run build:vercel
```

注意：

- `audit:data` 只读本机真实数据，确认数据目录后再执行
- barcode live dry-run 需要网络
- visual screenshot 应使用隔离临时数据
- build 不等于部署，不创建新的 Preview/Production 部署

### P1：Today 日用体验

追踪：
https://github.com/EOMZON/creationos-os/issues/54

仅在 P0 组合版稳定后推进：

- Today 主要入口
- meal first-class
- recent/favorite one-tap repeat
- source/provenance visible
- AI 粗估 visible
- barcode UI
- API → TodayViewModel → components 单向流

### Ops：历史证据同步

追踪：
https://github.com/EOMZON/creationos-os/issues/55

本机 `codex-memory-private` 的 `659753d` 截至 2026-09-16 仍无法从 GitHub 远端解析。必须先从本机确认真实提交/分支，再正常 push；禁止 force-push 或从聊天内容重建证据。

## Git 治理

严格遵守：

https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md

状态链：

`task/reconciliation branch → test → 验证 test 固定 SHA → test → main 发布 PR → main`

当前阶段：

- `main` 不修改
- `test` 不直接塞入未经组合验证的候选
- 原 PR #1 保留为历史/来源分支，不再作为最终集成载体
- reconciliation 分支成为当前实现候选

## 非目标

当前不做：

- 大规模 UI redesign
- React/Vite 迁移
- 菜谱
- 库存
- 购物清单
- AI 营养教练
- 体重/疾病建议
- 新的生产部署
- 多用户强一致性改造

## 回退

reconciliation 分支的 base 是已验证 `8f7399f`。如果增量模块导致问题，可以丢弃 reconciliation task branch，production-release 分支本身保持不变。

不得通过 force-push 回退 `main` 或 production branch。
