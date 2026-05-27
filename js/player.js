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

  class Player {
    constructor(input, bulletManager, hud, bombEffect) {
      this.input = input;
      this.bulletManager = bulletManager;
      this.hud = hud;
      this.bombEffect = bombEffect;

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
      this.restoreLivesAndBombs();
      this.hud.reset(this);
    }

    render(ctx) {
      ctx.save();

      if (this.invincibleTimer > 0) {
        ctx.globalAlpha = 0.58 + Math.sin(performance.now() * 0.02) * 0.2;
      }

      ctx.fillStyle = "#f8f5ff";
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - 16);
      ctx.lineTo(this.x - 12, this.y + 12);
      ctx.lineTo(this.x + 12, this.y + 12);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = this.isFocusMode ? "rgba(255, 168, 125, 0.65)" : "rgba(154, 204, 255, 0.28)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.grazeRadius, 0, Math.PI * 2);
      ctx.stroke();

      if (this.isFocusMode) {
        ctx.fillStyle = "#ff4f5c";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.deathRadius, 0, Math.PI * 2);
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
  }

  global.Player = Player;
})(window.XTouhouWeb);
