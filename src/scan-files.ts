import fs from 'fs';
import { fileRecordDBService } from './file-record-db-service';

//joining path of directory 
const directoryPath = "C:/Users/Nadav/Downloads";
console.log(directoryPath);

class FolderScanner {
	constructor() {

	}

	async scanDirectoryRecursive(directoryPath: string) {
		fs.readdir(directoryPath, async (err, files) => {
			//handling error
			if (err) {
				console.log('Unable to scan directory: ' + err, directoryPath);
				return
			}

			// iterate all files
			await this.processFiles(directoryPath, files);
		});
	}

	async processFiles(directoryPath: string, files: string[]) {
		for (let index = 0; index < files.length; index++) {
			const file = files[index];
			await this.processFile(directoryPath, file);
		}
	}

	async processFile(directoryPath: string, file: string) {
		const filePath = `${directoryPath}/${file}`;
		const stats = fs.statSync(filePath);

		if (stats.isFile()) {
			console.log(filePath, stats.ctime, stats.mtime, stats.size);
			await fileRecordDBService.insertFileRecord(filePath, stats.ctime, stats.mtime, stats.size);
		} else if (stats.isDirectory()) {
			console.log("found directory:", filePath);
			await this.scanDirectoryRecursive(filePath);
		}
	}
}

const scanner = new FolderScanner();
scanner.scanDirectoryRecursive(directoryPath);