// Server-only Neon Postgres access for participant data.
// DATABASE_URL is injected by the Vercel Neon integration.
// The table is created on first use so no migration step is needed.

import { neon } from '@neondatabase/serverless';

type Sql = ReturnType<typeof neon>;

let _sql: Sql | null = null;
let _tableReady = false;

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getSql(): Sql {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}

async function ensureTable(sql: Sql): Promise<void> {
  if (_tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS wikicred_participants (
      participant_id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  _tableReady = true;
}

export interface ParticipantRow {
  participant_id: string;
  data: unknown;
  created_at: string;
  updated_at: string;
}

export async function upsertParticipant(participantId: string, data: unknown): Promise<void> {
  const sql = getSql();
  await ensureTable(sql);
  await sql`
    INSERT INTO wikicred_participants (participant_id, data)
    VALUES (${participantId}, ${JSON.stringify(data)}::jsonb)
    ON CONFLICT (participant_id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
}

export async function listParticipants(): Promise<ParticipantRow[]> {
  const sql = getSql();
  await ensureTable(sql);
  const rows = await sql`
    SELECT participant_id, data, created_at, updated_at
    FROM wikicred_participants
    ORDER BY created_at DESC
  `;
  return rows as ParticipantRow[];
}

export async function deleteAllExcept(keepId: string): Promise<{ deleted: number; total: number }> {
  const sql = getSql();
  await ensureTable(sql);
  const [{ count }] = (await sql`
    SELECT count(*)::int AS count FROM wikicred_participants
  `) as Array<{ count: number }>;
  const deletedRows = (await sql`
    DELETE FROM wikicred_participants
    WHERE participant_id <> ${keepId}
    RETURNING participant_id
  `) as Array<{ participant_id: string }>;
  return { deleted: deletedRows.length, total: count };
}
