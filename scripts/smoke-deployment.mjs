import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

const [site, dist = "dist", mode] = process.argv.slice(2);
if (!site) throw new Error("usage: node scripts/smoke-deployment.mjs <site URL> [dist] [preview]");

const base = new URL(site.endsWith("/") ? site : `${site}/`);

async function check(url, expectedHeader) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  if (expectedHeader && !response.headers.get("x-robots-tag")?.includes(expectedHeader)) {
    throw new Error(`${url}: missing X-Robots-Tag: ${expectedHeader}`);
  }
  return response;
}

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
      }),
    )
  ).flat();
}

const page = await check(base, mode === "preview" ? "noindex" : undefined);
await check(new URL("?cell=component-structure", base));
await check(new URL("privacy.html", base));
await check(new URL("og.png", base));

const html = await page.text();
const references = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
  .map((match) => match[1])
  .filter((path) => !path.startsWith("http"));
await Promise.all(references.map((path) => check(new URL(path, base))));

const deploymentRoot = resolve(dist, base.pathname.slice(1));
const deploymentFiles = await files(deploymentRoot);
for (const required of [/\.woff2$/, /ort-wasm-simd-threaded.*\.wasm$/, /eng\.traineddata\.gz$/]) {
  const matches = deploymentFiles.filter((file) => required.test(file));
  if (matches.length === 0) throw new Error(`${dist}: no file matches ${required}`);
  for (const path of matches) {
    await check(new URL(`/${relative(resolve(dist), path)}`, base));
  }
}
