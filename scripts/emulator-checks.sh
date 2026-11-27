#!/usr/bin/env bash
# The #202 emulator pass: Maestro flows in .maestro/review/ on a booted Android emulator,
# once per device setting. Screenshots land in $OUT; a summary is written to $OUT/summary.md.
# A failing flow is recorded and the run carries on; the script fails at the end if any did.
set -u
OUT=${OUT:-emulator-results}
mkdir -p "$OUT"
export APP_ID=${APP_ID:-uk.co.dailynoodle.app}
FAILED=0
: > "$OUT/summary.md"

flow() { # name file [env...]
  local name=$1 file=$2; shift 2
  local args=(-e "APP_ID=$APP_ID")
  for e in "$@"; do args+=(-e "$e"); done
  if maestro test "${args[@]}" --test-output-dir "$OUT/$name" "$file" > "$OUT/$name.log" 2>&1; then
    echo "- ✅ $name" >> "$OUT/summary.md"
  else
    echo "- ❌ $name (see $name.log)" >> "$OUT/summary.md"
    echo "::group::$name failed"; tail -40 "$OUT/$name.log"; echo "::endgroup::"
    FAILED=1
  fi
  # Maestro writes screenshots to the working directory.
  mkdir -p "$OUT/$name"; mv ./*.png "$OUT/$name/" 2>/dev/null || true
}

reset() {
  adb shell settings put system font_scale 1.0
  adb shell wm size reset; adb shell wm density reset
  adb shell cmd uimode night no
  for k in window_animation_scale transition_animation_scale animator_duration_scale; do
    adb shell settings put global $k 1
  done
}

reset
# Smoke: open the app by hand, then print what's on screen and any JavaScript or crash
# lines, so a run whose flows all fail still says why (the screenshots need the artifact).
echo "::group::Smoke: launch and screen"
adb logcat -c
adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleep 25
adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 && adb shell cat /sdcard/ui.xml \
  | tr '>' '\n' | grep -o 'text="[^"]*"\|resource-id="[^"]*"\|content-desc="[^"]*"' | grep -v '=""' | head -60
echo "--- logcat (JS, errors, crashes)"
adb logcat -d | grep -E "ReactNativeJS|AndroidRuntime|FATAL|expo|E/unknown" | tail -60
echo "::endgroup::"
adb shell am force-stop "$APP_ID"

flow back .maestro/review/back.yaml
flow borders-round .maestro/review/borders-round.yaml
flow resume .maestro/review/resume.yaml
flow screens-normal .maestro/review/screens.yaml SET=normal

adb shell cmd uimode night yes
flow screens-dark .maestro/review/screens.yaml SET=dark
flow borders-round-dark .maestro/review/borders-round.yaml
reset

adb shell settings put system font_scale 2.0
flow screens-text2 .maestro/review/screens.yaml SET=text2
reset

# About an iPhone SE's 320 × 568 pt: 720 × 1280 px at 360 dpi is 320 × 569 dp.
adb shell wm size 720x1280; adb shell wm density 360
flow screens-small .maestro/review/screens.yaml SET=small
reset

for k in window_animation_scale transition_animation_scale animator_duration_scale; do
  adb shell settings put global $k 0
done
flow screens-reduced-motion .maestro/review/screens.yaml SET=reduced
reset

echo "" >> "$OUT/summary.md"
echo "Screenshots per run are in the artifact; flows in .maestro/review/." >> "$OUT/summary.md"
cat "$OUT/summary.md"
exit $FAILED
