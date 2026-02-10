import { Request, Response } from 'express';
import { SavedSearchService } from '../../services/SavedSearchService';

export class SavedSearchController {
	private savedSearchService: SavedSearchService;

	constructor() {
		this.savedSearchService = new SavedSearchService();
	}

	public findAll = async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = req.user?.sub;
			if (!userId) {
				res.status(401).json({ message: req.t('errors.unauthorized') });
				return;
			}

			const searches = await this.savedSearchService.findAllByUser(userId);
			res.status(200).json(searches);
		} catch (error) {
			const message = error instanceof Error ? error.message : req.t('errors.unknown');
			res.status(500).json({ message });
		}
	};

	public findById = async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = req.user?.sub;
			if (!userId) {
				res.status(401).json({ message: req.t('errors.unauthorized') });
				return;
			}

			const search = await this.savedSearchService.findById(req.params.id, userId);
			if (!search) {
				res.status(404).json({ message: req.t('search.savedSearchNotFound') });
				return;
			}
			res.status(200).json(search);
		} catch (error) {
			const message = error instanceof Error ? error.message : req.t('errors.unknown');
			res.status(500).json({ message });
		}
	};

	public create = async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = req.user?.sub;
			if (!userId) {
				res.status(401).json({ message: req.t('errors.unauthorized') });
				return;
			}

			const { name, query } = req.body;
			if (!name || !query) {
				res.status(400).json({ message: req.t('search.savedSearchNameRequired') });
				return;
			}

			const search = await this.savedSearchService.create({ name, query }, userId);
			res.status(201).json(search);
		} catch (error) {
			const message = error instanceof Error ? error.message : req.t('errors.unknown');
			res.status(500).json({ message });
		}
	};

	public update = async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = req.user?.sub;
			if (!userId) {
				res.status(401).json({ message: req.t('errors.unauthorized') });
				return;
			}

			const search = await this.savedSearchService.update(req.params.id, req.body, userId);
			res.status(200).json(search);
		} catch (error) {
			if (error instanceof Error && error.message === 'Saved search not found') {
				res.status(404).json({ message: req.t('search.savedSearchNotFound') });
				return;
			}
			const message = error instanceof Error ? error.message : req.t('errors.unknown');
			res.status(500).json({ message });
		}
	};

	public delete = async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = req.user?.sub;
			if (!userId) {
				res.status(401).json({ message: req.t('errors.unauthorized') });
				return;
			}

			await this.savedSearchService.delete(req.params.id, userId);
			res.status(204).send();
		} catch (error) {
			if (error instanceof Error && error.message === 'Saved search not found') {
				res.status(404).json({ message: req.t('search.savedSearchNotFound') });
				return;
			}
			const message = error instanceof Error ? error.message : req.t('errors.unknown');
			res.status(500).json({ message });
		}
	};
}
