# Capture Label Parser NRV 误识别 — 精确修复 Handoff

日期：2026-09-17

Canonical Issue：

https://github.com/EOMZON/nutrition-ledger-mvp/issues/19

业务总入口：

https://github.com/EOMZON/nutrition-ledger-mvp/issues/10

Git 治理：

https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md

Worktree / merge reconciliation：

https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/SKILL.md

---

## 1. 任务目标

只修复 Legacy Capture `parseLabelText()` 的 NRV 误识别，并补足 semantic regression tests。

不要顺手重构 Nutrition P1、不要迁框架、不要改真实私人 ledger、不要 `test → main`、不要部署 Production。

当前远端基线：

`test@4e735a0be55e00306ed0893b02d7d4e3e422e439`

当前本机 canonical consumer 已验证精确消费同一 test SHA。

---

## 2. 真实 dogfood 证据

脱敏复现：

```text
每100g 能量 539kcal 蛋白质 6.3g 脂肪 30.9g 饱和脂肪 10.6g 碳水化合物 57.5g 糖 56.3g
```

错误结果：

```text
energy_kcal=539kcal
protein_g=6.3g
fat_g=30.9g
carb_g=57.5g

# 错误产生：
energy_nrv_pct=6.3%
protein_nrv_pct=30.9%
fat_nrv_pct=10.6%
carb_nrv_pct=56.3%
```

真实 Issue：

https://github.com/EOMZON/nutrition-ledger-mvp/issues/19

注意：`audit:data` 仍然可以 `ok=true`，因为这些行结构合法；这说明本任务需要 semantic parser tests，而不是只靠 ledger structural audit。

---

## 3. 已定位的根因

目标文件：

https://github.com/EOMZON/nutrition-ledger-mvp/blob/test/index.html

函数：

```text
parseLabelText(text, { basisOverride, servingRaw })
```

当前 energy / protein / fat / carb / sodium 的 regex 都包含类似尾段：

```regex
(?:[^0-9%]*([0-9]+(?:[.,][0-9]+)?)\s*%?)?
```

问题有两个：

1. `%?` 允许百分号不存在；
2. `[^0-9%]*` 可以跨过下一个营养素名称。

因此：

```text
蛋白质 6.3g 脂肪 30.9g
```

在 protein regex 中会把 `30.9` 当成 `protein_nrv_pct`。

energy 同理会把后面的 protein value 当 energy NRV。

---

## 4. 最小修复 contract

### 4.1 NRV 必须显式带 `%`

把所有 NRV capture 尾段从：

```regex
(?:[^0-9%]*([0-9]+(?:[.,][0-9]+)?)\s*%?)?
```

收紧为：

```regex
(?:[^0-9%]*([0-9]+(?:[.,][0-9]+)?)\s*%)?
```

也就是说：

```text
没有 %
→ 不产生 *_nrv_pct
```

不要根据位置、下一列数字或营养素顺序推断 NRV。

### 4.2 保留原来的基础营养解析

以下字段必须继续正常：

```text
energy_kj
energy_kcal
protein_g
fat_g
carb_g
sodium_mg
```

不要因为修 NRV 破坏基础营养值。

### 4.3 显式 NRV 仍必须工作

现有 E2E 例子：

```text
每100g 能量 1500kJ 18% 蛋白质 3.2g 5% 脂肪 5.6g 9% 碳水化合物 10.2g 3% 钠 120mg 6%
```

必须继续得到：

```text
energy_nrv_pct=18
protein_nrv_pct=5
fat_nrv_pct=9
carb_nrv_pct=3
sodium_nrv_pct=6
```

### 4.4 不修改历史 ledger

本次修复只改变**未来 parse 行为**。

不要：

- 扫描并静默改旧 observations；
- overwrite append-only rows；
- 批量删除疑似错误 NRV；
- 修改用户私人 data。

如果后续确认真实 ledger 中已经存在这次 dogfood 写入的错误 NRV，应另建 correction task，使用已有 append-only source/selection 机制修正，而不是 history rewrite。

---

## 5. 测试要求

至少增加下面 4 组行为覆盖。

### Case A — 无百分号不能产生 NRV

输入：

```text
每100g 能量 539kcal 蛋白质 6.3g 脂肪 30.9g 饱和脂肪 10.6g 碳水化合物 57.5g 糖 56.3g
```

必须：

```text
energy_kcal = 539
protein_g = 6.3
fat_g = 30.9
carb_g = 57.5
```

并且：

```text
energy_nrv_pct absent
protein_nrv_pct absent
fat_nrv_pct absent
carb_nrv_pct absent
sodium_nrv_pct absent
```

### Case B — 显式百分号继续正常

输入现有标准标签：

```text
每100g 能量 1500kJ 18% 蛋白质 3.2g 5% 脂肪 5.6g 9% 碳水化合物 10.2g 3% 钠 120mg 6%
```

必须保留全部 5 个 NRV。

### Case C — 混合输入

例如：

```text
每100g 能量 500kcal 25% 蛋白质 10g 脂肪 8g 12% 碳水化合物 40g 钠 200mg
```

只能产生：

```text
energy_nrv_pct=25
fat_nrv_pct=12
```

protein/carb/sodium NRV 必须 absent。

### Case D — Legacy Production regression

原有：

```text
npm run test:e2e:local
npm run test:visual
```

必须继续全绿。

---

## 6. 建议实现方式

### 当前最小安全方案

本轮只 patch `index.html` 中 `parseLabelText()` 的 5 组 regex，并在 `tests/e2e.spec.js` 或新建明确 parser behavior spec 中加回归。

原因：

- bug 已经精确定位；
- 当前 dogfood 正在跑；
- 大重构会增加验证面；
- 先修 correctness，再考虑未来把 legacy parser 提取成独立 application module。

### 后续 architecture improvement（不是本 Issue 必做）

当前 `parseLabelText()` 仍内嵌在大型 `index.html`，这不符合长期 data/UI separation。

7-day dogfood 后如果 parser 继续成为核心入口，可以另开独立架构任务：

```text
src/application/label-parser.mjs
      ↓
HTTP/application contract
      ↓
UI review table
```

让：

- parser 语义可 unit test；
- UI 不持有业务解析规则；
- OCR / pasted text / future provider 共用同一 contract。

但不要把这个长期重构塞进 #19 的 correctness fix。

---

## 7. Git / worktree 执行要求

从 live `origin/test` 精确 readback 后创建短期 task branch，例如：

```text
fix/nutrition-label-nrv-parser-20260917
```

不要直接写 `test/main`。

开始前：

```bash
git ls-remote --symref origin HEAD
git ls-remote origin refs/heads/main refs/heads/test
git status --short --branch
git worktree list --porcelain
```

当前项目已经治理到 canonical worktree 1 棵、local branches 0；优先复用 canonical checkout 或只创建**一棵有退出条件的短期 task worktree**，不要重新堆积长期工作树。

完成后必须按 `worktree-audit`：

```text
SOURCE_SAVED
→ MERGED
→ SEMANTICALLY_RECONCILED
→ TARGET_VERIFIED
→ CONSUMER_UPDATED
```

尤其：

- task 测试通过后才能 task → test；
- merge 后必须针对新的 exact test SHA 重跑受影响测试；
- canonical local consumer 如果仍停在旧 SHA，不能报告 `CONSUMER_VERIFIED`；
- consumer readback 完成后才能退休 task worktree/local branch；
- 不以 `worktree_count == 1` 代替语义 reconciliation。

通用案例：

https://github.com/EOMZON/codex-skills-private/issues/29

---

## 8. 推荐验证命令

```bash
npm ci
npm run check
npm run test:unit
npm run test:e2e:local
npm run test:visual
npm run capture:barcode -- --barcode 3017620422003 --dry-run
npm run audit:data
```

其中 `audit:data` 对真实私人 data 只能只读；不要为 parser fix 自动修历史。

如果新增专门 parser tests，先单独运行再跑 full suite。

---

## 9. 完成回执必须写回

Issue #19：

https://github.com/EOMZON/nutrition-ledger-mvp/issues/19

至少记录：

```text
base test SHA
source branch/SHA
changed files
exact regex/contract change
Case A/B/C results
full suite result
merged test SHA
post-merge test result
canonical consumer SHA/status
whether historical private data was modified (must be NO)
remaining blocker
```

同时更新 Issue #10 的 blocker 状态。

7-day dogfood #18 继续独立运行，不因 parser 修复自动算作完成。

---

## 10. 禁止项

- 不 `reset --hard`
- 不自动 stash / clean
- 不 force-push
- 不覆盖 ignored/private data
- 不把真实食物明细贴到公开 Issue
- 不为了修 regex 顺手改 P1 架构
- 不 `test → main`
- 不 Production deploy
- 不删除历史 evidence
