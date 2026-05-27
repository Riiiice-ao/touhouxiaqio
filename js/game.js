(function bootGame(global) {
  const { GAME_HEIGHT, GAME_WIDTH } = global.Config;
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;

  const input = new global.InputController();
  const hud = new global.Hud();
  const bulletManager = new global.BulletManager();
  const bombEffect = new global.BombEffect();
  const emitter = new global.Emitter(bulletManager);
  const enemyManager = new global.EnemyManager(emitter);
  const bossController = new global.BossController(emitter, bulletManager, bombEffect);
  const stageManager = new global.StageManager(enemyManager, bossController, bulletManager);
  const player = new global.Player(input, bulletManager, hud, bombEffect);

  hud.setScore(0);
  hud.setGraze(0);
  hud.setBomb(player.bombStock);
  hud.setLife(player.life);

  let lastTime = performance.now();

  /**
   * 基于 requestAnimationFrame 的主循环。
   * deltaTime 以秒为单位，并做一个上限钳制，避免切回页面时瞬移过大。
   */
  function gameLoop(now) {
    const deltaTime = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    update(deltaTime);
    render(now);

    // 这一帧逻辑全部结束后，再清掉“刚按下”的输入状态。
    input.endFrame();
    requestAnimationFrame(gameLoop);
  }

  function update(deltaTime) {
    player.update(deltaTime);
    stageManager.update(deltaTime, player);
    bulletManager.update(deltaTime, player, enemyManager, bossController);
    bombEffect.update(deltaTime, bulletManager);
  }

  function render(now) {
    drawBackground(now);
    stageManager.renderWorld(ctx);
    bulletManager.render(ctx);
    player.render(ctx);
    stageManager.renderUi(ctx);
    bombEffect.render(ctx);
  }

  /**
   * 简单的纵向卷轴背景。
   * 这里只用渐变和线条做占位，后续可以直接替换成贴图滚动背景。
   */
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
