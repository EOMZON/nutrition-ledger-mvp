# 2026-09-16 Nutrition Reconciliation 本机执行 Handoff

> 目标：先完成已验证 Production baseline 与 Daily Nutrition v1 的安全汇合和组合验证，再考虑 Today UI。不要继续从旧 9/14 PR #1 直接往前堆 UI。

## 0. 唯一任务分支

当前 reconciliation task branch：

`codex/nutrition-reconcile-production-daily-v1-20260916`

它必须保持从已验证 production baseline 派生：

`codex/production-release-20260830` @ `8f7399f0b8c2f86ba2f1af9f18d0255774537e6a`

不要改写 production branch，不直接修改 main。

## 1. 必须先读的绝对链接

Git 治理：

https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md

生产验证证据：

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/production-release-20260830/docs/analysis/2026-08-31-production-release.md

最新 baseline reconciliation 裁决：

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-reconcile-production-daily-v1-20260916/docs/analysis/2026-09-16-production-baseline-reconciliation.md

9/14 分层架构来源：

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/architecture/2026-09-14-layered-architecture.md

营养数据源 / 国标 / provenance 调研：

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-daily-v1-20260914/docs/research/2026-09-14-nutrition-data-sources-and-standards.md

原 9/14 Draft PR（历史/来源，不再作为最终集成载体）：

https://github.com/EOMZON/nutrition-ledger-mvp/pull/1

跨项目追踪：

- P0 基线汇合：https://github.com/EOMZON/creationos-os/issues/52
- P0 组合验证：https://github.com/EOMZON/creationos-os/issues/53
- P1 Today 日用体验：https://github.com/EOMZON/creationos-os/issues/54
- Ops 历史证据同步：https://github.com/EOMZON/creationos-os/issues/55

## 2. 本机先做 Git preflight

禁止默认 stash/reset/clean/rebase/force-push，也禁止 `git add -A`。

```bash
git rev-parse --show-toplevel
git rev-parse --git-common-dir
git status --short --branch
git branch --show-current
git remote -v
git worktree list
git log --oneline --decorate -15
```

如果当前目录有其他 AI 的 dirty work，先识别 owner 和冲突文件，不要覆盖。

## 3. 获取 reconciliation 分支

```bash
git fetch origin --prune
git switch codex/nutrition-reconcile-production-daily-v1-20260916
git status --short --branch
git rev-parse HEAD
git rev-parse origin/codex/nutrition-reconcile-production-daily-v1-20260916
```

确认它的祖先包含 production baseline：

```bash
git merge-base --is-ancestor 8f7399f0b8c2f86ba2f1af9f18d0255774537e6a HEAD
echo $?
```

预期退出码 `0`。

检查与 production baseline 的增量：

```bash
git diff --stat 8f7399f0b8c2f86ba2f1af9f18d0255774537e6a...HEAD
git log --oneline 8f7399f0b8c2f86ba2f1af9f18d0255774537e6a..HEAD
```

重点确认 production 的以下文件没有被旧 9/14 版本覆盖：

```text
server.mjs
index.html
playwright.config.mjs
tests/e2e.spec.js
api/index.js
vercel.json
```

## 4. 组合验证

先安装现有 lockfile：

```bash
npm ci
```

然后在同一个固定 HEAD 上依次执行：

```bash
npm run check
npm run test:unit
npm run test:e2e:local
npm run test:visual
npm run capture:ai -- --file examples/ai-estimate.example.json --dry-run
npm run capture:barcode -- --barcode 3017620422003 --dry-run
npm run build:vercel
```

### `audit:data` 单独处理

确认 `data/` 是你准备审计的真实本机营养数据后再执行：

```bash
npm run audit:data
```

它应为只读检查。任何修复动作另开提交，不自动改个人数据。

## 5. 截图

`npm run test:visual` 应输出：

```text
test-results/today-daily-v1.png
```

不要提交 `test-results/`。

人工检查：

- 页面完整加载
- Today 有合成 `演示燕麦杯`
- 原 production 导航/交互未回归
- 无明显空白、遮罩、溢出
- 1440×1000 下可正常查看

如果失败，保留 Playwright trace / failure screenshot 路径到验证报告，不上传个人营养数据。

## 6. 当前不要继续做什么

在 Issue #52/#53 完成前：

- 不开始 Today UI 大改
- 不把 PR #1 合到 test
- 不做 React/Vite 迁移
- 不做菜谱/库存/购物/AI 教练
- 不做新的 Preview/Production deploy
- 不把 test/main 当试错分支

## 7. P0 通过后，P1 才开始

P1 唯一产品任务：

https://github.com/EOMZON/creationos-os/issues/54

核心结构：

`API payload → TodayViewModel → UI components`

组件职责至少分成：

- Today data adapter/controller
- summary renderer
- meal section renderer
- intake row renderer
- provenance badge renderer

复用：

https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-reconcile-production-daily-v1-20260916/src/presentation/today-view-model.mjs

UI 不重复定义 nutrient / meal / provenance 规则。

## 8. codex-memory-private 单独执行

追踪：

https://github.com/EOMZON/creationos-os/issues/55

如果存在：

`/Users/zon/Desktop/CreationOS/codex-memory-private`

执行：

```bash
cd /Users/zon/Desktop/CreationOS/codex-memory-private
git status --short --branch
git show --stat --oneline 659753d
git branch --contains 659753d
git remote -v
git log --oneline --decorate -20
```

只有在确认现有提交真实存在、分支正确、不会覆盖 dirty/diverged work 时正常 push。

禁止 force-push；禁止从聊天记忆重建文件冒充原提交。

## 9. 验证记录

把本机结果写入业务仓新文件，例如：

`docs/verification/2026-09-16-reconciliation-local-verification.md`

必须记录：

- 固定 HEAD SHA
- Node/npm 环境
- 每条命令 + exit code + pass/fail 数
- barcode 是否真实联网
- `audit:data` 使用的数据目录（不要写隐私内容）
- screenshot 路径
- 未测试项
- rollback point：`8f7399f0b8c2f86ba2f1af9f18d0255774537e6a`

只 stage 精确相关文件并提交。

## 10. 完整本机 Agent 提示词

```text
接手 EOMZON/nutrition-ledger-mvp 的 Production Baseline Reconciliation。不要从旧聊天记忆自行设计路线。

先完整阅读并执行以下绝对链接：

1. Git 治理：
https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md

2. 8/31 production 验证证据：
https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/production-release-20260830/docs/analysis/2026-08-31-production-release.md

3. 最新 baseline reconciliation 裁决：
https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-reconcile-production-daily-v1-20260916/docs/analysis/2026-09-16-production-baseline-reconciliation.md

4. 本机执行 handoff：
https://github.com/EOMZON/nutrition-ledger-mvp/blob/codex/nutrition-reconcile-production-daily-v1-20260916/docs/handoff/2026-09-16-reconciliation-local-gate.md

5. P0 基线汇合 Issue：
https://github.com/EOMZON/creationos-os/issues/52

6. P0 组合验证 Issue：
https://github.com/EOMZON/creationos-os/issues/53

7. P1 Today 日用体验（P0 之前不要执行）：
https://github.com/EOMZON/creationos-os/issues/54

当前唯一开发候选是：
codex/nutrition-reconcile-production-daily-v1-20260916

它必须以已验证 production baseline 8f7399f0b8c2f86ba2f1af9f18d0255774537e6a 为祖先。不要用旧 main 或旧 PR #1 覆盖 production runtime。

先做非破坏性 Git preflight，保护所有 dirty/untracked/其他 AI 工作。禁止默认 git add -A、stash、reset、clean、force-push、共享历史 rebase。

随后确认 reconciliation 分支保留 production 版 server.mjs / index.html / playwright.config.mjs / tests/e2e.spec.js / api/index.js / vercel.json，同时已经增量加入 Daily Nutrition 的 domain/application/infrastructure/presentation、barcode、AI estimate、audit、unit、visual 能力。

在同一个固定 SHA 上依次执行：
npm ci
npm run check
npm run test:unit
npm run test:e2e:local
npm run test:visual
npm run capture:ai -- --file examples/ai-estimate.example.json --dry-run
npm run capture:barcode -- --barcode 3017620422003 --dry-run
npm run build:vercel

确认真实本机 data/ 后，再只读执行 npm run audit:data。

截图应生成 test-results/today-daily-v1.png，人工检查页面完整、Today 有合成演示记录、production 原有交互未回归。不要提交 test-results，也不要提交个人营养数据或 .env.local。

任何失败先在 reconciliation task branch 修；不要直接修改 test/main，不创建新的生产部署。

P0 全绿后，把固定 SHA、每条命令结果、pass/fail 数、截图路径、未测项、rollback point 写入 docs/verification/2026-09-16-reconciliation-local-verification.md，精确 stage 并提交。

完成 P0 后才评估 Issue #54：Today 默认入口、meal first-class、recent/favorite、一键重复、来源/AI 粗估明显可见、barcode UI，并保持 API payload -> TodayViewModel -> UI components 单向流。不要扩展菜谱、库存、购物或营养教练。

另外按 https://github.com/EOMZON/creationos-os/issues/55 单独核对本机 codex-memory-private 的 659753d；不 force-push，不从记忆重建历史证据。

最终返回：当前 HEAD、production ancestor 检查、变更文件清单、所有验证结果、截图绝对路径、剩余 blocker、相关 PR/Issue 链接、是否已进入 test（未完全验证时必须否）。
```
