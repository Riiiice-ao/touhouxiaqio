(function registerAudioManager(global) {
  class AudioManager {
    constructor() {
      this.audioContext = null;
      this.music = new Audio();
      this.music.loop = true;
      this.music.preload = "auto";
      this.sourceNode = null;
      this.analyser = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.frequencyData = null;
      this.analysis = {
        isBeat: false,
        musicFlow: 0,
      };
      this.lowAverage = 0;
      this.beatCooldown = 0;
      this.currentTrack = null;
    }

    async initialize() {
      if (this.audioContext) {
        return;
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.sourceNode = this.audioContext.createMediaElementSource(this.music);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.musicGain = this.audioContext.createGain();
      this.sfxGain = this.audioContext.createGain();
      this.musicGain.gain.value = 0.42;
      this.sfxGain.gain.value = 0.08;

      this.sourceNode.connect(this.musicGain);
      this.musicGain.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.sfxGain.connect(this.audioContext.destination);
    }

    async resume() {
      await this.initialize();
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
    }

    async playTrack(trackKey) {
      await this.resume();
      if (this.currentTrack === trackKey) {
        if (this.music.paused) {
          this.music.play().catch(() => {});
        }
        return;
      }

      const src = trackKey === "boss"
        ? global.Config.AUDIO_TRACK_BOSS
        : global.Config.AUDIO_TRACK_STAGE;

      this.currentTrack = trackKey;
      this.music.src = src;
      this.music.currentTime = 0;
      this.music.play().catch(() => {});
    }

    stopMusic() {
      this.music.pause();
      this.music.currentTime = 0;
      this.currentTrack = null;
    }

    update(deltaTime) {
      if (!this.analyser) {
        this.analysis.isBeat = false;
        this.analysis.musicFlow = 0;
        return this.analysis;
      }

      this.beatCooldown = Math.max(0, this.beatCooldown - deltaTime);
      this.analyser.getByteFrequencyData(this.frequencyData);

      let total = 0;
      let low = 0;
      const lowRange = 10;

      for (let i = 0; i < this.frequencyData.length; i += 1) {
        total += this.frequencyData[i];
        if (i < lowRange) {
          low += this.frequencyData[i];
        }
      }

      const average = total / this.frequencyData.length;
      const lowAverageInstant = low / lowRange;
      this.lowAverage = this.lowAverage * 0.88 + lowAverageInstant * 0.12;

      const isBeat = this.beatCooldown <= 0 && lowAverageInstant > this.lowAverage * 1.28 + 11;
      if (isBeat) {
        this.beatCooldown = 0.16;
      }

      this.analysis.isBeat = isBeat;
      this.analysis.musicFlow = Math.min(1, average / 140);
      return this.analysis;
    }

    playHitSfx() {
      this.playTone(830, 0.03, 0.04, "square");
    }

    playGrazeSfx() {
      this.playTone(1320, 0.028, 0.025, "triangle");
    }

    playTone(frequency, duration, volume, type) {
      if (!this.audioContext || this.audioContext.state !== "running") {
        return;
      }

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.audioContext.currentTime + duration);
    }
  }

  global.AudioManager = AudioManager;
})(window.XTouhouWeb);
