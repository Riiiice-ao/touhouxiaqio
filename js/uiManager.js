(function registerUiManager(global) {
  class UiManager {
    constructor() {
      this.startMenu = document.getElementById("startMenu");
      this.pauseMenu = document.getElementById("pauseMenu");
      this.gameOverMenu = document.getElementById("gameOverMenu");
      this.scoreBoard = document.getElementById("scoreBoard");

      this.easyButton = document.getElementById("easyButton");
      this.hardButton = document.getElementById("hardButton");
      this.lunaticButton = document.getElementById("lunaticButton");
      this.pauseButton = document.getElementById("pauseButton");
      this.resumeButton = document.getElementById("resumeButton");
      this.restartButton = document.getElementById("restartButton");
      this.continueButton = document.getElementById("continueButton");
      this.endGameButton = document.getElementById("endGameButton");
      this.backToMenuButton = document.getElementById("backToMenuButton");
      this.loadingText = document.getElementById("loadingText");

      this.resultEyebrow = document.getElementById("resultEyebrow");
      this.resultHeadline = document.getElementById("resultHeadline");
      this.resultDifficulty = document.getElementById("resultDifficulty");
      this.resultScore = document.getElementById("resultScore");
      this.resultGraze = document.getElementById("resultGraze");
      this.resultTitle = document.getElementById("resultTitle");
    }

    bind(actions) {
      this.easyButton.addEventListener("click", () => actions.onSelectDifficulty("easy"));
      this.hardButton.addEventListener("click", () => actions.onSelectDifficulty("hard"));
      this.lunaticButton.addEventListener("click", () => actions.onSelectDifficulty("lunatic"));
      this.pauseButton.addEventListener("click", actions.onPauseMenu);
      this.resumeButton.addEventListener("click", actions.onResume);
      this.restartButton.addEventListener("click", actions.onRestartConfirmed);
      this.continueButton.addEventListener("click", actions.onContinue);
      this.endGameButton.addEventListener("click", actions.onEndGame);
      this.backToMenuButton.addEventListener("click", actions.onBackToMenu);
    }

    setLoadingState(loadedCount, totalCount) {
      const done = loadedCount >= totalCount;
      this.loadingText.textContent = done
        ? "Assets ready. Choose a difficulty to start."
        : `Loading assets ${loadedCount}/${totalCount} ...`;

      [this.easyButton, this.hardButton, this.lunaticButton].forEach((button) => {
        button.disabled = !done;
        button.classList.toggle("is-disabled", !done);
      });
    }

    showStartMenu() {
      this.show(this.startMenu);
      this.hide(this.pauseMenu);
      this.hide(this.gameOverMenu);
      this.hide(this.scoreBoard);
    }

    showPauseMenu() {
      this.hide(this.startMenu);
      this.show(this.pauseMenu);
      this.hide(this.gameOverMenu);
      this.hide(this.scoreBoard);
    }

    showGameOverMenu() {
      this.hide(this.startMenu);
      this.hide(this.pauseMenu);
      this.show(this.gameOverMenu);
      this.hide(this.scoreBoard);
    }

    showScoreBoard(result) {
      this.hide(this.startMenu);
      this.hide(this.pauseMenu);
      this.hide(this.gameOverMenu);
      this.show(this.scoreBoard);
      this.resultEyebrow.textContent = result.mode;
      this.resultHeadline.textContent = result.headline;
      this.resultDifficulty.textContent = result.difficulty;
      this.resultScore.textContent = result.score;
      this.resultGraze.textContent = result.graze;
      this.resultTitle.textContent = result.title;
    }

    hideAllOverlayMenus() {
      this.hide(this.startMenu);
      this.hide(this.pauseMenu);
      this.hide(this.gameOverMenu);
      this.hide(this.scoreBoard);
    }

    show(element) {
      element.classList.remove("is-hidden");
    }

    hide(element) {
      element.classList.add("is-hidden");
    }
  }

  global.UiManager = UiManager;
})(window.XTouhouWeb);
