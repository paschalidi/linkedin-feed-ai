/**
 * Paragraph-aware article chunking with overlap.
 *
 * State of the art since 2023: split into ~400-token (1500-char) chunks
 * that respect paragraph boundaries, with ~200-char overlap so key
 * sentences near a boundary appear in both adjacent chunks.
 *
 * This prevents the dilution problem of whole-article embeddings:
 * a specific passage about "agent productivity" can now be matched
 * directly, instead of competing with a diluted whole-article mean.
 */

export interface Chunk {
  text: string;
  index: number; // 0-based position in article
  charStart: number;
  charEnd: number;
}

export interface ChunkOptions {
  targetChars: number; // target chunk length in chars
  overlapChars: number; // how many chars to overlap between chunks
  minChunkChars: number; // reject chunks smaller than this
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  targetChars: 1500, // ~400 tokens — comfortable under 2048 limit
  overlapChars: 200, // 13% overlap
  minChunkChars: 300, // don't keep tiny last-paragraph fragments
};

/**
 * Split article content into paragraph-aware chunks with overlap.
 */
export function chunkArticle(
  content: string,
  options: Partial<ChunkOptions> = {}
): Chunk[] {
  const opts = { ...DEFAULT_CHUNK_OPTIONS, ...options };
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: Chunk[] = [];
  let buffer = "";
  let bufferStart = 0;
  let cursor = 0;

  for (const para of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${para}` : para;

    if (candidate.length <= opts.targetChars) {
      buffer = candidate;
    } else {
      // Flush current buffer as a chunk
      if (buffer.length >= opts.minChunkChars) {
        chunks.push({
          text: buffer,
          index: chunks.length,
          charStart: bufferStart,
          charEnd: bufferStart + buffer.length,
        });
      }
      // Start next buffer with overlap from end of previous
      const overlapStart = Math.max(0, buffer.length - opts.overlapChars);
      bufferStart = bufferStart + overlapStart;
      const overlap = buffer.slice(overlapStart);
      buffer = overlap ? `${overlap}\n\n${para}` : para;
    }
    cursor += para.length + 2;
  }

  // Flush final buffer
  if (buffer.length >= opts.minChunkChars) {
    chunks.push({
      text: buffer,
      index: chunks.length,
      charStart: bufferStart,
      charEnd: bufferStart + buffer.length,
    });
  }

  return chunks;
}

/**
 * Re-assemble neighbouring chunks for richer LLM context.
 * Given a matched chunk index, return that chunk + N chunks
 * before and after (clamped to array bounds).
 */
export function getChunkContext(
  chunks: Chunk[],
  centerIndex: number,
  contextRadius: number = 1
): string {
  const start = Math.max(0, centerIndex - contextRadius);
  const end = Math.min(chunks.length, centerIndex + contextRadius + 1);
  return chunks
    .slice(start, end)
    .map((c) => c.text)
    .join("\n\n");
}
