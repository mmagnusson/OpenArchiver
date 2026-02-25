import { Request, Response } from 'express';
import { JobsService } from '../../services/JobsService';
import type {
	IGetQueueJobsRequestParams,
	IGetQueueJobsRequestQuery,
	JobStatus,
} from '@open-archiver/types';

export class JobsController {
	private jobsService: JobsService;

	constructor() {
		this.jobsService = new JobsService();
	}

	public getQueues = async (req: Request, res: Response) => {
		try {
			const queues = await this.jobsService.getQueues();
			res.status(200).json({ queues });
		} catch (error) {
			res.status(500).json({ message: 'Error fetching queues', error });
		}
	};

	public getQueueJobs = async (req: Request, res: Response) => {
		try {
			const { queueName } = req.params as unknown as IGetQueueJobsRequestParams;
			const { status, page, limit } = req.query as unknown as IGetQueueJobsRequestQuery;
			const pageNumber = parseInt(page, 10) || 1;
			const limitNumber = parseInt(limit, 10) || 10;
			const queueDetails = await this.jobsService.getQueueDetails(
				queueName,
				status,
				pageNumber,
				limitNumber
			);
			res.status(200).json(queueDetails);
		} catch (error) {
			res.status(500).json({ message: 'Error fetching queue jobs', error });
		}
	};

	public clearQueueJobs = async (req: Request, res: Response) => {
		try {
			const { queueName } = req.params;
			const { status } = req.query;

			if (!status || typeof status !== 'string') {
				res.status(400).json({ message: 'Missing required query parameter: status' });
				return;
			}

			const validStatuses: JobStatus[] = [
				'completed',
				'failed',
				'delayed',
				'waiting',
				'paused',
			];
			if (!validStatuses.includes(status as JobStatus)) {
				res.status(400).json({
					message: `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}`,
				});
				return;
			}

			const result = await this.jobsService.clearJobsByStatus(queueName, status as JobStatus);
			res.status(200).json(result);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error clearing queue jobs';
			res.status(500).json({ message });
		}
	};
}
