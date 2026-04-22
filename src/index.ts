import * as core from "@actions/core";
import { parseInputs } from "./parse_input";
import { Compiler, OS } from "./types";
import { installGCC } from "./installers/gcc";
import { installIFX } from "./installers/ifx";
import { installIFort } from "./installers/ifort";
import { installNVFortran } from "./installers/nvfortran";
import { installAOCC } from "./installers/aocc";
import { installLFortran } from "./installers/lfortran";

async function run(): Promise<void> {
  try {
    const target = parseInputs();

    core.info(`Compiler  : ${target.compiler}`);
    core.info(`Version   : ${target.version}`);
    core.info(`OS        : ${target.os}`);
    core.info(`OS Version: ${target.osVersion}`);
    core.info(`Arch      : ${target.arch}`);

    if (target.os === OS.Windows) {
      core.info(`Windows env : ${target.windowsEnv}`);
    }

    let installedVersion: string;

    switch (target.compiler) {
      case Compiler.GCC:
        installedVersion = await installGCC(target);
        break;
      case Compiler.IFX:
        installedVersion = await installIFX(target);
        break;
      case Compiler.IFort:
        installedVersion = await installIFort(target);
        break;
      case Compiler.NVFortran:
        installedVersion = await installNVFortran(target);
        break;
      case Compiler.AOCC:
        installedVersion = await installAOCC(target);
        break;
      case Compiler.LFortran:
        installedVersion = await installLFortran(target);
        break;
    }

    core.setOutput("compiler-version", installedVersion);
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

void run();
