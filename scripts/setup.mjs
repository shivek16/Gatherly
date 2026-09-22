import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, copyFileSync } from 'node:fs';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const directory of ['backend', 'frontend']) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'ci'], {
    cwd: root + directory,
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status || 1);
  const env = root + directory + '/.env';
  if (!existsSync(env)) copyFileSync(root + directory + '/.env.example', env);
}
console.log('Dependencies installed. Check backend/.env, then run npm start.');
