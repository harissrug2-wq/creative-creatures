(()=>{
  document.documentElement.classList.add('admin-auth-pending');
  const loginPath='/admin/login/';
  async function verify(){
    try{
      const response=await fetch('/api/admin-auth',{cache:'no-store'});
      if(!response.ok)throw new Error('unauthorized');
      const payload=await response.json();
      document.documentElement.classList.remove('admin-auth-pending');
      document.documentElement.classList.add('admin-authenticated');
      document.querySelectorAll('[data-admin-username]').forEach(el=>el.textContent=payload.username||'Platform Admin');
    }catch{
      const next=location.pathname+location.search;
      location.replace(`${loginPath}?next=${encodeURIComponent(next)}`);
    }
  }
  window.CCAdminAuth={logout:async()=>{try{await fetch('/api/admin-auth',{method:'DELETE'})}finally{location.href=loginPath}}};
  verify();
})();
