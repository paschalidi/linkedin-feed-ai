import { describe, it, expect } from "vitest";
import { parseRSSFeed, filterRecentItems } from "@/lib/rss-parser";

describe("RSS Parser", () => {
  describe("parseRSSFeed", () => {
    it("should parse RSS 2.0 feed", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Test Feed</title>
            <description>A test feed</description>
            <link>https://example.com</link>
            <item>
              <title>Article 1</title>
              <link>https://example.com/1</link>
              <description>Description 1</description>
              <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
            </item>
            <item>
              <title>Article 2</title>
              <link>https://example.com/2</link>
              <description>Description 2</description>
              <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      const result = await parseRSSFeed(xml);
      expect(result.title).toBe("Test Feed");
      expect(result.description).toBe("A test feed");
      expect(result.link).toBe("https://example.com");
      expect(result.items).toHaveLength(2);
      expect(result.items[0].title).toBe("Article 1");
      expect(result.items[0].link).toBe("https://example.com/1");
    });

    it("should parse Atom feed", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Atom Feed</title>
          <subtitle>An atom test feed</subtitle>
          <entry>
            <title>Entry 1</title>
            <link href="https://example.com/entry1"/>
            <summary>Summary 1</summary>
            <updated>2024-01-01T00:00:00Z</updated>
          </entry>
        </feed>`;

      const result = await parseRSSFeed(xml);
      expect(result.title).toBe("Atom Feed");
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Entry 1");
    });

    it("should handle single item (not array)", async () => {
      const xml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Single Item Feed</title>
            <item>
              <title>Only Article</title>
              <link>https://example.com/only</link>
            </item>
          </channel>
        </rss>`;

      const result = await parseRSSFeed(xml);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Only Article");
    });

    it("should throw error for unsupported format", async () => {
      const xml = `<?xml version="1.0"?><unknown><item>test</item></unknown>`;
      await expect(parseRSSFeed(xml)).rejects.toThrow("Unsupported feed format");
    });
  });

  describe("filterRecentItems", () => {
    it("should filter items within the last 7 days", () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const items = [
        { title: "Recent", link: "", pubDate: fiveDaysAgo.toISOString() },
        { title: "Old", link: "", pubDate: tenDaysAgo.toISOString() },
        { title: "No Date", link: "" },
      ];

      const filtered = filterRecentItems(items, 7);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].title).toBe("Recent");
      expect(filtered[1].title).toBe("No Date");
    });
  });
});
