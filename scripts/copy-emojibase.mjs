// The emoji picker's data (frimousse reads <url>/<locale>/data.json and messages.json) is served
// by Z itself, not a CDN (air-gapped): copied from the emojibase-data package into public/ before
// dev and build. Not committed (.gitignore).
import { copyFileSync, mkdirSync } from "node:fs";

const out = "public/emojibase/en";
mkdirSync(out, { recursive: true });
for (const f of ["data.json", "messages.json"])
  copyFileSync(`node_modules/emojibase-data/en/${f}`, `${out}/${f}`);
