(function registerDialogueManager(global) {
  class DialogueManager {
    constructor() {
      this.overlay = document.getElementById("dialogueOverlay");
      this.panel = document.getElementById("dialoguePanel");
      this.nameEl = document.getElementById("dialogueName");
      this.textEl = document.getElementById("dialogueText");

      this.entries = [];
      this.index = 0;
      this.active = false;
      this.onFinish = null;

      this.panel.addEventListener("click", () => this.advance());
    }

    start(entries, onFinish) {
      this.entries = entries;
      this.index = 0;
      this.active = true;
      this.onFinish = onFinish;
      this.showCurrent();
      this.overlay.classList.remove("is-hidden");
    }

    advance() {
      if (!this.active) {
        return;
      }

      this.index += 1;
      if (this.index >= this.entries.length) {
        this.active = false;
        this.overlay.classList.add("is-hidden");
        if (this.onFinish) {
          const callback = this.onFinish;
          this.onFinish = null;
          callback();
        }
        return;
      }

      this.showCurrent();
    }

    hide() {
      this.active = false;
      this.overlay.classList.add("is-hidden");
      this.onFinish = null;
    }

    showCurrent() {
      const entry = this.entries[this.index];
      this.nameEl.textContent = entry.name;
      this.textEl.textContent = entry.text;
    }
  }

  global.DialogueManager = DialogueManager;
})(window.XTouhouWeb);
