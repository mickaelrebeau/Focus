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
    '@nuxtjs/i18n',
  ],

  i18n: {
    // Les URLs restent identiques quelle que soit la langue (/connexion, /app/agenda…)
    strategy: 'no_prefix',
    defaultLocale: 'fr',
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
    ],
    // Pas de détection automatique : tant que toute l'app n'est pas traduite, un navigateur
    // anglophone verrait une interface mixte. La langue choisie est lue dans le cookie
    // `focus_locale` par app/plugins/03.locale.ts.
    detectBrowserLanguage: false,
  },

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
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    s3Bucket: process.env.S3_BUCKET || '',
    s3Endpoint: process.env.S3_ENDPOINT || '',
    s3AccessKey: process.env.S3_ACCESS_KEY || '',
    s3SecretKey: process.env.S3_SECRET_KEY || '',
    userjotSecretKey: process.env.USERJOT_SECRET_KEY || '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    public: {
      appName: 'Focus',
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      userjotProjectId: process.env.USERJOT_PROJECT_ID || '',
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    registerWebManifestInRouteRules: true,
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
      // Les pages /app sont rendues côté serveur : il n'existe pas de coquille /app à
      // précacher. Elles sont mises en cache à la consultation (voir runtimeCaching).
      navigateFallback: null,
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      // Noms de cache aussi utilisés par app/utils/offline-cache.ts (vidage à la déconnexion)
      runtimeCaching: [
        {
          // Pages de l'espace connecté : réseau d'abord, dernière version consultée hors ligne
          urlPattern: ({ request, url }) => request.mode === 'navigate' && /^\/app(\/|$)/.test(url.pathname),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'focus-pages',
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 },
            precacheFallback: { fallbackURL: '/offline' },
          },
        },
        {
          // Lectures nécessaires à l'agenda et au tableau de bord (GET uniquement)
          urlPattern: ({ url }) => /^\/api\/(auth\/me|occurrences|streak|goals)(\/|$)/.test(url.pathname),
          method: 'GET',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'focus-api',
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 },
          },
        },
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
    sourceMap: false,
    prerender: {
      routes: ['/'],
    },
  },

  typescript: {
    strict: true,
    tsConfig: {
      include: ['../types/**/*.d.ts'],
    },
  },
})
