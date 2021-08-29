import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileRecordDBService } from './file-record-db-service';
import { elasticSearchDBService } from './elastic-search-db-service';

const app = express();
const PORT = 8000;

// middlewares
app.use((cors() as any));
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/api/v1/fileRecords', async (req, res) => {
    const fileRecords = await fileRecordDBService.findAll();
    res.json(fileRecords);
});

app.get('/api/v1/fileRecords/insert', async (req, res) => {
    const fileRecord = fileRecordDBService.insertFileRecord("C:/Users/Nadav/Downloads/Test.exe", new Date(), new Date(), Math.floor(Math.random() * 1000));
    res.json(fileRecord);
});

app.get('/api/v1/fileRecords/:query?', async (req, res) => {
    const extensions = req.query.ext ? String(req.query.ext).split(",") : undefined;
    const fileRecords = await fileRecordDBService.findBySearchQuery(req.params.query, extensions);
    res.json(fileRecords);
});

app.get('/api/v1/fileRecordsElastic/:query?', async (req, res) => {
    const extensions = req.query.ext ? String(req.query.ext).split(",") : undefined;
    const fileRecords = await elasticSearchDBService.findBySearchQuery(req.params.query);
    res.json(fileRecords);
});

// start server
app.listen(PORT, () => {
    console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});