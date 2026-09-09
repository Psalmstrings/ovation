/* ==========================================================================
   OVATION MUSIC HOUSE — ANIMATIONS, MUSICAL SOUNDWAVE & PIANO ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initScrollObserver();
  initStatsCounter();
  initHeroCanvas();
  initSoundwaveCanvas();
  initFloatingNotes();
  initPianoWidget();
});

/* ----- 1. SCROLL OBSERVER FOR REVEAL ANIMATIONS ----- */
function initScrollObserver() {
  const revealElements = document.querySelectorAll('.reveal-fade-up, .reveal-slide-left, .reveal-slide-right, .reveal-scale');
  
  if (!('IntersectionObserver' in window)) {
    revealElements.forEach(el => el.classList.add('active'));
    return;
  }

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -80px 0px',
    threshold: 0.12
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  revealElements.forEach(el => observer.observe(el));
}

/* ----- 2. ANIMATED STATISTICS COUNTER ----- */
function initStatsCounter() {
  const statsSection = document.querySelector('.stats-grid');
  if (!statsSection) return;

  let animated = false;

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !animated) {
      animated = true;
      const counters = document.querySelectorAll('.stat-number');
      counters.forEach(counter => {
        const targetVal = counter.getAttribute('data-target');
        if (!targetVal || isNaN(parseInt(targetVal))) return;

        const target = parseInt(targetVal);
        let count = 0;
        const duration = 2000;
        const stepTime = 30;
        const increment = target / (duration / stepTime);

        const timer = setInterval(() => {
          count += increment;
          if (count >= target) {
            counter.innerText = target + (counter.getAttribute('data-suffix') || '');
            clearInterval(timer);
          } else {
            counter.innerText = Math.floor(count) + (counter.getAttribute('data-suffix') || '');
          }
        }, stepTime);
      });
    }
  }, { threshold: 0.4 });

  observer.observe(statsSection);
}

/* ----- 3. HERO CANVAS BACKGROUND DYNAMIC PARTICLES ----- */
function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  const particleCount = 50;

  function resize() {
    if (!canvas.parentElement) return;
    width = canvas.width = canvas.parentElement.offsetWidth;
    height = canvas.height = canvas.parentElement.offsetHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.radius = Math.random() * 2.5 + 1;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.alpha = Math.random() * 0.5 + 0.2;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
        this.reset();
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212, 175, 55, ${this.alpha})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#D4AF37';
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Glowing sine soundwave line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.18)';
    ctx.lineWidth = 2;
    const time = Date.now() * 0.0015;
    for (let x = 0; x < width; x += 8) {
      const y = Math.sin(x * 0.004 + time) * 35 + Math.cos(x * 0.008 + time * 0.8) * 15 + height * 0.5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    particles.forEach(p => {
      p.update();
      p.draw();
    });

    requestAnimationFrame(animate);
  }

  animate();
}

/* ----- 4. SECTION SOUNDWAVE / EQUALIZER ENGINE ----- */
function initSoundwaveCanvas() {
  const canvas = document.getElementById('soundwaveCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let isPlaying = true;
  let step = 0;

  function resize() {
    if (!canvas.parentElement) return;
    width = canvas.width = canvas.parentElement.offsetWidth;
    height = canvas.height = canvas.parentElement.offsetHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  const playBtn = document.getElementById('toggleSoundwaveBtn');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      playBtn.innerHTML = isPlaying 
        ? '<span>⏸</span> Pause Audio Spectrum' 
        : '<span>▶</span> Play Audio Spectrum';
    });
  }

  function drawWave() {
    ctx.clearRect(0, 0, width, height);

    const bars = Math.floor(width / 14);
    const barWidth = 6;
    const gap = (width - (bars * barWidth)) / (bars + 1);
    const centerY = height / 2;

    for (let i = 0; i < bars; i++) {
      let barHeight;
      if (isPlaying) {
        barHeight = Math.sin(step + i * 0.2) * (height * 0.35) + Math.cos(step * 1.2 + i * 0.15) * 20 + 25;
      } else {
        barHeight = 6;
      }

      const x = gap + i * (barWidth + gap);
      const y = centerY - barHeight / 2;

      const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
      grad.addColorStop(0, '#FDFBF7');
      grad.addColorStop(0.5, '#D4AF37');
      grad.addColorStop(1, '#997B22');

      ctx.fillStyle = grad;
      ctx.shadowBlur = isPlaying ? 10 : 0;
      ctx.shadowColor = '#D4AF37';
      
      // Rounded bar top
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barWidth, barHeight, 3) : ctx.rect(x, y, barWidth, barHeight);
      ctx.fill();
    }

    step += 0.05;
    requestAnimationFrame(drawWave);
  }

  drawWave();
}

/* ----- 5. FLOATING MUSICAL NOTES ENGINE ----- */
function initFloatingNotes() {
  const noteContainers = document.querySelectorAll('.hero-section, .about-section, .services-section');
  const musicalSymbols = ['🎵', '🎶', '🎼', '🎹', '🎸', '🎷', '🎺'];

  noteContainers.forEach(container => {
    setInterval(() => {
      if (document.hidden) return;
      const note = document.createElement('div');
      note.className = 'floating-musical-note';
      note.innerText = musicalSymbols[Math.floor(Math.random() * musicalSymbols.length)];
      
      const leftPos = Math.random() * 90 + 5;
      note.style.left = `${leftPos}%`;
      note.style.bottom = `10px`;
      note.style.animationDuration = `${Math.random() * 2 + 3}s`;

      container.appendChild(note);

      setTimeout(() => {
        note.remove();
      }, 5000);
    }, 2800);
  });
}

/* ----- 6. INTERACTIVE PIANO KEYBOARD & SYNTH ENGINE ----- */
function initPianoWidget() {
  const pianoContainer = document.getElementById('interactivePiano');
  if (!pianoContainer) return;

  // Web Audio Synth Context
  let audioCtx = null;

  function playFreq(freq) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
      console.log("AudioSynth play note:", e);
    }
  }

  const notes = [
    { note: 'C4', freq: 261.63, isBlack: false },
    { note: 'C#4', freq: 277.18, isBlack: true },
    { note: 'D4', freq: 293.66, isBlack: false },
    { note: 'D#4', freq: 311.13, isBlack: true },
    { note: 'E4', freq: 329.63, isBlack: false },
    { note: 'F4', freq: 349.23, isBlack: false },
    { note: 'F#4', freq: 369.99, isBlack: true },
    { note: 'G4', freq: 392.00, isBlack: false },
    { note: 'G#4', freq: 415.30, isBlack: true },
    { note: 'A4', freq: 440.00, isBlack: false },
    { note: 'A#4', freq: 466.16, isBlack: true },
    { note: 'B4', freq: 493.88, isBlack: false },
    { note: 'C5', freq: 523.25, isBlack: false }
  ];

  pianoContainer.innerHTML = '';
  notes.forEach(n => {
    const key = document.createElement('div');
    key.className = `piano-key ${n.isBlack ? 'black-key' : ''}`;
    key.title = `Note ${n.note}`;
    
    key.addEventListener('mousedown', () => {
      playFreq(n.freq);
      key.classList.add('playing');
      setTimeout(() => key.classList.remove('playing'), 250);
    });

    key.addEventListener('touchstart', (e) => {
      e.preventDefault();
      playFreq(n.freq);
      key.classList.add('playing');
      setTimeout(() => key.classList.remove('playing'), 250);
    });

    pianoContainer.appendChild(key);
  });
}
