import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { setupMSYS2, msys2PkgName } from "../src/setup_msys2";
import { WindowsEnv } from "../src/types";

jest.mock("@actions/core");
jest.mock("@actions/exec");

describe("setupMSYS2", () => {
  const mockedExec = exec.exec as jest.MockedFunction<typeof exec.exec>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("installs packages in UCRT64", async () => {
    await setupMSYS2(WindowsEnv.UCRT64, ["gcc"]);

    expect(mockedExec).toHaveBeenCalledWith(
      expect.stringContaining("bash.exe"),
      expect.arrayContaining([expect.stringContaining("pacman -S --noconfirm --needed mingw-w64-ucrt-x86_64-gcc")]),
    );
    expect(core.addPath).toHaveBeenCalledWith(expect.stringContaining("ucrt64"));
    expect(core.addPath).toHaveBeenCalledWith(expect.stringContaining("bin"));
  });

  it("throws error for Native env", () => {
    expect(() => msys2PkgName(WindowsEnv.Native, "gcc")).toThrow(
      "No MSYS2 package prefix known for environment: native",
    );
  });
});
