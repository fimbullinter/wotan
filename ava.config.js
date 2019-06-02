export default {
    files: [
        "packages/*/test/*.spec.js"
    ],
    sources: [
        "packages/*/src/**/*.js",
        "packages/*/index.js"
    ],
    snapshotDir: "baselines",
    verbose: true,
};
