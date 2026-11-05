// Public tile settings only; browser caching and Referer headers remain unchanged.
export const streetTiles = {
  url: process.env.NEXT_PUBLIC_MAP_TILES_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  options: {
    maxZoom: 19,
    attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};
export const satelliteTiles = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  options: { maxZoom: 19, attribution: "Tiles &copy; Esri — Esri, Maxar, Earthstar Geographics, and the GIS User Community" },
};
