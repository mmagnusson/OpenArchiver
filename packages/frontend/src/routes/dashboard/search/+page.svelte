<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Select from '$lib/components/ui/select';
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription,
	} from '$lib/components/ui/card';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import type {
		MatchingStrategy,
		AdvancedSearchQuery,
		SavedSearch,
		SearchHit,
	} from '@open-archiver/types';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { t } from '$lib/translations';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import SearchFilters from '$lib/components/custom/search/SearchFilters.svelte';
	import FacetPanel from '$lib/components/custom/search/FacetPanel.svelte';
	import SavedSearches from '$lib/components/custom/search/SavedSearches.svelte';
	import SearchHistory from '$lib/components/custom/search/SearchHistory.svelte';
	import { addToSearchHistory, type SearchHistoryEntry } from '$lib/stores/searchHistory.store';

	let { data }: { data: PageData } = $props();
	let searchResult = $derived(data.searchResult);
	let keywords = $state(data.keywords || '');
	let page = $derived(data.page);
	let error = $derived(data.error);
	let matchingStrategy: MatchingStrategy = $state(
		(data.matchingStrategy as MatchingStrategy) || 'last'
	);
	let savedSearches = $state((data as any).savedSearches || []);

	// Sort state
	let sortBy = $state((data as any).sortBy || '');

	// Attachments-only toggle
	let attachmentsOnly = $state((data as any).attachmentsOnly || false);

	// Advanced filter state — synced with URL params
	let filterFrom = $state((data as any).filters?.from || '');
	let filterTo = $state((data as any).filters?.to || '');
	let filterDateFrom = $state((data as any).filters?.dateFrom || '');
	let filterDateTo = $state((data as any).filters?.dateTo || '');
	let filterHasAttachments = $state((data as any).filters?.hasAttachments || false);
	let filterPath = $state((data as any).filters?.path || '');
	let filtersExpanded = $state(false);

	// Snippet expand state
	let expandedSnippets = $state(new Set<string>());

	const strategies = [
		{ value: 'last', label: $t('app.search.strategy_fuzzy') },
		{ value: 'all', label: $t('app.search.strategy_verbatim') },
		{ value: 'frequency', label: $t('app.search.strategy_frequency') },
	];

	const sortOptions = $derived([
		{ value: '', label: $t('app.search.sort_relevance') },
		{ value: 'timestamp:desc', label: $t('app.search.sort_newest') },
		{ value: 'timestamp:asc', label: $t('app.search.sort_oldest') },
		{ value: 'from:asc', label: $t('app.search.sort_sender_az') },
		{ value: 'from:desc', label: $t('app.search.sort_sender_za') },
		{ value: 'subject:asc', label: $t('app.search.sort_subject_az') },
		{ value: 'subject:desc', label: $t('app.search.sort_subject_za') },
	]);

	const triggerContent = $derived(
		strategies.find((s) => s.value === matchingStrategy)?.label ??
			$t('app.search.select_strategy')
	);

	const sortTriggerContent = $derived(
		sortOptions.find((s) => s.value === sortBy)?.label ?? $t('app.search.sort_relevance')
	);

	let isMounted = $state(false);
	onMount(() => {
		isMounted = true;
	});

	// Build the current query object for saved search functionality
	const currentQuery = $derived<AdvancedSearchQuery>({
		query: keywords,
		matchingStrategy,
		filters: {
			...(filterFrom && { from: filterFrom }),
			...(filterTo && { to: filterTo }),
			...(filterDateFrom && { dateFrom: filterDateFrom }),
			...(filterDateTo && { dateTo: filterDateTo }),
			...(filterHasAttachments && { hasAttachments: true }),
			...(filterPath && { path: filterPath }),
		},
		...(sortBy ? { sort: sortBy } : {}),
		...(attachmentsOnly ? { attachmentsOnly: true } : {}),
	});

	function shadowRender(node: HTMLElement, html: string | undefined) {
		if (html === undefined) return;

		const shadow = node.attachShadow({ mode: 'open' });
		const style = document.createElement('style');
		style.textContent = `em { background-color: #fde047; font-style: normal; color: #1f2937; }`;
		shadow.appendChild(style);
		const content = document.createElement('div');
		content.innerHTML = html;
		shadow.appendChild(content);

		return {
			update(newHtml: string | undefined) {
				if (newHtml === undefined) return;
				content.innerHTML = newHtml;
			},
		};
	}

	function buildSearchParams(): URLSearchParams {
		const params = new URLSearchParams();
		if (keywords) params.set('keywords', keywords);
		params.set('page', '1');
		params.set('matchingStrategy', matchingStrategy);
		if (sortBy) params.set('sortBy', sortBy);
		if (attachmentsOnly) params.set('attachmentsOnly', 'true');
		if (filterFrom) params.set('from', filterFrom);
		if (filterTo) params.set('to', filterTo);
		if (filterDateFrom) params.set('dateFrom', filterDateFrom);
		if (filterDateTo) params.set('dateTo', filterDateTo);
		if (filterHasAttachments) params.set('hasAttachments', 'true');
		if (filterPath) params.set('path', filterPath);
		return params;
	}

	function buildPaginationParams(targetPage: number): string {
		const params = new URLSearchParams();
		if (keywords) params.set('keywords', keywords);
		params.set('page', String(targetPage));
		params.set('matchingStrategy', matchingStrategy);
		if (sortBy) params.set('sortBy', sortBy);
		if (attachmentsOnly) params.set('attachmentsOnly', 'true');
		if (filterFrom) params.set('from', filterFrom);
		if (filterTo) params.set('to', filterTo);
		if (filterDateFrom) params.set('dateFrom', filterDateFrom);
		if (filterDateTo) params.set('dateTo', filterDateTo);
		if (filterHasAttachments) params.set('hasAttachments', 'true');
		if (filterPath) params.set('path', filterPath);
		return params.toString();
	}

	function handleSearch(e?: SubmitEvent) {
		if (e) e.preventDefault();
		const params = buildSearchParams();
		try {
			if (
				keywords ||
				filterFrom ||
				filterTo ||
				filterDateFrom ||
				filterDateTo ||
				filterHasAttachments ||
				filterPath ||
				attachmentsOnly
			) {
				addToSearchHistory(currentQuery);
			}
		} catch (err) {
			console.warn('Failed to save search history:', err);
		}
		goto(`/dashboard/search?${params.toString()}`, { keepFocus: true });
	}

	function handleLoadHistory(entry: SearchHistoryEntry) {
		const q = entry.query;
		keywords = q.query || '';
		matchingStrategy = q.matchingStrategy || 'last';
		sortBy = q.sort || '';
		attachmentsOnly = q.attachmentsOnly || false;
		if (q.filters) {
			filterFrom = q.filters.from || '';
			filterTo = q.filters.to || '';
			filterDateFrom = q.filters.dateFrom || '';
			filterDateTo = q.filters.dateTo || '';
			filterHasAttachments = q.filters.hasAttachments || false;
			filterPath = q.filters.path || '';
		}
		handleSearch();
	}

	function handleFacetClick(field: string, value: string) {
		if (field === 'from') filterFrom = value;
		else if (field === 'hasAttachments') filterHasAttachments = value === 'true';
		else if (field === 'path') filterPath = value;
		handleSearch();
	}

	function handleLoadSavedSearch(search: SavedSearch) {
		const q = search.query;
		keywords = q.query || '';
		matchingStrategy = q.matchingStrategy || 'last';
		sortBy = q.sort || '';
		attachmentsOnly = q.attachmentsOnly || false;
		if (q.filters) {
			filterFrom = q.filters.from || '';
			filterTo = q.filters.to || '';
			filterDateFrom = q.filters.dateFrom || '';
			filterDateTo = q.filters.dateTo || '';
			filterHasAttachments = q.filters.hasAttachments || false;
			filterPath = q.filters.path || '';
		}
		handleSearch();
	}

	function handleFilterApply() {
		handleSearch();
	}

	function handleFilterClear() {
		handleSearch();
	}

	function getHighlightedSnippets(text: string | undefined, snippetLength = 80): string[] {
		if (!text || !text.includes('<em>')) {
			return [];
		}

		const snippets: string[] = [];
		const regex = /<em>.*?<\/em>/g;
		let match;
		let lastIndex = 0;

		while ((match = regex.exec(text)) !== null) {
			if (match.index < lastIndex) {
				continue;
			}

			const matchIndex = match.index;
			const matchLength = match[0].length;

			const start = Math.max(0, matchIndex - snippetLength);
			const end = Math.min(text.length, matchIndex + matchLength + snippetLength);

			lastIndex = end;

			let snippet = text.substring(start, end);

			const openCount = (snippet.match(/<em/g) || []).length;
			const closeCount = (snippet.match(/<\/em>/g) || []).length;

			if (openCount > closeCount) {
				snippet += '</em>';
			}

			if (closeCount > openCount) {
				snippet = '<em>' + snippet;
			}

			if (start > 0) {
				snippet = '...' + snippet;
			}
			if (end < text.length) {
				snippet += '...';
			}

			snippets.push(snippet);
		}

		return snippets;
	}

	function getMatchCounts(hit: SearchHit): { body: number; attachments: number } {
		const pos = hit._matchesPosition;
		if (!pos) return { body: 0, attachments: 0 };

		let body = 0;
		let attachments = 0;

		for (const key of Object.keys(pos)) {
			const count = pos[key].length;
			if (key.startsWith('attachments')) {
				attachments += count;
			} else if (key === 'body') {
				body += count;
			}
		}

		return { body, attachments };
	}

	function toggleSnippetExpand(hitId: string) {
		expandedSnippets = new Set(expandedSnippets);
		if (expandedSnippets.has(hitId)) {
			expandedSnippets.delete(hitId);
		} else {
			expandedSnippets.add(hitId);
		}
	}

	const SNIPPET_LIMIT = 2;
</script>

<svelte:head>
	<title>{$t('app.search.title')} | Open Archiver</title>
	<meta name="description" content={$t('app.search.description')} />
</svelte:head>

<div class="container mx-auto p-4 md:p-8">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="text-2xl font-bold">{$t('app.search.email_search')}</h1>
		<div class="flex gap-1">
			<SearchHistory onLoad={handleLoadHistory} />
			<SavedSearches
				bind:savedSearches
				currentQuery={keywords ||
				filterFrom ||
				filterTo ||
				filterDateFrom ||
				filterDateTo ||
				filterHasAttachments ||
				filterPath ||
				attachmentsOnly
					? currentQuery
					: undefined}
				onLoad={handleLoadSavedSearch}
			/>
		</div>
	</div>

	<form onsubmit={(e) => handleSearch(e)} class="mb-4 flex flex-col space-y-2">
		<div class="flex items-center gap-2">
			<Input
				type="search"
				name="keywords"
				placeholder={$t('app.search.placeholder')}
				class="h-12 flex-grow"
				bind:value={keywords}
			/>
			<Button type="submit" class="h-12 cursor-pointer"
				>{$t('app.search.search_button')}</Button
			>
		</div>
		<div class="mt-1 text-xs font-medium">{$t('app.search.search_options')}</div>
		<div class="flex flex-wrap items-center gap-2">
			<Select.Root type="single" name="matchingStrategy" bind:value={matchingStrategy}>
				<Select.Trigger class="w-[180px] cursor-pointer">
					{triggerContent}
				</Select.Trigger>
				<Select.Content>
					{#each strategies as strategy (strategy.value)}
						<Select.Item
							value={strategy.value}
							label={strategy.label}
							class="cursor-pointer"
						>
							{strategy.label}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root type="single" name="sortBy" bind:value={sortBy}>
				<Select.Trigger class="w-[180px] cursor-pointer">
					{sortTriggerContent}
				</Select.Trigger>
				<Select.Content>
					{#each sortOptions as option (option.value)}
						<Select.Item
							value={option.value}
							label={option.label}
							class="cursor-pointer"
						>
							{option.label}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<div class="flex items-center gap-1.5">
				<Checkbox bind:checked={attachmentsOnly} />
				<Label
					class="cursor-pointer text-sm"
					onclick={() => (attachmentsOnly = !attachmentsOnly)}
				>
					{$t('app.search.attachments_only')}
				</Label>
			</div>
		</div>
	</form>

	<!-- Advanced Filters -->
	<div class="mb-6">
		<SearchFilters
			bind:from={filterFrom}
			bind:to={filterTo}
			bind:dateFrom={filterDateFrom}
			bind:dateTo={filterDateTo}
			bind:hasAttachments={filterHasAttachments}
			bind:path={filterPath}
			bind:expanded={filtersExpanded}
			onApply={handleFilterApply}
			onClear={handleFilterClear}
		/>
	</div>

	{#if error}
		<Alert.Root variant="destructive">
			<CircleAlertIcon class="size-4" />
			<Alert.Title>{$t('app.search.error')}</Alert.Title>
			<Alert.Description>{error}</Alert.Description>
		</Alert.Root>
	{/if}

	{#if searchResult}
		<p class="text-muted-foreground mb-4">
			{#if searchResult.total > 0}
				{$t('app.search.found_results_in', {
					total: searchResult.total,
					seconds: searchResult.processingTimeMs / 1000,
				} as any)}
			{:else}
				{$t('app.search.found_results', { total: searchResult.total } as any)}
			{/if}
		</p>

		<!-- Two-column layout: results + facet sidebar -->
		<div class="flex flex-col gap-6 lg:flex-row">
			<!-- Results column -->
			<div class="min-w-0 flex-1">
				<div class="grid gap-4">
					{#each searchResult.hits as hit}
						{@const _formatted = hit._formatted || {}}
						{@const matchCounts = getMatchCounts(hit)}
						{@const bodySnippets = getHighlightedSnippets(_formatted.body)}
						{@const attachmentSnippets = (_formatted.attachments || []).flatMap(
							(att, i) =>
								att && att.content
									? getHighlightedSnippets(att.content).map((s) => ({
											snippet: s,
											filename: att.filename,
										}))
									: []
						)}
						{@const isExpanded = expandedSnippets.has(hit.id)}
						{@const visibleBodySnippets = isExpanded
							? bodySnippets
							: bodySnippets.slice(0, SNIPPET_LIMIT)}
						{@const visibleAttachmentSnippets = isExpanded
							? attachmentSnippets
							: attachmentSnippets.slice(0, SNIPPET_LIMIT)}
						{@const hasMoreSnippets =
							bodySnippets.length > SNIPPET_LIMIT ||
							attachmentSnippets.length > SNIPPET_LIMIT}
						<a href="/dashboard/archived-emails/{hit.id}" class="block">
							<Card>
								<CardHeader>
									<CardTitle>
										{#if !isMounted}
											<Skeleton class="h-6 w-3/4" />
										{:else}
											<div
												use:shadowRender={_formatted.subject || hit.subject}
											></div>
										{/if}
									</CardTitle>
									<CardDescription
										class="divide-forground flex flex-wrap items-center space-x-2 divide-x"
									>
										<span class="pr-2">
											<span>{$t('app.search.from')}:</span>
											{#if !isMounted}
												<span
													class="bg-accent h-4 w-40 animate-pulse rounded-md"
												></span>
											{:else}
												<span
													class="inline-block"
													use:shadowRender={_formatted.from || hit.from}
												></span>
											{/if}
										</span>
										<span class="pr-2">
											<span>{$t('app.search.to')}:</span>
											{#if !isMounted}
												<span
													class="bg-accent h-4 w-40 animate-pulse rounded-md"
												></span>
											{:else}
												<span
													class="inline-block"
													use:shadowRender={_formatted.to?.join(', ') ||
														hit.to.join(', ')}
												></span>
											{/if}
										</span>
										<span>
											{#if !isMounted}
												<span
													class="bg-accent h-4 w-40 animate-pulse rounded-md"
												></span>
											{:else}
												<span class="inline-block">
													{new Date(hit.timestamp).toLocaleString()}
												</span>
											{/if}
										</span>
									</CardDescription>
								</CardHeader>
								<CardContent class="space-y-2">
									<!-- Match count summary -->
									{#if matchCounts.body > 0 || matchCounts.attachments > 0}
										<p class="text-muted-foreground text-xs">
											{#if matchCounts.body > 0}
												{matchCounts.body === 1
													? $t('app.search.match_count', {
															count: matchCounts.body,
															field: 'body',
														} as any)
													: $t('app.search.match_count_plural', {
															count: matchCounts.body,
															field: 'body',
														} as any)}
											{/if}
											{#if matchCounts.body > 0 && matchCounts.attachments > 0}
												{', '}
											{/if}
											{#if matchCounts.attachments > 0}
												{matchCounts.attachments === 1
													? $t('app.search.match_count', {
															count: matchCounts.attachments,
															field: 'attachments',
														} as any)
													: $t('app.search.match_count_plural', {
															count: matchCounts.attachments,
															field: 'attachments',
														} as any)}
											{/if}
										</p>
									{/if}

									<!-- Body matches -->
									{#each visibleBodySnippets as snippet}
										<div
											class="space-y-2 rounded-md bg-slate-100 p-2 dark:bg-slate-800"
										>
											<p class="text-sm text-gray-500">
												{$t('app.search.in_email_body')}:
											</p>
											{#if !isMounted}
												<Skeleton class="my-2 h-5 w-full bg-gray-200" />
											{:else}
												<p
													class="font-mono text-sm"
													use:shadowRender={snippet}
												></p>
											{/if}
										</div>
									{/each}

									<!-- Attachment matches -->
									{#each visibleAttachmentSnippets as { snippet, filename }}
										<div
											class="space-y-2 rounded-md bg-slate-100 p-2 dark:bg-slate-800"
										>
											<p class="text-sm text-gray-500">
												{$t('app.search.in_attachment', {
													filename,
												} as any)}
											</p>
											{#if !isMounted}
												<Skeleton class="my-2 h-5 w-full bg-gray-200" />
											{:else}
												<p
													class="font-mono text-sm"
													use:shadowRender={snippet}
												></p>
											{/if}
										</div>
									{/each}

									<!-- Show more / less toggle -->
									{#if hasMoreSnippets}
										<button
											type="button"
											class="text-primary hover:text-primary/80 cursor-pointer text-xs font-medium"
											onclick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												toggleSnippetExpand(hit.id);
											}}
										>
											{isExpanded
												? $t('app.search.show_less_snippets')
												: $t('app.search.show_more_snippets')}
										</button>
									{/if}
								</CardContent>
							</Card>
						</a>
					{/each}
				</div>

				{#if searchResult.total > searchResult.limit}
					<div class="mt-8">
						<Pagination.Root
							count={searchResult.total}
							perPage={searchResult.limit}
							{page}
						>
							{#snippet children({ pages, currentPage })}
								<Pagination.Content>
									<Pagination.Item>
										<a
											href={`/dashboard/search?${buildPaginationParams(currentPage - 1)}`}
										>
											<Pagination.PrevButton>
												<ChevronLeft class="h-4 w-4" />
												<span class="hidden sm:block"
													>{$t('app.search.prev')}</span
												>
											</Pagination.PrevButton>
										</a>
									</Pagination.Item>
									{#each pages as page (page.key)}
										{#if page.type === 'ellipsis'}
											<Pagination.Item>
												<Pagination.Ellipsis />
											</Pagination.Item>
										{:else}
											<Pagination.Item>
												<a
													href={`/dashboard/search?${buildPaginationParams(page.value)}`}
												>
													<Pagination.Link
														{page}
														isActive={currentPage === page.value}
													>
														{page.value}
													</Pagination.Link>
												</a>
											</Pagination.Item>
										{/if}
									{/each}
									<Pagination.Item>
										<a
											href={`/dashboard/search?${buildPaginationParams(currentPage + 1)}`}
										>
											<Pagination.NextButton>
												<span class="hidden sm:block"
													>{$t('app.search.next')}</span
												>
												<ChevronRight class="h-4 w-4" />
											</Pagination.NextButton>
										</a>
									</Pagination.Item>
								</Pagination.Content>
							{/snippet}
						</Pagination.Root>
					</div>
				{/if}
			</div>

			<!-- Facet sidebar -->
			{#if searchResult.facetDistribution}
				<div class="w-full shrink-0 lg:w-64">
					<div class="sticky top-24 rounded-lg border p-4">
						<FacetPanel
							facetDistribution={searchResult.facetDistribution}
							facetStats={searchResult.facetStats}
							onFacetClick={handleFacetClick}
						/>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
