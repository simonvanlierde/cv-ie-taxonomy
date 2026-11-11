// Renders public/og.png (1200x630): the question and the fan's head from the live page, in the
// dark sheet. Text and the fan sit in the centred 630 px so a square crop keeps them.
// Run: node scripts/og-card.mjs
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const server = await createServer({
  root,
  logLevel: "error",
  server: { port: 4533, strictPort: true },
});
await server.listen();
const browser = await chromium.launch();

// The fan as the page draws it at the top, without its read-out marks, on a transparent ground.
const live = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
await live.goto("http://127.0.0.1:4533/");
await live.waitForSelector(".cvt-fan-parts");
await live.waitForTimeout(1500);
await live.addStyleTag({
  content: "*{background:transparent !important}.cvt-fan-marks{display:none}",
});
const fan = await live.screenshot({
  clip: { x: 335, y: 70, width: 495, height: 495 },
  omitBackground: true,
});
await live.close();

const font = (name, file) =>
  `@font-face{font-family:${name};src:url("file://${root}/src/assets/${file}") format("woff2");font-weight:100 900}`;
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><style>
${font("Overpass", "Overpass.woff2")}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;background:#0d3b5e;color:#e9f4ff;font-family:Overpass,sans-serif;position:relative}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(233,244,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(233,244,255,.08) 1px,transparent 1px);background-size:40px 40px}
.sheet{position:absolute;inset:16px;border:1px solid rgba(233,244,255,.34)}
.fan{position:absolute;right:-70px;top:140px;width:350px;height:350px;-webkit-mask-image:linear-gradient(#000 80%,transparent 98%)}
.text{position:absolute;left:285px;top:0;bottom:0;width:630px;display:flex;flex-direction:column;justify-content:center}
h1{font-size:68px;font-weight:800;line-height:1.02;letter-spacing:-.02em}
p{margin-top:28px;font-size:36px;line-height:1.3;color:#9dc2df}
</style><body>
<div class="grid"></div><div class="sheet"></div>
<img class="fan" alt="" src="data:image/png;base64,${fan.toString("base64")}">
<div class="text"><h1>What can a machine actually see?</h1><p>Can a photo help us decide what to repair, reuse or recycle?</p></div>
</body></html>`;
const file = join(tmpdir(), "cv-ie-og-card.html");
writeFileSync(file, html);

const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await card.goto(`file://${file}`);
await card.evaluate(() => document.fonts.ready);
await card.screenshot({ path: join(root, "public/og.png") });
await browser.close();
await server.close();
