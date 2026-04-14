(function() {
  var BASE = 'https://www.sacscloud.com';

  // Find inline containers
  var containers = document.querySelectorAll('[data-sacs-booking]');
  containers.forEach(function(el) {
    var slug = el.getAttribute('data-sacs-booking') || el.getAttribute('data-slug') || 'demo';
    var iframe = document.createElement('iframe');
    iframe.src = BASE + '/agendar/embed/' + slug;
    iframe.style.cssText = 'width:100%;height:700px;border:none;border-radius:12px;';
    iframe.allow = 'camera;microphone';
    el.appendChild(iframe);
  });

  // Also check for legacy #sacs-booking div
  var legacyContainer = document.getElementById('sacs-booking');
  if (legacyContainer && !legacyContainer.hasAttribute('data-sacs-booking')) {
    var slug = legacyContainer.getAttribute('data-slug') || 'demo';
    var iframe = document.createElement('iframe');
    iframe.src = BASE + '/agendar/embed/' + slug;
    iframe.style.cssText = 'width:100%;height:700px;border:none;border-radius:12px;';
    iframe.allow = 'camera;microphone';
    legacyContainer.appendChild(iframe);
  }

  // Popup functionality
  var modal = null;
  window.SacsBooking = {
    open: function(slug) {
      slug = slug || 'demo';
      if (modal) { modal.style.display = 'flex'; return; }
      modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:16px;';
      modal.innerHTML = '<div style="position:relative;width:100%;max-width:480px;height:90vh;background:#fff;border-radius:16px;overflow:hidden;">' +
        '<button onclick="SacsBooking.close()" style="position:absolute;top:12px;right:12px;z-index:10;width:32px;height:32px;border-radius:50%;border:none;background:rgba(0,0,0,0.08);cursor:pointer;font-size:18px;color:#666;">&#10005;</button>' +
        '<iframe src="' + BASE + '/agendar/embed/' + slug + '" style="width:100%;height:100%;border:none;" allow="camera;microphone"></iframe>' +
        '</div>';
      modal.addEventListener('click', function(e) { if (e.target === modal) SacsBooking.close(); });
      document.body.appendChild(modal);
    },
    close: function() {
      if (modal) { modal.style.display = 'none'; }
    }
  };

  // Auto-popup mode
  var script = document.currentScript || document.querySelector('script[src*="embed.js"]');
  if (script && script.getAttribute('data-mode') === 'popup') {
    var slug = script.getAttribute('data-slug') || 'demo';
    // Create floating button
    var btn = document.createElement('button');
    btn.textContent = 'Agendar demo';
    btn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:14px 28px;background:#4B7BE5;color:#fff;border:none;border-radius:50px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(75,123,229,0.3);font-family:inherit;';
    btn.onclick = function() { SacsBooking.open(slug); };
    document.body.appendChild(btn);
  }
})();
