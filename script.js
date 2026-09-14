(() => {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const delay = el.dataset.delay || 0;
      el.style.animation = `rise .8s cubic-bezier(.2,.7,.2,1) ${delay}ms both`;
      io.unobserve(el);
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (el.getBoundingClientRect().top > window.innerHeight) el.style.opacity = '0';
    io.observe(el);
  });
})();
