import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type DependencyPackageJson = {
  version?: string;
};

function readPackageVersion(path: string): string | null {
  if (!existsSync(path)) return null;

  try {
    const parsed = JSON.parse(
      readFileSync(path, "utf8"),
    ) as DependencyPackageJson;
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

export function detectDependencyVersion(packageName: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), "node_modules", packageName, "package.json"),
    resolve(currentDir, "../../node_modules", packageName, "package.json"),
    resolve(currentDir, "../../../node_modules", packageName, "package.json"),
  ];

  for (const candidate of candidates) {
    const version = readPackageVersion(candidate);
    if (version) return version;
  }

  return "unknown";
}
