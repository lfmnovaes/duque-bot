import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type PackageJson = {
  version?: string;
};

function readVersionFromPackageJson(path: string): string | null {
  if (!existsSync(path)) return null;

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as PackageJson;
    if (
      typeof parsed.version === "string" &&
      parsed.version.trim().length > 0
    ) {
      return parsed.version.trim();
    }
  } catch {
    return null;
  }

  return null;
}

function detectAppVersion(): string {
  const envVersion = process.env.APP_VERSION ?? process.env.npm_package_version;
  if (envVersion && envVersion.trim().length > 0) {
    return envVersion.trim();
  }

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), "package.json"),
    resolve(currentDir, "../../package.json"),
    resolve(currentDir, "../../../package.json"),
  ];

  for (const candidate of candidates) {
    const version = readVersionFromPackageJson(candidate);
    if (version) return version;
  }

  return "0.0.0-unknown";
}

export const APP_VERSION = detectAppVersion();
