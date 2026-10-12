export const CATEGORIES = {
  url: {
    name: "URL Downloader",
    description: "Extract high quality media from public URLs.",
    icon: "Link"
  }
};

export const toolsRegistry = [
  {
    id: "url-downloader",
    name: "URL Media Downloader",
    description: "Download high quality video and audio from supported public URLs.",
    category: "url",
    route: "/url-downloader",
    keywords: ["video downloader", "youtube", "instagram", "facebook", "tiktok", "mp4", "mp3", "extract media"],
    implemented: true,
    isPopular: true
  }
];

export function getToolById(id) {
  return toolsRegistry.find((t) => t.id === id);
}

export function getPopularTools() {
  return toolsRegistry.filter((t) => t.isPopular);
}

export function getToolsByCategory(category) {
  return toolsRegistry.filter((t) => t.category === category);
}

export function searchTools(query) {
  if (!query || !query.trim()) return toolsRegistry;
  const q = query.toLowerCase().trim();
  return toolsRegistry.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.toLowerCase().includes(q))
  );
}

export function getRelatedTools(toolId, limit = 3) {
  return [];
}

