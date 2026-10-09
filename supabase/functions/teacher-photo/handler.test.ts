import { assertEquals } from "jsr:@std/assert@1";
import { createTeacherPhotoHandler, preplyPhoto, preplyProfileUrl } from "./handler.ts";

Deno.test("accepts only Preply tutor profile links", () => {
  assertEquals(preplyProfileUrl("https://preply.com/en/tutor/1181027?utm=x#reviews"), "https://preply.com/en/tutor/1181027");
  assertEquals(preplyProfileUrl("http://preply.com/en/tutor/1"), null);
  assertEquals(preplyProfileUrl("https://evil.com/preply.com/en/tutor/1"), null);
  assertEquals(preplyProfileUrl("https://preply.com.evil.com/en/tutor/1"), null);
  assertEquals(preplyProfileUrl("https://preply.com/en/online/chinese-tutors"), null);
});

Deno.test("reads the avatar from og:image only", () => {
  assertEquals(preplyPhoto('<meta property="og:image" content="https://avatars.preply.com/i/logos/i/logos/avatar_x.jpg"/>'),
    "https://avatars.preply.com/i/logos/i/logos/avatar_x.jpg");
  assertEquals(preplyPhoto('<meta content="https://example.com/a.jpg" property="og:image">'), null);
});

Deno.test("saves the teacher photo for the signed-in learner", async () => {
  const saved: unknown[] = [];
  const handler = createTeacherPhotoHandler({
    authenticate: async () => "user-1",
    fetchProfile: async () => '<meta property="og:image" content="https://avatars.preply.com/a.jpg">',
    save: async (input) => { saved.push(input); },
  });
  const response = await handler(new Request("http://x", {
    method: "POST", headers: { authorization: "Bearer jwt" },
    body: JSON.stringify({ name: " Ms. Li ", preplyUrl: "https://preply.com/en/tutor/42" }),
  }));
  assertEquals(response.status, 200);
  assertEquals(saved, [{ userId: "user-1", jwt: "jwt", name: "Ms. Li", preplyUrl: "https://preply.com/en/tutor/42", photoUrl: "https://avatars.preply.com/a.jpg" }]);
});
