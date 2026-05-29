(function bootGame(global) {
  const { GAME_HEIGHT, GAME_WIDTH } = global.Config;
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;

  const input = new global.InputController();
  const hud = new global.Hud();
  const ui = new global.UiManager();
  const dialogueManager = new global.DialogueManager();
  const assetLoader = new global.AssetLoader();
  const audioManager = new global.AudioManager();
  const bulletManager = new global.BulletManager(audioManager);
  const itemManager = new global.ItemManager();
  const bombEffect = new global.BombEffect();
  const emitter = new global.Emitter(bulletManager);
  const enemyManager = new global.EnemyManager(emitter, assetLoader);
  enemyManager.setItemManager(itemManager);
  const bossController = new global.BossController(emitter, bulletManager, bombEffect, assetLoader);
  const stageManager = new global.StageManager(enemyManager, bossController, bulletManager, dialogueManager);
  const player = new global.Player(input, bulletManager, hud, bombEffect, assetLoader);

  const gameState = {
    currentDifficulty: null,
    scene: "menu",
    isPaused: false,
    assetsReady: false,
    backgroundScroll: 0,
    bossMusicStarted: false,
  };

  hud.reset(player);
  hud.setDifficulty(null);

  ui.bind({
    onSelectDifficulty: startGame,
    onPauseMenu: openPauseMenu,
    onResume: resumeGame,
    onRestartConfirmed: restartCurrentRun,
    onContinue: continueRun,
    onEndGame: endGameToScoreBoard,
    onBackToMenu: backToMainMenu,
  });

  ui.showStartMenu();
  const assetCount = Object.keys(assetLoader.assetMap).length;
  ui.setLoadingState(0, assetCount);

  assetLoader.loadAll((loadedCount, totalCount) => {
    ui.setLoadingState(loadedCount, totalCount);
  }).then(() => {
    gameState.assetsReady = true;
    ui.setLoadingState(assetCount, assetCount);
  }).catch(() => {
    gameState.assetsReady = true;
    ui.setLoadingState(assetCount, assetCount);
  });

  let lastTime = performance.now();

  function gameLoop(now) {
    const deltaTime = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    update(deltaTime);
    render(now);

    if (dialogueManager.active && (input.wasPressed("KeyZ") || input.wasPressed("Space"))) {
      dialogueManager.advance();
    }

    input.endFrame();
    requestAnimationFrame(gameLoop);
  }

  async function startGame(difficulty) {
    if (!gameState.assetsReady) {
      return;
    }

    try {
      await audioManager.resume();
      await audioManager.playTrack("stage");
    } catch {
      // audio permission or codec failure should not block the game start
    }

    gameState.currentDifficulty = difficulty;
    gameState.scene = "playing";
    gameState.isPaused = false;
    gameState.bossMusicStarted = false;
    ui.hideAllOverlayMenus();
    resetRunState();
    stageManager.beginIntroDialogue();
  }

  function resetRunState() {
    bulletManager.clearEnemyBullets();
    itemManager.clearAll();
    enemyManager.clearAll();
    bossController.setDifficulty(gameState.currentDifficulty ?? "easy");
    bossController.reset();
    stageManager.setDifficulty(gameState.currentDifficulty ?? "easy");
    stageManager.reset();
    player.resetRunState();
    hud.reset(player);
    hud.setDifficulty(gameState.currentDifficulty);
    gameState.backgroundScroll = 0;
    gameState.bossMusicStarted = false;
    dialogueManager.hide();
  }

  function openPauseMenu() {
    if (gameState.scene !== "playing" || gameState.isPaused || dialogueManager.active) {
      return;
    }

    gameState.isPaused = true;
    ui.showPauseMenu();
  }

  function resumeGame() {
    if (gameState.scene !== "playing") {
      return;
    }

    gameState.isPaused = false;
    ui.hideAllOverlayMenus();
  }

  function restartCurrentRun() {
    if (!gameState.currentDifficulty) {
      backToMainMenu();
      return;
    }

    gameState.scene = "playing";
    gameState.isPaused = false;
    ui.hideAllOverlayMenus();
    resetRunState();
    audioManager.playTrack("stage").catch(() => {});
    stageManager.beginIntroDialogue();
  }

  function continueRun() {
    gameState.scene = "playing";
    gameState.isPaused = false;
    bulletManager.clearEnemyBullets();
    itemManager.clearAll();
    player.reviveAtCheckpoint("half");
    ui.hideAllOverlayMenus();
  }

  function endGameToScoreBoard() {
    gameState.scene = "score";
    gameState.isPaused = true;
    ui.showScoreBoard(buildScoreResult(false));
  }

  function showGameClearBoard() {
    gameState.scene = "score";
    gameState.isPaused = true;
    bulletManager.clearEnemyBullets();
    itemManager.clearAll();
    bossController.active = false;
    audioManager.stopMusic();
    ui.showScoreBoard(buildScoreResult(true));
  }

  function backToMainMenu() {
    gameState.scene = "menu";
    gameState.isPaused = false;
    gameState.currentDifficulty = null;
    bulletManager.clearEnemyBullets();
    itemManager.clearAll();
    enemyManager.clearAll();
    bossController.reset();
    stageManager.reset();
    player.resetRunState();
    hud.reset(player);
    hud.setDifficulty(null);
    dialogueManager.hide();
    audioManager.stopMusic();
    ui.showStartMenu();
  }

  function buildScoreResult(isClear) {
    const difficultyText = getDifficultyLabel(gameState.currentDifficulty);
    const baseScore = player.score;
    const finalScore = isClear ? baseScore + getClearBonus() : baseScore;

    return {
      mode: isClear ? "Game Clear" : "Game Over",
      headline: isClear ? "Clear Result" : "Battle Result",
      difficulty: difficultyText,
      score: String(finalScore).padStart(7, "0"),
      graze: String(player.maxGraze).padStart(4, "0"),
      title: getTitleByScore(finalScore, isClear),
    };
  }

  function getDifficultyLabel(difficulty) {
    if (difficulty === "lunatic") {
      return "Lunatic";
    }
    if (difficulty === "hard") {
      return "Hard";
    }
    return "Easy";
  }

  function getClearBonus() {
    const lifeBonus = player.life * 100000;
    const difficultyBonus = gameState.currentDifficulty === "lunatic"
      ? 1000000
      : gameState.currentDifficulty === "hard"
        ? 200000
        : 0;
    return lifeBonus + difficultyBonus;
  }

  function getTitleByScore(score, isClear) {
    if (gameState.currentDifficulty === "lunatic" && isClear && player.life === player.maxLifeStock) {
      return "Living Myth";
    }
    if (score >= 1200000) {
      return "Ace Cowboy";
    }
    if (score >= 700000) {
      return "Danmaku Adept";
    }
    return "Beginner";
  }

  function update(deltaTime) {
    const audioAnalysis = audioManager.update(deltaTime);

    if (stageManager.state === "BOSS_ENTRY" && !gameState.bossMusicStarted && !dialogueManager.active) {
      gameState.bossMusicStarted = true;
      audioManager.playTrack("boss").catch(() => {});
    }

    if (gameState.scene !== "playing" || gameState.isPaused || dialogueManager.active || stageManager.pauseForDialogue) {
      return;
    }

    updateBackground(deltaTime);
    player.update(deltaTime);
    stageManager.update(deltaTime, player);
    bossController.update(deltaTime, player, audioAnalysis);
    bulletManager.update(deltaTime, player, enemyManager, bossController);
    itemManager.update(deltaTime, player);
    bombEffect.update(deltaTime, bulletManager);
    updateBodyCollisions();

    if (stageManager.state === "CLEAR") {
      itemManager.spawnBossRewardBurst(bossController.x || 300, bossController.y || 160, 30);
      showGameClearBoard();
      return;
    }

    if (player.life <= 0 && !player.isDying) {
      gameState.scene = "gameover";
      gameState.isPaused = true;
      ui.showGameOverMenu();
    }
  }

  function updateBodyCollisions() {
    const enemyPool = enemyManager.pool;
    for (let i = 0; i < enemyPool.count; i += 1) {
      const slot = enemyPool.activeIndices[i];
      const dx = enemyPool.x[slot] - player.x;
      const dy = enemyPool.y[slot] - player.y;
      const hitDistance = enemyPool.radius[slot] + player.bodyRadius;
      if (dx * dx + dy * dy <= hitDistance * hitDistance) {
        enemyManager.onEnemyDestroyed(slot);
        player.takeDamage();
        break;
      }
    }

    if (bossController.active && bossController.inBattle && !bossController.defeated) {
      const dx = bossController.x - player.x;
      const dy = bossController.y - player.y;
      const hitDistance = bossController.radius + player.bodyRadius;
      if (dx * dx + dy * dy <= hitDistance * hitDistance) {
        player.takeDamage();
      }
    }
  }

  function updateBackground(deltaTime) {
    gameState.backgroundScroll += 80 * deltaTime;
    if (gameState.backgroundScroll >= GAME_HEIGHT) {
      gameState.backgroundScroll -= GAME_HEIGHT;
    }
  }

  function render(now) {
    drawBackground(now);
    stageManager.renderWorld(ctx);
    itemManager.render(ctx);
    bulletManager.render(ctx);
    player.render(ctx);
    stageManager.renderUi(ctx);
    bombEffect.render(ctx);
  }

  function drawBackground() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const bgImage = assetLoader.get("bgLayer");
    if (bgImage) {
      drawScrollingBackground(bgImage);
      return;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, "#101a30");
    gradient.addColorStop(0.55, "#15122b");
    gradient.addColorStop(1, "#2a1018");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  function drawScrollingBackground(image) {
    const drawHeight = GAME_HEIGHT;
    const drawWidth = GAME_WIDTH;
    const offsetY = gameState.backgroundScroll;

    ctx.drawImage(image, 0, -offsetY, drawWidth, drawHeight);
    ctx.drawImage(image, 0, drawHeight - offsetY, drawWidth, drawHeight);
  }

  requestAnimationFrame(gameLoop);
})(window.XTouhouWeb);
