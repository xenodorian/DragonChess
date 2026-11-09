/* SFX: dependency-free, synthesised sound effects using the Web Audio API. */
var SFX = (function () {
  var ctx = null, master = null, muted = false;
  var VOICES = {};

  // Lazily creates the AudioContext (browsers only allow audio after a user gesture).
  function getCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
    return ctx;
  }

  // Fast attack, exponential decay to silence (never jumps to zero, so no clicks).
  function envelope(g, t0, peak, attack, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  // Oscillator note, optionally gliding from freq to freqEnd.
  function tone(type, freq, t0, dur, peak, freqEnd) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    envelope(g, t0, peak, 0.005, dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // Band-passed white noise, optionally sweeping from freq to freqEnd.
  function noise(type, freq, freqEnd, Q, t0, dur, peak, attack) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0), i;
    for (i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf;
    f.type = type;
    f.Q.value = Q;
    f.frequency.setValueAtTime(freq, t0);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    envelope(g, t0, peak, attack, dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // Wooden knock: short filtered noise burst plus a low falling sine thump.
  function knock(t0, amp, len) {
    noise('bandpass', 1000, null, 1.2, t0, 0.025, amp * 0.7, 0.002);
    tone('sine', 160, t0, len, amp * 0.6, 70);
  }

  // Sequence of notes spaced by `step`; the last note uses `lastDur`.
  function seq(type, freqs, step, dur, lastDur, peak) {
    return function (t) {
      for (var i = 0; i < freqs.length; i++) {
        tone(type, freqs[i], t + i * step, i === freqs.length - 1 ? lastDur : dur, peak);
      }
    };
  }

  VOICES.select = function (t) { tone('sine', 2000, t, 0.02, 0.03); };
  VOICES.move = function (t) { knock(t, 0.5, 0.09); };
  VOICES.capture = function (t) { knock(t, 0.7, 0.14); knock(t + 0.05, 0.9, 0.13); };
  VOICES.remote = function (t) { noise('bandpass', 2500, 400, 2, t, 0.35, 0.8, 0.02); };
  VOICES.freeze = function (t) {
    tone('sine', 2400, t, 0.3, 0.15, 2600);
    tone('sine', 2430, t, 0.3, 0.15, 2650);
  };
  VOICES.promote = seq('triangle', [523.25, 659.25, 783.99], 0.09, 0.12, 0.2, 0.4);
  VOICES.check = seq('triangle', [880, 932.33], 0.13, 0.12, 0.12, 0.45);
  VOICES.win = seq('triangle', [523.25, 659.25, 783.99, 1046.5], 0.15, 0.2, 0.45, 0.45);
  VOICES.lose = seq('triangle', [440, 349.23, 293.66], 0.22, 0.2, 0.4, 0.4);
  VOICES.draw = seq('sine', [440, 440], 0.2, 0.16, 0.16, 0.35);

  return {
    play: function (name) {
      if (muted || !VOICES.hasOwnProperty(name)) return;
      try {
        if (!getCtx()) return;
        if (ctx.state === 'suspended') {
          var p = ctx.resume();
          if (p && p.then) p.then(null, function () {});
        }
        VOICES[name](ctx.currentTime + 0.01);
      } catch (e) {
        /* Audio is optional: fail silently. */
      }
    },
    setMuted: function (m) { muted = !!m; },
    isMuted: function () { return muted; }
  };
})();
