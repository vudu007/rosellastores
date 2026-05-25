import { spawn } from 'node:child_process';
import process from 'node:process';

const rootDir = process.cwd();

const run = (command, args, extraEnv = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ...extraEnv,
      },
    });
    child.on('exit', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
    child.on('error', reject);
  });

let nextProc;
let mongod;

const cleanup = async () => {
  try {
    if (nextProc && !nextProc.killed) nextProc.kill('SIGINT');
  } catch {}
  try {
    if (mongod) await mongod.stop();
  } catch {}
};

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

try {
  let uri = process.env.DATABASE_URL ?? '';

  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const requestedVersion = process.env.MONGOMS_VERSION ?? '4.4.29';
    mongod = await MongoMemoryServer.create({
      binary: { version: requestedVersion },
      instance: { dbName: 'retaildb' },
    });
    uri = mongod.getUri('retaildb');
  } catch {
    if (!uri) {
      throw new Error(
        'DATABASE_URL is not set and mongodb-memory-server is not available. Start MongoDB locally and set DATABASE_URL, or install mongodb-memory-server.'
      );
    }
  }

  const nextAuthUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const nextAuthSecret = process.env.NEXTAUTH_SECRET ?? 'e2e-secret-change-me';

  process.env.DATABASE_URL = uri;
  process.env.NEXTAUTH_URL = nextAuthUrl;
  process.env.NEXTAUTH_SECRET = nextAuthSecret;

  await run('npx', ['prisma', 'db', 'push', '--force-reset'], { DATABASE_URL: uri });
  await run('npm', ['run', 'db:seed'], { DATABASE_URL: uri, NEXTAUTH_URL: nextAuthUrl, NEXTAUTH_SECRET: nextAuthSecret });

  nextProc = spawn('npm', ['run', 'dev'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DATABASE_URL: uri,
      NEXTAUTH_URL: nextAuthUrl,
      NEXTAUTH_SECRET: nextAuthSecret,
    },
  });

  nextProc.on('exit', async (code) => {
    await cleanup();
    process.exit(code ?? 1);
  });
} catch (e) {
  console.error(e);
  await cleanup();
  process.exit(1);
}
