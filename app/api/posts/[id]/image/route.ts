import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePostImage } from "@/lib/post-image-generator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const shouldRegenerate = searchParams.has("regenerate");

  try {
    const post = await prisma.generatedPost.findUnique({
      where: { id },
      include: { idea: true },
    });

    if (!post) {
      return new Response("Post not found", { status: 404 });
    }

    // If we have a saved image and we're not forcing a refresh, return it
    if (post.brandedImageData && !shouldRegenerate) {
      return new Response(post.brandedImageData, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const content = post.finalContent || post.draftContent;
    const title = post.idea?.title || "LinkedIn Post";

    const imageBuffer = await generatePostImage({
      title,
      content,
      authorName: "paschalidi",
    });

    // Save the generated image so it stays sticky across text edits
    await prisma.generatedPost.update({
      where: { id },
      data: { brandedImageData: Buffer.from(imageBuffer) },
    });

    return new Response(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    console.error("Image generation error:", err);
    return new Response(err?.message || "Failed to generate image", {
      status: 500,
    });
  }
}
