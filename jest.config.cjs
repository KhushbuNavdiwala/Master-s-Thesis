const { createDefaultPreset } = require("ts-jest");
const { transform } = createDefaultPreset();

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",

    // Treat .ts files as ESM
    extensionsToTreatAsEsm: [".ts"],

    // New-style transform config (no deprecated globals usage)
    transform: {
        ...transform,
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                useESM: true,
                tsconfig: {
                    module: "ES2022",
                    target: "ES2022",
                    esModuleInterop: true
                }
            }
        ]
    },

    // Tell Jest where tests live
    testMatch: ["**/tests/**/*.test.ts"]
};