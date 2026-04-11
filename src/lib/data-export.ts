import type { ParticipantData } from '@/types';

// ============================================================
// Data Export / Import — all localStorage, no server
// ============================================================

const PREFIX = 'wikicred_participant_data_';

export function saveParticipantData(data: ParticipantData): void {
  localStorage.setItem(
    `${PREFIX}${data.participant.id}`,
    JSON.stringify(data)
  );
}

export function loadParticipantData(participantId: string): ParticipantData | null {
  const raw = localStorage.getItem(`${PREFIX}${participantId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParticipantData;
  } catch {
    return null;
  }
}

/**
 * Trigger a browser download of a single participant's data as JSON.
 */
export function exportParticipantJSON(data: ParticipantData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `participant_${data.participant.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read an uploaded JSON file and parse it as ParticipantData.
 */
export function importParticipantJSON(file: File): Promise<ParticipantData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ParticipantData;
        if (!data.participant?.id) {
          reject(new Error('Invalid participant data: missing participant.id'));
          return;
        }
        resolve(data);
      } catch (err) {
        reject(new Error(`Failed to parse JSON: ${err}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Scan localStorage for all saved participant data entries.
 */
export function getAllParticipantData(): ParticipantData[] {
  const results: ParticipantData[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;

    try {
      const data = JSON.parse(localStorage.getItem(key)!) as ParticipantData;
      if (data.participant?.id) {
        results.push(data);
      }
    } catch {
      // skip corrupt entries
    }
  }
  return results;
}

/**
 * Generate and download a CSV with one row per participant,
 * summarizing key metrics from their sessions and survey.
 */
export function exportAllCSV(participants: ParticipantData[]): void {
  const headers = [
    'participantId',
    'email',
    'wikiUsername',
    'assignedOrder',
    'yearsActive',
    'approxEditCount',
    'contentAreas',
    'socialMediaConsultFrequency',
    'confidenceInSourcingPre',
    'socialMediaUsefulnessPre',
    'session1_condition',
    'session1_articleId',
    'session1_deviceType',
    'session1_totalEditTime',
    'session1_editCount',
    'session1_citationCount',
    'session1_arbiterInteractionCount',
    'session2_condition',
    'session2_articleId',
    'session2_deviceType',
    'session2_totalEditTime',
    'session2_editCount',
    'session2_citationCount',
    'session2_arbiterInteractionCount',
    'confidencePost',
    'socialMediaUsefulnessPost',
    'wouldUseTool',
    'arbiterShowedNewInfo',
    'arbiterChangedEditing',
  ];

  const rows = participants.map((p) => {
    const s1 = p.sessions[0];
    const s2 = p.sessions[1];

    return [
      p.participant.id,
      p.participant.email,
      p.participant.wikiUsername ?? '',
      p.participant.assignedOrder,
      p.participant.experience.yearsActive,
      p.participant.experience.approxEditCount,
      p.participant.experience.contentAreas.join('; '),
      p.participant.experience.socialMediaConsultFrequency,
      p.participant.experience.confidenceInSourcing,
      p.participant.experience.socialMediaUsefulness,
      s1?.condition ?? '',
      s1?.articleId ?? '',
      s1?.deviceType ?? '',
      s1?.totalEditTime ?? '',
      s1?.editEvents.length ?? '',
      s1?.citationsAdded.length ?? '',
      s1?.arbiterInteractions.length ?? '',
      s2?.condition ?? '',
      s2?.articleId ?? '',
      s2?.deviceType ?? '',
      s2?.totalEditTime ?? '',
      s2?.editEvents.length ?? '',
      s2?.citationsAdded.length ?? '',
      s2?.arbiterInteractions.length ?? '',
      p.survey?.confidencePost ?? '',
      p.survey?.socialMediaUsefulnessPost ?? '',
      p.survey?.wouldUseTool ?? '',
      p.survey?.arbiterShowedNewInfo ?? '',
      p.survey?.arbiterChangedEditing ?? '',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        const str = String(cell);
        // Escape fields that contain commas, quotes, or newlines
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `wikicredcon_all_participants_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
