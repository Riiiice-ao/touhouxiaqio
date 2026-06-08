(function registerStageManager(global) {
  const {
    MINION_WAVE_INTERVAL_MAX,
    MINION_WAVE_INTERVAL_MIN,
  } = global.Config;

  const stagePhase = {
    INTRO: "INTRO",
    WAVE: "WAVE",
    MID_BOSS_ENTRY: "MID_BOSS_ENTRY",
    MID_BOSS: "MID_BOSS",
    BOSS_ENTRY: "BOSS_ENTRY",
    BOSS: "BOSS",
    TRANSITION: "TRANSITION",
    CLEAR: "CLEAR",
    TIMEOUT_CLEAR: "TIMEOUT_CLEAR",
  };

  class StageManager {
    constructor(enemyManager, bossController, bulletManager, dialogueManager) {
      this.enemyManager = enemyManager;
      this.bossController = bossController;
      this.bulletManager = bulletManager;
      this.dialogueManager = dialogueManager;
      this.difficulty = "easy";
      this.stageScripts = global.stageScripts;
      this.reset();
    }

    setDifficulty(difficulty) {
      this.difficulty = difficulty;
      this.enemyManager.setDifficulty(difficulty);
      this.bossController.setDifficulty(difficulty);
      this.bulletManager.setDifficulty(difficulty);
    }

    reset() {
      this.currentStage = 1;
      this.stagePhase = stagePhase.INTRO;
      this.state = "STAGE_1_INTRO";
      this.phaseTimer = 0;
      this.waveTimer = 1.0;
      this.wavesSpawned = 0;
      this.targetWaves = 3;
      this.bannerText = "STAGE 1";
      this.bannerTimer = 2.0;
      this.clearTimer = 0;
      this.clearHandled = false;
      this.transitionTimer = 0;
      this.introDialogueDone = false;
      this.pauseForDialogue = false;
      window.currentStage = this.currentStage;
      window.stagePhase = this.stagePhase;
      this.syncGlobalState();
    }

    beginIntroDialogue() {
      if (this.introDialogueDone) {
        return false;
      }

      this.pauseForDialogue = true;
      this.dialogueManager.start(
        [
          { name: "Stage 1", text: "Shrimps Courtyard: barrier-class danmaku begins." },
          { name: "Stage 2", text: "Scarlet Rose Castle opens seamlessly after Stage 1." },
        ],
        () => {
          this.introDialogueDone = true;
          this.pauseForDialogue = false;
          this.enterWavePhase();
        }
      );
      return true;
    }

    update(deltaTime, player, audioAnalysis = { isBeat: false, musicFlow: 0 }) {
      if (this.pauseForDialogue) {
        return;
      }

      this.lastPlayer = player;
      this.phaseTimer += deltaTime;
      this.bannerTimer = Math.max(0, this.bannerTimer - deltaTime);

      if (this.stagePhase === stagePhase.INTRO) {
        if (this.introDialogueDone) {
          this.enterWavePhase();
        }
        return;
      }

      if (this.stagePhase === stagePhase.WAVE) {
        this.updateWavePhase(deltaTime);
        return;
      }

      if (this.stagePhase === stagePhase.MID_BOSS_ENTRY || this.stagePhase === stagePhase.BOSS_ENTRY) {
        this.bossController.update(deltaTime, player, audioAnalysis);
        if (this.bossController.inBattle) {
          this.stagePhase = this.stagePhase === stagePhase.MID_BOSS_ENTRY ? stagePhase.MID_BOSS : stagePhase.BOSS;
          this.state = `STAGE_${this.currentStage}_${this.stagePhase}`;
          this.bannerText = this.stagePhase === stagePhase.MID_BOSS ? "MID-BOSS" : "BOSS";
          this.bannerTimer = 1.5;
          this.syncGlobalState();
        }
        return;
      }

      if (this.stagePhase === stagePhase.MID_BOSS || this.stagePhase === stagePhase.BOSS) {
        this.bossController.update(deltaTime, player, audioAnalysis);
        this.updateBossCompletion();
        return;
      }

      if (this.stagePhase === stagePhase.TRANSITION) {
        this.updateStageTransition(deltaTime);
        return;
      }

      if (this.stagePhase === stagePhase.CLEAR || this.stagePhase === stagePhase.TIMEOUT_CLEAR) {
        this.clearTimer = Math.max(0, this.clearTimer - deltaTime);
      }
    }

    enterWavePhase() {
      this.stagePhase = stagePhase.WAVE;
      this.state = `STAGE_${this.currentStage}_WAVE`;
      this.phaseTimer = 0;
      this.waveTimer = 0.8;
      this.wavesSpawned = 0;
      this.targetWaves = this.currentStage === 1 ? 3 : 4;
      this.bannerText = this.getStageScript().title;
      this.bannerTimer = 2.0;
      this.enemyManager.clearAll();
      this.bulletManager.clearEnemyBullets();
      this.bulletManager.clearGravityWell();
      this.syncGlobalState();
    }

    updateWavePhase(deltaTime) {
      this.waveTimer -= deltaTime;

      if (this.wavesSpawned < this.targetWaves && this.waveTimer <= 0) {
        this.enemyManager.spawnRandomWave();
        this.wavesSpawned += 1;
        this.waveTimer = this.randomWaveInterval();
      }

      this.enemyManager.update(deltaTime, this.lastPlayer);

      if (this.wavesSpawned >= this.targetWaves && this.enemyManager.getActiveCount() === 0) {
        this.enterBossEntry("MID_BOSS");
      }
    }

    enterBossEntry(roleKey) {
      const script = this.getStageScript().phases[roleKey];
      this.stagePhase = roleKey === "MID_BOSS" ? stagePhase.MID_BOSS_ENTRY : stagePhase.BOSS_ENTRY;
      this.state = `STAGE_${this.currentStage}_${this.stagePhase}`;
      this.phaseTimer = 0;
      this.bannerText = roleKey === "MID_BOSS" ? "MID-BOSS APPROACHING" : "BOSS APPROACHING";
      this.bannerTimer = 2.0;
      this.enemyManager.clearAll();
      this.bulletManager.clearEnemyBullets();
      this.bulletManager.clearGravityWell();
      this.bossController.activateEntry(script, this.currentStage, roleKey);
      this.syncGlobalState();
    }

    startPractice(stage, phase) {
      const targetStage = this.stageScripts[stage] ? stage : 1;
      const script = this.stageScripts[targetStage].phases.BOSS;
      const maxPhase = Math.max(1, script.phases.length);
      const targetPhase = Math.max(1, Math.min(maxPhase, Math.floor(phase) || 1));

      this.currentStage = targetStage;
      this.stagePhase = stagePhase.BOSS;
      this.state = `STAGE_${targetStage}_BOSS`;
      this.phaseTimer = 0;
      this.waveTimer = 0;
      this.wavesSpawned = 0;
      this.targetWaves = 0;
      this.transitionTimer = 0;
      this.clearTimer = 0;
      this.clearHandled = false;
      this.introDialogueDone = true;
      this.pauseForDialogue = false;
      this.bannerText = `PRACTICE ${targetStage}-${targetPhase}`;
      this.bannerTimer = 1.8;
      this.enemyManager.clearAll();
      this.bulletManager.clearEnemyBullets();
      this.bulletManager.clearGravityWell();
      this.dialogueManager.hide();
      this.bossController.activatePractice(script, targetStage, targetPhase);
      this.syncGlobalState();
    }

    updateBossCompletion() {
      if (!this.bossController.defeated) {
        return;
      }

      const timedOut = this.bossController.timedOut && !this.bossController.wasKilled;
      this.bulletManager.clearEnemyBullets();
      this.bulletManager.clearGravityWell();

      if (timedOut) {
        this.stagePhase = stagePhase.TIMEOUT_CLEAR;
        this.state = "TIMEOUT_CLEAR";
        this.bannerText = "BOSS ESCAPED";
        this.bannerTimer = 2.5;
        this.clearTimer = 2.5;
        this.clearHandled = false;
        this.syncGlobalState();
        return;
      }

      if (this.stagePhase === stagePhase.MID_BOSS) {
        this.enterBossEntry("BOSS");
        return;
      }

      if (this.currentStage === 1) {
        this.enterStageTwoTransition();
        return;
      }

      this.stagePhase = stagePhase.CLEAR;
      this.state = "CLEAR";
      this.bannerText = "ALL STAGES CLEAR";
      this.bannerTimer = 2.5;
      this.clearTimer = 2.5;
      this.clearHandled = false;
      this.syncGlobalState();
    }

    enterStageTwoTransition() {
      this.currentStage = 2;
      this.stagePhase = stagePhase.TRANSITION;
      this.state = "STAGE_2_TRANSITION";
      this.transitionTimer = 2.4;
      this.phaseTimer = 0;
      this.bannerText = "STAGE 2";
      this.bannerTimer = 2.4;
      this.enemyManager.clearAll();
      this.bulletManager.clearEnemyBullets();
      this.bulletManager.clearGravityWell();
      this.syncGlobalState();
    }

    updateStageTransition(deltaTime) {
      this.transitionTimer -= deltaTime;
      if (this.transitionTimer <= 0) {
        this.enterWavePhase();
      }
    }

    getStageScript() {
      return this.stageScripts[this.currentStage] || this.stageScripts[1];
    }

    randomWaveInterval() {
      const base =
        MINION_WAVE_INTERVAL_MIN + Math.random() * (MINION_WAVE_INTERVAL_MAX - MINION_WAVE_INTERVAL_MIN);

      if (this.difficulty === "lunatic") {
        return base * 0.42;
      }

      return this.difficulty === "hard" ? base * 0.62 : base * 0.82;
    }

    syncGlobalState() {
      window.currentStage = this.currentStage;
      window.stagePhase = this.stagePhase;
    }

    renderWorld(ctx) {
      this.enemyManager.render(ctx);
      this.bossController.render(ctx);
    }

    renderUi(ctx) {
      this.bossController.renderHpBar(ctx);
      this.renderStageInfo(ctx);
      this.renderBanner(ctx);
    }

    renderStageInfo(ctx) {
      ctx.save();
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255, 245, 230, 0.88)";
      ctx.font = "13px Trebuchet MS";

      const script = this.getStageScript();
      ctx.fillText(`Stage ${this.currentStage}: ${script.title}`, 16, 34);

      if (this.stagePhase === stagePhase.WAVE) {
        ctx.fillText(`Phase WAVE ${this.wavesSpawned}/${this.targetWaves}`, 16, 16);
      } else if (this.stagePhase === stagePhase.MID_BOSS || this.stagePhase === stagePhase.MID_BOSS_ENTRY) {
        ctx.fillText("Phase MID-BOSS", 16, 16);
      } else if (this.stagePhase === stagePhase.BOSS || this.stagePhase === stagePhase.BOSS_ENTRY) {
        ctx.fillText("Phase BOSS", 16, 16);
      } else if (this.stagePhase === stagePhase.TRANSITION) {
        ctx.fillText("Phase TRANSITION", 16, 16);
      } else {
        ctx.fillText(`Phase ${this.stagePhase}`, 16, 16);
      }

      ctx.restore();
    }

    renderBanner(ctx) {
      if (this.bannerTimer <= 0) {
        return;
      }

      const alpha = Math.min(1, this.bannerTimer / 1.2);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(255, 245, 228, ${alpha})`;
      ctx.font = "italic 34px Georgia";
      ctx.fillText(this.bannerText, 300, 144);
      ctx.restore();
    }
  }

  global.StageManager = StageManager;
})(window.XTouhouWeb);
