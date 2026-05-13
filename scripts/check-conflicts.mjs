import { execSync } from "node:child_process";

const conflictPattern = "^(<<<<<<<|=======|>>>>>>>)";

const filesOutput = execSync("git ls-files", { encoding: "utf8" }).trim();
const files = filesOutput ? filesOutput.split("\n") : [];

const conflicted = [];

for (const file of files) {
  try {
    execSync(`rg -n "${conflictPattern}" "${file}"`, { stdio: "pipe" });
    conflicted.push(file);
  } catch {
    // No conflict markers found in this file.
  }
}

if (conflicted.length > 0) {
  console.error("❌ Unresolved merge markers found in tracked files:");
  for (const file of conflicted) console.error(`- ${file}`);
  process.exit(1);
}

console.log("✅ No unresolved merge markers found.");
