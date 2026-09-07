const NOTE_OFFSETS = {
  C: -9,
  "C#": -8,
  D: -7,
  "D#": -6,
  E: -5,
  F: -4,
  "F#": -3,
  G: -2,
  "G#": -1,
  A: 0,
  "A#": 1,
  B: 2
};

export function createGameAudio(config) {
  let context = null;
  let master = null;
  let musicTimer = null;
  let musicStep = 0;
  let enabled = config.enabledByDefault !== false;

  function ensureContext() {
    if (context) return context;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = config.masterVolume ?? 0.25;
    master.connect(context.destination);
    return context;
  }

  async function unlock() {
    const ctx = ensureContext();
    if (ctx.state !== "running") {
      await ctx.resume();
    }
    if (enabled) startMusic();
  }

  function setEnabled(value) {
    enabled = value;
    if (!context) return;
    if (enabled) {
      master.gain.setTargetAtTime(config.masterVolume ?? 0.25, context.currentTime, 0.03);
      startMusic();
    } else {
      master.gain.setTargetAtTime(0, context.currentTime, 0.03);
      stopMusic();
    }
  }

  function isEnabled() {
    return enabled;
  }

  function play(name) {
    if (!enabled) return;
    const sfx = config.sfx?.[name];
    if (!sfx) return;
    const ctx = ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = sfx.wave || "square";
    osc.frequency.setValueAtTime(sfx.start, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, sfx.end), now + sfx.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(sfx.volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + sfx.duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + sfx.duration + 0.02);
  }

  function startMusic() {
    if (!enabled || musicTimer || !context || context.state !== "running") return;
    const tempo = config.music?.tempo || 100;
    const stepMs = (60000 / tempo) / 2;
    musicTimer = window.setInterval(playMusicStep, stepMs);
    playMusicStep();
  }

  function stopMusic() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function playMusicStep() {
    if (!enabled || !context) return;
    const music = config.music;
    const note = music.sequence[musicStep % music.sequence.length];
    const bass = music.bass[Math.floor(musicStep / 2) % music.bass.length];
    const now = context.currentTime;
    playNote(note, now, 0.16, 0.055, music.wave || "square");
    if (musicStep % 2 === 0) {
      playNote(bass, now, 0.32, 0.04, "triangle");
    }
    musicStep += 1;
  }

  function playNote(note, time, duration, volume, wave) {
    const frequency = noteToFrequency(note);
    if (!frequency) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = wave;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  return { unlock, play, setEnabled, isEnabled };
}

function noteToFrequency(note) {
  if (!note || note === "rest") return 0;
  const match = /^([A-G]#?)(-?\d)$/.exec(note);
  if (!match) return 0;
  const semitones = NOTE_OFFSETS[match[1]] + (Number(match[2]) - 4) * 12;
  return 440 * 2 ** (semitones / 12);
}
