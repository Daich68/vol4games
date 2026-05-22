import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // base: "/", // при необходимости поменять на "/vol4/" и т.п.
  build: {
    rollupOptions: {
      input: {
        main:       resolve(__dirname, "index.html"),
        stalagmit:  resolve(__dirname, "games/stalagmit/index.html"),
        "nancy-drew": resolve(__dirname, "games/nancy-drew/index.html"),
        birds:      resolve(__dirname, "games/birds/index.html"),
        prizma:     resolve(__dirname, "games/prizma/index.html"),
      },
    },
  },
  server: {
    host: "127.0.0.1", // принудительно IPv4 — иначе Chrome ловит ERR_CONNECTION_REFUSED
    open: true,
  },
});
