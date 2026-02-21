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

function normalizeRepoSlug(remoteUrl) {
  const value = String(remoteUrl || "").trim();
  if (!value) return "";
  if (/^[^/\s]+\/[^/\s]+$/.test(value)) return value;
  const sshMatch = value.match(/[:/]([^/:]+\/[^/.]+)(?:\.git)?$/);
  if (sshMatch?.[1]) return sshMatch[1];
  const urlMatch = value.match(/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/);
  if (urlMatch?.[1]) return urlMatch[1];
  return "";
}

function firstLine(value) {
  return String(value || "").split(/\r?\n/, 1)[0].trim();
}

async function loadNotesFromGitHub(slug) {
  if (!slug) return [];
  try {
    const response = await fetch(`https://api.github.com/repos/${slug}/commits?per_page=12`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "tftduos-release-meta",
      },
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((entry) => firstLine(entry?.commit?.message))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function loadReleaseMeta() {
  try {
    const packageJsonPath = path.resolve(__dirname, "./package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const versionRaw = String(packageJson.version || "0.0.0");
    const [major = "0", minor = "0"] = versionRaw.split(".");

    const commitEpoch = safeExec("git show -s --format=%ct HEAD");
    const buildNumber = commitEpoch || utcBuildStamp();
    const version = `${major}.${minor}.${buildNumber}`;

    const repoSlug =
      normalizeRepoSlug(process.env.RENDER_GIT_REPOSITORY) ||
      normalizeRepoSlug(process.env.GITHUB_REPOSITORY) ||
      normalizeRepoSlug(safeExec("git config --get remote.origin.url"));

    const githubNotes = await loadNotesFromGitHub(repoSlug);
    const commitOutput = safeExec("git log --pretty=format:%s --max-count=12");
    const shortCommit =
      String(process.env.RENDER_GIT_COMMIT || "").trim().slice(0, 7) ||
      safeExec("git rev-parse --short HEAD");
    const buildSource = commitEpoch ? "commit-epoch" : "utc-stamp";

    const gitNotes = String(commitOutput || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const notes = githubNotes.length ? githubNotes : gitNotes;
    if (!notes.length) {
      notes.push(`Build ${version} (${buildSource})`);
      if (shortCommit) notes.push(`Commit ${shortCommit}`);
      notes.push("Release notes unavailable from GitHub API and git log in this build environment.");
    }

    return { version, notes };
  } catch {
    return {
      version: "0.0",
      notes: ["Release metadata unavailable in this environment."],
    };
  }
}

export default defineConfig(async () => {
  const releaseMeta = await loadReleaseMeta();
  return {
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
  };
});
