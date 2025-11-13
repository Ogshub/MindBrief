const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const router = express.Router();

// Search for websites related to a topic
router.post("/", async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    // Use Google Search API or DuckDuckGo for search results
    // For development, we'll use a simple approach with DuckDuckGo HTML
    const searchQuery = encodeURIComponent(topic);

    // Try to get search results from DuckDuckGo
    const searchUrls = [];

    try {
      // Using DuckDuckGo instant answer API for top results
      const response = await axios.get(
        `https://html.duckduckgo.com/html/?q=${searchQuery}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );

      const $ = cheerio.load(response.data);
      const links = [];

      // Extract top search results - try multiple selectors
      const selectors = [
        "a.result__a",
        "a.result-link",
        ".result__title a",
        ".web-result a",
        ".links_main a",
      ];

      const seenUrls = new Set();

      for (const selector of selectors) {
        $(selector).each((index, element) => {
          if (links.length >= 10) return false; // Stop if we have enough

          let url = $(element).attr("href");
          const title = $(element).text().trim();

          if (!url || !title || title.length < 5) return;

          // Clean and validate URL
          url = url.trim();

          // Handle DuckDuckGo redirect URLs
          if (url.startsWith("/l/?kh=") || url.startsWith("/l/")) {
            // Extract actual URL from DuckDuckGo redirect
            const match = url.match(/uddg=([^&]+)/);
            if (match) {
              url = decodeURIComponent(match[1]);
            } else {
              // Try to get from onclick or data attribute
              const onclick = $(element).attr("onclick");
              if (onclick) {
                const urlMatch = onclick.match(/uddg='([^']+)'/);
                if (urlMatch) {
                  url = decodeURIComponent(urlMatch[1]);
                }
              }
            }
          }

          // Ensure URL is absolute
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            if (url.startsWith("//")) {
              url = "https:" + url;
            } else if (url.startsWith("/")) {
              // Skip relative URLs - we need absolute URLs
              return;
            } else {
              url = "https://" + url;
            }
          }

          // Skip search engine URLs and invalid URLs
          if (
            url.includes("google.com/search") ||
            url.includes("duckduckgo.com") ||
            url.includes("bing.com/search") ||
            url.includes("yahoo.com/search") ||
            !url.match(/^https?:\/\/.+/)
          ) {
            return;
          }

          // Avoid duplicates
          if (seenUrls.has(url)) return;
          seenUrls.add(url);

          links.push({
            url: url,
            title: title,
          });
        });

        if (links.length >= 10) break;
      }

      // If DuckDuckGo doesn't work well, provide fallback top websites
      if (links.length === 0) {
        // Fallback: Provide popular websites that likely have content on the topic
        const topDomains = [
          "wikipedia.org",
          "reddit.com",
          "medium.com",
          "github.com",
          "stackoverflow.com",
          "youtube.com",
          "quora.com",
          "news.ycombinator.com",
        ];

        topDomains.forEach((domain) => {
          links.push({
            url: `https://www.google.com/search?q=site:${domain}+${searchQuery}`,
            title: `Search ${domain} for "${topic}"`,
          });
        });
      }

      return res.json({
        success: true,
        topic: topic,
        links: links,
        count: links.length,
      });
    } catch (error) {
      console.error("Search error:", error.message);

      // Fallback response with sample links
      const fallbackLinks = [
        {
          url: `https://en.wikipedia.org/wiki/Special:Search/${searchQuery}`,
          title: `Wikipedia - ${topic}`,
        },
        {
          url: `https://www.reddit.com/search/?q=${searchQuery}`,
          title: `Reddit - ${topic}`,
        },
        {
          url: `https://medium.com/search?q=${searchQuery}`,
          title: `Medium - ${topic}`,
        },
        {
          url: `https://github.com/search?q=${searchQuery}`,
          title: `GitHub - ${topic}`,
        },
        {
          url: `https://stackoverflow.com/search?q=${searchQuery}`,
          title: `Stack Overflow - ${topic}`,
        },
      ];

      return res.json({
        success: true,
        topic: topic,
        links: fallbackLinks,
        count: fallbackLinks.length,
      });
    }
  } catch (error) {
    console.error("Error in search route:", error);
    res.status(500).json({
      error: "Failed to search for websites",
      message: error.message,
    });
  }
});

// Scrape content from a specific URL
router.post("/scrape", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // Remove unwanted elements
      $(
        "script, style, nav, footer, header, aside, .advertisement, .ads, .sidebar, .social-share, .comments, iframe, noscript"
      ).remove();

      // Extract title
      const title =
        $('meta[property="og:title"]').attr("content") ||
        $("title").text() ||
        $("h1").first().text() ||
        "No title";

      // Extract description
      const description =
        $('meta[property="og:description"]').attr("content") ||
        $('meta[name="description"]').attr("content") ||
        $('meta[name="twitter:description"]').attr("content") ||
        "";

      // Intelligent content extraction - prioritize article content
      let content = "";
      let contentElements = [];

      // Try to find the main content container
      const selectors = [
        "article",
        "main",
        '[role="main"]',
        ".article-content",
        ".post-content",
        ".entry-content",
        ".content",
        "#content",
        ".main-content",
        ".article-body",
        ".post-body",
      ];

      let mainContainer = null;
      for (const selector of selectors) {
        const found = $(selector).first();
        if (found.length > 0) {
          mainContainer = found;
          break;
        }
      }

      if (mainContainer && mainContainer.length > 0) {
        // Extract structured content from main container
        mainContainer
          .find("p, h1, h2, h3, h4, h5, h6, li, blockquote")
          .each((i, elem) => {
            const text = $(elem).text().trim();
            if (text.length > 20) {
              // Only include meaningful paragraphs
              contentElements.push(text);
            }
          });
        content = contentElements.join("\n\n");
      } else {
        // Fallback: extract from body but prioritize paragraphs and headings
        $("body p, body h1, body h2, body h3, body h4, body h5, body h6")
          .not("nav p, footer p, header p")
          .each((i, elem) => {
            const text = $(elem).text().trim();
            if (text.length > 20) {
              contentElements.push(text);
            }
          });
        content = contentElements.join("\n\n");
      }

      // If still no content, try getting all paragraph text
      if (content.length < 100) {
        $("body p")
          .not("nav p, footer p, header p")
          .each((i, elem) => {
            const text = $(elem).text().trim();
            if (text.length > 10) {
              content += text + "\n\n";
            }
          });
      }

      // Clean up whitespace
      content = content.replace(/\s+/g, " ").trim();

      // Ensure we have meaningful content
      if (content.length < 50) {
        // Last resort - get body text
        const body = $("body");
        body.find("script, style, nav, footer, header").remove();
        content = body.text().replace(/\s+/g, " ").trim();
      }

      // Limit content length but keep it substantial
      if (content.length > 100000) {
        content = content.substring(0, 100000) + "...";
      }

      return res.json({
        success: true,
        url: url,
        title: title,
        description: description,
        content: content,
      });
    } catch (scrapeError) {
      console.error("Scraping error:", scrapeError.message);
      return res.status(500).json({
        error: "Failed to scrape content",
        message: scrapeError.message,
      });
    }
  } catch (error) {
    console.error("Error in scrape route:", error);
    res.status(500).json({
      error: "Failed to scrape website",
      message: error.message,
    });
  }
});

module.exports = router;
