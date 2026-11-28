#!/usr/bin/env bash
# The #217 iPhone pass: the Maestro flows in .maestro/review/ on iPhone simulators, once per
# device setting, then the App Store screenshots (.maestro/store/). The iOS twin of
# emulator-checks.sh (#202). Screenshots land in $OUT; a summary is written to
# $OUT/summary.md. If the app doesn't open to Today, the run stops there with its crash
# report and log. Otherwise a failing flow is recorded and the run carries on; the script
# fails at the end if any did.
#
# Needs: macOS with Xcode 26.4+, Maestro, and the simulator build at $APP (a .app folder).
# Skipped on iOS: back.yaml (Android's Back key; iPhones have none).
set -u
OUT=${OUT:-ios-results}
APP=${APP:?set APP to the simulator .app}
mkdir -p "$OUT"
export APP_ID=${APP_ID:-uk.co.dailynoodle.app}
FAILED=0
: > "$OUT/summary.md"

# The newest iOS runtime, and the newest device it runs whose name matches a pattern
# (highest model number first: "iPhone 17 Pro Max" over "iPhone 11 Pro Max").
RUNTIMES=$(xcrun simctl list runtimes -j)
RUNTIME=$(python3 -c 'import json,sys; r=[x for x in json.load(sys.stdin)["runtimes"] if x.get("platform")=="iOS" and x["isAvailable"]]; r.sort(key=lambda x:[int(p) for p in x["version"].split(".")]); print(r[-1]["identifier"])' <<< "$RUNTIMES")
devtype() { # regex
  python3 -c '
import json, re, sys
rt = [x for x in json.load(sys.stdin)["runtimes"] if x["identifier"] == sys.argv[2]][0]
t = [d for d in rt.get("supportedDeviceTypes", []) if re.fullmatch(sys.argv[1], d["name"])]
t.sort(key=lambda d: [int(n) for n in re.findall(r"\d+", d["name"])])
print(t[-1]["identifier"] if t else "")' "$1" "$RUNTIME" <<< "$RUNTIMES"
}
BIG_TYPE=$(devtype 'iPhone \d+ Pro Max')
SMALL_TYPE=$(devtype 'iPhone SE.*')
SMALL_FALLBACK=$(devtype 'iPhone \d+e')
echo "Runtime $RUNTIME; big $BIG_TYPE; small ${SMALL_TYPE:-$SMALL_FALLBACK}; $(maestro --version 2>/dev/null | tail -1)" | tee -a "$OUT/summary.md"
echo "" >> "$OUT/summary.md"

UDID=""
boot() { # name devicetype
  [ -n "$UDID" ] && xcrun simctl shutdown "$UDID" > /dev/null 2>&1
  UDID=$(xcrun simctl create "$1" "$2" "$RUNTIME") || return 1
  xcrun simctl boot "$UDID"
  xcrun simctl bootstatus "$UDID" -b > /dev/null
  xcrun simctl install "$UDID" "$APP"
  # A tidy status bar for screenshots: the time, full battery and signal.
  xcrun simctl status_bar "$UDID" override --time 9:41 --batteryState charged \
    --batteryLevel 100 --wifiBars 3 --cellularMode active --cellularBars 4 > /dev/null 2>&1 || true
  echo "### $1 (${2##*.})" >> "$OUT/summary.md"
}

flow() { # name file [env...]
  local name=$1 file=$2; shift 2
  local args=(-e "APP_ID=$APP_ID")
  for e in "$@"; do args+=(-e "$e"); done
  if maestro --device "$UDID" test "${args[@]}" --test-output-dir "$OUT/$name" "$file" > "$OUT/$name.log" 2>&1; then
    echo "- ✅ $name" >> "$OUT/summary.md"
  else
    echo "- ❌ $name (see $name.log)" >> "$OUT/summary.md"
    FAILED=1
    # Into the run's log as well, so a failure can be read without the artifact.
    echo "::group::$name failed"; tail -60 "$OUT/$name.log"; echo "::endgroup::"
  fi
  # Maestro writes screenshots to the working directory.
  mkdir -p "$OUT/$name"; mv ./*.png "$OUT/$name/" 2>/dev/null || true
}

ui() { xcrun simctl ui "$UDID" "$@"; }

# Why the app stopped, if it did: its crash report and its last log lines.
why() {
  echo "::group::Crash report"
  local r
  r=$(ls -t ~/Library/Logs/DiagnosticReports/ 2>/dev/null | grep -i -m1 DailyNoodle)
  if [ -n "$r" ]; then head -120 ~/Library/Logs/DiagnosticReports/"$r"; cp ~/Library/Logs/DiagnosticReports/"$r" "$OUT/"; else echo "none"; fi
  echo "::endgroup::"
  echo "::group::App log (last 3 minutes)"
  xcrun simctl spawn "$UDID" log show --last 3m --style compact --predicate 'process == "DailyNoodle"' 2>/dev/null | tail -80
  echo "::endgroup::"
}

# 6.9-inch iPhone (the App Store's required screenshot size): checks, then the listing set.
boot pro-max "$BIG_TYPE"

# Gate: the app opens to Today. Without that nothing else can pass, so stop with the reasons.
xcrun simctl launch "$UDID" "$APP_ID" > /dev/null
sleep 25
xcrun simctl io "$UDID" screenshot "$OUT/launch-plain.png" > /dev/null 2>&1
if xcrun simctl spawn "$UDID" launchctl list | grep -q "UIKitApplication:$APP_ID"; then
  echo "- ✅ opens and stays open (25 s)" >> "$OUT/summary.md"
else
  echo "- ❌ stopped within 25 s of opening" >> "$OUT/summary.md"
  why
fi
xcrun simctl terminate "$UDID" "$APP_ID" > /dev/null 2>&1
flow launch .maestro/review/launch.yaml
if [ $FAILED = 1 ]; then
  why
  echo "" >> "$OUT/summary.md"
  echo "Stopped: the app did not reach Today, so the other flows were not run." >> "$OUT/summary.md"
  cat "$OUT/summary.md"
  exit 1
fi
flow resume .maestro/review/resume.yaml
flow borders-round .maestro/review/borders-round.yaml
flow links .maestro/review/links.yaml
flow screens-normal .maestro/review/screens.yaml SET=normal
flow store-light .maestro/store/app-store.yaml SET=light

ui appearance dark
flow screens-dark .maestro/review/screens.yaml SET=dark
flow borders-round-dark .maestro/review/borders-round.yaml
flow store-dark .maestro/store/app-store.yaml SET=dark
ui appearance light

# About twice the normal text size, as Android's font scale 2.0 (#202).
ui content_size accessibility-large
flow screens-text2 .maestro/review/screens.yaml SET=text2
ui content_size large

# Reduce Motion is read at start-up, so set it and restart the phone.
xcrun simctl spawn "$UDID" defaults write com.apple.Accessibility ReduceMotionEnabled -bool true
xcrun simctl shutdown "$UDID" && xcrun simctl boot "$UDID" && xcrun simctl bootstatus "$UDID" -b > /dev/null
flow screens-reduced-motion .maestro/review/screens.yaml SET=reduced
echo "" >> "$OUT/summary.md"

# The smallest screen current iOS runs on: an iPhone SE, 375 × 667 pt.
# If this runtime no longer runs the SE, the newest "e" model is the smallest left.
boot small "${SMALL_TYPE:-$SMALL_FALLBACK}"
flow screens-small .maestro/review/screens.yaml SET=small
xcrun simctl shutdown "$UDID" > /dev/null 2>&1

echo "" >> "$OUT/summary.md"
echo "Screenshots per run are in the artifact; flows in .maestro/review/ and .maestro/store/." >> "$OUT/summary.md"
cat "$OUT/summary.md"
exit $FAILED
