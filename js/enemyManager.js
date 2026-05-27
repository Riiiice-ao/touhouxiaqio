(function registerEnemyManager(global) {
  const { GAME_HEIGHT, GAME_WIDTH, MAX_ENEMIES } = global.Config;
  const TYPE_A = 1;
  const TYPE_B = 2;
  const TYPE_C = 3;

  class EnemyManager {
    constructor(emitter) {
      this.emitter = emitter;
      this.pool = this.createPool(MAX_ENEMIES);
      this.difficulty = "easy";
    }

    setDifficulty(difficulty) {
      this.difficulty = difficulty;
    }

    createPool(capacity) {
      const pool = {
        capacity,
        count: 0,
        x: new Float32Array(capacity),
        y: new Float32Array(capacity),
        vx: new Float32Array(capacity),
        vy: new Float32Array(capacity),
        radius: new Float32Array(capacity),
        type: new Uint8Array(capacity),
        state: new Uint8Array(capacity),
        direction: new Int8Array(capacity),
        attackTimer: new Float32Array(capacity),
        driftTimer: new Float32Array(capacity),
        shotCount: new Uint8Array(capacity),
        health: new Float32Array(capacity),
        maxHealth: new Float32Array(capacity),
        score: new Uint16Array(capacity),
        active: new Uint8Array(capacity),
        activeIndices: new Int32Array(capacity),
        activePositions: new Int32Array(capacity),
        freeIndices: new Int32Array(capacity),
      };

      pool.freeTop = capacity;

      for (let i = 0; i < capacity; i += 1) {
        pool.freeIndices[i] = capacity - 1 - i;
        pool.activePositions[i] = -1;
      }

      return pool;
    }

    getActiveCount() {
      return this.pool.count;
    }

    spawnRandomWave() {
      const roll = Math.random();
      if (roll < 0.34) {
        this.spawnTypeAWave();
      } else if (roll < 0.68) {
        this.spawnTypeBWave();
      } else {
        this.spawnTypeCWave();
      }
    }

    spawnTypeAWave() {
      const line = Math.random() < 0.5;
      const originX = 120 + Math.random() * (GAME_WIDTH - 240);
      const originY = -36;
      const offsets = line
        ? [
            { x: -42, y: 0 },
            { x: 0, y: 0 },
            { x: 42, y: 0 },
          ]
        : [
            { x: 0, y: 0 },
            { x: -32, y: 24 },
            { x: 32, y: 24 },
            { x: -64, y: 48 },
            { x: 64, y: 48 },
          ];

      const bulletSpeedBonus = this.difficulty === "hard" ? 1.25 : 1;

      for (let i = 0; i < offsets.length; i += 1) {
        const offset = offsets[i];
        this.spawnEnemy(TYPE_A, originX + offset.x, originY + offset.y, 0, 120 + Math.random() * 28, {
          radius: 14,
          health: 4,
          score: 160,
          attackTimer: 0.55 + Math.random() * 0.35,
          bulletSpeedBonus,
        });
      }
    }

    spawnTypeBWave() {
      const fromLeft = Math.random() < 0.5;
      const originX = fromLeft ? -38 : GAME_WIDTH + 38;
      const originY = 70 + Math.random() * 110;
      const xDirection = fromLeft ? 1 : -1;
      const line = Math.random() < 0.5;
      const offsets = line
        ? [
            { x: 0, y: 0 },
            { x: -22 * xDirection, y: 32 },
            { x: -44 * xDirection, y: 64 },
          ]
        : [
            { x: 0, y: 0 },
            { x: -24 * xDirection, y: 18 },
            { x: -48 * xDirection, y: 36 },
            { x: -24 * xDirection, y: 54 },
            { x: 0, y: 72 },
          ];

      const bulletSpeedBonus = this.difficulty === "hard" ? 1.25 : 1;

      for (let i = 0; i < offsets.length; i += 1) {
        const offset = offsets[i];
        this.spawnEnemy(
          TYPE_B,
          originX + offset.x,
          originY + offset.y,
          64 * xDirection,
          56,
          {
            radius: 13,
            health: 3,
            score: 180,
            attackTimer: 0.9 + Math.random() * 0.4,
            direction: xDirection,
            bulletSpeedBonus,
          }
        );
      }
    }

    spawnTypeCWave() {
      const line = Math.random() < 0.5;
      const originX = GAME_WIDTH * 0.5;
      const originY = -50;
      const offsets = line
        ? [
            { x: -54, y: 0 },
            { x: 0, y: 0 },
            { x: 54, y: 0 },
          ]
        : [
            { x: 0, y: 0 },
            { x: -42, y: 28 },
            { x: 42, y: 28 },
          ];

      const bulletSpeedBonus = this.difficulty === "hard" ? 1.25 : 1;

      for (let i = 0; i < offsets.length; i += 1) {
        const offset = offsets[i];
        this.spawnEnemy(TYPE_C, originX + offset.x, originY + offset.y, 0, 44, {
          radius: 16,
          health: 5,
          score: 240,
          attackTimer: 1.1 + Math.random() * 0.25,
          bulletSpeedBonus,
        });
      }
    }

    spawnEnemy(type, x, y, vx, vy, options) {
      const pool = this.pool;
      if (pool.freeTop <= 0) {
        return -1;
      }

      const slot = pool.freeIndices[pool.freeTop - 1];
      pool.freeTop -= 1;

      pool.x[slot] = x;
      pool.y[slot] = y;
      pool.vx[slot] = vx;
      pool.vy[slot] = vy;
      pool.radius[slot] = options.radius;
      pool.type[slot] = type;
      pool.state[slot] = 0;
      pool.direction[slot] = options.direction || 0;
      pool.attackTimer[slot] = options.attackTimer || 0.8;
      pool.driftTimer[slot] = 0;
      pool.shotCount[slot] = 0;
      pool.score[slot] = options.score || 100;
      pool.active[slot] = 1;

      global.HealthSystem.resetPoolSlot(pool, slot, options.health);
      pool.maxHealth[slot] = options.bulletSpeedBonus || 1;

      pool.activeIndices[pool.count] = slot;
      pool.activePositions[slot] = pool.count;
      pool.count += 1;

      return slot;
    }

    update(deltaTime, player) {
      const pool = this.pool;
      let i = 0;

      while (i < pool.count) {
        const slot = pool.activeIndices[i];
        const type = pool.type[slot];

        pool.attackTimer[slot] -= deltaTime;
        pool.driftTimer[slot] += deltaTime;

        if (type === TYPE_A) {
          this.updateTypeA(slot, deltaTime);
        } else if (type === TYPE_B) {
          this.updateTypeB(slot, deltaTime, player);
        } else if (type === TYPE_C) {
          this.updateTypeC(slot, deltaTime);
        }

        if (this.isOutOfBounds(slot)) {
          this.recycle(slot);
          continue;
        }

        i += 1;
      }
    }

    updateTypeA(slot, deltaTime) {
      const pool = this.pool;
      pool.x[slot] += pool.vx[slot] * deltaTime;
      pool.y[slot] += pool.vy[slot] * deltaTime;

      if (pool.attackTimer[slot] <= 0) {
        pool.attackTimer[slot] += 1;
        this.emitter.fireNWay(
          pool.x[slot],
          pool.y[slot] + 12,
          1,
          0,
          180 * pool.maxHealth[slot],
          90,
          5,
          "#ffc892"
        );
      }
    }

    updateTypeB(slot, deltaTime, player) {
      const pool = this.pool;
      pool.x[slot] += pool.vx[slot] * deltaTime;
      pool.y[slot] += pool.vy[slot] * deltaTime;

      if (pool.attackTimer[slot] <= 0) {
        pool.attackTimer[slot] += 1.45;
        this.emitter.fireAimedNWay(
          pool.x[slot],
          pool.y[slot],
          player.x,
          player.y,
          3,
          18,
          170 * pool.maxHealth[slot],
          4,
          "#8ec4ff"
        );
      }
    }

    updateTypeC(slot, deltaTime) {
      const pool = this.pool;
      const state = pool.state[slot];

      if (state === 0) {
        pool.y[slot] += pool.vy[slot] * deltaTime;
        if (pool.y[slot] >= 220) {
          pool.state[slot] = 1;
          pool.attackTimer[slot] = 0.35;
        }
        return;
      }

      if (state === 1) {
        pool.x[slot] += Math.sin(pool.driftTimer[slot] * 2 + slot) * 6 * deltaTime;
        if (pool.attackTimer[slot] <= 0) {
          pool.attackTimer[slot] += 2;
          pool.shotCount[slot] += 1;
          this.emitter.fireRing(
            pool.x[slot],
            pool.y[slot],
            6,
            140 * pool.maxHealth[slot],
            pool.driftTimer[slot] * 45,
            5,
            "#efb0ff"
          );
          if (pool.shotCount[slot] >= 2) {
            pool.state[slot] = 2;
            pool.vy[slot] = -96;
          }
        }
        return;
      }

      pool.y[slot] += pool.vy[slot] * deltaTime;
    }

    checkBulletHit(x, y, radius, damage, player) {
      const pool = this.pool;
      for (let i = 0; i < pool.count; i += 1) {
        const slot = pool.activeIndices[i];
        const dx = pool.x[slot] - x;
        const dy = pool.y[slot] - y;
        const totalRadius = pool.radius[slot] + radius;

        if (dx * dx + dy * dy > totalRadius * totalRadius) {
          continue;
        }

        if (global.HealthSystem.damagePoolSlot(pool, slot, damage)) {
          player.addScore(pool.score[slot]);
          this.recycle(slot);
        }

        return true;
      }

      return false;
    }

    clearAll() {
      while (this.pool.count > 0) {
        this.recycle(this.pool.activeIndices[0]);
      }
    }

    recycle(slot) {
      const pool = this.pool;
      const removePosition = pool.activePositions[slot];
      const lastPosition = pool.count - 1;
      const lastSlot = pool.activeIndices[lastPosition];

      pool.activeIndices[removePosition] = lastSlot;
      pool.activePositions[lastSlot] = removePosition;

      pool.count = lastPosition;
      pool.activePositions[slot] = -1;
      pool.active[slot] = 0;
      pool.shotCount[slot] = 0;
      pool.maxHealth[slot] = 0;
      pool.freeIndices[pool.freeTop] = slot;
      pool.freeTop += 1;
    }

    isOutOfBounds(slot) {
      const pool = this.pool;
      return (
        pool.x[slot] < -80 ||
        pool.x[slot] > GAME_WIDTH + 80 ||
        pool.y[slot] < -90 ||
        pool.y[slot] > GAME_HEIGHT + 90
      );
    }

    render(ctx) {
      const pool = this.pool;

      for (let i = 0; i < pool.count; i += 1) {
        const slot = pool.activeIndices[i];
        const x = pool.x[slot];
        const y = pool.y[slot];
        const type = pool.type[slot];

        if (type === TYPE_A) {
          ctx.fillStyle = "#ff9b6a";
          ctx.beginPath();
          ctx.moveTo(x, y - 14);
          ctx.lineTo(x - 11, y + 8);
          ctx.lineTo(x, y + 2);
          ctx.lineTo(x + 11, y + 8);
          ctx.closePath();
          ctx.fill();
        } else if (type === TYPE_B) {
          ctx.fillStyle = "#8ec9ff";
          ctx.beginPath();
          ctx.moveTo(x, y - 12);
          ctx.lineTo(x - 12, y + 10);
          ctx.lineTo(x + 12, y + 10);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = "#f1b6ff";
          ctx.beginPath();
          ctx.arc(x, y, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.55)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 18, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  global.EnemyManager = EnemyManager;
})(window.XTouhouWeb);
