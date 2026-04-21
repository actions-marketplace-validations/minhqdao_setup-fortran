import { OS, type Target } from "../../types";
import { installLinux } from "./linux";
import { installMacOS } from "./macos";
import { installWindows } from "./windows";

export async function installGCC(target: Target): Promise<string> {
  switch (target.os) {
    case OS.Linux:
      return await installLinux(target);
    case OS.MacOS:
      return await installMacOS(target);
    case OS.Windows:
      return await installWindows(target);
  }
}
