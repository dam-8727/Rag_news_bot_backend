// Load environment variables and import required modules
import "dotenv/config";
import fs from "fs";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import { v4 as uuid } from "uuid";
import { embedMany, getEmbedding } from "../embed/jina.js";
import { ensureCollection, upsertPoints, deleteCollection } from "../vecdb/qdrant.js";

// Configuration constants
const COLLECTION = process.env.QDRANT_COLLECTION || "news";
const DATA_DIR = path.resolve("data");
const OUT_JSONL = path.join(DATA_DIR, "news.jsonl");

// --- Utility helper functions ---
// Sleep function for rate limiting API calls
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Split an array into smaller chunks of specified size
const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Smart text chunking strategy that tries to break at sentence boundaries
 * This creates better chunks for embedding and retrieval
 */
function chunkText(text, maxChars = 1500, overlap = 150) {
  const chunks = [];
  let i = 0;
  let chunkCount = 0;
  const maxChunks = 30; // Reduced limit for better quality
  
  while (i < text.length && chunkCount < maxChunks) {
    let end = Math.min(text.length, i + maxChars);
    
    // Try to break at sentence boundary for better chunk quality
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastExclamation = text.lastIndexOf('!', end);
      const lastQuestion = text.lastIndexOf('?', end);
      const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
      
      // If we found a sentence end within reasonable distance, use it
      if (lastSentenceEnd > i + maxChars * 0.7) {
        end = lastSentenceEnd + 1;
      }
    }
    
    const chunk = text.slice(i, end).trim();
    if (chunk.length > 100) { // Only keep substantial chunks
      chunks.push(chunk);
    }
    
    // Move to next chunk with overlap for context continuity
    i = end - overlap;
    if (i < 0) i = 0;
    chunkCount++;
  }
  
  console.log(`Created ${chunks.length} chunks from text of length ${text.length}`);
  return chunks.filter(Boolean);
}

// Configure HTTP client for web scraping with proper headers
const http = axios.create({
  timeout: 30000, // 30 second timeout
  headers: {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

/**
 * Scrape a single URL and extract the main article content
 * Uses multiple CSS selectors to find the best content
 */
async function scrapeOnce(url) {
  const { data: html } = await http.get(url);
  const $ = cheerio.load(html);

  // Extract title from various meta tags and headings
  const title =
    $("meta[property='og:title']").attr("content") ||
    $("h1").first().text().trim() ||
    $("title").first().text().trim();

  // Remove unwanted elements that clutter the content
  $('script, style, nav, header, footer, .advertisement, .ads, .sidebar, .menu, .navigation, .social-share, .comments, .related-articles').remove();
  
  // Try multiple CSS selectors to find the main article content
  const candidates = [
    "[itemprop='articleBody']",
    "article .story-content, article .content",
    ".article__content, .story-content, .content__article-body, .post-content, .entry-content",
    "article",
    ".content, .main-content",
    "main",
  ];

  // Find the longest text content (likely the main article)
  let longest = "";
  for (const sel of candidates) {
    const t = $(sel).text().trim();
    if (t && t.length > longest.length) longest = t;
  }

  // Clean up the extracted text
  let text = longest
    .replace(/\s+/g, " ")  // Multiple spaces to single
    .replace(/\n\s*\n/g, "\n")  // Multiple newlines to single
    .replace(/[^\w\s.,!?;:()\-'"]/g, " ")  // Remove special chars except basic punctuation
    .replace(/\s+/g, " ")  // Clean up spaces again
    .trim();
    
  // Remove common website noise patterns that don't add value
  text = text.replace(/(Subscribe|Follow us|Download|Share|Comment|Rate|Read more|View all|Latest news|Trending|Popular|More|Less)/gi, "");
  text = text.replace(/\s+/g, " ").trim();
  
  return { url, title, text };
}

/**
 * Scrape a URL with fallback to AMP version if content is too short
 * This helps get better content from news sites that have AMP versions
 */
async function scrape(url) {
  // Try the original URL first
  let doc = await scrapeOnce(url);
  if (doc.text.length >= 500) return doc;

  // If content is too short, try the AMP version
  try {
    const ampUrl =
      url.includes("/amp") ? url : url.replace(/\/?$/, "/amp"); // naive amp attempt
    if (ampUrl !== url) {
      const ampDoc = await scrapeOnce(ampUrl);
      if (ampDoc.text.length > doc.text.length) doc = ampDoc;
    }
  } catch {}
  return doc;
}

/**
 * Get the embedding dimension by creating a test embedding
 * This tells us how many dimensions our vectors will have
 */
async function inferDim() {
  const v = await getEmbedding("ping");
  return v.length;
}

/**
 * Main ingestion function that processes URLs and creates the vector database
 * This is the data pipeline that scrapes, chunks, embeds, and stores news articles
 */
async function main() {
  // Create data directory if it doesn't exist
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  
  // Check for URLs file
  const urlsFile = path.join(DATA_DIR, "urls.txt");
  if (!fs.existsSync(urlsFile)) {
    console.log(
      "Create data/urls.txt with ~30–50 article URLs (one per line).\nExample: https://www.reuters.com/...\n"
    );
    process.exit(1);
  }

  // Read and clean up URLs (remove duplicates and empty lines)
  const urlsRaw = fs.readFileSync(urlsFile, "utf8").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const urls = [...new Set(urlsRaw)];

  // Get embedding dimensions for our vector database
  const dim = await inferDim();
  
  // Clear existing collection for fresh ingestion
  console.log("Clearing existing collection for fresh ingestion...");
  await deleteCollection(COLLECTION);
  
  // Create the collection with the correct dimensions
  await ensureCollection(COLLECTION, dim);

  // Create output file for storing processed data
  const out = fs.createWriteStream(OUT_JSONL, { flags: "w" });

  // Process each URL one by one
  let processed = 0;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[${i + 1}/${urls.length}] Fetching: ${url}`);

    try {
      // Scrape the article content
      const doc = await scrape(url);
      console.log(`  ↳ Scraped: title="${doc.title}", text_length=${doc.text?.length || 0}`);
      
      // Skip articles that are too short (likely not real content)
      if (!doc.text || doc.text.length < 500) {
        console.log("  ↳ Skip (too short):", url);
        continue;
      }

      // Break the article into chunks for better retrieval
      console.log(`  ↳ About to chunk text of length: ${doc.text.length}`);
      const chunks = chunkText(doc.text);
      console.log(`  ↳ Text length: ${doc.text.length}, Chunks: ${chunks.length}`);
      console.log(`  ↳ First chunk length: ${chunks[0]?.length || 0}`);
      
      // Create embeddings in small groups to avoid rate limits
      const vectors = [];
      for (const group of chunkArray(chunks, 4)) { 
        console.log(`  ↳ Embedding group of ${group.length} chunks`);
        try {
          const v = await embedMany(group);
          vectors.push(...v);
        } catch (embedError) {
          console.log(`  ↳ Embedding error: ${embedError.message}`);
          throw embedError;
        }
        await sleep(500); // Rate limiting delay
        // Force garbage collection if available
        if (global.gc) global.gc();
      }

      // Create points for the vector database
      const points = chunks.map((chunk, idx) => ({
        id: uuid(),
        vector: vectors[idx],
        payload: { url: doc.url, title: doc.title, text: chunk },
      }));

      // Store in vector database
      await upsertPoints(COLLECTION, points);
      
      // Also save to JSONL file for backup/debugging
      points.forEach((p) => out.write(JSON.stringify(p.payload) + "\n"));

      processed++;
      console.log(`  ↳ Ingested: ${doc.title} (+${points.length} chunks)`);

      // Gentle delay between URLs to be nice to servers
      await sleep(750);
    } catch (e) {
      console.warn("  ↳ Error for URL:", url, "-", e.message);
    }

    // Optional garbage collection (only if node started with --expose-gc)
    if (global.gc) global.gc();
  }

  // Clean up and report results
  out.end();
  console.log(`Done. Ingested ${processed}/${urls.length}. JSONL saved:`, OUT_JSONL);
}

// Run the main ingestion process
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
