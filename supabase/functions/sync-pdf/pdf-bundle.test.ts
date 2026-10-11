import { assertEquals, assertStringIncludes } from "jsr:@std/assert";

Deno.test("PDF extraction bundle works without a separate worker file", async () => {
  const directory = await Deno.makeTempDir({ prefix: "schwanki-pdf-bundle-" });
  try {
    const source = new URL("./pdf.ts", import.meta.url);
    const fixture = new URL("./fixtures/hello.pdf", import.meta.url);
    const bundled = `${directory}/pdf.mjs`;
    const build = await new Deno.Command(Deno.execPath(), {
      args: ["bundle", "--output", bundled, source.pathname],
      stdout: "piped", stderr: "piped",
    }).output();
    assertEquals(build.code, 0, new TextDecoder().decode(build.stderr));
    const run = await new Deno.Command(Deno.execPath(), {
      args: ["eval", "--no-check", `
        const { extractPdfText } = await import(${JSON.stringify(bundled)});
        const text = await extractPdfText(await Deno.readFile(${JSON.stringify(fixture.pathname)}));
        console.log(text);
      `],
      stdout: "piped", stderr: "piped",
    }).output();
    assertEquals(run.code, 0, new TextDecoder().decode(run.stderr));
    const text = new TextDecoder().decode(run.stdout);
    assertStringIncludes(text, "Hello world");
    assertStringIncludes(text, "xiexie - thank you");
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});
