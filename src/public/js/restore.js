(() => {
  const form = document.getElementById('upload');
  if (form) {
    const msg = document.getElementById('upload-msg');
    const button = form.querySelector('button');
    const say = (text) => { msg.textContent = text; };
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const file = form.querySelector('input[type=file]').files[0];
      if (!file) return say('Izberi datoteko.');
      button.disabled = true;
      say('Nalagam in preverjam …');
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'x-csrf-token': form.dataset.csrf, 'content-type': 'application/octet-stream' },
          body: file,
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data && data.ok) return location.reload();
        say((data && data.error) || (res.status === 413
          ? 'Strežnik pred portalom ne sprejme tako velike datoteke (nastavitev client_max_body_size).'
          : 'Nalaganje ni uspelo.'));
      } catch { say('Povezava s strežnikom je bila prekinjena. Poskusi znova.'); }
      button.disabled = false;
    });
  }
  const restore = document.getElementById('restore');
  if (restore) {
    restore.addEventListener('submit', () => {
      setTimeout(() => {
        const b = restore.querySelector('button');
        b.disabled = true;
        b.textContent = 'Obnavljam …';
      }, 0);
    });
  }
})();
