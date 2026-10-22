#!/bin/sh
# Build the z-app image for OpenShift (linux/amd64) and package it for offline transfer
# (docs/deploy.md). Run on a connected machine with docker (or podman) and skopeo.
#
# Output in dist/:
#   z-app-<tag>.oci.tar          OCI archive (skopeo copy oci-archive:... to the internal registry)
#   z-app-<tag>.manifest.txt     tag, image digest, git commit, SHA-256 of the archive
#   z-app-<tag>.sha256           checksum file (`shasum -a 256 -c`)
#   z-app-<tag>.sbom.spdx.json   SBOM, if syft is installed
set -eu

TAG=${TAG:-$(git rev-parse --short HEAD)$(git diff --quiet HEAD || echo -dirty)}
PLATFORM=${PLATFORM:-linux/amd64}
ENGINE=${ENGINE:-docker}
IMAGE="z-app:$TAG"
OUT=dist
NAME="z-app-$TAG"

command -v skopeo >/dev/null || { echo "skopeo is required (brew install skopeo)"; exit 1; }
mkdir -p "$OUT"

echo "==> building $IMAGE for $PLATFORM"
$ENGINE build --platform "$PLATFORM" ${NODE_IMAGE:+--build-arg NODE_IMAGE="$NODE_IMAGE"} -t "$IMAGE" .

echo "==> exporting $OUT/$NAME.oci.tar"
rm -f "$OUT/$NAME.oci.tar"
if [ "$ENGINE" = podman ]; then SRC="containers-storage:localhost/$IMAGE"; else SRC="docker-daemon:$IMAGE"; fi
skopeo copy "$SRC" "oci-archive:$OUT/$NAME.oci.tar:z/z-app:$TAG"

DIGEST=$(skopeo inspect --format '{{.Digest}}' "oci-archive:$OUT/$NAME.oci.tar")
(cd "$OUT" && shasum -a 256 "$NAME.oci.tar" > "$NAME.sha256")
cat > "$OUT/$NAME.manifest.txt" <<MANIFEST
image:     z/z-app:$TAG
platform:  $PLATFORM
digest:    $DIGEST
commit:    $(git rev-parse HEAD)
built:     $(date -u +%Y-%m-%dT%H:%M:%SZ)
sha256:    $(cut -d' ' -f1 "$OUT/$NAME.sha256")  $NAME.oci.tar
MANIFEST

if command -v syft >/dev/null; then
  syft "oci-archive:$OUT/$NAME.oci.tar" -o spdx-json > "$OUT/$NAME.sbom.spdx.json"
else
  echo "==> syft not installed: no SBOM (brew install syft)"
fi

echo "==> done"; cat "$OUT/$NAME.manifest.txt"
