import { assertEquals } from "jsr:@std/assert@1";
import { createDeleteAccountHandler, filesUnder } from "./handler.ts";

const post = (body: unknown, auth = "Bearer jwt") =>
  new Request("http://x", { method: "POST", headers: { authorization: auth }, body: JSON.stringify(body) });

function recorder(overrides: Partial<Parameters<typeof createDeleteAccountHandler>[0]> = {}) {
  const calls: string[] = [];
  const handler = createDeleteAccountHandler({
    authenticate: async jwt => jwt === "jwt" ? "user-1" : null,
    revokeGoogle: async id => { calls.push(`revoke ${id}`); },
    removeFiles: async id => { calls.push(`files ${id}`); },
    deleteUser: async id => { calls.push(`user ${id}`); },
    ...overrides,
  });
  return { calls, handler };
}

Deno.test("deletes files, then the account, for the signed-in learner", async () => {
  const { calls, handler } = recorder();
  const response = await handler(post({ confirm: true }));
  assertEquals(response.status, 200);
  assertEquals(calls, ["revoke user-1", "files user-1", "user user-1"]);
});

Deno.test("refuses without a session or without confirmation", async () => {
  const { calls, handler } = recorder();
  assertEquals((await handler(post({ confirm: true }, "Bearer other"))).status, 401);
  assertEquals((await handler(post({}))).status, 400);
  assertEquals((await handler(post({ confirm: "yes" }))).status, 400);
  assertEquals(calls, []);
});

Deno.test("a Google revoke failure doesn't block deletion", async () => {
  const { calls, handler } = recorder({ revokeGoogle: async () => { throw new Error("offline"); } });
  assertEquals((await handler(post({ confirm: true }))).status, 200);
  assertEquals(calls, ["files user-1", "user user-1"]);
});

Deno.test("keeps the account when files can't be removed, so a retry finishes the job", async () => {
  const { calls, handler } = recorder({ removeFiles: async () => { throw new Error("storage down"); } });
  assertEquals((await handler(post({ confirm: true }))).status, 500);
  assertEquals(calls, ["revoke user-1"]);
});

Deno.test("walks nested folders and pages", async () => {
  const tree: Record<string, Array<{ name: string; id: string | null }>> = {
    "u": [{ name: "card-a", id: null }, { name: "top.png", id: "1" }],
    "u/card-a": [{ name: "x.png", id: "2" }, { name: "y.mp3", id: "3" }, { name: "z.png", id: "4" }],
  };
  const list = async (path: string, offset: number) => (tree[path] ?? []).slice(offset, offset + 2);
  assertEquals((await filesUnder("u", list, 2)).sort(), ["u/card-a/x.png", "u/card-a/y.mp3", "u/card-a/z.png", "u/top.png"]);
});
