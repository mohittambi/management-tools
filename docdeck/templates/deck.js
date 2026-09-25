(function () {
  // Auto-fit: a slide whose content overflows steps its type scale down, to a
  // floor. Anything still overflowing is reported to the build.
  var MIN = 0.72, STEP = 0.04;
  var overflow = [];
  document.querySelectorAll(".dd-slide").forEach(function (slide, i) {
    var body = slide.querySelector(".dd-slide-body");
    if (!body) return;
    var fit = 1;
    while (body.scrollHeight > body.clientHeight + 1 && fit > MIN) {
      fit = Math.round((fit - STEP) * 100) / 100;
      slide.style.setProperty("--dd-fit", String(fit));
    }
    if (body.scrollHeight > body.clientHeight + 1) {
      slide.setAttribute("data-overflow", "true");
      overflow.push({ slide: i + 1, label: slide.getAttribute("data-label") || "" });
    }
  });
  window.__ddOverflow = overflow;
  window.__ddFitted = true;
  if (document.body.classList.contains("dd-print")) return;

  // Presenting: scale 1600×900 slides to the window, arrow keys to move.
  var slides = Array.prototype.slice.call(document.querySelectorAll(".dd-slide"));
  var wrap = document.querySelector(".dd-slides");
  function scale() {
    var s = Math.min((window.innerWidth - 32) / 1600, 1);
    if (document.fullscreenElement) s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    wrap.style.zoom = String(s);
  }
  window.addEventListener("resize", scale);
  document.addEventListener("fullscreenchange", scale);
  scale();
  var pos = document.getElementById("dd-pos");
  function current() {
    var mid = window.innerHeight / 2, best = 0;
    slides.forEach(function (s, i) { if (s.getBoundingClientRect().top <= mid) best = i; });
    return best;
  }
  function go(d) {
    var n = Math.max(0, Math.min(slides.length - 1, current() + d));
    slides[n].scrollIntoView({ behavior: "smooth", block: "center" });
  }
  window.addEventListener("scroll", function () { if (pos) pos.textContent = String(current() + 1); }, { passive: true });
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); go(-1); }
    if (e.key === "f" || e.key === "F") toggleFull();
  });
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  }
  document.querySelectorAll("[data-go]").forEach(function (b) {
    b.addEventListener("click", function () { go(Number(b.getAttribute("data-go"))); });
  });
  var full = document.querySelector("[data-full]");
  if (full) full.addEventListener("click", toggleFull);
})();
