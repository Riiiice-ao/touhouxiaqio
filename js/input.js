(function registerInputController(global) {
  /**
   * 输入控制器。
   * `keysDown` 用于持续按住的状态，
   * `keysPressed` 用于“这一帧刚刚按下”的边沿触发，适合 Bomb 这类一次性动作。
   */
  class InputController {
    constructor() {
      this.keysDown = new Set();
      this.keysPressed = new Set();

      window.addEventListener("keydown", (event) => {
        if (!this.keysDown.has(event.code)) {
          this.keysPressed.add(event.code);
        }

        this.keysDown.add(event.code);

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
          event.preventDefault();
        }
      });

      window.addEventListener("keyup", (event) => {
        this.keysDown.delete(event.code);
      });

      window.addEventListener("blur", () => {
        this.keysDown.clear();
        this.keysPressed.clear();
      });
    }

    /**
     * 持续按住判定。
     */
    isDown(code) {
      return this.keysDown.has(code);
    }

    /**
     * 单帧按下判定。
     * 适合 Bomb、菜单确认、切换武器等只希望触发一次的行为。
     */
    wasPressed(code) {
      return this.keysPressed.has(code);
    }

    /**
     * 每一帧结束时清空“刚按下”状态。
     */
    endFrame() {
      this.keysPressed.clear();
    }
  }

  global.InputController = InputController;
})(window.XTouhouWeb);
