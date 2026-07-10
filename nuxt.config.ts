// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'Focus — Réalisez vos objectifs',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Focus vous aide à tenir vos objectifs. Gagnez des crédits en réussissant, engagez-vous avec responsabilité.' },
        { name: 'theme-color', content: '#000000' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' },
        { rel: 'apple-touch-icon', href: '/logo.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap' },
      ],
    },
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL || '',
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    adminEmail: process.env.ADMIN_EMAIL || 'rebeau.mickael@gmail.com',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    s3Bucket: process.env.S3_BUCKET || '',
    s3Endpoint: process.env.S3_ENDPOINT || '',
    s3AccessKey: process.env.S3_ACCESS_KEY || '',
    s3SecretKey: process.env.S3_SECRET_KEY || '',
    public: {
      appName: 'Focus',
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Focus',
      short_name: 'Focus',
      description: 'Réalisez vos objectifs avec responsabilité',
      theme_color: '#000000',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/app',
      icons: [
        { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      globIgnores: [
        '**/_payload.json',
        '_nuxt/builds/**/*.json',
        '**/node_modules/**/*',
      ],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      // Désactivé en dev : le SW n'est généré qu'au 1er chargement navigateur,
      // ce qui provoque ENOENT sur .nuxt/dev-sw-dist/sw.js. Actif en production.
      enabled: false,
      type: 'module',
      suppressWarnings: true,
    },
  },

  nitro: {
    preset: 'node-server',
  },

  typescript: {
    strict: true,
  },
})
