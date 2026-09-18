import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Load .env.local into process.env for Node dev server
const envLocalPath = resolve(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        shop: resolve(__dirname, 'shop.html'),
        product: resolve(__dirname, 'product.html'),
        cart: resolve(__dirname, 'cart.html'),
        thanks: resolve(__dirname, 'thanks/index.html'),
        notFound: resolve(__dirname, '404.html'),
        adminLogin: resolve(__dirname, 'admin/login.html'),
        adminDashboard: resolve(__dirname, 'admin/index.html'),
        adminProducts: resolve(__dirname, 'admin/products/index.html'),
        adminProductNew: resolve(__dirname, 'admin/products/new.html'),
        adminProductEdit: resolve(__dirname, 'admin/products/edit.html'),
        adminCategories: resolve(__dirname, 'admin/categories/index.html'),
        adminSettings: resolve(__dirname, 'admin/settings/index.html')
      }
    }
  },
  plugins: [
    {
      name: 'jacmat-api-dev-server',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url.startsWith('/api/')) {
            try {
              const { handleApiRequest } = await import('./lib/api-router.js');
              await handleApiRequest(req, res);
            } catch (err) {
              console.error('[API Middleware Error]', err);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Server error' }));
              }
            }
            return;
          }
          next();
        });
      }
    },
    {
      name: 'copy-jacmat-assets',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist');
        if (!fs.existsSync(distDir)) return;

        // Copy products.json
        if (fs.existsSync(resolve(__dirname, 'products.json'))) {
          fs.copyFileSync(resolve(__dirname, 'products.json'), resolve(distDir, 'products.json'));
        }

        // Copy images folder
        const imagesSrc = resolve(__dirname, 'images');
        const imagesDist = resolve(distDir, 'images');
        if (fs.existsSync(imagesSrc)) {
          fs.cpSync(imagesSrc, imagesDist, { recursive: true });
        }

        // Copy root assets
        const rootAssets = [
          'logo.png',
          'logo white.png',
          'hero-image.jpg',
          'favicon.ico',
          'cart.png',
          'cart black.png',
          'CART40PX.png',
          'whatsapp-icon.png',
          'instagram-icon.png'
        ];

        rootAssets.forEach((file) => {
          const srcPath = resolve(__dirname, file);
          if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, resolve(distDir, file));
          }
        });
      }
    }
  ]
});
