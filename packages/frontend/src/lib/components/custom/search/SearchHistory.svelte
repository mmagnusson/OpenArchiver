<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { t } from '$lib/translations';
	import {
		searchHistory,
		removeFromSearchHistory,
		clearSearchHistory,
		type SearchHistoryEntry,
	} from '$lib/stores/searchHistory.store';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import XIcon from '@lucide/svelte/icons/x';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	let {
		onLoad,
	}: {
		onLoad?: (entry: SearchHistoryEntry) => void;
	} = $props();

	function formatRelativeTime(timestamp: number): string {
		const diff = Date.now() - timestamp;
		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return '<1m';
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h`;
		const days = Math.floor(hours / 24);
		return `${days}d`;
	}

	function truncate(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength) + '...';
	}

	function handleLoad(entry: SearchHistoryEntry) {
		onLoad?.(entry);
	}
</script>

{#if $searchHistory.length > 0}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="outline" size="sm" class="cursor-pointer">
					<HistoryIcon class="mr-1 size-4" />
					{$t('app.search.search_history')} ({$searchHistory.length})
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content class="w-72" align="end">
			<DropdownMenu.Label>{$t('app.search.search_history')}</DropdownMenu.Label>
			<DropdownMenu.Separator />
			<div class="max-h-64 overflow-y-auto">
				{#each $searchHistory as entry (entry.id)}
					<DropdownMenu.Item
						class="flex cursor-pointer items-center justify-between gap-2"
						onclick={() => handleLoad(entry)}
					>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm">{truncate(entry.summary, 40)}</p>
							<p class="text-muted-foreground text-xs">{formatRelativeTime(entry.timestamp)}</p>
						</div>
						<span
							role="button"
							tabindex={0}
							class="text-muted-foreground hover:text-destructive inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md p-0"
							onclick={(e: MouseEvent) => {
								e.stopPropagation();
								removeFromSearchHistory(entry.id);
							}}
							onkeydown={(e: KeyboardEvent) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									e.stopPropagation();
									removeFromSearchHistory(entry.id);
								}
							}}
						>
							<XIcon class="size-3" />
						</span>
					</DropdownMenu.Item>
				{/each}
			</div>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				class="text-destructive focus:text-destructive cursor-pointer"
				onclick={() => clearSearchHistory()}
			>
				<Trash2Icon class="mr-2 size-4" />
				{$t('app.search.clear_history')}
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}
