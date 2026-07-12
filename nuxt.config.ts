// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  sourcemap: {
    server: false,
    client: false,
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  vite: {
    build: {
      sourcemap: false,
    },
  },

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
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/icon.svg' },
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
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
    userjotSecretKey: process.env.USERJOT_SECRET_KEY || '',
    public: {
      appName: 'Focus',
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      userjotProjectId: process.env.USERJOT_PROJECT_ID || '',
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Focus',
      short_name: 'Focus',
      description: 'Réalisez vos objectifs avec responsabilité',
      lang: 'fr',
      theme_color: '#000000',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/app',
      icons: [
        { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackAllowlist: [/^\/$/],
      navigateFallbackDenylist: [/^\/api\//],
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
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
    sourceMap: false,
    prerender: {
      routes: ['/'],
    },
  },

  typescript: {
    strict: true,
  },
})
