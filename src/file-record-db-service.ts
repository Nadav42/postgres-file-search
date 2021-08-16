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

    async insertFileRecord(filePath: string, createdAt: Date, modifiedAt: Date, size: number): Promise<FileRecord> {
        await this.waitForInit();

        try {
            const connection = getConnection();
            console.log("Inserting a new fileRecord into the database -", filePath);

            const fileRecord = new FileRecord();
            fileRecord.path = filePath;
            fileRecord.createdAt = createdAt;
            fileRecord.modifiedAt = modifiedAt;
            fileRecord.filteredPath = prepareFilteredPath(filePath);
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

    async findBySearchQuery(searchStr: string): Promise<FileRecord[]> {
        await this.waitForInit();

        try {
            const connection = getConnection();
            let query1 = connection.getRepository(FileRecord).createQueryBuilder("fileRecord");
            let query2 = connection.getRepository(FileRecord).createQueryBuilder("fileRecord2");

            searchStr.split(" ").forEach((word, index) => {
                if (index === 0) {
                    query1 = query1.where(`LOWER(fileRecord.path) like LOWER('%${word}%')`);
                    query2 = query2.where(`LOWER(fileRecord2.filteredPath) like LOWER('%${word}%')`);
                } else {
                    query1 = query1.andWhere(`LOWER(fileRecord.path) like LOWER('%${word}%')`);
                    query2 = query2.andWhere(`LOWER(fileRecord2.filteredPath) like LOWER('%${word}%'))`);
                }
            });
            return await connection.getRepository(FileRecord).query(`${query2.getQuery()} UNION ALL ${query1.getQuery()}`);
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