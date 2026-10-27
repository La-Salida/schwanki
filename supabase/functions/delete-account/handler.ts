import { corsJson, corsPreflight } from "../_shared/cors.ts";

export interface DeleteAccountDependencies {
  authenticate: (jwt: string) => Promise<string | null>;
  /** Best effort: tell Google to drop the Drive grant. A failure must not block deletion. */
  revokeGoogle: (userId: string) => Promise<void>;
  /** Every stored file under the user's folder, in every private bucket. */
  removeFiles: (userId: string) => Promise<void>;
  /** Deleting the auth user cascades to every public table that references it. */
  deleteUser: (userId: string) => Promise<void>;
}

export function createDeleteAccountHandler(dependencies: DeleteAccountDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return corsPreflight();
    if (request.method !== "POST") return corsJson({ error: "method not allowed" }, 405);
    const jwt = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const userId = jwt ? await dependencies.authenticate(jwt) : null;
    if (!userId) return corsJson({ error: "unauthorized" }, 401);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    // The page asks the learner to confirm first; a bare POST never deletes anything.
    if (body?.confirm !== true) return corsJson({ error: "Confirm that you want to delete your account." }, 400);
    await dependencies.revokeGoogle(userId).catch(() => undefined);
    try { await dependencies.removeFiles(userId); }
    catch { return corsJson({ error: "Couldn't remove your files. Nothing was deleted. Try again." }, 500); }
    try { await dependencies.deleteUser(userId); }
    catch { return corsJson({ error: "Your files were removed but the account wasn't. Try again or email hello@elsueno.xyz." }, 500); }
    return corsJson({ deleted: true });
  };
}

interface StorageEntry { name: string; id: string | null }
type ListFolder = (path: string, offset: number) => Promise<StorageEntry[]>;

/** Every file path under a folder. Storage lists one level at a time; entries without an id are folders. */
export async function filesUnder(folder: string, list: ListFolder, pageSize = 1000): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const entries = await list(folder, offset);
    for (const entry of entries) {
      const path = `${folder}/${entry.name}`;
      if (entry.id) files.push(path);
      else files.push(...await filesUnder(path, list, pageSize));
    }
    if (entries.length < pageSize) return files;
  }
}
