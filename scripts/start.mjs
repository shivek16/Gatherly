import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const entries = [['backend', ['src/app.js']], ['frontend', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3000', '--strictPort']]];
const children = entries.map(([directory, args]) => spawn(process.execPath, args, {
  cwd: root + directory,
  stdio: 'inherit',
  env: {
    ...process.env,
    BROWSER: 'none'
  }
}));
let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
};
for (const child of children) {
  child.on('error', error => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', code => stop(code || 0));
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
