import { Client } from '@elastic/elasticsearch';

export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function prepareFilteredPath(path: string) {
	return path.split("/").splice(-2).join("/");
}

export function preparePreFilteredPath(path: string) {
	return path.split("/").splice(0, path.split("/").length - 2).join("/");
}

interface IESFileRecord {
	path: string;
	prefixPath: string;
	suffixPath: string;
	extension: string;
	createdAt: Date;
	modifiedAt: Date;
	size: number;
}

class ElasticSearchDBService {
	private client: Client;

	constructor() {
		this.client = new Client({ node: "http://localhost:9200" });
	}

	async insertRecord(filePath: string, createdAt: Date, modifiedAt: Date, size: number) {
		await this.client.update({
			index: "file-records2",
			id: filePath,
			body: {
				doc: {
					path: filePath,
					prefixPath: preparePreFilteredPath(filePath).toLowerCase(),
					suffixPath: prepareFilteredPath(filePath).toLowerCase(),
					extension: filePath.includes(".") ? filePath.split(".").reverse()[0].toLowerCase() : "",
					createdAt: createdAt,
					modifiedAt: modifiedAt,
					size: size
				},
				doc_as_upsert: true
			}
		});
	}

	async refreshIndex() {
		await this.client.indices.refresh({ index: "file-records2" }); // We need to force an index refresh at this point, otherwise we will not get any result in the consequent search
	}

	async findBySearchQuery(pathSearch: string): Promise<IESFileRecord[]> {
		// use like: "query": "(setup OR *setup*) AND (chrome OR *chrome*)"
		const words = pathSearch.split(" ");
		const searchQuery = words.map(word => `(${word} OR *${word}*)`).join(" AND ");

		const searchData = await this.client.search({
			index: "file-records2",
			body: {
				query: {
					query_string: {
						fields: ["suffixPath"],
						query: searchQuery
					}
				},
				size: 100,
				from: 0,
				sort: [{ "createdAt": { "order": "desc" } }]
			}
		})

		//console.log(searchData);
		//console.log(searchData.body.hits.hits);
		return (searchData?.body?.hits?.hits || []).map(hit => hit._source);
	}
}

export const elasticSearchDBService = new ElasticSearchDBService();

// const test = async () => {
// 	await elasticSearchDBService.insertRecord("C:/Users/Nadav/Test2/chrome5.exe", new Date(), new Date(), Math.floor(Math.random() * 1000));
// 	await elasticSearchDBService.refreshIndex();

// 	const searchResults = await elasticSearchDBService.getRecordsByPath("test2");
// 	console.log(searchResults);
// }

// test();