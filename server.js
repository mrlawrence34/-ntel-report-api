const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');

const app = express();
const parser = new Parser();

app.use(cors());
app.use(express.json());

const RSS_SOURCES = [
  { id: "bbc", name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", cat: "war", region: "Global" },
  { id: "reuters", name: "Reuters", url: "https://feeds.reuters.com/reuters/topNews", cat: "war", region: "Global" },
  { id: "aljazeera", name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", cat: "war", region: "Global" },
  { id: "dw", name: "DW News", url: "https://rss.dw.com/rdf/rss-en-world", cat: "war", region: "Global" },
  { id: "apnews", name: "AP News", url: "https://feeds.apnews.com/apf-topnews", cat: "war", region: "Global" },
  { id: "guardian", name: "The Guardian", url: "https://www.theguardian.com/world/rss", cat: "global", region: "Global" },
  { id: "ntv", name: "NTV", url: "https://www.ntv.com.tr/son-dakika-haberleri.rss", cat: "turkey", region: "Türkiye" },
  { id: "hurriyet", name: "Hürriyet", url: "https://www.hurriyet.com.tr/rss/anasayfa", cat: "turkey", region: "Türkiye" },
];

// Cache
let cache = { data: [], lastFetch: null };
const CACHE_DURATION = 3 * 60 * 1000; // 3 dakika

async function fetchAllNews() {
  const allItems = [];
  
  for (const src of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(src.url);
      feed.items.slice(0, 15).forEach((item, i) => {
        allItems.push({
          id: `${src.id}-${i}-${Date.now()}`,
          title: item.title || "",
          summary: (item.contentSnippet || item.content || item.summary || "").slice(0, 200),
          source: src.name,
          sourceId: src.id,
          cat: src.cat,
          region: src.region,
          lang: "en",
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          link: item.link || "",
          status: "new",
          priority: getPriority(item.title || ""),
          tags: [],
        });
      });
    } catch (e) {
      console.log(`${src.name} hatası:`, e.message);
    }
  }

  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return allItems;
}

function getPriority(title) {
  const t = title.toLowerCase();
  if (t.match(/war|attack|strike|killed|bomb|nuclear|missile|crisis|urgent|breaking/)) return "critical";
  if (t.match(/conflict|military|troops|explosion|threat|sanctions|death/)) return "high";
  return "medium";
}

// Ana haber endpoint
app.get('/api/news', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data.length > 0 && cache.lastFetch && (now - cache.lastFetch) < CACHE_DURATION) {
      return res.json({ success: true, data: cache.data, cached: true, count: cache.data.length });
    }

    const news = await fetchAllNews();
    cache = { data: news, lastFetch: now };
    res.json({ success: true, data: news, cached: false, count: news.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', cached: cache.data.length, lastFetch: cache.lastFetch });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Intel Report API — Port ${PORT}`));
