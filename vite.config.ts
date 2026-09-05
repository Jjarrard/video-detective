import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { youtubeSource } from "./server/youtube-source.js";

export default defineConfig({
  plugins: [react(), youtubeSource()],
});
