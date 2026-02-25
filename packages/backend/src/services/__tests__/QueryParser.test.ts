import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	parseSearchQuery,
	filtersToMeiliString,
	filterExpressionToMeiliString,
	type FilterExpression,
} from '../QueryParser';

describe('parseSearchQuery', () => {
	it('returns empty result for empty input', () => {
		const result = parseSearchQuery('');
		assert.equal(result.keywords, '');
		assert.equal(result.filters.length, 0);
		assert.equal(result.filterExpression, null);
	});

	it('returns empty result for whitespace-only input', () => {
		const result = parseSearchQuery('   ');
		assert.equal(result.keywords, '');
		assert.equal(result.filters.length, 0);
		assert.equal(result.filterExpression, null);
	});

	it('parses simple keywords', () => {
		const result = parseSearchQuery('invoice report');
		assert.equal(result.keywords, 'invoice report');
		assert.equal(result.filters.length, 0);
		assert.equal(result.filterExpression, null);
	});

	it('parses a single field filter', () => {
		const result = parseSearchQuery('from:john');
		assert.equal(result.keywords, '');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'from');
		assert.equal(result.filters[0].operator, 'eq');
		assert.equal(result.filters[0].value, 'john');
		assert.notEqual(result.filterExpression, null);
	});

	it('parses mixed keywords and field filter', () => {
		const result = parseSearchQuery('invoice from:john');
		assert.equal(result.keywords, 'invoice');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'from');
	});

	it('parses quoted field values', () => {
		const result = parseSearchQuery('subject:"monthly report"');
		assert.equal(result.keywords, '');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'subject');
		assert.equal(result.filters[0].value, 'monthly report');
	});

	it('parses quoted phrases as keywords', () => {
		const result = parseSearchQuery('"exact phrase" from:john');
		assert.equal(result.keywords, '"exact phrase"');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'from');
	});

	it('parses has:attachment', () => {
		const result = parseSearchQuery('has:attachment');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'hasAttachments');
		assert.equal(result.filters[0].value, true);
	});

	it('parses before: range filter', () => {
		const result = parseSearchQuery('before:2024-01-01');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'timestamp');
		assert.equal(result.filters[0].operator, 'lt');
		assert.equal(typeof result.filters[0].value, 'number');
	});

	it('parses after: range filter', () => {
		const result = parseSearchQuery('after:2023-01-01');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'timestamp');
		assert.equal(result.filters[0].operator, 'gte');
	});

	it('parses date range combination', () => {
		const result = parseSearchQuery('before:2024-01-01 after:2023-01-01');
		assert.equal(result.filters.length, 2);
		const beforeFilter = result.filters.find((f) => f.operator === 'lt');
		const afterFilter = result.filters.find((f) => f.operator === 'gte');
		assert.ok(beforeFilter);
		assert.ok(afterFilter);
	});

	it('parses OR between field filters', () => {
		const result = parseSearchQuery('from:john OR from:jane');
		assert.equal(result.keywords, '');
		assert.equal(result.filters.length, 2);
		assert.notEqual(result.filterExpression, null);
		assert.equal(result.filterExpression!.type, 'or');
	});

	it('parses NOT before a field filter', () => {
		const result = parseSearchQuery('NOT from:spam');
		assert.equal(result.filters.length, 1);
		assert.notEqual(result.filterExpression, null);
		assert.equal(result.filterExpression!.type, 'not');
	});

	it('parses grouped expression', () => {
		const result = parseSearchQuery('(from:john OR from:jane) AND has:attachment');
		assert.equal(result.filters.length, 3);
		assert.notEqual(result.filterExpression, null);
		assert.equal(result.filterExpression!.type, 'and');
	});

	it('handles implicit AND between adjacent filters', () => {
		const result = parseSearchQuery('from:john has:attachment');
		assert.equal(result.filters.length, 2);
		assert.notEqual(result.filterExpression, null);
		assert.equal(result.filterExpression!.type, 'and');
	});

	it('treats unknown field prefixes as keywords', () => {
		const result = parseSearchQuery('foo:bar');
		assert.equal(result.keywords, 'foo:bar');
		assert.equal(result.filters.length, 0);
	});

	it('parses in: field', () => {
		const result = parseSearchQuery('in:source123');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'ingestionSourceId');
	});

	it('parses tag: field', () => {
		const result = parseSearchQuery('tag:important');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'tags');
	});

	it('parses folder: field', () => {
		const result = parseSearchQuery('folder:INBOX');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'path');
		assert.equal(result.filters[0].operator, 'eq');
		assert.equal(result.filters[0].value, 'INBOX');
	});

	it('parses path: field', () => {
		const result = parseSearchQuery('path:Sent');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'path');
		assert.equal(result.filters[0].operator, 'eq');
		assert.equal(result.filters[0].value, 'Sent');
	});

	it('handles unmatched closing paren gracefully', () => {
		const result = parseSearchQuery('from:john)');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'from');
	});

	it('handles unmatched opening paren gracefully', () => {
		const result = parseSearchQuery('(from:john');
		assert.equal(result.filters.length, 1);
		assert.equal(result.filters[0].field, 'from');
	});

	it('handles only operators as input gracefully', () => {
		const result = parseSearchQuery('AND OR NOT');
		// These are just operators with nothing to operate on — parsed gracefully
		assert.equal(result.filterExpression, null);
	});

	it('is case-insensitive for boolean operators', () => {
		const result = parseSearchQuery('from:john or from:jane');
		assert.equal(result.filterExpression!.type, 'or');
	});

	it('handles complex nested expression', () => {
		const result = parseSearchQuery('(from:john OR to:john) AND NOT has:attachment');
		assert.equal(result.filters.length, 3);
		assert.notEqual(result.filterExpression, null);
		assert.equal(result.filterExpression!.type, 'and');
	});
});

describe('filterExpressionToMeiliString', () => {
	it('converts a simple filter', () => {
		const expr: FilterExpression = {
			type: 'filter',
			filter: { field: 'from', operator: 'eq', value: 'john' },
		};
		assert.equal(filterExpressionToMeiliString(expr), 'from = "john"');
	});

	it('converts AND expression', () => {
		const expr: FilterExpression = {
			type: 'and',
			left: { type: 'filter', filter: { field: 'from', operator: 'eq', value: 'john' } },
			right: {
				type: 'filter',
				filter: { field: 'hasAttachments', operator: 'eq', value: true },
			},
		};
		assert.equal(
			filterExpressionToMeiliString(expr),
			'from = "john" AND hasAttachments = true'
		);
	});

	it('converts OR expression with parens', () => {
		const expr: FilterExpression = {
			type: 'or',
			left: { type: 'filter', filter: { field: 'from', operator: 'eq', value: 'john' } },
			right: { type: 'filter', filter: { field: 'from', operator: 'eq', value: 'jane' } },
		};
		assert.equal(filterExpressionToMeiliString(expr), '(from = "john" OR from = "jane")');
	});

	it('converts NOT expression', () => {
		const expr: FilterExpression = {
			type: 'not',
			operand: { type: 'filter', filter: { field: 'from', operator: 'eq', value: 'spam' } },
		};
		assert.equal(filterExpressionToMeiliString(expr), 'NOT (from = "spam")');
	});

	it('converts numeric filter values', () => {
		const expr: FilterExpression = {
			type: 'filter',
			filter: { field: 'timestamp', operator: 'lt', value: 1704067200000 },
		};
		assert.equal(filterExpressionToMeiliString(expr), 'timestamp < 1704067200000');
	});

	it('escapes double quotes in values', () => {
		const expr: FilterExpression = {
			type: 'filter',
			filter: { field: 'subject', operator: 'eq', value: 'say "hello"' },
		};
		assert.equal(filterExpressionToMeiliString(expr), 'subject = "say \\"hello\\""');
	});
});

describe('filtersToMeiliString', () => {
	it('returns empty string for empty array', () => {
		assert.equal(filtersToMeiliString([]), '');
	});

	it('converts single filter', () => {
		const result = filtersToMeiliString([{ field: 'from', operator: 'eq', value: 'john' }]);
		assert.equal(result, 'from = "john"');
	});

	it('joins multiple filters with AND', () => {
		const result = filtersToMeiliString([
			{ field: 'from', operator: 'eq', value: 'john' },
			{ field: 'timestamp', operator: 'lt', value: 1704067200000 },
		]);
		assert.equal(result, 'from = "john" AND timestamp < 1704067200000');
	});
});

describe('end-to-end: parse + convert', () => {
	it('from:john OR from:jane → correct Meilisearch filter', () => {
		const parsed = parseSearchQuery('from:john OR from:jane');
		assert.notEqual(parsed.filterExpression, null);
		const meiliFilter = filterExpressionToMeiliString(parsed.filterExpression!);
		assert.equal(meiliFilter, '(from = "john" OR from = "jane")');
	});

	it('NOT from:spam → correct Meilisearch filter', () => {
		const parsed = parseSearchQuery('NOT from:spam');
		const meiliFilter = filterExpressionToMeiliString(parsed.filterExpression!);
		assert.equal(meiliFilter, 'NOT (from = "spam")');
	});

	it('(from:john OR to:john) AND has:attachment → correct Meilisearch filter', () => {
		const parsed = parseSearchQuery('(from:john OR to:john) AND has:attachment');
		const meiliFilter = filterExpressionToMeiliString(parsed.filterExpression!);
		assert.equal(meiliFilter, '(from = "john" OR to = "john") AND hasAttachments = true');
	});

	it('before:2024-01-01 after:2023-01-01 → range filters in expression', () => {
		const parsed = parseSearchQuery('before:2024-01-01 after:2023-01-01');
		assert.notEqual(parsed.filterExpression, null);
		const meiliFilter = filterExpressionToMeiliString(parsed.filterExpression!);
		assert.ok(meiliFilter.includes('timestamp <'));
		assert.ok(meiliFilter.includes('timestamp >='));
		assert.ok(meiliFilter.includes('AND'));
	});
});
