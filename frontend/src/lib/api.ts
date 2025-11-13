// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const api = {
  baseUrl: API_BASE_URL,

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      // Handle non-JSON responses
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || `HTTP error! status: ${response.status}`
        );
      }

      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          "Cannot connect to backend server. Please ensure the backend is running on port 5000."
        );
      }
      throw error;
    }
  },

  // Search endpoints
  search: {
    searchTopic: (topic: string) =>
      api.request("/api/search", {
        method: "POST",
        body: JSON.stringify({ topic }),
      }),
    scrapeUrl: (url: string) =>
      api.request("/api/search/scrape", {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
  },

  // Summarize endpoints
  summarize: {
    summarizeUrls: (topic: string, urls: string[]) =>
      api.request("/api/summarize", {
        method: "POST",
        body: JSON.stringify({ topic, urls }),
      }),
  },

  // Vault endpoints
  vault: {
    getItems: (userId: string) =>
      api.request(`/api/vault/${userId}`, { method: "GET" }),
    saveItem: (
      userId: string,
      item: { topic: string; summary: string; sources: any[] }
    ) =>
      api.request(`/api/vault/${userId}`, {
        method: "POST",
        body: JSON.stringify(item),
      }),
    deleteItem: (userId: string, itemId: string) =>
      api.request(`/api/vault/${userId}/${itemId}`, {
        method: "DELETE",
      }),
  },

  // Health check
  health: () => api.request("/api/health", { method: "GET" }),
};

