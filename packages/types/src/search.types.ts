import type { EmailDocument } from './email.types';

export type MatchingStrategy = 'last' | 'all' | 'frequency';

export interface SearchQuery {
	query: string;
	filters?: Record<string, any>;
	filterString?: string;
	page?: number;
	limit?: number;
	matchingStrategy?: MatchingStrategy;
}

export interface SearchHit extends EmailDocument {
	_matchesPosition?: {
		[key: string]: { start: number; length: number; indices?: number[] }[];
	};
	_formatted?: Partial<EmailDocument>;
}

export interface SearchResult {
	hits: SearchHit[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	processingTimeMs: number;
}

// --- Advanced Search Types ---

export interface AdvancedSearchQuery {
	query?: string;
	filters?: AdvancedSearchFilters;
	facets?: string[];
	sort?: string;
	page?: number;
	limit?: number;
	matchingStrategy?: MatchingStrategy;
	attachmentsOnly?: boolean;
}

export interface AdvancedSearchFilters {
	from?: string;
	to?: string;
	cc?: string;
	bcc?: string;
	dateFrom?: string;
	dateTo?: string;
	hasAttachments?: boolean;
	ingestionSourceId?: string;
	tags?: string[];
	path?: string;
	sizeMin?: number;
	sizeMax?: number;
}

// --- Suggest Types ---

export interface SuggestHit {
	id: string;
	subject: string;
	from: string;
	senderName: string;
	timestamp: number;
	hasAttachments: boolean;
}

export interface SuggestResult {
	hits: SuggestHit[];
	processingTimeMs: number;
}

export interface FacetDistribution {
	[attribute: string]: Record<string, number>;
}

export interface FacetStats {
	[attribute: string]: { min: number; max: number };
}

export interface AdvancedSearchResult extends SearchResult {
	facetDistribution?: FacetDistribution;
	facetStats?: FacetStats;
}

// --- Saved Search Types ---

export interface SavedSearch {
	id: string;
	userId: string;
	name: string;
	query: AdvancedSearchQuery;
	createdAt: string;
	updatedAt: string;
}

export interface CreateSavedSearchDto {
	name: string;
	query: AdvancedSearchQuery;
}

export interface UpdateSavedSearchDto {
	name?: string;
	query?: AdvancedSearchQuery;
}
