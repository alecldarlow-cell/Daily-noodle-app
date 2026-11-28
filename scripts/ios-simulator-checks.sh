#!/usr/bin/env bash
# The #217 iOS pass: the #202 review flows in .maestro/review/ on iPhone simulators, once per
# setting, then the app's own links and the App Store screenshots. Needs $APP (the built
# simulator .app) and Maestro. Screenshots land in $OUT; a summary in $OUT/summary.md.
# A failing flow is recorded and the run carries on; the script fails at the end if any did.
set -u
OUT=${OUT:-ios-results}
mkdir -p "$OUT"
export APP_ID=${APP_ID:-uk.co.dailynoodle.app}
: "${APP:?set APP to the simulator .app}"
FAILED=0
: > "$OUT/summary.md"

# The newest iOS runtime, and the first device type on a list that the runner has.
RUNTIME=$(xcrun simctl list runtimes -j | node -e '
  const r = JSON.parse(require("fs").readFileSync(0)).runtimes
    .filter((x) => x.isAvailable && x.platform === "iOS");
  r.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
  console.log(r[r.length - 1].identifier);')
device_type() {
  xcrun simctl list devicetypes -j | node -e '
    const t = JSON.parse(require("fs").readFileSync(0)).devicetypes;
    for (const want of process.argv.slice(1)) {
      const d = t.find((x) => x.name === want);
      if (d) { console.log(d.identifier); process.exit(0); }
    }
    process.exit(1);' "$@"
}
# new_device <name> <device type names...>: prints the new simulator's UDID, or nothing.
new_device() {
  local name=$1 type
  shift
  type=$(device_type "$@") || return 0
  xcrun simctl create "$name" "$type" "$RUNTIME"
}
up() { # udid: boot, install, a tidy status bar (9:41, full battery) for screenshots
  xcrun simctl boot "$1"
  xcrun simctl bootstatus "$1" -b > /dev/null
  xcrun simctl install "$1" "$APP"
  xcrun simctl status_bar "$1" override --time 9:41 --dataNetwork wifi --wifiBars 3 \
    --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100 || true
}
down() { xcrun simctl shutdown "$1" || true; }

flow() { # udid name file [env...]
  local udid=$1 name=$2 file=$3
  shift 3
  local args=(-e "APP_ID=$APP_ID")
  for e in "$@"; do args+=(-e "$e"); done
  if maestro --device "$udid" test "${args[@]}" --test-output-dir "$OUT/$name" "$file" \
    > "$OUT/$name.log" 2>&1; then
    echo "- ✅ $name" >> "$OUT/summary.md"
  else
    echo "- ❌ $name (see $name.log)" >> "$OUT/summary.md"
    FAILED=1
  fi
  # Maestro writes screenshots to the working directory.
  mkdir -p "$OUT/$name"
  mv ./*.png "$OUT/$name/" 2>/dev/null || true
}

reset() { # udid
  xcrun simctl ui "$1" appearance light
  xcrun simctl ui "$1" content_size large
  xcrun simctl spawn "$1" defaults write com.apple.Accessibility ReduceMotionEnabled -bool false
}

# Main run: a 6.1-inch iPhone.
PHONE=$(new_device "Review iPhone" "iPhone 17 Pro" "iPhone 16 Pro" "iPhone 16" "iPhone 15 Pro")
echo "Runtime $RUNTIME" >> "$OUT/summary.md"
up "$PHONE"
reset "$PHONE"
flow "$PHONE" borders-round .maestro/review/borders-round.yaml
flow "$PHONE" resume .maestro/review/resume.yaml
flow "$PHONE" screens-normal .maestro/review/screens.yaml SET=normal
flow "$PHONE" links .maestro/review/links.yaml

xcrun simctl ui "$PHONE" appearance dark
flow "$PHONE" screens-dark .maestro/review/screens.yaml SET=dark
flow "$PHONE" borders-round-dark .maestro/review/borders-round.yaml
reset "$PHONE"

# The largest Dynamic Type size (an accessibility size, beyond the Settings slider).
xcrun simctl ui "$PHONE" content_size accessibility-extra-extra-extra-large
flow "$PHONE" screens-text-largest .maestro/review/screens.yaml SET=textmax
reset "$PHONE"

# Reduce Motion, set the way Settings does; the flow relaunches the app to read it.
xcrun simctl spawn "$PHONE" defaults write com.apple.Accessibility ReduceMotionEnabled -bool true
xcrun simctl spawn "$PHONE" notifyutil -p com.apple.accessibility.reduce.motion.status || true
flow "$PHONE" screens-reduced-motion .maestro/review/screens.yaml SET=reduced
reset "$PHONE"
down "$PHONE"

# Small screen: the 4.7-inch iPhone SE (375 × 667 pt), the smallest phone on iOS 26.
SMALL=$(new_device "Review SE" "iPhone SE (3rd generation)" "iPhone SE (2nd generation)")
if [ -n "$SMALL" ]; then
  up "$SMALL"
  flow "$SMALL" screens-small .maestro/review/screens.yaml SET=small
  down "$SMALL"
else
  echo "- ⚠️ screens-small skipped: no iPhone SE simulator on this runner" >> "$OUT/summary.md"
fi

# App Store screenshots: the 6.9-inch size App Store Connect asks for.
BIG=$(new_device "Store iPhone" "iPhone 17 Pro Max" "iPhone 16 Pro Max")
if [ -n "$BIG" ]; then
  up "$BIG"
  flow "$BIG" store-light .maestro/review/store-shots.yaml SET=light
  xcrun simctl ui "$BIG" appearance dark
  flow "$BIG" store-dark .maestro/review/store-shots.yaml SET=dark
  down "$BIG"
else
  echo "- ⚠️ store screenshots skipped: no 6.9-inch iPhone simulator on this runner" >> "$OUT/summary.md"
fi

{
  echo ""
  echo "Screenshots per run are in the artifact; flows in .maestro/review/."
  echo "Not covered on a simulator: haptics, the ring/silent switch, VoiceOver listening."
} >> "$OUT/summary.md"
cat "$OUT/summary.md"
exit $FAILED
