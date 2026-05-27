(function bootGame(global) {
  const { GAME_HEIGHT, GAME_WIDTH } = global.Config;
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;

  const input = new global.InputController();
  const hud = new global.Hud();
  const ui = new global.UiManager();
  const bulletManager = new global.BulletManager();
  const bombEffect = new global.BombEffect();
  const emitter = new global.Emitter(bulletManager);
  const enemyManager = new global.EnemyManager(emitter);
  const bossController = new global.BossController(emitter, bulletManager, bombEffect);
  const stageManager = new global.StageManager(enemyManager, bossController, bulletManager);
  const player = new global.Player(input, bulletManager, hud, bombEffect);

  const gameState = {
    currentDifficulty: null,
    scene: "menu",
    isPaused: false,
  };

  hud.reset(player);

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

  let lastTime = performance.now();

  function gameLoop(now) {
    const deltaTime = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    update(deltaTime);
    render(now);

    input.endFrame();
    requestAnimationFrame(gameLoop);
  }

  function startGame(difficulty) {
    gameState.currentDifficulty = difficulty;
    gameState.scene = "playing";
    gameState.isPaused = false;
    ui.hideAllOverlayMenus();
    resetRunState();
  }

  function resetRunState() {
    bulletManager.clearEnemyBullets();
    enemyManager.clearAll();
    bossController.reset();
    stageManager.setDifficulty(gameState.currentDifficulty ?? "easy");
    stageManager.reset();
    player.resetRunState();
    hud.reset(player);
  }

  function openPauseMenu() {
    if (gameState.scene !== "playing" || gameState.isPaused) {
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
  }

  function continueRun() {
    gameState.scene = "playing";
    gameState.isPaused = false;
    bulletManager.clearEnemyBullets();
    player.reviveAtCheckpoint("half");
    ui.hideAllOverlayMenus();
  }

  function endGameToScoreBoard() {
    gameState.scene = "score";
    gameState.isPaused = true;
    ui.showScoreBoard(buildScoreResult());
  }

  function backToMainMenu() {
    gameState.scene = "menu";
    gameState.isPaused = false;
    gameState.currentDifficulty = null;
    bulletManager.clearEnemyBullets();
    enemyManager.clearAll();
    bossController.reset();
    stageManager.reset();
    player.resetRunState();
    ui.showStartMenu();
  }

  function buildScoreResult() {
    return {
      difficulty: gameState.currentDifficulty === "hard" ? "Hard" : "Easy",
      score: String(player.score).padStart(7, "0"),
      graze: String(player.maxGraze).padStart(4, "0"),
      title: getTitleByScore(player.score),
    };
  }

  function getTitleByScore(score) {
    if (score >= 1000000) {
      return "Shrine Maiden";
    }
    if (score >= 500000) {
      return "Scarlet Hunter";
    }
    if (score >= 100000) {
      return "Danmaku Adept";
    }
    return "Beginner";
  }

  function update(deltaTime) {
    if (gameState.scene !== "playing" || gameState.isPaused) {
      return;
    }

    player.update(deltaTime);
    stageManager.update(deltaTime, player);
    bulletManager.update(deltaTime, player, enemyManager, bossController);
    bombEffect.update(deltaTime, bulletManager);

    if (player.life <= 0 && !player.isDying) {
      gameState.scene = "gameover";
      gameState.isPaused = true;
      ui.showGameOverMenu();
    }
  }

  function render(now) {
    drawBackground(now);
    stageManager.renderWorld(ctx);
    bulletManager.render(ctx);
    player.render(ctx);
    stageManager.renderUi(ctx);
    bombEffect.render(ctx);
  }

  function drawBackground(now) {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, "#101a30");
    gradient.addColorStop(0.55, "#15122b");
    gradient.addColorStop(1, "#2a1018");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    const scroll = (now * 0.08) % 40;

    for (let y = -40; y < GAME_HEIGHT + 40; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y + scroll);
      ctx.lineTo(GAME_WIDTH, y + scroll);
      ctx.stroke();
    }

    ctx.restore();
  }

  requestAnimationFrame(gameLoop);
})(window.XTouhouWeb);
