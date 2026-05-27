(function registerEmitter(global) {
  const BulletBehavior = global.BulletBehavior;

  class Emitter {
    constructor(bulletManager) {
      this.bulletManager = bulletManager;
      this.spiralTimer = 0;
      this.spiralAngle = 0;
      this.spiralInterval = 0.04;
    }

    fireNWay(x, y, wayCount, spreadAngle, speed, centerAngle, radius = 6, color = "#ffb35c") {
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

    fireRing(x, y, count, speed, startAngle = 0, radius = 6, color = "#ffb35c") {
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
      color = "#9ed8ff"
    ) {
      const centerAngle = this.getAngleToTarget(x, y, targetX, targetY);
      this.fireNWay(x, y, wayCount, spreadAngle, speed, centerAngle, radius, color);
    }

    fireSpiralPair(x, y, baseAngle, speed, radius = 5, colorA = "#ffa46d", colorB = "#ff6b83") {
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
        "#00ff55",
        1,
        {
          type: BulletBehavior.RETARGET_ONCE,
          param0: 0.5,
          param1: 248,
        }
      );
    }

    fireSplitBurstMother(x, y, angleDeg = 90) {
      const velocity = this.angleToVelocity(angleDeg, 78);
      this.bulletManager.spawnBullet(
        x,
        y,
        velocity.vx,
        velocity.vy,
        16,
        "#ffff00",
        1,
        {
          type: BulletBehavior.SPLIT_BURST,
          param0: 1.08,
          param1: 16,
          param2: 268,
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
          6,
          "#0088ff",
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
      const primary = this.angleToVelocity(this.spiralAngle, 180);
      const secondary = this.angleToVelocity(this.spiralAngle + 180, 180);

      this.bulletManager.spawnBullet(x, y, primary.vx, primary.vy, 5, "#ffa46d");
      this.bulletManager.spawnBullet(x, y, secondary.vx, secondary.vy, 5, "#ff6b83");
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
})(window.XTouhouWeb);
