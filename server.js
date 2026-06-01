const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');

const app = express();
const parser = new Parser({ timeout: 10000 });

app.use(cors());
app.use(express.json());

const RSS_SOURCES = [
  { id: "bbc", name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", cat: "war", region: "Global" },
  { id: "dw", name: "DW News", url: "https://rss.dw.com/rdf/rss-en-world", cat: "war", region: "Global" },
  { id: "aljazeera", name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", cat: "war", region: "Global" },
  { id: "guardian", name: "The Guardian", url: "https://www.theguardian.com/world/rss", cat: "global", region: "Global" },
  { id: "ap", name: "AP News", url: "https://feeds.apnews.com/apf-topnews", cat: "war", region: "Global" },
  { id: "sky", name: "Sky News", url: "https://feeds.skynews.com/feeds/rss/world.xml", cat: "war", region: "Global" },
  { id: "rt", name: "RT News", url: "https://www.rt.com/rss/news/", cat: "war", region: "Global" },
  { id: "euronews", name: "Euronews", url: "https://www.euronews.com/rss", cat: "global", region: "Avrupa" },
];

let cache = { data: [], lastFetch: null };
const CACHE_MS = 3 * 60 * 1000;

function getPriority(title) {
  const t = (title || '').toLowerCase();
  if (t.match(/war|attack|strike|killed|bomb|nuclear|missile|crisis|breaking|urgent/)) return "critical";
  if (t.match(/conflict|military|troops|explosion|threat|death|shooting/)) return "high";
  return "medium";
}

async function fetchAllNews() {
  const allItems = [];
  const promises = RSS_SOURCES.map(async (src) => {
    try {
      const feed = await parser.parseURL(src.url);
      return feed.items.slice(0, 15).map((item, i) => ({
        id: `${src.id}-${i}-${Date.now()}`,
        title: item.title || "",
        summary: (item.contentSnippet || item.summary || "").replace(/<[^>]+>/g, "").slice(0, 200),
        source: src.name,
        sourceId: src.id,
        cat: src.cat,
        region: src.region,
        lang: "en",
        pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
        link: item.link || "",
        status: "new",
        priority: getPriority(item.title),
        tags: [],
      }));
    } catch (e) {
      console.log(`${src.name} hata:`, e.message);
      return [];
    }
  });

  const results = await Promise.allSettled(promises);
  results.forEach(r => { if (r.status === 'fulfilled') allItems.push(...r.value); });
  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return allItems;
}

app.get('/api/news', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data.length > 0 && cache.lastFetch && (now - cache.lastFetch) < CACHE_MS) {
      return res.json({ success: true, data: cache.data, cached: true, count: cache.data.length });
    }
    const news = await fetchAllNews();
    if (news.length > 0) cache = { data: news, lastFetch: now };
    res.json({ success: true, data: cache.data, cached: false, count: cache.data.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', count: cache.data.length, lastFetch: cache.lastFetch });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Intel Report API — Port ${PORT}`));
