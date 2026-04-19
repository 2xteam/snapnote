module.exports = {
  apps: [
    {
      name: "snapnote",
      cwd: __dirname,
      script: "npm",
      args: "run start",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
