import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { participantId, data } = body;

    if (!participantId || !data) {
      return NextResponse.json(
        { error: 'Missing participantId or data' },
        { status: 400 }
      );
    }

    // Upsert participant data into Supabase
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/wikicred_participants`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          participant_id: participantId,
          data: data,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to persist data' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Persist error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const keepId = searchParams.get('keep');

    if (!keepId) {
      return NextResponse.json({ error: 'Must specify ?keep=participant_id to protect' }, { status: 400 });
    }

    // First fetch all rows
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/wikicred_participants?select=participant_id,created_at`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const allRows = await fetchRes.json();

    // Delete all rows EXCEPT the one to keep
    const toDelete = allRows.filter((r: { participant_id: string }) => r.participant_id !== keepId);

    let deleted = 0;
    for (const row of toDelete) {
      const delRes = await fetch(
        `${SUPABASE_URL}/rest/v1/wikicred_participants?participant_id=eq.${row.participant_id}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      if (delRes.ok) deleted++;
    }

    return NextResponse.json({
      kept: keepId,
      deleted,
      total: allRows.length,
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/wikicred_participants?select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    const rows = await response.json();
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
