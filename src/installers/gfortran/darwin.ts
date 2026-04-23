import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as path from "path";
import { Arch } from "../../types";
import { resolveVersion } from "../../resolve_version";
import type { Target } from "../../types";

const SUPPORTED_VERSIONS = {
  [Arch.X64]: ["15", "14", "13", "12", "11"],
  [Arch.ARM64]: ["15", "14", "13", "12", "11"],
} as const satisfies Record<Arch, readonly string[]>;

export async function installDarwin(target: Target): Promise<string> {
  const version = resolveVersion(target, SUPPORTED_VERSIONS);
  core.info(
    `Installing GFortran ${version} on macOS (${target.arch}) via Homebrew...`,
  );

  const formula = `gcc@${version}`;

  await exec.exec("brew", ["install", formula]);

  const brewPrefixOutput = await getBrewPrefix();
  const binDir = path.join(brewPrefixOutput, "bin");
  const gfortranBinary = path.join(binDir, `gfortran-${version}`);
  const genericGfortran = path.join(binDir, "gfortran");

  core.info(`Symlinking ${gfortranBinary} to ${genericGfortran}`);

  await exec.exec("ln", ["-sf", gfortranBinary, genericGfortran]);

  const resolvedVersion = await resolveInstalledVersion();
  core.info(`GFortran ${resolvedVersion} installed successfully on Darwin.`);
  return resolvedVersion;
}

async function getBrewPrefix(): Promise<string> {
  let output = "";
  await exec.exec("brew", ["--prefix"], {
    listeners: { stdout: (data: Buffer) => (output += data.toString()) },
  });
  return output.trim();
}

async function resolveInstalledVersion(): Promise<string> {
  let output = "";
  await exec.exec("gfortran", ["--version"], {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
  });
  const match = /\d+\.\d+\.\d+/.exec(output);
  if (!match)
    throw new Error(`Could not parse gfortran version from: ${output}`);
  return match[0];
}
