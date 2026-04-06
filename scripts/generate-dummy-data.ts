/**
 * generate-dummy-data.ts
 *
 * Generates realistic dummy experiment data for 8 simulated participants
 * so the admin can walk through the full results experience.
 *
 * CLEARLY MARKED AS DUMMY DATA — all participant IDs prefixed with "DUMMY-"
 *
 * Usage: npx tsx scripts/generate-dummy-data.ts
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'data', 'dummy-experiment');

import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min: number, max: number) { return Math.random() * (max - min) + min; }

const ARTICLES = ['pfas', 'openai', 'ultra-processed-food', 'agi', 'misinformation', 'microplastics', 'glp1-receptor-agonist', 'vaccine-misinfo'];

const DUMMY_PARTICIPANTS = [
  { name: 'DUMMY-Alice', email: 'dummy-alice@example.com', years: '5-10 years', edits: '5,000-50,000' },
  { name: 'DUMMY-Bob', email: 'dummy-bob@example.com', years: '3-5 years', edits: '500-5,000' },
  { name: 'DUMMY-Carol', email: 'dummy-carol@example.com', years: '10+ years', edits: '50,000+' },
  { name: 'DUMMY-Dave', email: 'dummy-dave@example.com', years: '1-3 years', edits: '50-500' },
  { name: 'DUMMY-Eve', email: 'dummy-eve@example.com', years: '5-10 years', edits: '5,000-50,000' },
  { name: 'DUMMY-Frank', email: 'dummy-frank@example.com', years: '3-5 years', edits: '500-5,000' },
  { name: 'DUMMY-Grace', email: 'dummy-grace@example.com', years: '10+ years', edits: '50,000+' },
  { name: 'DUMMY-Hank', email: 'dummy-hank@example.com', years: '1-3 years', edits: '50-500' },
];

function generateSession(participantId: string, condition: 'treatment' | 'control', articleId: string) {
  // Treatment participants generally do better (more citations, closer to ground truth)
  const isTreatment = condition === 'treatment';
  const boost = isTreatment ? 1.3 : 1.0;

  return {
    sessionId: `DUMMY-session-${participantId}-${condition}`,
    participantId,
    condition,
    articleId,
    startedAt: Date.now() - rand(600000, 700000),
    endedAt: Date.now(),
    editEvents: Array.from({ length: rand(80, 300) }, (_, i) => ({
      timestamp: Date.now() - rand(0, 600000),
      sectionId: `section-${rand(1, 10)}`,
      action: 'replace' as const,
      contentBefore: 'old text',
      contentAfter: 'new text',
    })),
    sectionTimes: Object.fromEntries(
      Array.from({ length: rand(3, 8) }, (_, i) => [`section-${i + 1}`, rand(15000, 120000)])
    ),
    hoverEvents: [],
    citationsAdded: Array.from({ length: Math.round(rand(1, 5) * boost) }, () => ({
      timestamp: Date.now() - rand(0, 600000),
      sectionId: `section-${rand(1, 10)}`,
      referenceText: 'Added reference',
      url: 'https://example.com/source',
    })),
    tabBlurEvents: Array.from({ length: rand(1, 6) }, () => ({
      timestamp: Date.now() - rand(0, 600000),
      duration: rand(5000, 30000),
    })),
    arbiterInteractions: isTreatment ? Array.from({ length: rand(5, 20) }, () => ({
      timestamp: Date.now() - rand(0, 600000),
      claimId: `claim-${rand(1, 10)}`,
      action: 'view' as const,
      duration: rand(2000, 15000),
    })) : [],
    finalContent: {},
    totalEditTime: rand(500000, 660000),
    computedMetrics: {
      wordsAdded: Math.round(rand(30, 150) * boost),
      wordsRemoved: rand(5, 30),
      netWordsChanged: Math.round(rand(25, 130) * boost),
      charactersAdded: Math.round(rand(200, 800) * boost),
      charactersRemoved: rand(20, 100),
      citationsAdded: Math.round(rand(1, 5) * boost),
      citationUrls: [],
      sectionsWithNewCitations: [],
      sectionsEdited: Math.round(rand(2, 6) * boost),
      sectionsUntouched: rand(4, 12),
      totalSections: rand(15, 25),
      deliberationTimeMs: rand(15000, 90000),
      averageEditIntervalMs: rand(1000, 5000),
      editBurstCount: rand(3, 12),
      tabSwitchCount: rand(1, 6),
      totalTabAwayMs: rand(10000, 60000),
      similarityToGroundTruth: randFloat(0.3, 0.5) + (isTreatment ? randFloat(0.05, 0.15) : 0),
      similarityToBaseline: randFloat(0.7, 0.9),
      improvementOverBaseline: randFloat(0.02, 0.12) + (isTreatment ? randFloat(0.03, 0.08) : 0),
      sectionImprovements: {},
      arbiterClaimsViewed: isTreatment ? rand(5, 15) : 0,
      arbiterClaimsCoveredInEdits: isTreatment ? rand(1, 5) : 0,
      arbiterTimeSpentMs: isTreatment ? rand(30000, 120000) : 0,
    },
  };
}

function main() {
  const allParticipants: any[] = [];

  for (let i = 0; i < DUMMY_PARTICIPANTS.length; i++) {
    const p = DUMMY_PARTICIPANTS[i];
    const isEven = i % 2 === 0;
    const articleA = ARTICLES[i % ARTICLES.length];
    const articleB = ARTICLES[(i + 1) % ARTICLES.length];

    const participant = {
      id: `DUMMY-${i + 1}`,
      emailHash: `dummy_${p.name.toLowerCase().replace('dummy-', '')}`,
      email: p.email,
      wikiUsername: `DUMMY_${p.name.replace('DUMMY-', '')}`,
      experience: {
        yearsActive: p.years,
        approxEditCount: p.edits,
        contentAreas: ['Science & Medicine', 'Technology'],
        socialMediaConsultFrequency: ['never', 'rarely', 'sometimes', 'often'][rand(0, 3)] as any,
        confidenceInSourcing: rand(3, 5),
        socialMediaUsefulness: rand(2, 4),
      },
      assignedOrder: isEven ? 'arbiter-first' : 'control-first',
      articleAssignment: {
        arbiter: isEven ? articleA : articleB,
        control: isEven ? articleB : articleA,
      },
      consent: { consentedAt: Date.now() - 3600000, version: '1.0' },
      createdAt: Date.now() - 3600000,
    };

    const session1 = generateSession(
      participant.id,
      isEven ? 'treatment' : 'control',
      isEven ? articleA : articleB
    );
    const session2 = generateSession(
      participant.id,
      isEven ? 'control' : 'treatment',
      isEven ? articleB : articleA
    );

    const survey = {
      participantId: participant.id,
      socialMediaUsefulnessPost: rand(2, 5),
      confidencePost: rand(3, 5),
      arbiterShowedNewInfo: Math.random() > 0.3,
      arbiterShowedNewInfoText: 'DUMMY: The sidebar showed claims I was not aware of.',
      arbiterChangedEditing: Math.random() > 0.4,
      arbiterChangedEditingText: 'DUMMY: I added content based on the claims shown.',
      wouldUseTool: rand(3, 5),
      mostUsefulThing: 'DUMMY: Seeing what people discuss on social media.',
      misleadingOrUnhelpful: 'DUMMY: Some claims were vague.',
      completedAt: Date.now(),
    };

    allParticipants.push({
      participant,
      sessions: [session1, session2],
      survey,
    });
  }

  // Save as a single file
  writeFileSync(join(OUT, 'dummy-participants.json'), JSON.stringify(allParticipants, null, 2));

  // Also generate a localStorage-compatible format
  // Each participant saved as wikicred_participant_data_{id}
  const lsData: Record<string, string> = {};
  for (const p of allParticipants) {
    lsData[`wikicred_participant_data_${p.participant.id}`] = JSON.stringify(p);
  }
  writeFileSync(join(OUT, 'dummy-localstorage.json'), JSON.stringify(lsData, null, 2));

  console.log(`Generated ${allParticipants.length} dummy participants`);
  console.log('Files saved to public/data/dummy-experiment/');
  console.log('\nTo load in admin dashboard:');
  console.log('1. Go to /admin, login with admin/demo');
  console.log('2. Open browser console');
  console.log('3. Paste the localStorage entries from dummy-localstorage.json');
  console.log('4. Click Refresh on the admin page');

  // Print summary
  console.log('\n=== DUMMY DATA SUMMARY ===');
  console.log('All IDs prefixed with DUMMY- to distinguish from real data\n');
  for (const p of allParticipants) {
    const t = p.sessions.find((s: any) => s.condition === 'treatment');
    const c = p.sessions.find((s: any) => s.condition === 'control');
    console.log(`${p.participant.id}: ${p.participant.assignedOrder}`);
    console.log(`  Treatment (${t.articleId}): ${t.computedMetrics.wordsAdded} words, ${t.citationsAdded.length} citations, improvement=${t.computedMetrics.improvementOverBaseline.toFixed(3)}`);
    console.log(`  Control   (${c.articleId}): ${c.computedMetrics.wordsAdded} words, ${c.citationsAdded.length} citations, improvement=${c.computedMetrics.improvementOverBaseline.toFixed(3)}`);
  }
}

main();
