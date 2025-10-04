/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    verbose: true,
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    
    // TypeScript configuration
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: {
                module: 'ESNext',
                target: 'ES6',
                moduleResolution: 'node',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                skipLibCheck: true,
            }
        }],
        '^.+\\.tsx$': ['ts-jest', {
            tsconfig: {
                module: 'ESNext',
                target: 'ES6',
                moduleResolution: 'node',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                skipLibCheck: true,
                jsx: 'react-jsx',
            }
        }],
    },
    
    // File extensions to consider
    moduleFileExtensions: ['js', 'ts', 'tsx'],
    
    // Test file patterns
    testMatch: [
        '<rootDir>/tests/**/*.test.ts',
        '<rootDir>/tests/**/*.test.tsx',
    ],
    
    // Module resolution
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
        '^main$': '<rootDir>/main.ts',
    },
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/test-setup.ts'],
    
    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/main.js',
    ],
    
    // Coverage settings
    collectCoverageFrom: [
        'src/**/*.ts',
        'src/**/*.tsx',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
        '!src/**/*.test.ts',
        '!src/**/*.test.tsx',
    ],
};