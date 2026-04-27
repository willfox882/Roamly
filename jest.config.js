/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss)$': '<rootDir>/tests/styleMock.ts',
  },
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['<rootDir>/tests/e2e/', '<rootDir>/node_modules/'],
  transform: {
    // Override `jsx: "preserve"` from tsconfig so Jest emits runnable JS for
    // .tsx files (Next.js handles the preserve→transform step in real builds).
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
};
