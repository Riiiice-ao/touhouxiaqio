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
    GAME_HEIGHT,
    GAME_WIDTH,
  } = global.Config;

  const Palette = global.RosePalette || {
    roseRed: "#D21F3C",
    crimson: "#99001A",
    gold: "#FFD700",
    antiqueGold: "#D4AF37",
    velvet: "#4A0E17",
    moon: "#FFFDD0",
  };

  const BOSS_FRAMES = {
    idle: [
      { x: 1272, y: 324, w: 204, h: 308 },
      { x: 1524, y: 324, w: 204, h: 308 },
      { x: 1776, y: 324, w: 204, h: 308 },
      { x: 2028, y: 324, w: 204, h: 308 },
    ],
    side: [
      { x: 1276, y: 716, w: 210, h: 320 },
      { x: 1528, y: 716, w: 210, h: 320 },
      { x: 1780, y: 716, w: 210, h: 320 },
      { x: 2032, y: 716, w: 210, h: 320 },
    ],
  };

  const PHASE_TIME_LIMIT = 180;
  const TOTAL_BOSS_TIME_LIMIT = 540;
  const EXIT_DURATION = 2;

  class BossController {
    constructor(emitter, bulletManager, bombEffect, assetLoader) {
      this.emitter = emitter;
      this.bulletManager = bulletManager;
      this.bombEffect = bombEffect;
      this.assetLoader = assetLoader;
      this.itemManager = null;
      this.radius = 30;
      this.entrySpeed = 120;
      this.targetX = BOSS_ENTRY_X;
      this.targetY = BOSS_ENTRY_Y;
      this.lanePositions = [140, 300, 460];
      this.difficulty = "easy";
      this.difficultyHpMultiplier = 1;

      this.reset();
    }

    setDifficulty(difficulty) {
      this.difficulty = difficulty;
      this.difficultyHpMultiplier = difficulty === "lunatic" ? 1.5 : 1;
    }

    setItemManager(itemManager) {
      this.itemManager = itemManager;
    }

    reset() {
      this.active = false;
      this.inBattle = false;
      this.defeated = false;
      this.invulnerable = false;
      this.timedOut = false;
      this.escapeElapsed = 0;
      this.escapeStartY = 0;
      this.totalBattleTimer = 0;
      this.phaseTimer = 0;
      this.phaseRewardMask = 0;
      this.phaseThreeBranchIndex = 0;
      this.phaseThreeLaserTimer = 0;
      this.phaseThreeLaserWall = 0;
      this.phase = 1;
      this.phaseName = "Scarlet Bloom";
      this.phaseBarColors = [Palette.moon, Palette.antiqueGold, Palette.crimson, Palette.velvet];
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
      this.spriteFrame = 0;
      this.spriteTimer = 0;
      this.spriteState = "idle";
      this.facingDirection = 1;
      this.prevX = this.x;
      global.HealthSystem.resetEntity(this, Math.floor(BOSS_MAX_HEALTH * this.difficultyHpMultiplier));
    }

    activateEntry() {
      this.reset();
      this.active = true;
    }

    update(deltaTime, player, audioAnalysis = { isBeat: false, musicFlow: 0 }) {
      if (!this.active || this.defeated) {
        return;
      }

      if (!this.inBattle) {
        this.updateEntry(deltaTime);
        return;
      }

      if (this.timedOut) {
        this.updateTimedDeparture(deltaTime);
        return;
      }

      this.updateBattle(deltaTime, player, audioAnalysis);
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

    updateBattle(deltaTime, player, audioAnalysis) {
      this.totalBattleTimer += deltaTime;
      this.phaseTimer += deltaTime;

      if (this.totalBattleTimer >= TOTAL_BOSS_TIME_LIMIT) {
        this.beginTimedDeparture();
        return;
      }

      if (this.phaseTimer >= PHASE_TIME_LIMIT) {
        this.forceNextPhase();
        return;
      }

      this.moveClock += deltaTime;
      this.updateMovementState(deltaTime);

      this.waveTimer -= deltaTime;
      this.aimedTimer -= deltaTime;
      this.spiralTimer += deltaTime;
      this.followTimer -= deltaTime;
      this.splitTimer -= deltaTime;
      this.randomTimer -= deltaTime;
      this.phaseThreeLaserTimer = Math.max(0, this.phaseThreeLaserTimer - deltaTime);
      this.spriteTimer += deltaTime;
      this.updateSpriteState();
      if (this.spriteTimer >= 0.14) {
        this.spriteTimer = 0;
        const activeFrames = this.spriteState === "side" ? BOSS_FRAMES.side : BOSS_FRAMES.idle;
        this.spriteFrame = (this.spriteFrame + 1) % activeFrames.length;
      }

      if (audioAnalysis.isBeat) {
        this.emitter.fireNWay(
          this.x,
          this.y,
          1,
          0,
          160,
          this.emitter.getAngleToTarget(this.x, this.y, player.x, player.y),
          11,
          Palette.antiqueGold
        );
      }

      if (this.phase === 1) {
        this.updatePhaseOnePatterns(audioAnalysis);
        return;
      }

      if (this.phase === 2) {
        this.updatePhaseTwoPatterns(player, audioAnalysis);
        return;
      }

      this.updatePhaseThreePatterns(player, audioAnalysis);
    }

    updateTimedDeparture(deltaTime) {
      this.escapeElapsed += deltaTime;
      const progress = Math.min(1, this.escapeElapsed / EXIT_DURATION);
      const eased = 1 - (1 - progress) * (1 - progress);
      this.y = this.escapeStartY + (-120 - this.escapeStartY) * eased;

      if (progress >= 1) {
        this.defeated = true;
        this.active = false;
        this.inBattle = false;
      }
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

    updateSpriteState() {
      const deltaX = this.x - this.prevX;
      if (Math.abs(deltaX) > 0.3) {
        this.spriteState = "side";
        this.facingDirection = deltaX > 0 ? 1 : -1;
      } else {
        this.spriteState = "idle";
      }
      this.prevX = this.x;
    }

    updatePhaseOnePatterns(audioAnalysis) {
      const hard = this.difficulty === "hard" || this.difficulty === "lunatic";
      const lunatic = this.difficulty === "lunatic";
      const flowFactor = Math.max(0.25, audioAnalysis.musicFlow);

      if (this.waveTimer <= 0) {
        const baseInterval = this.moveState === "stopped" ? 0.28 : 0.56;
        const multiplier = lunatic ? 0.58 : hard ? 0.76 : 1;
        this.waveTimer += baseInterval * multiplier * (1.08 - flowFactor * 0.34);
        const spread = this.moveState === "stopped" ? 145 : 92;
        const ways = this.moveState === "stopped" ? (lunatic ? 17 : hard ? 15 : 13) : lunatic ? 13 : hard ? 11 : 9;
        this.emitter.fireNWay(this.x, this.y, ways, spread, lunatic ? 158 : 146, 90, 7, Palette.antiqueGold);
      }

      const spiralStep = (lunatic ? 0.036 : hard ? 0.045 : 0.055) * (1.08 - flowFactor * 0.2);
      while (this.spiralTimer >= spiralStep) {
        this.spiralTimer -= spiralStep;
        this.spiralAngle += this.moveState === "stopped" ? 18 : 12;
        this.emitter.fireSpiralPair(this.x, this.y, this.spiralAngle, lunatic ? 176 : 160, 7, "PETAL_DARK", "PETAL_GOLD");
      }
    }

    updatePhaseTwoPatterns(player, audioAnalysis) {
      const hard = this.difficulty === "hard" || this.difficulty === "lunatic";
      const lunatic = this.difficulty === "lunatic";

      if (this.moveState === "moving") {
        if (this.followTimer <= 0) {
          this.followTimer += lunatic ? 0.28 : hard ? 0.38 : 0.5;
          this.emitter.fireRetargetFollower(this.x, this.y, player.x, player.y);
          if (lunatic) {
            this.emitter.fireRetargetFollower(this.x - 18, this.y + 10, player.x, player.y);
            this.emitter.fireRetargetFollower(this.x + 18, this.y + 10, player.x, player.y);
          }
        }
        return;
      }

      if (this.splitTimer <= 0) {
        this.splitTimer += (lunatic ? 0.54 : hard ? 0.68 : 0.88) * (1.12 - audioAnalysis.musicFlow * 0.24);
        this.emitter.fireSplitBurstMother(this.x - 32, this.y + 12, 96);
        this.emitter.fireSplitBurstMother(this.x + 32, this.y + 12, 84);
        if (hard) {
          this.emitter.fireSplitBurstMother(this.x, this.y + 6, 90);
        }
        if (lunatic) {
          this.emitter.fireNWay(this.x, this.y, 7, 68, 88, 90, 4, Palette.moon);
        }
      }
    }

    updatePhaseThreePatterns(player, audioAnalysis) {
      const hard = this.difficulty === "hard" || this.difficulty === "lunatic";
      const lunatic = this.difficulty === "lunatic";

      if (this.moveState === "moving") {
        if (this.followTimer <= 0) {
          this.followTimer += lunatic ? 0.26 : hard ? 0.36 : 0.44;
          this.firePhaseThreePatternBranch(player, audioAnalysis);
        }
        return;
      }

      if (this.randomTimer <= 0) {
        this.randomTimer += (lunatic ? 0.72 : hard ? 0.92 : 1.16) * (1.06 - audioAnalysis.musicFlow * 0.22);
        this.firePhaseThreePatternBranch(player, audioAnalysis);
      }
    }

    firePhaseThreePatternBranch(player, audioAnalysis) {
      const branch = this.phaseThreeBranchIndex % 3;
      this.phaseThreeBranchIndex += 1;

      if (branch === 0) {
        this.fireAuroraBubbleBranch(player);
        return;
      }

      if (branch === 1) {
        this.firePetalRainBranch(audioAnalysis);
        return;
      }

      this.fireSideLaserBranch(player);
    }

    fireAuroraBubbleBranch(player) {
      const currentBubbles = this.bulletManager.countEnemyBulletsByColor("AURORA_BUBBLE");
      const overcrowded = currentBubbles >= 10;
      const severeOvercrowd = currentBubbles >= 16;
      let waveCount = this.difficulty === "lunatic" ? 6 : this.difficulty === "hard" ? 5 : 4;

      if (severeOvercrowd) {
        waveCount = Math.max(2, Math.ceil(waveCount * 0.5));
      } else if (overcrowded) {
        waveCount = Math.max(3, Math.ceil(waveCount * 0.7));
      }

      const baseAngle = this.emitter.getAngleToTarget(this.x, this.y, player.x, player.y);
      const spread = 84;
      const start = baseAngle - spread * 0.5;
      const step = waveCount <= 1 ? 0 : spread / (waveCount - 1);

      for (let i = 0; i < waveCount; i += 1) {
        const angleDeg = start + step * i;
        const rad = (angleDeg * Math.PI) / 180;
        const speed = 52 + i * 4;
        this.bulletManager.spawnBullet(
          this.x,
          this.y + 10,
          Math.cos(rad) * speed,
          Math.sin(rad) * speed,
          15,
          "AURORA_BUBBLE"
        );
      }
    }

    firePetalRainBranch(audioAnalysis) {
      const flow = Math.max(0.2, audioAnalysis.musicFlow);
      const ways = this.difficulty === "lunatic" ? 11 : this.difficulty === "hard" ? 9 : 7;
      const spread = 112;
      const speed = this.difficulty === "lunatic" ? 136 : 124;
      this.emitter.fireNWay(this.x, this.y + 8, ways, spread, speed, 90, 7, "PETAL_DARK");

      const splitCount = this.difficulty === "lunatic" ? 3 : 2;
      for (let i = 0; i < splitCount; i += 1) {
        const offset = splitCount === 1 ? 0 : (i - (splitCount - 1) * 0.5) * 34;
        this.emitter.fireSplitBurstMother(this.x + offset, this.y + 8, 84 + i * 12);
      }

      const rainWays = this.difficulty === "lunatic" ? 8 : 6;
      for (let i = 0; i < rainWays; i += 1) {
        const angleDeg = 72 + i * (36 / Math.max(1, rainWays - 1));
        const rad = (angleDeg * Math.PI) / 180;
        const speedRain = 72 + flow * 10;
        this.bulletManager.spawnBullet(
          this.x,
          this.y + 12,
          Math.cos(rad) * speedRain,
          Math.sin(rad) * speedRain,
          6,
          "PETAL_DARK",
          1,
          {
            type: global.BulletBehavior.PETAL_RAIN,
            param0: 28,
            param1: 5.8,
            param2: 26,
            angleOffset: Math.random() * Math.PI * 2,
            spinSpeed: 1.2,
          }
        );
      }
    }

    fireSideLaserBranch(player) {
      this.phaseThreeLaserTimer = 1.15;
      this.phaseThreeLaserWall = player.x < this.x ? -1 : 1;

      const lanes = [
        this.x - 148,
        this.x + 148,
      ];

      for (let side = 0; side < lanes.length; side += 1) {
        const x = lanes[side];
        for (let i = 0; i < 14; i += 1) {
          this.bulletManager.spawnBullet(
            x,
            36 + i * 34,
            side === 0 ? 6 : -6,
            8,
            9,
            "PETAL_WHITE"
          );
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
      this.phaseTimer = 0;
      this.phaseRewardMask = 0;
      this.invulnerable = false;

      if (phase === 2) {
        this.phaseName = "Rose Explosion";
        this.phaseBarColors = [Palette.moon, Palette.roseRed, Palette.crimson, Palette.velvet];
      } else if (phase === 3) {
        this.phaseName = "Frozen Rose Finale";
        this.phaseBarColors = [Palette.moon, Palette.gold, Palette.roseRed, Palette.velvet];
      }

      this.bulletManager.clearEnemyBullets();
      this.bombEffect.start(this.x, this.y, this.phaseName, {
        clearsBullets: false,
        overlayAlpha: 0.28,
        ringColor: phase === 2 ? "255, 215, 0" : "255, 253, 208",
        shadowColor: phase === 2 ? "rgba(212, 31, 60, 0.55)" : "rgba(212, 175, 55, 0.55)",
        textColor: "rgba(255,253,208,0.98)",
      });

      this.moveState = "stopped";
      this.stopTimer = 1.1;
      this.waveTimer = 0.24;
      this.aimedTimer = 0.6;
      this.followTimer = 0.32;
      this.splitTimer = 0.45;
      this.randomTimer = 0.55;
      this.phaseThreeBranchIndex = 0;
      this.phaseThreeLaserTimer = 0;
      this.phaseThreeLaserWall = 0;
    }

    forceNextPhase() {
      this.bulletManager.clearEnemyBullets();

      if (this.phase < 3) {
        this.enterPhase(this.phase + 1);
        return;
      }

      this.beginTimedDeparture();
    }

    beginTimedDeparture() {
      if (this.timedOut) {
        return;
      }

      this.timedOut = true;
      this.invulnerable = true;
      this.escapeElapsed = 0;
      this.escapeStartY = this.y;
      this.bulletManager.clearEnemyBullets();
      this.bombEffect.start(this.x, this.y, "Time Up", {
        clearsBullets: false,
        overlayAlpha: 0.22,
        ringColor: "255, 215, 0",
        shadowColor: "rgba(255,215,0,0.45)",
        textColor: "rgba(255,253,208,0.96)",
      });
    }

    rewardPhaseThresholdCrossings(previousRatio, nextRatio) {
      const thresholds = [2 / 3, 1 / 3];
      for (let i = 0; i < thresholds.length; i += 1) {
        const threshold = thresholds[i];
        const bit = 1 << i;
        if ((this.phaseRewardMask & bit) !== 0) {
          continue;
        }
        if (previousRatio > threshold && nextRatio <= threshold && this.phaseTimer <= PHASE_TIME_LIMIT) {
          this.phaseRewardMask |= bit;
          this.spawnPhasePressureReward();
        }
      }
    }

    spawnPhasePressureReward() {
      if (!this.itemManager) {
        return;
      }

      const pointCount = 5 + Math.floor(Math.random() * 2);
      for (let i = 0; i < pointCount; i += 1) {
        const angle = -Math.PI * 0.92 + (Math.PI * 1.84 * i) / Math.max(1, pointCount - 1);
        const speed = 82 + Math.random() * 48;
        this.itemManager.spawnItem(
          1,
          this.x,
          this.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 82
        );
      }

      if (Math.random() < 0.1) {
        this.itemManager.spawnItem(2, this.x, this.y, (Math.random() - 0.5) * 36, -166);
      }
    }

    spawnFinalVictoryReward() {
      if (!this.itemManager) {
        return;
      }

      for (let i = 0; i < 40; i += 1) {
        const angle = (Math.PI * 2 * i) / 40 + Math.random() * 0.22;
        const speed = 92 + Math.random() * 128;
        this.itemManager.spawnItem(
          1,
          this.x,
          this.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 104
        );
      }

      this.itemManager.spawnItem(2, this.x - 14, this.y - 4, -28, -188);
      this.itemManager.spawnItem(2, this.x + 14, this.y - 4, 28, -188);
    }

    checkBulletHit(x, y, radius, damage, player) {
      if (!this.active || !this.inBattle || this.defeated || this.invulnerable || this.timedOut) {
        return false;
      }

      const dx = this.x - x;
      const dy = this.y - y;
      const totalRadius = this.radius + radius;

      if (dx * dx + dy * dy > totalRadius * totalRadius) {
        return false;
      }

      const previousRatio = global.HealthSystem.getRatio(this);
      if (global.HealthSystem.damageEntity(this, damage)) {
        this.defeated = true;
        this.active = false;
        this.inBattle = false;
        this.spawnFinalVictoryReward();
        player.addScore(5000);
      } else {
        this.rewardPhaseThresholdCrossings(previousRatio, global.HealthSystem.getRatio(this));
        this.updatePhaseByHealth();
      }

      return true;
    }

    render(ctx) {
      if (!this.active) {
        return;
      }

      const sprite = this.assetLoader.get("boss");
      if (sprite) {
        ctx.save();
        const frames = this.spriteState === "side" ? BOSS_FRAMES.side : BOSS_FRAMES.idle;
        const frame = frames[this.spriteFrame % frames.length];
        ctx.imageSmoothingEnabled = false;
        if (this.spriteState === "side" && this.facingDirection > 0) {
          ctx.translate(this.x, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(sprite, frame.x, frame.y, frame.w, frame.h, -24, this.y - 32, 48, 64);
        } else {
          ctx.drawImage(sprite, frame.x, frame.y, frame.w, frame.h, this.x - 24, this.y - 32, 48, 64);
        }
        ctx.restore();
        return;
      }

      ctx.save();
      const bodyGlow = ctx.createRadialGradient(this.x, this.y, 8, this.x, this.y, 40);
      bodyGlow.addColorStop(0, Palette.moon);
      bodyGlow.addColorStop(0.5, Palette.roseRed);
      bodyGlow.addColorStop(1, Palette.velvet);
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
      const height = 12;
      const x = (GAME_WIDTH - width) * 0.5;
      const y = 22;
      const ratio = global.HealthSystem.getRatio(this);
      const phaseRemain = Math.max(0, PHASE_TIME_LIMIT - this.phaseTimer);
      const remainText = `${Math.ceil(phaseRemain)}s`;

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
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = Palette.moon;
      ctx.font = "bold 14px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${this.phaseName}  HP`, GAME_WIDTH * 0.5, y - 4);

      ctx.fillStyle = "rgba(255,253,208,0.88)";
      ctx.font = '12px monospace';
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(`P${this.phase} ${remainText}`, x + width, y - 4);

      if (this.phase === 3 && this.phaseThreeLaserTimer > 0) {
        const laserAlpha = Math.min(1, this.phaseThreeLaserTimer / 0.25) * 0.78;
        const leftX = this.x - 148;
        const rightX = this.x + 148;
        for (const lx of [leftX, rightX]) {
          const beam = ctx.createLinearGradient(lx - 8, 0, lx + 8, 0);
          beam.addColorStop(0, `rgba(255,255,255,0)`);
          beam.addColorStop(0.35, `rgba(255,255,255,${laserAlpha * 0.75})`);
          beam.addColorStop(0.5, `rgba(255,253,208,${laserAlpha})`);
          beam.addColorStop(0.65, `rgba(255,255,255,${laserAlpha * 0.75})`);
          beam.addColorStop(1, `rgba(255,255,255,0)`);
          ctx.fillStyle = beam;
          ctx.fillRect(lx - 8, 0, 16, GAME_HEIGHT);
        }
      }
      ctx.restore();
    }
  }

  global.BossController = BossController;
})(window.XTouhouWeb);
