import type { PublicImage } from './images';
import type {
  CategorySlug,
  EntityType,
  EvidenceRelation,
  EvidenceStatus,
  InvestigationNoteKind,
  NodeKind,
  RelationKind,
  RelationVerification,
  SourceType,
  SubmissionStatus,
} from './constants';
import type { RichNode } from './richtext';

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface Category {
  id: number;
  slug: CategorySlug;
  name: string;
  description: string | null;
}

export interface TheorySummary {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  category: CategorySlug;
  evidenceStatus: EvidenceStatus;
  imagePath: string | null;
  origin: 'editorial' | 'community';
  authorName: string | null;
  tags: string[];
  updatedAt: string;
}

export interface Source {
  id: number;
  title: string;
  publisher: string | null;
  author: string | null;
  publishedDate: string | null;
  sourceType: SourceType;
  isPrimary: boolean;
  url: string | null;
  lastChecked: string | null;
  qualityNote: string | null;
  notes: string | null;
}

export interface EvidenceLink {
  id: number;
  source: Source;
  relation: EvidenceRelation;
  note: string | null;
}

export interface Claim {
  id: number;
  text: string;
  evidenceStatus: EvidenceStatus;
  evidence: EvidenceLink[];
}

export interface CounterArgument {
  id: number;
  claimId: number | null;
  text: string;
  evidence: EvidenceLink[];
}

export interface EntityRef {
  type: EntityType;
  id: number;
  slug: string | null;
  title: string;
}

export interface Relationship {
  id: number;
  kind: RelationKind;
  verification: RelationVerification;
  label: string | null;
  note: string | null;
  direction: 'out' | 'in';
  other: EntityRef;
}

export interface EventSummary {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  startYear: number;
  endYear: number | null;
  isPeriod: boolean;
  evidenceStatus: EvidenceStatus;
  category: CategorySlug | null;
  location: { id: number; name: string; lat: number; lng: number; countryCode: string | null } | null;
  theoryIds: number[];
}

export interface TheoryDetail extends TheorySummary {
  background: string | null;
  originStory: string | null;
  body: RichNode | null;
  claims: Claim[];
  counterArguments: CounterArgument[];
  generalSources: EvidenceLink[];
  relationships: Relationship[];
  events: EventSummary[];
  imageCredit: string | null;
  /** Approved community images. */
  images: PublicImage[];
}

export interface Organization {
  id: number;
  slug: string;
  name: string;
  kind: string;
  description: string | null;
  founded: string | null;
  country: string | null;
  location: { lat: number; lng: number; name: string } | null;
}

export interface Person {
  id: number;
  slug: string;
  name: string;
  role: string | null;
  description: string | null;
  born: string | null;
  died: string | null;
}

export interface LocationItem {
  id: number;
  slug: string;
  name: string;
  countryCode: string | null;
  lat: number;
  lng: number;
  regionKind: string;
  description: string | null;
}

export interface DocumentItem {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  documentType: string;
  url: string | null;
  publishedDate: string | null;
  archiveName: string | null;
  licenseNote: string | null;
}

export interface BoardNode {
  id: number;
  entityType: EntityType | null;
  entityId: number | null;
  entitySlug: string | null;
  kind: NodeKind;
  title: string;
  summary: string | null;
  category: CategorySlug | null;
  evidenceStatus: EvidenceStatus | null;
  imagePath: string | null;
  tags: string[];
  groupKey: string | null;
  x: number;
  y: number;
}

export interface BoardEdge {
  id: number;
  source: number;
  target: number;
  kind: RelationKind;
  verification: RelationVerification;
  label: string | null;
  /** Derived at read time: both cases name the same person, organization or place. Never stored. */
  auto?: boolean;
  shared?: EntityRef[];
}

export interface Board {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  nodes: BoardNode[];
  edges: BoardEdge[];
}

export interface SubmissionSourceInput {
  title: string;
  url: string | null;
  publisher: string | null;
  sourceType: SourceType;
}

export interface SubmissionInput {
  title: string;
  subtitle: string | null;
  summary: string;
  body: RichNode;
  category: CategorySlug;
  tags: string[];
  sources: SubmissionSourceInput[];
  documentLinks: string[];
  counterArguments: string[];
  relatedEvents: string[];
  relatedTheoryIds: number[];
  language: 'en' | 'de';
  displayMode: 'named' | 'anonymous';
  displayName: string | null;
  turnstileToken: string | null;
}

export interface Submission extends Omit<SubmissionInput, 'turnstileToken' | 'displayName'> {
  id: number;
  status: SubmissionStatus;
  authorName: string;
  moderatorNote: string | null;
  publishedTheorySlug: string | null;
  createdAt: string;
  updatedAt: string;
  /** Only in the admin detail view. */
  images?: PublicImage[];
}

export interface Investigation {
  id: number;
  title: string;
  description: string | null;
  boardSlug: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationNote {
  id: number;
  kind: InvestigationNoteKind;
  title: string;
  body: string | null;
  url: string | null;
  eventDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    state?: string;
    field?: string;
  };
}

/** A visitor's note on a case file: a comment or an additional source. Public only after approval. */
export interface CaseNote {
  id: number;
  kind: 'comment' | 'source';
  body: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  authorName: string;
  language: 'en' | 'de';
  createdAt: string;
}

export interface AdminCaseNote extends CaseNote {
  status: 'pending' | 'approved' | 'rejected';
  moderatorNote: string | null;
  theory: { id: number; slug: string; title: string };
}
