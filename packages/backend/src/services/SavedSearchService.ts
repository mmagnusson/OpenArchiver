import { db } from '../database';
import { savedSearches } from '../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import type {
	SavedSearch,
	CreateSavedSearchDto,
	UpdateSavedSearchDto,
	AdvancedSearchQuery,
} from '@open-archiver/types';

export class SavedSearchService {
	public async findAllByUser(userId: string): Promise<SavedSearch[]> {
		const results = await db.query.savedSearches.findMany({
			where: eq(savedSearches.userId, userId),
			orderBy: [desc(savedSearches.updatedAt)],
		});
		return results.map(this.toSavedSearch);
	}

	public async findById(id: string, userId: string): Promise<SavedSearch | null> {
		const result = await db.query.savedSearches.findFirst({
			where: and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)),
		});
		return result ? this.toSavedSearch(result) : null;
	}

	public async create(dto: CreateSavedSearchDto, userId: string): Promise<SavedSearch> {
		const [result] = await db
			.insert(savedSearches)
			.values({
				userId,
				name: dto.name,
				query: dto.query,
			})
			.returning();
		return this.toSavedSearch(result);
	}

	public async update(
		id: string,
		dto: UpdateSavedSearchDto,
		userId: string
	): Promise<SavedSearch> {
		const [result] = await db
			.update(savedSearches)
			.set({
				...(dto.name && { name: dto.name }),
				...(dto.query && { query: dto.query }),
				updatedAt: new Date(),
			})
			.where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
			.returning();
		if (!result) throw new Error('Saved search not found');
		return this.toSavedSearch(result);
	}

	public async delete(id: string, userId: string): Promise<void> {
		const result = await db
			.delete(savedSearches)
			.where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
			.returning();
		if (result.length === 0) throw new Error('Saved search not found');
	}

	private toSavedSearch(row: typeof savedSearches.$inferSelect): SavedSearch {
		return {
			id: row.id,
			userId: row.userId,
			name: row.name,
			query: row.query as AdvancedSearchQuery,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		};
	}
}
