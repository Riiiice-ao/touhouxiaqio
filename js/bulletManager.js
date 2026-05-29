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
    antiqueGold: "#D4AF37",
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
      this.enemySpawnAccumulator = 0;
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
        angleOffset: new Float32Array(capacity),
        spinSpeed: new Float32Array(capacity),
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
        darkPetal: createCanvas(144),
        gildedDiamond: createCanvas(132),
        whitePetal: createCanvas(84),
        leafPetal: createCanvas(114),
        orangePetal: createCanvas(126),
      };

      this.paintDarkPetal(cache.darkPetal.ctx, cache.darkPetal.size);
      this.paintGildedDiamond(cache.gildedDiamond.ctx, cache.gildedDiamond.size);
      this.paintWhitePetal(cache.whitePetal.ctx, cache.whitePetal.size);
      this.paintLeafPetal(cache.leafPetal.ctx, cache.leafPetal.size);
      this.paintOrangePetal(cache.orangePetal.ctx, cache.orangePetal.size);

      return cache;
    }

    paintDarkPetal(ctx, size) {
      const cx = size * 0.5;
      const cy = size * 0.5;
      const w = size * 0.68;
      const h = size * 0.28;
      const tracePath = () => {
        ctx.beginPath();
        ctx.moveTo(-w * 0.54, h * 0.02);
        ctx.bezierCurveTo(-w * 0.58, -h * 0.82, -w * 0.14, -h * 1.02, w * 0.26, -h * 0.30);
        ctx.bezierCurveTo(w * 0.52, -h * 0.04, w * 0.56, h * 0.10, w * 0.18, h * 0.34);
        ctx.bezierCurveTo(-w * 0.04, h * 0.48, -w * 0.18, h * 0.88, -w * 0.38, h * 0.46);
        ctx.bezierCurveTo(-w * 0.48, h * 0.26, -w * 0.60, h * 0.08, -w * 0.54, h * 0.02);
        ctx.closePath();
      };

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(cx, cy);

      const fill = ctx.createRadialGradient(-w * 0.14, -h * 0.04, 0, -w * 0.08, 0, w * 0.94);
      fill.addColorStop(0, "rgba(255,245,248,0.98)");
      fill.addColorStop(0.18, "#D34A5F");
      fill.addColorStop(0.52, "#99001A");
      fill.addColorStop(1, "#4A0E17");

      ctx.shadowColor = "rgba(255,0,24,0.42)";
      ctx.shadowBlur = size * 0.14;
      tracePath();
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.save();
      tracePath();
      ctx.clip();
      const core = ctx.createRadialGradient(-w * 0.20, -h * 0.04, 0, -w * 0.10, 0, w * 0.56);
      core.addColorStop(0, "rgba(255,255,255,0.92)");
      core.addColorStop(0.28, "rgba(255,190,205,0.74)");
      core.addColorStop(0.62, "rgba(153,0,26,0.16)");
      core.addColorStop(1, "rgba(74,14,23,0)");
      ctx.fillStyle = core;
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.restore();

      ctx.shadowColor = "rgba(255,24,48,0.28)";
      ctx.shadowBlur = size * 0.06;
      tracePath();
      ctx.lineWidth = size * 0.046;
      ctx.strokeStyle = "rgba(255,255,255,0.98)";
      ctx.stroke();

      ctx.shadowBlur = 0;
      tracePath();
      ctx.lineWidth = size * 0.02;
      ctx.strokeStyle = "rgba(255,78,110,0.78)";
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-w * 0.26, h * 0.04);
      ctx.bezierCurveTo(-w * 0.08, -h * 0.18, w * 0.10, -h * 0.14, w * 0.18, -h * 0.02);
      ctx.bezierCurveTo(w * 0.00, h * 0.06, -w * 0.08, h * 0.16, -w * 0.20, h * 0.18);
      ctx.lineWidth = size * 0.016;
      ctx.strokeStyle = "rgba(255,255,255,0.34)";
      ctx.stroke();

      ctx.restore();
    }

    paintGildedDiamond(ctx, size) {
      const cx = size * 0.5;
      const cy = size * 0.5;
      const w = size * 0.24;
      const h = size * 0.44;
      const tracePath = () => {
        ctx.beginPath();
        ctx.moveTo(0, -h);
        ctx.bezierCurveTo(w * 0.18, -h * 0.74, w * 0.40, -h * 0.36, w * 0.48, 0);
        ctx.bezierCurveTo(w * 0.40, h * 0.36, w * 0.18, h * 0.74, 0, h);
        ctx.bezierCurveTo(-w * 0.18, h * 0.74, -w * 0.40, h * 0.36, -w * 0.48, 0);
        ctx.bezierCurveTo(-w * 0.40, -h * 0.36, -w * 0.18, -h * 0.74, 0, -h);
        ctx.closePath();
      };

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(cx, cy);

      const fill = ctx.createRadialGradient(0, -h * 0.12, 0, 0, 0, h * 1.08);
      fill.addColorStop(0, "rgba(255,246,249,0.98)");
      fill.addColorStop(0.18, "rgba(255,215,224,0.82)");
      fill.addColorStop(0.45, "#D21F3C");
      fill.addColorStop(1, "#7C0A18");

      ctx.shadowColor = "rgba(255,215,0,0.54)";
      ctx.shadowBlur = size * 0.18;
      tracePath();
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.save();
      tracePath();
      ctx.clip();
      const highlight = ctx.createLinearGradient(0, -h, 0, h);
      highlight.addColorStop(0, "rgba(255,255,255,0.76)");
      highlight.addColorStop(0.28, "rgba(255,255,255,0.22)");
      highlight.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = highlight;
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.restore();

      ctx.shadowColor = "rgba(255,215,0,0.46)";
      ctx.shadowBlur = size * 0.14;
      tracePath();
      ctx.lineWidth = size * 0.078;
      ctx.strokeStyle = "#FFD700";
      ctx.stroke();

      ctx.shadowBlur = 0;
      tracePath();
      ctx.lineWidth = size * 0.024;
      ctx.strokeStyle = "rgba(255,255,255,0.98)";
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -h * 0.54);
      ctx.lineTo(0, h * 0.54);
      ctx.lineWidth = size * 0.018;
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.stroke();

      ctx.restore();
    }

    paintWhitePetal(ctx, size) {
      const cx = size * 0.5;
      const cy = size * 0.5;
      const w = size * 0.46;
      const h = size * 0.24;
      const tracePath = () => {
        ctx.beginPath();
        ctx.moveTo(-w * 0.56, 0);
        ctx.bezierCurveTo(-w * 0.48, -h * 0.92, -w * 0.06, -h * 0.96, w * 0.28, -h * 0.24);
        ctx.bezierCurveTo(w * 0.48, -h * 0.02, w * 0.46, h * 0.16, w * 0.18, h * 0.30);
        ctx.bezierCurveTo(-w * 0.06, h * 0.42, -w * 0.28, h * 0.70, -w * 0.50, h * 0.18);
        ctx.bezierCurveTo(-w * 0.56, h * 0.08, -w * 0.60, h * 0.02, -w * 0.56, 0);
        ctx.closePath();
      };

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(cx, cy);

      const fill = ctx.createRadialGradient(-w * 0.10, -h * 0.04, 0, -w * 0.04, 0, w * 0.78);
      fill.addColorStop(0, "rgba(255,255,255,0.98)");
      fill.addColorStop(0.24, "#FFFDD0");
      fill.addColorStop(0.70, "#F5EFD6");
      fill.addColorStop(1, "#E9DCCF");

      ctx.shadowColor = "rgba(255,255,255,0.70)";
      ctx.shadowBlur = size * 0.20;
      tracePath();
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.save();
      tracePath();
      ctx.clip();
      const core = ctx.createRadialGradient(-w * 0.14, 0, 0, -w * 0.06, 0, w * 0.42);
      core.addColorStop(0, "rgba(255,255,255,0.92)");
      core.addColorStop(0.42, "rgba(255,255,255,0.24)");
      core.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = core;
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.restore();

      ctx.shadowColor = "rgba(255,255,255,0.44)";
      ctx.shadowBlur = size * 0.08;
      tracePath();
      ctx.lineWidth = size * 0.05;
      ctx.strokeStyle = "rgba(255,255,255,0.98)";
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(-w * 0.22, 0);
      ctx.bezierCurveTo(-w * 0.04, -h * 0.18, w * 0.12, -h * 0.10, w * 0.20, 0);
      ctx.bezierCurveTo(w * 0.08, h * 0.06, -w * 0.02, h * 0.12, -w * 0.14, h * 0.12);
      ctx.lineWidth = size * 0.018;
      ctx.strokeStyle = "rgba(255,255,255,0.34)";
      ctx.stroke();

      ctx.restore();
    }

    paintLeafPetal(ctx, size) {
      const cx = size * 0.5;
      const cy = size * 0.5;
      const w = size * 0.56;
      const h = size * 0.18;
      const tracePath = () => {
        ctx.beginPath();
        ctx.moveTo(-w * 0.58, 0);
        ctx.bezierCurveTo(-w * 0.48, -h * 0.12, -w * 0.38, -h * 0.22, -w * 0.30, -h * 0.10);
        ctx.quadraticCurveTo(-w * 0.18, -h * 0.26, -w * 0.08, -h * 0.12);
        ctx.quadraticCurveTo(w * 0.02, -h * 0.34, w * 0.14, -h * 0.14);
        ctx.quadraticCurveTo(w * 0.28, -h * 0.22, w * 0.40, -h * 0.08);
        ctx.bezierCurveTo(w * 0.50, -h * 0.06, w * 0.56, -h * 0.02, w * 0.60, 0);
        ctx.bezierCurveTo(w * 0.56, h * 0.02, w * 0.50, h * 0.06, w * 0.40, h * 0.08);
        ctx.quadraticCurveTo(w * 0.28, h * 0.22, w * 0.14, h * 0.14);
        ctx.quadraticCurveTo(w * 0.02, h * 0.34, -w * 0.08, h * 0.12);
        ctx.quadraticCurveTo(-w * 0.18, h * 0.26, -w * 0.30, h * 0.10);
        ctx.bezierCurveTo(-w * 0.38, h * 0.22, -w * 0.48, h * 0.12, -w * 0.58, 0);
        ctx.closePath();
      };

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(cx, cy);

      const gradient = ctx.createLinearGradient(-w, 0, w, 0);
      gradient.addColorStop(0, "#009944");
      gradient.addColorStop(0.28, "#00D65A");
      gradient.addColorStop(0.54, "#B8FFD9");
      gradient.addColorStop(0.78, "#00FF66");
      gradient.addColorStop(1, "#00B84A");
      ctx.shadowColor = "rgba(0,255,102,0.48)";
      ctx.shadowBlur = size * 0.16;
      tracePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.shadowColor = "rgba(0,255,102,0.32)";
      ctx.shadowBlur = size * 0.08;
      tracePath();
      ctx.strokeStyle = "rgba(255,255,255,0.98)";
      ctx.lineWidth = size * 0.046;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(-w * 0.34, 0);
      ctx.bezierCurveTo(-w * 0.10, -h * 0.04, w * 0.12, -h * 0.02, w * 0.36, 0);
      ctx.strokeStyle = "rgba(255,255,255,0.42)";
      ctx.lineWidth = size * 0.018;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-w * 0.06, -h * 0.02);
      ctx.quadraticCurveTo(w * 0.08, -h * 0.12, w * 0.22, -h * 0.06);
      ctx.moveTo(-w * 0.04, h * 0.02);
      ctx.quadraticCurveTo(w * 0.10, h * 0.12, w * 0.22, h * 0.06);
      ctx.strokeStyle = "rgba(255,255,255,0.26)";
      ctx.lineWidth = size * 0.012;
      ctx.stroke();
      ctx.restore();
    }

    paintOrangePetal(ctx, size) {
      const cx = size * 0.5;
      const cy = size * 0.5;
      const w = size * 0.58;
      const h = size * 0.26;
      const tracePath = () => {
        ctx.beginPath();
        ctx.moveTo(-w * 0.54, h * 0.02);
        ctx.bezierCurveTo(-w * 0.46, -h * 0.82, -w * 0.02, -h * 0.98, w * 0.28, -h * 0.28);
        ctx.bezierCurveTo(w * 0.48, -h * 0.06, w * 0.52, h * 0.12, w * 0.16, h * 0.34);
        ctx.bezierCurveTo(-w * 0.06, h * 0.48, -w * 0.22, h * 0.74, -w * 0.42, h * 0.36);
        ctx.bezierCurveTo(-w * 0.50, h * 0.20, -w * 0.58, h * 0.06, -w * 0.54, h * 0.02);
        ctx.closePath();
      };

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(cx, cy);

      const fill = ctx.createRadialGradient(-w * 0.10, -h * 0.04, 0, -w * 0.04, 0, w * 0.86);
      fill.addColorStop(0, "rgba(255,246,238,0.98)");
      fill.addColorStop(0.22, "rgba(255,228,214,0.84)");
      fill.addColorStop(0.50, "#FF7F50");
      fill.addColorStop(1, "#C95A34");

      ctx.shadowColor = "rgba(255,127,80,0.48)";
      ctx.shadowBlur = size * 0.16;
      tracePath();
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.save();
      tracePath();
      ctx.clip();
      const edgeGlow = ctx.createLinearGradient(-w, -h, w, h);
      edgeGlow.addColorStop(0, "rgba(255,255,255,0.46)");
      edgeGlow.addColorStop(0.44, "rgba(255,255,255,0.12)");
      edgeGlow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = edgeGlow;
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.restore();

      ctx.shadowColor = "rgba(255,164,116,0.30)";
      ctx.shadowBlur = size * 0.07;
      tracePath();
      ctx.lineWidth = size * 0.046;
      ctx.strokeStyle = "rgba(255,255,255,0.98)";
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(-w * 0.22, h * 0.04);
      ctx.bezierCurveTo(-w * 0.04, -h * 0.18, w * 0.12, -h * 0.14, w * 0.20, -h * 0.02);
      ctx.bezierCurveTo(w * 0.04, h * 0.04, -w * 0.02, h * 0.14, -w * 0.14, h * 0.16);
      ctx.lineWidth = size * 0.016;
      ctx.strokeStyle = "rgba(255,255,255,0.34)";
      ctx.stroke();

      ctx.restore();
    }

    isPerformanceTunedDifficulty() {
      return this.difficulty === "hard" || this.difficulty === "lunatic";
    }

    getEnemyCollisionScale() {
      return this.isPerformanceTunedDifficulty() ? 1.25 : 1;
    }

    shouldSkipEnemySpawn(color) {
      if (!this.isPerformanceTunedDifficulty() || color === "ROSE_MOTHER") {
        return false;
      }

      this.enemySpawnAccumulator += 0.7;
      if (this.enemySpawnAccumulator < 1) {
        return true;
      }

      this.enemySpawnAccumulator -= 1;
      return false;
    }

    spawnBullet(x, y, vx, vy, radius, color, damage = 1, behavior = null) {
      if (this.shouldSkipEnemySpawn(color)) {
        return -1;
      }
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
      pool.angleOffset[slot] = behavior?.angleOffset ?? 0;
      pool.spinSpeed[slot] = behavior?.spinSpeed ?? 0;
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
    }

    updateEnemyBullets(deltaTime, player) {
      const pool = this.enemyPool;
      const collisionScale = this.getEnemyCollisionScale();
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
        pool.angleOffset[slot] += pool.spinSpeed[slot] * deltaTime;

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
        const hitRadius = pool.radius[slot] * collisionScale;

        if (distance < player.deathRadius + hitRadius) {
          player.takeDamage(slot);
          continue;
        }

        if (!pool.grazed[slot] && distance < player.grazeRadius + hitRadius) {
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
        this.spawnBullet(
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          6,
          "PETAL_DARK",
          1,
          {
            angleOffset: Math.random() * Math.PI * 2,
            spinSpeed: 1.2,
          }
        );
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
      pool.angleOffset[slot] = 0;
      pool.spinSpeed[slot] = 0;
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
        const spec = this.resolveEnemyRenderSpec(slot);

        if (spec?.roseBloom) {
          this.drawRoseBloom(ctx, x, y, this.enemyPool.vx[slot], this.enemyPool.vy[slot], spec.size);
          continue;
        }

        if (spec?.sprite) {
          this.drawCachedSprite(
            ctx,
            spec.sprite,
            x,
            y,
            spec.size,
            this.getEnemyRenderAngle(slot),
            spec.composite
          );
          continue;
        }

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    resolveEnemyRenderSpec(slot) {
      const radius = this.enemyPool.radius[slot];
      const color = this.enemyPool.colors[slot];
      const behaviorType = this.enemyPool.behaviorType[slot];
      const visualScale = 1.5;

      if (color === "ROSE_MOTHER") {
        return { roseBloom: true, size: radius * 1.5 };
      }

      if (behaviorType === BulletBehavior.RETARGET_ONCE || color === "ROSE_GILDED") {
        return {
          sprite: this.spriteCache.gildedDiamond.canvas,
          size: (radius + 12) * visualScale,
        };
      }

      if (
        color === "PETAL_DARK" ||
        color === Palette.darkRed ||
        color === Palette.velvet ||
        color === Palette.brightRed
      ) {
        return {
          sprite: this.spriteCache.darkPetal.canvas,
          size: (radius + 12) * visualScale,
        };
      }

      if (color === "PETAL_WHITE" || color === Palette.white || color === Palette.moon || color === "#FFFFFF") {
        return {
          sprite: this.spriteCache.whitePetal.canvas,
          size: (radius + 6) * visualScale,
          composite: "lighter",
        };
      }

      if (color === "LEAF_VERDANT" || color === Palette.leaf || color === Palette.leafLight || color === "#00FF66") {
        return {
          sprite: this.spriteCache.leafPetal.canvas,
          size: (radius + 11) * visualScale,
        };
      }

      if (
        color === "PETAL_ORANGE" ||
        color === "PETAL_GOLD" ||
        color === Palette.orange ||
        color === Palette.amber ||
        color === Palette.gold ||
        color === Palette.antiqueGold
      ) {
        return {
          sprite: this.spriteCache.orangePetal.canvas,
          size: (radius + 10) * visualScale,
          composite: "lighter",
        };
      }

      return null;
    }

    getEnemyRenderAngle(slot) {
      const vx = this.enemyPool.vx[slot];
      const vy = this.enemyPool.vy[slot];
      return Math.atan2(vy || 0.0001, vx || 0.0001) + this.enemyPool.angleOffset[slot];
    }

    drawCachedSprite(ctx, sprite, x, y, size, angle, composite = null) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      if (composite) {
        ctx.globalCompositeOperation = composite;
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
        const petalSize = size * 1.5 * (1.0 - i * 0.05);
        ctx.drawImage(sprite, -petalSize * 0.5, -petalSize * 0.5, petalSize, petalSize);
        ctx.restore();
      }

      for (let leaf = 0; leaf < 3; leaf += 1) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * leaf) / 3 + Math.PI / 3);
        const leafSize = size * 0.88;
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
