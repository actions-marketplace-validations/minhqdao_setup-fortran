import { LATEST, type Target, type WindowsEnv } from "./types";

export function resolveVersion<T extends readonly string[]>(
  target: Target,
  supportedVersions: Record<string, T | undefined>,
): string {
  const versions = supportedVersions[target.arch];

  if (!versions) {
    throw new Error(
      `No supported versions found for ${target.compiler} on ` +
        `${target.os} (${target.arch}).`,
    );
  }

  const version = target.version === LATEST ? versions[0] : target.version;

  if (!version) {
    throw new Error(
      `No supported versions found for ${target.compiler} on ` +
        `${target.os} (${target.arch}).`,
    );
  }

  if (!(versions as readonly string[]).includes(version)) {
    throw new Error(
      `${target.compiler} ${version} is not supported on ` +
        `${target.os} (${target.arch}). ` +
        `Supported versions: ${versions.join(", ")}`,
    );
  }

  return version;
}

export function resolveWindowsVersion<T extends readonly string[]>(
  target: Target,
  supportedVersions: Record<
    string,
    Record<WindowsEnv, T | undefined> | undefined
  >,
): string {
  const archVersions = supportedVersions[target.arch];
  if (!archVersions) {
    throw new Error(
      `No supported versions found for ${target.compiler} on ` +
        `${target.os} (${target.arch}).`,
    );
  }

  const windowsEnv = target.windowsEnv;

  const versions = archVersions[windowsEnv];

  if (!versions) {
    throw new Error(
      `No supported versions found for ${target.compiler} on ` +
        `${target.os} (${target.arch}, ${windowsEnv}).`,
    );
  }

  return resolveVersion(target, { [target.arch]: versions });
}
