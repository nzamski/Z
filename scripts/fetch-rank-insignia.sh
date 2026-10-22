#!/bin/sh
# Downloads the official IDF rank insignia (ground forces) from Wikimedia Commons into
# public/ranks/, named by rank key (lib/service-info.ts RANKS). Run once on a connected machine;
# the files are committed, so the air-gapped network never fetches them. Sources and licenses:
# public/ranks/ATTRIBUTION.md. טוראי has no insignia.
set -eu
cd "$(dirname "$0")/../public/ranks"
U=https://upload.wikimedia.org/wikipedia/commons
while read -r key path; do
  curl -sfL -A "Z-dev/1.0 (rank insignia)" -o "$key" "$U/$path"
  echo "$key"
done <<'EOF'
corporal.svg 7/71/IDF_Ranks_Rav_turai.svg
sergeant.svg 8/85/IDF_Ranks_Samal.svg
staff_sergeant.svg 4/4c/IDF_Ranks_Samar.svg
sergeant_first_class.png 9/9c/IDF-NCO-GF-1.png
master_sergeant.png 9/98/IDF-NCO-GF-2.png
sergeant_major.png 9/9d/IDF-NCO-GF-3.png
warrant_officer.png f/f7/IDF-NCO-GF-4.png
chief_warrant_officer.png 8/87/IDF-NCO-GF-6.png
second_lieutenant.svg 5/5e/IDF_segen_mishne.svg
lieutenant.svg d/df/IDF_segen.svg
captain.svg 6/69/IDF_seren.svg
major.svg 1/18/IDF_rav_seren.svg
lieutenant_colonel.svg 4/4f/IDF_sgan_aluf.svg
colonel.svg e/e7/IDF_aluf_mishne.svg
brigadier_general.svg c/c1/IDF_tat_aluf.svg
major_general.svg c/cd/IDF_aluf.svg
lieutenant_general.svg 5/59/IDF_rav_aluf.svg
EOF
# Shown only through <img>, where SVG scripts never run; still, refuse any that carry one.
if grep -l "<script\|javascript:" ./*.svg; then echo "an SVG contains script: not using it" >&2; exit 1; fi
