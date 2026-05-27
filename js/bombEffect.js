(function registerBombEffect(global) {
  const { BOMB_EFFECT_DURATION, GAME_HEIGHT, GAME_WIDTH } = global.Config;

  /**
   * Bomb 视觉控制器。
   * 负责：
   * 1. 播放中央大字提示
   * 2. 绘制半透明遮罩
   * 3. 绘制从自机扩散的清屏震荡波
   * 4. 随着圆环扩散逐步清除敌弹
   */
  class BombEffect {
    constructor() {
      this.active = false;
      this.timer = 0;
      this.duration = BOMB_EFFECT_DURATION;
      this.originX = GAME_WIDTH * 0.5;
      this.originY = GAME_HEIGHT * 0.5;
      this.radius = 0;
      this.maxRadius = Math.hypot(GAME_WIDTH, GAME_HEIGHT);
      this.label = "SPELL CARD ORB !!";
    }

    start(originX, originY, label) {
      this.active = true;
      this.timer = 0;
      this.radius = 0;
      this.originX = originX;
      this.originY = originY;
      this.label = label;
    }

    update(deltaTime, bulletManager) {
      if (!this.active) {
        return;
      }

      this.timer += deltaTime;
      const progress = Math.min(1, this.timer / this.duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.radius = this.maxRadius * eased;

      bulletManager.clearEnemyBulletsInRadius(this.originX, this.originY, this.radius);

      if (progress >= 1) {
        this.active = false;
      }
    }

    render(ctx) {
      if (!this.active) {
        return;
      }

      const progress = Math.min(1, this.timer / this.duration);
      const alpha = (1 - progress) * 0.35;
      const textScale = 0.7 + Math.sin(progress * Math.PI) * 0.45;

      ctx.save();

      ctx.fillStyle = `rgba(255, 248, 238, ${alpha})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      const glow = ctx.createRadialGradient(
        this.originX,
        this.originY,
        0,
        this.originX,
        this.originY,
        this.radius
      );
      glow.addColorStop(0, "rgba(255,255,255,0.22)");
      glow.addColorStop(0.35, "rgba(255,238,200,0.15)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(this.originX, this.originY, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 - progress * 0.5})`;
      ctx.lineWidth = 8 - progress * 4;
      ctx.beginPath();
      ctx.arc(this.originX, this.originY, this.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(255, 120, 80, 0.45)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "rgba(255, 248, 235, 0.96)";
      ctx.font = `italic ${Math.floor(34 + 28 * textScale)}px Georgia`;
      ctx.fillText(this.label, GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5);

      ctx.restore();
    }
  }

  global.BombEffect = BombEffect;
})(window.XTouhouWeb);
