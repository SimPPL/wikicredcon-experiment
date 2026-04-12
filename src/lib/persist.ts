'use client';

import type { ParticipantData } from '@/types';

const SYNC_STATUS_KEY = 'wikicred_sync_status';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

interface SyncStatus {
  participantId: string;
  lastSyncedAt: number | null;
  lastAttemptAt: number | null;
  status: 'synced' | 'pending' | 'failed';
  retryCount: number;
}

function getSyncStatus(): SyncStatus | null {
  const raw = localStorage.getItem(SYNC_STATUS_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setSyncStatus(status: SyncStatus) {
  localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
}

/**
 * Persist participant data to Supabase with retries.
 * Returns true if successful, false if all retries failed.
 * Stores sync status in localStorage so it can be retried later.
 */
export async function persistToServer(
  participantId: string,
  data: ParticipantData,
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    setSyncStatus({
      participantId,
      lastAttemptAt: Date.now(),
      lastSyncedAt: getSyncStatus()?.lastSyncedAt ?? null,
      status: 'pending',
      retryCount: attempt,
    });

    try {
      const res = await fetch('/api/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, data }),
      });

      if (res.ok) {
        setSyncStatus({
          participantId,
          lastSyncedAt: Date.now(),
          lastAttemptAt: Date.now(),
          status: 'synced',
          retryCount: attempt,
        });
        return true;
      }
    } catch {
      // Network error — will retry
    }

    // Wait before retrying (exponential backoff)
    if (attempt < MAX_RETRIES - 1) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }

  // All retries failed
  setSyncStatus({
    participantId,
    lastAttemptAt: Date.now(),
    lastSyncedAt: getSyncStatus()?.lastSyncedAt ?? null,
    status: 'failed',
    retryCount: MAX_RETRIES,
  });
  return false;
}

/**
 * Check if there's unsynced data and attempt to sync it.
 * Call this on page load to catch any failed syncs.
 */
export async function retryPendingSync(): Promise<boolean> {
  const status = getSyncStatus();
  if (!status || status.status === 'synced') return true;

  // Find the participant data in localStorage
  const raw = localStorage.getItem(`wikicred_participant_data_${status.participantId}`);
  if (!raw) return false;

  const data: ParticipantData = JSON.parse(raw);
  return persistToServer(status.participantId, data);
}

/**
 * Get the current sync status for display.
 */
export function getDisplaySyncStatus(): { text: string; color: string } {
  const status = getSyncStatus();
  if (!status) return { text: '', color: '' };
  if (status.status === 'synced') return { text: 'Data synced to server', color: '#14866d' };
  if (status.status === 'pending') return { text: 'Syncing...', color: '#d69e2e' };
  return { text: 'Sync failed — will retry', color: '#d33' };
}
