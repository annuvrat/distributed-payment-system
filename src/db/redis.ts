import { Redis, type RedisOptions } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();
const redisUrl = process.env.REDIS_URL?.trim();
const redisHost = process.env.REDIS_HOST?.trim();
const redisPort = Number(process.env.REDIS_PORT?.trim() ?? '0');

if (!redisUrl && (!redisHost || !redisPort)) {
  throw new Error(
    'Missing Redis configuration. Set REDIS_URL, or both REDIS_HOST and REDIS_PORT in your .env file.'
  );
}

const defaultRedisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  connectTimeout: 10000,
};

function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
    throw new Error('REDIS_URL must use redis:// or rediss:// scheme');
  }

  return {
    ...defaultRedisOptions,
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) : undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  } as RedisOptions;
}

const redisOptions: RedisOptions = redisUrl
  ? parseRedisUrl(redisUrl)
  : {
      ...defaultRedisOptions,
      host: redisHost,
      port: redisPort,
    };

export const redisConnectionOptions = redisOptions;
export const redisConnection = new Redis(redisOptions);

redisConnection.on('connect', () => {
  console.log('[Redis] connecting...');
});

redisConnection.on('ready', () => {
  console.log('[Redis] ready');
});

redisConnection.on('error', (err: unknown) => {
  console.error(
    '[Redis] connection error',
    err instanceof Error ? err.message : String(err)
  );
});

redisConnection.on('close', () => {
  console.log('[Redis] closed');
});
