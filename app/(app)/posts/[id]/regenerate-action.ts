"use server";

import { revalidatePath } from "next/cache";
import { regeneratePost } from "../actions";

export async function regenerateAndRefresh(postId: string) {
  const newPost = await regeneratePost(postId);
  revalidatePath("/posts");
  return { id: newPost.id };
}
