const { defineConfig } = require('vite');
const vue = require('@vitejs/plugin-vue');
module.exports = defineConfig({ plugins: [vue()], base: '/im/admin/', server: { proxy: { '/im/api': { target: 'http://localhost:3100', rewrite: p => p.replace(/^\/im/, '') } } } });
