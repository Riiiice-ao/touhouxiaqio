(function registerAssetLoader(global) {
  class AssetLoader {
    constructor() {
      this.assetMap = {
        bgLayer: { src: "./image/rose.png", chromaKey: false },
        playerSpriteSheet: { src: "./image/bobo.png", chromaKey: true },
        boss: { src: "./image/zhizhi.png", chromaKey: true },
        enemyA: { src: "./image/xiaqio.png", chromaKey: true },
        enemyB: { src: "./image/xiaqio.png", chromaKey: true },
        enemyC: { src: "./image/xiaqio.png", chromaKey: true },
      };
      this.images = {};
      this.originalImages = {};
    }

    loadAll(onProgress) {
      const entries = Object.entries(this.assetMap);
      let loadedCount = 0;
      let resolvedCount = 0;

      return new Promise((resolve) => {
        const finishOne = () => {
          resolvedCount += 1;
          if (onProgress) {
            onProgress(loadedCount, entries.length);
          }
          if (resolvedCount >= entries.length) {
            resolve(this.images);
          }
        };

        entries.forEach(([key, descriptor]) => {
          const image = new Image();
          image.onload = () => {
            loadedCount += 1;
            this.originalImages[key] = image;
            this.images[key] = descriptor.chromaKey ? this.createMaskedCanvas(image) : image;
            finishOne();
          };
          image.onerror = () => {
            this.originalImages[key] = null;
            this.images[key] = null;
            finishOne();
          };
          image.src = descriptor.src;
        });
      });
    }

    createMaskedCanvas(image) {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const isWhiteBackdrop = r > 228 && g > 228 && b > 228;
        const isGuideBlue = r < 120 && g > 140 && b > 190;

        if (isWhiteBackdrop || isGuideBlue) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas;
    }

    get(key) {
      return this.images[key] || null;
    }
  }

  global.AssetLoader = AssetLoader;
})(window.XTouhouWeb);
