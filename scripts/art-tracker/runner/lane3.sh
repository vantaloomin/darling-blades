#!/usr/bin/env bash
# usage: lane3.sh <lane> <listfile> [promptdir]   list lines: id:mode:fig
# env: ART_DIR (required; art output folder outside the repo), ART_WORK (default $ART_DIR/work),
#      ART_PY (default python), ART_DIR_NATIVE (ART_DIR as the Codex CLI sees it; default ART_DIR)
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../../.." && pwd)"
: "${ART_DIR:?set ART_DIR to the art output folder}"
A="$ART_DIR"; AW="${ART_DIR_NATIVE:-$ART_DIR}"; P="${ART_WORK:-$ART_DIR/work}"; mkdir -p "$P"
PY="${ART_PY:-python}"; TSX="$REPO/node_modules/.bin/tsx"
HALT="$A/logs/HALT"; lane=$1; list=$2; PD=${3:-$P/prompts2}; ST="$A/logs/$lane.status"
fails=0
while IFS=: read -r id mode fig; do
  [ -z "$id" ] && continue
  [ -e "$HALT" ] && { echo "[$lane] HALT present, stopping before $id"; echo "halted" > "$ST"; exit 2; }
  [ -e "$A/out/$id.webp" ] && [ -z "$FORCE" ] && continue
  echo "gen $id" > "$ST"
  if [ ! -e "$A/raw/$id.raw.png" ]; then
    { printf 'Use your built-in image generation tool exactly once to generate one image from the image prompt below. Pass the prompt to the image tool verbatim, byte for byte: do not rewrite, shorten, summarise or add to it. Then copy the generated PNG, unmodified, to this exact path: %s/raw/%s.raw.png . Do not edit, crop, resize or retouch it, and do not check or reject it for its pixel dimensions. Reply with only the saved path. If image generation fails or any authentication error occurs, do not retry; reply with FAILED and the error.\n\nIMAGE PROMPT:\n' "$AW" "$id"; cat "$PD/$id.txt"; } > "$P/req-$id.txt"
    t0=$(date +%s)
    (cd "$A" && codex exec --skip-git-repo-check -s workspace-write -C "$A" - < "$P/req-$id.txt" > "$A/logs/$id.log" 2>&1); rc=$?
    if grep -v "^Use your built-in image generation" "$A/logs/$id.log" | grep -qiE "401 Unauthorized|unauthorized|token (has )?expired|refresh token|refresh_token|not logged in|codex login|authentication (failed|error)|invalid_grant|auth error"; then
      touch "$HALT"; echo "halted" > "$ST"; echo "[$lane] AUTH ERROR on $id (rc=$rc) - HALT"; exit 3; fi
    if [ ! -e "$A/raw/$id.raw.png" ]; then
      fails=$((fails+1)); echo "$id" >> "$A/logs/failed.txt"; echo "[$lane] FAILED $id rc=$rc"
      [ $fails -ge 3 ] && { echo "[$lane] 3 consecutive failures - stopping lane"; echo "stopped" > "$ST"; exit 4; }
      continue; fi
    fails=0
  fi
  fa=""; [ "$fig" = "1" ] && fa="--focal-frac 0.1"
  "$PY" "$REPO/scripts/smartcrop.py" "$A/raw/$id.raw.png" "$A/out/$id.tmp.png" 640 800 $mode $fa 2>/dev/null | tail -1 > "$A/logs/$id.crop.json"
  if "$TSX" "$HERE/post.ts" "$A/out/$id.tmp.png" "$A/out/$id.webp"; then rm -f "$A/out/$id.tmp.png"; echo "[$lane] DELIVERED $id"; else echo "[$lane] POSTFAIL $id"; echo "$id" >> "$A/logs/failed.txt"; fi
done < "$list"
echo "idle" > "$ST"; echo "[$lane] done"
