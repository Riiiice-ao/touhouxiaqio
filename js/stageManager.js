(function registerStageManager(global) {
  const {
    MINION_STAGE_DURATION,
    MINION_TARGET_WAVES,
    MINION_WAVE_INTERVAL_MAX,
    MINION_WAVE_INTERVAL_MIN,
  } = global.Config;

  class StageManager {
    constructor(enemyManager, bossController, bulletManager, dialogueManager) {
      this.enemyManager = enemyManager;
      this.bossController = bossController;
      this.bulletManager = bulletManager;
      this.dialogueManager = dialogueManager;
      this.difficulty = "easy";

      this.reset();
    }

    setDifficulty(difficulty) {
      this.difficulty = difficulty;
      this.enemyManager.setDifficulty(difficulty);
      this.bossController.setDifficulty(difficulty);
    }

    reset() {
      this.state = "MINION_STAGE";
      this.minionTimer = 0;
      this.waveTimer = 1.2;
      this.wavesSpawned = 0;
      this.bannerText = "MINION STAGE";
      this.bannerTimer = 1.8;
      this.clearTimer = 0;
      this.introDialogueDone = false;
      this.bossDialogueDone = false;
      this.pauseForDialogue = false;
    }

    beginIntroDialogue() {
      if (this.introDialogueDone) {
        return false;
      }

      this.pauseForDialogue = true;
      this.dialogueManager.start(
        [
          { name: "哈哈哈哈", text: "哈哈哈哈哈哈哈" },
          { name: "哈哈哈哈", text: "哈哈哈哈哈哈哈" },
        ],
        () => {
          this.introDialogueDone = true;
          this.pauseForDialogue = false;
        }
      );
      return true;
    }

    beginBossDialogue() {
      if (this.bossDialogueDone) {
        return false;
      }

      this.pauseForDialogue = true;
      this.dialogueManager.start(
        [
          { name: "哈哈哈哈", text: "哈哈哈哈哈哈哈" },
          { name: "哈哈哈哈", text: "哈哈哈哈哈哈哈" },
        ],
        () => {
          this.bossDialogueDone = true;
          this.pauseForDialogue = false;
          this.state = "BOSS_ENTRY";
          this.bannerText = "BOSS APPROACHING";
          this.bannerTimer = 2;
          this.enemyManager.clearAll();
          this.bulletManager.clearEnemyBullets();
          this.bossController.activateEntry();
        }
      );
      return true;
    }

    update(deltaTime, player) {
      if (this.pauseForDialogue) {
        return;
      }

      this.bannerTimer = Math.max(0, this.bannerTimer - deltaTime);

      if (this.state === "MINION_STAGE") {
        this.updateMinionStage(deltaTime, player);
        return;
      }

      if (this.state === "BOSS_ENTRY") {
        this.bossController.update(deltaTime, player);
        if (this.bossController.inBattle) {
          this.state = "BOSS_STAGE";
          this.bannerText = "BOSS STAGE";
          this.bannerTimer = 1.8;
        }
        return;
      }

      if (this.state === "BOSS_STAGE") {
        this.bossController.update(deltaTime, player);
        if (this.bossController.defeated) {
          this.state = this.bossController.timedOut ? "TIMEOUT_CLEAR" : "CLEAR";
          this.bannerText = this.bossController.timedOut ? "BOSS ESCAPED" : "STAGE CLEAR";
          this.bannerTimer = 2.5;
          this.clearTimer = 2.5;
          this.bulletManager.clearEnemyBullets();
        }
        return;
      }

      if (this.state === "CLEAR" || this.state === "TIMEOUT_CLEAR") {
        this.clearTimer = Math.max(0, this.clearTimer - deltaTime);
      }
    }

    updateMinionStage(deltaTime, player) {
      this.minionTimer += deltaTime;
      this.waveTimer -= deltaTime;

      if (this.wavesSpawned < MINION_TARGET_WAVES && this.waveTimer <= 0) {
        this.enemyManager.spawnRandomWave();
        this.wavesSpawned += 1;
        this.waveTimer = this.randomWaveInterval();
      }

      this.enemyManager.update(deltaTime, player);

      if (
        this.minionTimer >= MINION_STAGE_DURATION ||
        (this.wavesSpawned >= MINION_TARGET_WAVES && this.enemyManager.getActiveCount() === 0)
      ) {
        this.enterBossStage();
      }
    }

    enterBossStage() {
      if (!this.bossDialogueDone) {
        this.beginBossDialogue();
      }
    }

    randomWaveInterval() {
      const base =
        MINION_WAVE_INTERVAL_MIN + Math.random() * (MINION_WAVE_INTERVAL_MAX - MINION_WAVE_INTERVAL_MIN);

      if (this.difficulty === "lunatic") {
        return base * 0.4;
      }

      return this.difficulty === "hard" ? base * 0.6 : base;
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

      if (this.state === "MINION_STAGE") {
        const remain = Math.max(0, MINION_STAGE_DURATION - this.minionTimer);
        ctx.fillText(`Minion Time ${remain.toFixed(1)}s`, 16, 16);
        ctx.fillText(`Waves ${this.wavesSpawned}/${MINION_TARGET_WAVES}`, 16, 34);
      } else if (this.state === "BOSS_STAGE" || this.state === "BOSS_ENTRY") {
        ctx.fillText("Boss Encounter", 16, 16);
      } else {
        ctx.fillText("Stage Cleared", 16, 16);
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
