import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileRecordDBService } from './file-record-db-service';

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
    fileRecordDBService.insertFileRecord("C:/Users/Nadav/Downloads/Steam2.exe", new Date(), new Date(), Math.floor(Math.random() * 1000));
    res.json({ msg: "hello", params: req.params });
});

app.get('/api/v1/fileRecords/:query?', async (req, res) => {
    const fileRecords = await fileRecordDBService.findBySearchQuery(req.params.query);
    res.json(fileRecords);
});

// start server
app.listen(PORT, () => {
    console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});