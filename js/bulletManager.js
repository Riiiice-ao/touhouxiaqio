(function registerBulletManager(global) {
  const {
    BULLET_DESPAWN_PADDING,
    GAME_HEIGHT,
    GAME_WIDTH,
    MAX_BULLETS,
    MAX_PLAYER_BULLETS,
  } = global.Config;

  /**
   * 子弹管理器。
   *
   * 设计目标：
   * 1. 不用 DOM 渲染子弹
   * 2. 不在每帧 new / delete 子弹对象
   * 3. 子弹核心数据放进扁平数组，便于统一更新和绘制
   * 4. 通过“空闲槽位栈 + 活跃索引表”模拟对象池
   */
  class BulletManager {
    constructor() {
      this.enemyPool = this.createPool(MAX_BULLETS);
      this.playerPool = this.createPool(MAX_PLAYER_BULLETS);
    }

    /**
     * 创建一组固定容量的扁平数组池。
     * 每个索引槽位就代表一颗子弹。
     */
    createPool(capacity) {
      const pool = {
        capacity,
        count: 0,
        x: new Float32Array(capacity),
        y: new Float32Array(capacity),
        vx: new Float32Array(capacity),
        vy: new Float32Array(capacity),
        radius: new Float32Array(capacity),
        active: new Uint8Array(capacity),
        grazed: new Uint8Array(capacity),
        activeIndices: new Int32Array(capacity),
        activePositions: new Int32Array(capacity),
        freeIndices: new Int32Array(capacity),
        colors: new Array(capacity),
        freeTop: capacity,
      };

      for (let i = 0; i < capacity; i += 1) {
        pool.freeIndices[i] = capacity - 1 - i;
        pool.activePositions[i] = -1;
        pool.colors[i] = "#ffffff";
      }

      return pool;
    }

    /**
     * 生成敌方子弹。
     */
    spawnBullet(x, y, vx, vy, radius, color) {
      return this.spawnFromPool(this.enemyPool, x, y, vx, vy, radius, color);
    }

    /**
     * 生成玩家子弹。
     */
    spawnPlayerBullet(x, y, vx, vy, radius, color) {
      return this.spawnFromPool(this.playerPool, x, y, vx, vy, radius, color);
    }

    /**
     * 从对象池中取出一个槽位并填入子弹数据。
     * 如果池已经满了，则直接丢弃本次生成请求。
     */
    spawnFromPool(pool, x, y, vx, vy, radius, color) {
      if (pool.freeTop <= 0) {
        return -1;
      }

      const slot = pool.freeIndices[pool.freeTop - 1];
      pool.freeTop -= 1;

      pool.x[slot] = x;
      pool.y[slot] = y;
      pool.vx[slot] = vx;
      pool.vy[slot] = vy;
      pool.radius[slot] = radius;
      pool.colors[slot] = color;
      pool.active[slot] = 1;
      pool.grazed[slot] = 0;

      pool.activeIndices[pool.count] = slot;
      pool.activePositions[slot] = pool.count;
      pool.count += 1;

      return slot;
    }

    /**
     * 每一帧统一更新全部子弹。
     * 敌弹负责做玩家碰撞和擦弹判定，玩家弹这里只做飞行与回收。
     */
    update(deltaTime, player) {
      this.updateEnemyBullets(deltaTime, player);
      this.updatePlayerBullets(deltaTime);
    }

    updateEnemyBullets(deltaTime, player) {
      const pool = this.enemyPool;
      let i = 0;

      while (i < pool.count) {
        const slot = pool.activeIndices[i];

        pool.x[slot] += pool.vx[slot] * deltaTime;
        pool.y[slot] += pool.vy[slot] * deltaTime;

        if (this.isOutOfBounds(pool.x[slot], pool.y[slot])) {
          this.recycle(pool, slot);
          continue;
        }

        const dx = pool.x[slot] - player.x;
        const dy = pool.y[slot] - player.y;
        const distance = Math.hypot(dx, dy);

        if (distance < player.hitboxRadius + pool.radius[slot]) {
          player.takeDamage();
          this.recycle(pool, slot);
          continue;
        }

        if (!pool.grazed[slot] && distance < player.grazeRadius + pool.radius[slot]) {
          pool.grazed[slot] = 1;
          player.triggerGraze();
        }

        i += 1;
      }
    }

    updatePlayerBullets(deltaTime) {
      const pool = this.playerPool;
      let i = 0;

      while (i < pool.count) {
        const slot = pool.activeIndices[i];

        pool.x[slot] += pool.vx[slot] * deltaTime;
        pool.y[slot] += pool.vy[slot] * deltaTime;

        if (this.isOutOfBounds(pool.x[slot], pool.y[slot])) {
          this.recycle(pool, slot);
          continue;
        }

        i += 1;
      }
    }

    /**
     * Bomb 触发时清屏。
     */
    clearEnemyBullets() {
      const pool = this.enemyPool;

      while (pool.count > 0) {
        const slot = pool.activeIndices[0];
        this.recycle(pool, slot);
      }
    }

    isOutOfBounds(x, y) {
      return (
        x < -BULLET_DESPAWN_PADDING ||
        x > GAME_WIDTH + BULLET_DESPAWN_PADDING ||
        y < -BULLET_DESPAWN_PADDING ||
        y > GAME_HEIGHT + BULLET_DESPAWN_PADDING
      );
    }

    /**
     * O(1) 回收。
     * 通过“末尾元素换位”把被删除的活跃槽位移除掉，避免数组 splice。
     */
    recycle(pool, slot) {
      const removePosition = pool.activePositions[slot];
      const lastPosition = pool.count - 1;
      const lastSlot = pool.activeIndices[lastPosition];

      pool.activeIndices[removePosition] = lastSlot;
      pool.activePositions[lastSlot] = removePosition;

      pool.count = lastPosition;
      pool.activePositions[slot] = -1;
      pool.active[slot] = 0;
      pool.grazed[slot] = 0;

      pool.freeIndices[pool.freeTop] = slot;
      pool.freeTop += 1;
    }

    /**
     * 统一渲染所有子弹。
     * 为了减少 beginPath 次数，这里尽量把连续相同颜色的子弹合并在一次 fill 中。
     */
    render(ctx) {
      this.renderPool(ctx, this.enemyPool);
      this.renderPool(ctx, this.playerPool);
    }

    renderPool(ctx, pool) {
      if (pool.count <= 0) {
        return;
      }

      let currentColor = "";
      let hasPath = false;

      for (let i = 0; i < pool.count; i += 1) {
        const slot = pool.activeIndices[i];
        const color = pool.colors[slot];

        if (color !== currentColor) {
          if (hasPath) {
            ctx.fill();
          }

          currentColor = color;
          ctx.fillStyle = currentColor;
          ctx.beginPath();
          hasPath = true;
        }

        ctx.moveTo(pool.x[slot] + pool.radius[slot], pool.y[slot]);
        ctx.arc(pool.x[slot], pool.y[slot], pool.radius[slot], 0, Math.PI * 2);
      }

      if (hasPath) {
        ctx.fill();
      }
    }
  }

  global.BulletManager = BulletManager;
})(window.XTouhouWeb);
