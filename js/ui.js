/* ===== PatternMatch — UI Utilities ===== */

/* ── Hamburger menu ── */
document.addEventListener('DOMContentLoaded', function () {
  const ham = document.getElementById('nav-ham');
  const links = document.getElementById('nav-links');
  if (ham && links) {
    ham.addEventListener('click', function () {
      links.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!ham.contains(e.target) && !links.contains(e.target)) {
        links.classList.remove('open');
      }
    });
  }

  // Active nav link
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // Accordion
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', function () {
      const body = this.nextElementSibling;
      const isOpen = body.classList.contains('open');
      // Close all
      document.querySelectorAll('.accordion-body.open').forEach(b => b.classList.remove('open'));
      document.querySelectorAll('.accordion-header.open').forEach(h => h.classList.remove('open'));
      if (!isOpen) {
        body.classList.add('open');
        this.classList.add('open');
      }
    });
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const tabGroup = this.closest('.tab-group');
      if (!tabGroup) return;
      tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      tabGroup.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const target = document.getElementById(this.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
});

/* ── Score bar animation ── */
function animateBar(barId, labelId, value) {
  const bar   = document.getElementById(barId);
  const label = document.getElementById(labelId);
  if (!bar || !label) return;
  const pct = Math.round(value);
  setTimeout(() => { bar.style.width = pct + '%'; }, 50);
  label.textContent = pct + '%';
}

/* ── Copy to clipboard ── */
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-check"></i> copied';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  });
}

/* ── Format date ── */
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ── Truncate ── */
function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}
