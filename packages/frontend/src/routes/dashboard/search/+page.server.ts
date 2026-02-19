import type { PageServerLoad, RequestEvent } from './$types';
import { api } from '$lib/server/api';
import type {
	AdvancedSearchResult,
	AdvancedSearchQuery,
	MatchingStrategy,
	SavedSearch,
} from '@open-archiver/types';

async function loadSavedSearches(event: RequestEvent): Promise<SavedSearch[]> {
	try {
		const response = await api('/search/saved', event, { method: 'GET' });
		if (response.ok) return (await response.json()) as SavedSearch[];
		return [];
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async (event) => {
	const keywords = event.url.searchParams.get('keywords') || '';
	const page = parseInt(event.url.searchParams.get('page') || '1');
	const matchingStrategy = (event.url.searchParams.get('matchingStrategy') ||
		'last') as MatchingStrategy;
	const sortBy = event.url.searchParams.get('sortBy') || undefined;
	const attachmentsOnly = event.url.searchParams.get('attachmentsOnly') === 'true';

	// Advanced filter params
	const from = event.url.searchParams.get('from') || undefined;
	const to = event.url.searchParams.get('to') || undefined;
	const dateFrom = event.url.searchParams.get('dateFrom') || undefined;
	const dateTo = event.url.searchParams.get('dateTo') || undefined;
	const hasAttachmentsParam = event.url.searchParams.get('hasAttachments');
	const ingestionSourceId =
		event.url.searchParams.get('ingestionSourceId') || undefined;
	const path = event.url.searchParams.get('path') || undefined;

	const hasAdvancedFilters = !!(
		from ||
		to ||
		dateFrom ||
		dateTo ||
		hasAttachmentsParam ||
		ingestionSourceId ||
		path
	);

	// If no search criteria, return initial state with saved searches
	if (!keywords && !hasAdvancedFilters && !attachmentsOnly) {
		const savedSearches = await loadSavedSearches(event);
		return {
			searchResult: null,
			keywords: '',
			page: 1,
			matchingStrategy: 'last' as MatchingStrategy,
			filters: {},
			savedSearches,
			sortBy: undefined,
			attachmentsOnly: false,
		};
	}

	// Build advanced search request body
	const filters: AdvancedSearchQuery['filters'] = {};
	if (from) filters.from = from;
	if (to) filters.to = to;
	if (dateFrom) filters.dateFrom = dateFrom;
	if (dateTo) filters.dateTo = dateTo;
	if (hasAttachmentsParam !== null && hasAttachmentsParam !== undefined) {
		filters.hasAttachments = hasAttachmentsParam === 'true';
	}
	if (ingestionSourceId) filters.ingestionSourceId = ingestionSourceId;
	if (path) filters.path = path;

	const body: AdvancedSearchQuery = {
		query: keywords,
		page,
		limit: 10,
		matchingStrategy,
		facets: ['from', 'hasAttachments', 'tags', 'path'],
		filters:
			Object.keys(filters).length > 0 ? filters : undefined,
		...(sortBy ? { sort: sortBy } : {}),
		...(attachmentsOnly ? { attachmentsOnly: true } : {}),
	};

	try {
		const response = await api('/search/advanced', event, {
			method: 'POST',
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.json();
			const savedSearches = await loadSavedSearches(event);
			return {
				searchResult: null,
				keywords,
				page,
				matchingStrategy,
				filters,
				savedSearches,
				sortBy,
				attachmentsOnly,
				error: error.message,
			};
		}

		const searchResult = (await response.json()) as AdvancedSearchResult;
		const savedSearches = await loadSavedSearches(event);
		return {
			searchResult,
			keywords,
			page,
			matchingStrategy,
			filters,
			savedSearches,
			sortBy,
			attachmentsOnly,
		};
	} catch (error) {
		const savedSearches = await loadSavedSearches(event);
		return {
			searchResult: null,
			keywords,
			page,
			matchingStrategy,
			filters,
			savedSearches,
			sortBy,
			attachmentsOnly,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
};
