import 'server-only';

import { setTimeout as delay } from 'node:timers/promises';
import type { NatsConnection } from 'nats';

let natsConnection: Promise<NatsConnection | null> | null = null;

type StringLike = string | Record<string, unknown>;

async function loadNats(): Promise<typeof import('nats')> {
  return import('nats');
}

async function createConnection(): Promise<NatsConnection | null> {
  const url = process.env.NATS_URL;

  if (!url) {
    console.warn('[NATS] NATS_URL is not configured. Falling back to no-op publisher.');
    return null;
  }

  try {
    const { connect } = await loadNats();
    const connection = await connect({
      servers: url.split(','),
      name: process.env.NATS_CLIENT_NAME || 'spell-platform-web',
      reconnect: true,
      maxReconnectAttempts: parseInt(process.env.NATS_MAX_RECONNECT_ATTEMPTS || '5', 10),
      reconnectTimeWait: parseInt(process.env.NATS_RECONNECT_TIME_WAIT_MS || '2000', 10),
    });

    connection.closed().then((err: Error | void) => {
      if (err) {
        console.error('[NATS] Connection closed with error:', err);
      }
      natsConnection = null;
    });

    return connection;
  } catch (error) {
    console.error('[NATS] Failed to establish connection:', error);
    return null;
  }
}

async function getConnection(): Promise<NatsConnection | null> {
  if (!natsConnection) {
    natsConnection = createConnection();
  }
  return natsConnection;
}

function toUint8Array(payload: StringLike): Uint8Array {
  if (typeof payload === 'string') {
    return Buffer.from(payload, 'utf8');
  }

  try {
    return Buffer.from(JSON.stringify(payload), 'utf8');
  } catch (error) {
    console.error('[NATS] Failed to serialise payload', error);
    return Buffer.from('null');
  }
}

export async function publish(subject: string, payload: StringLike): Promise<void> {
  const connection = await getConnection();

  if (!connection) {
    console.warn('[NATS] publish skipped (no connection):', subject);
    return;
  }

  try {
    connection.publish(subject, toUint8Array(payload));
  } catch (error) {
    console.error(`[NATS] Failed to publish on subject "${subject}"`, error);
  }
}

export async function request<T = unknown>(
  subject: string,
  payload: StringLike,
  timeoutMs = parseInt(process.env.NATS_REQUEST_TIMEOUT_MS || '5000', 10)
): Promise<T | null> {
  const connection = await getConnection();

  if (!connection) {
    console.warn('[NATS] request skipped (no connection):', subject);
    return null;
  }

  try {
    const { JSONCodec } = await loadNats();
    const codec = JSONCodec<T>();
    const msg = await connection.request(subject, toUint8Array(payload), { timeout: timeoutMs });
    return codec.decode(msg.data);
  } catch (error) {
    console.error(`[NATS] Request on subject "${subject}" failed`, error);
    return null;
  }
}

export async function ensureConnection(retry = false): Promise<boolean> {
  const connection = await getConnection();

  if (connection) {
    return true;
  }

  if (!retry) {
    return false;
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await delay(500 * attempt);
    const reconnected = await getConnection();
    if (reconnected) {
      return true;
    }
  }

  return false;
}
