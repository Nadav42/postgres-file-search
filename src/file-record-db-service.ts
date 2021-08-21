import "reflect-metadata";
import { Connection, createConnection, getConnection } from "typeorm";
import { FileRecord } from "./entity/FileRecord";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function prepareFilteredPath(path: string) {
    return path.split("/").splice(-2).join("/");
}

function preparePreFilteredPath(path: string) {
    return path.split("/").splice(0, path.split("/").length - 2).join("/");
}


const sleepForMS = 5000;
const MAX_SLEEP_RETRIES = 4;

class FileRecordDBService {
    private connection: Connection;

    constructor() {
        this.createInitialConnection();
        this.createCustomIndexes();
    }

    async createInitialConnection() {
        try {
            this.connection = await createConnection();
        } catch (error) {
            console.log(error);
            console.log("failed to create DB connection")
        }
    }

    async waitForInit() {
        let tries = 0;
        while (tries < MAX_SLEEP_RETRIES && (!this.connection || !this.connection.isConnected)) {
            console.log(`db not initialized, sleeping ${sleepForMS}ms`);
            tries = tries + 1;
            await sleep(sleepForMS);
        }
    }

    async createCustomIndexes(): Promise<void> {
        console.log("Creating indexes");
        await this.execCustomQuery(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
        await this.execCustomQuery(`CREATE INDEX IF NOT EXISTS path_pre_filtered_trgm_gin_index ON file_record USING GIN("preFilteredPath" gin_trgm_ops);`);
        await this.execCustomQuery(`CREATE INDEX IF NOT EXISTS path_filtered_trgm_gin_index ON file_record USING GIN("filteredPath" gin_trgm_ops);`);

    }

    // custom query with error handling
    async execCustomQuery(query: string): Promise<void> {
        await this.waitForInit();

        try {
            const connection = getConnection();
            await connection.manager.query(query)
        } catch (error) {
            console.log(error);
        }
    }

    async insertFileRecord(filePath: string, createdAt: Date, modifiedAt: Date, size: number): Promise<FileRecord> {
        await this.waitForInit();

        try {
            const connection = getConnection();
            // console.log("Inserting a new fileRecord into the database -", filePath);

            const fileRecord = new FileRecord();
            fileRecord.path = filePath;
            fileRecord.createdAt = createdAt;
            fileRecord.modifiedAt = modifiedAt;
            fileRecord.extension = filePath.includes(".") ? filePath.split(".").reverse()[0].toLowerCase() : "";
            fileRecord.filteredPath = prepareFilteredPath(filePath).toLowerCase();
            fileRecord.preFilteredPath = preparePreFilteredPath(filePath).toLowerCase();
            fileRecord.size = size;

            await connection.manager.save(fileRecord); // this will upsert by the primary key - if exists it will update modified date, size etc
            // console.log("saved a new fileRecord:", fileRecord);
            return fileRecord;
        } catch (error) {
            console.log(error);
        }

        return null;
    }

    async findAll(): Promise<FileRecord[]> {
        await this.waitForInit();

        try {
            const connection = getConnection();
            return await connection.manager.find(FileRecord);
        } catch (error) {
            console.log(error);
        }

        return [];
    }

    async findBySearchQuery(searchStr: string, extensions: string[] | undefined, limit: number = 50): Promise<FileRecord[]> {
        await this.waitForInit();

        const filteredResults = await this.findBySearchQueryFiltered(searchStr, extensions, limit);
        const fullResults = await this.findBySearchQueryFull(searchStr, extensions, limit - filteredResults.length);
        const results = [...filteredResults, ...fullResults];

        // remove duplicates
        const alreadyExists = new Set();
        const removedDuplicates = results.filter(item => {
            return alreadyExists.has(item.path) ? false : alreadyExists.add(item.path);
        });

        return removedDuplicates;
    }

    async findBySearchQueryFull(searchStr: string, extensions: string[] | undefined, limit: number): Promise<FileRecord[]> {
        if (limit <= 0) {
            return [];
        }

        await this.waitForInit();

        try {
            const connection = getConnection();
            let query = connection.getRepository(FileRecord).createQueryBuilder("fileRecord");
            searchStr.split(" ").forEach((word, index) => {
                const variableName = `word${index}`;
                if (index === 0) {
                    query = query.where(`fileRecord.preFilteredPath like LOWER(:${variableName})`, { [variableName]: `%${word}%` });
                } else {
                    query = query.andWhere(`fileRecord.preFilteredPath like LOWER(:${variableName})`, { [variableName]: `%${word}%` });
                }
            });

            if (extensions && extensions.length) {
                query = query.andWhere(`fileRecord.extension IN (:...extensions)`, { extensions });
            }

            return await query.orderBy('fileRecord.createdAt', 'DESC').limit(limit).getMany();
        } catch (error) {
            console.log(error);
        }

        return [];
    }

    async findBySearchQueryFiltered(searchStr: string, extensions: string[] | undefined, limit: number): Promise<FileRecord[]> {
        await this.waitForInit();

        try {
            const connection = getConnection();
            let query = connection.getRepository(FileRecord).createQueryBuilder("fileRecord");
            searchStr.split(" ").forEach((word, index) => {
                const variableName = `word${index}`;
                if (index === 0) {
                    query = query.where(`fileRecord.filteredPath like LOWER(:${variableName})`, { [variableName]: `%${word}%` });
                } else {
                    query = query.andWhere(`fileRecord.filteredPath like LOWER(:${variableName})`, { [variableName]: `%${word}%` });
                }
            });

            if (extensions && extensions.length) {
                query = query.andWhere(`fileRecord.extension IN (:...extensions)`, { extensions });
            }

            return await query.orderBy('fileRecord.createdAt', 'DESC').limit(limit).getMany();
        } catch (error) {
            console.log(error);
        }

        return [];
    }

    async close() {
        await this.connection.close();
    }
}

export const fileRecordDBService = new FileRecordDBService();