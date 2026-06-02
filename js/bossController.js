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

  const BulletBehavior = global.BulletBehavior;
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
  const TOTAL_ARGENTI_TIME_LIMIT = 540;
  const EXIT_DURATION = 2;

  const bossRoles = {
    midBoss1: {
      name: "Mid-Boss 1",
      phaseName: "Odd Even Way Spiral",
      baseHealth: Math.floor(BOSS_MAX_HEALTH * 0.58),
      totalTimeLimit: PHASE_TIME_LIMIT,
      phases: [
        {
          name: "01-02 Way Spiral",
          spellIds: ["WAY_SHOT", "DOUBLE_SPIRAL"],
          duration: PHASE_TIME_LIMIT,
        },
      ],
      barColors: [Palette.moon, "#00FFFF", Palette.gold, Palette.velvet],
    },
    boss1: {
      name: "Boss 1",
      phaseName: "Delay Stasis",
      baseHealth: Math.floor(BOSS_MAX_HEALTH * 0.82),
      totalTimeLimit: PHASE_TIME_LIMIT * 2,
      resetHpOnPhase: true,
      phases: [
        {
          name: "03 Delay Stasis",
          spellIds: ["DELAY_STASIS"],
          duration: PHASE_TIME_LIMIT,
        },
        {
          name: "05 Wave Ring",
          spellIds: ["WAVE_RING"],
          duration: PHASE_TIME_LIMIT,
        },
      ],
      barColors: [Palette.moon, "#00FF66", Palette.gold, Palette.velvet],
    },
    midBoss2: {
      name: "Mid-Boss 2",
      phaseName: "Reflect Satellite",
      baseHealth: Math.floor(BOSS_MAX_HEALTH * 0.64),
      totalTimeLimit: PHASE_TIME_LIMIT,
      phases: [
        {
          name: "06-08 Reflect Satellite",
          spellIds: ["REFLECT_BOUND", "ORBITAL_SATELLITE"],
          duration: PHASE_TIME_LIMIT,
        },
      ],
      barColors: [Palette.moon, "#B45CFF", "#00FF66", Palette.velvet],
    },
    argenti: {
      name: "Ultimate Boss - Argenti",
      phaseName: "Argenti Rose",
      baseHealth: Math.floor(BOSS_MAX_HEALTH * 1.65),
      totalTimeLimit: TOTAL_ARGENTI_TIME_LIMIT,
      phases: [
        {
          name: "07 Cluster Split",
          spellIds: ["CLUSTER_SPLIT"],
          duration: PHASE_TIME_LIMIT,
          threshold: 2 / 3,
        },
        {
          name: "04 Laser Grid",
          spellIds: ["LASER_GRID"],
          duration: PHASE_TIME_LIMIT,
          threshold: 1 / 3,
        },
        {
          name: "09-10 Gravity Finale",
          spellIds: ["FINALE_BRANCHES"],
          duration: PHASE_TIME_LIMIT,
          threshold: 0,
        },
      ],
      barColors: [Palette.moon, Palette.gold, Palette.roseRed, Palette.velvet],
    },
  };

  global.stageScripts = {
    1: {
      id: 1,
      title: "Shrimps Courtyard",
      subtitle: "Shrimps Courtyard",
      phases: {
        MID_BOSS: bossRoles.midBoss1,
        BOSS: bossRoles.boss1,
      },
    },
    2: {
      id: 2,
      title: "Scarlet Rose Castle",
      subtitle: "Scarlet Rose Castle",
      phases: {
        MID_BOSS: bossRoles.midBoss2,
        BOSS: bossRoles.argenti,
      },
    },
  };

  class BossController {
    constructor(emitter, bulletManager, bombEffect, assetLoader) {
      this.emitter = emitter;
      this.bulletManager = bulletManager;
      this.bombEffect = bombEffect;
      this.assetLoader = assetLoader;
      this.itemManager = null;
      this.radius = 30;
      this.entrySpeed = 140;
      this.lanePositions = [128, 236, 364, 472];
      this.difficulty = "easy";
      this.difficultyHpMultiplier = 1;
      this.reset();
    }

    setDifficulty(difficulty) {
      this.difficulty = difficulty;
      this.difficultyHpMultiplier = difficulty === "lunatic" ? 1.45 : difficulty === "hard" ? 1.18 : 1;
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
      this.wasKilled = false;
      this.escapeElapsed = 0;
      this.escapeStartY = 0;
      this.currentStage = 1;
      this.stagePhase = "BOSS";
      this.roleScript = bossRoles.boss1;
      this.phase = 1;
      this.phaseTimer = 0;
      this.totalBattleTimer = 0;
      this.phaseRewardMask = 0;
      this.phaseName = "Boss";
      this.phaseBarColors = [Palette.moon, Palette.antiqueGold, Palette.crimson, Palette.velvet];
      this.targetX = BOSS_ENTRY_X;
      this.targetY = BOSS_ENTRY_Y;
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
      this.spriteFrame = 0;
      this.spriteTimer = 0;
      this.spriteState = "idle";
      this.facingDirection = 1;
      this.prevX = this.x;
      this.timerA = 0;
      this.timerB = 0;
      this.timerC = 0;
      this.timerD = 0;
      this.spinA = 0;
      this.spinB = Math.PI;
      this.branchIndex = 0;
      this.lastFinaleBranch = -1;
      this.laserGrid = null;
      this.whiteLaser = null;
      this.lastPlayer = null;
      this.audioAnalysis = { isBeat: false, musicFlow: 0 };
      global.HealthSystem.resetEntity(this, Math.floor(BOSS_MAX_HEALTH * this.difficultyHpMultiplier));
    }

    activateEntry(script, currentStage = 1, stagePhase = "BOSS") {
      this.reset();
      this.currentStage = currentStage;
      this.stagePhase = stagePhase;
      this.roleScript = script || bossRoles.boss1;
      this.phase = 1;
      this.phaseName = this.roleScript.phases[0]?.name || this.roleScript.phaseName || this.roleScript.name;
      this.phaseBarColors = this.roleScript.barColors || this.phaseBarColors;
      this.targetX = this.pickTargetX();
      this.targetY = stagePhase === "MID_BOSS" ? 145 : BOSS_ENTRY_Y;
      this.x = this.targetX;
      this.y = -92;
      this.moveEndX = this.targetX;
      this.prevX = this.x;
      this.active = true;
      this.invulnerable = false;
      global.HealthSystem.resetEntity(this, Math.floor(this.roleScript.baseHealth * this.difficultyHpMultiplier));
    }

    pickTargetX() {
      if (this.roleScript === bossRoles.midBoss1 || this.roleScript === bossRoles.midBoss2) {
        return GAME_WIDTH * 0.5;
      }
      return BOSS_ENTRY_X;
    }

    update(deltaTime, player, audioAnalysis = { isBeat: false, musicFlow: 0 }) {
      if (!this.active || this.defeated) {
        return;
      }

      this.lastPlayer = player;
      this.audioAnalysis = audioAnalysis;

      if (!this.inBattle) {
        this.updateEntry(deltaTime);
        this.updateSpriteAnimation(deltaTime);
        return;
      }

      if (this.timedOut) {
        this.updateTimedDeparture(deltaTime);
        this.updateSpriteAnimation(deltaTime);
        return;
      }

      this.updateBattle(deltaTime, player, audioAnalysis);
      this.updateSpriteAnimation(deltaTime);
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
        this.beginPhase(1, false);
        return;
      }

      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;
    }

    updateBattle(deltaTime, player, audioAnalysis) {
      this.totalBattleTimer += deltaTime;
      this.phaseTimer += deltaTime;

      if (this.roleScript === bossRoles.argenti && this.totalBattleTimer >= TOTAL_ARGENTI_TIME_LIMIT) {
        this.beginTimedDeparture();
        return;
      }

      const phaseScript = this.getPhaseScript();
      if (phaseScript && this.phaseTimer >= phaseScript.duration) {
        this.forceNextPhaseOrDeparture();
        return;
      }

      this.moveClock += deltaTime;
      this.updateMovementState(deltaTime);
      this.updateLaserHazards(deltaTime, player);

      const spells = phaseScript?.spellIds || [];
      for (let i = 0; i < spells.length; i += 1) {
        this.fireSpell(spells[i], deltaTime, player, audioAnalysis);
      }

      if (audioAnalysis.isBeat && this.difficulty === "lunatic" && this.stagePhase === "BOSS") {
        this.fireAimedSingle(player, 174, "BARRIER_GOLD", 9);
      }
    }

    getPhaseScript() {
      return this.roleScript.phases[Math.max(0, this.phase - 1)] || this.roleScript.phases[0];
    }

    fireSpell(spellId, deltaTime, player, audioAnalysis) {
      if (spellId === "WAY_SHOT") {
        this.updateWayShot(deltaTime, player);
      } else if (spellId === "DOUBLE_SPIRAL") {
        this.updateDoubleSpiral(deltaTime, audioAnalysis);
      } else if (spellId === "DELAY_STASIS") {
        this.updateDelayStasis(deltaTime);
      } else if (spellId === "WAVE_RING") {
        this.updateWaveRing(deltaTime);
      } else if (spellId === "REFLECT_BOUND") {
        this.updateReflectBound(deltaTime);
      } else if (spellId === "ORBITAL_SATELLITE") {
        this.updateOrbitalSatellite(deltaTime);
      } else if (spellId === "CLUSTER_SPLIT") {
        this.updateClusterSplit(deltaTime);
      } else if (spellId === "LASER_GRID") {
        this.updateLaserGrid(deltaTime);
      } else if (spellId === "FINALE_BRANCHES") {
        this.updateFinaleBranches(deltaTime, player);
      }
    }

    updateWayShot(deltaTime, player) {
      this.timerA -= deltaTime;
      if (this.timerA > 0) {
        return;
      }

      const hard = this.isHard();
      const lunatic = this.isLunatic();
      this.timerA += lunatic ? 0.42 : hard ? 0.54 : 0.68;
      const aim = this.emitter.getAngleToTarget(this.x, this.y, player.x, player.y);
      const parity = Math.floor(this.phaseTimer * 2.2) % 2;
      const ways = parity === 0 ? (lunatic ? 8 : hard ? 6 : 4) : (lunatic ? 9 : hard ? 7 : 5);
      const spread = parity === 0 ? (lunatic ? 82 : 66) : (lunatic ? 72 : 58);
      const center = parity === 0 ? aim + spread / Math.max(1, ways - 1) * 0.5 : aim;
      this.emitter.fireNWay(this.x, this.y + 10, ways, spread, lunatic ? 194 : hard ? 174 : 154, center, 8, "MEDIUM_RED");
    }

    updateDoubleSpiral(deltaTime, audioAnalysis) {
      this.timerB += deltaTime;
      const hard = this.isHard();
      const lunatic = this.isLunatic();
      const flow = Math.max(0.25, audioAnalysis.musicFlow || 0.4);
      const step = (lunatic ? 0.038 : hard ? 0.048 : 0.058) * (1.08 - flow * 0.14);

      while (this.timerB >= step) {
        this.timerB -= step;
        this.spinA += lunatic ? 13.5 : hard ? 12 : 10.5;
        this.spinB -= lunatic ? 15.0 : hard ? 13.2 : 11.6;
        this.fireAngled(this.spinA, lunatic ? 170 : 154, 10, "BARRIER_CYAN");
        this.fireAngled(this.spinB + 16, lunatic ? 166 : 150, 10, "BARRIER_GOLD");
      }
    }

    updateDelayStasis(deltaTime) {
      this.timerA -= deltaTime;
      if (this.timerA > 0) {
        return;
      }

      const hard = this.isHard();
      const lunatic = this.isLunatic();
      this.timerA += lunatic ? 0.82 : hard ? 1.02 : 1.18;
      const count = lunatic ? 22 : hard ? 18 : 14;
      const speed = lunatic ? 168 : hard ? 150 : 134;
      const startAngle = this.phaseTimer * (lunatic ? 41 : 31);

      for (let i = 0; i < count; i += 1) {
        const angle = startAngle + (360 / count) * i;
        const velocity = this.emitter.angleToVelocity(angle, speed);
        this.bulletManager.spawnBullet(
          this.x,
          this.y + 4,
          velocity.vx,
          velocity.vy,
          7,
          "MEDIUM_GREEN",
          1,
          {
            type: BulletBehavior.DELAY_STASIS,
            param0: 0.55,
            param1: 1,
            param2: lunatic ? 284 : hard ? 258 : 232,
          }
        );
      }
    }

    updateWaveRing(deltaTime) {
      this.timerB -= deltaTime;
      if (this.timerB > 0) {
        return;
      }

      const hard = this.isHard();
      const lunatic = this.isLunatic();
      this.timerB += lunatic ? 0.36 : hard ? 0.48 : 0.62;
      const ringCount = lunatic ? 38 : hard ? 32 : 26;
      const start = this.phaseTimer * (lunatic ? 74 : 55) + Math.sin(this.phaseTimer * 2.4) * 18;
      const radiusWave = 5 + Math.sin(this.phaseTimer * 3.1) * 2;

      for (let i = 0; i < ringCount; i += 1) {
        const angle = start + (360 / ringCount) * i + Math.sin(i * 0.74 + this.phaseTimer * 2.1) * 4;
        const speed = (lunatic ? 124 : hard ? 112 : 98) + Math.sin(i * 0.52 + this.phaseTimer * 2) * 18;
        const velocity = this.emitter.angleToVelocity(angle, speed);
        this.bulletManager.spawnBullet(this.x, this.y, velocity.vx, velocity.vy, radiusWave, "MEDIUM_GREEN");
      }
    }

    updateReflectBound(deltaTime) {
      this.timerA -= deltaTime;
      if (this.timerA > 0) {
        return;
      }

      const hard = this.isHard();
      const lunatic = this.isLunatic();
      this.timerA += lunatic ? 0.12 : hard ? 0.16 : 0.21;
      const lanes = lunatic ? 4 : hard ? 3 : 2;
      const base = 58 + Math.sin(this.phaseTimer * 3.8) * 18;

      for (let i = 0; i < lanes; i += 1) {
        const offset = (i - (lanes - 1) * 0.5) * 16;
        const angle = base + offset + (i % 2 === 0 ? 0 : 12);
        const velocity = this.emitter.angleToVelocity(angle, lunatic ? 244 : hard ? 220 : 192);
        this.bulletManager.spawnBullet(
          this.x + offset,
          this.y + 18,
          velocity.vx,
          velocity.vy,
          4.5,
          "RICE_PURPLE",
          1,
          {
            type: BulletBehavior.REFLECT_BOUND,
          }
        );
      }
    }

    updateOrbitalSatellite(deltaTime) {
      this.timerB -= deltaTime;
      if (this.timerB > 0) {
        return;
      }

      this.timerB += this.isLunatic() ? 3.7 : this.isHard() ? 4.4 : 5.2;
      const count = this.isLunatic() ? 18 : this.isHard() ? 15 : 12;
      const baseRadius = 42;
      const maxRadius = Math.hypot(GAME_WIDTH, GAME_HEIGHT) * 0.72;
      const expandRate = this.isLunatic() ? 122 : this.isHard() ? 98 : 78;

      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count;
        this.bulletManager.spawnBullet(
          this.x + Math.cos(angle) * baseRadius,
          this.y + Math.sin(angle) * baseRadius,
          0,
          0,
          8,
          i % 2 === 0 ? "MEDIUM_GREEN" : "MEDIUM_RED",
          1,
          {
            type: BulletBehavior.ORBITAL_SATELLITE,
            param0: baseRadius,
            param1: maxRadius,
            param2: expandRate,
            originX: this.x,
            originY: this.y,
            angleOffset: angle,
            spinSpeed: this.isLunatic() ? 3.6 : 2.8,
          }
        );
      }
    }

    updateClusterSplit(deltaTime) {
      this.timerA -= deltaTime;
      if (this.timerA > 0) {
        return;
      }

      this.timerA += this.isLunatic() ? 0.72 : this.isHard() ? 0.92 : 1.16;
      const spreads = this.isLunatic() ? [-42, 0, 42] : this.isHard() ? [-28, 28] : [0];
      for (let i = 0; i < spreads.length; i += 1) {
        const velocity = this.emitter.angleToVelocity(90 + spreads[i] * 0.28, 58 + i * 8);
        this.bulletManager.spawnBullet(
          this.x + spreads[i],
          this.y + 12,
          velocity.vx,
          velocity.vy,
          20,
          "ROSE_MOTHER",
          1,
          {
            type: BulletBehavior.SPLIT_BURST,
            param0: 1.03,
            param1: 16,
            param2: this.isLunatic() ? 188 : 164,
          }
        );
      }
    }

    updateLaserGrid(deltaTime) {
      this.timerA -= deltaTime;
      if (this.timerA > 0) {
        return;
      }

      this.timerA += this.isLunatic() ? 3.2 : this.isHard() ? 3.8 : 4.5;
      this.laserGrid = {
        timer: 3.2,
        warn: 1.2,
        fire: 2,
        baseX: this.x,
        sweep: Math.random() < 0.5 ? -1 : 1,
        offsets: [-126, -44, 44, 126],
      };
    }

    updateFinaleBranches(deltaTime, player) {
      this.timerA -= deltaTime;
      if (this.timerA > 0) {
        return;
      }

      const lunatic = this.isLunatic();
      this.timerA += lunatic ? 0.78 : this.isHard() ? 0.98 : 1.2;
      const branch = this.chooseFinaleBranch();

      if (branch === 0) {
        this.fireAuroraBubbleBranch(player);
      } else if (branch === 1) {
        this.fireGravityBranch();
      } else {
        this.fireWhiteLaserBranch(player);
      }
    }

    chooseFinaleBranch() {
      const roll = Math.random();
      let next = roll < 0.38 ? 0 : roll < 0.72 ? 1 : 2;
      if (next === this.lastFinaleBranch) {
        next = (next + 1 + Math.floor(Math.random() * 2)) % 3;
      }
      this.lastFinaleBranch = next;
      this.branchIndex += 1;
      return next;
    }

    fireAuroraBubbleBranch(player) {
      const baseCount = this.isLunatic() ? 7 : this.isHard() ? 6 : 5;
      const keepRatio = this.bulletManager.getAuroraBubbleKeepRatio();
      const count = Math.max(2, Math.ceil(baseCount * keepRatio));
      const aim = this.emitter.getAngleToTarget(this.x, this.y, player.x, player.y);
      const spread = 96;

      for (let i = 0; i < count; i += 1) {
        const t = count <= 1 ? 0.5 : i / (count - 1);
        const angle = aim - spread * 0.5 + spread * t;
        const velocity = this.emitter.angleToVelocity(angle, 48 + i * 4);
        this.bulletManager.spawnBullet(
          this.x,
          this.y + 10,
          velocity.vx,
          velocity.vy + 26,
          17,
          "AURORA_BUBBLE",
          1,
          {
            type: BulletBehavior.BUBBLE_SINE,
            param0: 26,
            param1: 3.2 + Math.random() * 1.4,
            param2: 18,
            param3: Math.random() * Math.PI * 2,
          }
        );
      }
    }

    fireGravityBranch() {
      this.bulletManager.activateGravityWell(this.x, this.y + 42, this.isLunatic() ? 620 : 500, 250, 3.8);
      this.bombEffect.start(this.x, this.y + 42, "Gravity Distortion", {
        clearsBullets: false,
        overlayAlpha: 0.14,
        ringColor: "180, 92, 255",
        shadowColor: "rgba(120,40,255,0.52)",
        textColor: "rgba(255,253,208,0.96)",
      });

      const ringCount = this.isLunatic() ? 28 : this.isHard() ? 22 : 18;
      const start = this.phaseTimer * 66;
      for (let i = 0; i < ringCount; i += 1) {
        const angle = start + (360 / ringCount) * i;
        const velocity = this.emitter.angleToVelocity(angle, this.isLunatic() ? 142 : 122);
        this.bulletManager.spawnBullet(this.x, this.y + 20, velocity.vx, velocity.vy, 7, "YINYANG_PETAL", 1, {
          angleOffset: Math.random() * Math.PI * 2,
          spinSpeed: 1.6,
        });
      }
    }

    fireWhiteLaserBranch(player) {
      this.whiteLaser = {
        timer: 2.35,
        warn: 0.55,
        fire: 1.8,
        wall: player.x < this.x ? -1 : 1,
        offset: 138,
      };
    }

    fireAimedSingle(player, speed, color, radius) {
      const angle = this.emitter.getAngleToTarget(this.x, this.y, player.x, player.y);
      const velocity = this.emitter.angleToVelocity(angle, speed);
      this.bulletManager.spawnBullet(this.x, this.y, velocity.vx, velocity.vy, radius, color);
    }

    fireAngled(angle, speed, radius, color) {
      const velocity = this.emitter.angleToVelocity(angle, speed);
      this.bulletManager.spawnBullet(this.x, this.y, velocity.vx, velocity.vy, radius, color);
    }

    updateLaserHazards(deltaTime, player) {
      if (this.laserGrid) {
        this.laserGrid.timer -= deltaTime;
        if (this.laserGrid.timer <= 0) {
          this.laserGrid = null;
        } else if (this.laserGrid.timer <= this.laserGrid.fire) {
          this.checkLaserGridHit(player);
        }
      }

      if (this.whiteLaser) {
        this.whiteLaser.timer -= deltaTime;
        if (this.whiteLaser.timer <= 0) {
          this.whiteLaser = null;
        } else if (this.whiteLaser.timer <= this.whiteLaser.fire) {
          this.checkWhiteLaserHit(player);
        }
      }
    }

    checkLaserGridHit(player) {
      if (!player || player.isDying) {
        return;
      }

      const sweep = Math.sin((this.laserGrid.fire - this.laserGrid.timer) * 1.6) * 34 * this.laserGrid.sweep;
      for (let i = 0; i < this.laserGrid.offsets.length; i += 1) {
        const x = this.laserGrid.baseX + this.laserGrid.offsets[i] + sweep;
        if (Math.abs(player.x - x) < player.deathRadius + 11) {
          player.takeDamage();
          return;
        }
      }
    }

    checkWhiteLaserHit(player) {
      if (!player || player.isDying) {
        return;
      }

      const wallShift = Math.sin((this.whiteLaser.fire - this.whiteLaser.timer) * 1.8) * 32 * this.whiteLaser.wall;
      const lanes = [this.x - this.whiteLaser.offset + wallShift, this.x + this.whiteLaser.offset + wallShift];
      for (let i = 0; i < lanes.length; i += 1) {
        if (Math.abs(player.x - lanes[i]) < player.deathRadius + 7) {
          player.takeDamage();
          return;
        }
      }
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
      if (this.roleScript === bossRoles.midBoss1) {
        this.moveState = "stopped";
        this.x = this.targetX;
        this.y = this.targetY + Math.sin(this.moveClock * 1.5) * 5;
        return;
      }

      if (this.moveState === "moving") {
        this.moveElapsed += deltaTime;
        const progress = Math.min(1, this.moveElapsed / this.moveDuration);
        const eased = 0.5 - Math.cos(Math.PI * progress) * 0.5;
        this.x = this.moveStartX + (this.moveEndX - this.moveStartX) * eased;
        this.y = this.targetY + Math.sin(this.moveClock * 1.25) * 9;

        if (progress >= 1) {
          this.moveState = "stopped";
          this.stopTimer = this.pauseDuration;
          this.x = this.moveEndX;
        }
        return;
      }

      this.stopTimer -= deltaTime;
      this.x = this.moveEndX;
      this.y = this.targetY + Math.sin(this.moveClock * 1.35) * 6;

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
      if (this.roleScript === bossRoles.midBoss1) {
        return this.targetX;
      }

      const candidates = this.lanePositions.filter((position) => Math.abs(position - this.x) > 34);
      return candidates[Math.floor(Math.random() * candidates.length)] ?? this.targetX;
    }

    updateSpriteAnimation(deltaTime) {
      this.updateSpriteState();
      this.spriteTimer += deltaTime;
      if (this.spriteTimer >= 0.14) {
        this.spriteTimer = 0;
        const activeFrames = this.spriteState === "side" ? BOSS_FRAMES.side : BOSS_FRAMES.idle;
        this.spriteFrame = (this.spriteFrame + 1) % activeFrames.length;
      }
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

    beginPhase(phase, playFx = true) {
      this.phase = phase;
      this.phaseTimer = 0;
      this.phaseRewardMask = 0;
      this.invulnerable = false;
      this.phaseName = this.getPhaseScript()?.name || this.roleScript.phaseName;
      if (this.roleScript.resetHpOnPhase && phase > 1) {
        global.HealthSystem.resetEntity(this, Math.floor(this.roleScript.baseHealth * this.difficultyHpMultiplier));
      }
      this.timerA = 0.2;
      this.timerB = 0.15;
      this.timerC = 0.3;
      this.timerD = 0.45;
      this.spinA = this.phaseTimer * 47;
      this.spinB = this.phaseTimer * -53 + 180;
      this.branchIndex = 0;
      this.lastFinaleBranch = -1;
      this.laserGrid = null;
      this.whiteLaser = null;
      this.bulletManager.clearGravityWell();
      this.bulletManager.clearEnemyBullets();

      if (playFx) {
        this.bombEffect.start(this.x, this.y, this.phaseName, {
          clearsBullets: false,
          overlayAlpha: 0.24,
          ringColor: phase === 2 ? "255, 215, 0" : "255, 253, 208",
          shadowColor: phase === 2 ? "rgba(212, 31, 60, 0.50)" : "rgba(212, 175, 55, 0.50)",
          textColor: "rgba(255,253,208,0.98)",
        });
      }

      this.moveState = "stopped";
      this.stopTimer = 1.0;
    }

    updatePhaseByHealth() {
      if (this.roleScript !== bossRoles.argenti) {
        return;
      }

      const ratio = global.HealthSystem.getRatio(this);
      if (this.phase === 1 && ratio <= BOSS_PHASE_TWO_THRESHOLD) {
        this.beginPhase(2);
      } else if (this.phase === 2 && ratio <= BOSS_PHASE_THREE_THRESHOLD) {
        this.beginPhase(3);
      }
    }

    forceNextPhaseOrDeparture() {
      this.bulletManager.clearEnemyBullets();
      this.bulletManager.clearGravityWell();

      if (this.roleScript === bossRoles.argenti) {
        if (this.phase < 3) {
          this.beginPhase(this.phase + 1);
        } else {
          this.beginTimedDeparture();
        }
        return;
      }

      if (this.phase < this.roleScript.phases.length) {
        this.beginPhase(this.phase + 1);
      } else {
        this.completeTimedEncounter();
      }
    }

    completeTimedEncounter() {
      this.defeated = true;
      this.active = false;
      this.inBattle = false;
      this.invulnerable = true;
      this.timedOut = false;
      this.wasKilled = false;
      this.bulletManager.clearGravityWell();
      this.bulletManager.clearEnemyBullets();
    }

    beginTimedDeparture() {
      if (this.timedOut) {
        return;
      }

      this.timedOut = true;
      this.invulnerable = true;
      this.escapeElapsed = 0;
      this.escapeStartY = this.y;
      this.bulletManager.clearGravityWell();
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
      const thresholds = this.roleScript === bossRoles.argenti
        ? [2 / 3, 1 / 3]
        : [2 / 3, 1 / 3];

      for (let i = 0; i < thresholds.length; i += 1) {
        const threshold = thresholds[i];
        const bit = 1 << i;
        if ((this.phaseRewardMask & bit) !== 0) {
          continue;
        }
        if (previousRatio > threshold && nextRatio <= threshold) {
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
        this.itemManager.spawnItem(1, this.x, this.y, Math.cos(angle) * speed, Math.sin(angle) * speed - 82);
      }

      if (Math.random() < 0.1) {
        this.itemManager.spawnItem(2, this.x, this.y, (Math.random() - 0.5) * 36, -166);
      }
    }

    spawnFinalVictoryReward() {
      if (!this.itemManager) {
        return;
      }

      const count = this.roleScript === bossRoles.argenti ? 40 : 26;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.22;
        const speed = 92 + Math.random() * 128;
        this.itemManager.spawnItem(1, this.x, this.y, Math.cos(angle) * speed, Math.sin(angle) * speed - 104);
      }

      if (this.roleScript === bossRoles.argenti) {
        this.itemManager.spawnItem(2, this.x - 14, this.y - 4, -28, -188);
        this.itemManager.spawnItem(2, this.x + 14, this.y - 4, 28, -188);
      } else if (Math.random() < 0.35) {
        this.itemManager.spawnItem(2, this.x, this.y - 4, 0, -176);
      }
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
        if (this.roleScript.resetHpOnPhase && this.phase < this.roleScript.phases.length) {
          this.spawnPhasePressureReward();
          this.beginPhase(this.phase + 1);
          player.addScore(2500);
          return true;
        }

        this.defeated = true;
        this.wasKilled = true;
        this.active = false;
        this.inBattle = false;
        this.bulletManager.clearGravityWell();
        this.spawnFinalVictoryReward();
        player.addScore(this.roleScript === bossRoles.argenti ? 12000 : 5000);
      } else {
        this.rewardPhaseThresholdCrossings(previousRatio, global.HealthSystem.getRatio(this));
        this.updatePhaseByHealth();
      }

      return true;
    }

    isHard() {
      return this.difficulty === "hard" || this.difficulty === "lunatic";
    }

    isLunatic() {
      return this.difficulty === "lunatic";
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

    renderLaserHazards(ctx) {
      if (this.laserGrid) {
        const warning = this.laserGrid.timer > this.laserGrid.fire;
        const progress = warning
          ? 1 - (this.laserGrid.timer - this.laserGrid.fire) / this.laserGrid.warn
          : 1 - this.laserGrid.timer / this.laserGrid.fire;
        const sweep = warning ? 0 : Math.sin(progress * Math.PI * 2) * 34 * this.laserGrid.sweep;
        for (let i = 0; i < this.laserGrid.offsets.length; i += 1) {
          const x = this.laserGrid.baseX + this.laserGrid.offsets[i] + sweep;
          this.drawVerticalLaser(
            ctx,
            x,
            warning ? 3 : 22,
            warning ? `rgba(255,215,0,${0.28 + progress * 0.44})` : "rgba(255,215,0,0.88)",
            warning ? 8 : 28,
            warning ? "rgba(255,215,0,0.36)" : "rgba(255,245,160,0.72)"
          );
        }
      }

      if (this.whiteLaser) {
        const warning = this.whiteLaser.timer > this.whiteLaser.fire;
        const progress = warning
          ? 1 - (this.whiteLaser.timer - this.whiteLaser.fire) / this.whiteLaser.warn
          : 1 - this.whiteLaser.timer / this.whiteLaser.fire;
        const wallShift = warning ? 0 : Math.sin(progress * Math.PI * 1.4) * 32 * this.whiteLaser.wall;
        const lanes = [this.x - this.whiteLaser.offset + wallShift, this.x + this.whiteLaser.offset + wallShift];
        for (let i = 0; i < lanes.length; i += 1) {
          this.drawVerticalLaser(
            ctx,
            lanes[i],
            warning ? 2 : 13,
            warning ? `rgba(255,255,255,${0.26 + progress * 0.46})` : "rgba(255,255,255,0.94)",
            warning ? 7 : 20,
            "rgba(255,255,255,0.72)"
          );
        }
      }
    }

    drawVerticalLaser(ctx, x, width, color, blur, shadowColor) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = blur;
      const beam = ctx.createLinearGradient(x - width, 0, x + width, 0);
      beam.addColorStop(0, "rgba(255,255,255,0)");
      beam.addColorStop(0.35, color);
      beam.addColorStop(0.5, "rgba(255,255,255,0.96)");
      beam.addColorStop(0.65, color);
      beam.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = beam;
      ctx.fillRect(x - width, 0, width * 2, GAME_HEIGHT);
      ctx.restore();
    }

    renderHpBar(ctx) {
      if (!this.active || this.defeated) {
        return;
      }

      this.renderLaserHazards(ctx);

      const width = this.roleScript === bossRoles.argenti ? 410 : 340;
      const height = 12;
      const x = (GAME_WIDTH - width) * 0.5;
      const y = 22;
      const ratio = global.HealthSystem.getRatio(this);
      const phaseScript = this.getPhaseScript();
      const phaseRemain = Math.max(0, (phaseScript?.duration || PHASE_TIME_LIMIT) - this.phaseTimer);
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
      ctx.lineWidth = this.roleScript === bossRoles.argenti ? 1 : 1.5;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = Palette.moon;
      ctx.font = "bold 13px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${this.roleScript.name}  ${this.phaseName}`, GAME_WIDTH * 0.5, y - 4);

      ctx.fillStyle = "rgba(255,253,208,0.88)";
      ctx.font = this.roleScript === bossRoles.argenti ? "10px monospace" : "12px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(`P${this.phase} ${remainText}`, GAME_WIDTH - 18, 16);

      if (this.roleScript === bossRoles.argenti) {
        const totalRemain = Math.max(0, TOTAL_ARGENTI_TIME_LIMIT - this.totalBattleTimer);
        ctx.textAlign = "left";
        ctx.fillText(`Total ${Math.ceil(totalRemain)}s`, 18, 16);
      }
      ctx.restore();
    }
  }

  global.BossController = BossController;
})(window.XTouhouWeb);
