// Builds a single self-contained preview.html (demo mode, no server needed).
// Usage: npm run preview:build  ->  preview-dist/preview.html
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "preview-dist");
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(root, "preview/entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  jsx: "automatic",
  target: "es2020",
  outdir: out,
  entryNames: "bundle",
  alias: { "@": root },
  loader: { ".woff2": "dataurl", ".woff": "dataurl" },
  define: { "process.env.NODE_ENV": '"production"', "process.env.ANTHROPIC_MODEL": "undefined" },
  logLevel: "warning",
});

const js = readFileSync(join(out, "bundle.js"), "utf8").replace(/<\/script/gi, "<\\/script");
const css = readFileSync(join(out, "bundle.css"), "utf8");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Roamwise</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;
writeFileSync(join(out, "preview.html"), html);

// Same page without the document wrapper, for hosts that add their own (e.g. a claude.ai artifact).
const fragment = `<title>Roamwise</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync(join(out, "roamwise-preview.html"), fragment);
console.log(`preview.html written (${Math.round(html.length / 1024)} KB)`);
