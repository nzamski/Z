// Syntax highlighting for code blocks (lib/markdown.ts's `highlight`): highlight.js core with
// the languages people here write, bundled (air-gapped: nothing loads at runtime). A fence's
// language wins (```python); a block without one is guessed among
// these, and left plain when no guess is confident. Colors: `.hljs-*` in globals.css.
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const LANGS = {
  bash,
  css,
  dockerfile,
  go,
  java,
  javascript,
  json,
  python,
  sql,
  typescript,
  xml,
  yaml,
};
/** The composer's language picker for a code block: [fence name, label]. */
export const CODE_LANGUAGES: [string, string][] = [
  ["python", "Python"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["sql", "SQL"],
  ["bash", "Bash"],
  ["yaml", "YAML"],
  ["json", "JSON"],
  ["go", "Go"],
  ["java", "Java"],
  ["dockerfile", "Dockerfile"],
  ["xml", "HTML / XML"],
  ["css", "CSS"],
];

for (const [name, lang] of Object.entries(LANGS)) hljs.registerLanguage(name, lang);

// A guess counts when it scores at least this (highlight.js relevance; short snippets score 3-6)
// and beats the runner-up: a tie (TypeScript vs CSS on one line) is left plain, not miscolored.
const GUESS_MIN = 3;

/** Highlighted HTML (escaped, only <span class="hljs-…">), or "" to leave the block plain. */
export function highlightCode(code: string, lang: string): string {
  const named = lang && hljs.getLanguage(lang) ? lang : null;
  if (named) return hljs.highlight(code, { language: named, ignoreIllegals: true }).value;
  if (lang) return ""; // a language we don't have: plain, not a wrong guess
  const r = hljs.highlightAuto(code, Object.keys(LANGS));
  const sure = r.relevance >= GUESS_MIN && r.relevance > (r.secondBest?.relevance ?? 0);
  return sure ? r.value : "";
}
