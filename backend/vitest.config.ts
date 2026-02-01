import path from 'path';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:' + path.join(__dirname, 'prisma', 'test.db');

export default {
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
};
