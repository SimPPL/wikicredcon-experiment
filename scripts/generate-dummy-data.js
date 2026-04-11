#!/usr/bin/env node
/**
 * Generate 10 realistic simulated participants for the WikiCredCon experiment.
 * Outputs a single JSON file that can be loaded into localStorage via the admin dashboard.
 *
 * Usage: node scripts/generate-dummy-data.js
 */

const fs = require('fs');
const path = require('path');

// --- Helpers ---

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function hashEmail(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i);
    hash |= 0;
  }
  return 'anon_' + Math.abs(hash).toString(36);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// --- Article section IDs (from actual data) ---

const SEMAGLUTIDE_SECTIONS = [
  'medical-uses', 'side-effects', 'contraindications', 'mechanism-of-action',
  'structure-and-pharmacology', 'history', 'clinical-trials-and-early-approvals-for-diabetes',
  'trials-for-obesity', 'for-cardiovascular-health', 'legal-status',
  'insurance-coverage', 'generics', 'economics', 'economic-impact-on-denmark',
  'counterfeits', 'compounded-versions', 'research', 'effect-on-lean-body-mass', 'hair-loss',
];

const VACCINE_SECTIONS = [
  'vaccine-misinfo-lead', 'extent', 'list-of-popular-misinformation',
  'vaccination-causes-idiopathic-conditions', 'alternative-remedies-to-vaccination',
  'vaccination-as-genocide', 'vaccine-components-contain-forbidden-additives',
  'vaccines-are-part-of-a-governmentalpharmaceutical-conspiracy',
  'vaccine-preventable-diseases-are-harmless', 'personal-anecdotes-about-harmed-individuals',
  'other-conspiracy-theories', 'impact', 'communication', 'social-media',
  'vaccine-preventable-diseases-have-been-eradicated',
];

// --- Participant profiles ---

const PROFILES = [
  { email: 'alice.wiki@example.com', username: 'AliceEditor', years: '10+ years', edits: '50,000+', areas: ['Science & Medicine', 'Biographies'] },
  { email: 'bob.contrib@example.com', username: 'BobTheContrib', years: '5-10 years', edits: '5,000-50,000', areas: ['History & Politics', 'Current Events'] },
  { email: 'carol.research@example.com', username: 'CarolResearch', years: '3-5 years', edits: '500-5,000', areas: ['Science & Medicine', 'Technology'] },
  { email: 'dave.wp@example.com', username: 'DaveWP', years: '1-3 years', edits: '50-500', areas: ['Technology', 'Arts & Culture'] },
  { email: 'eve.editor@example.com', username: 'EveEdits', years: '10+ years', edits: '50,000+', areas: ['Science & Medicine', 'History & Politics', 'Current Events'] },
  { email: 'frank.wiki@example.com', username: 'FrankWiki', years: '5-10 years', edits: '5,000-50,000', areas: ['Geography', 'History & Politics'] },
  { email: 'grace.med@example.com', username: 'GraceMed', years: '3-5 years', edits: '500-5,000', areas: ['Science & Medicine'] },
  { email: 'hank.newbie@example.com', username: '', years: '< 1 year', edits: '0-50', areas: ['Other'] },
  { email: 'iris.fact@example.com', username: 'IrisFactCheck', years: '5-10 years', edits: '5,000-50,000', areas: ['Current Events', 'Science & Medicine', 'Technology'] },
  { email: 'jake.policy@example.com', username: 'JakePolicyWonk', years: '3-5 years', edits: '500-5,000', areas: ['History & Politics', 'Biographies'] },
];

const FREQUENCIES = ['never', 'rarely', 'sometimes', 'often', 'always'];

// --- Generate a single edit session ---

function generateSession(participantId, condition, articleId, startTime) {
  const sections = articleId === 'semaglutide' ? SEMAGLUTIDE_SECTIONS : VACCINE_SECTIONS;
  const sessionId = generateId();
  const editDuration = randInt(420000, 580000); // 7-9.7 min of actual editing

  // Treatment participants tend to edit more sections and add more citations
  const isTreatment = condition === 'treatment';
  const numSectionsEdited = isTreatment ? randInt(4, 8) : randInt(2, 5);
  const editedSectionIds = pickN(sections, numSectionsEdited);

  // Generate edit events
  const editEvents = [];
  const sectionTimes = {};
  let cursor = startTime + randInt(5000, 30000); // deliberation time

  for (const sectionId of editedSectionIds) {
    const timeInSection = randInt(20000, 90000);
    sectionTimes[sectionId] = timeInSection;

    const numEditsInSection = randInt(2, 8);
    for (let i = 0; i < numEditsInSection; i++) {
      cursor += randInt(1000, 15000);
      editEvents.push({
        timestamp: cursor,
        sectionId,
        action: 'replace',
        contentBefore: 'original content excerpt...',
        contentAfter: 'edited content with improvements...',
      });
    }
  }

  // Edit summary event
  editEvents.push({
    timestamp: cursor + 5000,
    sectionId: '__edit_summary__',
    action: 'replace',
    contentBefore: '',
    contentAfter: `summary: Improved sourcing and clarity | minor: ${Math.random() > 0.5 ? 'yes' : 'no'}`,
  });

  // Citations — treatment gets more
  const numCitations = isTreatment ? randInt(2, 6) : randInt(0, 3);
  const citationsAdded = [];
  for (let i = 0; i < numCitations; i++) {
    citationsAdded.push({
      timestamp: startTime + randInt(60000, editDuration),
      sectionId: pick(editedSectionIds),
      referenceText: `Reference ${i + 1}: Published study on ${articleId}`,
      url: `https://doi.org/10.1000/example-${randInt(1000, 9999)}`,
    });
  }

  // Tab blur events
  const numTabBlurs = randInt(1, 5);
  const tabBlurEvents = [];
  for (let i = 0; i < numTabBlurs; i++) {
    tabBlurEvents.push({
      timestamp: startTime + randInt(30000, editDuration),
      duration: randInt(2000, 15000),
    });
  }

  // Arbiter interactions (treatment only)
  const arbiterInteractions = [];
  if (isTreatment) {
    const numInteractions = randInt(5, 20);
    for (let i = 0; i < numInteractions; i++) {
      arbiterInteractions.push({
        timestamp: startTime + randInt(10000, editDuration),
        claimId: `claim_${randInt(1, 15)}`,
        action: pick(['view', 'click', 'expand', 'collapse']),
        duration: randInt(1000, 8000),
      });
    }
  }

  // Final content — simulate edited sections
  const finalContent = {};
  for (const sectionId of sections) {
    if (editedSectionIds.includes(sectionId)) {
      finalContent[sectionId] = `Improved content for ${sectionId} with better sourcing and clarity. Additional context added based on ${isTreatment ? 'social media claims analysis and' : ''} editorial judgment.`;
    } else {
      finalContent[sectionId] = `Original content for ${sectionId} unchanged.`;
    }
  }

  // Computed metrics — treatment condition shows better improvements
  const baselineSimilarity = randFloat(0.45, 0.65);
  const improvementBoost = isTreatment ? randFloat(0.05, 0.20) : randFloat(-0.02, 0.10);
  const groundTruthSimilarity = Math.min(0.95, baselineSimilarity + improvementBoost);

  const wordsAdded = isTreatment ? randInt(80, 250) : randInt(30, 150);
  const wordsRemoved = randInt(10, 60);

  const computedMetrics = {
    wordsAdded,
    wordsRemoved,
    netWordsChanged: wordsAdded - wordsRemoved,
    charactersAdded: wordsAdded * randInt(4, 7),
    charactersRemoved: wordsRemoved * randInt(4, 6),
    citationsAdded: numCitations,
    citationUrls: citationsAdded.map(c => c.url).filter(Boolean),
    sectionsWithNewCitations: [...new Set(citationsAdded.map(c => c.sectionId))],
    sectionsEdited: numSectionsEdited,
    sectionsUntouched: sections.length - numSectionsEdited,
    totalSections: sections.length,
    deliberationTimeMs: editEvents.length > 1 ? editEvents[0].timestamp - startTime : 15000,
    averageEditIntervalMs: editDuration / Math.max(1, editEvents.length - 1),
    editBurstCount: randInt(2, 7),
    tabSwitchCount: numTabBlurs,
    totalTabAwayMs: tabBlurEvents.reduce((s, e) => s + e.duration, 0),
    similarityToGroundTruth: groundTruthSimilarity,
    similarityToBaseline: baselineSimilarity,
    improvementOverBaseline: improvementBoost,
    sectionImprovements: Object.fromEntries(
      editedSectionIds.map(sid => [sid, randFloat(isTreatment ? 0.02 : -0.01, isTreatment ? 0.15 : 0.08)])
    ),
    citationsInPast: randInt(5, 15),
    citationsInCurrent: randInt(10, 25),
    citationsAddedByEditor: numCitations,
    citationsRemovedByEditor: randInt(0, 2),
    citationsMatchingCurrent: randInt(0, numCitations),
    citationRecoveryRate: numCitations > 0 ? randFloat(0.1, 0.6) : 0,
    arbiterClaimsViewed: isTreatment ? new Set(arbiterInteractions.filter(a => a.action === 'view' || a.action === 'click').map(a => a.claimId)).size : 0,
    arbiterClaimsCoveredInEdits: isTreatment ? randInt(1, 5) : 0,
    arbiterTimeSpentMs: isTreatment ? arbiterInteractions.reduce((s, a) => s + a.duration, 0) : 0,
  };

  return {
    sessionId,
    participantId,
    condition,
    articleId,
    deviceType: Math.random() > 0.8 ? 'mobile' : 'desktop',
    startedAt: startTime,
    endedAt: startTime + editDuration,
    editEvents,
    sectionTimes,
    hoverEvents: [],
    citationsAdded,
    tabBlurEvents,
    arbiterInteractions,
    linkClicks: [],
    finalContent,
    totalEditTime: editDuration,
    computedMetrics,
  };
}

// --- Generate survey response ---

function generateSurvey(participantId, treatmentSession) {
  const hadArbiter = treatmentSession != null;
  return {
    participantId,
    socialMediaUsefulnessPost: randInt(2, 5),
    confidencePost: randInt(3, 5),
    editingSelfEfficacy: randInt(3, 5),
    informationSufficiency: randInt(2, 5),
    perceivedDifficulty: randInt(1, 4),
    sourceDiversity: randInt(2, 5),
    trustInQuality: randInt(3, 5),
    arbiterShowedNewInfo: hadArbiter && Math.random() > 0.3,
    arbiterShowedNewInfoText: hadArbiter ? 'The claims panel showed me trending discussions I was not aware of.' : undefined,
    arbiterChangedEditing: hadArbiter && Math.random() > 0.4,
    arbiterChangedEditingText: hadArbiter ? 'I added a citation to address a widely-shared claim.' : undefined,
    wouldUseTool: randInt(3, 5),
    mostUsefulThing: pick([
      'Seeing which claims were spreading most helped prioritize edits.',
      'The sidebar made it easy to identify gaps in the article.',
      'Knowing what people discuss online gave me editing direction.',
      'Cross-referencing social media claims with article content was valuable.',
    ]),
    misleadingOrUnhelpful: pick([
      'Some claims were outdated.',
      'A few low-engagement posts were not very relevant.',
      null,
      null,
    ]) || undefined,
    openFeedback: pick([
      'Would be great to filter claims by recency.',
      'Overall a useful tool for Wikipedia editors.',
      'The interface was intuitive.',
      null,
    ]) || undefined,
    completedAt: Date.now() - randInt(0, 86400000),
  };
}

// --- Main generator ---

function generateAllParticipants() {
  const output = {};
  const baseTime = Date.now() - 3600000; // 1 hour ago

  for (let i = 0; i < PROFILES.length; i++) {
    const profile = PROFILES[i];
    const participantId = generateId();
    const isEven = i % 2 === 0;
    const order = isEven ? 'arbiter-first' : 'control-first';

    const participant = {
      id: participantId,
      emailHash: hashEmail(profile.email),
      wikiUsername: profile.username || undefined,
      experience: {
        yearsActive: profile.years,
        approxEditCount: profile.edits,
        contentAreas: profile.areas,
        socialMediaConsultFrequency: pick(FREQUENCIES),
        confidenceInSourcing: randInt(2, 5),
        socialMediaUsefulness: randInt(1, 4),
      },
      assignedOrder: order,
      articleAssignment: isEven
        ? { arbiter: 'semaglutide', control: 'vaccine-misinfo' }
        : { arbiter: 'vaccine-misinfo', control: 'semaglutide' },
      consent: { consentedAt: baseTime - 300000, version: '1.0' },
      createdAt: baseTime - 300000 + i * 60000,
    };

    // Session 1
    const session1Start = baseTime + i * 120000;
    let session1, session2;

    if (order === 'arbiter-first') {
      session1 = generateSession(participantId, 'treatment', participant.articleAssignment.arbiter, session1Start);
      session2 = generateSession(participantId, 'control', participant.articleAssignment.control, session1Start + 700000);
    } else {
      session1 = generateSession(participantId, 'control', participant.articleAssignment.control, session1Start);
      session2 = generateSession(participantId, 'treatment', participant.articleAssignment.arbiter, session1Start + 700000);
    }

    const treatmentSession = [session1, session2].find(s => s.condition === 'treatment');
    const survey = generateSurvey(participantId, treatmentSession);

    const participantData = {
      participant,
      sessions: [session1, session2],
      survey,
    };

    // Store as localStorage format
    output[`wikicred_participant_data_${participantId}`] = JSON.stringify(participantData);
  }

  return output;
}

// --- Run ---

const data = generateAllParticipants();
const outPath = path.join(__dirname, '..', 'public', 'data', 'dummy-experiment', 'dummy-localstorage.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

console.log(`Generated 10 simulated participants → ${outPath}`);
console.log('Load via Admin Dashboard → "Generate Dummy Data" button');
