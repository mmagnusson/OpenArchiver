/**
 * Backfill script: Updates existing Meilisearch documents with
 * the new `hasAttachments` and `tags` fields.
 *
 * This is a lightweight migration that reads only the required columns from
 * the database and performs partial upserts in Meilisearch (existing document
 * fields are preserved — only the new fields are added).
 *
 * Usage:
 *   npx ts-node -r dotenv/config src/scripts/backfill-meilisearch-fields.ts
 */
import 'dotenv/config';
import { db } from '../database';
import { archivedEmails } from '../database/schema';
import { SearchService } from '../services/SearchService';
import { logger } from '../config/logger';
import { sql } from 'drizzle-orm';

const BATCH_SIZE = 500;

async function backfill() {
	const searchService = new SearchService();

	// Ensure index settings are up-to-date before backfilling
	logger.info('Configuring email index with new filterable attributes...');
	await searchService.configureEmailIndex();

	// Count total emails
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(archivedEmails);

	logger.info({ totalEmails: count }, 'Starting Meilisearch backfill for hasAttachments and tags');

	let offset = 0;
	let processed = 0;

	while (offset < count) {
		const batch = await db
			.select({
				id: archivedEmails.id,
				hasAttachments: archivedEmails.hasAttachments,
				tags: archivedEmails.tags,
			})
			.from(archivedEmails)
			.limit(BATCH_SIZE)
			.offset(offset);

		if (batch.length === 0) break;

		const partialDocs = batch.map((row) => ({
			id: row.id,
			hasAttachments: row.hasAttachments,
			tags: (row.tags as string[]) || [],
		}));

		await searchService.addDocuments('emails', partialDocs, 'id');
		processed += batch.length;
		offset += BATCH_SIZE;

		logger.info({ processed, total: count }, 'Backfill progress');
	}

	logger.info({ totalProcessed: processed }, 'Meilisearch backfill complete');
	process.exit(0);
}

backfill().catch((error) => {
	logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Backfill failed');
	process.exit(1);
});
