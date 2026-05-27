(function registerHud(global) {
  class Hud {
    constructor() {
      this.scoreValue = document.getElementById("scoreValue");
      this.grazeValue = document.getElementById("grazeValue");
      this.bombValue = document.getElementById("bombValue");
      this.lifeValue = document.getElementById("lifeValue");
    }

    reset(player) {
      this.setScore(player.score);
      this.setGraze(player.graze);
      this.setBomb(player.bombStock);
      this.setLife(player.life);
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
