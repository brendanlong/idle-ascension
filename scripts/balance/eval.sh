#!/bin/bash
# usage: eval.sh params.json [env...]: runs the sim over 6 seeds with SIM_TUNE=params.json
# (use {} for the content as it is) and prints time, regressions and the longest gap
P="$(cat $1)"; shift
cd "$(dirname "$0")/../.."
for s in 1 2 3 4 5 6; do
  (env SIM_SEED=$s SIM_TUNE="$P" "$@" npx tsx scripts/sim.ts 40 2>&1 | grep -E "^Final|^Gaps" | tr '\n' ' ' | sed -E 's/Final: (.*) after ([^,]*), ([0-9]+) regressions.*longest ([^,]*),.*stuck regressions ([0-9]+) \(([0-9]+) futile\).*/\2  regressions \3 (stuck \5, futile \6)  longest gap \4/' ; echo) &
done; wait
