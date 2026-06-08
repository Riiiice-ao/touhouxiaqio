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

  const BossAnimationState = {
    IDLE: "BOSS_IDLE",
    ATTACK: "BOSS_ATTACK",
    MOVE: "BOSS_MOVE",
  };

  const BOSS_SPRITE_CONFIGS = {
    1: {
      bossKey: "bossStage1",
      renderHeight: 64,
      states: {
        idle: { x: 1260, y: 310, w: 1010, h: 330, rows: 1, cols: 4 },
        side: { x: 1260, y: 704, w: 1010, h: 344, rows: 1, cols: 4 },
      },
    },
    2: {
      bossKey: "bossStage2",
      renderHeight: 64,
      states: {
        idle: { x: 1260, y: 310, w: 1010, h: 330, rows: 1, cols: 4 },
        side: { x: 1260, y: 704, w: 1010, h: 344, rows: 1, cols: 4 },
      },
    },
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
      totalTimeLimit: PHASE_TIME_LIMIT * 2 + 96,
      phases: [
        {
          name: "03 Delay Stasis",
          spellIds: ["DELAY_STASIS"],
          duration: PHASE_TIME_LIMIT,
          threshold: 2 / 3,
        },
        {
          name: "05 Wave Ring",
          spellIds: ["WAVE_RING"],
          duration: PHASE_TIME_LIMIT,
          threshold: 1 / 3,
        },
        {
          name: "Final - Echoing Boundary",
          spellIds: ["FINAL_SURVIVAL"],
          duration: 96,
          threshold: 0,
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
          spellIds: ["CLUSTER_SPLIT", "TIME_STOP_BLOOM"],
          duration: PHASE_TIME_LIMIT,
          threshold: 2 / 3,
        },
        {
          name: "04 Laser Grid",
          spellIds: ["LASER_GRID", "SINE_PETAL_DRIFT"],
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
      this.enemyManager = null;
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

    setEnemyManager(enemyManager) {
      this.enemyManager = enemyManager;
    }

    configureSpriteGrid(stage) {
      const spriteConfig = BOSS_SPRITE_CONFIGS[stage] || BOSS_SPRITE_CONFIGS[1];
      this.bossSpriteKey = spriteConfig.bossKey;
      this.bossSpriteConfig = spriteConfig;
      this.bossRenderHeight = spriteConfig.renderHeight;
      const idleState = spriteConfig.states.idle;
      this.rows = idleState.rows;
      this.cols = idleState.cols;
      this.spriteFrame = 0;
      this.frameCropCache = {};
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
      this.animationState = BossAnimationState.IDLE;
      this.bossSpriteKey = "bossStage1";
      this.bossSpriteConfig = BOSS_SPRITE_CONFIGS[1];
      this.bossRenderHeight = this.bossSpriteConfig.renderHeight;
      this.rows = this.bossSpriteConfig.states.idle.rows;
      this.cols = this.bossSpriteConfig.states.idle.cols;
      this.frameCropCache = {};
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
      this.timeStopOverlayTimer = 0;
      this.timeStopOverlayDuration = 0;
      this.dashTimer = 2.0;
      this.dashWarnTimer = 0;
      this.dashActive = false;
      this.dashElapsed = 0;
      this.dashDuration = 0.78;
      this.dashIndex = 0;
      this.dashStartX = BOSS_ENTRY_X;
      this.dashStartY = BOSS_ENTRY_Y;
      this.dashEndX = BOSS_ENTRY_X;
      this.dashEndY = BOSS_ENTRY_Y;
      this.dashTrail = [];
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
      this.configureSpriteGrid(currentStage);
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

    activatePractice(script, currentStage = 1, phase = 1) {
      this.activateEntry(script, currentStage, "BOSS");
      const maxPhase = Math.max(1, this.roleScript.phases.length);
      const targetPhase = Math.max(1, Math.min(maxPhase, Math.floor(phase) || 1));

      this.x = this.pickTargetX();
      this.y = BOSS_ENTRY_Y;
      this.targetX = this.x;
      this.targetY = BOSS_ENTRY_Y;
      this.moveEndX = this.x;
      this.moveStartX = this.x;
      this.prevX = this.x;
      this.active = true;
      this.inBattle = true;
      this.defeated = false;
      this.timedOut = false;
      this.wasKilled = false;
      this.invulnerable = false;
      this.beginPhase(targetPhase, false);
      this.totalBattleTimer = this.getPracticeElapsedBeforePhase(targetPhase);

      const startRatio = this.getPracticeHealthRatio(targetPhase);
      this.health = Math.max(1, Math.ceil(this.maxHealth * startRatio));
      this.phaseRewardMask = targetPhase > 1 ? (1 << (targetPhase - 1)) - 1 : 0;
      this.bulletManager.clearEnemyBullets();
      this.bulletManager.clearGravityWell();
    }

    getPracticeElapsedBeforePhase(phase) {
      let elapsed = 0;
      for (let i = 0; i < phase - 1; i += 1) {
        elapsed += this.roleScript.phases[i]?.duration || PHASE_TIME_LIMIT;
      }
      return elapsed;
    }

    getPracticeHealthRatio(phase) {
      if (phase <= 1) {
        return 1;
      }

      const previousPhase = this.roleScript.phases[phase - 2];
      return Math.max(0.02, previousPhase?.threshold ?? 1);
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
      this.timeStopOverlayTimer = Math.max(0, this.timeStopOverlayTimer - deltaTime);

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
      this.updateBossAnimationState();

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
      } else if (spellId === "SINE_PETAL_DRIFT") {
        this.updateSinePetalDrift(deltaTime);
      } else if (spellId === "FINALE_BRANCHES") {
        this.updateFinaleBranches(deltaTime, player);
      } else if (spellId === "FINAL_SURVIVAL") {
        this.updateFinalSurvival(deltaTime, player);
      } else if (spellId === "TIME_STOP_BLOOM") {
        this.updateTimeStopBloom(deltaTime);
      }
    }

    updateWayShot(deltaTime, player) {
      this.timerA -= deltaTime;
      if (this.timerA > 0) {
        return;
      }

      const hard = this.isHard();
      const lunatic = this.isLunatic();
      this.timerA += lunatic ? 0.39 : hard ? 0.5 : 0.63;
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
      const step = (lunatic ? 0.035 : hard ? 0.044 : 0.054) * (1.08 - flow * 0.14);

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
      this.timerC -= deltaTime;
      if (this.timerA > 0) {
        this.updateDelaySunflowerRings();
        return;
      }

      const hard = this.isHard();
      const lunatic = this.isLunatic();
      this.timerA += lunatic ? 0.76 : hard ? 0.95 : 1.1;
      const count = lunatic ? 24 : hard ? 20 : 15;
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

      this.updateDelaySunflowerRings();
    }

    updateDelaySunflowerRings() {
      if (this.roleScript !== bossRoles.boss1 || this.phase !== 1 || this.timerC > 0) {
        return;
      }

      this.timerC += this.isLunatic() ? 3.95 : this.isHard() ? 4.65 : 5.35;
      const baseCount = this.isLunatic() ? 20 : this.isHard() ? 17 : 15;
      const start = this.phaseTimer * 18;
      for (let wave = 0; wave < 2; wave += 1) {
        const count = baseCount + wave * 4;
        const speed = 34 + wave * 18;
        const offset = start + wave * 360 / Math.max(1, count * 2);
        for (let i = 0; i < count; i += 1) {
          const angle = offset + (360 / count) * i;
          const velocity = this.emitter.angleToVelocity(angle, speed);
          this.bulletManager.spawnBullet(this.x, this.y + 8, velocity.vx, velocity.vy, 7, "GOLD_ORB");
        }
      }
    }

    updateWaveRing(deltaTime) {
      this.timerB -= deltaTime;
      if (this.timerB > 0) {
        return;
      }

      const hard = this.isHard();
      const lunatic = this.isLunatic();
      this.timerB += lunatic ? 0.34 : hard ? 0.45 : 0.58;
      const ringCount = lunatic ? 40 : hard ? 34 : 28;
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
      this.timerA += lunatic ? 0.18 : hard ? 0.24 : 0.31;
      const lanes = lunatic ? 3 : hard ? 2 : 1;
      const base = 58 + Math.sin(this.phaseTimer * 3.8) * 18;

      for (let i = 0; i < lanes; i += 1) {
        const offset = (i - (lanes - 1) * 0.5) * 16;
        const angle = base + offset + (i % 2 === 0 ? 0 : 12);
        const velocity = this.emitter.angleToVelocity(angle, lunatic ? 134 : hard ? 120 : 105);
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
      this.timerD -= deltaTime;
      if (this.timerB > 0) {
        this.updateSatelliteLeafAimed();
        return;
      }

      this.timerB += this.isLunatic() ? 3.45 : this.isHard() ? 4.1 : 4.85;
      const count = this.isLunatic() ? 19 : this.isHard() ? 16 : 13;
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

      this.updateSatelliteLeafAimed();
    }

    updateSatelliteLeafAimed() {
      if (this.roleScript !== bossRoles.midBoss2 || !this.lastPlayer || this.timerD > 0) {
        return;
      }

      this.timerD += this.isLunatic() ? 0.96 : this.isHard() ? 1.16 : 1.42;
      const aim = this.emitter.getAngleToTarget(this.x, this.y, this.lastPlayer.x, this.lastPlayer.y);
      const leafWays = this.isLunatic() ? 4 : 3;
      this.emitter.fireNWay(
        this.x,
        this.y + 12,
        leafWays,
        this.isLunatic() ? 24 : 18,
        this.isLunatic() ? 238 : this.isHard() ? 214 : 188,
        aim,
        5,
        "LEAF_VERDANT"
      );
    }

    updateClusterSplit(deltaTime) {
      this.timerA -= deltaTime;
      if (this.timerA > 0) {
        return;
      }

      this.timerA += this.isLunatic() ? 0.66 : this.isHard() ? 0.84 : 1.06;
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
            param1: 18,
            param2: this.isLunatic() ? 188 : 164,
          }
        );
      }
    }

    updateTimeStopBloom(deltaTime) {
      this.timerB -= deltaTime;
      if (this.timerB > 0) {
        return;
      }

      const hold = this.isLunatic() ? 2.25 : this.isHard() ? 2.05 : 1.8;
      this.timerB += this.isLunatic() ? 5.2 : this.isHard() ? 6.0 : 7.0;
      this.triggerTimeStopOverlay(hold);

      const rings = this.isLunatic() ? 4 : this.isHard() ? 3 : 2;
      const count = this.isLunatic() ? 14 : this.isHard() ? 12 : 10;
      const base = this.phaseTimer * 0.9;
      for (let ring = 0; ring < rings; ring += 1) {
        const radius = 58 + ring * 42;
        const twist = base + ring * 0.72;
        for (let i = 0; i < count; i += 1) {
          const t = i / count;
          const angle = twist + Math.PI * 2 * t + Math.sin(t * Math.PI * 4 + this.phaseTimer) * 0.12;
          const x = this.x + Math.cos(angle) * radius;
          const y = this.y + 28 + Math.sin(angle) * radius * 0.7;
          const releaseSpeed = (this.isLunatic() ? 188 : this.isHard() ? 164 : 142) + ring * 8;
          this.bulletManager.spawnBullet(
            x,
            y,
            0,
            0,
            6,
            (i + ring) % 2 === 0 ? "ROSE_GILDED" : "PETAL_WHITE",
            1,
            {
              type: BulletBehavior.DELAYED_RANDOM,
              param0: 0.01,
              param1: hold,
              param2: releaseSpeed,
              param3: 0,
              angleOffset: angle,
              spinSpeed: 0.9,
            }
          );
        }
      }
    }

    triggerTimeStopOverlay(duration) {
      this.timeStopOverlayDuration = duration;
      this.timeStopOverlayTimer = Math.max(this.timeStopOverlayTimer, duration);
    }

    updateLaserGrid(deltaTime) {
      this.timerA -= deltaTime;
      if (this.timerA > 0) {
        return;
      }

      this.timerA += this.isLunatic() ? 3.45 : this.isHard() ? 4.05 : 4.7;
      this.laserGrid = {
        timer: 3.75,
        warn: 1.3,
        fire: 2.45,
        baseX: this.x,
        sweep: Math.random() < 0.5 ? -1 : 1,
        offsets: [-162, -54, 54, 162],
      };
    }

    updateSinePetalDrift(deltaTime) {
      this.timerD -= deltaTime;
      if (this.timerD > 0) {
        return;
      }

      this.timerD += this.isLunatic() ? 1.14 : this.isHard() ? 1.42 : 1.72;
      const lanes = this.isLunatic() ? 9 : this.isHard() ? 8 : 6;
      const left = this.x - 150;
      const span = 300;
      for (let i = 0; i < lanes; i += 1) {
        const t = lanes <= 1 ? 0.5 : i / (lanes - 1);
        const originX = left + span * t + Math.sin(this.phaseTimer * 2 + i) * 10;
        const speedY = 70 + i * 4;
        this.bulletManager.spawnBullet(
          originX,
          this.y + 26,
          (t - 0.5) * 22,
          speedY,
          6,
          "PETAL_WHITE",
          1,
          {
            type: BulletBehavior.PETAL_RAIN,
            param0: 10,
            param1: 4.2 + i * 0.18,
            param2: 38,
            angleOffset: Math.random() * Math.PI * 2,
            spinSpeed: 0.9,
          }
        );
      }
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

      const ringCount = this.isLunatic() ? 34 : this.isHard() ? 27 : 22;
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
        timer: 2.95,
        warn: 0.6,
        fire: 2.35,
        wall: player.x < this.x ? -1 : 1,
        offset: 138,
      };
    }

    updateFinalSurvival(deltaTime, player) {
      const phaseScript = this.getPhaseScript();
      const duration = phaseScript?.duration || 96;
      const progress = Math.max(0, Math.min(1, this.phaseTimer / duration));

      this.timerA -= deltaTime;
      while (this.timerA <= 0) {
        this.timerA += Math.max(
          0.095,
          (this.isLunatic() ? 0.16 : this.isHard() ? 0.2 : 0.25) - progress * 0.045
        );
        this.fireFinalOrrery(progress);
      }

      this.timerB -= deltaTime;
      if (this.timerB <= 0) {
        this.timerB += Math.max(
          2.35,
          (this.isLunatic() ? 2.85 : this.isHard() ? 3.25 : 3.75) - progress * 0.3
        );
        this.fireFinalDuckEntry(progress);
      }

      this.timerC -= deltaTime;
      if (this.timerC <= 0) {
        this.timerC += Math.max(
          1.8,
          (this.isLunatic() ? 2.65 : this.isHard() ? 3.1 : 3.65) - progress * 0.72
        );
        this.fireFinalCometBurst(player, progress);
      }
    }

    fireFinalOrrery(progress) {
      const spokes = this.isLunatic() ? 13 : this.isHard() ? 11 : 9;
      const base = this.phaseTimer * (2.2 + progress * 1.3);
      const originRadius = 10 + Math.sin(this.phaseTimer * 3.1) * 5;

      for (let i = 0; i < spokes; i += 1) {
        const theta = base + (Math.PI * 2 * i) / spokes;
        const rose = 1 + 0.2 * Math.sin(theta * 5 + this.phaseTimer * 1.7);
        const angle = theta + 0.34 * Math.sin(theta * 3 - this.phaseTimer * 1.2);
        const speed = (90 + progress * 74) * rose;
        const spawnX = this.x + Math.cos(theta) * originRadius;
        const spawnY = this.y + Math.sin(theta) * originRadius;
        const velocity = {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        };

        this.bulletManager.spawnBullet(
          spawnX,
          spawnY,
          velocity.vx,
          velocity.vy,
          5.5,
          i % 3 === 0 ? "PETAL_WHITE" : i % 3 === 1 ? "PETAL_ORANGE" : "PETAL_DARK",
          1,
          {
            angleOffset: theta,
            spinSpeed: 1.2 + progress * 1.4,
          }
        );
      }
    }

    fireFinalDuckEntry(progress) {
      if (!this.enemyManager || progress < 0.1 || progress > 0.62) {
        return;
      }

      const count = this.isLunatic() ? 2 : this.isHard() ? 2 : 1;
      const speed = this.isLunatic() ? 82 : this.isHard() ? 74 : 66;
      const fromLeft = this.branchIndex % 2 === 0;
      const baseY = 150 + Math.sin(this.phaseTimer * 1.7) * 28;
      this.branchIndex += 1;

      for (let i = 0; i < count; i += 1) {
        const side = i % 2 === 0 ? fromLeft : !fromLeft;
        const x = side ? -42 : GAME_WIDTH + 42;
        const vx = side ? speed : -speed;
        const y = baseY + i * 74 + Math.sin(this.phaseTimer * 2.1 + i) * 12;
        this.enemyManager.spawnSideDuck(x, y, vx, 18 + progress * 18, {
          health: this.isLunatic() ? 3 : 2.5,
          attackTimer: 0.62 + i * 0.22,
        });
      }
    }

    fireFinalCometBurst(player, progress) {
      const count = this.isLunatic() ? 38 : this.isHard() ? 31 : 25;
      const aim = player
        ? this.emitter.getAngleToTarget(this.x, this.y, player.x, player.y) * Math.PI / 180
        : Math.PI * 0.5;
      const base = aim + Math.sin(this.phaseTimer * 0.9) * 0.5;

      for (let i = 0; i < count; i += 1) {
        const t = count <= 1 ? 0.5 : i / (count - 1);
        const theta = base - Math.PI * 0.86 + Math.PI * 1.72 * t;
        const bend = Math.sin(t * Math.PI * 4 + this.phaseTimer * 2) * 0.18;
        const speed = 112 + progress * 68 + Math.sin(i * 0.55 + this.phaseTimer) * 18;
        const velocity = {
          vx: Math.cos(theta + bend) * speed,
          vy: Math.sin(theta + bend) * speed,
        };

        this.bulletManager.spawnBullet(this.x, this.y + 16, velocity.vx, velocity.vy, 7, "BARRIER_GOLD");
      }
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

      const progress = 1 - this.laserGrid.timer / this.laserGrid.fire;
      const sweep = Math.sin(progress * Math.PI * 1.5) * 34 * this.laserGrid.sweep;
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

      const progress = 1 - this.whiteLaser.timer / this.whiteLaser.fire;
      const wallShift = Math.sin(progress * Math.PI) * 32 * this.whiteLaser.wall;
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

      if (this.roleScript === bossRoles.boss1 && this.phase === 1) {
        this.updateBoss1DiagonalDash(deltaTime);
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

    updateBoss1DiagonalDash(deltaTime) {
      if (this.dashActive) {
        this.dashElapsed += deltaTime;
        const progress = Math.min(1, this.dashElapsed / this.dashDuration);
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) * 0.5;
        this.x = this.dashStartX + (this.dashEndX - this.dashStartX) * eased;
        this.y = this.dashStartY + (this.dashEndY - this.dashStartY) * eased;
        this.dashTrail.push({ x: this.x, y: this.y });
        if (this.dashTrail.length > 9) {
          this.dashTrail.shift();
        }

        if (progress >= 1) {
          this.dashActive = false;
          this.dashTimer = this.isLunatic() ? 3.4 : this.isHard() ? 4.0 : 4.7;
          this.moveEndX = this.lanePositions[this.dashIndex % this.lanePositions.length] || BOSS_ENTRY_X;
          this.moveState = "stopped";
        }
        return;
      }

      if (this.dashWarnTimer > 0) {
        this.dashWarnTimer -= deltaTime;
        const shake = Math.sin(this.dashWarnTimer * 42) * 2.2;
        this.x = this.dashStartX + shake;
        this.y = this.dashStartY;
        if (this.dashWarnTimer <= 0) {
          this.dashActive = true;
          this.dashElapsed = 0;
          this.dashTrail = [{ x: this.dashStartX, y: this.dashStartY }];
        }
        return;
      }

      const homeX = this.moveEndX || BOSS_ENTRY_X;
      this.x += (homeX - this.x) * Math.min(1, deltaTime * 3.2);
      this.y += (BOSS_ENTRY_Y - this.y) * Math.min(1, deltaTime * 3.2);
      this.y += Math.sin(this.moveClock * 1.35) * 0.55;
      this.dashTimer -= deltaTime;

      if (this.dashTimer <= 0) {
        this.beginBoss1DashWarning();
      }
    }

    beginBoss1DashWarning() {
      const paths = [
        { sx: 82, sy: 116, ex: GAME_WIDTH - 82, ey: 326 },
        { sx: GAME_WIDTH - 82, sy: 116, ex: 82, ey: 326 },
        { sx: 150, sy: 96, ex: GAME_WIDTH - 150, ey: 282 },
        { sx: GAME_WIDTH - 150, sy: 96, ex: 150, ey: 282 },
      ];
      const path = paths[this.dashIndex % paths.length];
      this.dashIndex += 1;
      this.dashStartX = path.sx;
      this.dashStartY = path.sy;
      this.dashEndX = path.ex;
      this.dashEndY = path.ey;
      this.dashDuration = this.isLunatic() ? 0.68 : this.isHard() ? 0.78 : 0.9;
      this.dashWarnTimer = this.isLunatic() ? 0.38 : this.isHard() ? 0.48 : 0.58;
      this.dashTrail = [];
      this.x = this.dashStartX;
      this.y = this.dashStartY;
      this.moveState = "moving";
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
        const stateConfig = this.getBossStateConfig();
        const frameCount = Math.max(1, stateConfig.rows * stateConfig.cols);
        this.spriteFrame = (this.spriteFrame + 1) % frameCount;
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

    updateBossAnimationState() {
      if (this.moveState === "moving") {
        this.animationState = BossAnimationState.MOVE;
        return;
      }

      const phaseScript = this.getPhaseScript();
      const activeSpell = phaseScript?.spellIds?.[0] || "";
      const attackPulse = this.phaseTimer % (activeSpell === "DELAY_STASIS" ? 1.2 : 0.9);
      this.animationState = attackPulse < 0.36 ? BossAnimationState.ATTACK : BossAnimationState.IDLE;
    }

    beginPhase(phase, playFx = true) {
      this.phase = phase;
      this.phaseTimer = 0;
      this.phaseRewardMask = 0;
      const phaseScript = this.getPhaseScript();
      this.invulnerable = Boolean(phaseScript?.survival);
      this.phaseName = phaseScript?.name || this.roleScript.phaseName;
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
      this.timeStopOverlayTimer = 0;
      this.timeStopOverlayDuration = 0;
      this.dashTimer = 2.0;
      this.dashWarnTimer = 0;
      this.dashActive = false;
      this.dashElapsed = 0;
      this.dashTrail = [];
      this.bulletManager.clearGravityWell();
      this.bulletManager.clearEnemyBullets();

      if (playFx) {
        this.bombEffect.start(this.x, this.y, this.phaseName, {
          clearsBullets: false,
          overlayAlpha: 0.24,
          ringColor: phase === 3 ? "255, 64, 112" : phase === 2 ? "255, 215, 0" : "255, 253, 208",
          shadowColor: phase === 3 ? "rgba(255, 64, 112, 0.54)" : phase === 2 ? "rgba(212, 31, 60, 0.50)" : "rgba(212, 175, 55, 0.50)",
          textColor: "rgba(255,253,208,0.98)",
        });
      }

      this.moveState = "stopped";
      this.stopTimer = 1.0;
    }

    updatePhaseByHealth() {
      if (this.roleScript === bossRoles.boss1) {
        const ratio = global.HealthSystem.getRatio(this);
        const currentPhase = this.roleScript.phases[this.phase - 1];
        const threshold = currentPhase?.threshold ?? 0;
        if (this.phase < this.roleScript.phases.length && threshold > 0 && ratio <= threshold) {
          this.beginPhase(this.phase + 1);
        }
        return;
      }

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

      const sprite = this.assetLoader.get(this.bossSpriteKey) || this.assetLoader.get("boss");
      if (sprite) {
        this.renderDashTrail(ctx);
        this.drawBoss(ctx, sprite);
        return;
      }

      this.renderDashTrail(ctx);
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

    renderDashTrail(ctx) {
      if (!this.dashTrail || this.dashTrail.length < 2) {
        return;
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 1; i < this.dashTrail.length; i += 1) {
        const prev = this.dashTrail[i - 1];
        const point = this.dashTrail[i];
        const alpha = i / this.dashTrail.length;
        ctx.strokeStyle = `rgba(255, 215, 112, ${alpha * 0.34})`;
        ctx.lineWidth = 5 * alpha;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawBoss(ctx, image) {
      const stateConfig = this.getBossStateConfig();
      const rows = Math.max(1, stateConfig.rows);
      const cols = Math.max(1, stateConfig.cols);
      const currentFrame = Math.floor(this.spriteFrame) % Math.max(1, rows * cols);
      const sourceX = stateConfig.x || 0;
      const sourceY = stateConfig.y || 0;
      const sourceWidth = stateConfig.w || image.width;
      const sourceHeight = stateConfig.h || image.height;
      const frameWidth = sourceWidth / cols;
      const frameHeight = sourceHeight / rows;
      let sx = sourceX + (currentFrame % cols) * frameWidth;
      let sy = sourceY + Math.floor(currentFrame / cols) * frameHeight;
      const frame = this.getCroppedBossFrame(image, sx, sy, frameWidth, frameHeight, currentFrame, stateConfig);
      const renderHeight = this.animationState === BossAnimationState.ATTACK
        ? this.bossRenderHeight * 1.08
        : this.bossRenderHeight;
      const scale = renderHeight / Math.max(1, frame.h);
      const drawWidth = frame.w * scale;
      const drawHeight = frame.h * scale;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.imageSmoothingEnabled = false;
      ctx.shadowColor = this.animationState === BossAnimationState.ATTACK
        ? "rgba(255, 215, 0, 0.45)"
        : "rgba(0, 255, 255, 0.24)";
      ctx.shadowBlur = this.animationState === BossAnimationState.ATTACK ? 16 : 8;

      if (this.animationState === BossAnimationState.MOVE && this.facingDirection > 0) {
        ctx.scale(-1, 1);
      }

      ctx.drawImage(
        image,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );
      ctx.restore();
    }

    getBossStateConfig() {
      const stateName = this.animationState === BossAnimationState.MOVE || this.spriteState === "side"
        ? "side"
        : "idle";
      const states = this.bossSpriteConfig?.states || BOSS_SPRITE_CONFIGS[1].states;
      const stateConfig = states[stateName] || states.idle;
      this.rows = stateConfig.rows;
      this.cols = stateConfig.cols;
      return stateConfig;
    }

    getCroppedBossFrame(image, sx, sy, frameWidth, frameHeight, currentFrame, stateConfig) {
      const cacheKey = `${this.bossSpriteKey}:${stateConfig.x}:${stateConfig.y}:${stateConfig.rows}:${stateConfig.cols}:${currentFrame}`;
      if (this.frameCropCache[cacheKey]) {
        return this.frameCropCache[cacheKey];
      }

      const fallback = {
        x: sx,
        y: sy,
        w: frameWidth,
        h: frameHeight,
      };

      const sourceCtx = image.getContext ? image.getContext("2d") : null;
      if (!sourceCtx) {
        this.frameCropCache[cacheKey] = fallback;
        return fallback;
      }

      const clampedX = Math.max(0, Math.floor(sx));
      const clampedY = Math.max(0, Math.floor(sy));
      const clampedW = Math.max(1, Math.min(image.width - clampedX, Math.ceil(frameWidth)));
      const clampedH = Math.max(1, Math.min(image.height - clampedY, Math.ceil(frameHeight)));
      const imageData = sourceCtx.getImageData(clampedX, clampedY, clampedW, clampedH);
      const data = imageData.data;
      let minX = clampedW;
      let minY = clampedH;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < clampedH; y += 1) {
        for (let x = 0; x < clampedW; x += 1) {
          const alpha = data[(y * clampedW + x) * 4 + 3];
          if (alpha <= 20) {
            continue;
          }

          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }

      if (maxX < minX || maxY < minY) {
        this.frameCropCache[cacheKey] = fallback;
        return fallback;
      }

      const padding = 2;
      const frame = {
        x: clampedX + Math.max(0, minX - padding),
        y: clampedY + Math.max(0, minY - padding),
        w: Math.min(clampedW - Math.max(0, minX - padding), maxX - minX + 1 + padding * 2),
        h: Math.min(clampedH - Math.max(0, minY - padding), maxY - minY + 1 + padding * 2),
      };

      this.frameCropCache[cacheKey] = frame;
      return frame;
    }

    renderLaserHazards(ctx) {
      if (this.laserGrid) {
        const warning = this.laserGrid.timer > this.laserGrid.fire;
        const progress = warning
          ? 1 - (this.laserGrid.timer - this.laserGrid.fire) / this.laserGrid.warn
          : 1 - this.laserGrid.timer / this.laserGrid.fire;
        const sweep = warning ? 0 : Math.sin(progress * Math.PI * 1.5) * 34 * this.laserGrid.sweep;
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
        const wallShift = warning ? 0 : Math.sin(progress * Math.PI) * 32 * this.whiteLaser.wall;
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

    renderTimeStopOverlay(ctx) {
      if (this.timeStopOverlayTimer <= 0 || this.timeStopOverlayDuration <= 0) {
        return;
      }

      const progress = this.timeStopOverlayTimer / this.timeStopOverlayDuration;
      const pulse = 0.5 + Math.sin(this.phaseTimer * 10) * 0.08;
      const alpha = Math.max(0, Math.min(0.56, 0.18 + progress * 0.22 + pulse * 0.12));
      ctx.save();
      ctx.fillStyle = `rgba(30, 32, 38, ${alpha})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.fillStyle = `rgba(220, 226, 235, ${alpha * 0.18})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.restore();
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

      this.renderTimeStopOverlay(ctx);
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
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = Palette.moon;
      ctx.font = "bold 13px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${this.roleScript.name}  ${this.phaseName}`, GAME_WIDTH * 0.5, y - 4);

      ctx.fillStyle = "rgba(255,253,208,0.88)";
      ctx.font = "12px monospace";
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
