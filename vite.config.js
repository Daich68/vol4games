import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// dev-плагин: POST /__snap c base64-кадром канваса → файл .snap.jpg
// (визуальная отладка сцен, когда окно превью скрыто и rAF спит)
const snapPlugin = {
  name: "vol4-snap",
  configureServer(server) {
    server.middlewares.use("/__snap", (req, res) => {
      if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
      let body = "";
      req.on("data", c => { body += c; });
      req.on("end", () => {
        try {
          const b64 = body.replace(/^data:image\/\w+;base64,/, "");
          writeFileSync(resolve(__dirname, ".snap.jpg"), Buffer.from(b64, "base64"));
          res.end("ok");
        } catch (e) { res.statusCode = 500; res.end(String(e)); }
      });
    });
  },
};

export default defineConfig({
  plugins: [snapPlugin],
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
