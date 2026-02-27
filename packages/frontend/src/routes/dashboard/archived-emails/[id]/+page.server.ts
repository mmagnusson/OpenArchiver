import { api } from '$lib/server/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { ArchivedEmail, IntegrityCheckResult } from '@open-archiver/types';

export const load: PageServerLoad = async (event) => {
	const { id } = event.params;

	// Fetch email — this is critical, fail hard if it doesn't work
	const emailResponse = await api(`/archived-emails/${id}`, event);

	if (!emailResponse.ok) {
		const responseText = await emailResponse.json().catch(() => ({ message: '' }));
		error(
			emailResponse.status,
			responseText.message || 'You do not have permission to read this email.'
		);
	}

	const email: ArchivedEmail = await emailResponse.json();

	// Fetch integrity check separately — don't block email display if this fails
	let integrityReport: IntegrityCheckResult[] = [];
	try {
		const integrityResponse = await api(`/integrity/${id}`, event);
		if (integrityResponse.ok) {
			integrityReport = await integrityResponse.json();
		} else {
			console.error(
				`Integrity check failed for email ${id}: HTTP ${integrityResponse.status}`
			);
		}
	} catch (e) {
		console.error(`Integrity check error for email ${id}:`, e);
	}

	return {
		email,
		integrityReport,
	};
};
