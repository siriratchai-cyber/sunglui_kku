/* Soft floating bubbles in earth tones, drifting upward across the background. */
(function () {
  const canvas = document.getElementById('bubble-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const palette = [
    'rgba(168, 85, 46, 0.16)',   // clay
    'rgba(107, 122, 79, 0.16)',  // moss
    'rgba(192, 138, 62, 0.18)',  // ochre
    'rgba(220, 205, 175, 0.28)', // sand
    'rgba(180, 67, 46, 0.12)',   // rust
  ];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width, height, bubbles;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function makeBubble(randomY) {
    const r = 14 + Math.random() * 46;
    return {
      x: Math.random() * width,
      y: randomY ? Math.random() * height : height + r + Math.random() * 200,
      r,
      speed: 0.15 + Math.random() * 0.45,
      drift: (Math.random() - 0.5) * 0.3,
      color: palette[Math.floor(Math.random() * palette.length)],
      wobble: Math.random() * Math.PI * 2,
    };
  }

  function init() {
    resize();
    const count = window.innerWidth < 700 ? 12 : 22;
    bubbles = Array.from({ length: count }, () => makeBubble(true));
  }

  function tick() {
    ctx.clearRect(0, 0, width, height);
    for (const b of bubbles) {
      b.y -= b.speed;
      b.wobble += 0.01;
      b.x += Math.sin(b.wobble) * b.drift;

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();

      if (b.y + b.r < -20) Object.assign(b, makeBubble(false));
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  init();

  if (!reduceMotion) {
    requestAnimationFrame(tick);
  } else {
    // Draw a single static frame for reduced-motion users.
    tick.__static = true;
    ctx.clearRect(0, 0, width, height);
    for (const b of bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
    }
  }
})();
