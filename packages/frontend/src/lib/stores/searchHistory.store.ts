import { persisted } from 'svelte-persisted-store';
import { get } from 'svelte/store';
import type { AdvancedSearchQuery } from '@open-archiver/types';

const MAX_ENTRIES = 20;

export interface SearchHistoryEntry {
	id: string;
	query: AdvancedSearchQuery;
	timestamp: number;
	summary: string;
}

export const searchHistory = persisted<SearchHistoryEntry[]>('searchHistory', []);

export function buildSearchSummary(query: AdvancedSearchQuery): string {
	const parts: string[] = [];
	if (query.query) parts.push(query.query);
	if (query.filters) {
		if (query.filters.from) parts.push(`from:${query.filters.from}`);
		if (query.filters.to) parts.push(`to:${query.filters.to}`);
		if (query.filters.dateFrom) parts.push(`after:${query.filters.dateFrom}`);
		if (query.filters.dateTo) parts.push(`before:${query.filters.dateTo}`);
		if (query.filters.hasAttachments) parts.push('has:attachment');
		if (query.filters.ingestionSourceId) parts.push(`in:${query.filters.ingestionSourceId}`);
		if (query.filters.tags && query.filters.tags.length > 0)
			parts.push(...query.filters.tags.map((t) => `tag:${t}`));
		if (query.filters.path) parts.push(`folder:${query.filters.path}`);
	}
	if (query.attachmentsOnly) parts.push('[attachments only]');
	return parts.join(' ') || '';
}

export function addToSearchHistory(query: AdvancedSearchQuery): void {
	const summary = buildSearchSummary(query);
	if (!summary) return;

	searchHistory.update((entries) => {
		// Deduplicate by summary
		const filtered = entries.filter((e) => e.summary !== summary);
		const entry: SearchHistoryEntry = {
			id: crypto.randomUUID(),
			query,
			timestamp: Date.now(),
			summary,
		};
		const updated = [entry, ...filtered];
		return updated.slice(0, MAX_ENTRIES);
	});
}

export function removeFromSearchHistory(id: string): void {
	searchHistory.update((entries) => entries.filter((e) => e.id !== id));
}

export function clearSearchHistory(): void {
	searchHistory.set([]);
}
