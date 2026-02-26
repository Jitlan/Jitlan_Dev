(function () {
  var items = [
    { icon: ">>", text: "Built a RAG app that cut SME interruptions by ~30%" },
    { icon: "!!", text: "Championed AI tooling \u2014 20%+ dev productivity boost" },
    { icon: ">>", text: "Currently building capitol-watch.com", link: "https://capitol-watch.com" },
    { icon: "##", text: "Enterprise Angular monorepo architect \u2014 100+ PRs/year" },
    { icon: "**", text: "B.S.E. Software Engineering \u2014 Monmouth University" },
    { icon: "!!", text: "Co-founded Monmouth Gamers United & Esports club" },
    { icon: "??", text: "'Jitlan' \u2014 a nickname from siblings & track team" }
  ];

  var container = document.querySelector(".ad-content");
  if (!container) return;

  var iconEl = container.querySelector(".ad-icon");
  var textEl = container.querySelector(".ad-text");
  var pips = document.querySelectorAll(".progress-pip");
  var currentIndex = 0;
  var DISPLAY_TIME = 4000;
  var FADE_TIME = 600;

  function updatePips(index) {
    for (var i = 0; i < pips.length; i++) {
      // Remove CSS animation so JS controls it
      pips[i].style.animation = "none";
      pips[i].classList.toggle("active", i === index);
    }
  }

  // Show first item immediately
  iconEl.textContent = items[0].icon;
  textEl.textContent = items[0].text;
  updatePips(0);

  function showNext() {
    container.classList.add("fade-out");

    setTimeout(function () {
      currentIndex = (currentIndex + 1) % items.length;
      var item = items[currentIndex];
      iconEl.textContent = item.icon;
      textEl.textContent = item.text;
      if (item.link) {
        container.style.cursor = "pointer";
        container.onclick = function () { window.open(item.link, "_blank"); };
      } else {
        container.style.cursor = "default";
        container.onclick = null;
      }
      updatePips(currentIndex);

      container.classList.remove("fade-out");
    }, FADE_TIME);
  }

  setInterval(showNext, DISPLAY_TIME + FADE_TIME);
})();
