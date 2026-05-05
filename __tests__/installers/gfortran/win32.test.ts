import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";
import { installWin32 } from "../../../src/installers/gfortran/win32";
import { setupMSYS2 } from "../../../src/setup_msys2";
import {
  Arch,
  Compiler,
  OS,
  WindowsEnv,
  type Target,
} from "../../../src/types";

jest.mock("@actions/core");
jest.mock("@actions/exec");
jest.mock("@actions/tool-cache");
jest.mock("../../../src/setup_msys2");

describe("installWin32 (gfortran)", () => {
  const mockedExec = exec.exec as jest.MockedFunction<typeof exec.exec>;
  const mockedTc = tc as jest.Mocked<typeof tc>;
  const mockedSetupMSYS2 = setupMSYS2 as jest.MockedFunction<typeof setupMSYS2>;
  const mockedExportVariable = core.exportVariable as jest.MockedFunction<
    typeof core.exportVariable
  >;

  const baseTarget: Target = {
    compiler: Compiler.GFortran,
    version: "14",
    os: OS.Windows,
    osVersion: "2022",
    arch: Arch.X64,
    windowsEnv: WindowsEnv.Native,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedExec.mockImplementation(async (commandLine, args, options) => {
      if (commandLine === "gfortran" && args?.[0] === "-dumpversion") {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from("14.1.0"));
        }
      }
      return 0;
    });
  });

  describe("Native", () => {
    it("downloads and extracts GFortran", async () => {
      mockedTc.find.mockReturnValue("");
      mockedTc.downloadTool.mockResolvedValue("C:\\Temp\\gcc.zip");
      mockedTc.extractZip.mockResolvedValue("C:\\Temp\\extracted");
      mockedTc.cacheDir.mockResolvedValue("C:\\Cache\\gfortran");

      await installWin32(baseTarget);

      expect(mockedTc.downloadTool).toHaveBeenCalled();
      expect(mockedTc.extractZip).toHaveBeenCalledWith("C:\\Temp\\gcc.zip");
      expect(mockedTc.cacheDir).toHaveBeenCalled();
      expect(core.addPath).toHaveBeenCalledWith(expect.stringContaining("bin"));
    });

    it("exports environment variables", async () => {
      mockedTc.find.mockReturnValue("C:\\Cache\\gfortran");

      await installWin32(baseTarget);

      expect(mockedExportVariable).toHaveBeenCalledWith("FC", expect.stringContaining("gfortran.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("F77", expect.stringContaining("gfortran.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("F90", expect.stringContaining("gfortran.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("CC", expect.stringContaining("gcc.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("CXX", expect.stringContaining("g++.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("FPM_FC", expect.stringContaining("gfortran.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("FPM_CC", expect.stringContaining("gcc.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("FPM_CXX", expect.stringContaining("g++.exe"));
    });
  });

  describe("MSYS2", () => {
    it("calls setupMSYS2 and exports variables", async () => {
      const target = { ...baseTarget, version: "latest", windowsEnv: WindowsEnv.UCRT64 };
      await installWin32(target);

      expect(mockedSetupMSYS2).toHaveBeenCalledWith(WindowsEnv.UCRT64, ["gcc-fortran"]);
      expect(mockedExportVariable).toHaveBeenCalledWith("FC", expect.stringContaining("gfortran.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("F77", expect.stringContaining("gfortran.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("F90", expect.stringContaining("gfortran.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("CC", expect.stringContaining("gcc.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("CXX", expect.stringContaining("g++.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("FPM_FC", expect.stringContaining("gfortran.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("FPM_CC", expect.stringContaining("gcc.exe"));
      expect(mockedExportVariable).toHaveBeenCalledWith("FPM_CXX", expect.stringContaining("g++.exe"));
    });
  });
});
