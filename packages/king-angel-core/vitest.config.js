const { defineConfig } = require("vitest/config");
const path = require("node:path");

const root = __dirname;

module.exports = defineConfig({
    root,
    cacheDir: "../../node_modules/.vite/king-angel-core",
    test: {
        include: ["index.test.js"],
        environment: "node",
        globals: true
    }
});
