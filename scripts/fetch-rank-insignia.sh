#!/bin/sh
# Downloads the official IDF rank insignia from Wikimedia Commons into public/ranks/<arm>/
# (ground forces, air force, navy: they differ), named by rank key (lib/service-info.ts RANKS).
# Run once on a connected machine; the files are committed, so the air-gapped network never
# fetches them. Sources and licenses: public/ranks/ATTRIBUTION.md. טוראי has no insignia.
set -eu
cd "$(dirname "$0")/../public/ranks"
mkdir -p ground air navy
U=https://upload.wikimedia.org/wikipedia/commons
# Skips files already here; pauses and retries, since Commons throttles bursts of downloads and
# anonymous clients (its User-Agent policy wants a URL or contact).
while read -r key path; do
  [ -s "$key" ] && continue
  curl -sSfL --retry 3 --retry-delay 30 --retry-all-errors \
    -A "Z-rank-insignia/1.0 (https://github.com/nzamski/Z)" \
    -o "$key" "$U/$path" || { echo "failed: $key (run again later)" >&2; rm -f "$key"; exit 1; }
  echo "$key"
  sleep 5
done <<'EOF'
ground/corporal.svg 7/71/IDF_Ranks_Rav_turai.svg
ground/sergeant.svg 8/85/IDF_Ranks_Samal.svg
ground/staff_sergeant.svg 4/4c/IDF_Ranks_Samar.svg
ground/sergeant_first_class.png 9/9c/IDF-NCO-GF-1.png
ground/master_sergeant.png 9/98/IDF-NCO-GF-2.png
ground/sergeant_major.png 9/9d/IDF-NCO-GF-3.png
ground/warrant_officer.png f/f7/IDF-NCO-GF-4.png
ground/chief_warrant_officer.png 8/87/IDF-NCO-GF-6.png
ground/second_lieutenant.svg 5/5e/IDF_segen_mishne.svg
ground/lieutenant.svg d/df/IDF_segen.svg
ground/captain.svg 6/69/IDF_seren.svg
ground/major.svg 1/18/IDF_rav_seren.svg
ground/lieutenant_colonel.svg 4/4f/IDF_sgan_aluf.svg
ground/colonel.svg e/e7/IDF_aluf_mishne.svg
ground/brigadier_general.svg c/c1/IDF_tat_aluf.svg
ground/major_general.svg c/cd/IDF_aluf.svg
ground/lieutenant_general.svg 5/59/IDF_rav_aluf.svg
air/corporal.png 0/06/IDF-Enlisted-IAF-2.png
air/sergeant.png 2/2e/IDF-Enlisted-IAF-3.png
air/staff_sergeant.png 4/49/IDF-Enlisted-IAF-4.png
air/sergeant_first_class.png 2/2c/IDF-NCO-IAF-1.png
air/master_sergeant.png 1/1b/IDF-NCO-IAF-2.png
air/sergeant_major.png f/f6/IDF-NCO-IAF-3.png
air/warrant_officer.png f/fd/IDF-NCO-IAF-4.png
air/chief_warrant_officer.png a/a7/IDF-NCO-IAF-6.png
air/second_lieutenant.svg 3/30/IAF_segen_mishne.svg
air/lieutenant.svg e/e4/IAF_segen.svg
air/captain.svg e/e8/IAF_seren.svg
air/major.svg b/bd/IDF_rav_seren_silver-2.svg
air/lieutenant_colonel.svg 5/50/IAF_sgan_aluf.svg
air/colonel.svg 9/91/IAF_aluf_mishne.svg
air/brigadier_general.svg a/af/IAF_tat_aluf.svg
air/major_general.svg 1/1a/IAF_aluf.svg
air/lieutenant_general.svg 7/7c/IAF_rav_aluf.svg
navy/corporal.png b/be/IDF-Enlisted-Navy-2.png
navy/sergeant.png 8/89/IDF-Enlisted-Navy-3.png
navy/staff_sergeant.png e/ed/IDF-Enlisted-Navy-4.png
navy/sergeant_first_class.png 9/97/IDF-NCO-IN-1.png
navy/master_sergeant.png 7/7c/IDF-NCO-IN-2.png
navy/sergeant_major.png c/c1/IDF-NCO-IN-3.png
navy/warrant_officer.png 3/30/IDF-NCO-IN-4.png
navy/chief_warrant_officer.png 0/0f/IDF-NCO-IN-6.png
navy/second_lieutenant.svg e/ec/IDF_Navy_segen_mishne.svg
navy/lieutenant.png 5/55/IDF_Navy_segen.png
navy/captain.png b/ba/IDF_Navy_seren.png
navy/major.svg 8/8e/IDF_rav_seren_gold-2.svg
navy/lieutenant_colonel.png e/eb/IDF_Navy_sgan_aluf.png
navy/colonel.png 8/8c/IDF_Navy_aluf_mishne.png
navy/brigadier_general.png b/b0/IDF_Navy_tat_aluf.png
navy/major_general.png 2/28/IDF_Navy_aluf.png
navy/lieutenant_general.png 8/85/IDF_Navy_Rav_Aluf_Prediction.png
EOF
# Shown only through <img>, where SVG scripts never run; still, refuse any that carry one.
if grep -l "<script\|javascript:" ./*/*.svg; then echo "an SVG contains script: not using it" >&2; exit 1; fi
