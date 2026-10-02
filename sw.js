// Service worker da Dispensa: abre instantaneamente e funciona offline.
// Os dados (Firestore) têm cache própria dentro da app; aqui só guardamos o "esqueleto" da app.
const VERSION = 'dispensa-v10';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Nunca interferir com a API do Firestore / autenticação
  if (/(firestore|identitytoolkit|securetoken)\.googleapis\.com$/.test(url.hostname) || url.hostname.endsWith('firebaseio.com')) return;

  // Navegação: rede primeiro (apanha atualizações), cache se estiver offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Restante (ícones, módulos do Firebase em gstatic): cache primeiro, atualiza em segundo plano
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin || url.hostname === 'www.gstatic.com') {
    event.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((res) => {
          if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
