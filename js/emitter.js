(function registerEmitter(global) {
  const BulletBehavior = global.BulletBehavior;

  const Palette = {
    roseRed: "#D21F3C",
    crimson: "#99001A",
    gold: "#FFD700",
    antiqueGold: "#D4AF37",
    velvet: "#4A0E17",
    moon: "#FFFDD0",
  };

  class Emitter {
    constructor(bulletManager) {
      this.bulletManager = bulletManager;
      this.spiralTimer = 0;
      this.spiralAngle = 0;
      this.spiralInterval = 0.04;
    }

    fireNWay(x, y, wayCount, spreadAngle, speed, centerAngle, radius = 6, color = Palette.antiqueGold) {
      if (wayCount <= 0) {
        return;
      }

      if (wayCount === 1) {
        const velocity = this.angleToVelocity(centerAngle, speed);
        this.bulletManager.spawnBullet(x, y, velocity.vx, velocity.vy, radius, color);
        return;
      }

      const startAngle = centerAngle - spreadAngle * 0.5;
      const step = spreadAngle / (wayCount - 1);

      for (let i = 0; i < wayCount; i += 1) {
        const angle = startAngle + step * i;
        const velocity = this.angleToVelocity(angle, speed);
        this.bulletManager.spawnBullet(x, y, velocity.vx, velocity.vy, radius, color);
      }
    }

    fireRing(x, y, count, speed, startAngle = 0, radius = 6, color = Palette.antiqueGold) {
      if (count <= 0) {
        return;
      }

      const step = 360 / count;
      for (let i = 0; i < count; i += 1) {
        const angle = startAngle + step * i;
        const velocity = this.angleToVelocity(angle, speed);
        this.bulletManager.spawnBullet(x, y, velocity.vx, velocity.vy, radius, color);
      }
    }

    fireAimedNWay(
      x,
      y,
      targetX,
      targetY,
      wayCount,
      spreadAngle,
      speed,
      radius = 5,
      color = Palette.gold
    ) {
      const centerAngle = this.getAngleToTarget(x, y, targetX, targetY);
      this.fireNWay(x, y, wayCount, spreadAngle, speed, centerAngle, radius, color);
    }

    fireSpiralPair(x, y, baseAngle, speed, radius = 5, colorA = Palette.crimson, colorB = Palette.antiqueGold) {
      const primary = this.angleToVelocity(baseAngle, speed);
      const secondary = this.angleToVelocity(baseAngle + 180, speed);

      this.bulletManager.spawnBullet(x, y, primary.vx, primary.vy, radius, colorA);
      this.bulletManager.spawnBullet(x, y, secondary.vx, secondary.vy, radius, colorB);
    }

    fireRetargetFollower(x, y, targetX, targetY) {
      const initialAngle = this.getAngleToTarget(x, y, targetX, targetY);
      const velocity = this.angleToVelocity(initialAngle, 128);

      this.bulletManager.spawnBullet(
        x,
        y,
        velocity.vx,
        velocity.vy,
        8,
        Palette.crimson,
        1,
        {
          type: BulletBehavior.RETARGET_ONCE,
          param0: 0.5,
          param1: 248,
        }
      );
    }

    fireSplitBurstMother(x, y, angleDeg = 90) {
      const velocity = this.angleToVelocity(angleDeg, 50);
      this.bulletManager.spawnBullet(
        x,
        y,
        velocity.vx,
        velocity.vy,
        18,
        "ROSE_MOTHER",
        1,
        {
          type: BulletBehavior.SPLIT_BURST,
          param0: 1.12,
          param1: 16,
          param2: 174,
        }
      );
    }

    fireDelayedRandomRing(x, y, count, speed, startAngle = 0) {
      if (count <= 0) {
        return;
      }

      const step = 360 / count;
      for (let i = 0; i < count; i += 1) {
        const angle = startAngle + step * i;
        const velocity = this.angleToVelocity(angle, speed);

        this.bulletManager.spawnBullet(
          x,
          y,
          velocity.vx,
          velocity.vy,
          7,
          "ROSE_GILDED",
          1,
          {
            type: BulletBehavior.DELAYED_RANDOM,
            param0: 1,
            param1: 0.8,
            param2: 236,
            param3: 5.2,
          }
        );
      }
    }

    update(deltaTime, originX, originY) {
      this.spiralTimer += deltaTime;

      while (this.spiralTimer >= this.spiralInterval) {
        this.spiralTimer -= this.spiralInterval;
        this.fireSpiral(originX, originY);
      }
    }

    fireSpiral(x, y) {
      this.spiralAngle += 11;
      const primary = this.angleToVelocity(this.spiralAngle, 170);
      const secondary = this.angleToVelocity(this.spiralAngle + 180, 170);

      this.bulletManager.spawnBullet(x, y, primary.vx, primary.vy, 7, "PETAL_DARK");
      this.bulletManager.spawnBullet(x, y, secondary.vx, secondary.vy, 7, "PETAL_GOLD");
    }

    getAngleToTarget(x, y, targetX, targetY) {
      return (Math.atan2(targetY - y, targetX - x) * 180) / Math.PI;
    }

    angleToVelocity(angleDeg, speed) {
      const rad = (angleDeg * Math.PI) / 180;
      return {
        vx: Math.cos(rad) * speed,
        vy: Math.sin(rad) * speed,
      };
    }
  }

  global.Emitter = Emitter;
  global.RosePalette = Palette;
})(window.XTouhouWeb);
