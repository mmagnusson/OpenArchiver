import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { SavedSearchController } from '../controllers/saved-search.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requirePermission } from '../middleware/requirePermission';
import { AuthService } from '../../services/AuthService';

export const createSearchRouter = (
	searchController: SearchController,
	authService: AuthService
): Router => {
	const router = Router();
	const savedSearchController = new SavedSearchController();

	router.use(requireAuth(authService));

	// Existing GET endpoint (backward compatible, now with query parser)
	router.get('/', requirePermission('search', 'archive'), searchController.search);

	// Lightweight suggest endpoint for search-as-you-type
	router.get('/suggest', requirePermission('search', 'archive'), searchController.suggest);

	// Advanced search via POST with structured JSON body
	router.post(
		'/advanced',
		requirePermission('search', 'archive'),
		searchController.advancedSearch
	);

	// Saved searches CRUD
	router.get('/saved', requirePermission('search', 'archive'), savedSearchController.findAll);
	router.get(
		'/saved/:id',
		requirePermission('search', 'archive'),
		savedSearchController.findById
	);
	router.post('/saved', requirePermission('search', 'archive'), savedSearchController.create);
	router.put('/saved/:id', requirePermission('search', 'archive'), savedSearchController.update);
	router.delete(
		'/saved/:id',
		requirePermission('search', 'archive'),
		savedSearchController.delete
	);

	return router;
};
