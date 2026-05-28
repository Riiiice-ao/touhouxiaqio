(function registerItemManager(global) {
  const { GAME_HEIGHT, GAME_WIDTH, MAX_BOMB_STOCK } = global.Config;

  const ITEM_TYPE_POINTS = 1;
  const ITEM_TYPE_BOMB = 2;

  class ItemManager {
    constructor() {
      this.pool = this.createPool(96);
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
        player.addBombCharge(1);
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

        if (type === ITEM_TYPE_POINTS) {
          ctx.fillStyle = "#ffd34f";
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.65)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (type === ITEM_TYPE_BOMB) {
          ctx.fillStyle = "#53ff8a";
          ctx.beginPath();
          ctx.moveTo(x, y - 8);
          ctx.lineTo(x + 8, y);
          ctx.lineTo(x, y + 8);
          ctx.lineTo(x - 8, y);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.75)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
  }

  global.ItemManager = ItemManager;
})(window.XTouhouWeb);
