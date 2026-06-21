import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let fp;
  try {
    fp = JSON.parse(raw)?.tool_input?.file_path;
  } catch {
    process.exit(0);
  }
  if (!fp || !existsSync(fp)) process.exit(0);

  const run = (args) => {
    try {
      execFileSync("npx", args, { stdio: "ignore", shell: true });
    } catch {
      /* no romper el turno por warnings/errores no auto-corregibles */
    }
  };

  run(["prettier", "--write", "--ignore-unknown", fp]);
  if (/\.(jsx?|tsx?)$/.test(fp)) run(["eslint", "--fix", fp]);
  process.exit(0);
});
