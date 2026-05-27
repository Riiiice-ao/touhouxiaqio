(function registerBossController(global) {
  const {
    BOSS_ENTRY_X,
    BOSS_ENTRY_Y,
    BOSS_MAX_HEALTH,
    BOSS_MOVE_DURATION_MAX,
    BOSS_MOVE_DURATION_MIN,
    BOSS_PHASE_THREE_THRESHOLD,
    BOSS_PHASE_TWO_THRESHOLD,
    BOSS_STOP_DURATION,
    GAME_WIDTH,
  } = global.Config;

  class BossController {
    constructor(emitter, bulletManager, bombEffect) {
      this.emitter = emitter;
      this.bulletManager = bulletManager;
      this.bombEffect = bombEffect;
      this.radius = 30;
      this.entrySpeed = 120;
      this.targetX = BOSS_ENTRY_X;
      this.targetY = BOSS_ENTRY_Y;
      this.lanePositions = [140, 300, 460];
      this.difficulty = "easy";

      this.reset();
    }

    setDifficulty(difficulty) {
      this.difficulty = difficulty;
    }

    reset() {
      this.active = false;
      this.inBattle = false;
      this.defeated = false;
      this.phase = 1;
      this.phaseName = "Scarlet Bloom";
      this.phaseBarColors = ["#ffe0d5", "#ff8f80", "#f3404c", "#8b1020"];
      this.x = BOSS_ENTRY_X;
      this.y = -92;
      this.moveClock = 0;
      this.moveState = "moving";
      this.moveStartX = BOSS_ENTRY_X;
      this.moveEndX = BOSS_ENTRY_X;
      this.moveElapsed = 0;
      this.moveDuration = 2.4;
      this.stopTimer = BOSS_STOP_DURATION;
      this.pauseDuration = BOSS_STOP_DURATION;
      this.waveTimer = 0.35;
      this.aimedTimer = 1.1;
      this.spiralTimer = 0;
      this.spiralAngle = 0;
      this.followTimer = 0.45;
      this.splitTimer = 0.8;
      this.randomTimer = 0.95;
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
        this.beginMoveTo(this.chooseNextDestination());
        return;
      }

      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;
    }

    updateBattle(deltaTime, player) {
      this.moveClock += deltaTime;
      this.updateMovementState(deltaTime);

      this.waveTimer -= deltaTime;
      this.aimedTimer -= deltaTime;
      this.spiralTimer += deltaTime;
      this.followTimer -= deltaTime;
      this.splitTimer -= deltaTime;
      this.randomTimer -= deltaTime;

      if (this.phase === 1) {
        this.updatePhaseOnePatterns(player);
        return;
      }

      if (this.phase === 2) {
        this.updatePhaseTwoPatterns(player);
        return;
      }

      this.updatePhaseThreePatterns(player);
    }

    updateMovementState(deltaTime) {
      if (this.moveState === "moving") {
        this.moveElapsed += deltaTime;
        const progress = Math.min(1, this.moveElapsed / this.moveDuration);
        const eased = 0.5 - Math.cos(Math.PI * progress) * 0.5;
        this.x = this.moveStartX + (this.moveEndX - this.moveStartX) * eased;
        this.y = this.targetY + Math.sin(this.moveClock * 1.3) * 10;

        if (progress >= 1) {
          this.moveState = "stopped";
          this.stopTimer = this.pauseDuration;
          this.x = this.moveEndX;
        }

        return;
      }

      this.stopTimer -= deltaTime;
      this.x = this.moveEndX;
      this.y = this.targetY + Math.sin(this.moveClock * 1.3) * 6;

      if (this.stopTimer <= 0) {
        this.beginMoveTo(this.chooseNextDestination());
      }
    }

    beginMoveTo(destinationX) {
      this.moveState = "moving";
      this.moveStartX = this.x;
      this.moveEndX = destinationX;
      this.moveElapsed = 0;
      this.moveDuration =
        BOSS_MOVE_DURATION_MIN + Math.random() * (BOSS_MOVE_DURATION_MAX - BOSS_MOVE_DURATION_MIN);
    }

    chooseNextDestination() {
      const candidates = this.lanePositions.filter((position) => Math.abs(position - this.x) > 30);
      return candidates[Math.floor(Math.random() * candidates.length)] ?? this.targetX;
    }

    updatePhaseOnePatterns(player) {
      const hard = this.difficulty === "hard";

      if (this.waveTimer <= 0) {
        const baseInterval = this.moveState === "stopped" ? 0.26 : 0.52;
        this.waveTimer += hard ? baseInterval * 0.76 : baseInterval;
        const spread = this.moveState === "stopped" ? 145 : 92;
        const ways = this.moveState === "stopped" ? (hard ? 15 : 13) : hard ? 11 : 9;
        this.emitter.fireNWay(this.x, this.y, ways, spread, 170, 90, 6, "#ffd37e");
      }

      if (this.aimedTimer <= 0) {
        this.aimedTimer += hard ? 1.08 : 1.45;
        this.emitter.fireAimedNWay(this.x, this.y, player.x, player.y, hard ? 5 : 3, 22, 198, 5, "#9fd5ff");
      }

      const spiralStep = hard ? 0.04 : 0.05;
      while (this.spiralTimer >= spiralStep) {
        this.spiralTimer -= spiralStep;
        this.spiralAngle += this.moveState === "stopped" ? 18 : 12;
        this.emitter.fireSpiralPair(this.x, this.y, this.spiralAngle, 192, 5, "#ffa46d", "#ff6b83");
      }
    }

    updatePhaseTwoPatterns(player) {
      const hard = this.difficulty === "hard";

      if (this.moveState === "moving") {
        if (this.followTimer <= 0) {
          this.followTimer += hard ? 0.38 : 0.5;
          this.emitter.fireRetargetFollower(this.x, this.y, player.x, player.y);
        }
        return;
      }

      if (this.splitTimer <= 0) {
        this.splitTimer += hard ? 0.64 : 0.82;
        this.emitter.fireSplitBurstMother(this.x - 32, this.y + 12, 98);
        this.emitter.fireSplitBurstMother(this.x + 32, this.y + 12, 82);
        if (hard) {
          this.emitter.fireSplitBurstMother(this.x, this.y + 4, 90);
        }
      }
    }

    updatePhaseThreePatterns(player) {
      const hard = this.difficulty === "hard";

      if (this.moveState === "moving") {
        if (this.followTimer <= 0) {
          this.followTimer += hard ? 0.34 : 0.42;
          this.emitter.fireRetargetFollower(this.x, this.y, player.x, player.y);
        }
        return;
      }

      if (this.randomTimer <= 0) {
        this.randomTimer += hard ? 0.82 : 1.04;
        const startAngle = Math.random() * 360;
        this.emitter.fireDelayedRandomRing(this.x, this.y, hard ? 16 : 12, 210, startAngle);
        if (hard) {
          this.emitter.fireSplitBurstMother(this.x - 48, this.y + 10, 102);
          this.emitter.fireSplitBurstMother(this.x + 48, this.y + 10, 78);
        }
      }
    }

    updatePhaseByHealth() {
      const ratio = global.HealthSystem.getRatio(this);

      if (this.phase === 1 && ratio <= BOSS_PHASE_TWO_THRESHOLD) {
        this.enterPhase(2);
        return;
      }

      if (this.phase === 2 && ratio <= BOSS_PHASE_THREE_THRESHOLD) {
        this.enterPhase(3);
      }
    }

    enterPhase(phase) {
      this.phase = phase;

      if (phase === 2) {
        this.phaseName = "Split Burst Sign";
        this.phaseBarColors = ["#fff8d4", "#ffc642", "#ff8a00", "#912700"];
      } else if (phase === 3) {
        this.phaseName = "Chaotic Freeze Sign";
        this.phaseBarColors = ["#d6f1ff", "#4bb4ff", "#0e69f0", "#07266c"];
      }

      this.bulletManager.clearEnemyBullets();
      this.bombEffect.start(this.x, this.y, this.phaseName, {
        clearsBullets: false,
        overlayAlpha: 0.28,
        ringColor: phase === 2 ? "255, 220, 120" : "120, 220, 255",
        shadowColor: phase === 2 ? "rgba(255, 180, 60, 0.55)" : "rgba(80, 180, 255, 0.55)",
        textColor: phase === 2 ? "rgba(255, 247, 205, 0.98)" : "rgba(220, 245, 255, 0.98)",
      });

      this.moveState = "stopped";
      this.stopTimer = 1.1;
      this.waveTimer = 0.24;
      this.aimedTimer = 0.6;
      this.followTimer = 0.32;
      this.splitTimer = 0.45;
      this.randomTimer = 0.55;
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
      } else {
        this.updatePhaseByHealth();
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
      barGradient.addColorStop(0, this.phaseBarColors[0]);
      barGradient.addColorStop(0.18, this.phaseBarColors[1]);
      barGradient.addColorStop(0.55, this.phaseBarColors[2]);
      barGradient.addColorStop(1, this.phaseBarColors[3]);
      ctx.fillStyle = barGradient;
      ctx.fillRect(x, y, width * ratio, height);

      ctx.strokeStyle = "rgba(255, 230, 210, 0.72)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = "#fff2e7";
      ctx.font = "bold 14px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${this.phaseName}  HP`, GAME_WIDTH * 0.5, y - 4);

      ctx.restore();
    }
  }

  global.BossController = BossController;
})(window.XTouhouWeb);
