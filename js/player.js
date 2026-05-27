(function registerPlayer(global) {
  const {
    GAME_HEIGHT,
    GAME_WIDTH,
    PLAYER_FIRE_INTERVAL,
    PLAYER_FOCUS_MULTIPLIER,
    PLAYER_GRAZE_RADIUS,
    PLAYER_HITBOX_RADIUS,
    PLAYER_NORMAL_SPEED,
    PLAYER_BULLET_SPEED,
  } = global.Config;

  /**
   * 玩家控制器。
   * 负责移动、低速模式、射击、Bomb、擦弹反馈和受击窗口。
   */
  class Player {
    constructor(input, bulletManager, hud) {
      this.input = input;
      this.bulletManager = bulletManager;
      this.hud = hud;

      this.x = GAME_WIDTH * 0.5;
      this.y = GAME_HEIGHT - 96;
      this.radius = 12;
      this.hitboxRadius = PLAYER_HITBOX_RADIUS;
      this.grazeRadius = PLAYER_GRAZE_RADIUS;
      this.baseSpeed = PLAYER_NORMAL_SPEED;
      this.focusMultiplier = PLAYER_FOCUS_MULTIPLIER;
      this.fireInterval = PLAYER_FIRE_INTERVAL;
      this.bulletSpeed = PLAYER_BULLET_SPEED;

      this.fireCooldown = 0;
      this.isFocusMode = false;
      this.bombStock = 3;
      this.life = 3;
      this.score = 0;
      this.graze = 0;
      this.invincibleTimer = 0;
      this.deathbombTimer = 0;
      this.deathbombWindow = 0.16;
      this.pendingDeath = false;
    }

    update(deltaTime) {
      this.isFocusMode = this.input.isDown("ShiftLeft") || this.input.isDown("ShiftRight");
      this.invincibleTimer = Math.max(0, this.invincibleTimer - deltaTime);

      if (this.pendingDeath) {
        this.deathbombTimer -= deltaTime;

        if (this.input.wasPressed("KeyX") && this.tryDeathBomb()) {
          return;
        }

        if (this.deathbombTimer <= 0) {
          this.resolveDeath();
        }
      }

      this.handleMovement(deltaTime);
      this.handleAttack(deltaTime);
      this.handleBombInput();
    }

    /**
     * 基础八方向移动。
     * 斜向移动时做归一化，避免斜着走更快。
     */
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

    /**
     * Z 键持续射击。
     * Focus 状态下，左右发射点更靠近中心，模拟收束火力感。
     */
    handleAttack(deltaTime) {
      this.fireCooldown = Math.max(0, this.fireCooldown - deltaTime);

      if (!this.input.isDown("KeyZ") || this.fireCooldown > 0) {
        return;
      }

      this.fireCooldown = this.fireInterval;

      const sideOffset = this.isFocusMode ? 7 : 15;
      this.bulletManager.spawnPlayerBullet(this.x - sideOffset, this.y - 20, 0, -this.bulletSpeed, 4, "#8df1ff");
      this.bulletManager.spawnPlayerBullet(this.x + sideOffset, this.y - 20, 0, -this.bulletSpeed, 4, "#8df1ff");
    }

    /**
     * X 键主动 Bomb。
     * 使用 wasPressed，避免长按一帧内把 Bomb 全部耗光。
     */
    handleBombInput() {
      if (this.input.wasPressed("KeyX") && !this.pendingDeath && this.bombStock > 0) {
        this.consumeBomb();
      }
    }

    consumeBomb() {
      this.bombStock = Math.max(0, this.bombStock - 1);
      this.invincibleTimer = 1.2;
      this.bulletManager.clearEnemyBullets();
      this.hud.setBomb(this.bombStock);
    }

    /**
     * 受击入口。
     * 当前不立刻判死，而是进入极短的 Deathbomb 判定窗口。
     */
    takeDamage() {
      if (this.invincibleTimer > 0 || this.pendingDeath) {
        return;
      }

      this.pendingDeath = true;
      this.deathbombTimer = this.deathbombWindow;
    }

    /**
     * 擦弹时加 Graze 和分数。
     */
    triggerGraze() {
      this.graze += 1;
      this.score += 50;
      this.hud.setGraze(this.graze);
      this.hud.setScore(this.score);
    }

    /**
     * 决死结界尝试。
     * 如果窗口内按下 X 且还有 Bomb，就保命并清屏。
     */
    tryDeathBomb() {
      if (this.bombStock <= 0) {
        return false;
      }

      this.pendingDeath = false;
      this.consumeBomb();
      return true;
    }

    /**
     * 死亡结算。
     * 这里顺手清一次屏，避免重生后立刻又撞上旧弹。
     */
    resolveDeath() {
      this.pendingDeath = false;
      this.life = Math.max(0, this.life - 1);
      this.invincibleTimer = 2;
      this.x = GAME_WIDTH * 0.5;
      this.y = GAME_HEIGHT - 96;
      this.bulletManager.clearEnemyBullets();
      this.hud.setLife(this.life);
    }

    addScore(points) {
      this.score += points;
      this.hud.setScore(this.score);
    }

    /**
     * 自机绘制。
     * Focus 时显示红色核心判定点，并额外画出决死窗口提示环。
     */
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
        ctx.arc(this.x, this.y, this.hitboxRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (this.pendingDeath) {
        ctx.strokeStyle = "#fff04a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.hitboxRadius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  global.Player = Player;
})(window.XTouhouWeb);
