#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { once } from "events";
import { setTimeout as delay } from "timers/promises";
import simpleGit from "simple-git";

const PORT = Number(process.env.LVRT_PORT || 6006);
const STORYBOOK_COMMAND = (process.env.LVRT_STORYBOOK_COMMAND || "storybook dev").split(" ");
const STORYCAP_OPTIONS = process.env.LVRT_STORYCAP_OPTIONS ? process.env.LVRT_STORYCAP_OPTIONS.split(" ") : [];

async function main() {
  const targetBranch = process.argv[2];
  if (!targetBranch) {
    console.error("使い方: lvrt <比較先ブランチ名>");
    process.exit(1);
  }

  const git = simpleGit();
  if (!(await git.checkIsRepo())) {
    console.error("git リポジトリで実行してください。");
    process.exit(1);
  }

  const status = await git.status();
  const baseBranch = status.current;
  if (!baseBranch) {
    console.error("現在のブランチを取得できませんでした。");
    process.exit(1);
  }

  if (status.files.length > 0) {
    console.warn("⚠️ 作業ツリーに未コミットの変更があります。中断してから再実行してください。");
  }

  await ensureBranchExists(targetBranch);

  const cwd = process.cwd();
  const captureRoot = path.join(cwd, ".lvrt", "capture");
  const regRoot = path.join(cwd, ".lvrt", "reg-work");
  const baseDir = path.join(captureRoot, sanitizeBranchName(baseBranch));
  const targetDir = path.join(captureRoot, sanitizeBranchName(targetBranch));

  await fs.mkdir(captureRoot, { recursive: true });
  await fs.mkdir(regRoot, { recursive: true });

  try {
    await captureBranch(baseBranch, baseDir, { checkout: false });
    await captureBranch(targetBranch, targetDir, { checkout: true });
    await runRegSuit({ baseDir, targetDir, regRoot });
    console.log("✅ reg-suit の結果を確認してください。");
  } catch (err) {
    console.error("エラーが発生しました:", err.message || err);
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

  const storybook = spawn("npx", [...STORYBOOK_COMMAND, "-p", String(PORT), "--disable-telemetry", "--ci"], {
    stdio: "inherit"
  });

  try {
    await waitForStorybook(PORT);
    await runCommand("npx", ["storycap", `http://localhost:${PORT}`, "--outDir", outputDir, ...STORYCAP_OPTIONS]);
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

  throw new Error(`Storybook がポート ${port} で起動しませんでした: ${lastError?.message || "unknown"}`);
}

async function runRegSuit({ baseDir, targetDir, regRoot }) {
  const configPath = path.join(regRoot, "regconfig.json");
  const config = {
    core: {
      workingDir: regRoot,
      actualDir: baseDir,
      expectedDir: targetDir,
      thresholdRate: 0,
      thresholdPixel: 0
    },
    plugins: {}
  };

  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
  await runCommand("npx", ["reg-suit", "run", "--config", configPath], { stdio: "inherit" });
}

function sanitizeBranchName(name) {
  return name.replace(/[\\/]/g, "__");
}

async function runGit(args) {
  return runCommand("git", args, { stdio: "inherit" });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
      }
    });
  });
}

main();
