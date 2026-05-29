"use server";

import { revalidatePath } from "next/cache";
import { regeneratePost } from "../actions";

export async function regenerateAndRefresh(postId: string) {
  await regeneratePost(postId);
  revalidatePath(`/posts/${postId}`);
}
