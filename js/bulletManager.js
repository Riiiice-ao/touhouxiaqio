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
    PETAL_RAIN: 4,
  };

  global.BulletBehavior = BulletBehavior;

  const Palette = {
    darkRed: "#99001A",
    velvet: "#4A0E17",
    brightRed: "#D21F3C",
    white: "#FFFDD0",
    orange: "#FF7F50",
    amber: "#D9A63A",
    leaf: "#2E5A1C",
    leafLight: "#59ff9a",
    gold: "#FFD700",
    moon: "#FFFDD0",
  };

  class BulletManager {
    constructor(audioManager) {
      this.audioManager = audioManager;
      this.enemyPool = this.createPool(MAX_BULLETS);
      this.playerPool = this.createPool(MAX_PLAYER_BULLETS);
      this.globalSpeedScale = 1;
      this.difficulty = "easy";
      this.spriteCache = this.initBulletSprites();
      this.burstFx = this.createBurstFxPool(32);
      this.glowSpriteLastUpdate = 0;
    }

    setDifficulty(difficulty) {
      this.difficulty = difficulty;
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

    createBurstFxPool(capacity) {
      const fx = {
        capacity,
        count: 0,
        x: new Float32Array(capacity),
        y: new Float32Array(capacity),
        radius: new Float32Array(capacity),
        life: new Float32Array(capacity),
        maxLife: new Float32Array(capacity),
        activeIndices: new Int32Array(capacity),
        activePositions: new Int32Array(capacity),
        freeIndices: new Int32Array(capacity),
        freeTop: capacity,
      };

      for (let i = 0; i < capacity; i += 1) {
        fx.freeIndices[i] = capacity - 1 - i;
        fx.activePositions[i] = -1;
      }

      return fx;
    }

    initBulletSprites() {
      const createCanvas = (size) => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        return { canvas, ctx, size };
      };

      const cache = {
        darkPetal: createCanvas(96),
        whitePetal: createCanvas(48),
        leafPetal: createCanvas(72),
        orangePetal: createCanvas(84),
        glowPetal: createCanvas(96),
      };

      this.paintDarkPetal(cache.darkPetal.ctx, cache.darkPetal.size);
      this.paintWhitePetal(cache.whitePetal.ctx, cache.whitePetal.size);
      this.paintLeafPetal(cache.leafPetal.ctx, cache.leafPetal.size);
      this.paintOrangePetal(cache.orangePetal.ctx, cache.orangePetal.size);
      this.paintGlowPetal(cache.glowPetal.ctx, cache.glowPetal.size, Date.now());

      return cache;
    }

    paintCommaPetal(ctx, size, colors, options = {}) {
      const w = options.width ?? size * 0.84;
      const h = options.height ?? size * 0.46;
      const cx = size * 0.5;
      const cy = size * 0.5;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(cx, cy);

      const gradient = ctx.createRadialGradient(-w * 0.08, 0, h * 0.06, 0, 0, w * 0.58);
      gradient.addColorStop(0, colors.inner);
      gradient.addColorStop(0.62, colors.mid);
      gradient.addColorStop(1, colors.outer);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(-w * 0.54, 0);
      ctx.bezierCurveTo(-w * 0.32, -h * 1.3, w * 0.08, -h * 1.08, w * 0.44, -h * 0.18);
      ctx.bezierCurveTo(w * 0.56, -h * 0.02, w * 0.58, h * 0.04, w * 0.44, h * 0.18);
      ctx.bezierCurveTo(w * 0.08, h * 1.08, -w * 0.32, h * 1.3, -w * 0.54, 0);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = options.shadowBlur ?? 10;
      ctx.shadowColor = colors.glow;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = options.strokeWidth ?? Math.max(1.2, size * 0.05);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = colors.coreLine;
      ctx.lineWidth = Math.max(0.8, size * 0.03);
      ctx.beginPath();
      ctx.moveTo(-w * 0.24, 0);
      ctx.quadraticCurveTo(w * 0.04, -h * 0.24, w * 0.26, 0);
      ctx.quadraticCurveTo(w * 0.04, h * 0.24, -w * 0.24, 0);
      ctx.stroke();

      ctx.restore();
    }

    paintDarkPetal(ctx, size) {
      this.paintCommaPetal(ctx, size, {
        inner: "#4A0E17",
        mid: "#99001A",
        outer: "#D21F3C",
        stroke: "#D21F3C",
        glow: "rgba(210,31,60,0.38)",
        coreLine: "rgba(255,253,208,0.16)",
      }, {
        width: size * 0.86,
        height: size * 0.45,
      });
    }

    paintWhitePetal(ctx, size) {
      this.paintCommaPetal(ctx, size, {
        inner: "#FFF7F2",
        mid: "#FFFDD0",
        outer: "#F2D9D9",
        stroke: "#FFFFFF",
        glow: "rgba(255,255,255,0.42)",
        coreLine: "rgba(255,220,220,0.28)",
      }, {
        width: size * 0.72,
        height: size * 0.34,
        strokeWidth: 1.4,
        shadowBlur: 12,
      });
    }

    paintLeafPetal(ctx, size) {
      const cx = size * 0.5;
      const cy = size * 0.5;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(cx, cy);

      const gradient = ctx.createLinearGradient(-size * 0.34, 0, size * 0.34, 0);
      gradient.addColorStop(0, "#17380E");
      gradient.addColorStop(0.5, "#2E5A1C");
      gradient.addColorStop(1, "#00FF66");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(-size * 0.46, 0);
      ctx.lineTo(-size * 0.10, -size * 0.10);
      ctx.lineTo(size * 0.48, 0);
      ctx.lineTo(-size * 0.10, size * 0.10);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(0,255,102,0.36)";
      ctx.strokeStyle = "#E9FFE9";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.moveTo(-size * 0.24, 0);
      ctx.lineTo(size * 0.28, 0);
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.restore();
    }

    paintOrangePetal(ctx, size) {
      this.paintCommaPetal(ctx, size, {
        inner: "#A83810",
        mid: "#FF7F50",
        outer: "#D9A63A",
        stroke: "#FFF1D0",
        glow: "rgba(255,127,80,0.36)",
        coreLine: "rgba(255,253,208,0.22)",
      }, {
        width: size * 0.82,
        height: size * 0.43,
      });
    }

    paintGlowPetal(ctx, size, time) {
      const wave = (Math.sin(time / 500) + 1) * 0.5;
      const mixA = wave;
      const mixB = 1 - wave;

      const lerpColor = (a, b, t) => {
        const pa = parseInt(a.slice(1), 16);
        const pb = parseInt(b.slice(1), 16);
        const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
        const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
        const r = Math.round(ar + (br - ar) * t);
        const g = Math.round(ag + (bg - ag) * t);
        const b2 = Math.round(ab + (bb - ab) * t);
        return `rgb(${r},${g},${b2})`;
      };

      const c1 = lerpColor(Palette.darkRed, Palette.gold, mixA);
      const c2 = lerpColor(Palette.velvet, Palette.white, mixB);
      const c3 = lerpColor(Palette.brightRed, Palette.white, mixA * 0.5 + 0.25);

      this.paintCommaPetal(ctx, size, {
        inner: c2,
        mid: c1,
        outer: c3,
        stroke: "#FFFFFF",
        glow: "rgba(255,255,255,0.45)",
        coreLine: "rgba(255,255,255,0.32)",
      }, {
        width: size * 0.88,
        height: size * 0.46,
        shadowBlur: 15,
      });
    }

    updateGlowSprite() {
      const now = Date.now();
      if (now - this.glowSpriteLastUpdate < 90) {
        return;
      }
      this.glowSpriteLastUpdate = now;
      this.paintGlowPetal(this.spriteCache.glowPetal.ctx, this.spriteCache.glowPetal.size, now);
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
      const threshold = this.difficulty === "lunatic" ? 360 : this.difficulty === "hard" ? 300 : 420;
      if (this.enemyPool.count > threshold) {
        this.globalSpeedScale = 0.65;
      } else {
        this.globalSpeedScale = 1;
      }

      this.updateEnemyBullets(deltaTime, player);
      this.updatePlayerBullets(deltaTime, enemyManager, bossController, player);
      this.updateBurstFx(deltaTime);
      this.updateGlowSprite();
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

      if (behaviorType === BulletBehavior.PETAL_RAIN) {
        pool.vy[slot] += pool.param0[slot] * deltaTime;
        pool.vx[slot] += Math.sin(pool.lifeTimer[slot] * pool.param1[slot] + slot * 0.31) * pool.param2[slot] * deltaTime;
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
      this.spawnBurstFx(x, y, 20, 0.48);

      for (let i = 0; i < count; i += 1) {
        const angle = startAngle + step * i;
        this.spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 6, "PETAL_DARK");
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
      while (this.enemyPool.count > 0) {
        this.recycle(this.enemyPool, this.enemyPool.activeIndices[0]);
      }
      this.clearBurstFx();
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
        const r = radius + pool.radius[slot];
        if (dx * dx + dy * dy <= r * r) {
          this.recycle(pool, slot);
          continue;
        }
        i += 1;
      }
    }

    spawnBurstFx(x, y, radius, duration) {
      const fx = this.burstFx;
      if (fx.freeTop <= 0) {
        return;
      }
      const slot = fx.freeIndices[fx.freeTop - 1];
      fx.freeTop -= 1;
      fx.x[slot] = x;
      fx.y[slot] = y;
      fx.radius[slot] = radius;
      fx.life[slot] = duration;
      fx.maxLife[slot] = duration;
      fx.activeIndices[fx.count] = slot;
      fx.activePositions[slot] = fx.count;
      fx.count += 1;
    }

    updateBurstFx(deltaTime) {
      const fx = this.burstFx;
      let i = 0;
      while (i < fx.count) {
        const slot = fx.activeIndices[i];
        fx.life[slot] -= deltaTime;
        if (fx.life[slot] <= 0) {
          this.recycleBurstFx(slot);
          continue;
        }
        i += 1;
      }
    }

    clearBurstFx() {
      while (this.burstFx.count > 0) {
        this.recycleBurstFx(this.burstFx.activeIndices[0]);
      }
    }

    recycleBurstFx(slot) {
      const fx = this.burstFx;
      const removePosition = fx.activePositions[slot];
      const lastPosition = fx.count - 1;
      const lastSlot = fx.activeIndices[lastPosition];
      fx.activeIndices[removePosition] = lastSlot;
      fx.activePositions[lastSlot] = removePosition;
      fx.count = lastPosition;
      fx.activePositions[slot] = -1;
      fx.freeIndices[fx.freeTop] = slot;
      fx.freeTop += 1;
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
      this.renderBurstFx(ctx);
    }

    renderEnemyPool(ctx) {
      for (let i = 0; i < this.enemyPool.count; i += 1) {
        const slot = this.enemyPool.activeIndices[i];
        const x = this.enemyPool.x[slot];
        const y = this.enemyPool.y[slot];
        const radius = this.enemyPool.radius[slot];
        const color = this.enemyPool.colors[slot];

        switch (color) {
          case "PETAL_DARK":
            this.drawCachedSprite(ctx, this.spriteCache.darkPetal.canvas, x, y, this.enemyPool.vx[slot], this.enemyPool.vy[slot], radius + 12);
            break;
          case "PETAL_WHITE":
            this.drawCachedSprite(ctx, this.spriteCache.whitePetal.canvas, x, y, this.enemyPool.vx[slot], this.enemyPool.vy[slot], radius + 6);
            break;
          case "LEAF_VERDANT":
            this.drawCachedSprite(ctx, this.spriteCache.leafPetal.canvas, x, y, this.enemyPool.vx[slot], this.enemyPool.vy[slot], radius + 11);
            break;
          case "PETAL_ORANGE":
            this.drawCachedSprite(ctx, this.spriteCache.orangePetal.canvas, x, y, this.enemyPool.vx[slot], this.enemyPool.vy[slot], radius + 10);
            break;
          case "ROSE_GLOW":
            this.drawCachedSprite(ctx, this.spriteCache.glowPetal.canvas, x, y, this.enemyPool.vx[slot], this.enemyPool.vy[slot], radius + 12, true);
            break;
          case "ROSE_MOTHER":
            this.drawRoseBloom(ctx, x, y, this.enemyPool.vx[slot], this.enemyPool.vy[slot], radius * 1.5);
            break;
          default:
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
      }
    }

    drawCachedSprite(ctx, sprite, x, y, vx, vy, size, lighter = false) {
      const angle = Math.atan2(vy || 0.0001, vx || 0.0001);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      if (lighter) {
        ctx.globalCompositeOperation = "lighter";
      }
      ctx.drawImage(sprite, -size * 0.5, -size * 0.5, size, size);
      ctx.restore();
    }

    renderPlayerPool(ctx) {
      for (let i = 0; i < this.playerPool.count; i += 1) {
        const slot = this.playerPool.activeIndices[i];
        ctx.beginPath();
        ctx.fillStyle = this.playerPool.colors[slot];
        ctx.arc(this.playerPool.x[slot], this.playerPool.y[slot], this.playerPool.radius[slot], 0, Math.PI * 2);
        ctx.fill();
      }
    }

    renderBurstFx(ctx) {
      for (let i = 0; i < this.burstFx.count; i += 1) {
        const slot = this.burstFx.activeIndices[i];
        const progress = 1 - this.burstFx.life[slot] / this.burstFx.maxLife[slot];
        const radius = this.burstFx.radius[slot] + progress * 52;
        const alpha = (1 - progress) * 0.72;

        ctx.save();
        ctx.translate(this.burstFx.x[slot], this.burstFx.y[slot]);
        ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.lineWidth = 3.4 - progress * 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        for (let p = 0; p < 20; p += 1) {
          const angle = (Math.PI * 2 * p) / 20 + progress * 1.18;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          ctx.fillStyle = p % 2 === 0
            ? `rgba(255, 215, 0, ${alpha})`
            : `rgba(255, 253, 208, ${alpha * 0.88})`;
          ctx.beginPath();
          ctx.arc(px, py, 2.1 + (1 - progress) * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }

    drawRoseBloom(ctx, x, y, vx, vy, size) {
      const angle = Math.atan2(vy || 0.0001, vx || 0.0001);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      for (let i = 0; i < 6; i += 1) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * i) / 6);
        const sprite = i % 3 === 0
          ? this.spriteCache.whitePetal.canvas
          : i % 2 === 0
            ? this.spriteCache.darkPetal.canvas
            : this.spriteCache.orangePetal.canvas;
        const petalSize = size * (1.0 - i * 0.05);
        ctx.drawImage(sprite, -petalSize * 0.5, -petalSize * 0.5, petalSize, petalSize);
        ctx.restore();
      }

      for (let leaf = 0; leaf < 3; leaf += 1) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * leaf) / 3 + Math.PI / 3);
        const leafSize = size * 0.58;
        ctx.drawImage(this.spriteCache.leafPetal.canvas, -leafSize * 0.5, -leafSize * 0.2, leafSize, leafSize);
        ctx.restore();
      }

      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.52);
      core.addColorStop(0, Palette.gold);
      core.addColorStop(0.5, Palette.antiqueGold);
      core.addColorStop(1, Palette.velvet);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  global.BulletManager = BulletManager;
})(window.XTouhouWeb);
