// hoshi HTTP contract: vendored schemas and generated types.
//   node scripts/api.mjs sync <hoshi-commit>  download hoshi's /v1 schemas at that commit
//   node scripts/api.mjs gen                   write src/api/hoshi.gen.ts from the vendored schemas
//   node scripts/api.mjs check                 fail when src/api/hoshi.gen.ts is stale
import { readFile, writeFile } from "node:fs/promises";
import { compile } from "json-schema-to-typescript";

// Exported type name -> [path in Sannrox/hoshi, vendored path].
const SCHEMAS = {
  ServeResponse: ["docs/schema/serve-v1.json", "api/serve-v1.json"],
  CliResponse: ["docs/schema/cli-v1.json", "api/cli-v1.json"],
};
const REF = "api/HOSHI_REF";
const OUT = "src/api/hoshi.gen.ts";

const generate = async () => {
  const ref = (await readFile(REF, "utf8")).trim();
  const types = [];
  for (const [name, [, local]] of Object.entries(SCHEMAS)) {
    const doc = JSON.parse(await readFile(local, "utf8"));
    types.push(
      await compile({ ...doc, title: name }, name, {
        bannerComment: "",
        format: false,
      }),
    );
  }
  const sources = Object.values(SCHEMAS)
    .map(([remote]) => remote)
    .join(", ");
  return `// Generated from Sannrox/hoshi ${sources} at ${ref}.\n// Do not edit: run \`pnpm api:gen\`.\n${types.join("")}`;
};

const [command, arg] = process.argv.slice(2);
if (command === "sync") {
  if (!/^[0-9a-f]{40}$/.test(arg ?? "")) {
    throw new Error("sync needs a full 40-character hoshi commit SHA");
  }
  for (const [remote, local] of Object.values(SCHEMAS)) {
    const url = `https://raw.githubusercontent.com/Sannrox/hoshi/${arg}/${remote}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${url}: HTTP ${response.status}`);
    }
    await writeFile(local, await response.text());
  }
  await writeFile(REF, `${arg}\n`);
  await writeFile(OUT, await generate());
} else if (command === "gen") {
  await writeFile(OUT, await generate());
} else if (command === "check") {
  if ((await readFile(OUT, "utf8")) !== (await generate())) {
    console.error(`${OUT} is stale; run \`pnpm api:gen\``);
    process.exit(1);
  }
} else {
  throw new Error("usage: api.mjs sync <sha> | gen | check");
}
