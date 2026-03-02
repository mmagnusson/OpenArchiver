<script lang="ts">
	import PostalMime, { type Email, type Header, type Attachment } from 'postal-mime';
	import type { Buffer } from 'buffer';
	import { t } from '$lib/translations';
	import { encode } from 'html-entities';

	let {
		raw,
		rawHtml,
	}: { raw?: Buffer | { type: 'Buffer'; data: number[] } | undefined; rawHtml?: string } =
		$props();

	let parsedEmail: Email | null = $state(null);
	let isLoading = $state(true);
	let parseError: string | null = $state(null);

	function getHeaderValue(headers: Header[], key: string): string | undefined {
		const header = headers.find((h) => Object.keys(h).some((k) => k.toLowerCase() === key));
		if (!header) return undefined;
		const matchingKey = Object.keys(header).find((k) => k.toLowerCase() === key);
		return matchingKey ? header[matchingKey] : undefined;
	}

	function attachmentToString(att: Attachment): string | null {
		try {
			if (typeof att.content === 'string') return att.content;
			if (att.content instanceof ArrayBuffer) {
				return new TextDecoder().decode(att.content);
			}
			return null;
		} catch {
			return null;
		}
	}

	function renderCalendarHtml(ical: string): string {
		const lines = ical.split(/\r?\n/);
		const fields: Record<string, string> = {};
		for (const line of lines) {
			const match = line.match(/^(SUMMARY|DTSTART|DTEND|LOCATION|ORGANIZER|DESCRIPTION)[^:]*:(.*)/i);
			if (match) {
				const key = match[1].toUpperCase();
				let value = match[2].trim();
				// Parse iCal date formats (e.g. 20250115T090000Z)
				if ((key === 'DTSTART' || key === 'DTEND') && /^\d{8}T\d{6}/.test(value)) {
					try {
						const d = new Date(
							value.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z')
						);
						if (!isNaN(d.getTime())) value = d.toLocaleString();
					} catch {
						// keep raw value
					}
				}
				// Strip mailto: prefix from organizer
				if (key === 'ORGANIZER') {
					value = value.replace(/^mailto:/i, '');
				}
				fields[key] = value;
			}
		}

		const labels: Record<string, string> = {
			SUMMARY: 'Event',
			DTSTART: 'Start',
			DTEND: 'End',
			LOCATION: 'Location',
			ORGANIZER: 'Organizer',
			DESCRIPTION: 'Description',
		};

		const rows = Object.entries(labels)
			.filter(([key]) => fields[key])
			.map(
				([key, label]) =>
					`<tr><td style="padding:4px 12px 4px 0;font-weight:600;vertical-align:top;white-space:nowrap">${encode(label)}</td><td style="padding:4px 0">${encode(fields[key])}</td></tr>`
			)
			.join('');

		return `<base target="_blank" /><div style="font-family:system-ui,sans-serif;padding:16px"><h3 style="margin:0 0 12px">Calendar Invite</h3><table style="border-collapse:collapse">${rows}</table></div>`;
	}

	function tryRecoverContent(email: Email): string | null {
		// Try to find an HTML attachment
		const htmlAtt = email.attachments.find(
			(a) => a.mimeType?.toLowerCase() === 'text/html'
		);
		if (htmlAtt) {
			const html = attachmentToString(htmlAtt);
			if (html) return `<base target="_blank" />${html}`;
		}

		// Try to find a calendar attachment and render it
		const calAtt = email.attachments.find(
			(a) => a.mimeType?.toLowerCase() === 'text/calendar'
		);
		if (calAtt) {
			const ical = attachmentToString(calAtt);
			if (ical) return renderCalendarHtml(ical);
		}

		// Try to find a plain text attachment
		const textAtt = email.attachments.find(
			(a) => a.mimeType?.toLowerCase() === 'text/plain'
		);
		if (textAtt) {
			const text = attachmentToString(textAtt);
			if (text) {
				return `<base target="_blank" /><div style="font-family:system-ui,sans-serif;white-space:pre-wrap;padding:16px">${encode(text)}</div>`;
			}
		}

		return null;
	}

	function diagnoseNoBody(email: Email): string {
		const contentType = getHeaderValue(email.headers, 'content-type')?.toLowerCase() || '';

		if (
			contentType.includes('application/pkcs7-mime') ||
			contentType.includes('application/x-pkcs7-mime')
		) {
			return 'This email is S/MIME encrypted and cannot be previewed.';
		}

		const hasEncryptedAttachment = email.attachments.some(
			(a) =>
				a.mimeType?.toLowerCase().includes('pkcs7') ||
				a.mimeType?.toLowerCase().includes('pkcs7-mime')
		);
		if (hasEncryptedAttachment) {
			return 'This email is encrypted and cannot be previewed.';
		}

		return 'The email was parsed but contains no displayable HTML or text content.';
	}

	// By adding a <base> tag, all relative and absolute links in the HTML document
	// will open in a new tab by default.
	let emailHtml = $derived.by(() => {
		if (parsedEmail && parsedEmail.html) {
			return `<base target="_blank" />${parsedEmail.html}`;
		} else if (parsedEmail && parsedEmail.text) {
			const safeHtmlContent: string = encode(parsedEmail.text);
			return `<base target="_blank" /><div>${safeHtmlContent.replaceAll('\n', '<br>')}</div>`;
		} else if (rawHtml) {
			return `<base target="_blank" />${rawHtml}`;
		} else if (parsedEmail) {
			// Attempt to recover displayable content from attachments
			return tryRecoverContent(parsedEmail);
		}
		return null;
	});

	function toUint8Array(input: Buffer | { type: 'Buffer'; data: number[] }): Uint8Array | null {
		try {
			if (input && typeof input === 'object' && 'type' in input && input.type === 'Buffer') {
				if (!Array.isArray(input.data) || input.data.length === 0) return null;
				return new Uint8Array(input.data);
			}
			// ArrayBuffer, Buffer, or Uint8Array-like
			const arr = new Uint8Array(input as Buffer);
			if (arr.length === 0) return null;
			return arr;
		} catch {
			return null;
		}
	}

	$effect(() => {
		async function parseEmail() {
			if (raw) {
				try {
					const buffer = toUint8Array(raw);
					if (!buffer) {
						parseError = 'Empty or invalid email data';
						isLoading = false;
						return;
					}
					const parsed = await new PostalMime().parse(buffer);
					parsedEmail = parsed;
					parseError = null;
				} catch (error) {
					console.error('Failed to parse email:', error);
					parseError = error instanceof Error ? error.message : 'Unknown parsing error';
				} finally {
					isLoading = false;
				}
			} else {
				isLoading = false;
			}
		}
		parseEmail();
	});
</script>

<div class="mt-2 rounded-md border bg-white p-4">
	{#if isLoading}
		<p>{$t('app.components.email_preview.loading')}</p>
	{:else if emailHtml}
		<iframe
			title={$t('app.archive.email_preview')}
			sandbox="allow-same-origin"
			srcdoc={emailHtml}
			class="h-[600px] w-full border-none"
		></iframe>
	{:else if parseError}
		<p class="text-red-600">{parseError}</p>
	{:else if parsedEmail}
		<p class="text-muted-foreground">{diagnoseNoBody(parsedEmail)}</p>
	{:else}
		<p class="text-gray-500">{$t('app.components.email_preview.not_available')}</p>
	{/if}
</div>
