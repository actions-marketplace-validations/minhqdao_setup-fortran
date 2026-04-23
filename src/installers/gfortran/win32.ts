import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as path from "path";
import * as tc from "@actions/tool-cache";
import { Arch, WindowsEnv, type Target } from "../../types";
import { resolveWindowsVersion } from "../../resolve_version";

const SUPPORTED_VERSIONS = {
  [Arch.X64]: {
    [WindowsEnv.Native]: ["15", "14", "13", "12", "11"],
    [WindowsEnv.UCRT64]: undefined,
    [WindowsEnv.Clang64]: undefined,
    [WindowsEnv.ClangArm64]: undefined,
    [WindowsEnv.MinGW64]: undefined,
  },
  [Arch.ARM64]: {
    [WindowsEnv.Native]: undefined,
    [WindowsEnv.UCRT64]: undefined,
    [WindowsEnv.ClangArm64]: undefined,
    [WindowsEnv.MinGW64]: undefined,
    [WindowsEnv.Clang64]: undefined,
  },
} as const satisfies Record<
  Arch,
  Record<WindowsEnv, readonly string[] | undefined>
>;

// const GCC_RELEASES: Record<string, string> = {
//   "15": "https://github.com/brechtsanders/winlibs_mingw/releases/download/15.2.0posix-14.0.0-ucrt-r7/winlibs-x86_64-posix-seh-gcc-15.2.0-mingw-w64ucrt-14.0.0-r7.7z",
// };

const GCC_RELEASES: Record<string, string> = {
  "15": "https://github.com/brechtsanders/winlibs_mingw/releases/download/15.2.0posix-14.0.0-msvcrt-r7/winlibs-x86_64-posix-seh-gcc-15.2.0-mingw-w64msvcrt-14.0.0-r7.7z",
  "14": "https://github.com/brechtsanders/winlibs_mingw/releases/download/14.2.0posix-12.0.0-msvcrt-r3/winlibs-x86_64-posix-seh-gcc-14.2.0-mingw-w64msvcrt-12.0.0-r3.7z",
  "13": "https://github.com/brechtsanders/winlibs_mingw/releases/download/13.2.0posix-11.0.1-msvcrt-r8/winlibs-x86_64-posix-seh-gcc-13.2.0-mingw-w64msvcrt-11.0.1-r8.7z",
  "12": "https://github.com/brechtsanders/winlibs_mingw/releases/download/12.2.0posix-10.0.0-msvcrt-r5/winlibs-x86_64-posix-seh-gcc-12.2.0-mingw-w64msvcrt-10.0.0-r5.7z",
  "11": "https://github.com/brechtsanders/winlibs_mingw/releases/download/11.2.0posix-9.0.0-msvcrt-r7/winlibs-x86_64-posix-seh-gcc-11.2.0-mingw-w64msvcrt-9.0.0-r7.7z",
};

export async function installWin32(target: Target): Promise<string> {
  const version = resolveWindowsVersion(target, SUPPORTED_VERSIONS);

  if (target.windowsEnv === WindowsEnv.Native) {
    return await installNative(target, version);
  }

  return await installMSYS2(target);
}

async function installNative(target: Target, version: string): Promise<string> {
  const downloadUrl = GCC_RELEASES[version];

  if (!downloadUrl) {
    throw new Error(`Unsupported GFortran version: ${version}`);
  }

  let toolRoot = tc.find(`gfortran-${target.windowsEnv}`, version, target.arch);

  if (!toolRoot) {
    core.info(`Downloading GFortran ${version} from ${downloadUrl}`);
    const downloadPath = await tc.downloadTool(downloadUrl);

    core.info(`Extracting GFortran ${version} from ${downloadPath}...`);
    const extractPath = await tc.extract7z(downloadPath);

    const actualToolDir = path.join(extractPath, "mingw64");

    core.info(`Caching GFortran ${version} in ${actualToolDir}...`);
    toolRoot = await tc.cacheDir(
      actualToolDir,
      `gfortran-${target.windowsEnv}`,
      version,
      target.arch,
    );
  }

  const binPath = path.join(toolRoot, "bin");
  core.addPath(binPath);

  const gfortranPath = path.join(binPath, "gfortran.exe");
  core.exportVariable("FC", gfortranPath);
  core.exportVariable("F77", gfortranPath);
  core.exportVariable("F90", gfortranPath);

  return await resolveInstalledVersion();
}

async function installMSYS2(target: Target): Promise<string> {
  const env = target.windowsEnv;

  // Guard against Flang environments if we are GFortran-only for now
  if (env === WindowsEnv.Clang64 || env === WindowsEnv.ClangArm64) {
    throw new Error(
      `GFortran is not available in the ${env} environment. Please use UCRT64, MinGW64, or Native.`,
    );
  }

  core.info(`Installing GFortran (Latest) on Windows via MSYS2 ${env}...`);

  const archLabel = target.arch === Arch.X64 ? "x86_64" : "aarch64";
  const subEnv = env === WindowsEnv.UCRT64 ? "ucrt" : "x86_64";
  const pkgName = `mingw-w64-${subEnv}-${archLabel}-gcc-fortran`;

  await exec.exec("bash", ["-c", `pacman -S --noconfirm --needed ${pkgName}`]);

  const msysBin = path.join("C:", "msys64", env, "bin");
  core.addPath(msysBin);

  return await resolveInstalledVersion();
}

async function resolveInstalledVersion(): Promise<string> {
  let stdout = "";

  const tool = "gfortran";

  try {
    await exec.exec(tool, ["-dumpversion"], {
      silent: true,
      listeners: { stdout: (data) => (stdout += data.toString()) },
    });
  } catch (err) {
    throw new Error(`Failed to verify ${tool} installation`, { cause: err });
  }

  const version = stdout.trim();
  if (!/^\d+/.test(version)) {
    throw new Error(`Unexpected version format: ${version}`);
  }
  return version;
}
