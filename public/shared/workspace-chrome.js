/* Shared workspace controls. Entitlements come from the authenticated API. */
(() => {
  if (window.CCWorkspaceChrome) return;
  let mounted = false;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  async function signOut(button) {
    button.disabled = true;
    try {
      const response = await fetch('/api/account-auth', {method:'DELETE', credentials:'same-origin'});
      if (!response.ok) throw new Error('Sign out failed. Please try again.');
      ['ccSignedIn','cc_account','ccUserAccount','ccOwnerEmail','ownerIdentityComplete'].forEach(key => localStorage.removeItem(key));
      location.assign('/login/');
    } catch (error) { button.disabled = false; window.alert(error.message); }
  }
  function mount(access) {
    if (mounted) return;
    const header = document.querySelector('.app-topbar,.cc-topbar,.main-shell>.topbar');
    if (!header) return;
    mounted = true;
    const canManage = access.actor?.role === 'owner' && access.features.includes('users');
    document.querySelectorAll('[data-team-access]').forEach(link => {link.hidden = !canManage;});
    const setHeight = () => document.documentElement.style.setProperty('--cc-header-offset', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    setHeight();
    if (window.ResizeObserver) new ResizeObserver(setHeight).observe(header);
    // Keep each launcher in its original desktop/mobile menu.
    document.querySelectorAll('#askButton,.ask-creature,[data-cc-ask],#mobileAskButton,.mobile-ask-creature').forEach(button => {
      button.classList.add('cc-menu-ask');
      button.hidden = !access.features.includes('ask');
      button.setAttribute('aria-label','Open Ask Creature');
    });
    if (document.querySelector('.monitor-app')) {
      const old=document.querySelector('.profile-menu .signout');
      if(old){const replacement=old.cloneNode(true);old.replaceWith(replacement);replacement.onclick=()=>signOut(replacement);}
      document.querySelector('#askDrawer')?.remove();
      return;
    }
    let button = header.querySelector('.top-account');
    if (button) {
      const replacement = button.cloneNode(true);
      button.replaceWith(replacement);
      button = replacement;
    } else {
      button = element('button','top-account');
      button.type = 'button';
      header.append(button);
    }
    const name = access.actor?.name || 'My account';
    button.replaceChildren(element('span','',name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase()),element('b','',name));
    button.classList.add('cc-profile-toggle');
    button.setAttribute('aria-label',`Account menu for ${name}`);
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-controls','ccAccountMenu');
    document.querySelector('.top-account-menu')?.remove();
    const menu = element('div','cc-account-menu');
    menu.id = 'ccAccountMenu';menu.hidden = true;
    menu.append(element('strong','',name),element('small','',access.actor?.email || ''));
    if (canManage) {
      for (const [label,href] of [['Invite teammate','/users/?invite=1'],['Manage users','/users/']]) {
        const link = element('a','',label);link.href=href;menu.append(link);
      }
    }
    const logout = element('button','cc-signout','Sign out');logout.type='button';logout.onclick=()=>signOut(logout);menu.append(logout);
    document.body.append(menu);
    const close = () => {menu.hidden=true;button.setAttribute('aria-expanded','false');};
    button.onclick = () => {menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));};
    document.addEventListener('click',event=>{if(!menu.contains(event.target)&&!button.contains(event.target))close();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){close();button.focus({preventScroll:true});}});
    document.querySelectorAll('.mobile-signout').forEach(old => {
      const replacement = old.cloneNode(true);old.replaceWith(replacement);replacement.onclick=()=>signOut(replacement);
    });
  }
  window.CCWorkspaceChrome={mount};
})();
