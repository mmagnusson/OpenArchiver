<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { t } from '$lib/translations';
	import { shortenFolderPath } from '$lib/utils';
	import XIcon from '@lucide/svelte/icons/x';

	let {
		from = '',
		to = '',
		dateFrom = '',
		dateTo = '',
		hasAttachments = false,
		path = '',
		attachmentsOnly = false,
		onRemove,
	}: {
		from?: string;
		to?: string;
		dateFrom?: string;
		dateTo?: string;
		hasAttachments?: boolean;
		path?: string;
		attachmentsOnly?: boolean;
		onRemove?: (field: string) => void;
	} = $props();

	interface FilterChip {
		field: string;
		label: string;
		value: string;
	}

	const chips = $derived.by(() => {
		const result: FilterChip[] = [];
		if (from) result.push({ field: 'from', label: $t('app.search.from'), value: from });
		if (to) result.push({ field: 'to', label: $t('app.search.to'), value: to });
		if (dateFrom)
			result.push({
				field: 'dateFrom',
				label: $t('app.search.filter_date_from'),
				value: dateFrom,
			});
		if (dateTo)
			result.push({ field: 'dateTo', label: $t('app.search.filter_date_to'), value: dateTo });
		if (hasAttachments)
			result.push({
				field: 'hasAttachments',
				label: $t('app.search.filter_has_attachments'),
				value: '',
			});
		if (path)
			result.push({
				field: 'path',
				label: $t('app.search.filter_folder'),
				value: shortenFolderPath(path),
			});
		if (attachmentsOnly)
			result.push({
				field: 'attachmentsOnly',
				label: $t('app.search.attachments_only'),
				value: '',
			});
		return result;
	});
</script>

{#if chips.length > 0}
	<div class="mb-4 flex flex-wrap items-center gap-1.5">
		<span class="text-muted-foreground text-xs font-medium">
			{$t('app.search.active_filters')}:
		</span>
		{#each chips as chip (chip.field)}
			<Badge variant="secondary" class="gap-1 pr-1">
				<span class="text-xs">
					{chip.label}{chip.value ? `: ${chip.value}` : ''}
				</span>
				<button
					type="button"
					class="hover:bg-muted ml-0.5 cursor-pointer rounded-full p-0.5 transition-colors"
					onclick={() => onRemove?.(chip.field)}
				>
					<XIcon class="size-3" />
				</button>
			</Badge>
		{/each}
	</div>
{/if}
