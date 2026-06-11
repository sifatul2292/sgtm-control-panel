// pm2 ecosystem — ensures node app auto-restarts on crash with backoff
module.exports = {
  apps: [
    {
      name: "sgtm-control-panel",
      script: "server.js",
      interpreter: "node",
      // restart on crash, max 10 restarts in 10 minutes before giving up
      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 3000,
      // capture stdout/stderr for pm2 logs
      out_file: "/var/log/sgtm-control-panel.log",
      error_file: "/var/log/sgtm-control-panel-error.log",
      merge_logs: true,
      // keep alive even if process exits with 0
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
