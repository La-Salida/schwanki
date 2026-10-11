import { assertEquals } from "jsr:@std/assert@1";
import { createTeacherPhotoHandler, preplyLanguage, preplyName, preplyPhoto, preplyProfileUrl } from "./handler.ts";

Deno.test("accepts only Preply tutor profile links", () => {
  assertEquals(preplyProfileUrl("https://preply.com/en/tutor/1181027?utm=x#reviews"), "https://preply.com/en/tutor/1181027");
  assertEquals(preplyProfileUrl("https://preply.com/ko/tutor/7238852"), "https://preply.com/en/tutor/7238852");
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
  assertEquals(saved, [{ userId: "user-1", jwt: "jwt", name: "Ms. Li", preplyUrl: "https://preply.com/en/tutor/42", photoUrl: "https://avatars.preply.com/a.jpg", language: null }]);
});

Deno.test("reads the tutor's name and taught language", () => {
  const html = '<meta property="og:title" content="Tian W., 💫 Children&#x27;s program host | Learn with Chinese Tutors"/>' +
    '<script>{"subject":{"id":6,"alias":"chinese","name":"Chinese(Mandarin)","priority":1,"languageCode":"zh","group":"languages"}}</script>';
  assertEquals(preplyName(html), "Tian W.");
  assertEquals(preplyLanguage(html), "zh");
  assertEquals(preplyLanguage("<html></html>"), null);
});

Deno.test("a new teacher takes the name from the profile", async () => {
  const saved: Array<{ name: string }> = [];
  const handler = createTeacherPhotoHandler({
    authenticate: async () => "user-1",
    fetchProfile: async () => '<meta property="og:title" content="Pattraporn H., Certified teacher | Learn with Thai Tutors"/>' +
      '<meta property="og:image" content="https://avatars.preply.com/p.jpg">"subject":{"id":15,"alias":"thai","name":"Thai","languageCode":"th"}',
    save: async (input) => { saved.push(input); },
  });
  const response = await handler(new Request("http://x", {
    method: "POST", headers: { authorization: "Bearer jwt" },
    body: JSON.stringify({ preplyUrl: "https://preply.com/es/tutor/1024206" }),
  }));
  assertEquals(await response.json(), { name: "Pattraporn H.", preplyUrl: "https://preply.com/en/tutor/1024206", photoUrl: "https://avatars.preply.com/p.jpg", language: "th" });
  assertEquals(saved[0]!.name, "Pattraporn H.");
});
