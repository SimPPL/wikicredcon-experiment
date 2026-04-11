// ============================================================
// WikiCredCon Experiment Platform — Type Definitions
// ============================================================

// --- Experiment Assignment ---

export type ExperimentOrder = 'arbiter-first' | 'control-first';
export type ExperimentCondition = 'treatment' | 'control';
export type ExperimentPhase =
  | 'registration'
  | 'editing-1'
  | 'transition'
  | 'editing-2'
  | 'survey'
  | 'complete';

// --- Participant ---

export interface EditingExperience {
  yearsActive: string;
  approxEditCount: string;
  contentAreas: string[];
  socialMediaConsultFrequency: 'never' | 'rarely' | 'sometimes' | 'often' | 'always';
  confidenceInSourcing: number; // 1-5
  socialMediaUsefulness: number; // 1-5
}

export interface ConsentRecord {
  consentedAt: number;
  version: string;
}

export interface Participant {
  id: string;
  // PII fields — stored separately in localStorage under wikicred_pii_{id}
  // The participant object in research data uses anonymized identifiers
  email?: string; // deprecated — use emailHash instead
  emailHash: string; // deterministic anonymous identifier
  wikiUsername?: string;
  experience: EditingExperience;
  assignedOrder: ExperimentOrder;
  articleAssignment: {
    arbiter: string; // articleId
    control: string; // articleId
  };
  consent: ConsentRecord;
  createdAt: number;
}

// --- Edit Session ---

export interface EditEvent {
  timestamp: number;
  sectionId: string;
  action: 'insert' | 'delete' | 'replace' | 'format';
  contentBefore: string;
  contentAfter: string;
}

export interface HoverEvent {
  timestamp: number;
  elementId: string;
  elementType: string;
  duration: number; // ms
}

export interface CitationEvent {
  timestamp: number;
  sectionId: string;
  referenceText: string;
  url?: string;
}

export interface TabBlurEvent {
  timestamp: number;
  duration: number; // ms away from tab
}

export interface ArbiterInteraction {
  timestamp: number;
  claimId: string;
  action: 'view' | 'click' | 'expand' | 'collapse';
  duration: number; // ms
}

export interface LinkClickEvent {
  timestamp: number;
  url: string;
  domain: string;
  sourceType: string; // 'source' | 'fact-check' | 'wikipedia' | 'claim-copy'
  action: 'click' | 'copy';
}

export interface EditSession {
  sessionId: string;
  participantId: string;
  condition: ExperimentCondition;
  articleId: string;
  deviceType: 'mobile' | 'desktop';
  startedAt: number;
  endedAt?: number;
  editEvents: EditEvent[];
  sectionTimes: Record<string, number>; // sectionId -> ms
  hoverEvents: HoverEvent[];
  citationsAdded: CitationEvent[];
  tabBlurEvents: TabBlurEvent[];
  arbiterInteractions: ArbiterInteraction[];
  linkClicks: LinkClickEvent[];
  finalContent: Record<string, string>; // sectionId -> final text
  totalEditTime: number; // ms
  // Computed metrics (populated on publish)
  computedMetrics?: ComputedSessionMetrics;
}

// Granular metrics computed after editing, based on published Wikipedia research
export interface ComputedSessionMetrics {
  // Content metrics (Adler & de Alfaro 2007; Warncke-Wang et al. 2013)
  wordsAdded: number;
  wordsRemoved: number;
  netWordsChanged: number;
  charactersAdded: number;
  charactersRemoved: number;
  // Citation metrics (Redi et al. 2019; Fetahu et al. 2015)
  citationsAdded: number;
  citationUrls: string[];
  sectionsWithNewCitations: string[];
  // Structural metrics
  sectionsEdited: number;
  sectionsUntouched: number;
  totalSections: number;
  // Behavioral metrics (Kittur & Kraut 2008; SuggestBot study)
  deliberationTimeMs: number; // time before first edit
  averageEditIntervalMs: number; // mean time between edits
  editBurstCount: number; // number of rapid editing bursts
  tabSwitchCount: number;
  totalTabAwayMs: number;
  // Ground truth metrics (experiment-specific)
  similarityToGroundTruth: number; // 0-1
  similarityToBaseline: number; // 0-1
  improvementOverBaseline: number; // how much closer to ground truth
  // Per-section ground truth
  sectionImprovements: Record<string, number>;
  // Citation comparison metrics
  citationsInPast: number;
  citationsInCurrent: number;
  citationsAddedByEditor: number; // new citations the editor added
  citationsRemovedByEditor: number; // citations the editor removed
  citationsMatchingCurrent: number; // editor's citations that match the current article
  citationRecoveryRate: number; // % of new-in-current citations that editor also added
  // Arbiter-specific (treatment only)
  arbiterClaimsViewed: number;
  arbiterClaimsCoveredInEdits: number;
  arbiterTimeSpentMs: number;
}

// --- Article Content ---

export interface Citation {
  id: string;
  index: number;
  text: string;
  url?: string;
}

export interface ArticleSection {
  id: string;
  title: string;
  level: number; // heading level (1, 2, 3, 4)
  content: string;
  citations: Citation[];
}

export interface Article {
  id: string;
  title: string;
  revisionDate: string; // ISO date
  revisionId?: string;
  qualityClass?: string;
  sections: ArticleSection[];
}

// --- Arbiter Claims ---

export type Platform = 'twitter' | 'reddit' | 'youtube' | 'bluesky';

export interface ClaimSource {
  title: string;
  url: string;
  publisher?: string;
  type: 'fact-check' | 'news' | 'wikipedia' | 'academic' | 'other';
  snippet?: string;
}

export interface ArbiterClaim {
  id: string;
  articleId: string;
  relevantSectionIds: string[];
  claimText: string;
  platform: Platform;
  sourceUrl?: string;
  sourceAuthor?: string;
  date: string;
  engagement: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
    total?: number;
  };
  topic: string;
  postText?: string;
  confidence?: 'high' | 'medium' | 'low';
  // Linked sources from Arbiter analysis
  sources?: ClaimSource[];
  factChecks?: ClaimSource[];
  wikipediaRefs?: ClaimSource[];
}

// --- Grouped Claims (for ClaimsSidebar) ---

export interface ClaimGroupItem {
  id: string;
  claimText: string;
  sourceAuthor: string;
  platform: string;
  engagement: number;
  postExcerpt: string;
}

export interface ClaimGroup {
  groupId: string;
  groupTitle: string;
  groupSummary: string;
  relevantSectionIds: string[];
  claimCount: number;
  totalEngagement: number;
  claims: ClaimGroupItem[];
  /** Optional linked sources (news articles, academic papers, etc.) */
  sources?: ClaimSource[];
  /** Optional fact-check results */
  factChecks?: ClaimSource[];
  /** Optional related Wikipedia pages (excluding the current article) */
  wikipediaRefs?: ClaimSource[];
}

// --- Survey ---

export interface SurveyResponse {
  participantId: string;
  socialMediaUsefulnessPost: number; // 1-5
  confidencePost: number; // 1-5
  editingSelfEfficacy: number; // 1-5
  informationSufficiency: number; // 1-5
  perceivedDifficulty: number; // 1-5
  sourceDiversity: number; // 1-5
  trustInQuality: number; // 1-5
  arbiterShowedNewInfo: boolean;
  arbiterShowedNewInfoText?: string;
  arbiterChangedEditing: boolean;
  arbiterChangedEditingText?: string;
  wouldUseTool: number; // 1-5
  mostUsefulThing?: string;
  misleadingOrUnhelpful?: string;
  openFeedback?: string;
  followUpEmail?: string;
  completedAt: number;
}

// --- Question-Based Evaluation ---

export interface ArticleQuestion {
  id: string;
  question: string;
  answer: string;
  relevantPassage: string;
  category: 'factual' | 'causal' | 'temporal' | 'comparison';
  difficulty: 'easy' | 'medium' | 'hard';
  sectionId: string;
}

export interface QuestionEvaluation {
  questionId: string;
  question: string;
  groundTruthAnswer: string;
  pastArticleAnswer: string;
  pastArticleAnswerable: boolean;
  pastArticleAccuracy: number;
  editedArticleAnswer: string;
  editedArticleAnswerable: boolean;
  editedArticleAccuracy: number;
}

export interface ArticleEvaluationSummary {
  articleId: string;
  totalQuestions: number;
  pastAnswerable: number;
  pastAccuracy: number;
  editedAnswerable: number;
  editedAccuracy: number;
  answerabilityImprovement: number;
  accuracyImprovement: number;
  evaluations: QuestionEvaluation[];
}

// --- Full Participant Data (for export/import) ---

export interface ParticipantData {
  participant: Participant;
  sessions: EditSession[];
  survey?: SurveyResponse;
  questionEvaluations?: ArticleEvaluationSummary[]; // post-experiment analysis
}
