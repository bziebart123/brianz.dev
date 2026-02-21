import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadReleaseMeta() {
  try {
    const packageJsonPath = path.resolve(__dirname, "./package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const versionRaw = String(packageJson.version || "0.0.0");
    const [major = "0", minor = "0"] = versionRaw.split(".");
    const version = `${major}.${minor}`;

    const commitOutput = execSync("git log --pretty=format:%s --max-count=12", {
      cwd: path.resolve(__dirname, "../../.."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const notes = String(commitOutput || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

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
