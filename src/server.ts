import app from "./app";
import config from "./app/config";
import { startBackgroundJobs } from "./app/jobs/scheduler";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import { seedSuperAdmin, seedTesterAdmin } from "./app/utils/seed";

const main = async () => {
  await prisma.$connect();
  console.log("Connected to PostgreSQL.");

  await seedSuperAdmin();
  await seedTesterAdmin();

  const server = app.listen(config.port, () => {
    console.log(`EventFlow API is running on port ${config.port}`);
  });

  redisClient
    .connect()
    .then(() => console.log("Connected to Redis."))
    .catch((error) => console.error("Redis unavailable:", error));

  startBackgroundJobs();

  const shutdown = async (signal: string) => {
    console.log(`${signal} received. Shutting down EventFlow...`);

    server.close(async () => {
      if (redisClient.isOpen) await redisClient.quit().catch(() => undefined);
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

main().catch(async (error) => {
  console.error("Failed to start EventFlow:", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
