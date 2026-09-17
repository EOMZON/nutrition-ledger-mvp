# 2026-09-17 Nutrition Today P1 远端验证回执

## 结论

Nutrition P1 的远端候选已经达到 **CANDIDATE_VERIFIED**，但还不是 `main` / Production / 7-day dogfood 完成态。

业务 Issue：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/10

候选分支：
`feat/nutrition-today-daily-p1-20260917`

本轮已完整验证的业务 SHA：
`2f3e496c52a3e76f1c5f5b0d5f77b9b2b3b38035`

验证 PR（只增加 workflow，不合入）：
https://github.com/EOMZON/nutrition-ledger-mvp/pull/14

Actions run：
https://github.com/EOMZON/nutrition-ledger-mvp/actions/runs/35182347408

Artifact：
https://github.com/EOMZON/nutrition-ledger-mvp/actions/runs/35182347408/artifacts/10480764004

Artifact digest：
`sha256:2be2e5a07ae87be2a65ed5958b7c476541987c07cfbb9bb44b5e1960f1ef4a1c`

> GitHub PR runner 实际 checkout 是由 `2f3e496...` + verification-only workflow 合成的 PR merge ref；workflow 是唯一额外文件，业务实现固定为上述业务 SHA。

---

## 最初目标

本批不扩展成大而全营养平台，而是推进：

```text
吃了什么
→ 快速录入
→ 来源可见
→ 可修正
→ Today 冻结历史
→ 下次复用
→ 每天愿意真实使用
```

---

## 实现架构

没有重写 2026-08-31 已验证 Production runtime。

采用 strangler / adapter：

```text
index-p1.html
  ↓
/api/p1/*
  ↓
p1-server.mjs
  ↓
src/application/daily-experience.mjs
  ↓
existing server.mjs append-only APIs
  ↓
existing local/KV persistence
```

领域/展示继续分层：

```text
src/domain/nutrients.mjs
src/domain/meals.mjs
src/domain/intake-history.mjs
        ↓
src/application/daily-experience.mjs
        ↓
src/presentation/today-view-model.mjs
        ↓
index-p1.html
```

旧工作台仍通过：

```text
/?legacy=1
```

保留 Capture / Foods / Evidence / History / export 等既有能力。

---

## 本批已实现

### Today 默认入口

`/` 现在是 Today-first 日用页面：

- 热量 / 蛋白质 / 脂肪 / 碳水；
- 饱和脂肪 / 糖 / 膳食纤维 / 钠；
- 餐次分组；
- 来源 badge；
- `AI 粗估 · 约` 明示；
- 最近食物；
- 近 30 天常用食物；
- 一键重复；
- 已有食物快速记录；
- 条码查询/确认入口；
- 完整工作台回退入口。

### Meal first-class

P1 intake 会显式保存：

```text
breakfast / lunch / dinner / snack / other
```

同时保留旧记录兼容：历史 `note=meal:*` 继续可读，不批量改写旧 intake。

### 扩展营养素

P1 snapshot 直接消费 domain nutrient registry，至少覆盖：

```text
energy_kcal
energy_kj
protein_g
fat_g
saturated_fat_g
carb_g
sugars_g
fiber_g
sodium_mg
```

避免条码 adapter 已获得糖/纤维/饱和脂肪、但 Today snapshot 丢字段的问题。

### 快速复用

最近/常用由 append-only intake 历史派生，不增加第二份 Favorites canonical database。

一键重复会创建新的 `intake.add`；旧 intake 不修改。新记录重新用当前有效 nutrition observation 生成 frozen snapshot。

### Barcode UI

浏览器只调用本项目 `/api/p1/barcode*`，不直接拥有 Open Food Facts 业务逻辑。

第一版：

```text
输入/粘贴条码
→ server/application adapter
→ Open Food Facts
→ 用户查看产品/来源
→ 确认导入
→ 可加入 Today
```

没有引入摄像头 SDK。

---

## 验证结果

### Static

`npm run check`：PASS。

### Unit

`npm run test:unit`：**10/10 PASS**。

新增覆盖：

- 扩展 nutrient snapshot；
- first-class meal + append-only legacy APIs；
- intake add/patch/void merge；
- recent/common derivation；
- barcode duplicate observation guard。

### Full browser regression + P1

`npm run test:e2e:local`：**12/12 PASS**。

其中旧 Production regression 5/5 全通过：

1. shell / health / navigation；
2. Capture create/parse/frozen snapshot；
3. Evidence upload/list/reload/blob readback；
4. edit/source switch/frozen Today/recalc/resize/void；
5. append-only export。

P1 同轮通过：

- Today 默认入口；
- meal first-class；
- extended nutrients；
- provenance / AI approximate；
- one-click repeat；
- existing-food quick-add；
- barcode lookup UI；
- P1 visual；
- legacy visual。

### Visual

`npm run test:visual`：**2/2 PASS**。

输出：

- `test-results/today-p1.png`
- `test-results/today-daily-v1.png`

Ubuntu runner 缺 CJK 字形，因此截图中文字显示 tofu box；DOM 文字断言和业务行为通过。这两张图用于布局/结构回归，不作为中文字形视觉基准。

### AI structured dry-run

PASS。

示例仍明确：

```text
method=ai_estimate
confidence=0.68
```

并保留“粗估”语义。

### Live Open Food Facts

真实联网 PASS：

```text
barcode = 3017620422003
product = Nutella
source = openfoodfacts
method = database
confidence = community_database
```

本轮 readback 包含：

- energy 539 kcal / 2252 kJ
- protein 6.3 g
- fat 30.9 g
- saturated fat 10.6 g
- carb 57.5 g
- sugars 56.3 g
- fiber 0 g
- sodium 42.8 mg

### Isolated ledger audit

PASS：

```text
ok=true
issues=[]
```

该 audit 使用 CI 临时空 ledger，不代表用户真实私人 `data/` 已审计。

---

## 失败演进也保留为证据

### PR #11 / run 35181856351

static + unit + legacy Production 通过；暴露测试 locator / fixture 隔离不足。

### PR #12 / run 35182053135

继续通过更多 P1；暴露共享临时 ledger 不能假设整日纤维总量只来自单条 fixture。

### PR #13 / run 35182217859

P1 一键重复等继续通过；只剩 `加入 Today` 与 `确认并加入 Today` 的模糊按钮匹配。

这些都按 exact-SHA 标记 superseded，没有重跑旧 SHA 冒充最新组合验证。

---

## 当前尚未完成 / 不能远端冒充完成

- 用户真实本机 Nutrition `data/` 只读 audit；
- 用户本机 worktree / local branch 退出治理；
- `codex-memory-private` 历史 nutrition evidence（记录过 `659753d`）安全远端同步；
- 真实用户 1 天记录时长验收（≤10s / ≤30s）；
- 7 天 dogfood；
- 真实 Vercel project context 下的发布前 `npm run build:vercel`；
- `test → main`；
- Production deployment / authenticated live readback。

以上项目不能因为 CI 通过而标 DONE。

---

## Git / Worktree 治理

Git governance：
https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md

Worktree audit：
https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/SKILL.md

状态必须分开：

```text
SOURCE_SAVED
!= MERGED
!= SEMANTICALLY_RECONCILED
!= TARGET_VERIFIED
!= CONSUMER_UPDATED
```

候选通过后仍必须 task → test，并对新的固定 test SHA 做 post-merge verification；本机 canonical checkout / worktree 也要单独 readback。

本机唯一 Handoff：
`docs/handoff/2026-09-17-nutrition-local-worktree-data-dogfood.md`
