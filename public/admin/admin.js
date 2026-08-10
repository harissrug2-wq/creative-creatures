(() => {
  const side=document.querySelector('.admin-side'); const overlay=document.querySelector('.admin-overlay');
  document.querySelector('.admin-mobile')?.addEventListener('click',()=>{side.classList.toggle('open');overlay.classList.toggle('open')}); overlay?.addEventListener('click',()=>{side.classList.remove('open');overlay.classList.remove('open')});
  document.querySelectorAll('[data-admin-view]').forEach(a=>a.addEventListener('click',()=>localStorage.setItem('ccAdminView','true')));
  document.querySelectorAll('[data-delete-card]').forEach(btn=>btn.addEventListener('click',()=>{if(confirm('Remove this agency from the demo list?'))btn.closest('.agency-card')?.remove()}));
  const modal=document.querySelector('.admin-modal'); document.querySelector('[data-new-agency]')?.addEventListener('click',()=>modal?.classList.add('open')); document.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>modal?.classList.remove('open')));
  document.querySelector('[data-create-agency]')?.addEventListener('click',()=>{const name=document.querySelector('#newAgencyName')?.value.trim(); if(!name)return; alert(`${name} created in the prototype.`); modal.classList.remove('open')});
  const search=document.querySelector('#agencySearch'); search?.addEventListener('input',()=>{const q=search.value.toLowerCase();document.querySelectorAll('.roll-row[data-name]').forEach(r=>r.hidden=!r.dataset.name.includes(q))});
})();
