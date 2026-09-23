#!/bin/bash
# 2026-09-23 午餐落盘脚本（在用户 Mac 上执行）
# 对应 issue: EOMZON/nutrition-ledger-mvp#33
# 前置: cd /Users/zon/Desktop/MINE/html/nutrition-ledger-mvp && npm start
#       (server 监听 http://127.0.0.1:8789)
# 用法: bash 营养午餐落盘-2026-09-23.sh <营养标签照片路径> <订单截图路径>
set -euo pipefail

BASE="${LEDGER_BASE:-http://127.0.0.1:8789}"
LABEL_PHOTO="${1:?请传入营养标签照片路径}"
RECEIPT_PHOTO="${2:?请传入订单截图路径}"

echo "== 检查 server =="
curl -sf "$BASE/api/today?date=2026-09-23" > /dev/null || { echo "server 未响应，请先 npm start"; exit 1; }

mkimg() { # $1=原图 $2=最大边 -> base64 dataURL
  local tmp="/tmp/nutrition-$(basename "$1")-$2.jpg"
  sips -Z "$2" "$1" --out "$tmp" > /dev/null
  python3 -c "import base64,sys; print('data:image/jpeg;base64,'+base64.b64encode(open(sys.argv[1],'rb').read()).decode())" "$tmp"
}
sha() { shasum -a 256 "$1" | awk '{print $1}'; }

echo "== 1/7 evidence: 营养标签 =="
EVID_LABEL=$(curl -sf -X POST "$BASE/api/evidence" -H 'Content-Type: application/json' -d "$(python3 - "$LABEL_PHOTO" <<'EOF'
import json,sys,base64,subprocess,hashlib
p=sys.argv[1]
def mkimg(maxside):
    out="/tmp/nl-label-%d.jpg"%maxside
    subprocess.run(["sips","-Z",str(maxside),p,"--out",out],check=True,capture_output=True)
    return "data:image/jpeg;base64,"+base64.b64encode(open(out,'rb').read()).decode()
sha=hashlib.sha256(open(p,'rb').read()).hexdigest()
print(json.dumps({"kind":"label","preview":mkimg(800),"thumb":mkimg(200),
 "ocrText":"能量 583kJ（NRV 7%）、蛋白质 2.4g（4%）、脂肪 7.3g（12%）、碳水化合物 16.0g（5%）、钠 422mg（21%），每100g",
 "note":"盒马工坊 川味红油牛筋面 营养成分表（商品参数截图），sha256="+sha}))
EOF
)" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "label evidence id: $EVID_LABEL"

echo "== 2/7 evidence: 订单截图 =="
EVID_RECEIPT=$(curl -sf -X POST "$BASE/api/evidence" -H 'Content-Type: application/json' -d "$(python3 - "$RECEIPT_PHOTO" <<'EOF'
import json,sys,base64,subprocess,hashlib
p=sys.argv[1]
def mkimg(maxside):
    out="/tmp/nl-receipt-%d.jpg"%maxside
    subprocess.run(["sips","-Z",str(maxside),p,"--out",out],check=True,capture_output=True)
    return "data:image/jpeg;base64,"+base64.b64encode(open(out,'rb').read()).decode()
sha=hashlib.sha256(open(p,'rb').read()).hexdigest()
print(json.dumps({"kind":"receipt","preview":mkimg(800),"thumb":mkimg(200),"ocrText":"",
 "note":"盒马订单截图：川味红油牛筋面 370g×1盒、炸鸡 1只（实吃约1/3只），sha256="+sha}))
EOF
)" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "receipt evidence id: $EVID_RECEIPT"

echo "== 3/7 foods =="
FOOD_NJM=$(curl -sf -X POST "$BASE/api/foods" -H 'Content-Type: application/json' \
  -d '{"label":"盒马工坊 川味红油牛筋面","brand":"盒马工坊","kind":"packaged"}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('food',d).get('id'))")
FOOD_ZJ=$(curl -sf -X POST "$BASE/api/foods" -H 'Content-Type: application/json' \
  -d '{"label":"盒马 炸鸡","brand":"盒马工坊","kind":"deli"}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('food',d).get('id'))")
FOOD_JUZI=$(curl -sf -X POST "$BASE/api/foods" -H 'Content-Type: application/json' \
  -d '{"label":"小橘子","kind":"fruit"}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('food',d).get('id'))")
echo "foods: $FOOD_NJM $FOOD_ZJ $FOOD_JUZI"

echo "== 4/7 observations: 牛筋面 per-100g（标签） =="
curl -sf -X POST "$BASE/api/observations/batch" -H 'Content-Type: application/json' -d "{
  \"observations\": [
    {\"foodId\":\"$FOOD_NJM\",\"nutrientId\":\"energy_kj\",\"value\":\"583\",\"unit\":\"kJ\",\"basis\":{\"kind\":\"per-100g\"},\"method\":\"label\",\"source\":\"product-label\",\"evidenceId\":\"$EVID_LABEL\",\"note\":\"NRV 7%\"},
    {\"foodId\":\"$FOOD_NJM\",\"nutrientId\":\"protein_g\",\"value\":\"2.4\",\"unit\":\"g\",\"basis\":{\"kind\":\"per-100g\"},\"method\":\"label\",\"source\":\"product-label\",\"evidenceId\":\"$EVID_LABEL\",\"note\":\"NRV 4%\"},
    {\"foodId\":\"$FOOD_NJM\",\"nutrientId\":\"fat_g\",\"value\":\"7.3\",\"unit\":\"g\",\"basis\":{\"kind\":\"per-100g\"},\"method\":\"label\",\"source\":\"product-label\",\"evidenceId\":\"$EVID_LABEL\",\"note\":\"NRV 12%\"},
    {\"foodId\":\"$FOOD_NJM\",\"nutrientId\":\"carb_g\",\"value\":\"16.0\",\"unit\":\"g\",\"basis\":{\"kind\":\"per-100g\"},\"method\":\"label\",\"source\":\"product-label\",\"evidenceId\":\"$EVID_LABEL\",\"note\":\"NRV 5%\"},
    {\"foodId\":\"$FOOD_NJM\",\"nutrientId\":\"sodium_mg\",\"value\":\"422\",\"unit\":\"mg\",\"basis\":{\"kind\":\"per-100g\"},\"method\":\"label\",\"source\":\"product-label\",\"evidenceId\":\"$EVID_LABEL\",\"note\":\"NRV 21%\"}
  ]}" > /dev/null
echo ok

echo "== 5/7 observation: 炸鸡（估算区间） =="
curl -sf -X POST "$BASE/api/observations" -H 'Content-Type: application/json' -d "{
  \"foodId\":\"$FOOD_ZJ\",\"nutrientId\":\"energy_kcal\",\"value\":\"260~510\",\"unit\":\"kcal\",
  \"basis\":{\"kind\":\"per-serving\",\"serving\":\"1/3只\"},\"method\":\"estimate\",\"source\":\"main-chat\",
  \"evidenceId\":\"$EVID_RECEIPT\",\"note\":\"1/3只估算区间，无标签；主对话 2026-09-23 记录\"}" > /dev/null
echo ok

echo "== 6/7 observation: 小橘子（估算） =="
curl -sf -X POST "$BASE/api/observations" -H 'Content-Type: application/json' -d "{
  \"foodId\":\"$FOOD_JUZI\",\"nutrientId\":\"energy_kcal\",\"value\":\"45\",\"unit\":\"kcal\",
  \"basis\":{\"kind\":\"per-serving\",\"serving\":\"1个\"},\"method\":\"estimate\",\"source\":\"main-chat\",
  \"note\":\"小橘子 1 个；主对话 2026-09-23 记录\"}" > /dev/null
echo ok

echo "== 7/7 intakes: 2026-09-23 午餐 =="
curl -sf -X POST "$BASE/api/intakes" -H 'Content-Type: application/json' -d "{
  \"foodId\":\"$FOOD_NJM\",\"localDate\":\"2026-09-23\",\"amount\":\"370\",\"basis\":{\"kind\":\"per-100g\"},\"note\":\"午餐：牛筋面 370g（整盒）\"}" > /dev/null
curl -sf -X POST "$BASE/api/intakes" -H 'Content-Type: application/json' -d "{
  \"foodId\":\"$FOOD_ZJ\",\"localDate\":\"2026-09-23\",\"amount\":\"1/3只\",\"basis\":{\"kind\":\"per-serving\"},\"note\":\"午餐：炸鸡约 1/3 只\"}" > /dev/null
curl -sf -X POST "$BASE/api/intakes" -H 'Content-Type: application/json' -d "{
  \"foodId\":\"$FOOD_JUZI\",\"localDate\":\"2026-09-23\",\"amount\":\"1个\",\"basis\":{\"kind\":\"per-serving\"},\"note\":\"午餐：小橘子 1 个\"}" > /dev/null
echo ok

echo "== 验证 Today =="
curl -sf "$BASE/api/today?date=2026-09-23" | python3 -m json.tool | head -40
echo "== 完成：请在 #33 评论落盘结果 =="
