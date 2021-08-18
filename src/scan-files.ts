import fs from 'fs';
import { fileRecordDBService } from './file-record-db-service';

//joining path of directory 
const directoryPath = "C:/";
console.log(directoryPath);

class FolderScanner {
	constructor() {

	}

	async scanDirectoryRecursive(directoryPath: string, depth: number = 0, maxDepth: number = 250) {
		if (depth > maxDepth) {
			console.log("reached depth limit...");
			return;
		}

		fs.readdir(directoryPath, async (err, files) => {
			//handling error
			if (err) {
				console.log('Unable to scan directory: ' + err, directoryPath);
				return
			}

			// iterate all files
			await this.processFiles(directoryPath, files, depth, maxDepth);
		});
	}

	async processFiles(directoryPath: string, files: string[], depth: number, maxDepth: number) {
		for (let index = 0; index < files.length; index++) {
			const file = files[index];
			await this.processFile(directoryPath, file, depth, maxDepth);
		}
	}

	async processFile(directoryPath: string, file: string, depth: number, maxDepth: number) {
		const filePath = `${directoryPath}/${file}`;
		const stats = fs.statSync(filePath);

		if (stats.isFile()) {
			console.log(filePath, stats.birthtime, stats.mtime, stats.size);
			await fileRecordDBService.insertFileRecord(filePath, stats.birthtime, stats.mtime, stats.size); // stats.ctime is changed time, created time is birthtime
		} else if (stats.isDirectory() && !stats.isSymbolicLink()) {
			console.log("found directory:", filePath);
			await this.scanDirectoryRecursive(filePath, depth + 1, maxDepth);
		}
	}
}

const scanner = new FolderScanner();
scanner.scanDirectoryRecursive(directoryPath);