/* =========================
   LOADER
========================= */

window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("loader").classList.add("hide");
    document.body.classList.add("loaded");
  }, 700);
});


/* =========================
   PROGRESS BAR
========================= */

window.addEventListener("scroll", () => {
  const scrollTop = window.scrollY;
  const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  const progress = height > 0 ? (scrollTop / height) * 100 : 0;
  document.getElementById("progress").style.width = progress + "%";
});


/* =========================
   REVEAL ON SCROLL
========================= */

const revealObserver = new IntersectionObserver(
  entries => entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add("visible");
  }),
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach(el => revealObserver.observe(el));

const imageObserver = new IntersectionObserver(
  entries => entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add("visible");
  }),
  { threshold: 0.2 }
);
document.querySelectorAll(".full-image").forEach(el => imageObserver.observe(el));


/* =========================
   DREAMY FLOATING PETALS
========================= */

(function createPetals() {
  const container = document.getElementById("petals");
  const colors = ["#f0c3d0", "#d8b384", "#8fb4d9", "#f5ddd0"];
  const count = window.innerWidth < 700 ? 14 : 22;

  for (let i = 0; i < count; i++) {
    const petal = document.createElement("div");
    petal.className = "petal";

    const size = 8 + Math.random() * 14;
    petal.style.width = size + "px";
    petal.style.height = size + "px";
    petal.style.left = Math.random() * 100 + "vw";
    petal.style.background = colors[Math.floor(Math.random() * colors.length)];

    const duration = 12 + Math.random() * 14;
    petal.style.animationDuration = duration + "s";
    petal.style.animationDelay = (Math.random() * duration) + "s";

    container.appendChild(petal);
  }
})();


/* =========================
   CAKE FLIP (scroll driven)
========================= */

const cakeSection = document.querySelector(".cake-section");
const cakeCard = document.getElementById("cakeCard");
const cakeReveal = document.getElementById("cakeReveal");
let cakeFlipped = false;

function updateCake() {
  const rect = cakeSection.getBoundingClientRect();
  const sectionHeight = cakeSection.offsetHeight;
  const viewport = window.innerHeight;

  const progress = Math.min(1, Math.max(0, (viewport - rect.top) / (sectionHeight - viewport)));

  if (progress > 0.32 && !cakeFlipped) {
    cakeCard.classList.add("flipped");
    cakeFlipped = true;
  }
  if (progress > 0.62) {
    cakeReveal.classList.add("show");
  }
}
window.addEventListener("scroll", updateCake);
updateCake();


/* =========================
   HORIZONTAL MEMORY TRACK
========================= */

const memoryTrack = document.querySelector(".memory-track");
window.addEventListener("scroll", () => {
  const memories = document.querySelector(".memories");
  if (!memories || !memoryTrack) return;

  const rect = memories.getBoundingClientRect();
  if (rect.top < window.innerHeight && rect.bottom > 0) {
    const total = memories.offsetHeight + window.innerHeight;
    const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / total));
    const distance = Math.max(0, memoryTrack.scrollWidth - window.innerWidth);
    memoryTrack.style.transform = `translateX(-${distance * progress}px)`;
  }
});


/* =========================
   HERO PARALLAX
========================= */

window.addEventListener("scroll", () => {
  const hero = document.querySelector(".hero-image");
  if (!hero) return;
  const y = window.scrollY;
  if (y < window.innerHeight) {
    hero.style.transform = `scale(1.04) translateY(${y * 0.08}px)`;
  }
});


/* =========================
   THE "NO" BUTTON — escalating dodge & chase
========================= */

const noBtn = document.getElementById("noBtn");
const yesBtn = document.getElementById("yesBtn");
const proposal = document.getElementById("proposal");
const questionText = document.getElementById("questionText");

let noCount = 0;
let chaseMode = false;
let chaseRAF = null;
const CHASE_THRESHOLD = 3;

const dodgeTexts = [
  "ไม่",
  "แน่ใจนะ?",
  "จริงดิ?",
  "ลองคิดใหม่นะ",
  "ไม่เอาอะ",
  "กดตกลงดีกว่า",
  "จับไม่ได้หรอก",
  "เธอรู้คำตอบอยู่แล้ว",
  "ตกลงอยู่ตรงนั้นไง"
];

const questionTexts = [
  "เลือกดี ๆ นะ",
  "ปุ่ม ไม่ ขี้อายนิดหน่อย",
  "มันไม่อยากถูกกด",
  "งั้นลองจับดูสิ",
  "ยอมแพ้หรือยัง",
];

function shakeScreen() {
  document.body.classList.remove("shake");
  void document.body.offsetWidth; // restart animation
  document.body.classList.add("shake");
}

function updateQuestionText() {
  const idx = Math.min(noCount, questionTexts.length - 1);
  questionText.textContent = questionTexts[idx];
}

function dodgeWithinProposal() {
  const rect = proposal.getBoundingClientRect();
  const btnRect = noBtn.getBoundingClientRect();

  const maxX = Math.max(60, rect.width / 2 - btnRect.width);
  const maxY = 160;

  const x = Math.random() * maxX - maxX / 2;
  const y = Math.random() * maxY - maxY / 2;

  noBtn.style.position = "fixed";
  noBtn.style.left = "50%";
  noBtn.style.top = "50%";
  noBtn.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${(Math.random()-0.5)*20}deg)`;
}

function startChase() {
  chaseMode = true;
  noBtn.classList.add("chase");

  const w = window.innerWidth;
  const h = window.innerHeight;
  const btnW = noBtn.offsetWidth || 130;
  const btnH = noBtn.offsetHeight || 54;

  let angle = Math.random() * Math.PI * 2;
  let cx = w / 2;
  let cy = h / 2;
  const radiusX = Math.min(w, h) * 0.38;
  const radiusY = Math.min(w, h) * 0.3;
  let speed = 0.05;
  let t = 0;

  cancelAnimationFrame(chaseRAF);

  function loop() {
    t += speed;
    speed = Math.min(speed + 0.0006, 0.09);

    const x = cx + Math.cos(t * 1.3) * radiusX + Math.sin(t * 0.6) * 40 - btnW / 2;
    const y = cy + Math.sin(t) * radiusY + Math.cos(t * 0.9) * 30 - btnH / 2;

    const clampedX = Math.max(10, Math.min(w - btnW - 10, x));
    const clampedY = Math.max(70, Math.min(h - btnH - 20, y));

    noBtn.style.left = clampedX + "px";
    noBtn.style.top = clampedY + "px";
    noBtn.style.transform = `rotate(${Math.sin(t * 2) * 12}deg)`;

    chaseRAF = requestAnimationFrame(loop);
  }
  loop();
}

function handleNoInteraction(e) {
  if (e) e.preventDefault();
  noCount++;
  shakeScreen();
  updateQuestionText();

  const textIdx = Math.min(noCount - 1, dodgeTexts.length - 1);
  noBtn.textContent = dodgeTexts[textIdx];

  if (noCount >= CHASE_THRESHOLD && !chaseMode) {
    startChase();
  } else if (!chaseMode) {
    dodgeWithinProposal();
  }
}

noBtn.addEventListener("mouseenter", handleNoInteraction);
noBtn.addEventListener("click", handleNoInteraction);
noBtn.addEventListener("touchstart", handleNoInteraction, { passive: false });


/* =========================
   YES
========================= */

const finalScreen = document.getElementById("finalScreen");

yesBtn.addEventListener("click", () => {
  cancelAnimationFrame(chaseRAF);
  finalScreen.classList.add("show");
  document.body.classList.add("no-scroll");
  createConfetti();
});

function createConfetti() {
  const colors = ["#f0c3d0", "#de93ac", "#8fb4d9", "#d8b384", "#fffaf2"];

  for (let i = 0; i < 110; i++) {
    const piece = document.createElement("div");
    const isHeart = Math.random() > 0.5;
    piece.className = "confetti " + (isHeart ? "heart" : "dot");
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = (Math.random() * 2) + "s";
    piece.style.animationDuration = (3 + Math.random() * 3) + "s";
    finalScreen.appendChild(piece);
  }
}
