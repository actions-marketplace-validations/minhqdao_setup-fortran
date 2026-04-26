import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as fs from "fs";
import { installDebian } from "../../../src/installers/aocc/debian";
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

describe("installDebian (AOCC)", () => {
  const mockedExec = exec.exec as jest.MockedFunction<typeof exec.exec>;
  const mockedFs = fs as jest.Mocked<typeof fs>;
  const mockedExportVariable = core.exportVariable as jest.MockedFunction<
    typeof core.exportVariable
  >;

  const baseTarget: Target = {
    compiler: Compiler.AOCC,
    version: "5.1",
    os: OS.Linux,
    osVersion: "22.04",
    arch: Arch.X64,
    windowsEnv: WindowsEnv.Native,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(false); // Assume not installed
    mockedExec.mockImplementation(async (commandLine, args, options) => {
      if (commandLine === "bash" && args?.[1] === 'source "/opt/AMD/aocc-compiler-5.1.0/setenv_AOCC.sh" && env') {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from("PATH=/opt/AMD/aocc/bin:/usr/bin\nLD_LIBRARY_PATH=/opt/AMD/aocc/lib\nAOCC_DIR=/opt/AMD/aocc\n"));
        }
      }
      if (commandLine === "flang" && args?.[0] === "--version") {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from("AOCC flang version 5.1.0"));
        }
      }
      return 0;
    });
  });

  it("downloads and installs when not present", async () => {
    await installDebian(baseTarget);

    expect(mockedExec).toHaveBeenCalledWith("curl", expect.arrayContaining(["-o", expect.stringContaining("aocc-compiler-5.1.0_1_amd64.deb")]));
    expect(mockedExec).toHaveBeenCalledWith("sudo", ["dpkg", "-i", expect.stringContaining("aocc-compiler-5.1.0_1_amd64.deb")]);
    expect(mockedExec).toHaveBeenCalledWith("sudo", ["apt-get", "install", "-f", "-y"]);
  });

  it("skips download when already installed", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    await installDebian(baseTarget);

    expect(mockedExec).not.toHaveBeenCalledWith("curl", expect.anything());
    expect(mockedExec).not.toHaveBeenCalledWith("sudo", ["dpkg", "-i", expect.anything()]);
  });

  it("sources setenv script and exports variables", async () => {
    await installDebian(baseTarget);

    expect(mockedExportVariable).toHaveBeenCalledWith("PATH", "/opt/AMD/aocc/bin:/usr/bin");
    expect(mockedExportVariable).toHaveBeenCalledWith("LD_LIBRARY_PATH", "/opt/AMD/aocc/lib");
    expect(mockedExportVariable).toHaveBeenCalledWith("AOCC_DIR", "/opt/AMD/aocc");
    expect(mockedExportVariable).toHaveBeenCalledWith("FC", "flang");
  });

  it("resolves and returns the installed version", async () => {
    const version = await installDebian(baseTarget);
    expect(version).toBe("AOCC flang version 5.1.0");
  });
});
