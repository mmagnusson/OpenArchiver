<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { t } from '$lib/translations';
	import type { FacetDistribution, FacetStats } from '@open-archiver/types';

	let {
		facetDistribution,
		facetStats,
		onFacetClick,
	}: {
		facetDistribution?: FacetDistribution;
		facetStats?: FacetStats;
		onFacetClick?: (field: string, value: string) => void;
	} = $props();

	function topEntries(
		dist: Record<string, number> | undefined,
		limit = 10
	): [string, number][] {
		if (!dist) return [];
		return Object.entries(dist)
			.sort(([, a], [, b]) => b - a)
			.slice(0, limit);
	}
</script>

{#if facetDistribution}
	<div class="space-y-6">
		<!-- Top Senders -->
		{#if facetDistribution.from}
			<div>
				<h4 class="mb-2 text-sm font-semibold">
					{$t('app.search.facet_top_senders')}
				</h4>
				<div class="space-y-0.5">
					{#each topEntries(facetDistribution.from) as [sender, count]}
						<button
							type="button"
							class="hover:bg-accent flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors"
							onclick={() => onFacetClick?.('from', sender)}
						>
							<span class="mr-2 truncate">{sender}</span>
							<Badge variant="secondary">{count}</Badge>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Attachment Status -->
		{#if facetDistribution.hasAttachments}
			<div>
				<h4 class="mb-2 text-sm font-semibold">
					{$t('app.search.facet_attachments')}
				</h4>
				<div class="space-y-0.5">
					{#if facetDistribution.hasAttachments['true']}
						<button
							type="button"
							class="hover:bg-accent flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors"
							onclick={() => onFacetClick?.('hasAttachments', 'true')}
						>
							<span>{$t('app.search.with_attachments')}</span>
							<Badge variant="secondary"
								>{facetDistribution.hasAttachments['true']}</Badge
							>
						</button>
					{/if}
					{#if facetDistribution.hasAttachments['false']}
						<button
							type="button"
							class="hover:bg-accent flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors"
							onclick={() => onFacetClick?.('hasAttachments', 'false')}
						>
							<span>{$t('app.search.without_attachments')}</span>
							<Badge variant="secondary"
								>{facetDistribution.hasAttachments['false']}</Badge
							>
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Folders -->
		{#if facetDistribution.path && Object.keys(facetDistribution.path).length > 0}
			<div>
				<h4 class="mb-2 text-sm font-semibold">
					{$t('app.search.facet_folders')}
				</h4>
				<div class="space-y-0.5">
					{#each topEntries(facetDistribution.path, 15) as [folder, count]}
						<button
							type="button"
							class="hover:bg-accent flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors"
							onclick={() => onFacetClick?.('path', folder)}
						>
							<span class="mr-2 truncate">{folder}</span>
							<Badge variant="secondary">{count}</Badge>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Tags -->
		{#if facetDistribution.tags && Object.keys(facetDistribution.tags).length > 0}
			<div>
				<h4 class="mb-2 text-sm font-semibold">
					{$t('app.search.facet_tags')}
				</h4>
				<div class="flex flex-wrap gap-1">
					{#each topEntries(facetDistribution.tags, 20) as [tag, count]}
						<button
							type="button"
							onclick={() => onFacetClick?.('tags', tag)}
						>
							<Badge variant="outline" class="cursor-pointer hover:bg-accent">
								{tag} ({count})
							</Badge>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Timestamp Range from facetStats -->
		{#if facetStats?.timestamp}
			<div>
				<p class="text-muted-foreground text-xs">
					{$t('app.search.date_range')}:
					{new Date(facetStats.timestamp.min).toLocaleDateString()} —
					{new Date(facetStats.timestamp.max).toLocaleDateString()}
				</p>
			</div>
		{/if}
	</div>
{/if}
