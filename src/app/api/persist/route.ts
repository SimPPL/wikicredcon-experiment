import { NextResponse } from 'next/server';
import { isDbConfigured, upsertParticipant, listParticipants, deleteAllExcept, getParticipant, deleteParticipants } from '@/lib/db';
import { EXPERIMENT } from '@/lib/constants';

// Participant data is stored in Neon Postgres (free tier, provisioned via the
// Vercel Marketplace — DATABASE_URL is injected automatically). The client
// keeps a localStorage copy and retries failed syncs, so a transient outage
// here never loses data.

const NOT_CONFIGURED = NextResponse.json(
  { error: 'Database not configured — set DATABASE_URL (Vercel Neon integration)' },
  { status: 503 }
);

// Listing every row (which carries participant emails) and deleting rows need
// the facilitator password in an x-admin-key header. Set ADMIN_KEY in Vercel;
// until then the /admin password is accepted.
function isAdmin(request: Request): boolean {
  const key = process.env.ADMIN_KEY || EXPERIMENT.ADMIN_PASSWORD;
  return request.headers.get('x-admin-key') === key;
}

const FORBIDDEN = () => NextResponse.json({ error: 'Admin key required' }, { status: 401 });

export async function POST(request: Request) {
  try {
    if (!isDbConfigured()) return NOT_CONFIGURED;

    const body = await request.json();
    const { participantId, data } = body;

    if (!participantId || !data) {
      return NextResponse.json(
        { error: 'Missing participantId or data' },
        { status: 400 }
      );
    }

    await upsertParticipant(participantId, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Persist error:', error);
    const unreachable = error instanceof TypeError;
    return NextResponse.json(
      { error: unreachable ? 'Storage backend unreachable' : 'Internal server error' },
      { status: unreachable ? 502 : 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // ?id= reads one row back so a self-serve run can confirm it was stored.
    const id = new URL(request.url).searchParams.get('id');
    if (!id && !isAdmin(request)) return FORBIDDEN();
    if (!isDbConfigured()) return NOT_CONFIGURED;
    if (id) {
      const row = await getParticipant(id);
      return row
        ? NextResponse.json({ participant_id: row.participant_id, updated_at: row.updated_at })
        : NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const rows = await listParticipants();
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isAdmin(request)) return FORBIDDEN();
    if (!isDbConfigured()) return NOT_CONFIGURED;

    const { searchParams } = new URL(request.url);
    const keepId = searchParams.get('keep');
    // ?id=a&id=b removes just those rows, for clearing test runs.
    const ids = searchParams.getAll('id').filter(Boolean);

    if (ids.length && keepId) {
      return NextResponse.json({ error: 'Use either ?id= or ?keep=, not both' }, { status: 400 });
    }
    if (ids.length) {
      const deleted = await deleteParticipants(ids);
      return NextResponse.json({ deleted, notFound: ids.filter((i) => !deleted.includes(i)) });
    }
    if (!keepId) {
      return NextResponse.json({ error: 'Must specify ?id=participant_id to delete, or ?keep=participant_id to protect' }, { status: 400 });
    }

    const { deleted, total } = await deleteAllExcept(keepId);
    return NextResponse.json({ kept: keepId, deleted, total });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
