import 'dotenv/config';

export const searchConfig = {
	host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
	apiKey: process.env.MEILI_MASTER_KEY || '',
};

export const meiliConfig = {
	indexingBatchSize: process.env.MEILI_INDEXING_BATCH
		? parseInt(process.env.MEILI_INDEXING_BATCH)
		: 500,
	searchDefaultLimit: process.env.MEILI_SEARCH_DEFAULT_LIMIT
		? parseInt(process.env.MEILI_SEARCH_DEFAULT_LIMIT)
		: 10,
	searchMaxLimit: process.env.MEILI_SEARCH_MAX_LIMIT
		? parseInt(process.env.MEILI_SEARCH_MAX_LIMIT)
		: 100,
	facetMaxValuesPerFacet: process.env.MEILI_FACET_MAX_VALUES
		? parseInt(process.env.MEILI_FACET_MAX_VALUES)
		: 100,
	cropLength: process.env.MEILI_CROP_LENGTH
		? parseInt(process.env.MEILI_CROP_LENGTH)
		: 200,
};
