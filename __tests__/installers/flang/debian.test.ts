import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as fs from "fs";
import { installDebian } from "../../../src/installers/flang/debian";
import {
  Arch,
  Compiler,
  OS,
  WindowsEnv,
  type Target,
} from "../../../src/types";

jest.mock("@actions/core");
jest.mock("@actions/exec");
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(),
}));

describe("installDebian (Flang)", () => {
  const mockedExec = exec.exec as jest.MockedFunction<typeof exec.exec>;
  const mockedFs = fs as jest.Mocked<typeof fs>;
  const mockedExportVariable = core.exportVariable as jest.MockedFunction<
    typeof core.exportVariable
  >;

  const baseTarget: Target = {
    compiler: Compiler.Flang,
    version: "18",
    os: OS.Linux,
    osVersion: "22.04",
    arch: Arch.X64,
    windowsEnv: WindowsEnv.Native,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(true);
    mockedExec.mockImplementation(async (commandLine, args, options) => {
      if (commandLine === "lsb_release" && args?.[0] === "-cs") {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from("jammy"));
        }
      }
      if (
        (commandLine === "flang-new" || commandLine === "flang") &&
        args?.[0] === "--version"
      ) {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from("flang version 18.1.0"));
        }
      }
      return 0;
    });
  });

  it("calls llvm.sh with the correct version", async () => {
    await installDebian(baseTarget);

    expect(mockedExec).toHaveBeenCalledWith("bash", [
      "-c",
      "curl -fsSL https://apt.llvm.org/llvm.sh | sudo bash -s -- 18",
    ]);
  });

  it("installs the correct flang package", async () => {
    await installDebian(baseTarget);

    expect(mockedExec).toHaveBeenCalledWith("sudo", [
      "apt-get",
      "install",
      "-y",
      "flang-18",
    ]);
  });

  it("throws error for Flang <= 16 on Ubuntu 24.04 (noble)", async () => {
    mockedExec.mockImplementation(async (commandLine, args, options) => {
      if (commandLine === "lsb_release" && args?.[0] === "-cs") {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from("noble"));
        }
      }
      return 0;
    });

    const target = { ...baseTarget, version: "16" };
    await expect(installDebian(target)).rejects.toThrow(
      "Flang 16 is not available on Ubuntu 24.04 (noble)",
    );
  });

  it("configures update-alternatives for flang-new (>= 17)", async () => {
    const target = { ...baseTarget, version: "17" };
    await installDebian(target);

    expect(mockedExec).toHaveBeenCalledWith("sudo", [
      "update-alternatives",
      "--install",
      "/usr/bin/flang",
      "flang",
      "/usr/lib/llvm-17/bin/flang-new",
      "100",
    ]);
  });

  it("configures update-alternatives for flang (<= 16)", async () => {
    const target = { ...baseTarget, version: "16" };
    await installDebian(target);

    expect(mockedExec).toHaveBeenCalledWith("sudo", [
      "update-alternatives",
      "--install",
      "/usr/bin/flang",
      "flang",
      "/usr/lib/llvm-16/bin/flang",
      "100",
    ]);
  });

  it("exports environment variables and adds to PATH", async () => {
    await installDebian(baseTarget);

    expect(core.addPath).toHaveBeenCalledWith("/usr/lib/llvm-18/bin");
    expect(mockedExportVariable).toHaveBeenCalledWith("FC", "flang");
    expect(mockedExportVariable).toHaveBeenCalledWith("CC", "clang-18");
    expect(mockedExportVariable).toHaveBeenCalledWith("CXX", "clang++-18");
  });

  it("resolves and returns the installed version", async () => {
    const version = await installDebian(baseTarget);
    expect(version).toBe("flang version 18.1.0");
  });
});
