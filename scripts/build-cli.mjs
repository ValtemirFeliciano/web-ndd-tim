// Empacota o CLI do NDD Forge (src/cli/ndd-forge-cli.ts) num único arquivo Node.
// Uso: npm run build:cli   →   dist-cli/ndd-forge-cli.mjs + dist-cli/templates/*.xlsx + dist-cli/VERSAO.json
//
// O bundle contém todo o código do app (gemini.ts, transformers.ts, excel.ts, exceljs, jszip),
// então quem roda o .mjs precisa apenas do Node.js — sem node_modules.
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const OUT = "dist-cli";

function git(cmd) {
  try { return execSync(`git ${cmd}`, { encoding: "utf-8" }).trim(); } catch { return ""; }
}
const commit = git("rev-parse --short HEAD") || "sem-git";
const branch = git("rev-parse --abbrev-ref HEAD");
const sujo = git("status --porcelain -- src public/templates") !== "";
const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const versao = `${branch}@${commit}${sujo ? "+alteracoes-locais" : ""} (${agora})`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

await build({
  entryPoints: ["src/cli/ndd-forge-cli.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile: `${OUT}/ndd-forge-cli.mjs`,
  define: { __NDD_FORGE_VERSAO__: JSON.stringify(versao) },
  logLevel: "warning",
});

cpSync("public/templates/NDD-bts.xlsx", `${OUT}/templates/NDD-bts.xlsx`);
cpSync("public/templates/NDD-collo.xlsx", `${OUT}/templates/NDD-collo.xlsx`);
writeFileSync(`${OUT}/VERSAO.json`, JSON.stringify({ versao, commit, branch, alteracoes_locais: sujo }, null, 2));

console.log(`CLI gerado em ${OUT}/ — versão ${versao}`);
