import "reflect-metadata";
import { createConnection } from "typeorm";
import { FileRecord } from "./entity/FileRecord";

createConnection().then(async (connection) => {
    console.log("Inserting a new fileRecord into the database...");

    const fileRecord = new FileRecord();
    fileRecord.path = "C:/Users/Nadav/Downloads/SteamSetup2.exe";
    fileRecord.createdAt = new Date();
    fileRecord.modifiedAt = new Date();
    fileRecord.size = 500;

    await connection.manager.save(fileRecord); // this will upsert by the primary key - if exists it will update modified date, size etc
    console.log("Saved a new fileRecord:", fileRecord);

    console.log("Loading all from the database...");
    const fileRecords = await connection.manager.find(FileRecord);

    console.log("Loaded fileRecords: ", fileRecords);
}).catch(error => console.log(error));
