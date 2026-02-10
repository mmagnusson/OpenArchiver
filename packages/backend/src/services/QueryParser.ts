/**
 * QueryParser - Parses boolean/field search syntax into structured queries.
 *
 * Supported syntax:
 *   from:john              → filter on sender
 *   to:jane@example.com    → filter on recipient
 *   cc:someone             → filter on cc
 *   bcc:someone            → filter on bcc
 *   subject:invoice        → filter on subject field
 *   subject:"monthly report" → quoted field value
 *   has:attachment          → filter hasAttachments = true
 *   before:2024-01-01      → timestamp < date
 *   after:2023-06-01       → timestamp >= date
 *   in:sourceId            → filter by ingestion source
 *   tag:important          → filter by tag
 *   "exact phrase"         → passed through as keywords (Meilisearch handles natively)
 *   anything else          → free-text keywords
 */

export type QueryFilterField =
	| 'from'
	| 'to'
	| 'cc'
	| 'bcc'
	| 'subject'
	| 'hasAttachments'
	| 'timestamp'
	| 'ingestionSourceId'
	| 'tags';

export type QueryFilterOperator = 'eq' | 'lt' | 'gt' | 'lte' | 'gte';

export interface QueryFilter {
	field: QueryFilterField;
	operator: QueryFilterOperator;
	value: string | number | boolean;
}

export interface ParsedQuery {
	keywords: string;
	filters: QueryFilter[];
}

const FIELD_MAP: Record<string, QueryFilterField> = {
	from: 'from',
	to: 'to',
	cc: 'cc',
	bcc: 'bcc',
	subject: 'subject',
	in: 'ingestionSourceId',
	tag: 'tags',
};

function handleFieldToken(
	field: string,
	value: string,
	filters: QueryFilter[],
	keywordParts: string[]
): void {
	const lowerField = field.toLowerCase();

	if (lowerField === 'has' && value.toLowerCase() === 'attachment') {
		filters.push({ field: 'hasAttachments', operator: 'eq', value: true });
		return;
	}

	if (lowerField === 'before') {
		const timestamp = new Date(value).getTime();
		if (!isNaN(timestamp)) {
			filters.push({ field: 'timestamp', operator: 'lt', value: timestamp });
		} else {
			keywordParts.push(`${field}:${value}`);
		}
		return;
	}

	if (lowerField === 'after') {
		const timestamp = new Date(value).getTime();
		if (!isNaN(timestamp)) {
			filters.push({ field: 'timestamp', operator: 'gte', value: timestamp });
		} else {
			keywordParts.push(`${field}:${value}`);
		}
		return;
	}

	const mappedField = FIELD_MAP[lowerField];
	if (mappedField) {
		filters.push({ field: mappedField, operator: 'eq', value });
		return;
	}

	// Unknown field prefix — treat as regular keyword
	keywordParts.push(`${field}:${value}`);
}

/**
 * Parses a search query string into structured keywords and filters.
 *
 * Examples:
 *   "from:john invoice report" → { keywords: "invoice report", filters: [{from, eq, "john"}] }
 *   "has:attachment before:2024-01-01" → { keywords: "", filters: [{hasAttachments, eq, true}, {timestamp, lt, epoch}] }
 *   '"exact phrase" other words' → { keywords: '"exact phrase" other words', filters: [] }
 */
export function parseSearchQuery(input: string): ParsedQuery {
	if (!input || !input.trim()) {
		return { keywords: '', filters: [] };
	}

	const filters: QueryFilter[] = [];
	const keywordParts: string[] = [];

	// Match field:"quoted value", field:value, "quoted phrase", or bare word
	const tokenRegex = /(\w+):"([^"]+)"|(\w+):(\S+)|"([^"]+)"|(\S+)/g;

	let match: RegExpExecArray | null;
	while ((match = tokenRegex.exec(input)) !== null) {
		if (match[1] && match[2]) {
			// field:"quoted value"
			handleFieldToken(match[1], match[2], filters, keywordParts);
		} else if (match[3] && match[4]) {
			// field:value
			handleFieldToken(match[3], match[4], filters, keywordParts);
		} else if (match[5]) {
			// "quoted phrase" — pass through to keywords for Meilisearch
			keywordParts.push(`"${match[5]}"`);
		} else if (match[6]) {
			// bare word
			keywordParts.push(match[6]);
		}
	}

	return {
		keywords: keywordParts.join(' '),
		filters,
	};
}

/**
 * Converts an array of QueryFilter objects into a Meilisearch filter string.
 *
 * Example:
 *   [{ field: 'from', operator: 'eq', value: 'john' }, { field: 'timestamp', operator: 'lt', value: 1704067200000 }]
 *   → 'from = "john" AND timestamp < 1704067200000'
 */
export function filtersToMeiliString(filters: QueryFilter[]): string {
	if (filters.length === 0) return '';

	const operatorMap: Record<QueryFilterOperator, string> = {
		eq: '=',
		lt: '<',
		gt: '>',
		lte: '<=',
		gte: '>=',
	};

	return filters
		.map((f) => {
			const op = operatorMap[f.operator];
			if (typeof f.value === 'boolean') return `${f.field} ${op} ${f.value}`;
			if (typeof f.value === 'number') return `${f.field} ${op} ${f.value}`;
			return `${f.field} ${op} "${f.value}"`;
		})
		.join(' AND ');
}
