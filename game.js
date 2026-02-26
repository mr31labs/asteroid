// ============================================================
// ASTEROIDS: NEON VOID
// Classic asteroids with a modern gen-alpha twist
// ============================================================

(() => {
  "use strict";

  // ---- Canvas Setup ----
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  // ---- Constants ----
  const TAU = Math.PI * 2;
  const SHIP_SIZE = 18;
  const TURN_SPEED = 0.065;
  const THRUST_POWER = 0.12;
  const FRICTION = 0.992;
  const MAX_SPEED = 7;
  const BULLET_SPEED = 10;
  const BULLET_LIFE = 55;
  const FIRE_RATE = 8; // frames between shots
  const DASH_COOLDOWN = 90; // frames
  const DASH_SPEED = 18;
  const DASH_DURATION = 8;
  const INVULN_TIME = 120; // frames of invulnerability after respawn
  const COMBO_TIMEOUT = 90; // frames before combo resets
  const ASTEROID_SPEED_BASE = 1.2;

  // ---- Audio Engine (procedural) ----
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function playSound(type) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const g = audioCtx.createGain();
    g.connect(audioCtx.destination);

    switch (type) {
      case "shoot": {
        const o = audioCtx.createOscillator();
        o.type = "square";
        o.frequency.setValueAtTime(880, t);
        o.frequency.exponentialRampToValueAtTime(220, t + 0.1);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.1);
        break;
      }
      case "explode": {
        const bufferSize = audioCtx.sampleRate * 0.3;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        noise.connect(g);
        noise.start(t);
        break;
      }
      case "explode_big": {
        const bufferSize = audioCtx.sampleRate * 0.6;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.6);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        noise.connect(filter);
        filter.connect(g);
        noise.start(t);
        break;
      }
      case "powerup": {
        const o = audioCtx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(400, t);
        o.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.2);
        const o2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        g2.connect(audioCtx.destination);
        o2.type = "sine";
        o2.frequency.setValueAtTime(600, t + 0.1);
        o2.frequency.exponentialRampToValueAtTime(1600, t + 0.25);
        g2.gain.setValueAtTime(0.1, t + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o2.connect(g2);
        o2.start(t + 0.1);
        o2.stop(t + 0.3);
        break;
      }
      case "dash": {
        const o = audioCtx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(80, t + 0.15);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.15);
        break;
      }
      case "combo": {
        const o = audioCtx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(523, t);
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.15);
        break;
      }
      case "hit": {
        const o = audioCtx.createOscillator();
        o.type = "square";
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.3);
        break;
      }
      case "boss_warning": {
        for (let i = 0; i < 3; i++) {
          const o = audioCtx.createOscillator();
          const gi = audioCtx.createGain();
          gi.connect(audioCtx.destination);
          o.type = "square";
          o.frequency.setValueAtTime(200, t + i * 0.25);
          gi.gain.setValueAtTime(0.08, t + i * 0.25);
          gi.gain.exponentialRampToValueAtTime(0.001, t + i * 0.25 + 0.2);
          o.connect(gi);
          o.start(t + i * 0.25);
          o.stop(t + i * 0.25 + 0.2);
        }
        break;
      }
      case "wave": {
        for (let i = 0; i < 4; i++) {
          const o = audioCtx.createOscillator();
          const gi = audioCtx.createGain();
          gi.connect(audioCtx.destination);
          o.type = "sine";
          o.frequency.setValueAtTime(300 + i * 150, t + i * 0.08);
          gi.gain.setValueAtTime(0.06, t + i * 0.08);
          gi.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.15);
          o.connect(gi);
          o.start(t + i * 0.08);
          o.stop(t + i * 0.08 + 0.15);
        }
        break;
      }
    }
  }

  // Low rumble for thrust
  let thrustOsc = null;
  let thrustGain = null;

  function startThrustSound() {
    if (!audioCtx || thrustOsc) return;
    thrustOsc = audioCtx.createOscillator();
    thrustGain = audioCtx.createGain();
    thrustOsc.type = "sawtooth";
    thrustOsc.frequency.setValueAtTime(55, audioCtx.currentTime);
    thrustGain.gain.setValueAtTime(0, audioCtx.currentTime);
    thrustOsc.connect(thrustGain);
    thrustGain.connect(audioCtx.destination);
    thrustOsc.start();
  }

  function setThrustVolume(v) {
    if (thrustGain) {
      thrustGain.gain.setTargetAtTime(v, audioCtx.currentTime, 0.05);
    }
  }

  // ---- Input ----
  const keys = {};
  window.addEventListener("keydown", (e) => { keys[e.code] = true; e.preventDefault(); });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });

  // Mobile touch controls
  const touchState = { left: false, right: false, thrust: false, fire: false };
  function setupMobileBtn(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const start = (e) => { e.preventDefault(); touchState[key] = true; };
    const end = (e) => { e.preventDefault(); touchState[key] = false; };
    btn.addEventListener("touchstart", start, { passive: false });
    btn.addEventListener("touchend", end, { passive: false });
    btn.addEventListener("touchcancel", end, { passive: false });
  }
  setupMobileBtn("btn-left", "left");
  setupMobileBtn("btn-right", "right");
  setupMobileBtn("btn-thrust", "thrust");
  setupMobileBtn("btn-fire", "fire");

  function isDown(action) {
    switch (action) {
      case "left": return keys["ArrowLeft"] || keys["KeyA"] || touchState.left;
      case "right": return keys["ArrowRight"] || keys["KeyD"] || touchState.right;
      case "thrust": return keys["ArrowUp"] || keys["KeyW"] || touchState.thrust;
      case "fire": return keys["Space"] || touchState.fire;
      case "dash": return keys["ShiftLeft"] || keys["ShiftRight"];
    }
    return false;
  }

  // ---- Game State ----
  let state = "start"; // start, playing, gameover
  let score = 0;
  let highScore = parseInt(localStorage.getItem("neonvoid_high") || "0");
  let wave = 1;
  let lives = 3;
  let ship = null;
  let bullets = [];
  let asteroids = [];
  let particles = [];
  let floatingTexts = [];
  let powerups = [];
  let activePowerups = {};
  let screenShake = 0;
  let screenShakeDecay = 0.9;
  let comboCount = 0;
  let comboTimer = 0;
  let fireTimer = 0;
  let dashTimer = 0;
  let waveTransition = 0;
  let waveText = "";
  let frameCount = 0;
  let totalKills = 0;
  let maxCombo = 0;
  let bossActive = false;
  let boss = null;
  let starField = [];

  // ---- Stars background ----
  function initStars() {
    starField = [];
    for (let i = 0; i < 200; i++) {
      starField.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5 + 0.5,
        brightness: Math.random() * 0.5 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleOffset: Math.random() * TAU,
      });
    }
  }
  initStars();

  // ---- Utility ----
  function wrap(obj) {
    if (obj.x < -50) obj.x += canvas.width + 100;
    if (obj.x > canvas.width + 50) obj.x -= canvas.width + 100;
    if (obj.y < -50) obj.y += canvas.height + 100;
    if (obj.y > canvas.height + 50) obj.y -= canvas.height + 100;
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function rng(min, max) {
    return Math.random() * (max - min) + min;
  }

  function lerpColor(t) {
    // Cycle through neon colors
    const colors = [
      [0, 255, 255],   // cyan
      [255, 0, 255],   // magenta
      [255, 255, 0],   // yellow
      [0, 255, 128],   // green
    ];
    const idx = Math.floor(t) % colors.length;
    const next = (idx + 1) % colors.length;
    const f = t - Math.floor(t);
    const r = colors[idx][0] + (colors[next][0] - colors[idx][0]) * f;
    const g = colors[idx][1] + (colors[next][1] - colors[idx][1]) * f;
    const b = colors[idx][2] + (colors[next][2] - colors[idx][2]) * f;
    return `rgb(${r|0},${g|0},${b|0})`;
  }

  // ---- Ship ----
  function createShip() {
    return {
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: SHIP_SIZE,
      invuln: INVULN_TIME,
      dashing: 0,
      trail: [],
      alive: true,
    };
  }

  // ---- Asteroids ----
  function createAsteroid(x, y, size, speed) {
    const angle = Math.random() * TAU;
    const s = (speed || ASTEROID_SPEED_BASE) * (0.6 + Math.random() * 0.8);
    // Generate jagged shape
    const verts = [];
    const numVerts = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < numVerts; i++) {
      const a = (i / numVerts) * TAU;
      const r = size * (0.7 + Math.random() * 0.3);
      verts.push({ a, r });
    }
    return {
      x, y,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s,
      size,
      radius: size,
      rotation: 0,
      rotSpeed: rng(-0.02, 0.02),
      verts,
      hue: Math.random() * 360,
      glowIntensity: rng(0.3, 0.8),
    };
  }

  function spawnAsteroidEdge(size, speed) {
    let x, y;
    if (Math.random() < 0.5) {
      x = Math.random() < 0.5 ? -40 : canvas.width + 40;
      y = Math.random() * canvas.height;
    } else {
      x = Math.random() * canvas.width;
      y = Math.random() < 0.5 ? -40 : canvas.height + 40;
    }
    return createAsteroid(x, y, size, speed);
  }

  function splitAsteroid(ast) {
    const pieces = [];
    if (ast.size > 20) {
      const newSize = ast.size * 0.55;
      const speedMult = ASTEROID_SPEED_BASE + wave * 0.1;
      for (let i = 0; i < 2; i++) {
        pieces.push(createAsteroid(
          ast.x + rng(-10, 10),
          ast.y + rng(-10, 10),
          newSize,
          speedMult * 1.3
        ));
      }
    }
    return pieces;
  }

  // ---- Boss ----
  function createBoss() {
    return {
      x: canvas.width / 2,
      y: -100,
      targetY: 150,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: 60,
      hp: 15 + wave * 5,
      maxHp: 15 + wave * 5,
      phase: 0,
      phaseTimer: 0,
      shootTimer: 0,
      verts: generateBossShape(),
      entering: true,
      bullets: [],
      flashTimer: 0,
    };
  }

  function generateBossShape() {
    const verts = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const r = 60 * (0.8 + Math.random() * 0.3);
      verts.push({ a, r });
    }
    return verts;
  }

  // ---- Particles ----
  function spawnParticles(x, y, color, count, speed, life) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const spd = Math.random() * (speed || 3) + 0.5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: life || (30 + Math.random() * 30),
        maxLife: life || (30 + Math.random() * 30),
        color: color || "#0ff",
        size: rng(1, 3),
      });
    }
  }

  function spawnExplosion(x, y, size, hue) {
    const color1 = `hsl(${hue}, 100%, 70%)`;
    const color2 = `hsl(${hue + 40}, 100%, 50%)`;
    spawnParticles(x, y, color1, size * 0.8, size * 0.1, 40);
    spawnParticles(x, y, color2, size * 0.4, size * 0.05, 25);
    spawnParticles(x, y, "#fff", size * 0.2, size * 0.06, 15);
  }

  // ---- Floating Text ----
  function spawnFloatingText(x, y, text, color, size) {
    floatingTexts.push({
      x, y,
      text,
      color: color || "#fff",
      size: size || 16,
      life: 60,
      maxLife: 60,
      vy: -1.5,
    });
  }

  // ---- Power-ups ----
  const POWERUP_TYPES = [
    { id: "triple", icon: "III", color: "#0ff", desc: "TRIPLE SHOT", duration: 600 },
    { id: "shield", icon: "\u25CB", color: "#0f0", desc: "SHIELD", duration: 480 },
    { id: "rapid", icon: "\u26A1", color: "#ff0", desc: "RAPID FIRE", duration: 480 },
    { id: "nuke", icon: "\u2622", color: "#f55", desc: "NUKE", duration: 1 },
  ];

  function spawnPowerup(x, y) {
    if (Math.random() > 0.25) return; // 25% chance
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({
      x, y,
      type,
      radius: 14,
      life: 400,
      angle: 0,
      pulse: 0,
    });
  }

  function activatePowerup(type) {
    playSound("powerup");

    if (type.id === "nuke") {
      // Destroy all asteroids on screen
      asteroids.forEach((a) => {
        spawnExplosion(a.x, a.y, a.size, a.hue);
        score += 50;
        totalKills++;
      });
      asteroids = [];
      screenShake = 25;
      spawnFloatingText(canvas.width / 2, canvas.height / 2, "NUKE!", "#f55", 40);
      return;
    }

    activePowerups[type.id] = type.duration;
    updatePowerupBar();
  }

  function updatePowerupBar() {
    const bar = document.getElementById("powerup-bar");
    bar.innerHTML = "";
    for (const [id, remaining] of Object.entries(activePowerups)) {
      if (remaining <= 0) continue;
      const type = POWERUP_TYPES.find((t) => t.id === id);
      if (!type) continue;
      const slot = document.createElement("div");
      slot.className = "powerup-slot";
      slot.style.borderColor = type.color;
      slot.style.color = type.color;
      slot.style.textShadow = `0 0 8px ${type.color}`;
      slot.textContent = type.icon;

      const pct = remaining / type.duration;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "timer-ring");
      svg.setAttribute("viewBox", "0 0 50 50");
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "25");
      circle.setAttribute("cy", "25");
      circle.setAttribute("r", "22");
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke", type.color);
      circle.setAttribute("stroke-width", "2");
      circle.setAttribute("stroke-dasharray", `${pct * 138} 138`);
      circle.setAttribute("transform", "rotate(-90 25 25)");
      circle.setAttribute("opacity", "0.6");
      svg.appendChild(circle);
      slot.appendChild(svg);

      bar.appendChild(slot);
    }
  }

  // ---- Wave Management ----
  function startWave() {
    const numAsteroids = 3 + wave * 2;
    const speed = ASTEROID_SPEED_BASE + wave * 0.12;
    const sizes = [55, 45, 40];

    for (let i = 0; i < numAsteroids; i++) {
      const size = sizes[i % sizes.length];
      asteroids.push(spawnAsteroidEdge(size, speed));
    }

    // Boss every 5 waves
    if (wave % 5 === 0 && !bossActive) {
      bossActive = true;
      boss = createBoss();
      waveText = `WAVE ${wave} - BOSS INCOMING`;
      playSound("boss_warning");
    } else {
      waveText = `WAVE ${wave}`;
      playSound("wave");
    }

    waveTransition = 180;
    document.getElementById("wave-display").textContent = `WAVE ${wave}`;
  }

  // ---- Collision ----
  function circleCollision(a, b) {
    return dist(a, b) < a.radius + b.radius;
  }

  // ---- Fire bullets ----
  function fireBullet() {
    if (fireTimer > 0) return;
    fireTimer = activePowerups.rapid > 0 ? 4 : FIRE_RATE;

    playSound("shoot");

    const cos = Math.cos(ship.angle);
    const sin = Math.sin(ship.angle);
    const tipX = ship.x + cos * SHIP_SIZE;
    const tipY = ship.y + sin * SHIP_SIZE;

    const makeBullet = (angleOffset) => ({
      x: tipX,
      y: tipY,
      vx: Math.cos(ship.angle + angleOffset) * BULLET_SPEED + ship.vx * 0.3,
      vy: Math.sin(ship.angle + angleOffset) * BULLET_SPEED + ship.vy * 0.3,
      life: BULLET_LIFE,
      trail: [],
    });

    if (activePowerups.triple > 0) {
      bullets.push(makeBullet(-0.15));
      bullets.push(makeBullet(0));
      bullets.push(makeBullet(0.15));
    } else {
      bullets.push(makeBullet(0));
    }
  }

  // ---- Ship Death ----
  function killShip() {
    if (ship.invuln > 0 || ship.dashing > 0 || activePowerups.shield > 0) return;

    playSound("hit");
    spawnExplosion(ship.x, ship.y, 40, 180);
    screenShake = 15;
    lives--;
    ship.alive = false;

    if (lives <= 0) {
      state = "gameover";
      if (score > highScore) {
        highScore = score;
        localStorage.setItem("neonvoid_high", highScore.toString());
      }
      document.getElementById("final-score").textContent = score.toLocaleString();
      document.getElementById("final-stats").innerHTML =
        `WAVES SURVIVED: <em>${wave}</em><br>` +
        `KILLS: <em>${totalKills}</em><br>` +
        `MAX COMBO: <em>${maxCombo}x</em><br>` +
        `HIGH SCORE: <em>${highScore.toLocaleString()}</em>`;
      document.getElementById("game-over-screen").style.display = "flex";
    } else {
      setTimeout(() => {
        ship = createShip();
      }, 1000);
    }
  }

  // ---- Update Functions ----
  function updateShip() {
    if (!ship || !ship.alive) return;

    // Rotation
    if (isDown("left")) ship.angle -= TURN_SPEED;
    if (isDown("right")) ship.angle += TURN_SPEED;

    // Thrust
    const thrusting = isDown("thrust");
    if (thrusting) {
      ship.vx += Math.cos(ship.angle) * THRUST_POWER;
      ship.vy += Math.sin(ship.angle) * THRUST_POWER;
    }
    setThrustVolume(thrusting ? 0.04 : 0);

    // Speed cap
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > MAX_SPEED) {
      ship.vx = (ship.vx / speed) * MAX_SPEED;
      ship.vy = (ship.vy / speed) * MAX_SPEED;
    }

    // Friction
    ship.vx *= FRICTION;
    ship.vy *= FRICTION;

    // Dash
    if (isDown("dash") && dashTimer <= 0 && ship.dashing <= 0) {
      ship.dashing = DASH_DURATION;
      dashTimer = DASH_COOLDOWN;
      ship.vx = Math.cos(ship.angle) * DASH_SPEED;
      ship.vy = Math.sin(ship.angle) * DASH_SPEED;
      playSound("dash");
      spawnParticles(ship.x, ship.y, "#0ff", 15, 4, 20);
    }

    if (ship.dashing > 0) ship.dashing--;
    if (dashTimer > 0) dashTimer--;

    // Move
    ship.x += ship.vx;
    ship.y += ship.vy;
    wrap(ship);

    // Trail
    ship.trail.push({ x: ship.x, y: ship.y, life: 15 });
    if (ship.trail.length > 20) ship.trail.shift();

    // Invulnerability
    if (ship.invuln > 0) ship.invuln--;

    // Fire
    if (isDown("fire")) fireBullet();
    if (fireTimer > 0) fireTimer--;
  }

  function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 6) b.trail.shift();

      if (b.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }
      wrap(b);
    }
  }

  function updateAsteroids() {
    for (const a of asteroids) {
      a.x += a.vx;
      a.y += a.vy;
      a.rotation += a.rotSpeed;
      wrap(a);
    }
  }

  function updateBoss() {
    if (!boss) return;

    // Entering
    if (boss.entering) {
      boss.y += (boss.targetY - boss.y) * 0.02;
      if (Math.abs(boss.y - boss.targetY) < 2) boss.entering = false;
      return;
    }

    boss.angle += 0.008;
    boss.phaseTimer++;

    // Movement patterns
    const cx = canvas.width / 2;
    switch (boss.phase) {
      case 0: // Drift side to side
        boss.x = cx + Math.sin(boss.phaseTimer * 0.015) * (canvas.width * 0.3);
        if (boss.phaseTimer > 300) { boss.phase = 1; boss.phaseTimer = 0; }
        break;
      case 1: // Circle
        boss.x = cx + Math.cos(boss.phaseTimer * 0.02) * 200;
        boss.y = boss.targetY + Math.sin(boss.phaseTimer * 0.02) * 100;
        if (boss.phaseTimer > 400) { boss.phase = 0; boss.phaseTimer = 0; }
        break;
    }

    // Shooting
    boss.shootTimer++;
    if (boss.shootTimer > 30) {
      boss.shootTimer = 0;
      if (ship && ship.alive) {
        const angle = Math.atan2(ship.y - boss.y, ship.x - boss.x);
        boss.bullets.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(angle) * 4,
          vy: Math.sin(angle) * 4,
          life: 120,
          radius: 5,
        });
      }
    }

    // Update boss bullets
    for (let i = boss.bullets.length - 1; i >= 0; i--) {
      const b = boss.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      if (b.life <= 0 || b.x < -50 || b.x > canvas.width + 50 || b.y < -50 || b.y > canvas.height + 50) {
        boss.bullets.splice(i, 1);
      }
    }

    if (boss.flashTimer > 0) boss.flashTimer--;
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const t = floatingTexts[i];
      t.y += t.vy;
      t.life--;
      if (t.life <= 0) floatingTexts.splice(i, 1);
    }
  }

  function updatePowerups() {
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.life--;
      p.angle += 0.03;
      p.pulse += 0.08;
      if (p.life <= 0) {
        powerups.splice(i, 1);
        continue;
      }
      // Collect
      if (ship && ship.alive && dist(ship, p) < ship.radius + p.radius + 5) {
        activatePowerup(p.type);
        spawnFloatingText(p.x, p.y - 20, p.type.desc, p.type.color, 18);
        powerups.splice(i, 1);
      }
    }

    // Tick active powerups
    for (const id of Object.keys(activePowerups)) {
      activePowerups[id]--;
      if (activePowerups[id] <= 0) delete activePowerups[id];
    }
    if (frameCount % 10 === 0) updatePowerupBar();
  }

  function checkCollisions() {
    if (!ship || !ship.alive) return;

    // Bullets vs Asteroids
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      for (let ai = asteroids.length - 1; ai >= 0; ai--) {
        const a = asteroids[ai];
        if (dist(b, a) < a.radius) {
          // Hit!
          bullets.splice(bi, 1);
          const newPieces = splitAsteroid(a);
          spawnExplosion(a.x, a.y, a.size, a.hue);
          spawnPowerup(a.x, a.y);

          // Scoring with combo
          comboCount++;
          comboTimer = COMBO_TIMEOUT;
          const comboMult = Math.min(comboCount, 10);
          const baseScore = a.size > 40 ? 20 : a.size > 25 ? 50 : 100;
          const earned = baseScore * comboMult;
          score += earned;
          totalKills++;
          if (comboCount > maxCombo) maxCombo = comboCount;

          if (comboCount > 1) {
            playSound("combo");
            spawnFloatingText(a.x, a.y - 20, `${comboMult}x ${earned}`, lerpColor(comboCount * 0.3), 14 + comboCount);
          } else {
            spawnFloatingText(a.x, a.y - 20, `+${earned}`, "#fff", 14);
          }

          playSound("explode");
          screenShake = Math.min(screenShake + 3, 12);

          asteroids.splice(ai, 1);
          asteroids.push(...newPieces);
          break;
        }
      }
    }

    // Bullets vs Boss
    if (boss && !boss.entering) {
      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];
        if (dist(b, boss) < boss.radius) {
          bullets.splice(bi, 1);
          boss.hp--;
          boss.flashTimer = 6;
          screenShake = Math.min(screenShake + 2, 10);
          spawnParticles(b.x, b.y, "#f0f", 5, 3, 15);

          if (boss.hp <= 0) {
            // Boss defeated!
            playSound("explode_big");
            spawnExplosion(boss.x, boss.y, 100, 300);
            screenShake = 30;
            const bossScore = 1000 + wave * 200;
            score += bossScore;
            spawnFloatingText(boss.x, boss.y, `BOSS +${bossScore}`, "#f0f", 32);
            boss.bullets = [];
            boss = null;
            bossActive = false;
            break;
          }
        }
      }
    }

    // Boss bullets vs Ship
    if (boss) {
      for (let i = boss.bullets.length - 1; i >= 0; i--) {
        const b = boss.bullets[i];
        if (dist(b, ship) < ship.radius + b.radius) {
          boss.bullets.splice(i, 1);
          killShip();
          break;
        }
      }
    }

    // Ship vs Asteroids
    for (const a of asteroids) {
      if (circleCollision(ship, a)) {
        killShip();
        break;
      }
    }

    // Ship vs Boss
    if (boss && !boss.entering && circleCollision(ship, boss)) {
      killShip();
    }

    // Combo timer
    if (comboTimer > 0) {
      comboTimer--;
      if (comboTimer <= 0) comboCount = 0;
    }

    // Check wave clear
    if (asteroids.length === 0 && !bossActive) {
      wave++;
      startWave();
    }
  }

  // ---- Drawing ----
  function drawStars() {
    for (const s of starField) {
      const twinkle = Math.sin(frameCount * s.twinkleSpeed + s.twinkleOffset) * 0.3 + 0.7;
      const alpha = s.brightness * twinkle;
      ctx.fillStyle = `rgba(200,210,255,${alpha})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(0,255,255,0.03)";
    ctx.lineWidth = 1;
    const gridSize = 80;
    const offsetX = (frameCount * 0.3) % gridSize;
    const offsetY = (frameCount * 0.2) % gridSize;
    for (let x = -gridSize + offsetX; x < canvas.width + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = -gridSize + offsetY; y < canvas.height + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  function drawShip() {
    if (!ship || !ship.alive) return;

    // Invulnerability blink
    if (ship.invuln > 0 && Math.floor(ship.invuln / 4) % 2) return;

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    // Engine trail
    if (isDown("thrust")) {
      const flicker = Math.random() * 8 + 8;
      ctx.beginPath();
      ctx.moveTo(-SHIP_SIZE * 0.6, -SHIP_SIZE * 0.35);
      ctx.lineTo(-SHIP_SIZE - flicker, 0);
      ctx.lineTo(-SHIP_SIZE * 0.6, SHIP_SIZE * 0.35);
      ctx.closePath();
      const thrustGrad = ctx.createLinearGradient(-SHIP_SIZE * 0.6, 0, -SHIP_SIZE - flicker, 0);
      thrustGrad.addColorStop(0, "rgba(0,255,255,0.8)");
      thrustGrad.addColorStop(0.5, "rgba(255,0,255,0.4)");
      thrustGrad.addColorStop(1, "rgba(255,0,255,0)");
      ctx.fillStyle = thrustGrad;
      ctx.fill();
    }

    // Dash trail
    if (ship.dashing > 0) {
      ctx.shadowColor = "#0ff";
      ctx.shadowBlur = 30;
    }

    // Ship body - classic triangle
    ctx.beginPath();
    ctx.moveTo(SHIP_SIZE, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
    ctx.lineTo(-SHIP_SIZE * 0.4, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
    ctx.closePath();

    ctx.strokeStyle = "#0ff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#0ff";
    ctx.shadowBlur = 15;
    ctx.stroke();

    // Inner glow line
    ctx.beginPath();
    ctx.moveTo(SHIP_SIZE * 0.7, 0);
    ctx.lineTo(-SHIP_SIZE * 0.4, -SHIP_SIZE * 0.3);
    ctx.moveTo(SHIP_SIZE * 0.7, 0);
    ctx.lineTo(-SHIP_SIZE * 0.4, SHIP_SIZE * 0.3);
    ctx.strokeStyle = "rgba(0,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Shield
    if (activePowerups.shield > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, SHIP_SIZE + 8, 0, TAU);
      ctx.strokeStyle = `rgba(0,255,100,${0.3 + Math.sin(frameCount * 0.1) * 0.15})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = "#0f0";
      ctx.shadowBlur = 15;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawBullets() {
    for (const b of bullets) {
      // Trail
      ctx.beginPath();
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i];
        if (i === 0) ctx.moveTo(t.x, t.y);
        else ctx.lineTo(t.x, t.y);
      }
      ctx.strokeStyle = "rgba(0,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Bullet glow
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.5, 0, TAU);
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#0ff";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawAsteroids() {
    for (const a of asteroids) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotation);

      const hslColor = `hsl(${a.hue}, 60%, 55%)`;
      const hslGlow = `hsl(${a.hue}, 80%, 40%)`;

      ctx.beginPath();
      for (let i = 0; i < a.verts.length; i++) {
        const v = a.verts[i];
        const x = Math.cos(v.a) * v.r;
        const y = Math.sin(v.a) * v.r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      ctx.strokeStyle = hslColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = hslGlow;
      ctx.shadowBlur = 10 * a.glowIntensity;
      ctx.stroke();

      // Inner lines for texture
      ctx.beginPath();
      for (let i = 0; i < a.verts.length; i += 2) {
        const v = a.verts[i];
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(v.a) * v.r * 0.6, Math.sin(v.a) * v.r * 0.6);
      }
      ctx.strokeStyle = `hsla(${a.hue}, 40%, 40%, 0.2)`;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.stroke();

      ctx.restore();
    }
  }

  function drawBoss() {
    if (!boss) return;

    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(boss.angle);

    // Body
    ctx.beginPath();
    for (let i = 0; i < boss.verts.length; i++) {
      const v = boss.verts[i];
      const x = Math.cos(v.a) * v.r;
      const y = Math.sin(v.a) * v.r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const bossColor = boss.flashTimer > 0 ? "#fff" : "#f0f";
    ctx.strokeStyle = bossColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = "#f0f";
    ctx.shadowBlur = 20;
    ctx.stroke();

    // Eye
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    ctx.fillStyle = boss.flashTimer > 0 ? "#fff" : "rgba(255,0,100,0.8)";
    ctx.shadowColor = "#f00";
    ctx.shadowBlur = 20;
    ctx.fill();

    ctx.restore();

    // Health bar
    const barW = 120;
    const barH = 6;
    const barX = boss.x - barW / 2;
    const barY = boss.y + boss.radius + 15;
    const hpPct = boss.hp / boss.maxHp;

    ctx.fillStyle = "rgba(255,0,0,0.2)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = hpPct > 0.3 ? "#f0f" : "#f00";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fillRect(barX, barY, barW * hpPct, barH);
    ctx.shadowBlur = 0;

    // Boss bullets
    for (const b of boss.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, TAU);
      ctx.fillStyle = "#f0f";
      ctx.shadowColor = "#f0f";
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatingTexts() {
    for (const t of floatingTexts) {
      const alpha = t.life / t.maxLife;
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${t.size}px 'Orbitron', sans-serif`;
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 10;
      ctx.textAlign = "center";
      ctx.fillText(t.text, t.x, t.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function drawPowerups() {
    for (const p of powerups) {
      const pulse = 1 + Math.sin(p.pulse) * 0.15;
      const alpha = p.life < 60 ? (p.life / 60) * (Math.floor(p.life / 5) % 2 ? 1 : 0.3) : 1;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = alpha;

      // Outer ring
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * pulse, 0, TAU);
      ctx.strokeStyle = p.type.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = p.type.color;
      ctx.shadowBlur = 15;
      ctx.stroke();

      // Icon
      ctx.font = "bold 12px 'Orbitron', sans-serif";
      ctx.fillStyle = p.type.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.type.icon, 0, 0);

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawWaveTransition() {
    if (waveTransition <= 0) return;

    const alpha = Math.min(waveTransition / 60, 1) * (waveTransition > 120 ? (180 - waveTransition) / 60 : 1);
    ctx.globalAlpha = Math.min(alpha, 1);
    ctx.font = "bold 48px 'Orbitron', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#0ff";
    ctx.shadowBlur = 30;
    ctx.textAlign = "center";
    ctx.fillText(waveText, canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    waveTransition--;
  }

  function drawHUD() {
    const scoreEl = document.getElementById("score-display");
    scoreEl.textContent = score.toLocaleString();

    const comboEl = document.getElementById("combo-display");
    if (comboCount > 1) {
      comboEl.textContent = `${Math.min(comboCount, 10)}x COMBO`;
      comboEl.classList.add("active");
      comboEl.style.color = lerpColor(comboCount * 0.3);
      comboEl.style.textShadow = `0 0 10px ${lerpColor(comboCount * 0.3)}`;
    } else {
      comboEl.classList.remove("active");
    }

    // Lives
    const livesEl = document.getElementById("lives-display");
    livesEl.textContent = "\u25B2 ".repeat(lives).trim();

    // Dash cooldown indicator on ship
    if (ship && ship.alive && dashTimer > 0) {
      const pct = 1 - dashTimer / DASH_COOLDOWN;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, SHIP_SIZE + 14, -Math.PI / 2, -Math.PI / 2 + pct * TAU);
      ctx.strokeStyle = `rgba(0,255,255,${0.2 + pct * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // Scanline + vignette post-processing
  function drawPostFX() {
    // Scanlines
    ctx.fillStyle = "rgba(0,0,0,0.04)";
    for (let y = 0; y < canvas.height; y += 3) {
      ctx.fillRect(0, y, canvas.width, 1);
    }

    // Vignette
    const grad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
      canvas.width / 2, canvas.height / 2, canvas.height * 0.9
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ---- Main Game Loop ----
  function update() {
    if (state !== "playing") return;

    frameCount++;
    updateShip();
    updateBullets();
    updateAsteroids();
    updateBoss();
    updateParticles();
    updateFloatingTexts();
    updatePowerups();
    checkCollisions();

    // Screen shake decay
    if (screenShake > 0) screenShake *= screenShakeDecay;
    if (screenShake < 0.5) screenShake = 0;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Apply screen shake
    if (screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * screenShake * 2,
        (Math.random() - 0.5) * screenShake * 2
      );
    }

    drawStars();
    drawGrid();

    if (state === "playing" || state === "gameover") {
      drawAsteroids();
      drawPowerups();
      drawBullets();
      drawShip();
      drawBoss();
      drawParticles();
      drawFloatingTexts();
      drawWaveTransition();
      drawHUD();
    }

    ctx.restore();

    drawPostFX();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // ---- Game Start / Restart ----
  function startGame() {
    ensureAudio();
    startThrustSound();

    state = "playing";
    score = 0;
    wave = 1;
    lives = 3;
    ship = createShip();
    bullets = [];
    asteroids = [];
    particles = [];
    floatingTexts = [];
    powerups = [];
    activePowerups = {};
    screenShake = 0;
    comboCount = 0;
    comboTimer = 0;
    fireTimer = 0;
    dashTimer = 0;
    waveTransition = 0;
    frameCount = 0;
    totalKills = 0;
    maxCombo = 0;
    bossActive = false;
    boss = null;

    document.getElementById("start-screen").style.display = "none";
    document.getElementById("game-over-screen").style.display = "none";
    document.getElementById("powerup-bar").innerHTML = "";

    initStars();
    startWave();
  }

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("restart-btn").addEventListener("click", startGame);

  // Also allow Enter/Space to start
  window.addEventListener("keydown", (e) => {
    if ((e.code === "Enter" || e.code === "Space") && state !== "playing") {
      e.preventDefault();
      startGame();
    }
  });

  // ---- Start render loop ----
  loop();
})();
