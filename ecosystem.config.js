module.exports = {
  apps: [
    {
      name: 'probyuti',
      script: 'server.js',
      cwd: 'G:/Cline/probyuti-site',
      autorestart: true,
      max_restarts: 50,
      env: {
        PORT: '3000',
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'probyuti2026'
      }
    },
    {
      name: 'probyuti-tunnel',
      script: 'G:/Cline/start_tunnel.cmd',
      autorestart: true,
      max_restarts: 100,
      restart_delay: 8000
    }
  ]
};
