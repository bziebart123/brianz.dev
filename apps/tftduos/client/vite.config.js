import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeExec(command) {
  try {
    return String(
      execSync(command, {
        cwd: path.resolve(__dirname, "../../.."),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }) || ""
    ).trim();
  } catch {
    return "";
  }
}

function utcBuildStamp() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}`;
}

function loadReleaseMeta() {
  try {
    const packageJsonPath = path.resolve(__dirname, "./package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const versionRaw = String(packageJson.version || "0.0.0");
    const [major = "0", minor = "0"] = versionRaw.split(".");
    const commitCount = safeExec("git rev-list --count HEAD");
    const buildNumber = commitCount || utcBuildStamp();
    const version = `${major}.${minor}.${buildNumber}`;

    const commitOutput = safeExec("git log --pretty=format:%s --max-count=12");
    const shortCommit =
      String(process.env.RENDER_GIT_COMMIT || "").trim().slice(0, 7) ||
      safeExec("git rev-parse --short HEAD");
    const buildSource = commitCount ? "commit-count" : "utc-stamp";

    const notes = String(commitOutput || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!notes.length) {
      notes.push(`Build ${version} (${buildSource})`);
      if (shortCommit) notes.push(`Commit ${shortCommit}`);
      notes.push("Release notes unavailable from git log in this build environment.");
    }

    return { version, notes };
  } catch {
    return {
      version: "0.0",
      notes: ["Release metadata unavailable in this environment."],
    };
  }
}

const releaseMeta = loadReleaseMeta();

export default defineConfig({
  plugins: [react()],
  define: {
    __TFTDUOS_VERSION__: JSON.stringify(releaseMeta.version),
    __TFTDUOS_RELEASE_NOTES__: JSON.stringify(releaseMeta.notes),
  },
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
