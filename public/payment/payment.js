// Retired simulated checkout: all payment entry points use the verified flow.
(() => {
  if (!document.querySelector('#checkoutPage')) return;
  const query = new URLSearchParams(location.search);
  const plan = query.get('plan') || localStorage.getItem('ccProgramPath') || 'diagnostic';
  const target = new URL('/payment/', location.origin);
  if (['diagnostic','accelerator','platform','fractional_coo'].includes(plan)) target.searchParams.set('plan',plan);
  location.replace(target.href);
})();
