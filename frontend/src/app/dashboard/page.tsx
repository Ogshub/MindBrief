"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AuthGuard from "@/components/auth-guard";
import Vault from "@/components/vault";
import { api } from "@/lib/api";
import { downloadText, downloadMarkdown, formatFilename } from "@/lib/download";

interface SearchLink {
  url: string;
  title: string;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [topic, setTopic] = useState("");
  const [searching, setSearching] = useState(false);
  const [links, setLinks] = useState<SearchLink[]>([]);
  const [selectedLinks, setSelectedLinks] = useState<string[]>([]);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [savingToVault, setSavingToVault] = useState(false);
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");

  useEffect(() => {
    const checkBackend = async () => {
      try {
        await api.health();
        setBackendStatus("online");
      } catch (error) {
        console.error("Backend health check failed:", error);
        setBackendStatus("offline");
      }
    };
    checkBackend();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleSearch = async () => {
    if (!topic.trim()) {
      alert("Please enter a topic to search");
      return;
    }

    setSearching(true);
    setLinks([]);
    setSelectedLinks([]);
    setSummary(null);

    try {
      const data = await api.search.searchTopic(topic.trim());

      if (data.success && data.links) {
        setLinks(data.links);
        setBackendStatus("online");
      } else {
        alert(data.error || "Failed to search. Please try again.");
      }
    } catch (error: any) {
      console.error("Search error:", error);
      setBackendStatus("offline");
      alert(
        error.message ||
          "Error searching. Please check if the backend is running on port 5000."
      );
    } finally {
      setSearching(false);
    }
  };

  const toggleLinkSelection = (url: string) => {
    setSelectedLinks((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const handleSummarize = async () => {
    if (selectedLinks.length === 0) {
      alert("Please select at least one link to summarize");
      return;
    }

    setSummarizing(true);
    setSummary(null);

    try {
      const data = await api.summarize.summarizeUrls(
        topic.trim(),
        selectedLinks
      );

      if (data.success && data.summary) {
        setSummary(data.summary);
        setBackendStatus("online");
      } else {
        alert(data.error || "Failed to summarize. Please try again.");
      }
    } catch (error: any) {
      console.error("Summarize error:", error);
      setBackendStatus("offline");
      alert(
        error.message ||
          "Error summarizing. Please check if the backend is running on port 5000."
      );
    } finally {
      setSummarizing(false);
    }
  };

  const handleSaveToVault = async () => {
    if (!summary || !user?.uid) {
      alert("No summary to save");
      return;
    }

    setSavingToVault(true);

    try {
      const selectedLinksData = links.filter((link) =>
        selectedLinks.includes(link.url)
      );

      const data = await api.vault.saveItem(user.uid, {
        topic: topic.trim(),
        summary: summary,
        sources: selectedLinksData.map((link) => ({
          url: link.url,
          title: link.title,
        })),
      });

      if (data.success) {
        alert("Summary saved to Vault!");
        setVaultOpen(true);
        setBackendStatus("online");
      } else {
        alert(data.error || "Failed to save to Vault. Please try again.");
      }
    } catch (error: any) {
      console.error("Save to vault error:", error);
      setBackendStatus("offline");
      alert(
        error.message ||
          "Error saving to Vault. Please check if the backend is running on port 5000."
      );
    } finally {
      setSavingToVault(false);
    }
  };

  const handleDownloadTxt = () => {
    if (!summary || !topic) return;
    const filename = formatFilename(topic, "txt");
    downloadText(summary, filename);
  };

  const handleDownloadMarkdown = () => {
    if (!summary || !topic) return;
    const filename = formatFilename(topic, "md");
    downloadMarkdown(summary, filename);
  };

  return (
    <AuthGuard requireAuth={true}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/20">
        {/* Modern Navbar */}
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-sm">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  AI Summarizer
                </h1>
              </div>
              <div className="flex items-center space-x-3">
                {backendStatus === "online" && (
                  <div className="hidden sm:flex items-center space-x-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Online</span>
                  </div>
                )}
                {backendStatus === "offline" && (
                  <div className="hidden sm:flex items-center space-x-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Offline</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => setVaultOpen(true)}
                  className="gradient-primary text-white border-0 shadow-sm hover:shadow-md transition-all"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h12a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                    />
                  </svg>
                  Vault
                </Button>
                <div className="hidden sm:flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-slate-700 truncate max-w-[120px]">
                    {user?.email}
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Search Section */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-3">
              Research & Summarize
            </h1>
            <p className="text-lg text-slate-600">
              Enter a topic to search the web and generate comprehensive
              AI-powered summaries
            </p>
          </div>

          {/* Modern Search Bar */}
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm mb-6 transition-all hover:shadow-xl">
            <CardContent className="p-6">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <svg
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <Input
                    type="text"
                    placeholder="What would you like to research? (e.g., Artificial Intelligence, Climate Change, Quantum Computing...)"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSearch();
                      }
                    }}
                    className="pl-12 h-12 text-base bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500/20"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={searching || !topic.trim()}
                  className="gradient-primary text-white px-8 h-12 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {searching ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Searching...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      Search
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Links Sidebar - Left */}
            <div className="lg:col-span-4">
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm h-[calc(100vh-280px)] flex flex-col transition-all hover:shadow-xl">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-slate-900">
                      Discovered Links
                    </CardTitle>
                    <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                      {links.length}
                    </span>
                  </div>
                  {selectedLinks.length > 0 && (
                    <p className="text-sm text-purple-600 mt-1">
                      {selectedLinks.length} selected for summarization
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4">
                  {links.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <svg
                          className="w-8 h-8 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                      <p className="text-slate-500 font-medium">No links yet</p>
                      <p className="text-sm text-slate-400 mt-1">
                        Search for a topic to discover websites
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {links.map((link, index) => {
                        const isSelected = selectedLinks.includes(link.url);
                        return (
                          <div
                            key={index}
                            className={`group p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? "bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-400 shadow-md scale-[1.02]"
                                : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md hover:scale-[1.01]"
                            }`}
                            onClick={() => toggleLinkSelection(link.url)}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 ${
                                  isSelected
                                    ? "bg-indigo-600 border-indigo-600"
                                    : "border-slate-300 group-hover:border-indigo-400"
                                }`}
                              >
                                {isSelected && (
                                  <svg
                                    className="w-3 h-3 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4
                                  className={`font-semibold text-sm mb-1.5 line-clamp-2 ${
                                    isSelected
                                      ? "text-indigo-900"
                                      : "text-slate-900"
                                  }`}
                                >
                                  {link.title}
                                </h4>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline truncate block"
                                >
                                  {link.url}
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Summary Area - Right */}
            <div className="lg:col-span-8">
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm h-[calc(100vh-280px)] flex flex-col transition-all hover:shadow-xl">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-slate-900">
                      Summary Document
                    </CardTitle>
                    {summary && (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleDownloadTxt}
                          variant="outline"
                          className="border-slate-200 text-slate-700 hover:bg-slate-50 h-9 text-sm"
                        >
                          <svg
                            className="w-4 h-4 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          Download TXT
                        </Button>
                        <Button
                          onClick={handleDownloadMarkdown}
                          variant="outline"
                          className="border-slate-200 text-slate-700 hover:bg-slate-50 h-9 text-sm"
                        >
                          <svg
                            className="w-4 h-4 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          Download MD
                        </Button>
                        <Button
                          onClick={handleSaveToVault}
                          disabled={savingToVault}
                          className="gradient-success text-white border-0 shadow-sm hover:shadow-md h-9 text-sm"
                        >
                          {savingToVault ? (
                            "Saving..."
                          ) : (
                            <>
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Save to Vault
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-6">
                  {summary ? (
                    <div className="prose prose-slate max-w-none">
                      <div className="whitespace-pre-wrap text-slate-700 leading-relaxed bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="font-mono text-xs text-slate-400 mb-4 pb-4 border-b border-slate-200">
                          Generated on {new Date().toLocaleString()}
                        </div>
                        <div className="text-base leading-7">{summary}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mb-6">
                        <svg
                          className="w-10 h-10 text-indigo-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-slate-900 mb-2">
                        Ready to Generate Summary
                      </h3>
                      <p className="text-slate-600 max-w-md">
                        {selectedLinks.length === 0
                          ? "Select one or more links from the sidebar, then click the summarize button below."
                          : `You have ${selectedLinks.length} link${
                              selectedLinks.length > 1 ? "s" : ""
                            } selected. Click the button below to generate a comprehensive summary.`}
                      </p>
                    </div>
                  )}
                </CardContent>
                {links.length > 0 && (
                  <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                    <Button
                      onClick={handleSummarize}
                      disabled={summarizing || selectedLinks.length === 0}
                      className="w-full gradient-primary text-white h-12 text-base font-semibold shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {summarizing ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Generating Summary...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-5 h-5 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          Generate Summary ({selectedLinks.length} link
                          {selectedLinks.length !== 1 ? "s" : ""})
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </main>

        {/* Vault Modal */}
        <Vault isOpen={vaultOpen} onClose={() => setVaultOpen(false)} />
      </div>
    </AuthGuard>
  );
}
