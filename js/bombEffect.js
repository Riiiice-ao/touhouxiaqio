(function registerBombEffect(global) {
  const { BOMB_EFFECT_DURATION, GAME_HEIGHT, GAME_WIDTH } = global.Config;

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
      this.overlayAlpha = 0.35;
      this.clearsBullets = true;
      this.ringColor = "255, 255, 255";
      this.shadowColor = "rgba(255, 120, 80, 0.45)";
      this.textColor = "rgba(255, 248, 235, 0.96)";
    }

    start(originX, originY, label, options = {}) {
      this.active = true;
      this.timer = 0;
      this.radius = 0;
      this.originX = originX;
      this.originY = originY;
      this.label = label;
      this.overlayAlpha = options.overlayAlpha ?? 0.35;
      this.clearsBullets = options.clearsBullets ?? true;
      this.ringColor = options.ringColor ?? "255, 255, 255";
      this.shadowColor = options.shadowColor ?? "rgba(255, 120, 80, 0.45)";
      this.textColor = options.textColor ?? "rgba(255, 248, 235, 0.96)";
    }

    update(deltaTime, bulletManager) {
      if (!this.active) {
        return;
      }

      this.timer += deltaTime;
      const progress = Math.min(1, this.timer / this.duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.radius = this.maxRadius * eased;

      if (this.clearsBullets) {
        bulletManager.clearEnemyBulletsInRadius(this.originX, this.originY, this.radius);
      }

      if (progress >= 1) {
        this.active = false;
      }
    }

    render(ctx) {
      if (!this.active) {
        return;
      }

      const progress = Math.min(1, this.timer / this.duration);
      const alpha = (1 - progress) * this.overlayAlpha;
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

      ctx.strokeStyle = `rgba(${this.ringColor}, ${0.9 - progress * 0.5})`;
      ctx.lineWidth = 8 - progress * 4;
      ctx.beginPath();
      ctx.arc(this.originX, this.originY, this.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = this.shadowColor;
      ctx.shadowBlur = 24;
      ctx.fillStyle = this.textColor;
      ctx.font = `italic ${Math.floor(34 + 28 * textScale)}px Georgia`;
      ctx.fillText(this.label, GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5);

      ctx.restore();
    }
  }

  global.BombEffect = BombEffect;
})(window.XTouhouWeb);
