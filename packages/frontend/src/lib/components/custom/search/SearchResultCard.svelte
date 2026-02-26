<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { t } from '$lib/translations';
	import type { SearchHit } from '@open-archiver/types';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';

	let {
		hit,
		isMounted = false,
	}: {
		hit: SearchHit;
		isMounted?: boolean;
	} = $props();

	const _formatted = $derived(hit._formatted || {});

	function sanitizeHighlight(html: string | undefined): string {
		if (!html) return '';
		// Strip all tags except <em>
		return html.replace(/<(?!\/?em\b)[^>]*>/gi, '');
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

	function getMatchCounts(h: SearchHit): { body: number; attachments: number } {
		const pos = h._matchesPosition;
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

	function formatRelativeDate(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 365) {
			return new Date(timestamp).toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			});
		}
		if (days > 30) {
			return new Date(timestamp).toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
			});
		}
		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return 'Just now';
	}

	function formatRecipients(toList: string[]): string {
		if (!toList || toList.length === 0) return '';
		const first = toList[0];
		if (toList.length === 1) return first;
		return `${first} +${toList.length - 1}`;
	}

	const matchCounts = $derived(getMatchCounts(hit));
	const bodySnippets = $derived(getHighlightedSnippets(_formatted.body));
	const attachmentSnippets = $derived(
		(_formatted.attachments || []).flatMap((att, i) =>
			att && att.content
				? getHighlightedSnippets(att.content).map((s) => ({
						snippet: s,
						filename: att.filename,
					}))
				: []
		)
	);
	const bestSnippet = $derived(bodySnippets[0] || attachmentSnippets[0]?.snippet || '');
	const senderDisplay = $derived(
		(hit as any).senderName ? `${(hit as any).senderName} <${hit.from}>` : hit.from
	);
</script>

<a href="/dashboard/archived-emails/{hit.id}" class="group block">
	<div
		class="hover:border-primary/30 bg-card hover:bg-accent/30 rounded-lg border p-4 transition-colors"
	>
		<!-- Row 1: Attachment icon + Subject + Date -->
		<div class="flex items-start gap-2">
			{#if hit.hasAttachments}
				<PaperclipIcon class="text-muted-foreground mt-0.5 size-4 shrink-0" />
			{/if}
			<div class="min-w-0 flex-1">
				{#if isMounted}
					<span class="search-highlight line-clamp-1 text-sm font-semibold">
						{@html sanitizeHighlight(_formatted.subject || hit.subject)}
					</span>
				{:else}
					<span class="bg-muted inline-block h-5 w-3/4 animate-pulse rounded"></span>
				{/if}
			</div>
			<span class="text-muted-foreground shrink-0 text-xs">
				{formatRelativeDate(hit.timestamp)}
			</span>
		</div>

		<!-- Row 2: Sender -> Recipients + Tags -->
		<div class="mt-1.5 flex items-center gap-2 text-xs">
			<span class="text-muted-foreground min-w-0 truncate">
				{senderDisplay}
			</span>
			{#if hit.to && hit.to.length > 0}
				<span class="text-muted-foreground/50 shrink-0">&rarr;</span>
				<span class="text-muted-foreground truncate">
					{formatRecipients(hit.to)}
				</span>
			{/if}
			<div class="ml-auto flex shrink-0 gap-1">
				{#if hit.tags && hit.tags.length > 0}
					{#each hit.tags.slice(0, 3) as tag}
						<Badge variant="outline" class="h-5 px-1.5 text-[10px]">{tag}</Badge>
					{/each}
					{#if hit.tags.length > 3}
						<Badge variant="outline" class="h-5 px-1.5 text-[10px]"
							>+{hit.tags.length - 3}</Badge
						>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Row 3: Best snippet + Match counts -->
		{#if bestSnippet && isMounted}
			<div class="mt-2 flex items-start gap-2">
				<div class="border-primary/40 min-w-0 flex-1 border-l-2 pl-3">
					<p
						class="search-highlight text-muted-foreground line-clamp-2 font-mono text-xs"
					>
						{@html sanitizeHighlight(bestSnippet)}
					</p>
				</div>
				{#if matchCounts.body > 0 || matchCounts.attachments > 0}
					<div class="text-muted-foreground shrink-0 text-[10px]">
						{#if matchCounts.body > 0}
							<span>{matchCounts.body} in body</span>
						{/if}
						{#if matchCounts.body > 0 && matchCounts.attachments > 0}
							<br />
						{/if}
						{#if matchCounts.attachments > 0}
							<span>{matchCounts.attachments} in attachments</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</a>

<style>
	:global(.search-highlight em) {
		background-color: #fde047;
		font-style: normal;
		color: #1f2937;
		border-radius: 2px;
		padding: 0 1px;
	}

	:global(.dark .search-highlight em) {
		background-color: #854d0e;
		color: #fef9c3;
	}
</style>
