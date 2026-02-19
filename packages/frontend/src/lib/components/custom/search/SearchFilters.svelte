<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { t } from '$lib/translations';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import XIcon from '@lucide/svelte/icons/x';

	let {
		from = $bindable(''),
		to = $bindable(''),
		dateFrom = $bindable(''),
		dateTo = $bindable(''),
		hasAttachments = $bindable(false),
		path = $bindable(''),
		expanded = $bindable(false),
		onApply,
		onClear,
	}: {
		from?: string;
		to?: string;
		dateFrom?: string;
		dateTo?: string;
		hasAttachments?: boolean;
		path?: string;
		expanded?: boolean;
		onApply?: () => void;
		onClear?: () => void;
	} = $props();

	function toISODate(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	const datePresets = $derived([
		{
			label: $t('app.search.date_preset_today'),
			getRange: () => {
				const now = new Date();
				const today = toISODate(now);
				return { from: today, to: today };
			},
		},
		{
			label: $t('app.search.date_preset_7days'),
			getRange: () => {
				const now = new Date();
				const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
				return { from: toISODate(past), to: toISODate(now) };
			},
		},
		{
			label: $t('app.search.date_preset_30days'),
			getRange: () => {
				const now = new Date();
				const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
				return { from: toISODate(past), to: toISODate(now) };
			},
		},
		{
			label: $t('app.search.date_preset_90days'),
			getRange: () => {
				const now = new Date();
				const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
				return { from: toISODate(past), to: toISODate(now) };
			},
		},
		{
			label: $t('app.search.date_preset_this_year'),
			getRange: () => {
				const now = new Date();
				const start = new Date(now.getFullYear(), 0, 1);
				return { from: toISODate(start), to: toISODate(now) };
			},
		},
		{
			label: $t('app.search.date_preset_last_year'),
			getRange: () => {
				const now = new Date();
				const start = new Date(now.getFullYear() - 1, 0, 1);
				const end = new Date(now.getFullYear() - 1, 11, 31);
				return { from: toISODate(start), to: toISODate(end) };
			},
		},
	]);

	function applyDatePreset(index: number) {
		const range = datePresets[index].getRange();
		dateFrom = range.from;
		dateTo = range.to;
	}

	const activePresetIndex = $derived.by(() => {
		if (!dateFrom || !dateTo) return -1;
		for (let i = 0; i < datePresets.length; i++) {
			const range = datePresets[i].getRange();
			if (range.from === dateFrom && range.to === dateTo) return i;
		}
		return -1;
	});

	function handleClear() {
		from = '';
		to = '';
		dateFrom = '';
		dateTo = '';
		hasAttachments = false;
		path = '';
		onClear?.();
	}

	const hasActiveFilters = $derived(
		!!(from || to || dateFrom || dateTo || hasAttachments || path)
	);
</script>

<div class="space-y-2">
	<button
		type="button"
		class="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-sm transition-colors"
		onclick={() => (expanded = !expanded)}
	>
		<SlidersHorizontalIcon class="size-4" />
		{$t('app.search.advanced_filters')}
		{#if hasActiveFilters}
			<span
				class="bg-primary text-primary-foreground ml-1 inline-flex size-5 items-center justify-center rounded-full text-xs"
			>
				!
			</span>
		{/if}
	</button>

	{#if expanded}
		<div class="rounded-lg border p-4 space-y-4">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				<div class="space-y-1">
					<Label>{$t('app.search.filter_sender')}</Label>
					<Input
						type="text"
						bind:value={from}
						placeholder="sender@example.com"
					/>
				</div>
				<div class="space-y-1">
					<Label>{$t('app.search.filter_recipient')}</Label>
					<Input
						type="text"
						bind:value={to}
						placeholder="recipient@example.com"
					/>
				</div>
				<div class="space-y-1">
					<Label>{$t('app.search.filter_folder')}</Label>
					<Input
						type="text"
						bind:value={path}
						placeholder="INBOX"
					/>
				</div>
			<div class="col-span-full space-y-1">
					<Label>{$t('app.search.date_presets')}</Label>
					<div class="flex flex-wrap gap-1">
						{#each datePresets as preset, i}
							<Button
								type="button"
								variant={activePresetIndex === i ? 'default' : 'outline'}
								size="sm"
								class="h-7 cursor-pointer text-xs"
								onclick={() => applyDatePreset(i)}
							>
								{preset.label}
							</Button>
						{/each}
					</div>
				</div>
				<div class="space-y-1">
					<Label>{$t('app.search.filter_date_from')}</Label>
					<Input type="date" bind:value={dateFrom} />
				</div>
				<div class="space-y-1">
					<Label>{$t('app.search.filter_date_to')}</Label>
					<Input type="date" bind:value={dateTo} />
				</div>
				<div class="flex items-center gap-2 pt-6">
					<Checkbox bind:checked={hasAttachments} />
					<Label class="cursor-pointer" onclick={() => (hasAttachments = !hasAttachments)}>
						{$t('app.search.filter_has_attachments')}
					</Label>
				</div>
			</div>
			<div class="flex gap-2">
				<Button type="button" size="sm" onclick={onApply}>
					{$t('app.search.apply_filters')}
				</Button>
				<Button type="button" variant="outline" size="sm" onclick={handleClear}>
					<XIcon class="mr-1 size-3" />
					{$t('app.search.clear_filters')}
				</Button>
			</div>
		</div>
	{/if}
</div>
