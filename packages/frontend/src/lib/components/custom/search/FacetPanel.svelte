<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { t } from '$lib/translations';
	import type { FacetDistribution, FacetStats } from '@open-archiver/types';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { shortenFolderPath } from '$lib/utils';

	let {
		facetDistribution,
		facetStats,
		onFacetClick,
		activeFilters = {},
	}: {
		facetDistribution?: FacetDistribution;
		facetStats?: FacetStats;
		onFacetClick?: (field: string, value: string) => void;
		activeFilters?: {
			from?: string;
			hasAttachments?: boolean;
			path?: string;
		};
	} = $props();

	function topEntries(dist: Record<string, number> | undefined, limit = 10): [string, number][] {
		if (!dist) return [];
		return Object.entries(dist)
			.sort(([, a], [, b]) => b - a)
			.slice(0, limit);
	}

	function isActive(field: string, value: string): boolean {
		if (field === 'from') return activeFilters.from === value;
		if (field === 'hasAttachments') {
			if (value === 'true') return activeFilters.hasAttachments === true;
			if (value === 'false') return activeFilters.hasAttachments === false;
		}
		if (field === 'path') return activeFilters.path === value;
		return false;
	}

	function hasActiveInSection(field: string): boolean {
		if (field === 'from') return !!activeFilters.from;
		if (field === 'hasAttachments') return activeFilters.hasAttachments === true;
		if (field === 'path') return !!activeFilters.path;
		return false;
	}

	function clearSection(field: string) {
		if (field === 'from' && activeFilters.from) {
			onFacetClick?.('from', activeFilters.from);
		} else if (field === 'hasAttachments') {
			onFacetClick?.('hasAttachments', String(activeFilters.hasAttachments));
		} else if (field === 'path' && activeFilters.path) {
			onFacetClick?.('path', activeFilters.path);
		}
	}
</script>

{#if facetDistribution}
	<div class="space-y-6">
		<!-- Top Senders -->
		{#if facetDistribution.from}
			<div>
				<div class="mb-2 flex items-center justify-between">
					<h4 class="text-sm font-semibold">
						{$t('app.search.facet_top_senders')}
					</h4>
					{#if hasActiveInSection('from')}
						<Button
							variant="ghost"
							size="sm"
							class="text-muted-foreground h-auto cursor-pointer px-1 py-0 text-xs"
							onclick={() => clearSection('from')}
						>
							{$t('app.search.clear_filter')}
						</Button>
					{/if}
				</div>
				<div class="space-y-0.5">
					{#each topEntries(facetDistribution.from) as [sender, count]}
						{@const active = isActive('from', sender)}
						<button
							type="button"
							class="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors {active
								? 'bg-primary/10 text-primary font-medium'
								: 'hover:bg-accent'}"
							onclick={() => onFacetClick?.('from', sender)}
						>
							<span class="mr-2 flex items-center gap-1 truncate">
								{#if active}<CheckIcon class="size-3 shrink-0" />{/if}
								{sender}
							</span>
							<Badge variant={active ? 'default' : 'secondary'}>{count}</Badge>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Attachment Status -->
		{#if facetDistribution.hasAttachments}
			<div>
				<div class="mb-2 flex items-center justify-between">
					<h4 class="text-sm font-semibold">
						{$t('app.search.facet_attachments')}
					</h4>
					{#if hasActiveInSection('hasAttachments')}
						<Button
							variant="ghost"
							size="sm"
							class="text-muted-foreground h-auto cursor-pointer px-1 py-0 text-xs"
							onclick={() => clearSection('hasAttachments')}
						>
							{$t('app.search.clear_filter')}
						</Button>
					{/if}
				</div>
				<div class="space-y-0.5">
					{#if facetDistribution.hasAttachments['true']}
						{@const active = isActive('hasAttachments', 'true')}
						<button
							type="button"
							class="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors {active
								? 'bg-primary/10 text-primary font-medium'
								: 'hover:bg-accent'}"
							onclick={() => onFacetClick?.('hasAttachments', 'true')}
						>
							<span class="flex items-center gap-1">
								{#if active}<CheckIcon class="size-3 shrink-0" />{/if}
								{$t('app.search.with_attachments')}
							</span>
							<Badge variant={active ? 'default' : 'secondary'}
								>{facetDistribution.hasAttachments['true']}</Badge
							>
						</button>
					{/if}
					{#if facetDistribution.hasAttachments['false']}
						{@const active = isActive('hasAttachments', 'false')}
						<button
							type="button"
							class="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors {active
								? 'bg-primary/10 text-primary font-medium'
								: 'hover:bg-accent'}"
							onclick={() => onFacetClick?.('hasAttachments', 'false')}
						>
							<span class="flex items-center gap-1">
								{#if active}<CheckIcon class="size-3 shrink-0" />{/if}
								{$t('app.search.without_attachments')}
							</span>
							<Badge variant={active ? 'default' : 'secondary'}
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
				<div class="mb-2 flex items-center justify-between">
					<h4 class="text-sm font-semibold">
						{$t('app.search.facet_folders')}
					</h4>
					{#if hasActiveInSection('path')}
						<Button
							variant="ghost"
							size="sm"
							class="text-muted-foreground h-auto cursor-pointer px-1 py-0 text-xs"
							onclick={() => clearSection('path')}
						>
							{$t('app.search.clear_filter')}
						</Button>
					{/if}
				</div>
				<div class="space-y-0.5">
					{#each topEntries(facetDistribution.path, 15) as [folder, count]}
						{@const active = isActive('path', folder)}
						<button
							type="button"
							title={folder}
							class="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors {active
								? 'bg-primary/10 text-primary font-medium'
								: 'hover:bg-accent'}"
							onclick={() => onFacetClick?.('path', folder)}
						>
							<span class="mr-2 flex items-center gap-1 truncate">
								{#if active}<CheckIcon class="size-3 shrink-0" />{/if}
								{shortenFolderPath(folder)}
							</span>
							<Badge variant={active ? 'default' : 'secondary'}>{count}</Badge>
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
						<button type="button" onclick={() => onFacetClick?.('tags', tag)}>
							<Badge variant="outline" class="hover:bg-accent cursor-pointer">
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
