import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const requestedArgs = process.argv.slice(2);
if (requestedArgs.length === 0) {
  console.error("Uso: node scripts/python-runner.mjs <script-ou-módulo> [argumentos]");
  process.exit(2);
}

const bundledPython = join(
  homedir(),
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "python",
  process.platform === "win32" ? "python.exe" : "bin/python3",
);

const candidates = [
  ...(process.env.PYTHON ? [[process.env.PYTHON]] : []),
  ...(existsSync(bundledPython) ? [[bundledPython]] : []),
  ["python3"],
  ["python"],
  ...(process.platform === "win32" ? [["py", "-3"]] : []),
];

for (const [command, ...prefixArgs] of candidates) {
  const probe = spawnSync(command, [...prefixArgs, "--version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (probe.error || probe.status !== 0) continue;

  const result = spawnSync(command, [...prefixArgs, ...requestedArgs], {
    stdio: "inherit",
    windowsHide: true,
  });
  process.exit(result.status ?? 1);
}

console.error("Python 3 não encontrado. Defina PYTHON ou instale Python 3.");
process.exit(127);
