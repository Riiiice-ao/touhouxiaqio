(function registerBossController(global) {
  const { BOSS_ENTRY_X, BOSS_ENTRY_Y, BOSS_MAX_HEALTH, GAME_WIDTH } = global.Config;

  /**
   * Boss 控制器。
   * 负责登场移动、Boss 弹幕脚本和顶部血条渲染。
   */
  class BossController {
    constructor(emitter) {
      this.emitter = emitter;
      this.radius = 30;
      this.entrySpeed = 120;
      this.targetX = BOSS_ENTRY_X;
      this.targetY = BOSS_ENTRY_Y;

      this.reset();
    }

    reset() {
      this.active = false;
      this.inBattle = false;
      this.defeated = false;
      this.x = BOSS_ENTRY_X;
      this.y = -92;
      this.moveTimer = 0;
      this.waveTimer = 0.25;
      this.aimedTimer = 1.1;
      this.spiralTimer = 0;
      this.spiralAngle = 0;
      global.HealthSystem.resetEntity(this, BOSS_MAX_HEALTH);
    }

    activateEntry() {
      this.reset();
      this.active = true;
    }

    update(deltaTime, player) {
      if (!this.active || this.defeated) {
        return;
      }

      if (!this.inBattle) {
        this.updateEntry(deltaTime);
        return;
      }

      this.updateBattle(deltaTime, player);
    }

    updateEntry(deltaTime) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const distance = Math.hypot(dx, dy);
      const step = this.entrySpeed * deltaTime;

      if (distance <= step) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.inBattle = true;
        return;
      }

      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;
    }

    updateBattle(deltaTime, player) {
      this.moveTimer += deltaTime;
      this.waveTimer -= deltaTime;
      this.aimedTimer -= deltaTime;
      this.spiralTimer += deltaTime;

      this.x = this.targetX + Math.sin(this.moveTimer * 0.7) * 110;
      this.y = this.targetY + Math.sin(this.moveTimer * 1.35) * 18;

      if (this.waveTimer <= 0) {
        this.waveTimer += 0.55;
        this.emitter.fireNWay(this.x, this.y, 9, 90, 168, 90, 6, "#ffd37e");
      }

      if (this.aimedTimer <= 0) {
        this.aimedTimer += 1.5;
        this.emitter.fireAimedNWay(this.x, this.y, player.x, player.y, 3, 22, 196, 5, "#9fd5ff");
      }

      while (this.spiralTimer >= 0.045) {
        this.spiralTimer -= 0.045;
        this.spiralAngle += 13;
        this.emitter.fireSpiralPair(this.x, this.y, this.spiralAngle, 192, 5, "#ffa46d", "#ff6b83");
      }
    }

    checkBulletHit(x, y, radius, damage, player) {
      if (!this.active || !this.inBattle || this.defeated) {
        return false;
      }

      const dx = this.x - x;
      const dy = this.y - y;
      const totalRadius = this.radius + radius;

      if (dx * dx + dy * dy > totalRadius * totalRadius) {
        return false;
      }

      if (global.HealthSystem.damageEntity(this, damage)) {
        this.defeated = true;
        this.active = false;
        this.inBattle = false;
        player.addScore(5000);
      }

      return true;
    }

    render(ctx) {
      if (!this.active) {
        return;
      }

      ctx.save();

      const bodyGlow = ctx.createRadialGradient(this.x, this.y, 8, this.x, this.y, 40);
      bodyGlow.addColorStop(0, "#fff8fc");
      bodyGlow.addColorStop(0.5, "#ffc7d9");
      bodyGlow.addColorStop(1, "#9b3757");
      ctx.fillStyle = bodyGlow;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 36, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    renderHpBar(ctx) {
      if (!this.active || this.defeated) {
        return;
      }

      const width = 360;
      const height = 16;
      const x = (GAME_WIDTH - width) * 0.5;
      const y = 22;
      const ratio = global.HealthSystem.getRatio(this);

      ctx.save();

      ctx.fillStyle = "rgba(18, 8, 14, 0.74)";
      ctx.fillRect(x - 8, y - 8, width + 16, height + 16);

      const backGradient = ctx.createLinearGradient(x, y, x, y + height);
      backGradient.addColorStop(0, "rgba(95, 22, 30, 0.95)");
      backGradient.addColorStop(1, "rgba(55, 9, 18, 0.95)");
      ctx.fillStyle = backGradient;
      ctx.fillRect(x, y, width, height);

      const barGradient = ctx.createLinearGradient(x, y, x + width, y);
      barGradient.addColorStop(0, "#ffe0d5");
      barGradient.addColorStop(0.18, "#ff8f80");
      barGradient.addColorStop(0.55, "#f3404c");
      barGradient.addColorStop(1, "#8b1020");
      ctx.fillStyle = barGradient;
      ctx.fillRect(x, y, width * ratio, height);

      ctx.strokeStyle = "rgba(255, 230, 210, 0.72)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = "#fff2e7";
      ctx.font = "bold 14px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("SCARLET BOSS HP", GAME_WIDTH * 0.5, y - 4);

      ctx.restore();
    }
  }

  global.BossController = BossController;
})(window.XTouhouWeb);
