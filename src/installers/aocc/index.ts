import { OS, type Target } from "../../types";
import { installLinux } from "./linux";

export async function installAOCC(target: Target): Promise<string> {
  if (target.os !== OS.Linux) {
    throw new Error(`AOCC is only supported on Linux (got: ${target.os})`);
  }
  return await installLinux(target);
}
