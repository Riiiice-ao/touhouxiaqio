(function registerEmitter(global) {
  /**
   * 发射器。
   * 所有弹幕几何模式最终都会落到“角度 -> 速度向量”的数学转换上。
   */
  class Emitter {
    constructor(bulletManager) {
      this.bulletManager = bulletManager;
      this.spiralTimer = 0;
      this.spiralAngle = 0;
      this.spiralInterval = 0.04;
    }

    /**
     * 发射扇形 N-Way。
     *
     * @param {number} x 发射源 X
     * @param {number} y 发射源 Y
     * @param {number} wayCount 子弹数量
     * @param {number} spreadAngle 扇形总夹角，单位为度
     * @param {number} speed 子弹速度
     * @param {number} centerAngle 扇形中心朝向，90 度代表正下方
     */
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

    /**
     * 连续螺旋弹。
     * 通过累积计时器来保证不同帧率下，发射节奏仍然稳定。
     */
    update(deltaTime, originX, originY) {
      this.spiralTimer += deltaTime;

      while (this.spiralTimer >= this.spiralInterval) {
        this.spiralTimer -= this.spiralInterval;
        this.fireSpiral(originX, originY);
      }
    }

    /**
     * 这里做了一个双臂螺旋，视觉上会更像向日葵/旋涡。
     */
    fireSpiral(x, y) {
      this.spiralAngle += 11;
      const primary = this.angleToVelocity(this.spiralAngle, 180);
      const secondary = this.angleToVelocity(this.spiralAngle + 180, 180);

      this.bulletManager.spawnBullet(x, y, primary.vx, primary.vy, 5, "#ffa46d");
      this.bulletManager.spawnBullet(x, y, secondary.vx, secondary.vy, 5, "#ff6b83");
    }

    /**
     * 把角度转换成速度向量。
     * 这是规则几何弹幕最基础也最常用的一步。
     */
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
