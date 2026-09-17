# 2026-09-17 Nutrition 本机 Worktree / 真数据 / Dogfood 唯一 Handoff

> 这是当前 Nutrition 本机执行唯一入口。远端 AI / 本机目标模式不要从旧 PR #1、旧 reconciliation branch 或聊天记忆重建路线。

## 0. 先读这些权威入口

业务 P1：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/10

远端验证回执：
https://github.com/EOMZON/nutrition-ledger-mvp/blob/feat/nutrition-today-daily-p1-20260917/docs/verification/2026-09-17-today-p1-remote-verification.md

Git governance：
https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md

Worktree audit：
https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/SKILL.md

真实 data / release gate：
https://github.com/EOMZON/creationos-os/issues/59

历史 nutrition evidence：
https://github.com/EOMZON/creationos-os/issues/55

---

## 1. 当前远端状态

P1 task branch：

```text
feat/nutrition-today-daily-p1-20260917
```

已经完整通过远端验证的业务 SHA：

```text
2f3e496c52a3e76f1c5f5b0d5f77b9b2b3b38035
```

随后只增加了本 verification/handoff 文档；因此本机执行时**不要写死旧 SHA**，必须 live readback 当前 `origin/test` / task ref。

P1 远端技术 gate 已通过，但本地 consumer / real data / dogfood 仍未验证。

---

# 2. Worktree Audit：先只读，再治理

历史仓库路径曾为：

```text
/Users/zon/Desktop/MINE/html/nutrition-ledger-mvp
```

不要假设它仍是 canonical。先检查：

```bash
EXPECTED=/Users/zon/Desktop/MINE/html/nutrition-ledger-mvp
SKILL=/Users/zon/.codex/skills/worktree-audit

if [ -d "$EXPECTED/.git" ] || git -C "$EXPECTED" rev-parse --git-dir >/dev/null 2>&1; then
  REPO="$EXPECTED"
else
  python3 "$SKILL/scripts/inspect_folder.py" \
    --root /Users/zon/Desktop/MINE/html \
    --disk-usage
  echo "先从输出确认 nutrition-ledger-mvp 的真实路径，再继续；不要猜路径。"
  exit 2
fi

git -C "$REPO" rev-parse --show-toplevel
git -C "$REPO" rev-parse --git-common-dir
git -C "$REPO" status --short --branch
git -C "$REPO" worktree list --porcelain
git -C "$REPO" remote -v

git -C "$REPO" ls-remote --symref origin HEAD
git -C "$REPO" ls-remote origin \
  refs/heads/main \
  refs/heads/test \
  refs/heads/feat/nutrition-today-daily-p1-20260917

python3 "$SKILL/scripts/audit_worktrees.py" \
  --repo "$REPO" \
  --remote
```

## 2.1 必须先记录的事实

至少保存：

```text
canonical checkout path
common-dir
每个 worktree path / branch / HEAD
staged / unstaged / untracked
ignored 中是否存在唯一私人 data/assets
active writer / 本机进程是否依赖某 worktree
origin/main exact SHA
origin/test exact SHA
P1 task exact SHA
```

如果任意 worktree 有 dirty / unique ignored assets / active process：

**不要删除。**

禁止：

```text
git reset --hard
git clean
automatic stash
git branch -D
force-push
盲删 .git/worktrees/*
```

---

# 3. Merge Reconciliation：不要把 PR merged 当完成

当 P1 已经合入远端 `test` 后，从 live ref 读取：

```bash
TEST_SHA="$(git -C "$REPO" ls-remote origin refs/heads/test | awk '{print $1}')"
TASK_SHA="$(git -C "$REPO" ls-remote origin refs/heads/feat/nutrition-today-daily-p1-20260917 | awk '{print $1}')"

printf 'origin/test=%s\n' "$TEST_SHA"
printf 'origin/task=%s\n' "$TASK_SHA"
```

生成 delivery manifest（输出放 `/tmp`，不污染业务 Git）：

```bash
python3 "$SKILL/scripts/build_delivery_manifest.py" \
  --repo "$REPO" \
  --source origin/feat/nutrition-today-daily-p1-20260917 \
  --target origin/test \
  --required-file p1-server.mjs \
  --required-file index-p1.html \
  --required-file src/application/daily-experience.mjs \
  --required-file src/domain/intake-history.mjs \
  --required-file tests/p1.spec.js \
  --required-file tests/p1-visual.spec.js \
  --required-symbol 'src/application/daily-experience.mjs::buildDailyExperience' \
  --required-symbol 'src/application/daily-experience.mjs::repeatDailyIntake' \
  --required-symbol 'src/application/daily-experience.mjs::confirmBarcodeCandidate' \
  --consumer-type checkout \
  --consumer-locator "$REPO" \
  --output /tmp/nutrition-p1-delivery-manifest.json
```

在 target exact SHA 验证完成后才能执行：

```bash
python3 "$SKILL/scripts/reconcile_delivery.py" \
  --manifest /tmp/nutrition-p1-delivery-manifest.json \
  --verified-target-sha "$TEST_SHA" \
  --verification-status pass \
  --workspace-state clear \
  --unique-asset-state clear \
  --active-writer no \
  --branch-disposition remove-after-readback \
  --branch-disposition-owner zon
```

如果输出：

```text
PARTIAL_MISSING
CONFLICT_UNRESOLVED
TARGET_MOVED_REVERIFY_REQUIRED
CONSUMER_STALE
```

任何一个状态，都**禁止退出 source worktree/local branch**。

---

# 4. Post-Merge Synchronization Gate

如果本机 canonical checkout 需要消费 P1：

```bash
python3 "$SKILL/scripts/post_merge_sync_gate.py" \
  --repo "$REPO" \
  --sync-ref main=refs/heads/main \
  --sync-ref test=refs/heads/test \
  --verified-ref-sha main="$(git -C "$REPO" ls-remote origin refs/heads/main | awk '{print $1}')" \
  --verified-ref-sha test="$TEST_SHA" \
  --target-name test \
  --canonical-checkout "$REPO" \
  --candidate-readback-state complete \
  --fail-on-blocked
```

注意：Nutrition 当前允许 `test` ahead of `main`。不要为了让两个长期 ref 相等而擅自把 `test → main`；`main` 发布有单独 release gate。

---

# 5. 本地 Worktree / Branch 减量规则

目标形态优先：

```text
1 个 canonical checkout
+ 0 个已经交付完毕的临时 worktree
```

但数量目标不能覆盖证据门。

## 允许退出的最小条件

每个待退出 worktree 必须同时满足：

- source 成果已真实远端保存；
- 已进入 `test` 或明确 `SUPERSEDED_WITH_EVIDENCE`；
- target exact SHA 已验证；
- semantic reconciliation 无 missing；
- canonical consumer 状态明确；
- staged / unstaged / untracked 清楚；
- ignored unique asset 有目的地；
- 无活跃 writer / process 依赖；
- 有远端 ref 可以异机恢复。

满足后才可使用正常退出：

```bash
git -C "$REPO" worktree remove <eligible-worktree-path>
git -C "$REPO" branch -d <eligible-local-branch>
```

**只用 `-d`，不要 `-D`。**

本批用户授权的是本地 worktree / local branch 减量，**不授权因为“本地少一点”而删除远端 ref**。

以下远端 verification refs 即便未来可以归档，也应由远端治理单独决定，不影响本地空间：

```text
codex/nutrition-p1-ci-verify-20260917
codex/nutrition-p1-ci-verify2-20260917
codex/nutrition-p1-ci-verify3-20260917
codex/nutrition-p1-ci-verify4-20260917
```

不要为了空间在本机保留它们的 worktree。

---

# 6. 真实私人 Nutrition data 只读 audit

只有确认真实数据目录后运行。

默认项目目录可能是：

```text
$REPO/data
```

但必须先确认它确实是用户当前 Nutrition ledger，不要猜。

```bash
DATA_DIR="$REPO/data"

find "$DATA_DIR" -maxdepth 2 -type f -print 2>/dev/null | sed -n '1,80p'

# 只读 audit，不把内容贴到公开 Issue
NUTRITION_LEDGER_DATA_DIR="$DATA_DIR" npm --prefix "$REPO" run audit:data
```

远端只允许回写脱敏摘要：

```text
observedAt
repo/test SHA
Data directory identity（可脱敏）
foods count
observations count
intakeRecords count
intakeEntries count
issue codes
ok=true/false
```

禁止公开：

- 食物明细；
- 健康/饮食私人正文；
- evidence 图片；
- env/token/cookie。

如果 audit 失败：先备份；**不要自动重写 ledger。**

回写：
https://github.com/EOMZON/creationos-os/issues/59

---

# 7. 真实 1-day dogfood

前置：

```text
current local consumer = verified test SHA
real data audit completed or issues explicitly understood
no active competing writer
```

启动：

```bash
cd "$REPO"
npm ci
HOST=127.0.0.1 PORT=8789 npm start
```

浏览器：

```text
http://127.0.0.1:8789/
```

当天至少真实完成：

1. 一个已有食物快速记录；
2. 一次“最近吃过”一键重复；
3. 一个包装食品条码输入/确认；
4. 如果实际遇到照片/自制餐，才用 AI estimate；不要为了验收伪造真实饮食数据。

记录时间：

```text
known/repeat target <= 10s
ordinary first capture target <= 30s
```

只记录 elapsed seconds + friction reason，不把私人食物明细提交 GitHub。

发现问题按：

```text
friction
→ exact UI/action
→ expected
→ actual
→ evidence
→ minimal fix
```

开业务仓 Issue；不要重新扩展成菜谱/库存/AI coach。

---

# 8. 7-day dogfood Gate

连续 7 天使用同一 canonical ledger。

至少记录脱敏日统计：

```text
date
captureEvents
repeatEvents
barcodeEvents
aiEstimateEvents
medianSeconds
p90Seconds
manualCorrections
structuralRepairs
silentHistoricalChanges (must be 0)
```

目标：

- ≥80% 普通记录在首次配置后 ≤30s；
- repeat ≤10s；
- silent historical changes = 0；
- 每个 imported observation 有 source + method；
- export 可解释；
- <10% 记录需要结构性修复。

只有这一步通过，才讨论 `Nutrition Workbench` 命名、照片多模态增强、USDA 或更复杂产品能力。

---

# 9. `codex-memory-private` 历史证据（完全解耦，可并行）

不要在 Nutrition 业务 worktree 处理。

唯一入口：
https://github.com/EOMZON/creationos-os/issues/55

本机已记录路径：

```text
/Users/zon/Desktop/CreationOS/codex-memory-private
```

按 #55 定位真实 commit；如果 `659753d` 不存在，不伪造同 SHA。

---

# 10. Main / Production 暂停线

本 Handoff 不授权：

```text
test → main
Production deploy
stable domain alias change
SSO change
KV prefix change
真实私人 data cloud migration
```

未来 release 前必须先完成：

- real 1-day / preferably 7-day dogfood；
- #59 的真实 Vercel project context `npm run build:vercel`；
- provider/deployment readback；
- public alias / SSO protection recheck；
- rollback point。

---

# 11. 本机最终回执格式

完成后在 #59 / #10 只写脱敏证据：

```text
canonical checkout:
common-dir:
origin/main:
origin/test:
local HEAD:
worktree count before/after:
local branches retired:
local worktrees retired:
kept worktrees + reason:
reconciliation status:
consumer status:
real data audit ok/counts/issues:
1-day dogfood completed:
known/repeat elapsed:
ordinary capture elapsed:
remaining blocker:
```

如果本机没有真实执行，就必须写 `NOT_RUN`，不能从远端 CI 推断。
