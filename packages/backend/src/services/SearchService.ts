import { Index, MeiliSearch, SearchParams } from 'meilisearch';
import { config } from '../config';
import type {
	SearchQuery,
	SearchResult,
	AdvancedSearchQuery,
	AdvancedSearchResult,
	EmailDocument,
	TopSender,
	User,
} from '@open-archiver/types';
import { FilterBuilder } from './FilterBuilder';
import { AuditService } from './AuditService';
import { parseSearchQuery, filterExpressionToMeiliString } from './QueryParser';

export class SearchService {
	private client: MeiliSearch;
	private auditService: AuditService;

	constructor() {
		this.client = new MeiliSearch({
			host: config.search.host,
			apiKey: config.search.apiKey,
		});
		this.auditService = new AuditService();
	}

	public async getIndex<T extends Record<string, any>>(name: string): Promise<Index<T>> {
		return this.client.index<T>(name);
	}

	public async addDocuments<T extends Record<string, any>>(
		indexName: string,
		documents: T[],
		primaryKey?: string
	) {
		const index = await this.getIndex<T>(indexName);
		if (primaryKey) {
			index.update({ primaryKey });
		}
		return index.addDocuments(documents);
	}

	public async search<T extends Record<string, any>>(
		indexName: string,
		query: string,
		options?: any
	) {
		const index = await this.getIndex<T>(indexName);
		return index.search(query, options);
	}

	public async deleteDocuments(indexName: string, ids: string[]) {
		const index = await this.getIndex(indexName);
		return index.deleteDocuments(ids);
	}

	public async deleteDocumentsByFilter(indexName: string, filter: string | string[]) {
		const index = await this.getIndex(indexName);
		return index.deleteDocuments({ filter });
	}

	public async searchEmails(
		dto: SearchQuery,
		userId: string,
		actorIp: string
	): Promise<SearchResult> {
		const {
			query,
			filters,
			filterString,
			page = 1,
			limit = 10,
			matchingStrategy = 'last',
		} = dto;
		const index = await this.getIndex<EmailDocument>('emails');

		const searchParams: SearchParams = {
			limit,
			offset: (page - 1) * limit,
			attributesToHighlight: ['*'],
			showMatchesPosition: true,
			sort: ['timestamp:desc'],
			matchingStrategy,
		};

		if (filterString) {
			// Use pre-built filter string (from QueryParser with boolean support)
			searchParams.filter = filterString;
		} else if (filters) {
			const filterStrings = Object.entries(filters).map(([key, value]) => {
				if (typeof value === 'string') {
					return `${key} = '${value}'`;
				}
				return `${key} = ${value}`;
			});
			searchParams.filter = filterStrings.join(' AND ');
		}

		// Create a filter based on the user's permissions.
		// This ensures that the user can only search for emails they are allowed to see.
		const { searchFilter } = await FilterBuilder.create(userId, 'archive', 'read');
		if (searchFilter) {
			// Convert the MongoDB-style filter from CASL to a MeiliSearch filter string.
			if (searchParams.filter) {
				// If there are existing filters, append the access control filter.
				searchParams.filter = `${searchParams.filter} AND ${searchFilter}`;
			} else {
				// Otherwise, just use the access control filter.
				searchParams.filter = searchFilter;
			}
		}
		// console.log('searchParams', searchParams);
		const searchResults = await index.search(query, searchParams);

		await this.auditService.createAuditLog({
			actorIdentifier: userId,
			actionType: 'SEARCH',
			targetType: 'ArchivedEmail',
			targetId: '',
			actorIp,
			details: {
				query,
				filters,
				page,
				limit,
				matchingStrategy,
			},
		});

		return {
			hits: searchResults.hits,
			total: searchResults.estimatedTotalHits ?? searchResults.hits.length,
			page,
			limit,
			totalPages: Math.ceil(
				(searchResults.estimatedTotalHits ?? searchResults.hits.length) / limit
			),
			processingTimeMs: searchResults.processingTimeMs,
		};
	}

	public async searchEmailsAdvanced(
		dto: AdvancedSearchQuery,
		userId: string,
		actorIp: string
	): Promise<AdvancedSearchResult> {
		const {
			query: rawQuery = '',
			filters,
			facets,
			sort,
			page = 1,
			limit = config.meili.searchDefaultLimit,
			matchingStrategy = 'last',
			attachmentsOnly,
		} = dto;

		// Parse the query string to extract boolean field filters
		const parsed = parseSearchQuery(rawQuery);
		const query = parsed.keywords;

		const clampedLimit = Math.min(limit, config.meili.searchMaxLimit);
		const index = await this.getIndex<EmailDocument>('emails');

		const searchParams: SearchParams = {
			limit: clampedLimit,
			offset: (page - 1) * clampedLimit,
			attributesToHighlight: ['*'],
			attributesToCrop: ['body'],
			cropLength: config.meili.cropLength,
			showMatchesPosition: true,
			...(sort ? { sort: [sort] } : {}),
			matchingStrategy,
		};

		// Restrict search to attachment fields only
		if (attachmentsOnly) {
			(searchParams as any).attributesToSearchOn = [
				'attachments.filename',
				'attachments.content',
			];
		}

		// Build filter string from structured filters
		const filterParts: string[] = [];
		if (filters) {
			if (filters.from) filterParts.push(`from = "${filters.from}"`);
			if (filters.to) filterParts.push(`to = "${filters.to}"`);
			if (filters.cc) filterParts.push(`cc = "${filters.cc}"`);
			if (filters.bcc) filterParts.push(`bcc = "${filters.bcc}"`);
			if (filters.dateFrom) {
				const ts = new Date(filters.dateFrom).getTime();
				if (!isNaN(ts)) filterParts.push(`timestamp >= ${ts}`);
			}
			if (filters.dateTo) {
				const ts = new Date(filters.dateTo).getTime();
				if (!isNaN(ts)) filterParts.push(`timestamp <= ${ts}`);
			}
			if (filters.hasAttachments !== undefined) {
				filterParts.push(`hasAttachments = ${filters.hasAttachments}`);
			}
			if (filters.ingestionSourceId) {
				filterParts.push(`ingestionSourceId = "${filters.ingestionSourceId}"`);
			}
			if (filters.tags && filters.tags.length > 0) {
				const tagFilters = filters.tags.map((t) => `tags = "${t}"`);
				filterParts.push(`(${tagFilters.join(' OR ')})`);
			}
			if (filters.path) {
				filterParts.push(`path = "${filters.path}"`);
			}
		}

		// Add boolean field filters parsed from the query string
		if (parsed.filterExpression) {
			filterParts.push(filterExpressionToMeiliString(parsed.filterExpression));
		}

		if (filterParts.length > 0) {
			searchParams.filter = filterParts.join(' AND ');
		}

		// Inject CASL access-control filter
		const { searchFilter } = await FilterBuilder.create(userId, 'archive', 'read');
		if (searchFilter) {
			if (searchParams.filter) {
				searchParams.filter = `${searchParams.filter} AND ${searchFilter}`;
			} else {
				searchParams.filter = searchFilter;
			}
		}

		// Request facets if specified
		if (facets && facets.length > 0) {
			searchParams.facets = facets;
		}

		const searchResults = await index.search(query, searchParams);

		await this.auditService.createAuditLog({
			actorIdentifier: userId,
			actionType: 'SEARCH',
			targetType: 'ArchivedEmail',
			targetId: '',
			actorIp,
			details: {
				query,
				filters,
				facets,
				sort,
				page,
				limit: clampedLimit,
				matchingStrategy,
				advanced: true,
			},
		});

		return {
			hits: searchResults.hits,
			total: searchResults.estimatedTotalHits ?? searchResults.hits.length,
			page,
			limit: clampedLimit,
			totalPages: Math.ceil(
				(searchResults.estimatedTotalHits ?? searchResults.hits.length) / clampedLimit
			),
			processingTimeMs: searchResults.processingTimeMs,
			facetDistribution: searchResults.facetDistribution,
			facetStats: searchResults.facetStats,
		};
	}

	public async getTopSenders(limit = 10): Promise<TopSender[]> {
		const index = await this.getIndex<EmailDocument>('emails');
		const searchResults = await index.search('', {
			facets: ['from'],
			limit: 0,
		});

		if (!searchResults.facetDistribution?.from) {
			return [];
		}

		// Sort and take top N
		const sortedSenders = Object.entries(searchResults.facetDistribution.from)
			.sort(([, countA], [, countB]) => countB - countA)
			.slice(0, limit)
			.map(([sender, count]) => ({ sender, count }));

		return sortedSenders;
	}

	public async configureEmailIndex() {
		const index = await this.getIndex('emails');
		await index.updateSettings({
			searchableAttributes: [
				'subject',
				'body',
				'from',
				'to',
				'cc',
				'bcc',
				'attachments.filename',
				'attachments.content',
				'userEmail',
				'tags',
				'path',
			],
			filterableAttributes: [
				'from',
				'to',
				'cc',
				'bcc',
				'timestamp',
				'ingestionSourceId',
				'userEmail',
				'hasAttachments',
				'tags',
				'path',
			],
			sortableAttributes: ['timestamp', 'from', 'subject'],
		});
	}
}
