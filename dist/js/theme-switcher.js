(function () {
  var icons = document.querySelectorAll('.pixel-icon[data-theme]');
  if (!icons.length) return;

  var card = document.querySelector('.license-card');
  var saved = localStorage.getItem('theme');
  var transitioning = false;

  function setTheme(theme) {
    if (theme && theme !== 'default') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    icons.forEach(function (icon) {
      icon.classList.toggle('active', icon.getAttribute('data-theme') === (theme || 'default'));
    });
    localStorage.setItem('theme', theme || 'default');
  }

  function applyTheme(theme) {
    if (transitioning) return;
    var current = localStorage.getItem('theme') || 'default';
    if (theme === current) return;

    transitioning = true;
    card.classList.add('theme-transition');

    // Swap at the peak of the flash (35-55% of 450ms ≈ 180ms)
    setTimeout(function () {
      setTheme(theme);
    }, 180);

    setTimeout(function () {
      card.classList.remove('theme-transition');
      transitioning = false;
    }, 450);
  }

  icons.forEach(function (icon) {
    icon.addEventListener('click', function () {
      applyTheme(icon.getAttribute('data-theme'));
    });
  });

  // Restore saved theme instantly (no transition on load)
  if (saved && saved !== 'default') {
    setTheme(saved);
  }
})();
