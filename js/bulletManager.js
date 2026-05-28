(function registerBulletManager(global) {
  const {
    BULLET_DESPAWN_PADDING,
    GAME_HEIGHT,
    GAME_WIDTH,
    MAX_BULLETS,
    MAX_PLAYER_BULLETS,
  } = global.Config;

  const BulletBehavior = {
    NONE: 0,
    RETARGET_ONCE: 1,
    SPLIT_BURST: 2,
    DELAYED_RANDOM: 3,
  };

  const Palette = global.RosePalette || {
    roseRed: "#D21F3C",
    crimson: "#99001A",
    gold: "#FFD700",
    antiqueGold: "#D4AF37",
    velvet: "#4A0E17",
    moon: "#FFFDD0",
  };

  global.BulletBehavior = BulletBehavior;

  class BulletManager {
    constructor(audioManager) {
      this.audioManager = audioManager;
      this.enemyPool = this.createPool(MAX_BULLETS);
      this.playerPool = this.createPool(MAX_PLAYER_BULLETS);
      this.globalSpeedScale = 1;
    }

    createPool(capacity) {
      const pool = {
        capacity,
        count: 0,
        x: new Float32Array(capacity),
        y: new Float32Array(capacity),
        vx: new Float32Array(capacity),
        vy: new Float32Array(capacity),
        radius: new Float32Array(capacity),
        damage: new Float32Array(capacity),
        behaviorType: new Uint8Array(capacity),
        behaviorState: new Uint8Array(capacity),
        lifeTimer: new Float32Array(capacity),
        param0: new Float32Array(capacity),
        param1: new Float32Array(capacity),
        param2: new Float32Array(capacity),
        param3: new Float32Array(capacity),
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

    spawnBullet(x, y, vx, vy, radius, color, damage = 1, behavior = null) {
      return this.spawnFromPool(this.enemyPool, x, y, vx, vy, radius, color, damage, behavior);
    }

    spawnPlayerBullet(x, y, vx, vy, radius, color, damage = 1, behavior = null) {
      return this.spawnFromPool(this.playerPool, x, y, vx, vy, radius, color, damage, behavior);
    }

    spawnFromPool(pool, x, y, vx, vy, radius, color, damage, behavior) {
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
      pool.damage[slot] = damage;
      pool.colors[slot] = color;
      pool.behaviorType[slot] = behavior?.type ?? BulletBehavior.NONE;
      pool.behaviorState[slot] = behavior?.state ?? 0;
      pool.lifeTimer[slot] = 0;
      pool.param0[slot] = behavior?.param0 ?? 0;
      pool.param1[slot] = behavior?.param1 ?? 0;
      pool.param2[slot] = behavior?.param2 ?? 0;
      pool.param3[slot] = behavior?.param3 ?? 0;
      pool.active[slot] = 1;
      pool.grazed[slot] = 0;

      pool.activeIndices[pool.count] = slot;
      pool.activePositions[slot] = pool.count;
      pool.count += 1;

      return slot;
    }

    update(deltaTime, player, enemyManager, bossController) {
      const count = this.enemyPool.count;
      if (count > 420) {
        this.globalSpeedScale = Math.max(0.35, 1 - (count - 420) / 1200);
      } else {
        this.globalSpeedScale = 1;
      }

      this.updateEnemyBullets(deltaTime, player);
      this.updatePlayerBullets(deltaTime, enemyManager, bossController, player);
    }

    updateEnemyBullets(deltaTime, player) {
      const pool = this.enemyPool;
      let i = 0;

      while (i < pool.count) {
        const slot = pool.activeIndices[i];

        if (player.isFatalBulletSlot(slot)) {
          i += 1;
          continue;
        }

        pool.lifeTimer[slot] += deltaTime;
        if (this.updateEnemyBulletBehavior(slot, deltaTime, player)) {
          continue;
        }

        pool.x[slot] += pool.vx[slot] * deltaTime * this.globalSpeedScale;
        pool.y[slot] += pool.vy[slot] * deltaTime * this.globalSpeedScale;

        if (this.isOutOfBounds(pool.x[slot], pool.y[slot])) {
          this.recycle(pool, slot);
          continue;
        }

        if (player.isDying) {
          i += 1;
          continue;
        }

        const dx = pool.x[slot] - player.x;
        const dy = pool.y[slot] - player.y;
        const distance = Math.hypot(dx, dy);

        if (distance < player.deathRadius + pool.radius[slot]) {
          player.takeDamage(slot);
          continue;
        }

        if (!pool.grazed[slot] && distance < player.grazeRadius + pool.radius[slot]) {
          pool.grazed[slot] = 1;
          player.triggerGraze();
          if (this.audioManager) {
            this.audioManager.playGrazeSfx();
          }
        }

        i += 1;
      }
    }

    updateEnemyBulletBehavior(slot, deltaTime, player) {
      const pool = this.enemyPool;
      const behaviorType = pool.behaviorType[slot];

      if (behaviorType === BulletBehavior.NONE) {
        return false;
      }

      if (behaviorType === BulletBehavior.RETARGET_ONCE) {
        if (pool.behaviorState[slot] === 0 && pool.lifeTimer[slot] >= pool.param0[slot]) {
          const angle = Math.atan2(player.y - pool.y[slot], player.x - pool.x[slot]);
          const speed = pool.param1[slot];
          pool.vx[slot] = Math.cos(angle) * speed;
          pool.vy[slot] = Math.sin(angle) * speed;
          pool.behaviorState[slot] = 1;
        }
        return false;
      }

      if (behaviorType === BulletBehavior.SPLIT_BURST) {
        if (pool.lifeTimer[slot] >= pool.param0[slot]) {
          this.explodeSplitBurst(slot);
          return true;
        }
        return false;
      }

      if (behaviorType === BulletBehavior.DELAYED_RANDOM) {
        if (pool.behaviorState[slot] === 0) {
          const dragFactor = Math.max(0, 1 - pool.param3[slot] * deltaTime);
          pool.vx[slot] *= dragFactor;
          pool.vy[slot] *= dragFactor;

          if (pool.lifeTimer[slot] >= pool.param0[slot]) {
            pool.vx[slot] = 0;
            pool.vy[slot] = 0;
            pool.behaviorState[slot] = 1;
            pool.lifeTimer[slot] = 0;
          }
          return false;
        }

        if (pool.behaviorState[slot] === 1 && pool.lifeTimer[slot] >= pool.param1[slot]) {
          const randomAngle = Math.random() * Math.PI * 2;
          const speed = pool.param2[slot];
          pool.vx[slot] = Math.cos(randomAngle) * speed;
          pool.vy[slot] = Math.sin(randomAngle) * speed;
          pool.behaviorState[slot] = 2;
          pool.lifeTimer[slot] = 0;
        }

        return false;
      }

      return false;
    }

    explodeSplitBurst(slot) {
      const pool = this.enemyPool;
      const x = pool.x[slot];
      const y = pool.y[slot];
      const count = Math.max(1, Math.round(pool.param1[slot]));
      const speed = pool.param2[slot] * 0.65;
      const step = (Math.PI * 2) / count;
      const startAngle = (pool.lifeTimer[slot] * 4.7) % (Math.PI * 2);

      this.recycle(pool, slot);

      for (let i = 0; i < count; i += 1) {
        const angle = startAngle + step * i;
        this.spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 5, "PETAL_SPLINTER");
      }
    }

    updatePlayerBullets(deltaTime, enemyManager, bossController, player) {
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

        if (
          enemyManager &&
          enemyManager.checkBulletHit(pool.x[slot], pool.y[slot], pool.radius[slot], pool.damage[slot], player)
        ) {
          if (this.audioManager) {
            this.audioManager.playHitSfx();
          }
          this.recycle(pool, slot);
          continue;
        }

        if (
          bossController &&
          bossController.checkBulletHit(pool.x[slot], pool.y[slot], pool.radius[slot], pool.damage[slot], player)
        ) {
          if (this.audioManager) {
            this.audioManager.playHitSfx();
          }
          this.recycle(pool, slot);
          continue;
        }

        i += 1;
      }
    }

    clearEnemyBullets() {
      const pool = this.enemyPool;
      while (pool.count > 0) {
        const slot = pool.activeIndices[0];
        this.recycle(pool, slot);
      }
    }

    clearEnemyBulletBySlot(slot) {
      if (this.enemyPool.activePositions[slot] >= 0) {
        this.recycle(this.enemyPool, slot);
      }
    }

    clearEnemyBulletsInRadius(centerX, centerY, radius) {
      const pool = this.enemyPool;
      let i = 0;

      while (i < pool.count) {
        const slot = pool.activeIndices[i];
        const dx = pool.x[slot] - centerX;
        const dy = pool.y[slot] - centerY;
        const bulletRadius = pool.radius[slot];

        if (dx * dx + dy * dy <= (radius + bulletRadius) * (radius + bulletRadius)) {
          this.recycle(pool, slot);
          continue;
        }

        i += 1;
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
      pool.damage[slot] = 0;
      pool.behaviorType[slot] = BulletBehavior.NONE;
      pool.behaviorState[slot] = 0;
      pool.lifeTimer[slot] = 0;
      pool.param0[slot] = 0;
      pool.param1[slot] = 0;
      pool.param2[slot] = 0;
      pool.param3[slot] = 0;
      pool.freeIndices[pool.freeTop] = slot;
      pool.freeTop += 1;
    }

    render(ctx) {
      this.renderEnemyPool(ctx);
      this.renderPlayerPool(ctx);
    }

    renderEnemyPool(ctx) {
      const pool = this.enemyPool;
      for (let i = 0; i < pool.count; i += 1) {
        const slot = pool.activeIndices[i];
        const x = pool.x[slot];
        const y = pool.y[slot];
        const radius = pool.radius[slot];
        const color = pool.colors[slot];

        if (color === "ROSE_MOTHER") {
          this.drawRoseBloom(ctx, x, y, pool.vx[slot], pool.vy[slot], radius);
          continue;
        }

        if (
          color === "PETAL_DARK" ||
          color === "PETAL_GOLD" ||
          color === "PETAL_SPLINTER" ||
          color === "ROSE_GILDED" ||
          color === Palette.crimson ||
          color === Palette.antiqueGold
        ) {
          this.drawRosePetal(ctx, x, y, pool.vx[slot], pool.vy[slot], radius + 6, color);
          continue;
        }

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    renderPlayerPool(ctx) {
      const pool = this.playerPool;
      for (let i = 0; i < pool.count; i += 1) {
        const slot = pool.activeIndices[i];
        ctx.beginPath();
        ctx.fillStyle = pool.colors[slot];
        ctx.arc(pool.x[slot], pool.y[slot], pool.radius[slot], 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawRosePetal(ctx, x, y, vx, vy, size, colorKey) {
      const angle = Math.atan2(vy || 0.0001, vx || 0.0001);
      const colors = this.getPetalColors(colorKey);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      const gradient = ctx.createRadialGradient(-size * 0.18, 0, size * 0.12, 0, 0, size * 1.05);
      gradient.addColorStop(0, colors.center);
      gradient.addColorStop(0.62, colors.mid);
      gradient.addColorStop(1, colors.edge);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(-size * 0.92, 0);
      ctx.bezierCurveTo(-size * 0.48, -size * 0.98, size * 0.34, -size * 0.76, size * 0.9, -size * 0.12);
      ctx.bezierCurveTo(size * 1.03, -size * 0.02, size * 1.03, size * 0.02, size * 0.9, size * 0.12);
      ctx.bezierCurveTo(size * 0.34, size * 0.76, -size * 0.48, size * 0.98, -size * 0.92, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = Math.max(1, size * 0.09);
      ctx.stroke();

      ctx.restore();
    }

    drawRoseBloom(ctx, x, y, vx, vy, size) {
      const angle = Math.atan2(vy || 0.0001, vx || 0.0001);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      for (let i = 0; i < 6; i += 1) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * i) / 6);
        this.drawRosePetal(ctx, 0, 0, 1, 0, size * (0.88 - i * 0.04), i % 2 === 0 ? "PETAL_DARK" : "PETAL_GOLD");
        ctx.restore();
      }

      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
      core.addColorStop(0, Palette.gold);
      core.addColorStop(0.5, Palette.antiqueGold);
      core.addColorStop(1, Palette.velvet);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    getPetalColors(colorKey) {
      if (colorKey === "PETAL_GOLD") {
        return {
          center: Palette.velvet,
          mid: Palette.gold,
          edge: Palette.antiqueGold,
          highlight: Palette.moon,
        };
      }

      if (colorKey === "ROSE_GILDED") {
        return {
          center: Palette.crimson,
          mid: Palette.roseRed,
          edge: Palette.gold,
          highlight: Palette.moon,
        };
      }

      if (colorKey === "PETAL_SPLINTER") {
        return {
          center: Palette.velvet,
          mid: Palette.crimson,
          edge: Palette.roseRed,
          highlight: Palette.moon,
        };
      }

      return {
        center: Palette.velvet,
        mid: Palette.crimson,
        edge: Palette.roseRed,
        highlight: Palette.moon,
      };
    }
  }

  global.BulletManager = BulletManager;
})(window.XTouhouWeb);
