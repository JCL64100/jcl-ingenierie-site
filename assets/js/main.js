// JCL Ingénierie — comportements partagés
document.addEventListener('DOMContentLoaded', () => {

  /* ---- nav mobile ---- */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links){
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Fermer' : 'Menu';
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      links.classList.remove('is-open');
      toggle.textContent = 'Menu';
    }));
  }

  /* ---- dossiers de projets (filtre) ---- */
  const tabs = document.querySelectorAll('.folder-tab');
  const blocks = document.querySelectorAll('.project-block');
  if (tabs.length && blocks.length){
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        const cat = tab.dataset.filter;
        blocks.forEach(block => {
          const show = cat === 'all' || block.dataset.category === cat;
          block.style.display = show ? '' : 'none';
        });
      });
    });
  }

  /* ---- lightbox ---- */
  const lightbox = document.querySelector('.lightbox');
  if (!lightbox) return;

  const lbImg = lightbox.querySelector('img');
  const lbCap = lightbox.querySelector('.lightbox-cap');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');

  let items = [];
  let current = 0;

  function collectItems(scope){
    return Array.from(scope.querySelectorAll('.media-item button')).map(btn => ({
      src: btn.dataset.full || btn.querySelector('img').src,
      caption: btn.dataset.caption || ''
    }));
  }

  function openAt(scope, index){
    items = collectItems(scope);
    current = index;
    render();
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function render(){
    const item = items[current];
    if (!item) return;
    lbImg.src = item.src;
    lbImg.alt = item.caption;
    lbCap.textContent = item.caption;
  }

  function close(){
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.media-grid').forEach(grid => {
    grid.querySelectorAll('.media-item button').forEach((btn, idx) => {
      btn.addEventListener('click', () => openAt(grid, idx));
    });
  });

  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
  prevBtn.addEventListener('click', () => { current = (current - 1 + items.length) % items.length; render(); });
  nextBtn.addEventListener('click', () => { current = (current + 1) % items.length; render(); });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') { current = (current - 1 + items.length) % items.length; render(); }
    if (e.key === 'ArrowRight') { current = (current + 1) % items.length; render(); }
  });
});
