import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Прокси настроен автоматически: фронтенд ходит по относительным путям
// (/api/..., /files/...), Vite перенаправляет их на FastAPI (localhost:8000).
// Ручная настройка API_URL не требуется.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    open: true, // автооткрытие браузера при start.bat / npm run dev
    hmr: {
      port: 3000,
    },
    proxy: {
      // REST API бэкенда (FastAPI, :8000)
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      // Загруженные файлы: макеты (data/mockups) и вложения ТЗ (data/attachments)
      "/files": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
