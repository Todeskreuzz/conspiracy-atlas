// Central domain vocabulary shared by frontend and backend.
// Labels are resolved through the i18n system; only stable keys live here.

export const CATEGORY_SLUGS = [
  'politics-power',
  'secret-organizations',
  'intelligence-agencies',
  'space-ufos',
  'science-technology',
  'history',
  'economy-finance',
  'media-society',
  'internet-modern-myths',
  'secret-operations',
] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const EVIDENCE_STATUSES = [
  'historically_documented',
  'supported_by_evidence',
  'partially_supported',
  'disputed',
  'unverified',
  'debunked',
  'under_investigation',
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const NODE_KINDS = [
  'theory',
  'event',
  'organization',
  'person',
  'institution',
  'location',
  'document',
  'technology',
  'claim',
  'source',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** Kinds of red threads on the investigation wall. */
export const RELATION_KINDS = ['documented', 'claimed', 'thematic', 'temporal', 'unresolved', 'counter'] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

/** Whether a connection has been editorially verified or is only a suggestion. */
export const RELATION_VERIFICATIONS = ['documented', 'suggested'] as const;
export type RelationVerification = (typeof RELATION_VERIFICATIONS)[number];

export const ENTITY_TYPES = ['theory', 'event', 'organization', 'person', 'location', 'document', 'source', 'claim'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const SUBMISSION_STATUSES = [
  'draft',
  'pending_review',
  'changes_requested',
  'approved',
  'rejected',
  'published',
  'withdrawn',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const MODERATION_ACTIONS = ['approve', 'reject', 'request_changes', 'publish', 'withdraw', 'edit'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const SOURCE_TYPES = [
  'primary_document',
  'government_report',
  'court_record',
  'academic_paper',
  'book',
  'news_article',
  'reference_work',
  'archive_collection',
  'website',
  'other',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const EVIDENCE_RELATIONS = ['supports', 'refutes', 'context', 'documents'] as const;
export type EvidenceRelation = (typeof EVIDENCE_RELATIONS)[number];

export const REPORT_REASONS = ['misinformation', 'missing_source', 'copyright', 'harassment', 'spam', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const INVESTIGATION_NOTE_KINDS = [
  'note',
  'hypothesis',
  'source',
  'counter_argument',
  'document_link',
  'timeline_entry',
] as const;
export type InvestigationNoteKind = (typeof INVESTIGATION_NOTE_KINDS)[number];

export const LOCALES = ['en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const ANONYMOUS_NAME = 'Anonymous';

export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 50;
