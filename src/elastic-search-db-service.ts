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
		await this.client.index<IESFileRecord>({
			index: "file-records",
			body: {
				path: filePath,
				prefixPath: preparePreFilteredPath(filePath).toLowerCase(),
				suffixPath: prepareFilteredPath(filePath).toLowerCase(),
				extension: filePath.includes(".") ? filePath.split(".").reverse()[0].toLowerCase() : "",
				createdAt: createdAt,
				modifiedAt: modifiedAt,
				size: size
			}
		});
	}

	async refreshIndex() {
		await this.client.indices.refresh({ index: "file-records" }); // We need to force an index refresh at this point, otherwise we will not get any result in the consequent search
	}

	async getRecordsByPath(pathSearch: string): Promise<IESFileRecord[]> {
		const searchData = await this.client.search({
			index: "file-records",
			body: {
				query: {
					query_string: {
						fields: ["suffixPath"],
						query: `${pathSearch} | *${pathSearch}*`
					}
				},
				size: 100,
				from: 0,
				sort: ["createdAt"]
			}
		})

		//console.log(searchData);
		//console.log(searchData.body.hits.hits);
		return searchData?.body?.hits?.hits || [];
	}
}

const test = async () => {
	const elasticSearchDBService = new ElasticSearchDBService();
	await elasticSearchDBService.insertRecord("C:/Users/Nadav/Test2/chrome5.exe", new Date(), new Date(), Math.floor(Math.random() * 1000));
	await elasticSearchDBService.refreshIndex();

	const searchResults = await elasticSearchDBService.getRecordsByPath("test2");
	console.log(searchResults);
}

test();