(function registerHud(global) {
  /**
   * 简易 HUD 控制器。
   * 这里只负责同步界面文本，不参与任何游戏逻辑计算。
   */
  class Hud {
    constructor() {
      this.scoreValue = document.getElementById("scoreValue");
      this.grazeValue = document.getElementById("grazeValue");
      this.bombValue = document.getElementById("bombValue");
      this.lifeValue = document.getElementById("lifeValue");
    }

    setScore(score) {
      this.scoreValue.textContent = String(score).padStart(7, "0");
    }

    setGraze(graze) {
      this.grazeValue.textContent = String(graze).padStart(4, "0");
    }

    setBomb(bombs) {
      this.bombValue.textContent = String(bombs).padStart(2, "0");
    }

    setLife(life) {
      this.lifeValue.textContent = String(life).padStart(2, "0");
    }
  }

  global.Hud = Hud;
})(window.XTouhouWeb);
