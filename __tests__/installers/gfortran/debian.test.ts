import * as core from "@actions/core";
import * as exec from "@actions/exec";
import {
  installDebian,
  needsPpa,
} from "../../../src/installers/gfortran/debian";
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

  describe("needsPpa", () => {
    it("returns true for version >= 15 on Ubuntu 24.04", () => {
      expect(needsPpa("15", "24.04")).toBe(true);
      expect(needsPpa("16", "24.04")).toBe(true);
    });

    it("returns false for version < 15 on Ubuntu 24.04", () => {
      expect(needsPpa("14", "24.04")).toBe(false);
      expect(needsPpa("13", "24.04")).toBe(false);
    });

    it("returns true for version >= 13 on Ubuntu 22.04", () => {
      expect(needsPpa("13", "22.04")).toBe(true);
      expect(needsPpa("14", "22.04")).toBe(true);
    });

    it("returns false for version < 13 on Ubuntu 22.04", () => {
      expect(needsPpa("12", "22.04")).toBe(false);
      expect(needsPpa("11", "22.04")).toBe(false);
    });

    it("returns true for other OS versions regardless of compiler version", () => {
      expect(needsPpa("11", "20.04")).toBe(true);
      expect(needsPpa("16", "20.04")).toBe(true);
      expect(needsPpa("14", "debian-12")).toBe(true);
    });
  });

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
        "-o",
        "Acquire::Retries=3",
        "-o",
        "Acquire::http::Timeout=60",
        "gcc-14",
        "gfortran-14",
      ]);
    });

    it("retries apt-get install on failure", async () => {
      mockedExec.mockImplementation(async (cmd, args) => {
        if (cmd === "sudo" && args?.[0] === "apt-get" && args?.[1] === "install") {
          if (mockedExec.mock.calls.filter(c => c[1]?.[1] === "install").length === 1) {
            throw new Error("Failed");
          }
        }
        return 0;
      });

      jest.useFakeTimers();
      const installPromise = installDebian(baseTarget);
      
      // Advance timers repeatedly to ensure we pass the delay
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        jest.advanceTimersByTime(10000);
      }
      
      await installPromise;
      jest.useRealTimers();

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("apt-get install failed (attempt 1/3)"),
      );
    });

    it("retries add-apt-repository on failure", async () => {
      const target = { ...baseTarget, version: "15", osVersion: "24.04" };
      
      mockedExec.mockImplementation(async (cmd, args) => {
        if (cmd === "sudo" && args?.[0] === "add-apt-repository") {
          if (mockedExec.mock.calls.filter(c => c[1]?.[0] === "add-apt-repository").length === 1) {
            throw new Error("Failed");
          }
        }
        return 0;
      });

      jest.useFakeTimers();
      const installPromise = installDebian(target);
      
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        jest.advanceTimersByTime(5000);
      }
      
      await installPromise;
      jest.useRealTimers();

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("add-apt-repository failed (attempt 1/3)"),
      );
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
