#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { once } from "events";
import { setTimeout as delay } from "timers/promises";
import simpleGit from "simple-git";

const PORT = Number(process.env.LSVRT_PORT || 6006);
const STORYBOOK_COMMAND = (
  process.env.LSVRT_STORYBOOK_COMMAND || "storybook dev"
).split(" ");
const STORYCAP_OPTIONS = process.env.LSVRT_STORYCAP_OPTIONS
  ? process.env.LSVRT_STORYCAP_OPTIONS.split(" ")
  : [];
const REGCLI_OPTIONS = process.env.LSVRT_REGCLI_OPTIONS
  ? process.env.LSVRT_REGCLI_OPTIONS.split(" ")
  : [];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_BIN_DIR = path.resolve(__dirname, "../node_modules/.bin");

async function main() {
  const targetBranch = process.argv[2];
  if (!targetBranch) {
    console.error("Usage: lsvrt <target-branch>");
    process.exit(1);
  }

  const git = simpleGit();
  if (!(await git.checkIsRepo())) {
    console.error("Please run this command inside a git repository.");
    process.exit(1);
  }

  const status = await git.status();
  const baseBranch = status.current;
  if (!baseBranch) {
    console.error("Failed to detect current branch.");
    process.exit(1);
  }

  if (status.files.length > 0) {
    console.warn(
      "⚠️ Uncommitted changes detected. Please commit or stash before running."
    );
    process.exit(1);
  }

  await ensureBranchExists(targetBranch);
  try {
    await ensureBinariesForBranches({ baseBranch, targetBranch });
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }

  const cwd = process.cwd();
  const captureRoot = path.join(cwd, ".lsvrt", "capture");
  const regRoot = path.join(cwd, ".lsvrt", "reg-work");
  const baseDir = path.join(captureRoot, sanitizeBranchName(baseBranch));
  const targetDir = path.join(captureRoot, sanitizeBranchName(targetBranch));

  await fs.mkdir(captureRoot, { recursive: true });
  await fs.mkdir(regRoot, { recursive: true });

  try {
    await captureBranch(baseBranch, baseDir, { checkout: false });
    await captureBranch(targetBranch, targetDir, { checkout: true });
    const reportPath = await runRegCli({ baseDir, targetDir, regRoot });
    if (reportPath) {
      await openReport(reportPath);
    }
    console.log("✅ reg-cli completed. Check the report above.");
  } catch (err) {
    console.error("An error occurred:", err.message || err);
    process.exitCode = 1;
  } finally {
    const current = (await git.status()).current;
    if (current !== baseBranch) {
      await runGit(["checkout", baseBranch]);
    }
  }
}

async function ensureBranchExists(branch) {
  await runGit(["rev-parse", "--verify", branch]);
}

async function captureBranch(branch, outputDir, { checkout }) {
  if (checkout) {
    await runGit(["checkout", branch]);
  }

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const storybook = spawn(
    await resolveCommand(STORYBOOK_COMMAND[0]),
    [...STORYBOOK_COMMAND.slice(1), "-p", String(PORT), "--disable-telemetry", "--ci"],
    { stdio: "inherit" }
  );

  try {
    await waitForStorybook(PORT);
    await runLocalBin("storycap", [
      `http://localhost:${PORT}`,
      "--outDir",
      outputDir,
      ...STORYCAP_OPTIONS,
    ]);
  } finally {
    storybook.kill("SIGTERM");
    await once(storybook, "exit").catch(() => {});
  }
}

async function waitForStorybook(port) {
  const url = `http://localhost:${port}/`;
  const timeout = Date.now() + 2 * 60 * 1000;
  let lastError = null;

  while (Date.now() < timeout) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await delay(1500);
  }

  throw new Error(
    `Storybook did not start on port ${port}: ${
      lastError?.message || "unknown"
    }`
  );
}

async function runRegCli({ baseDir, targetDir, regRoot }) {
  const thresholdRate = parseThresholdRate(
    process.env.LSVRT_THRESHOLD_RATE,
    0.001
  );
  const diffDir = path.join(regRoot, "diff");
  const jsonPath = path.join(regRoot, "reg.json");
  const reportPath = path.join(regRoot, "index.html");

  await fs.rm(diffDir, { recursive: true, force: true });
  await fs.mkdir(diffDir, { recursive: true });

  const args = [
    baseDir,
    targetDir,
    diffDir,
    "--json",
    jsonPath,
    "--report",
    reportPath,
    "--thresholdRate",
    String(thresholdRate),
    "--thresholdPixel",
    "0",
    ...REGCLI_OPTIONS,
  ];

  await runLocalBin("reg-cli", args, { stdio: "inherit" });

  try {
    await fs.access(reportPath);
    return reportPath;
  } catch {
    return null;
  }
}

function sanitizeBranchName(name) {
  return name.replace(/[\\/]/g, "__");
}

async function runGit(args) {
  return runCommand("git", args, { stdio: "inherit" });
}

async function resolveBin(binName) {
  for (const bin of buildBinCandidates(binName)) {
    try {
      await fs.access(bin);
      return bin;
    } catch {
      // continue searching
    }
  }
  return null;
}

async function runLocalBin(binName, args, options = {}) {
  const resolved = await resolveBin(binName);
  const cmd = resolved || "npx";
  const finalArgs = resolved ? args : [binName, ...args];
  return runCommand(cmd, finalArgs, options);
}

async function resolveCommand(command) {
  return (await resolveBin(command)) || command;
}

function buildBinCandidates(binName) {
  const seen = new Set();
  const binFile =
    process.platform === "win32" ? `${binName}.cmd` : binName;
  const dirs = [
    ...walkNodeModulesBin(process.cwd()),
    ...walkNodeModulesBin(__dirname),
  ];
  const explicit = [PACKAGE_BIN_DIR];
  for (const dir of explicit) {
    dirs.push(dir);
  }

  return dirs
    .map((dir) => path.join(dir, binFile))
    .filter((bin) => {
      if (seen.has(bin)) return false;
      seen.add(bin);
      return true;
    });
}

function* walkNodeModulesBin(startDir) {
  let current = startDir;
  while (true) {
    yield path.join(current, "node_modules/.bin");
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

async function ensureRequiredBinaries(contextLabel = "current branch") {
  const required = ["storycap", "reg-cli"];
  const missing = [];

  for (const bin of required) {
    const resolved = await resolveBin(bin);
    if (!resolved) {
      missing.push(bin);
    }
  }

  if (missing.length > 0) {
    const list = missing.join(", ");
    throw new Error(
      `Required CLI binaries not found (${contextLabel}): ${list}\n` +
        "Searched node_modules/.bin from the current directory upward and within the lsvrt package.\n" +
        "In monorepos, install dependencies at the workspace root and try again."
    );
  }
}

function parseThresholdRate(value, defaultValue) {
  if (value === undefined) return defaultValue;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : defaultValue;
}

async function ensureBinariesForBranches({ baseBranch, targetBranch }) {
  await ensureRequiredBinaries(`branch ${baseBranch}`);
  if (targetBranch === baseBranch) return;

  await runGit(["checkout", targetBranch]);
  try {
    await ensureRequiredBinaries(`branch ${targetBranch}`);
  } finally {
    await runGit(["checkout", baseBranch]);
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`${command} ${args.join(" ")} failed with code ${code}`)
        );
      }
    });
  });
}

async function openReport(filePath) {
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args =
    opener === "open"
      ? [filePath]
      : opener === "cmd"
      ? ["/c", "start", "", filePath]
      : [filePath];
  try {
    await runCommand(opener, args, { stdio: "ignore" });
    console.log(`🖥️ Opening report in your browser: ${filePath}`);
  } catch (err) {
    console.warn(`Could not open report automatically: ${err.message || err}`);
  }
}

main();
