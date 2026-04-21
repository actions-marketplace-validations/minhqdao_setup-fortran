import { type Target } from "../../../types";

export async function installMacOS(_: Target): Promise<string> {
  return Promise.reject(new Error("Not implemented"));
}
