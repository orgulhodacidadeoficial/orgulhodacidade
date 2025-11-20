/* admin.js
   Pequeno helper que verifica /api/admin/status e ativa um modo 'is-admin'
   em todas as páginas. Mostra um badge de administrador no header e revela
   elementos marcados como admin-only ou formulários admin.
*/
(function(){
  'use strict';

  async function check() {
    try {
      const resp = await fetch('/api/admin/status', { credentials: 'same-origin' });
      if (!resp.ok) return setAdmin(false);
      const js = await resp.json();
      setAdmin(!!js.admin);
    } catch (e) {
      setAdmin(false);
    }
  }

  function setAdmin(isAdmin){
    if (isAdmin) document.body.classList.add('is-admin'); else document.body.classList.remove('is-admin');
    toggleAdminUI(isAdmin);
    // Se fotos.js está presente, ativa o modo admin de fotos também
    if (window.activatePhotoAdminMode) {
      window.activatePhotoAdminMode(isAdmin);
    }
  }

  function toggleAdminUI(isAdmin){
    // Reveal elements with class .admin-only
    document.querySelectorAll('.admin-only').forEach(el => {
      if (isAdmin) el.style.display = '';
      else el.style.display = 'none';
    });

    // If there's a form with id=form-apresentacao (events admin), show it
    const form = document.getElementById('form-apresentacao');
    if (form) {
      if (isAdmin) form.classList.add('visible'); else form.classList.remove('visible');
    }

    // Add admin badge / logout button in header
    let badge = document.getElementById('site-admin-badge');
    if (isAdmin) {
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'site-admin-badge';
        badge.style.display = 'flex';
        badge.style.gap = '8px';
        badge.style.alignItems = 'center';
        badge.style.marginLeft = '12px';

        const label = document.createElement('span');
        label.textContent = '🔒 Admin';
        label.style.color = '#fff';
        label.style.fontWeight = '700';
        label.style.fontSize = '0.95rem';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Sair';
        btn.style.padding = '6px 10px';
        btn.style.borderRadius = '8px';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.style.background = 'rgba(255,255,255,0.06)';
        btn.style.color = '#fff';
        btn.addEventListener('click', async () => {
          try {
            await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
          } catch(e){}
          setAdmin(false);
          // reload to ensure server session cleared
          location.reload();
        });

        badge.appendChild(label);
        badge.appendChild(btn);

        // Append to nav container if exists, else to header
        const nav = document.querySelector('.nav-container') || document.querySelector('header') || document.body;
        if (nav) nav.appendChild(badge);
      }
    } else {
      if (badge) badge.remove();
    }
  }

  // run on DOM ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check); else check();

  // Verificar status admin a cada 3 segundos (em tempo real)
  setInterval(check, 3000);

  // Expose for debug
  window.AdminHelper = { 
    check, 
    setAdmin,
    updateAdminElements: function() {
      // Atualiza todos os elementos .admin-only com o estado atual
      const isAdmin = document.body.classList.contains('is-admin');
      document.querySelectorAll('.admin-only').forEach(el => {
        if (isAdmin) el.style.display = '';
        else el.style.display = 'none';
      });
    }
  };
})();
