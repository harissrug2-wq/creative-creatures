(() => {
  const cards = document.querySelectorAll('.option-card');
  const ctaBtn = document.querySelector('#entryCtaButton');
  const ctaText = document.querySelector('#ctaText');
  let selected = 'no';

  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => {
        c.classList.remove('active');
        const radio = c.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
      });
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      selected = card.dataset.option;

      if (selected === 'no') {
        if (ctaText) ctaText.textContent = 'Start My Identity Archetype Assessment';
      } else {
        if (ctaText) ctaText.textContent = 'Sign In to Access Report';
      }
    });
  });

  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => {
      if (selected === 'no') {
        location.href = '/owner-archetype/assessment';
      } else {
        location.href = '/sign-in/';
      }
    });
  }
})();
