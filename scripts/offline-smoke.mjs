const endpoint = 'http://127.0.0.1:9333/json';
let targets;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    targets = await (await fetch(endpoint)).json();
    if (targets.length) break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const page = targets?.find((target) => target.type === 'page' && target.url.includes('/dist/index.html'));
if (!page) throw new Error('离线页面未能在浏览器中启动');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const handler = pending.get(message.id);
  if (handler) {
    pending.delete(message.id);
    handler(message);
  }
});

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

await command('Runtime.evaluate', {
  expression: `new Promise(resolve => setTimeout(() => {
    window.__offlineErrors = window.__bootErrors || [];
    window.addEventListener('error', event => window.__offlineErrors.push(event.error?.stack || event.message));
    const button = document.querySelector('[data-mode="infinite"]');
    button?.click();
    setTimeout(() => resolve(), 250);
  }, 500))`,
  awaitPromise: true,
});
const result = await command('Runtime.evaluate', {
  expression: `({
    title: document.title,
    homeHidden: document.querySelector('#homeScreen')?.classList.contains('hidden'),
    coins: document.querySelector('#stats')?.textContent,
    error: document.querySelector('vite-error-overlay')?.textContent,
    errors: window.__offlineErrors
  })`,
  returnByValue: true,
});

const value = result.result?.result?.value;
socket.close();
if (!value?.homeHidden || !value?.coins?.includes('∞')) {
  throw new Error(`模式按钮离线点击失败：${JSON.stringify(value)}`);
}
console.log('离线模式按钮验证成功', value);
