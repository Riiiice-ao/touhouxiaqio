(function registerItemManager(global) {
  const { GAME_HEIGHT, GAME_WIDTH } = global.Config;

  const ITEM_TYPE_POINTS = 1;
  const ITEM_TYPE_BOMB = 2;

  class ItemManager {
    constructor() {
      this.pool = this.createPool(128);
      this.gravity = 220;
      this.magnetRange = 120;
      this.pickupRange = 15;
    }

    createPool(capacity) {
      return {
        capacity,
        count: 0,
        x: new Float32Array(capacity),
        y: new Float32Array(capacity),
        vx: new Float32Array(capacity),
        vy: new Float32Array(capacity),
        attractSpeed: new Float32Array(capacity),
        type: new Uint8Array(capacity),
        attracted: new Uint8Array(capacity),
        activeIndices: new Int32Array(capacity),
        activePositions: new Int32Array(capacity),
        freeIndices: Int32Array.from({ length: capacity }, (_, i) => capacity - 1 - i),
        freeTop: capacity,
      };
    }

    spawnDrops(x, y) {
      const pointCount = Math.random() < 0.5 ? 1 : 2;
      for (let i = 0; i < pointCount; i += 1) {
        this.spawnItem(
          ITEM_TYPE_POINTS,
          x + (Math.random() - 0.5) * 18,
          y + (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 60,
          -90 - Math.random() * 40
        );
      }

      if (Math.random() < 0.05) {
        this.spawnItem(
          ITEM_TYPE_BOMB,
          x + (Math.random() - 0.5) * 14,
          y + (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 50,
          -110 - Math.random() * 30
        );
      }
    }

    spawnBossRewardBurst(x, y, count = 30) {
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
        const speed = 70 + Math.random() * 110;
        this.spawnItem(
          ITEM_TYPE_POINTS,
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 80
        );
      }
    }

    spawnItem(type, x, y, vx, vy) {
      const pool = this.pool;
      if (pool.freeTop <= 0) {
        return;
      }

      const slot = pool.freeIndices[pool.freeTop - 1];
      pool.freeTop -= 1;

      pool.x[slot] = x;
      pool.y[slot] = y;
      pool.vx[slot] = vx;
      pool.vy[slot] = vy;
      pool.type[slot] = type;
      pool.attracted[slot] = 0;
      pool.attractSpeed[slot] = 60;

      pool.activeIndices[pool.count] = slot;
      pool.activePositions[slot] = pool.count;
      pool.count += 1;
    }

    update(deltaTime, player) {
      const pool = this.pool;
      let i = 0;

      while (i < pool.count) {
        const slot = pool.activeIndices[i];
        const dx = player.x - pool.x[slot];
        const dy = player.y - pool.y[slot];
        const distance = Math.hypot(dx, dy);

        if (!pool.attracted[slot] && distance < this.magnetRange) {
          pool.attracted[slot] = 1;
          pool.attractSpeed[slot] = 120;
        }

        if (pool.attracted[slot]) {
          const length = distance || 1;
          pool.attractSpeed[slot] += 900 * deltaTime;
          const speed = pool.attractSpeed[slot];
          pool.vx[slot] = (dx / length) * speed;
          pool.vy[slot] = (dy / length) * speed;
        } else {
          pool.vy[slot] += this.gravity * deltaTime;
        }

        pool.x[slot] += pool.vx[slot] * deltaTime;
        pool.y[slot] += pool.vy[slot] * deltaTime;

        if (distance < this.pickupRange) {
          this.collect(slot, player);
          continue;
        }

        if (pool.y[slot] > GAME_HEIGHT + 40 || pool.x[slot] < -40 || pool.x[slot] > GAME_WIDTH + 40) {
          this.recycle(slot);
          continue;
        }

        i += 1;
      }
    }

    collect(slot, player) {
      const type = this.pool.type[slot];
      if (type === ITEM_TYPE_POINTS) {
        player.addScore(1500);
      } else if (type === ITEM_TYPE_BOMB) {
        const before = player.bombStock;
        player.addBombCharge(1);
        if (before >= player.maxBombStock) {
          player.addScore(3000);
        }
      }
      this.recycle(slot);
    }

    clearAll() {
      while (this.pool.count > 0) {
        this.recycle(this.pool.activeIndices[0]);
      }
    }

    recycle(slot) {
      const pool = this.pool;
      const removePosition = pool.activePositions[slot];
      const lastPosition = pool.count - 1;
      const lastSlot = pool.activeIndices[lastPosition];

      pool.activeIndices[removePosition] = lastSlot;
      pool.activePositions[lastSlot] = removePosition;
      pool.count = lastPosition;
      pool.activePositions[slot] = -1;

      pool.freeIndices[pool.freeTop] = slot;
      pool.freeTop += 1;
    }

    render(ctx) {
      const pool = this.pool;

      for (let i = 0; i < pool.count; i += 1) {
        const slot = pool.activeIndices[i];
        const x = pool.x[slot];
        const y = pool.y[slot];
        const type = pool.type[slot];

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(pool.attracted[slot] ? 0.08 * i : 0);

        if (type === ITEM_TYPE_POINTS) {
          ctx.fillStyle = "#ffd34f";
          ctx.fillRect(-7, -7, 14, 14);
          ctx.fillStyle = "#412400";
          ctx.font = "bold 10px Trebuchet MS";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("P", 0, 1);
        } else if (type === ITEM_TYPE_BOMB) {
          ctx.fillStyle = "#53ff8a";
          ctx.fillRect(-8, -8, 16, 16);
          ctx.fillStyle = "#093b20";
          ctx.font = "bold 10px Trebuchet MS";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("B", 0, 1);
        }

        ctx.restore();
      }
    }
  }

  global.ItemManager = ItemManager;
})(window.XTouhouWeb);
