import fs from 'fs';
import { fileRecordDBService } from './file-record-db-service';

//joining path of directory 
const directoryPath = "C:/";
const MIN_SIZE_IN_BYTES = 50 * 1024; // at least X kb

class FolderScanner {
	scannedFiles: number = 0;
	scannedFolders: number = 0;

	constructor() {

	}

	scanDirectoryRecursive(directoryPath: string, depth: number = 0, maxDepth: number = 250) {

		if (depth > maxDepth) {
			console.log("reached depth limit...");
			return;
		}

		if (depth <= 2) {
			console.log("scanning directory:", directoryPath);
		}

		fs.readdir(directoryPath, (err, files) => {
			if (!err) {
				this.processFiles(directoryPath, files, depth, maxDepth);
			} else {
				console.log('Unable to scan directory: ' + err, directoryPath);
			}
		});
	}

	processFiles(directoryPath: string, files: string[], depth: number, maxDepth: number) {
		for (let index = 0; index < files.length; index++) {
			const file = files[index];
			this.processFile(directoryPath, file, depth, maxDepth);
		}
	}

	processFile(directoryPath: string, file: string, depth: number, maxDepth: number) {
		const filePath = `${directoryPath}/${file}`;

		if (!this.shouldScanFile(filePath)) {
			this.scannedFiles = this.scannedFiles + 1;
			return;
		}

		fs.stat(filePath, async (err, stats) => {
			if (!err) {
				if (stats.isFile()) {
					this.scannedFiles = this.scannedFiles + 1;
					const hasExtension = filePath.includes(".");
					if (hasExtension && stats.size > MIN_SIZE_IN_BYTES) {
						// console.log(filePath, stats.birthtime, stats.mtime, stats.size);
						await fileRecordDBService.insertFileRecord(filePath, stats.birthtime, stats.mtime, stats.size); // stats.ctime is changed time, created time is birthtime
					}
				} else if (stats.isDirectory() && !stats.isSymbolicLink()) {
					this.scannedFolders = this.scannedFolders + 1;
					this.scanDirectoryRecursive(filePath, depth + 1, maxDepth);
				}
			} else {
				console.log(err);
			}
		});
	}

	shouldScanFile(filePath: string) {
		const hasExtension = filePath.includes(".");

		if (!hasExtension) {
			return true; // it's most likely a directory so continue the check... if directory or not..
		}

		const extension = filePath.split(".").reverse()[0].toLowerCase();
		return ["exe", "zip", "msi", "rar", "tar", "tar.gz", "jar"].includes(extension);
	}
}

const runProgram = async () => {
	await fileRecordDBService.waitForInit();

	console.log(directoryPath);

	const start = Date.now();

	const scanner = new FolderScanner();
	scanner.scanDirectoryRecursive(directoryPath);

	process.on('exit', () => {
		const end = Date.now();
		const timeTook = (end - start);
		console.log(`finished ${directoryPath} in ${timeTook.toFixed(2)}ms`);
		console.log(`scanned: files: ${scanner.scannedFiles} folders: ${scanner.scannedFolders}`);
		console.log("exited");
	});
}


runProgram();