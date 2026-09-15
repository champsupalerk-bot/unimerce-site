document.addEventListener("DOMContentLoaded", () => {
  
  /* =========================================
     1. BGM MUSIC CONTROLLER
     ========================================= */
  const bgm = document.getElementById("bgm");
  const soundBtn = document.getElementById("soundBtn");
  const soundText = document.getElementById("soundText");
  let isPlaying = false;

  soundBtn.addEventListener("click", () => {
    if (!isPlaying) {
      bgm.play().then(() => {
        isPlaying = true;
        soundText.textContent = "ปิดเพลง";
        soundBtn.style.background = "var(--soft-pink)";
        soundBtn.style.color = "#fff";
      }).catch(err => console.log("Audio play blocked", err));
    } else {
      bgm.pause();
      isPlaying = false;
      soundText.textContent = "เปิดเพลงบรรยากาศ";
      soundBtn.style.background = "var(--bg-soft-pink)";
      soundBtn.style.color = "var(--text-dark)";
    }
  });

  /* =========================================
     2. PROGRESS BAR & SCROLL REVEAL
     ========================================= */
  const progressBar = document.getElementById("progressBar");
  const reveals = document.querySelectorAll(".reveal");

  window.addEventListener("scroll", () => {
    // Progress Bar
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (window.scrollY / totalHeight) * 100;
    progressBar.style.width = `${progress}%`;

    // Scroll Reveal
    reveals.forEach(el => {
      const elementTop = el.getBoundingClientRect().top;
      if (elementTop < window.innerHeight - 100) {
        el.classList.add("visible");
      }
    });
  });

  /* Trigger reveal once on load */
  window.dispatchEvent(new Event('scroll'));

  /* =========================================
     3. FLOATING SPARKLES & HEART PARTICLES
     ========================================= */
  const sparkleContainer = document.getElementById("sparkle-container");
  const particleIcons = ["💖", "🌸", "✨", "☁️", "🤍", "🌷"];

  function createFloatingParticle() {
    const particle = document.createElement("div");
    particle.className = "sparkle-item";
    particle.textContent = particleIcons[Math.floor(Math.random() * particleIcons.length)];
    
    const startX = Math.random() * window.innerWidth;
    const size = Math.random() * 12 + 12; // 12px - 24px
    const duration = Math.random() * 6 + 6; // 6s - 12s

    particle.style.cssText = `
      position: absolute;
      left: ${startX}px;
      bottom: -30px;
      font-size: ${size}px;
      opacity: ${Math.random() * 0.6 + 0.3};
      pointer-events: none;
      transition: transform ${duration}s linear, opacity ${duration}s ease;
    `;

    sparkleContainer.appendChild(particle);

    setTimeout(() => {
      particle.style.transform = `translateY(-105vh) rotate(${Math.random() * 360}deg)`;
    }, 50);

    setTimeout(() => {
      particle.remove();
    }, duration * 1000);
  }

  setInterval(createFloatingParticle, 800);

  /* Touch / Mouse Cursor Magic Dust Effect */
  window.addEventListener("pointermove", (e) => {
    if (Math.random() > 0.8) { // สร้างประปรายไม่ให้เยอะเกินไป
      const dust = document.createElement("div");
      dust.textContent = "✨";
      dust.style.cssText = `
        position: fixed;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
        font-size: 14px;
        pointer-events: none;
        z-index: 999;
        transition: all 1s ease-out;
      `;
      document.body.appendChild(dust);
      setTimeout(() => {
        dust.style.transform = `translateY(-20px) scale(0)`;
        dust.style.opacity = "0";
      }, 50);
      setTimeout(() => dust.remove(), 1000);
    }
  });

  /* =========================================
     4. CAKE FLIP ON CLICK / TOUCH
     ========================================= */
  const cakeCard = document.getElementById("cakeCard");
  cakeCard.addEventListener("click", () => {
    cakeCard.classList.toggle("flipped");
  });

  /* =========================================
     5. CRAZY RUNAWAY "NO" BUTTON (หลบระดับเทพ + จอสั่น)
     ========================================= */
  const noBtn = document.getElementById("noBtn");
  const proposalSection = document.getElementById("proposalSection");

  const noTexts = [
    "ไม่แต่ง 😜",
    "แน่ใจเหรอครับ? 🥺",
    "คิดอีกทีน้าาา...",
    "ปุ่มนี้กดไม่ได้หรอก! 🤪",
    "บลูอย่าแกล้งเค้าสิ!",
    "ลองกดปุ่มสีชมพูดูสิ 💕",
    "วิ่งหนีแย้ววว~ 🏃‍♂️",
    "เค้าไม่ยอมให้กดหรอก!",
    "แต่งเถอะน้าาา ✨"
  ];
  let textIndex = 0;

  function moveNoButton() {
    // จอสั่นเล็กน้อย
    document.body.classList.add("screen-shake");
    setTimeout(() => document.body.classList.remove("screen-shake"), 300);

    // คำนวณพิกัดให้เด้งหนีทั่วหน้าจอ
    const padding = 60;
    const maxX = window.innerWidth - noBtn.offsetWidth - padding;
    const maxY = window.innerHeight - noBtn.offsetHeight - padding;

    const randomX = Math.max(padding, Math.random() * maxX);
    const randomY = Math.max(padding, Math.random() * maxY);

    noBtn.style.position = "fixed";
    noBtn.style.left = `${randomX}px`;
    noBtn.style.top = `${randomY}px`;
    noBtn.style.transform = `rotate(${Math.random() * 40 - 20}deg) scale(1.1)`;

    // เปลี่ยนข้อความกวนๆ
    textIndex = (textIndex + 1) % noTexts.length;
    noBtn.textContent = noTexts[textIndex];
  }

  // วิ่งหนีทั้ง Mouseover และ Touchstart (บนมือถือ)
  noBtn.addEventListener("mouseenter", moveNoButton);
  noBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    moveNoButton();
  });
  noBtn.addEventListener("click", moveNoButton);

  /* =========================================
     6. YES BUTTON & CONFETTI CELEBRATION
     ========================================= */
  const yesBtn = document.getElementById("yesBtn");
  const finalScreen = document.getElementById("finalScreen");

  yesBtn.addEventListener("click", () => {
    finalScreen.classList.add("show");
    launchHeartConfetti();
  });

  function launchHeartConfetti() {
    const colors = ["#FF85A1", "#FFC2D1", "#A2D2FF", "#BDE0FE", "#FFF0F5"];
    const shapes = ["💖", "🌸", "✨", "🎉", "🤍"];

    for (let i = 0; i < 80; i++) {
      const confetti = document.createElement("div");
      confetti.className = "confetti";
      confetti.textContent = shapes[Math.floor(Math.random() * shapes.length)];
      confetti.style.left = `${Math.random() * 100}vw`;
      confetti.style.fontSize = `${Math.random() * 15 + 15}px`;
      confetti.style.animationDuration = `${Math.random() * 2 + 2.5}s`;
      confetti.style.animationDelay = `${Math.random() * 0.5}s`;

      document.body.appendChild(confetti);

      setTimeout(() => confetti.remove(), 5000);
    }
  }
});
