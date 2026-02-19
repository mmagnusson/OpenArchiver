import { Request, Response } from 'express';
import { SearchService } from '../../services/SearchService';
import { MatchingStrategies } from 'meilisearch';
import { parseSearchQuery, filterExpressionToMeiliString } from '../../services/QueryParser';
import type { AdvancedSearchQuery } from '@open-archiver/types';

export class SearchController {
	private searchService: SearchService;

	constructor() {
		this.searchService = new SearchService();
	}

	/**
	 * GET /search — backward-compatible keyword search, now enhanced with query parser.
	 * Supports field syntax like: from:john invoice has:attachment before:2024-01-01
	 */
	public search = async (req: Request, res: Response): Promise<void> => {
		try {
			const { keywords, page, limit, matchingStrategy } = req.query;
			const userId = req.user?.sub;

			if (!userId) {
				res.status(401).json({ message: req.t('errors.unauthorized') });
				return;
			}

			if (!keywords) {
				res.status(400).json({ message: req.t('search.keywordsRequired') });
				return;
			}

			// Parse keywords through QueryParser to extract field-specific filters
			const parsed = parseSearchQuery(keywords as string);

			// Build filter string from the expression tree (includes range filters)
			const filterString = parsed.filterExpression
				? filterExpressionToMeiliString(parsed.filterExpression)
				: undefined;

			const results = await this.searchService.searchEmails(
				{
					query: parsed.keywords,
					filterString,
					page: page ? parseInt(page as string) : 1,
					limit: limit ? parseInt(limit as string) : 10,
					matchingStrategy: matchingStrategy as MatchingStrategies,
				},
				userId,
				req.ip || 'unknown'
			);

			res.status(200).json(results);
		} catch (error) {
			const message = error instanceof Error ? error.message : req.t('errors.unknown');
			res.status(500).json({ message });
		}
	};

	/**
	 * POST /search/advanced — accepts structured JSON body for complex queries.
	 * Supports filters, facets, sorting, and pagination.
	 */
	public advancedSearch = async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = req.user?.sub;

			if (!userId) {
				res.status(401).json({ message: req.t('errors.unauthorized') });
				return;
			}

			const body: AdvancedSearchQuery = req.body;

			if (!body || typeof body !== 'object') {
				res.status(400).json({ message: req.t('search.invalidRequestBody') });
				return;
			}

			// Clamp limit to configured maximum
			if (body.limit && body.limit > 100) {
				body.limit = 100;
			}

			const results = await this.searchService.searchEmailsAdvanced(
				body,
				userId,
				req.ip || 'unknown'
			);

			res.status(200).json(results);
		} catch (error) {
			const message = error instanceof Error ? error.message : req.t('errors.unknown');
			res.status(500).json({ message });
		}
	};
}
