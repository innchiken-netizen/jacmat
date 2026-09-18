import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

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
        notFound: resolve(__dirname, '404.html')
      }
    }
  },
  plugins: [
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
