# Nutrition Ledger MVP (Local‑first)

本目录是一个“可溯源的营养数据账本”MVP：用 **JSONL 追加写**记录每条数值来源，用 **selection 指针 + event** 支持回滚/切换数据源；证据图片可选上传到 Cloudflare R2；并新增 **Today（摄入账本）** 来解决“默认值 vs 当日记录”混淆：Today entry 会冻结当时使用的 observationId，因此默认值变化不会“改历史”。

## 运行

```bash
npm start
# 或：node html/nutrition-ledger-mvp/server.mjs
```

打开：`http://127.0.0.1:8789`（默认只监听 localhost；可用 `HOST/PORT` 环境变量调整）

## 核心 UX（覆盖“多来源 + 用户自定义 + 可回滚 + 多录入方式 + 当日记录”）

### A. 入口分层（最重要）

- `Capture`：录入 → 识别 → 校对 → 写入 observation（默认值数据）
- `Foods`：管理默认值（溯源/切换来源/回滚/手动改值/证据）
- `Today`：记录摄入（冻结快照，可解释“为什么”）

### B. 创建食物（包装食品 / 条码优先）

1. 点「新建食物」
2. 填：名称（必填）/条码（推荐）/品牌（可选）

结果：生成 `foodId=food:barcode:<digits>`（条码缺失则生成 `food:custom:*`）。

### C. 证据优先（图片→压缩→可选 R2→可追溯）

1. 在「证据图片」里上传营养成分表照片（建议只拍“营养成分表区域”）
2. 保存后会生成：
   - 本地 `preview + thumb`（压缩图）
   - 一条 `evidence.create`（含 sha256、尺寸、OCR 文本（可选））
3. （可选）勾选「上传到 R2」：会把 preview 上传并记录 `publicUrl/bucket/key`

你之后给任何一条营养数值都可以挂 `evidenceId`，点历史能看到证据图并放大查看。

### D. 标签文本导入（OCR 文本粘贴→解析→校对→批量写入 observation）

在 `Capture` 里：

1. 粘贴系统 OCR 结果
2. 点「解析」：识别 basis（每 100g/每 100ml/每份）与基础字段（能量/蛋白质/脂肪/碳水/钠 + 可选 NRV%）
3. 在“校对表”里修正数值/单位（可选）
4. 点「写入观测」：会为每个字段追加一条 `observation`，并把 selection 指针切到最新值

### E. 用户改值（不覆盖旧值；保留修改链）

1. 在任意营养行点「改值」
2. 填 value/unit/method/source（可选 evidence/note）
3. 保存：会追加新 observation，并写一条 `selection.set`（from=旧 to=新），且新 observation 的 `parentId=旧`

### F. 多来源切换 / 回滚（选择指针）

1. 在任意营养行点「历史」
2. 选择历史里的任意一条 → 「使用此值」：写一条 `selection.set(reason=choose_source)`
3. 「回滚到最初」：把 selection 指针指回最早记录（仍不删除任何历史）

### G. Today（摄入账本：冻结快照）

1. 在 `Today` 里点「Quick Add」选择食物、basis、数量
2. 保存后会追加一条 `intake.add`，并把当时使用的每个营养字段的 `observationId/source/version/method/unit/basis` 一起冻结到 entry 里
3. 之后可「改量」（`intake.patch`）、可「重算」（按最新默认值重新解析生成 `intake.patch`）、可「撤销」（`intake.void`，不删除记录）

### H. 导出 / 可迁移

点「导出 JSON」会导出 foods、selections、ledger（observations/events/evidence）便于备份与迁移。

## 数据落盘

- `html/nutrition-ledger-mvp/data/ledger/observations.jsonl`：数值观测（不可变）
- `html/nutrition-ledger-mvp/data/ledger/events.jsonl`：选择/回滚等事件（不可变）
- `html/nutrition-ledger-mvp/data/ledger/evidence.jsonl`：证据记录（create/patch）
- `html/nutrition-ledger-mvp/data/ledger/intakes.jsonl`：Today 摄入记录（add/patch/void，不可变）
- `html/nutrition-ledger-mvp/data/state/foods.json`：食物列表快照
- `html/nutrition-ledger-mvp/data/state/selections.json`：当前选用值快照
- `html/nutrition-ledger-mvp/data/blobs/`：压缩预览图与缩略图

## 最小使用流程（推荐）

1. 点「新建食物」（可填条码）
2. （可选）在「证据图片」里上传营养成分表照片，保存（可选上传到 R2）
3. 去 `Capture`：粘贴 OCR 文字 → 解析 → 校对 → 写入观测
4. 去 `Today`：Quick Add 记录摄入（或在 Capture 里勾选“写入后立即加入 Today”）
5. 去 `Foods`：需要时改值/回滚/切换来源

## R2（可选）

此 MVP 内置：`html/nutrition-ledger-mvp/tools/upload-to-r2.js`（优先使用本地 `.env`）。

同时在你的 MINE 目录下也兼容：`8_Workflow/video/OLDLIFEASSONG/TOOLS/cartoon/upload-to-r2.js`（若本项目未配置/不存在）。

在 `html/nutrition-ledger-mvp/.env`（或 `8_Workflow/video/OLDLIFEASSONG/.env`）配置（示例字段名以脚本为准）：

```env
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
R2_BUCKET=...
R2_PUBLIC_BASE_URL=https://...
```

然后在网页里勾选“上传到 R2”即可。

## Playwright e2e（可选）

```bash
npx playwright install chromium
npm run test:e2e
```
