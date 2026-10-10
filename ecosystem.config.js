// Конфигурация PM2 — держит сайт запущенным и поднимает его после перезагрузки сервера.
// На сервере (Ubuntu) из папки проекта выполнить:
//   npm install
//   npm install -g pm2
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup        (выполнит команду, которую pm2 напечатает)
module.exports = {
  apps: [
    {
      name: 'probyuti',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
      },
    },
  ],
};
