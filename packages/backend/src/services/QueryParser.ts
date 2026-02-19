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
 *
 * Boolean operators (between field filters):
 *   from:john OR from:jane           → OR expression
 *   NOT from:spam                    → NOT expression
 *   (from:john OR from:jane) AND has:attachment → grouped expression
 *   Implicit AND for adjacent field filters
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
	| 'tags'
	| 'path';

export type QueryFilterOperator = 'eq' | 'lt' | 'gt' | 'lte' | 'gte';

export interface QueryFilter {
	field: QueryFilterField;
	operator: QueryFilterOperator;
	value: string | number | boolean;
}

export type FilterExpression =
	| { type: 'filter'; filter: QueryFilter }
	| { type: 'and'; left: FilterExpression; right: FilterExpression }
	| { type: 'or'; left: FilterExpression; right: FilterExpression }
	| { type: 'not'; operand: FilterExpression };

export interface ParsedQuery {
	keywords: string;
	filters: QueryFilter[];
	filterExpression: FilterExpression | null;
}

// --- Tokenizer ---

type Token =
	| { type: 'field'; field: string; value: string }
	| { type: 'keyword'; value: string }
	| { type: 'quoted'; value: string }
	| { type: 'and' }
	| { type: 'or' }
	| { type: 'not' }
	| { type: 'lparen' }
	| { type: 'rparen' };

const FIELD_MAP: Record<string, QueryFilterField> = {
	from: 'from',
	to: 'to',
	cc: 'cc',
	bcc: 'bcc',
	subject: 'subject',
	in: 'ingestionSourceId',
	tag: 'tags',
	folder: 'path',
	path: 'path',
};

const BOOLEAN_OPERATORS = new Set(['and', 'or', 'not']);

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	// Match: field:"quoted value", (, ), "quoted phrase", field:value, or bare word
	// Note: [^\s()] excludes parens from field values and bare words so parens are tokenized separately
	const tokenRegex = /(\w+):"([^"]*)"|\(|\)|"([^"]*)"|(\w+):([^\s()]+)|([^\s()]+)/g;

	let match: RegExpExecArray | null;
	while ((match = tokenRegex.exec(input)) !== null) {
		if (match[1] !== undefined && match[2] !== undefined) {
			// field:"quoted value"
			tokens.push({ type: 'field', field: match[1], value: match[2] });
		} else if (match[0] === '(') {
			tokens.push({ type: 'lparen' });
		} else if (match[0] === ')') {
			tokens.push({ type: 'rparen' });
		} else if (match[3] !== undefined) {
			// "quoted phrase"
			tokens.push({ type: 'quoted', value: match[3] });
		} else if (match[4] !== undefined && match[5] !== undefined) {
			// field:value
			tokens.push({ type: 'field', field: match[4], value: match[5] });
		} else if (match[6] !== undefined) {
			// bare word — check if it's a boolean operator
			const word = match[6];
			if (BOOLEAN_OPERATORS.has(word.toLowerCase())) {
				tokens.push({ type: word.toLowerCase() as 'and' | 'or' | 'not' });
			} else {
				tokens.push({ type: 'keyword', value: word });
			}
		}
	}

	return tokens;
}

// --- Field → QueryFilter conversion ---

function fieldTokenToFilter(field: string, value: string): QueryFilter | null {
	const lowerField = field.toLowerCase();

	if (lowerField === 'has' && value.toLowerCase() === 'attachment') {
		return { field: 'hasAttachments', operator: 'eq', value: true };
	}

	if (lowerField === 'before') {
		const timestamp = new Date(value).getTime();
		if (!isNaN(timestamp)) {
			return { field: 'timestamp', operator: 'lt', value: timestamp };
		}
		return null;
	}

	if (lowerField === 'after') {
		const timestamp = new Date(value).getTime();
		if (!isNaN(timestamp)) {
			return { field: 'timestamp', operator: 'gte', value: timestamp };
		}
		return null;
	}

	const mappedField = FIELD_MAP[lowerField];
	if (mappedField) {
		return { field: mappedField, operator: 'eq', value };
	}

	return null; // Unknown field
}

// --- Recursive Descent Parser ---
//
// Grammar:
//   expression  → or_expr
//   or_expr     → and_expr ('OR' and_expr)*
//   and_expr    → not_expr (('AND' | implicit) not_expr)*
//   not_expr    → 'NOT' not_expr | primary
//   primary     → '(' expression ')' | field_filter

class ExpressionParser {
	private tokens: Token[];
	private pos: number;
	private keywordParts: string[];
	private allFilters: QueryFilter[];

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.pos = 0;
		this.keywordParts = [];
		this.allFilters = [];
	}

	parse(): { expression: FilterExpression | null; keywords: string; filters: QueryFilter[] } {
		const filterExpressions: FilterExpression[] = [];

		while (this.pos < this.tokens.length) {
			const expr = this.tryParseExpression();
			if (expr) {
				filterExpressions.push(expr);
			}
		}

		let combinedExpression: FilterExpression | null = null;
		if (filterExpressions.length === 1) {
			combinedExpression = filterExpressions[0];
		} else if (filterExpressions.length > 1) {
			combinedExpression = filterExpressions.reduce((left, right) => ({
				type: 'and' as const,
				left,
				right,
			}));
		}

		return {
			expression: combinedExpression,
			keywords: this.keywordParts.join(' '),
			filters: this.allFilters,
		};
	}

	private tryParseExpression(): FilterExpression | null {
		// Skip keywords and collect them, then try to parse a filter expression
		const expr = this.parseOrExpr();
		return expr;
	}

	private peek(): Token | null {
		return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
	}

	private advance(): Token | null {
		return this.pos < this.tokens.length ? this.tokens[this.pos++] : null;
	}

	private parseOrExpr(): FilterExpression | null {
		let left = this.parseAndExpr();

		while (this.peek()?.type === 'or') {
			this.advance(); // consume OR
			const right = this.parseAndExpr();
			if (left && right) {
				left = { type: 'or', left, right };
			} else if (right) {
				left = right;
			}
			// if right is null, keep left as-is
		}

		return left;
	}

	private parseAndExpr(): FilterExpression | null {
		let left = this.parseNotExpr();

		while (true) {
			const next = this.peek();
			if (!next) break;

			// Explicit AND
			if (next.type === 'and') {
				this.advance(); // consume AND
				const right = this.parseNotExpr();
				if (left && right) {
					left = { type: 'and', left, right };
				} else if (right) {
					left = right;
				}
				continue;
			}

			// Implicit AND: next token starts a new primary (field, NOT, or lparen)
			if (next.type === 'field' || next.type === 'not' || next.type === 'lparen') {
				const right = this.parseNotExpr();
				if (left && right) {
					left = { type: 'and', left, right };
				} else if (right) {
					left = right;
				}
				continue;
			}

			break;
		}

		return left;
	}

	private parseNotExpr(): FilterExpression | null {
		if (this.peek()?.type === 'not') {
			this.advance(); // consume NOT
			const operand = this.parseNotExpr();
			if (operand) {
				return { type: 'not', operand };
			}
			return null;
		}

		return this.parsePrimary();
	}

	private parsePrimary(): FilterExpression | null {
		const token = this.peek();
		if (!token) return null;

		// Parenthesized expression
		if (token.type === 'lparen') {
			this.advance(); // consume (
			const expr = this.parseOrExpr();
			if (this.peek()?.type === 'rparen') {
				this.advance(); // consume )
			}
			// If no matching rparen, gracefully continue
			return expr;
		}

		// Field filter
		if (token.type === 'field') {
			this.advance(); // consume field token
			const filter = fieldTokenToFilter(token.field, token.value);
			if (filter) {
				this.allFilters.push(filter);
				return { type: 'filter', filter };
			}
			// Unknown field — treat as keyword
			this.keywordParts.push(`${token.field}:${token.value}`);
			return null;
		}

		// Keyword or quoted phrase — collect and return null (not a filter expression)
		if (token.type === 'keyword') {
			this.advance();
			this.keywordParts.push(token.value);
			return null;
		}

		if (token.type === 'quoted') {
			this.advance();
			this.keywordParts.push(`"${token.value}"`);
			return null;
		}

		// Unexpected token (rparen without lparen, dangling operator) — skip
		this.advance();
		return null;
	}
}

/**
 * Parses a search query string into structured keywords and filters with boolean support.
 *
 * Examples:
 *   "from:john invoice report" → { keywords: "invoice report", filters: [{from, eq, "john"}], filterExpression: {...} }
 *   "from:john OR from:jane" → { keywords: "", filters: [...], filterExpression: { type: 'or', ... } }
 *   "NOT from:spam" → { keywords: "", filters: [...], filterExpression: { type: 'not', ... } }
 */
export function parseSearchQuery(input: string): ParsedQuery {
	if (!input || !input.trim()) {
		return { keywords: '', filters: [], filterExpression: null };
	}

	const tokens = tokenize(input);
	const parser = new ExpressionParser(tokens);
	const result = parser.parse();

	return {
		keywords: result.keywords,
		filters: result.filters,
		filterExpression: result.expression,
	};
}

// --- Meilisearch filter string generation ---

const OPERATOR_MAP: Record<QueryFilterOperator, string> = {
	eq: '=',
	lt: '<',
	gt: '>',
	lte: '<=',
	gte: '>=',
};

function filterToMeiliString(filter: QueryFilter): string {
	const op = OPERATOR_MAP[filter.operator];
	if (typeof filter.value === 'boolean') return `${filter.field} ${op} ${filter.value}`;
	if (typeof filter.value === 'number') return `${filter.field} ${op} ${filter.value}`;
	// Escape inner double quotes
	const escaped = String(filter.value).replace(/"/g, '\\"');
	return `${filter.field} ${op} "${escaped}"`;
}

/**
 * Converts a FilterExpression tree into a Meilisearch filter string.
 */
export function filterExpressionToMeiliString(expr: FilterExpression): string {
	switch (expr.type) {
		case 'filter':
			return filterToMeiliString(expr.filter);
		case 'and':
			return `${filterExpressionToMeiliString(expr.left)} AND ${filterExpressionToMeiliString(expr.right)}`;
		case 'or':
			return `(${filterExpressionToMeiliString(expr.left)} OR ${filterExpressionToMeiliString(expr.right)})`;
		case 'not':
			return `NOT (${filterExpressionToMeiliString(expr.operand)})`;
	}
}

/**
 * Converts an array of QueryFilter objects into a Meilisearch filter string.
 * Kept for backward compatibility.
 *
 * Example:
 *   [{ field: 'from', operator: 'eq', value: 'john' }, { field: 'timestamp', operator: 'lt', value: 1704067200000 }]
 *   → 'from = "john" AND timestamp < 1704067200000'
 */
export function filtersToMeiliString(filters: QueryFilter[]): string {
	if (filters.length === 0) return '';
	return filters.map(filterToMeiliString).join(' AND ');
}
