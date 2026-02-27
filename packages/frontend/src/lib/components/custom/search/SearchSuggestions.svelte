<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { api } from '$lib/api.client';
	import { t } from '$lib/translations';
	import { searchHistory } from '$lib/stores/searchHistory.store';
	import type { SavedSearch, SuggestHit } from '@open-archiver/types';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import BookmarkIcon from '@lucide/svelte/icons/bookmark';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import LoaderIcon from '@lucide/svelte/icons/loader';

	let {
		query = $bindable(''),
		savedSearches = [],
		onSelect,
		onSearch,
	}: {
		query?: string;
		savedSearches?: SavedSearch[];
		onSelect?: (id: string) => void;
		onSearch?: () => void;
	} = $props();

	let open = $state(false);
	let loading = $state(false);
	let liveResults = $state<SuggestHit[]>([]);
	let selectedIndex = $state(-1);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	// Filter recent searches by prefix
	const recentMatches = $derived.by(() => {
		if (!query || query.length < 2) return [];
		const lower = query.toLowerCase();
		return $searchHistory.filter((e) => e.summary.toLowerCase().includes(lower)).slice(0, 3);
	});

	// Filter saved searches by name
	const savedMatches = $derived.by(() => {
		if (!query || query.length < 2) return [];
		const lower = query.toLowerCase();
		return savedSearches.filter((s) => s.name.toLowerCase().includes(lower)).slice(0, 3);
	});

	// Total navigable items
	const totalItems = $derived(liveResults.length + recentMatches.length + savedMatches.length);

	const showDropdown = $derived(open && query.length >= 2 && totalItems > 0);

	async function fetchSuggestions(q: string) {
		if (q.length < 2) {
			liveResults = [];
			return;
		}

		loading = true;
		try {
			const response = await api(`/search/suggest?q=${encodeURIComponent(q)}`);
			if (response.ok) {
				const data = await response.json();
				liveResults = data.hits || [];
			} else {
				liveResults = [];
			}
		} catch {
			liveResults = [];
		} finally {
			loading = false;
		}
	}

	function handleInput() {
		open = true;
		selectedIndex = -1;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			fetchSuggestions(query);
		}, 350);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!showDropdown) {
			if (e.key === 'Enter') {
				onSearch?.();
			}
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % totalItems;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = selectedIndex <= 0 ? totalItems - 1 : selectedIndex - 1;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (selectedIndex >= 0) {
				selectItem(selectedIndex);
			} else {
				open = false;
				onSearch?.();
			}
		} else if (e.key === 'Escape') {
			open = false;
			selectedIndex = -1;
		}
	}

	function selectItem(index: number) {
		let i = index;

		// Live results
		if (i < liveResults.length) {
			const hit = liveResults[i];
			open = false;
			onSelect?.(hit.id);
			return;
		}
		i -= liveResults.length;

		// Recent searches
		if (i < recentMatches.length) {
			const entry = recentMatches[i];
			query = entry.query.query || entry.summary;
			open = false;
			onSearch?.();
			return;
		}
		i -= recentMatches.length;

		// Saved searches
		if (i < savedMatches.length) {
			const saved = savedMatches[i];
			query = saved.query.query || saved.name;
			open = false;
			onSearch?.();
			return;
		}
	}

	function formatRelativeDate(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		if (days > 30) {
			return new Date(timestamp).toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
			});
		}
		if (days > 0) return `${days}d ago`;
		const hours = Math.floor(diff / (1000 * 60 * 60));
		if (hours > 0) return `${hours}h ago`;
		return 'Just now';
	}

	function handleFocus() {
		if (query.length >= 2) {
			open = true;
		}
	}

	function handleBlur() {
		// Delay to allow click events to fire
		setTimeout(() => {
			open = false;
		}, 200);
	}
</script>

<div class="relative flex-grow">
	<Input
		type="search"
		name="keywords"
		placeholder={$t('app.search.placeholder')}
		class="h-12"
		bind:value={query}
		oninput={handleInput}
		onkeydown={handleKeydown}
		onfocus={handleFocus}
		onblur={handleBlur}
	/>

	{#if showDropdown}
		<div
			class="bg-popover text-popover-foreground absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border shadow-lg"
		>
			<!-- Live results -->
			{#if liveResults.length > 0}
				<div class="border-b px-3 pb-1 pt-2">
					<span
						class="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
					>
						{#if loading}
							<LoaderIcon class="size-3 animate-spin" />
						{:else}
							<SearchIcon class="size-3" />
						{/if}
						{$t('app.search.suggestions_live')}
					</span>
				</div>
				{#each liveResults as hit, i}
					{@const itemIndex = i}
					<button
						type="button"
						class="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm transition-colors {selectedIndex ===
						itemIndex
							? 'bg-accent'
							: 'hover:bg-accent/50'}"
						onmousedown={() => selectItem(itemIndex)}
						onmouseenter={() => (selectedIndex = itemIndex)}
					>
						{#if hit.hasAttachments}
							<PaperclipIcon class="text-muted-foreground size-3.5 shrink-0" />
						{:else}
							<SearchIcon class="text-muted-foreground size-3.5 shrink-0" />
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium">{hit.subject}</p>
							<p class="text-muted-foreground truncate text-xs">
								{hit.senderName || hit.from}
							</p>
						</div>
						<span class="text-muted-foreground shrink-0 text-xs">
							{formatRelativeDate(hit.timestamp)}
						</span>
					</button>
				{/each}
			{/if}

			<!-- Recent searches -->
			{#if recentMatches.length > 0}
				<div class="border-b px-3 pb-1 pt-2">
					<span
						class="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
					>
						<ClockIcon class="size-3" />
						{$t('app.search.suggestions_recent')}
					</span>
				</div>
				{#each recentMatches as entry, i}
					{@const itemIndex = liveResults.length + i}
					<button
						type="button"
						class="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm transition-colors {selectedIndex ===
						itemIndex
							? 'bg-accent'
							: 'hover:bg-accent/50'}"
						onmousedown={() => selectItem(itemIndex)}
						onmouseenter={() => (selectedIndex = itemIndex)}
					>
						<ClockIcon class="text-muted-foreground size-3.5 shrink-0" />
						<span class="truncate">{entry.summary}</span>
					</button>
				{/each}
			{/if}

			<!-- Saved searches -->
			{#if savedMatches.length > 0}
				<div class="border-b px-3 pb-1 pt-2">
					<span
						class="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
					>
						<BookmarkIcon class="size-3" />
						{$t('app.search.suggestions_saved')}
					</span>
				</div>
				{#each savedMatches as saved, i}
					{@const itemIndex = liveResults.length + recentMatches.length + i}
					<button
						type="button"
						class="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm transition-colors {selectedIndex ===
						itemIndex
							? 'bg-accent'
							: 'hover:bg-accent/50'}"
						onmousedown={() => selectItem(itemIndex)}
						onmouseenter={() => (selectedIndex = itemIndex)}
					>
						<BookmarkIcon class="text-muted-foreground size-3.5 shrink-0" />
						<span class="truncate">{saved.name}</span>
					</button>
				{/each}
			{/if}

			<!-- Footer hint -->
			<div class="text-muted-foreground border-t px-3 py-1.5 text-center text-[11px]">
				{$t('app.search.press_enter_to_search')}
			</div>
		</div>
	{/if}
</div>
