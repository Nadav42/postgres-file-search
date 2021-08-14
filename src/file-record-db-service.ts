import "reflect-metadata";
import { Connection, createConnection, getConnection } from "typeorm";
import { FileRecord } from "./entity/FileRecord";

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

    async insertFileRecord(filePath: string, createdAt: Date, modifiedAt: Date, size: number): Promise<FileRecord> {
        try {
            const connection = getConnection();
            console.log("Inserting a new fileRecord into the database -", filePath);

            const fileRecord = new FileRecord();
            fileRecord.path = filePath;
            fileRecord.createdAt = createdAt;
            fileRecord.modifiedAt = modifiedAt;
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
        try {
            const connection = getConnection();
            return await connection.manager.find(FileRecord);
        } catch (error) {
            console.log(error);
        }

        return [];
    }

    async findBySearchQuery(query: string): Promise<FileRecord[]> {
        try {
            const connection = getConnection();
            return await connection.getRepository(FileRecord)
                .createQueryBuilder("fileRecord")
                .where("LOWER(fileRecord.path) like LOWER(:word)", { word: "%STEAM%" })
                .andWhere("LOWER(fileRecord.path) like LOWER(:word2)", { word2: "%2%" })
                .getMany();
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