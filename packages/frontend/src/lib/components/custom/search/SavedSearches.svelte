<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Dialog from '$lib/components/ui/dialog';
	import { t } from '$lib/translations';
	import { api } from '$lib/api.client';
	import type { SavedSearch, AdvancedSearchQuery } from '@open-archiver/types';
	import BookmarkIcon from '@lucide/svelte/icons/bookmark';
	import BookmarkPlusIcon from '@lucide/svelte/icons/bookmark-plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	let {
		savedSearches = $bindable([]),
		currentQuery,
		onLoad,
	}: {
		savedSearches: SavedSearch[];
		currentQuery?: AdvancedSearchQuery;
		onLoad?: (search: SavedSearch) => void;
	} = $props();

	let showSaveDialog = $state(false);
	let showListDialog = $state(false);
	let newSearchName = $state('');
	let saving = $state(false);

	async function saveCurrentSearch() {
		if (!newSearchName || !currentQuery) return;
		saving = true;
		try {
			const response = await api('/search/saved', {
				method: 'POST',
				body: JSON.stringify({ name: newSearchName, query: currentQuery }),
			});
			if (response.ok) {
				const saved = (await response.json()) as SavedSearch;
				savedSearches = [saved, ...savedSearches];
				showSaveDialog = false;
				newSearchName = '';
			}
		} finally {
			saving = false;
		}
	}

	async function deleteSavedSearch(id: string) {
		const response = await api(`/search/saved/${id}`, { method: 'DELETE' });
		if (response.ok) {
			savedSearches = savedSearches.filter((s) => s.id !== id);
		}
	}

	function loadSearch(search: SavedSearch) {
		showListDialog = false;
		onLoad?.(search);
	}
</script>

<div class="flex gap-1">
	<!-- Save current search button -->
	{#if currentQuery}
		<Dialog.Root bind:open={showSaveDialog}>
			<Dialog.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline" size="sm" class="cursor-pointer">
						<BookmarkPlusIcon class="mr-1 size-4" />
						{$t('app.search.save_search')}
					</Button>
				{/snippet}
			</Dialog.Trigger>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>{$t('app.search.save_search')}</Dialog.Title>
					<Dialog.Description>
						{$t('app.search.saved_search_name')}
					</Dialog.Description>
				</Dialog.Header>
				<div class="space-y-4 py-4">
					<Input
						type="text"
						bind:value={newSearchName}
						placeholder={$t('app.search.saved_search_name')}
						onkeydown={(e) => {
							if (e.key === 'Enter') saveCurrentSearch();
						}}
					/>
				</div>
				<Dialog.Footer>
					<Button
						onclick={saveCurrentSearch}
						disabled={!newSearchName || saving}
						class="cursor-pointer"
					>
						{$t('app.search.save_search')}
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	{/if}

	<!-- Saved searches list button -->
	{#if savedSearches.length > 0}
		<Dialog.Root bind:open={showListDialog}>
			<Dialog.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline" size="sm" class="cursor-pointer">
						<BookmarkIcon class="mr-1 size-4" />
						{$t('app.search.saved_searches')} ({savedSearches.length})
					</Button>
				{/snippet}
			</Dialog.Trigger>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>{$t('app.search.saved_searches')}</Dialog.Title>
				</Dialog.Header>
				<div class="max-h-80 space-y-2 overflow-y-auto py-4">
					{#each savedSearches as search (search.id)}
						<div
							class="hover:bg-accent flex items-center justify-between rounded-md border p-3 transition-colors"
						>
							<button
								type="button"
								class="flex-1 cursor-pointer text-left"
								onclick={() => loadSearch(search)}
							>
								<p class="text-sm font-medium">{search.name}</p>
								<p class="text-muted-foreground text-xs">
									{new Date(search.updatedAt).toLocaleDateString()}
								</p>
							</button>
							<Button
								variant="ghost"
								size="sm"
								class="text-destructive hover:text-destructive cursor-pointer"
								onclick={() => deleteSavedSearch(search.id)}
							>
								<Trash2Icon class="size-4" />
							</Button>
						</div>
					{/each}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	{/if}
</div>
