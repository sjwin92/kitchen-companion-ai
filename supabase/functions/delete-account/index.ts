import { authenticate, errorResponse, guardRequest, json } from "../_shared/kitchen-ai.ts";

Deno.serve(async (req) => {
  const guarded = guardRequest(req);
  if (guarded) return guarded;

  try {
    const { user, serviceClient } = await authenticate(req);

    for (const bucket of ["meal-photos"]) {
      let offset = 0;
      while (true) {
        const { data: files, error: listError } = await serviceClient.storage
          .from(bucket)
          .list(user.id, { limit: 100, offset });
        if (listError) throw listError;
        const paths = (files ?? []).filter((file) => file.name).map((file) => `${user.id}/${file.name}`);
        if (paths.length === 0) break;
        const { error: storageError } = await serviceClient.storage.from(bucket).remove(paths);
        if (storageError) throw storageError;
        if (paths.length < 100) break;
        // Removing the current page shifts later objects down, so continue from the same offset.
        offset = 0;
      }
    }

    const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (jwt) {
      const { error: signOutError } = await serviceClient.auth.admin.signOut(jwt, "global");
      if (signOutError) throw signOutError;
    }

    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json(req, { deleted: true });
  } catch (error) {
    return errorResponse(req, error, "Account deletion failed");
  }
});
