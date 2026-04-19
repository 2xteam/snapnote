module.exports = {
  apps: [
    {
      name: "snapmath",
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
