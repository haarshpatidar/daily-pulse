import axios from "axios";
import * as cheerio from "cheerio";
import Article from "../models/Article.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const FEEDS = [
  // BBC News
  { source: "BBC News", category: "world", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { source: "BBC News", category: "business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { source: "BBC News", category: "tech", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { source: "BBC News", category: "sports", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
  // NDTV
  { source: "NDTV", category: "world", url: "https://feeds.feedburner.com/ndtvnews-world-news" },
  { source: "NDTV", category: "sports", url: "https://feeds.feedburner.com/ndtvsports-latest" },
  { source: "NDTV", category: "tech", url: "https://feeds.feedburner.com/gadgets360-latest" },
  { source: "NDTV", category: "business", url: "https://feeds.feedburner.com/ndtvprofit-latest" },
  // TechCrunch
  { source: "TechCrunch", category: "tech", url: "https://techcrunch.com/feed/" },
  // Reuters retired its public RSS feeds, so we read them through Google News'
  // RSS search scoped to each reuters.com section (free, no key, 100 items).
  { source: "Reuters", category: "world", url: "https://news.google.com/rss/search?q=site:reuters.com/world&hl=en-US&gl=US&ceid=US:en" },
  { source: "Reuters", category: "business", url: "https://news.google.com/rss/search?q=site:reuters.com/business&hl=en-US&gl=US&ceid=US:en" },
  { source: "Reuters", category: "tech", url: "https://news.google.com/rss/search?q=site:reuters.com/technology&hl=en-US&gl=US&ceid=US:en" },
  // The Hindu
  { source: "The Hindu", category: "world", url: "https://www.thehindu.com/news/international/feeder/default.rss" },
  { source: "The Hindu", category: "business", url: "https://www.thehindu.com/business/feeder/default.rss" },
  { source: "The Hindu", category: "sports", url: "https://www.thehindu.com/sport/feeder/default.rss" },
  { source: "The Hindu", category: "tech", url: "https://www.thehindu.com/sci-tech/technology/feeder/default.rss" },
  // Hacker News
  { source: "Hacker News", category: "tech", url: "https://news.ycombinator.com/rss" },
  // Economic Times
  { source: "Economic Times", category: "business", url: "https://economictimes.indiatimes.com/rssfeedstopstories.cms" },
  { source: "Economic Times", category: "tech", url: "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms" },
];

function parseDate(raw) {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

// Fetch one RSS feed and return normalized article objects (no DB access,
// so it can be tested standalone).
export async function fetchFeed(feed) {
  const { data: xml } = await axios.get(feed.url, {
    timeout: 15000,
    responseType: "text",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  $("item").each((_, el) => {
    const $el = $(el);
    const title = $el.find("title").first().text().trim();
    const link = $el.find("link").first().text().trim();
    const pubDate =
      $el.find("pubDate").first().text().trim() ||
      $el.find("dc\\:date").first().text().trim();

    if (!title || !/^https?:\/\//.test(link)) return;

    items.push({
      // Google News-proxied feeds append " - <publisher>" to every headline
      title: title.replace(new RegExp(`\\s+-\\s+${feed.source}$`), ""),
      url: link,
      source: feed.source,
      category: feed.category,
      publishedAt: parseDate(pubDate),
    });
  });

  return items;
}

async function upsertArticles(articles) {
  if (articles.length === 0) return 0;
  const ops = articles.map((a) => ({
    updateOne: {
      filter: { url: a.url },
      update: {
        $set: {
          title: a.title,
          source: a.source,
          category: a.category,
          publishedAt: a.publishedAt,
        },
      },
      upsert: true,
    },
  }));
  const result = await Article.bulkWrite(ops, { ordered: false });
  return result.upsertedCount;
}

export async function scrapeNews() {
  const started = Date.now();
  const results = await Promise.allSettled(FEEDS.map((feed) => fetchFeed(feed)));

  const articles = [];
  let feedsOk = 0;
  let feedsFailed = 0;

  results.forEach((res, i) => {
    if (res.status === "fulfilled") {
      feedsOk += 1;
      articles.push(...res.value);
    } else {
      feedsFailed += 1;
      console.warn(`[news] feed failed (${FEEDS[i].source} / ${FEEDS[i].category}): ${res.reason.message}`);
    }
  });

  const inserted = await upsertArticles(articles);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[news] scraped ${feedsOk}/${FEEDS.length} feeds in ${seconds}s — ${articles.length} items, ${inserted} new`
  );

  return { feedsOk, feedsFailed, total: articles.length, inserted };
}
