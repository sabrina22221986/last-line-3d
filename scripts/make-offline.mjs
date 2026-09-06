import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const indexPath = join(dist, 'index.html');
let html = await readFile(indexPath, 'utf8');

const scriptMatch = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const styleMatch = html.match(/<link[^>]+href="([^"]+)"[^>]*>/);

if (!scriptMatch || !styleMatch) {
  throw new Error('无法找到 Vite 生成的脚本或样式资源');
}

const assetPath = (value) => join(dist, value.replace(/^[/\\.]+/, ''));
const [javascript, css] = await Promise.all([
  readFile(assetPath(scriptMatch[1]), 'utf8'),
  readFile(assetPath(styleMatch[1]), 'utf8'),
]);
const safeJavaScript = javascript.replace(/<\/script/gi, '<\\/script');
const safeCss = css.replace(/<\/style/gi, '<\\/style');

html = html
  .replace(styleMatch[0], () => `<style>${safeCss}</style>`)
  .replace(scriptMatch[0], () => `<script type="module">${safeJavaScript}</script>`)
  .replace('</head>', '<meta name="offline-ready" content="true"></head>');
html = html.replace(/\r\n/g, '\n').replace(/[ \t]+(?=\n)/g, '');

await writeFile(indexPath, html, 'utf8');
console.log(`离线单文件已生成：dist/index.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
