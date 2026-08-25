import { authenticate, errorResponse, guardRequest, json } from "../_shared/kitchen-ai.ts";

Deno.serve(async (req) => {
  const guarded = guardRequest(req);
  if (guarded) return guarded;

  try {
    const { user, serviceClient } = await authenticate(req);

    const { data: files, error: listError } = await serviceClient.storage
      .from("meal-photos")
      .list(user.id, { limit: 1000 });
    if (listError) throw listError;

    const paths = (files ?? []).filter((file) => file.name).map((file) => `${user.id}/${file.name}`);
    if (paths.length > 0) {
      const { error: storageError } = await serviceClient.storage.from("meal-photos").remove(paths);
      if (storageError) throw storageError;
    }

    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json(req, { deleted: true });
  } catch (error) {
    return errorResponse(req, error, "Account deletion failed");
  }
});
