import { XMLParser } from "fast-xml-parser";

export interface RSSItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  content?: string;
}

export interface RSSFeed {
  title: string;
  description?: string;
  link?: string;
  items: RSSItem[];
}

export async function parseRSSFeed(xmlContent: string): Promise<RSSFeed> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseAttributeValue: false,
  });

  const parsed = parser.parse(xmlContent);

  // Handle RSS 2.0 format
  if (parsed.rss?.channel) {
    const channel = parsed.rss.channel;
    const items = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean);

    return {
      title: channel.title || "Untitled Feed",
      description: channel.description,
      link: channel.link,
      items: items.map((item: any) => ({
        title: item.title || "Untitled",
        link: item.link || "",
        description: item.description,
        pubDate: item.pubDate,
        content: item["content:encoded"] || item.description,
      })),
    };
  }

  // Handle Atom format
  if (parsed.feed) {
    const feed = parsed.feed;
    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry].filter(Boolean);

    return {
      title: feed.title?.["#text"] || feed.title || "Untitled Feed",
      description: feed.subtitle?.["#text"] || feed.subtitle,
      link: feed.link?.["@_href"] || feed.link,
      items: entries.map((entry: any) => ({
        title: entry.title?.["#text"] || entry.title || "Untitled",
        link: entry.link?.["@_href"] || entry.link || "",
        description: entry.summary?.["#text"] || entry.summary,
        pubDate: entry.updated || entry.published,
        content: entry.content?.["#text"] || entry.content,
      })),
    };
  }

  throw new Error("Unsupported feed format. Expected RSS 2.0 or Atom.");
}

export async function fetchRSSFeed(url: string): Promise<RSSFeed> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LinkedInFeedAI/1.0)",
      "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
  }

  const xmlContent = await response.text();
  return parseRSSFeed(xmlContent);
}

export function filterRecentItems(items: RSSItem[], days: number = 7): RSSItem[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return items.filter((item) => {
    if (!item.pubDate) return true; // Include items without dates
    const itemDate = new Date(item.pubDate);
    return itemDate >= cutoff;
  });
}
