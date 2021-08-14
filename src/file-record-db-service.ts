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

    async findBySearchQuery(searchStr: string): Promise<FileRecord[]> {
        try {
            const connection = getConnection();
            let query = connection.getRepository(FileRecord).createQueryBuilder("fileRecord");
            searchStr.split(" ").forEach((word, index) => {
                const variableName = `word${index}`;
                if (index === 0) {
                    query = query.where(`LOWER(fileRecord.path) like LOWER(:${variableName})`, { [variableName]: `%${word}%` });
                } else {
                    query = query.andWhere(`LOWER(fileRecord.path) like LOWER(:${variableName})`, { [variableName]: `%${word}%` });
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