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

      this.fireCooldown = this.fireInterval;

      const sideOffset = this.isFocusMode ? 7 : 15;
      this.bulletManager.spawnPlayerBullet(
        this.x - sideOffset,
        this.y - 20,
        0,
        -this.bulletSpeed,
        4,
        "#8df1ff",
        this.bulletDamage
      );
      this.bulletManager.spawnPlayerBullet(
        this.x + sideOffset,
        this.y - 20,
        0,
        -this.bulletSpeed,
        4,
        "#8df1ff",
        this.bulletDamage
      );
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

    takeDamage(fatalBulletSlot = -1) {
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
      const leftHeld = this.input.isDown("ArrowLeft");
      const rightHeld = this.input.isDown("ArrowRight");
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
        ctx.fillStyle = "#ff4f5c";
        ctx.beginPath();
        ctx.arc(this.x, this.y - 4, this.deathRadius, 0, Math.PI * 2);
        ctx.fill();
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
