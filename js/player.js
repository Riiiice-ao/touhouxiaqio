(function registerPlayer(global) {
  const {
    GAME_HEIGHT,
    GAME_WIDTH,
    PLAYER_FIRE_INTERVAL,
    PLAYER_FOCUS_MULTIPLIER,
    PLAYER_GRAZE_RADIUS,
    PLAYER_HITBOX_RADIUS,
    PLAYER_BULLET_DAMAGE,
    PLAYER_DEATH_WINDOW,
    PLAYER_NORMAL_SPEED,
    PLAYER_BULLET_SPEED,
    MAX_BOMB_STOCK,
    MAX_LIFE_STOCK,
  } = global.Config;

  const AnimationState = {
    IDLE: "IDLE",
    TURNING_LEFT: "TURNING_LEFT",
    SIDE_LEFT: "SIDE_LEFT",
    TURNING_RIGHT: "TURNING_RIGHT",
    SIDE_RIGHT: "SIDE_RIGHT",
  };

  const PLAYER_FRAMES = {
    idle: [
      { x: 220, y: 326, w: 212, h: 312 },
      { x: 478, y: 326, w: 212, h: 312 },
      { x: 736, y: 326, w: 212, h: 312 },
      { x: 994, y: 326, w: 212, h: 312 },
    ],
    turning: [
      { x: 220, y: 1096, w: 212, h: 326 },
      { x: 478, y: 1096, w: 212, h: 326 },
      { x: 736, y: 1096, w: 212, h: 326 },
      { x: 994, y: 1096, w: 212, h: 326 },
    ],
    side: [
      { x: 1288, y: 720, w: 196, h: 324 },
      { x: 1540, y: 720, w: 196, h: 324 },
      { x: 1792, y: 720, w: 196, h: 324 },
      { x: 2044, y: 720, w: 196, h: 324 },
    ],
  };

  class Player {
    constructor(input, bulletManager, hud, bombEffect, assetLoader) {
      this.input = input;
      this.bulletManager = bulletManager;
      this.hud = hud;
      this.bombEffect = bombEffect;
      this.assetLoader = assetLoader;

      this.x = GAME_WIDTH * 0.5;
      this.y = GAME_HEIGHT - 96;
      this.radius = 12;
      this.hitboxRadius = PLAYER_HITBOX_RADIUS;
      this.deathRadius = PLAYER_HITBOX_RADIUS;
      this.focusDeathRadius = 2.5;
      this.bodyRadius = 12;
      this.grazeRadius = PLAYER_GRAZE_RADIUS;
      this.baseSpeed = PLAYER_NORMAL_SPEED;
      this.focusMultiplier = PLAYER_FOCUS_MULTIPLIER;
      this.fireInterval = PLAYER_FIRE_INTERVAL;
      this.bulletSpeed = PLAYER_BULLET_SPEED;
      this.bulletDamage = PLAYER_BULLET_DAMAGE;
      this.maxBombStock = MAX_BOMB_STOCK;
      this.maxLifeStock = MAX_LIFE_STOCK;

      this.fireCooldown = 0;
      this.isFocusMode = false;
      this.bombStock = MAX_BOMB_STOCK;
      this.life = MAX_LIFE_STOCK;
      this.score = 0;
      this.graze = 0;
      this.maxGraze = 0;
      this.invincibleTimer = 0;
      this.deathbombTimer = 0;
      this.deathbombWindow = PLAYER_DEATH_WINDOW;
      this.isDying = false;
      this.fatalBulletSlot = -1;

      this.animationState = AnimationState.IDLE;
      this.animationTimer = 0;
      this.animationFrame = 0;
      this.facingDirection = 1;
      this.idleSequence = [0, 1, 2, 3, 2, 1];
      this.autoMoveX = 0;
      this.spriteRenderWidth = 40;
      this.spriteRenderHeight = 54;
    }

    update(deltaTime) {
      this.isFocusMode = this.input.isDown("ShiftLeft") || this.input.isDown("ShiftRight");
      this.invincibleTimer = Math.max(0, this.invincibleTimer - deltaTime);

      if (this.isDying) {
        this.deathbombTimer -= deltaTime;

        if (this.input.wasPressed("KeyX") && this.tryDeathBomb()) {
          return;
        }

        if (this.deathbombTimer <= 0) {
          this.pichuun();
        }

        return;
      }

      this.handleMovement(deltaTime);
      this.handleAttack(deltaTime);
      this.handleBombInput();
      this.updateAnimationState(deltaTime);
    }

    updateAutoPlay(deltaTime, context = {}) {
      this.isFocusMode = true;
      this.invincibleTimer = Math.max(this.invincibleTimer, 0.25);
      this.isDying = false;
      this.fatalBulletSlot = -1;

      const attackTarget = this.findAutoAttackTarget(context);
      const target = this.findAutoPlayTarget(context, attackTarget);
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const distance = Math.hypot(dx, dy);
      const speed = this.baseSpeed * 0.78;

      this.autoMoveX = Math.abs(dx) > 1 ? Math.sign(dx) : 0;
      if (distance > 0.5) {
        const step = Math.min(distance, speed * deltaTime);
        this.x += (dx / distance) * step;
        this.y += (dy / distance) * step;
      }

      this.x = Math.max(this.radius, Math.min(GAME_WIDTH - this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(GAME_HEIGHT - this.radius, this.y));
      this.fireFocusedPattern(deltaTime, attackTarget);
      this.updateAnimationState(deltaTime);
    }

    findAutoPlayTarget(context, attackTarget = null) {
      const dangerRadius = 80;
      const step = 54;
      const candidates = [
        { x: this.x, y: this.y },
        { x: this.x - step, y: this.y },
        { x: this.x + step, y: this.y },
        { x: this.x, y: this.y - step },
        { x: this.x, y: this.y + step },
        { x: this.x - step * 0.72, y: this.y - step * 0.72 },
        { x: this.x + step * 0.72, y: this.y - step * 0.72 },
        { x: this.x - step * 0.72, y: this.y + step * 0.72 },
        { x: this.x + step * 0.72, y: this.y + step * 0.72 },
      ];
      let currentDanger = this.scoreAutoPlayDanger(this.x, this.y, context, dangerRadius);

      if (currentDanger <= 0.0001) {
        return {
          x: attackTarget?.x ?? GAME_WIDTH * 0.5,
          y: GAME_HEIGHT - 104,
        };
      }

      const currentAttackBias = attackTarget ? Math.abs(this.x - attackTarget.x) * 0.0018 : 0;
      let best = { x: this.x, y: this.y, score: currentDanger + currentAttackBias };
      for (let i = 0; i < candidates.length; i += 1) {
        const x = Math.max(this.radius, Math.min(GAME_WIDTH - this.radius, candidates[i].x));
        const y = Math.max(this.radius, Math.min(GAME_HEIGHT - this.radius, candidates[i].y));
        const dangerScore = this.scoreAutoPlayDanger(x, y, context, dangerRadius);
        const attackBias = attackTarget ? Math.abs(x - attackTarget.x) * 0.0018 : 0;
        const score = dangerScore + attackBias;
        if (score < best.score) {
          best = { x, y, score };
        }
      }

      return best;
    }

    findAutoAttackTarget(context) {
      const boss = context.bossController;
      if (boss?.active && !boss.defeated) {
        return { x: boss.x, y: boss.y };
      }

      const pool = context.enemyManager?.pool;
      if (!pool || pool.count <= 0) {
        return { x: GAME_WIDTH * 0.5, y: 120 };
      }

      let bestSlot = pool.activeIndices[0];
      let bestScore = Infinity;
      for (let i = 0; i < pool.count; i += 1) {
        const slot = pool.activeIndices[i];
        if (pool.y[slot] > this.y - 18) {
          continue;
        }
        const horizontal = Math.abs(pool.x[slot] - this.x);
        const verticalPriority = Math.max(0, pool.y[slot]);
        const score = horizontal * 0.8 - verticalPriority * 0.35;
        if (score < bestScore) {
          bestScore = score;
          bestSlot = slot;
        }
      }

      if (!Number.isFinite(bestScore)) {
        return { x: GAME_WIDTH * 0.5, y: 120 };
      }

      return {
        x: pool.x[bestSlot],
        y: pool.y[bestSlot],
      };
    }

    scoreAutoPlayDanger(x, y, context, dangerRadius) {
      const bulletManager = context.bulletManager;
      const pool = bulletManager?.enemyPool;
      let score = 0;

      if (pool) {
        for (let i = 0; i < pool.count; i += 1) {
          const slot = pool.activeIndices[i];
          const dx = pool.x[slot] - x;
          const dy = pool.y[slot] - y;
          const distance = Math.hypot(dx, dy);
          if (distance <= dangerRadius) {
            score += (pool.radius[slot] + 3) / Math.max(1, distance);
          }
        }
      }

      score += this.scoreLaserDanger(x, context.bossController, dangerRadius);
      return score;
    }

    scoreLaserDanger(x, bossController, dangerRadius) {
      if (!bossController) {
        return 0;
      }

      let score = 0;
      if (bossController.laserGrid) {
        const laserWeight = bossController.laserGrid.timer <= bossController.laserGrid.fire ? 22 : 8;
        const sweep = Math.sin((bossController.laserGrid.fire - bossController.laserGrid.timer) * 1.6)
          * 34
          * bossController.laserGrid.sweep;
        for (let i = 0; i < bossController.laserGrid.offsets.length; i += 1) {
          const laneX = bossController.laserGrid.baseX + bossController.laserGrid.offsets[i] + sweep;
          const distance = Math.abs(laneX - x);
          if (distance <= dangerRadius) {
            score += laserWeight / Math.max(1, distance);
          }
        }
      }

      if (bossController.whiteLaser) {
        const laserWeight = bossController.whiteLaser.timer <= bossController.whiteLaser.fire ? 18 : 7;
        const wallShift = Math.sin((bossController.whiteLaser.fire - bossController.whiteLaser.timer) * 1.8)
          * 32
          * bossController.whiteLaser.wall;
        const lanes = [
          bossController.x - bossController.whiteLaser.offset + wallShift,
          bossController.x + bossController.whiteLaser.offset + wallShift,
        ];
        for (let i = 0; i < lanes.length; i += 1) {
          const distance = Math.abs(lanes[i] - x);
          if (distance <= dangerRadius) {
            score += laserWeight / Math.max(1, distance);
          }
        }
      }

      return score;
    }

    handleMovement(deltaTime) {
      let moveX = 0;
      let moveY = 0;

      if (this.input.isDown("ArrowLeft")) {
        moveX -= 1;
      }
      if (this.input.isDown("ArrowRight")) {
        moveX += 1;
      }
      if (this.input.isDown("ArrowUp")) {
        moveY -= 1;
      }
      if (this.input.isDown("ArrowDown")) {
        moveY += 1;
      }

      const length = Math.hypot(moveX, moveY) || 1;
      const speed = this.isFocusMode ? this.baseSpeed * this.focusMultiplier : this.baseSpeed;

      this.x += (moveX / length) * speed * deltaTime;
      this.y += (moveY / length) * speed * deltaTime;

      this.x = Math.max(this.radius, Math.min(GAME_WIDTH - this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(GAME_HEIGHT - this.radius, this.y));
    }

    handleAttack(deltaTime) {
      this.fireCooldown = Math.max(0, this.fireCooldown - deltaTime);

      if (!this.input.isDown("KeyZ") || this.fireCooldown > 0) {
        return;
      }

      this.fireFocusedPattern(deltaTime);
    }

    fireFocusedPattern(deltaTime, target = null) {
      this.fireCooldown = Math.max(0, this.fireCooldown - deltaTime);
      if (this.fireCooldown > 0) {
        return;
      }

      this.fireCooldown = this.fireInterval;

      const sideOffset = this.isFocusMode ? 7 : 15;
      const leftOrigin = { x: this.x - sideOffset, y: this.y - 20 };
      const rightOrigin = { x: this.x + sideOffset, y: this.y - 20 };
      let leftVelocity = { vx: 0, vy: -this.bulletSpeed };
      let rightVelocity = { vx: 0, vy: -this.bulletSpeed };

      if (target) {
        leftVelocity = this.getAutoAimVelocity(leftOrigin.x, leftOrigin.y, target);
        rightVelocity = this.getAutoAimVelocity(rightOrigin.x, rightOrigin.y, target);
      }

      this.bulletManager.spawnPlayerBullet(
        leftOrigin.x,
        leftOrigin.y,
        leftVelocity.vx,
        leftVelocity.vy,
        4,
        "#8df1ff",
        this.bulletDamage
      );
      this.bulletManager.spawnPlayerBullet(
        rightOrigin.x,
        rightOrigin.y,
        rightVelocity.vx,
        rightVelocity.vy,
        4,
        "#8df1ff",
        this.bulletDamage
      );
    }

    getAutoAimVelocity(originX, originY, target) {
      const dx = target.x - originX;
      const dy = target.y - originY;
      const distance = Math.hypot(dx, dy) || 1;
      return {
        vx: (dx / distance) * this.bulletSpeed,
        vy: (dy / distance) * this.bulletSpeed,
      };
    }

    handleBombInput() {
      if (this.input.wasPressed("KeyX") && !this.isDying && this.bombStock > 0) {
        this.consumeBomb("SPELL CARD ORB !!");
      }
    }

    consumeBomb(label) {
      this.bombStock = Math.max(0, this.bombStock - 1);
      this.invincibleTimer = 1.2;
      this.bombEffect.start(this.x, this.y, label);
      this.hud.setBomb(this.bombStock);
    }

    addBombCharge(amount) {
      this.bombStock = Math.min(this.maxBombStock, this.bombStock + amount);
      this.hud.setBomb(this.bombStock);
    }

    takeDamage(fatalBulletSlot = -1) {
      if (window.isAutoPlay) {
        return false;
      }
      return this.beginDying(fatalBulletSlot);
    }

    beginDying(fatalBulletSlot) {
      if (this.invincibleTimer > 0 || this.isDying) {
        return false;
      }

      this.isDying = true;
      this.fatalBulletSlot = fatalBulletSlot;
      this.deathbombTimer = this.deathbombWindow;

      if (this.input.wasPressed("KeyX") && this.bombStock > 0) {
        return this.tryDeathBomb();
      }

      return true;
    }

    isFatalBulletSlot(slot) {
      return this.isDying && this.fatalBulletSlot === slot;
    }

    getActiveDeathRadius() {
      return this.isFocusMode ? this.focusDeathRadius : this.deathRadius;
    }

    triggerGraze() {
      this.graze += 1;
      this.maxGraze = Math.max(this.maxGraze, this.graze);
      this.score += 50;
      this.hud.setGraze(this.graze);
      this.hud.setScore(this.score);
    }

    tryDeathBomb() {
      if (!this.isDying || this.bombStock <= 0) {
        return false;
      }

      if (this.fatalBulletSlot >= 0) {
        this.bulletManager.clearEnemyBulletBySlot(this.fatalBulletSlot);
      }

      this.isDying = false;
      this.fatalBulletSlot = -1;
      this.consumeBomb("MASTER SPARK !!");
      return true;
    }

    pichuun() {
      if (this.fatalBulletSlot >= 0) {
        this.bulletManager.clearEnemyBulletBySlot(this.fatalBulletSlot);
      }

      this.isDying = false;
      this.fatalBulletSlot = -1;
      this.life = Math.max(0, this.life - 1);
      this.refillBombs();
      this.invincibleTimer = 2;
      this.x = GAME_WIDTH * 0.5;
      this.y = GAME_HEIGHT - 96;
      this.bulletManager.clearEnemyBullets();
      this.hud.setLife(this.life);
      this.hud.setBomb(this.bombStock);
    }

    addScore(points) {
      this.score += points;
      this.hud.setScore(this.score);
    }

    refillBombs() {
      this.bombStock = this.maxBombStock;
    }

    restoreLivesAndBombs() {
      this.life = this.maxLifeStock;
      this.refillBombs();
      this.isDying = false;
      this.fatalBulletSlot = -1;
      this.deathbombTimer = 0;
      this.invincibleTimer = 2;
    }

    reviveAtCheckpoint(resetScoreMode = "half") {
      this.restoreLivesAndBombs();
      if (resetScoreMode === "zero") {
        this.score = 0;
      } else {
        this.score = Math.floor(this.score * 0.5);
      }
      this.x = GAME_WIDTH * 0.5;
      this.y = GAME_HEIGHT - 96;
      this.hud.reset(this);
    }

    resetRunState() {
      this.x = GAME_WIDTH * 0.5;
      this.y = GAME_HEIGHT - 96;
      this.fireCooldown = 0;
      this.isFocusMode = false;
      this.score = 0;
      this.graze = 0;
      this.maxGraze = 0;
      this.invincibleTimer = 0;
      this.deathbombTimer = 0;
      this.isDying = false;
      this.fatalBulletSlot = -1;
      this.animationState = AnimationState.IDLE;
      this.animationTimer = 0;
      this.animationFrame = 0;
      this.facingDirection = 1;
      this.restoreLivesAndBombs();
      this.hud.reset(this);
    }

    updateAnimationState(deltaTime) {
      const leftHeld = this.input.isDown("ArrowLeft") || this.autoMoveX < -0.2;
      const rightHeld = this.input.isDown("ArrowRight") || this.autoMoveX > 0.2;
      this.autoMoveX = 0;
      const playbackSpeed = this.isFocusMode ? 0.55 : 1;
      this.animationTimer += deltaTime * playbackSpeed;
      const frameStep = 1 / 10;

      if (leftHeld && !rightHeld) {
        this.facingDirection = -1;
        if (this.animationState === AnimationState.IDLE) {
          this.animationState = AnimationState.TURNING_LEFT;
          this.animationFrame = 0;
          this.animationTimer = 0;
        } else if (this.animationState === AnimationState.TURNING_LEFT) {
          if (this.animationTimer >= frameStep) {
            this.animationTimer = 0;
            this.animationFrame += 1;
            if (this.animationFrame >= PLAYER_FRAMES.turning.length - 1) {
              this.animationState = AnimationState.SIDE_LEFT;
              this.animationFrame = 0;
            }
          }
        } else if (this.animationState === AnimationState.SIDE_LEFT) {
          if (this.animationTimer >= frameStep) {
            this.animationTimer = 0;
            this.animationFrame = (this.animationFrame + 1) % PLAYER_FRAMES.side.length;
          }
        }
        return;
      }

      if (rightHeld && !leftHeld) {
        this.facingDirection = 1;
        if (this.animationState === AnimationState.IDLE) {
          this.animationState = AnimationState.TURNING_RIGHT;
          this.animationFrame = 0;
          this.animationTimer = 0;
        } else if (this.animationState === AnimationState.TURNING_RIGHT) {
          if (this.animationTimer >= frameStep) {
            this.animationTimer = 0;
            this.animationFrame += 1;
            if (this.animationFrame >= PLAYER_FRAMES.turning.length - 1) {
              this.animationState = AnimationState.SIDE_RIGHT;
              this.animationFrame = 0;
            }
          }
        } else if (this.animationState === AnimationState.SIDE_RIGHT) {
          if (this.animationTimer >= frameStep) {
            this.animationTimer = 0;
            this.animationFrame = (this.animationFrame + 1) % PLAYER_FRAMES.side.length;
          }
        }
        return;
      }

      if (this.animationState === AnimationState.IDLE) {
        if (this.animationTimer >= 1 / 9) {
          this.animationTimer = 0;
          this.animationFrame = (this.animationFrame + 1) % this.idleSequence.length;
        }
        return;
      }

      if (this.animationState === AnimationState.SIDE_LEFT || this.animationState === AnimationState.SIDE_RIGHT) {
        this.animationState = this.animationState === AnimationState.SIDE_LEFT
          ? AnimationState.TURNING_LEFT
          : AnimationState.TURNING_RIGHT;
        this.animationFrame = PLAYER_FRAMES.turning.length - 1;
        this.animationTimer = 0;
        return;
      }

      if (this.animationTimer >= frameStep) {
        this.animationTimer = 0;
        this.animationFrame -= 1;
        if (this.animationFrame <= 0) {
          this.animationState = AnimationState.IDLE;
          this.animationFrame = 0;
        }
      }
    }

    render(ctx) {
      const spriteSheet = this.assetLoader.get("playerSpriteSheet");

      ctx.save();

      if (this.invincibleTimer > 0) {
        ctx.globalAlpha = 0.58 + Math.sin(performance.now() * 0.02) * 0.2;
      }

      if (spriteSheet) {
        this.renderSprite(ctx, spriteSheet);
      } else {
        this.renderFallbackShip(ctx);
      }

      ctx.strokeStyle = this.isFocusMode ? "rgba(255, 168, 125, 0.65)" : "rgba(154, 204, 255, 0.28)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.grazeRadius, 0, Math.PI * 2);
      ctx.stroke();

      if (this.isFocusMode) {
        const coreRadius = this.focusDeathRadius;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = "rgba(255, 50, 70, 0.90)";
        ctx.shadowBlur = 9;
        ctx.fillStyle = "rgba(255, 42, 66, 0.96)";
        ctx.beginPath();
        ctx.arc(this.x, this.y, coreRadius + 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(this.x, this.y, coreRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff3148";
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0.8, coreRadius * 0.58), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (this.isDying) {
        ctx.strokeStyle = "#fff04a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.deathRadius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    renderFallbackShip(ctx) {
      ctx.fillStyle = "#f8f5ff";
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - 16);
      ctx.lineTo(this.x - 12, this.y + 12);
      ctx.lineTo(this.x + 12, this.y + 12);
      ctx.closePath();
      ctx.fill();
    }

    renderSprite(ctx, spriteSheet) {
      const frame = this.getCurrentFrameRect();
      const drawY = this.y - this.spriteRenderHeight * 0.58;

      ctx.imageSmoothingEnabled = false;

      if (frame.flipX) {
        ctx.save();
        ctx.translate(this.x, 0);
        ctx.scale(-1, 1);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          spriteSheet,
          frame.x,
          frame.y,
          frame.w,
          frame.h,
          -this.spriteRenderWidth * 0.5,
          drawY,
          this.spriteRenderWidth,
          this.spriteRenderHeight
        );
        ctx.restore();
        return;
      }

      ctx.drawImage(
        spriteSheet,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        this.x - this.spriteRenderWidth * 0.5,
        drawY,
        this.spriteRenderWidth,
        this.spriteRenderHeight
      );
    }

    getCurrentFrameRect() {
      if (this.animationState === AnimationState.IDLE) {
        const frameIndex = this.idleSequence[this.animationFrame % this.idleSequence.length];
        return { ...PLAYER_FRAMES.idle[frameIndex], flipX: false };
      }

      if (this.animationState === AnimationState.TURNING_LEFT) {
        return { ...PLAYER_FRAMES.turning[this.animationFrame], flipX: false };
      }

      if (this.animationState === AnimationState.SIDE_LEFT) {
        return { ...PLAYER_FRAMES.side[this.animationFrame], flipX: false };
      }

      if (this.animationState === AnimationState.TURNING_RIGHT) {
        return { ...PLAYER_FRAMES.turning[this.animationFrame], flipX: true };
      }

      return { ...PLAYER_FRAMES.side[this.animationFrame], flipX: true };
    }
  }

  global.Player = Player;
  global.PlayerAnimationState = AnimationState;
})(window.XTouhouWeb);
