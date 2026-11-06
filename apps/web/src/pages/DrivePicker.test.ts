import { describe, expect, it } from "vitest";
import { drivePickerParams, drivePickerResult } from "./DrivePicker";

describe("drive picker handoff", () => {
  it("reads the token from the fragment", () => {
    expect(drivePickerParams("#token=ya29.abc").token).toBe("ya29.abc");
    expect(drivePickerParams("").token).toBeNull();
  });
  it("always returns to the app scheme", () => {
    const back = new URL(drivePickerResult({ url: "https://docs.google.com/document/d/x/edit", name: "Clase 4", type: "google_doc" }));
    expect(`${back.protocol}//${back.host}${back.pathname}`).toBe("schwanki://drive/picked");
    expect(back.searchParams.get("name")).toBe("Clase 4");
    expect(back.searchParams.get("type")).toBe("google_doc");
    expect(new URL(drivePickerResult(null)).searchParams.get("cancelled")).toBe("1");
  });
});
