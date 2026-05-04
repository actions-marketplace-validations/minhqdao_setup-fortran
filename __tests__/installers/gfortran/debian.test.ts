import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { installDebian } from "../../../src/installers/gfortran/debian";
import {
  Arch,
  Compiler,
  OS,
  WindowsEnv,
  type Target,
} from "../../../src/types";

jest.mock("@actions/core");
jest.mock("@actions/exec");

describe("GFortran Debian Installer", () => {
  const mockedExec = exec.exec as jest.MockedFunction<typeof exec.exec>;

  const baseTarget: Target = {
    compiler: Compiler.GFortran,
    version: "14",
    os: OS.Linux,
    osVersion: "20.04.6",
    arch: Arch.X64,
    windowsEnv: WindowsEnv.Native,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedExec.mockImplementation(async (commandLine, args, options) => {
      if (commandLine === "gfortran" && args?.[0] === "--version") {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(
            Buffer.from("GNU Fortran (Ubuntu 14.2.0-1ubuntu2~22.04) 14.2.0"),
          );
        }
      }
      return 0;
    });
  });

  // describe("needsPpa", () => {
  //   it("returns true for version >= 15 on Ubuntu 24.04", () => {
  //     expect(needsPpa("15", "24.04")).toBe(true);
  //     expect(needsPpa("16", "24.04")).toBe(true);
  //   });

  //   it("returns false for version < 15 on Ubuntu 24.04", () => {
  //     expect(needsPpa("14", "24.04")).toBe(false);
  //     expect(needsPpa("13", "24.04")).toBe(false);
  //   });

  //   it("returns true for version >= 13 on Ubuntu 22.04", () => {
  //     expect(needsPpa("13", "22.04")).toBe(true);
  //     expect(needsPpa("14", "22.04")).toBe(true);
  //   });

  //   it("returns false for version < 13 on Ubuntu 22.04", () => {
  //     expect(needsPpa("12", "22.04")).toBe(false);
  //     expect(needsPpa("11", "22.04")).toBe(false);
  //   });

  //   it("returns true for other OS versions regardless of compiler version", () => {
  //     expect(needsPpa("11", "20.04")).toBe(true);
  //     expect(needsPpa("16", "20.04")).toBe(true);
  //     expect(needsPpa("14", "debian-12")).toBe(true);
  //   });
  // });

  describe("installDebian", () => {
    it("adds PPA when needsPpa returns true", async () => {
      const target = { ...baseTarget, version: "15", osVersion: "24.04" };
      await installDebian(target);

      expect(mockedExec).toHaveBeenCalledWith("sudo", [
        "add-apt-repository",
        "--yes",
        "ppa:ubuntu-toolchain-r/test",
      ]);
    });

    it("does not add PPA when needsPpa returns false", async () => {
      const target = { ...baseTarget, version: "14", osVersion: "24.04" };
      await installDebian(target);

      expect(mockedExec).not.toHaveBeenCalledWith("sudo", [
        "add-apt-repository",
        "--yes",
        "ppa:ubuntu-toolchain-r/test",
      ]);
    });

    it("always updates apt and installs gfortran", async () => {
      await installDebian(baseTarget);

      expect(mockedExec).toHaveBeenCalledWith("sudo", [
        "apt-get",
        "update",
        "-y",
      ]);
      expect(mockedExec).toHaveBeenCalledWith("sudo", [
        "apt-get",
        "install",
        "-y",
        "gcc-14",
        "gfortran-14",
      ]);
    });

    it("configures update-alternatives", async () => {
      await installDebian(baseTarget);

      expect(mockedExec).toHaveBeenCalledWith("sudo", [
        "update-alternatives",
        "--install",
        "/usr/bin/gcc",
        "gcc",
        "/usr/bin/gcc-14",
        "100",
        "--slave",
        "/usr/bin/gfortran",
        "gfortran",
        "/usr/bin/gfortran-14",
      ]);
    });

    it("exports environment variables", async () => {
      await installDebian(baseTarget);

      expect(core.exportVariable).toHaveBeenCalledWith("FC", "gfortran-14");
      expect(core.exportVariable).toHaveBeenCalledWith("F77", "gfortran-14");
      expect(core.exportVariable).toHaveBeenCalledWith("F90", "gfortran-14");
    });
  });
});
