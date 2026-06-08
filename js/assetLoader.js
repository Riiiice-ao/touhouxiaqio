(function registerAssetLoader(global) {
  class AssetLoader {
    constructor() {
      this.assetMap = {
        bgLayer: { src: "./image/rose.png", chromaKey: false },
        bgStage1: { src: "./image/bath.PNG", chromaKey: false },
        bgStage2: { src: "./image/rose.png", chromaKey: false },
        playerSpriteSheet: {
          src: "./image/bobo.png",
          chromaKey: true,
          maskCells: [
            { x: 220, y: 326, w: 1032, h: 312, rows: 1, cols: 4 },
            { x: 220, y: 1096, w: 1032, h: 326, rows: 1, cols: 4 },
            { x: 1288, y: 720, w: 1008, h: 324, rows: 1, cols: 4 },
          ],
        },
        boss: {
          src: "./image/zhizhi.png",
          chromaKey: true,
          maskCells: [
            { x: 1260, y: 310, w: 1010, h: 330, rows: 1, cols: 4 },
            { x: 1260, y: 704, w: 1010, h: 344, rows: 1, cols: 4 },
          ],
        },
        bossStage1: {
          src: "./image/ratio1.png",
          chromaKey: true,
          maskCells: [
            { x: 1260, y: 310, w: 1010, h: 330, rows: 1, cols: 4 },
            { x: 1260, y: 704, w: 1010, h: 344, rows: 1, cols: 4 },
          ],
        },
        bossStage2: {
          src: "./image/zhizhi.png",
          chromaKey: true,
          maskCells: [
            { x: 1260, y: 310, w: 1010, h: 330, rows: 1, cols: 4 },
            { x: 1260, y: 704, w: 1010, h: 344, rows: 1, cols: 4 },
          ],
        },
        enemyA: {
          src: "./image/xiaqio.png",
          chromaKey: true,
          maskCells: [
            { x: 14, y: 14, w: 240, h: 278, rows: 1, cols: 1 },
            { x: 284, y: 12, w: 236, h: 280, rows: 1, cols: 1 },
            { x: 20, y: 364, w: 224, h: 294, rows: 1, cols: 1 },
          ],
        },
        enemyB: {
          src: "./image/xiaqio.png",
          chromaKey: true,
          maskCells: [
            { x: 14, y: 14, w: 240, h: 278, rows: 1, cols: 1 },
            { x: 284, y: 12, w: 236, h: 280, rows: 1, cols: 1 },
            { x: 20, y: 364, w: 224, h: 294, rows: 1, cols: 1 },
          ],
        },
        enemyC: {
          src: "./image/xiaqio.png",
          chromaKey: true,
          maskCells: [
            { x: 14, y: 14, w: 240, h: 278, rows: 1, cols: 1 },
            { x: 284, y: 12, w: 236, h: 280, rows: 1, cols: 1 },
            { x: 20, y: 364, w: 224, h: 294, rows: 1, cols: 1 },
          ],
        },
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
            this.images[key] = descriptor.chromaKey ? this.createMaskedCanvas(image, descriptor) : image;
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

    createMaskedCanvas(image, descriptor = {}) {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      const isBackdropPixel = (index) => {
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const isWhiteBackdrop = r > 228 && g > 228 && b > 228;
        const isGuideBlue = r < 120 && g > 140 && b > 190;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const isPaleBackdrop = max > 206 && max - min < 48;
        return isWhiteBackdrop || isGuideBlue || isPaleBackdrop;
      };

      const clearCellBackground = (cell) => {
        const cellX = Math.max(0, Math.floor(cell.x));
        const cellY = Math.max(0, Math.floor(cell.y));
        const cellW = Math.max(1, Math.min(width - cellX, Math.ceil(cell.w)));
        const cellH = Math.max(1, Math.min(height - cellY, Math.ceil(cell.h)));
        const visited = new Uint8Array(cellW * cellH);
        const queue = new Int32Array(cellW * cellH);
        let head = 0;
        let tail = 0;

        const pushIfBackdrop = (localX, localY) => {
          if (localX < 0 || localX >= cellW || localY < 0 || localY >= cellH) {
            return;
          }

          const localPixel = localY * cellW + localX;
          if (visited[localPixel]) {
            return;
          }

          const pixel = (cellY + localY) * width + cellX + localX;
          if (!isBackdropPixel(pixel * 4)) {
            return;
          }

          visited[localPixel] = 1;
          queue[tail] = localPixel;
          tail += 1;
        };

        for (let x = 0; x < cellW; x += 1) {
          pushIfBackdrop(x, 0);
          pushIfBackdrop(x, cellH - 1);
        }

        for (let y = 0; y < cellH; y += 1) {
          pushIfBackdrop(0, y);
          pushIfBackdrop(cellW - 1, y);
        }

        while (head < tail) {
          const localPixel = queue[head];
          head += 1;
          const x = localPixel % cellW;
          const y = Math.floor(localPixel / cellW);

          pushIfBackdrop(x - 1, y);
          pushIfBackdrop(x + 1, y);
          pushIfBackdrop(x, y - 1);
          pushIfBackdrop(x, y + 1);
        }

        for (let localPixel = 0; localPixel < visited.length; localPixel += 1) {
          if (!visited[localPixel]) {
            continue;
          }

          const x = localPixel % cellW;
          const y = Math.floor(localPixel / cellW);
          const pixel = (cellY + y) * width + cellX + x;
          data[pixel * 4 + 3] = 0;
        }
      };

      const clearRegionCells = (region) => {
        const rows = Math.max(1, region.rows || 1);
        const cols = Math.max(1, region.cols || 1);
        const cellWidth = region.w / cols;
        const cellHeight = region.h / rows;

        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            clearCellBackground({
              x: region.x + col * cellWidth,
              y: region.y + row * cellHeight,
              w: cellWidth,
              h: cellHeight,
            });
          }
        }
      };

      const maskCells = descriptor.maskCells || [{ x: 0, y: 0, w: width, h: height, rows: 1, cols: 1 }];
      for (let i = 0; i < maskCells.length; i += 1) {
        clearRegionCells(maskCells[i]);
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas;
    }

    createAutoSpriteSheet(key, options = {}) {
      const source = this.images[key] || this.originalImages[key];
      if (!source) {
        return null;
      }

      const sheet = this.ensureCanvas(source);
      const columns = options.columns || this.detectColumns(sheet);
      const rows = options.rows || Math.max(1, Math.round(sheet.height / Math.max(1, sheet.width / columns)));
      const cellWidth = Math.floor(sheet.width / columns);
      const cellHeight = Math.floor(sheet.height / rows);
      const frames = [];

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const sx = column * cellWidth;
          const sy = row * cellHeight;
          const bounds = this.extractOpaqueBounds(sheet, sx, sy, cellWidth, cellHeight);
          if (!bounds) {
            continue;
          }

          frames.push({
            x: sx + bounds.x,
            y: sy + bounds.y,
            w: bounds.w,
            h: bounds.h,
            cx: bounds.x + bounds.w * 0.5,
            cy: bounds.y + bounds.h * 0.5,
            row,
            column,
          });
        }
      }

      return {
        image: sheet,
        rows,
        columns,
        cellWidth,
        cellHeight,
        frames: frames.length > 0 ? frames : [{ x: 0, y: 0, w: sheet.width, h: sheet.height, cx: sheet.width * 0.5, cy: sheet.height * 0.5, row: 0, column: 0 }],
      };
    }

    ensureCanvas(source) {
      if (source.getContext) {
        return source;
      }

      const canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, 0, 0);
      return canvas;
    }

    detectColumns(sheet) {
      const ratio = sheet.width / Math.max(1, sheet.height);
      if (ratio >= 3.4) {
        return 4;
      }
      if (ratio >= 2.4) {
        return 3;
      }
      return 2;
    }

    extractOpaqueBounds(sheet, sx, sy, width, height) {
      const ctx = sheet.getContext("2d");
      const imageData = ctx.getImageData(sx, sy, width, height);
      const data = imageData.data;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          if (data[index + 3] <= 18) {
            continue;
          }

          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }

      if (maxX < minX || maxY < minY) {
        return null;
      }

      const padding = 1;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(width - 1, maxX + padding);
      maxY = Math.min(height - 1, maxY + padding);

      return {
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
      };
    }

    get(key) {
      return this.images[key] || null;
    }

    getStageBackground(stage) {
      return this.get(stage === 1 ? "bgStage1" : "bgStage2") || this.get("bgLayer");
    }
  }

  global.AssetLoader = AssetLoader;
})(window.XTouhouWeb);
