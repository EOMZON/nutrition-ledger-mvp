# Feishu → Nutrition Ledger MVP · 逐步跑通计划

目标：把“飞书”当成手机端入口：**发图片 → 落库（可追溯）→（可选）AI 分析 →（可选）云端展示**。

本计划文档放在：`/Users/zon/Desktop/MINE/html/nutrition-ledger-mvp/PLAN.feishu-bridge.md`

## 现状资产（本机路径）
- 飞书通信（Clawdbot channel）：`/Users/zon/Desktop/MINE/DEVELOPE/Tool/clawdbot-feishu`
- 图片→R2→AI→回放：`/Users/zon/Desktop/MINE/DEVELOPE/HEALTH/idea/nutrition-mvp`
- 账本 + Today + Evidence（本项目）：`/Users/zon/Desktop/MINE/html/nutrition-ledger-mvp`

## 最强大脑的 3 条原则（用于避免“越做越乱”）
1. **采集先零阻力**：任何一次输入都必须能立刻回执（异步处理），否则用户会放弃。
2. **可追溯优先**：所有结果都要能追到证据（evidenceId / messageId / publicUrl），否则数据会失真。
3. **先跑通再上云**：本地 → 局域网 → 云端，每一步都有验收口径，不跨步。

## 目标 UX（MVP）
1) 手机飞书发“餐盘照 / 营养成分表照”给 bot（DM 或群里 @）
2) bot 秒回：已收到 / 处理中
3) 1–10s 后 bot 回卡片：
- 已入库：evidenceId
- （可选）粗估营养（kcal/三大营养）
- （可选）打开网页：Today / Foods / Evidence

---

## 里程碑 & 验收

### M0：Ledger 服务可跑、可从手机访问（同 WiFi）
**目标**：先把“展示端”跑通，确保后续入库有地方看。

- [ ] 启动：
  - `cd /Users/zon/Desktop/MINE/html/nutrition-ledger-mvp`
  - `npm start`
- [ ] 让手机可访问（同 WiFi）：
  - 以环境变量启动：`HOST=0.0.0.0 PORT=8789 npm start`
  - 手机访问：`http://<电脑局域网IP>:8789`

**验收**：手机能打开页面；能手动上传 evidence 并看到缩略图/放大图。

### M1：飞书图片 → ledger evidence 落库（先不做 AI）
**目标**：手机发图即可“入库可回看”，这是最关键的闭环。

**实现思路（推荐）**
- 从飞书事件拿到：`message_id` + `image_key`
- 下载图片：调用 OpenAPI “获取消息中的资源文件”
  - `GET /open-apis/im/v1/messages/:message_id/resources/:file_key?type=image`
  - 其中 `file_key` 通常可直接用 `image_key`
- 写入 ledger：调用 `POST /api/evidence`
  - MVP 允许 `preview/thumb` 暂时用同一张图（后续再做压缩/缩略）
  - `note` 写入来源信息（messageId/chatId/senderOpenId）便于追溯

**验收**
- 飞书发图后：`data/ledger/evidence.jsonl` 新增 `evidence.create`
- UI 能选到该 evidence；点击可放大查看

### M1.1：图片体积治理（否则很快会撞限）
**动机**：`/api/evidence` 默认 body limit 是 12MB；base64 还会膨胀。

- [ ] 下载后先压缩/缩放：preview ≤ 1024px，thumb ≤ 256px
- [ ] 目标大小：preview ~200–800KB，thumb ~20–80KB

**验收**：手机原图（常见 3–8MB）也能稳定入库。

### M2：AI 分析（粗估）并与 evidence 绑定
**目标**：让“图片 → 粗估营养”自动发生，用户只做校对。

- 复用：`/Users/zon/Desktop/MINE/DEVELOPE/HEALTH/idea/nutrition-mvp/scripts/ai-analyze-one.mjs` 的结构化输出思路
- 存储策略（建议二选一）：
  - A（最快）：把 JSON 串进 `evidence.note`（能跑通，但不可检索）
  - B（更正）：新增 `analyses.jsonl`（推荐：后续可筛选/汇总/重算）

**验收**：
- 每张图能产出一份 analysis 记录，并可追溯到 evidenceId/messageId
- 飞书回复卡片包含 kcal/宏量粗估 + 不确定性提示

### M3：Today（摄入账本）闭环
**目标**：让“今天吃了什么/吃了多少”能自动记账，且历史不被默认值变化污染。

候选实现（MVP 版）：
- 以“整餐”作为一个 food（如 `food:photo:<sha>`）写入 foods
- 根据 analysis totals 生成 observation（method=`derived` / source=`ai`）
- 自动写一条 `intake.add` 到当天

**验收**：飞书发图后 Today 页当日汇总出现该条记录，且支持撤销/重算。

### M4：云端展示（生产化）
**目标**：手机在公网也能打开 UI（不依赖局域网）。

候选：Fly.io（挂卷）、Render（持久盘）、自建 VPS。

**验收**：
- 手机在公网可访问 `https://...`
- 数据目录持久化，重启不丢
- 至少有一层访问控制（token/basic auth），避免隐私泄露

---

## 配置清单（不入 git）
- Feishu：`appId/appSecret` + 机器人能力 + `im:message` / `im:resource` 等权限
- Ledger：`HOST/PORT`；可选 R2（见本项目 README）
- Bridge：ledger base URL、幂等策略（message_id 作为唯一键）

## 风险 / 常见坑
- **图片体积**：base64 很容易超 12MB；必须做 M1.1
- **幂等**：飞书事件可能重放；message_id 去重不可少
- **访问控制**：上云后必须加最小权限，否则等同公开你的饮食/健康数据
