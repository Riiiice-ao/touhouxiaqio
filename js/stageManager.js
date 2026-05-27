(function registerStageManager(global) {
  const {
    GAME_HEIGHT,
    GAME_WIDTH,
    MINION_STAGE_DURATION,
    MINION_TARGET_WAVES,
    MINION_WAVE_INTERVAL_MAX,
    MINION_WAVE_INTERVAL_MIN,
  } = global.Config;

  /**
   * 关卡状态机。
   * 用来管理“小怪阶段 -> Boss 登场 -> Boss 战 -> 通关”的全局流程。
   */
  class StageManager {
    constructor(enemyManager, bossController, bulletManager) {
      this.enemyManager = enemyManager;
      this.bossController = bossController;
      this.bulletManager = bulletManager;

      this.reset();
    }

    reset() {
      this.state = "MINION_STAGE";
      this.minionTimer = 0;
      this.waveTimer = 1.2;
      this.wavesSpawned = 0;
      this.bannerText = "MINION STAGE";
      this.bannerTimer = 1.8;
      this.clearTimer = 0;
    }

    update(deltaTime, player) {
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
          this.state = "CLEAR";
          this.bannerText = "STAGE CLEAR";
          this.bannerTimer = 2.5;
          this.clearTimer = 2.5;
          this.bulletManager.clearEnemyBullets();
        }
        return;
      }

      if (this.state === "CLEAR") {
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
      this.state = "BOSS_ENTRY";
      this.bannerText = "BOSS APPROACHING";
      this.bannerTimer = 2;
      this.enemyManager.clearAll();
      this.bulletManager.clearEnemyBullets();
      this.bossController.activateEntry();
    }

    randomWaveInterval() {
      return MINION_WAVE_INTERVAL_MIN + Math.random() * (MINION_WAVE_INTERVAL_MAX - MINION_WAVE_INTERVAL_MIN);
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
      ctx.fillText(this.bannerText, GAME_WIDTH * 0.5, GAME_HEIGHT * 0.18);
      ctx.restore();
    }
  }

  global.StageManager = StageManager;
})(window.XTouhouWeb);
