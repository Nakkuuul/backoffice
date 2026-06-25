// PM2 process manager config for on-prem / broker local-server deployment.
//   pm2 start ecosystem.config.cjs --env production
//   pm2 save && pm2 startup   # persist across reboots
module.exports = {
  apps: [
    {
      name: 'backoffice',
      script: 'src/server.js',
      instances: 'max', // one worker per CPU core (cluster mode)
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      time: true,
    },
  ],
};
