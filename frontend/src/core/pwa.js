export async function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/portal/sw.js', { scope: '/portal/' });
  } catch (error) {
    console.error('Service worker gagal:', error);
  }
}
