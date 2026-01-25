/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/*.test.ts',
    '**/__tests__/matching.service.spec.ts',
    '**/__tests__/pairing.service.spec.ts',
    '**/__tests__/queue.service.spec.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  watchman: false,
};
