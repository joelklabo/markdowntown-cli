/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular-deps",
      severity: "error",
      from: { path: "^src" },
      to: { circular: true },
    },
  ],
  options: {
    tsConfig: {
      fileName: "tsconfig.json",
    },
    // Keep the analysis fast and focused on repo code.
    exclude: {
      path: "(^node_modules/)|(^\\.next/)|(^dist/)|(^coverage/)",
    },
  },
};

