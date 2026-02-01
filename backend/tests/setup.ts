import { execSync } from 'child_process';
import path from 'path';

const backendDir = path.resolve(__dirname, '..');
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:' + path.join(backendDir, 'prisma', 'test.db');

execSync('npx prisma db push --accept-data-loss', { cwd: backendDir, env: process.env, stdio: 'pipe' });
execSync('npx prisma db seed', { cwd: backendDir, env: process.env, stdio: 'pipe' });
