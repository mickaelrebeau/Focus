import { bucket, defineRailway, github, postgres, preserve, project, redis, service, volume } from "railway/iac";

// Infrastructure du projet Railway « Focus » (environnement production).
// Remplace railway.toml (Config as Code, lu par Railway jusqu'au 2026-12-01).
// Workflow : `railway config plan` pour prévisualiser, `railway config apply` pour appliquer.
// Les secrets restent dans Railway : `preserve()` conserve la valeur distante sans l'écrire ici.

export default defineRailway(() => {
  const repo = github("mickaelrebeau/Focus", { checkSuites: false });
  const region = "europe-west4-drams3a";

  // Bases de données (réglages importés tels quels depuis Railway)
  const Redis = redis("Redis", { region });
  Redis.deploy = { startCommand: "/bin/sh -c \"rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH\"" };
  Redis.networking = { privateNetworkEndpoint: "redis", tcpProxies: { "6379": {} } };
  const Postgres = postgres("Postgres", { region });
  Postgres.networking = { privateNetworkEndpoint: "postgres", tcpProxies: { "5432": {} } };
  const volumeAlerts = { usage: { "100": {}, "80": {}, "95": {} } };
  const postgresVolume = volume("postgres-volume", { alerts: volumeAlerts, allowOnlineResize: true, region, sizeMB: 5000 });
  const redisVolume = volume("redis-volume", { alerts: volumeAlerts, allowOnlineResize: true, region, sizeMB: 5000 });
  const bundledRack = bucket("bundled-rack", { region: "ams" });

  // Service web (Nuxt). Réglages repris de railway.toml.
  const Focus = service("Focus", {
    source: repo,
    build: { builder: "RAILPACK" },
    start: "node .output/server/index.mjs",
    healthcheck: "/",
    healthcheckTimeout: 300,
    // Redémarrage « on failure » : politique par défaut de Railway, non déclarée
    replicas: { [region]: 1 },
    networking: { privateNetworkEndpoint: "focus" },
    env: {
      ADMIN_EMAIL: preserve(),
      ADMIN_PASSWORD: preserve(),
      APP_URL: preserve(),
      DATABASE_URL: preserve(),
      GOOGLE_CLIENT_ID: preserve(),
      GOOGLE_CLIENT_SECRET: preserve(),
      NODE_ENV: preserve(),
      REDIS_URL: preserve(),
      S3_ACCESS_KEY: preserve(),
      S3_BUCKET: preserve(),
      S3_ENDPOINT: preserve(),
      S3_SECRET_KEY: preserve(),
      SESSION_SECRET: preserve(),
      STRIPE_PUBLISHABLE_KEY: preserve(),
      STRIPE_SECRET_KEY: preserve(),
      STRIPE_WEBHOOK_SECRET: preserve(),
      USERJOT_PROJECT_ID: preserve(),
      USERJOT_SECRET_KEY: preserve(),
      VAPID_PRIVATE_KEY: preserve(),
      VAPID_PUBLIC_KEY: preserve(),
      VAPID_SUBJECT: preserve(),
    },
  });

  // Workers : exécutés depuis les sources avec tsx, sans build Nuxt ni healthcheck HTTP.
  // Ne pas leur donner NODE_ENV=production : pnpm n'installerait pas tsx (devDependency).
  const workerBuild = {
    buildCommand: "echo Worker: build Nuxt inutile",
    buildEnvironment: "V3" as const,
    builder: "RAILPACK" as const,
    watchPatterns: ["server/**", "shared/**", "package.json", "pnpm-lock.yaml"],
  };
  // Variables partagées avec le web, par référence (aucun secret recopié)
  const workerEnv = {
    DATABASE_URL: Focus.env.DATABASE_URL,
    REDIS_URL: Focus.env.REDIS_URL,
    VAPID_PUBLIC_KEY: Focus.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: Focus.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: Focus.env.APP_URL,
  };

  const worker = service("worker", {
    source: repo,
    build: workerBuild,
    start: "pnpm worker",
    replicas: { [region]: 1 },
    deploy: { restartPolicyType: "ALWAYS" },
    env: workerEnv,
  });

  const consequences = service("consequences", {
    source: repo,
    build: workerBuild,
    start: "pnpm worker:consequences",
    replicas: { [region]: 1 },
    deploy: { restartPolicyType: "ALWAYS" },
    env: { ...workerEnv, STRIPE_SECRET_KEY: Focus.env.STRIPE_SECRET_KEY },
  });

  return project("Focus", {
    resources: [Redis, Postgres, Focus, worker, consequences, postgresVolume, redisVolume, bundledRack],
  });
});
