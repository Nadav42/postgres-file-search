import "reflect-metadata";
import { Connection, createConnection, getConnection } from "typeorm";
import { FileRecord } from "./entity/FileRecord";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function prepareFilteredPath(path: string) {
    return path.split("/").splice(-2).join("/");
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
        await this.waitForInit();

        try {
            const connection = getConnection();
            console.log("Creating indexes");
            await connection.manager.query(`CREATE INDEX IF NOT EXISTS path_lower_trgm_gin_index ON file_record USING GIN("pathLower" gin_trgm_ops);`)
            await connection.manager.query(`CREATE INDEX IF NOT EXISTS path_filtered_trgm_gin_index ON file_record USING GIN("filteredPath" gin_trgm_ops);`)
        } catch (error) {
            console.log(error);
        }

        return null;
    }

    async insertFileRecord(filePath: string, createdAt: Date, modifiedAt: Date, size: number): Promise<FileRecord> {
        await this.waitForInit();

        try {
            const connection = getConnection();
            console.log("Inserting a new fileRecord into the database -", filePath);

            const fileRecord = new FileRecord();
            fileRecord.path = filePath;
            fileRecord.createdAt = createdAt;
            fileRecord.modifiedAt = modifiedAt;
            fileRecord.pathLower = filePath.toLowerCase();
            fileRecord.filteredPath = prepareFilteredPath(filePath).toLowerCase();
            fileRecord.size = size;

            await connection.manager.save(fileRecord); // this will upsert by the primary key - if exists it will update modified date, size etc
            console.log("saved a new fileRecord:", fileRecord);
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

    async findBySearchQuery(searchStr: string, limit: number = 100): Promise<FileRecord[]> {
        await this.waitForInit();

        const [filteredResults, fullResults] = await Promise.all([this.findBySearchQueryFiltered(searchStr), this.findBySearchQueryFull(searchStr)]);
        const results = [...filteredResults, ...fullResults];

        // remove duplicates
        const alreadyExists = new Set();
        const removedDuplicates = results.filter(item => {
            return alreadyExists.has(item.path) ? false : alreadyExists.add(item.path);
        });

        return removedDuplicates;
    }

    async findBySearchQueryFull(searchStr: string): Promise<FileRecord[]> {
        await this.waitForInit();

        try {
            const connection = getConnection();
            let query = connection.getRepository(FileRecord).createQueryBuilder("fileRecord");
            searchStr.split(" ").forEach((word, index) => {
                const variableName = `word${index}`;
                if (index === 0) {
                    query = query.where(`fileRecord.pathLower like LOWER(:${variableName})`, { [variableName]: `%${word}%` });
                } else {
                    query = query.andWhere(`fileRecord.pathLower like LOWER(:${variableName})`, { [variableName]: `%${word}%` });
                }
            });
            return await query.getMany();
        } catch (error) {
            console.log(error);
        }

        return [];
    }

    async findBySearchQueryFiltered(searchStr: string): Promise<FileRecord[]> {
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
            return await query.getMany();
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