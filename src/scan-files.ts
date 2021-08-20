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

	scanDirectoryRecursive(directoryPath: string, quick: boolean, depth: number = 0, maxDepth: number = 250) {

		if (depth > maxDepth) {
			console.log("reached depth limit...");
			return;
		}

		if (depth <= 2) {
			console.log("scanning directory:", directoryPath);
		}

		fs.readdir(directoryPath, (err, files) => {
			if (!err) {
				this.processFiles(directoryPath, files, quick, depth, maxDepth);
			} else {
				console.log('Unable to scan directory: ' + err, directoryPath);
			}
		});
	}

	processFiles(directoryPath: string, files: string[], quick: boolean, depth: number, maxDepth: number) {
		for (let index = 0; index < files.length; index++) {
			const file = files[index];
			quick ? this.processFileQuick(directoryPath, file, depth, maxDepth) : this.processFileFull(directoryPath, file, depth, maxDepth);
		}
	}

	// quick scan because it will treat all paths with extensions as files and filter non allowed extensions
	// this will however miss directories like Intellij 2021.3.4
	processFileQuick(directoryPath: string, file: string, depth: number, maxDepth: number) {
		const filePath = `${directoryPath}/${file}`;

		if (!this.shouldScanFileQuick(filePath)) {
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
					this.scanDirectoryRecursive(filePath, true, depth + 1, maxDepth);
				}
			} else {
				console.log(err);
			}
		});
	}

	// full scan because it will check if a path is a file or directory even when it doesn't have an extension
	processFileFull(directoryPath: string, file: string, depth: number, maxDepth: number) {
		const filePath = `${directoryPath}/${file}`;

		fs.stat(filePath, async (err, stats) => {
			if (!err) {
				if (stats.isFile()) {
					this.scannedFiles = this.scannedFiles + 1;
					if (this.fileHasAllowedExtension(filePath) && stats.size > MIN_SIZE_IN_BYTES) {
						// console.log(filePath, stats.birthtime, stats.mtime, stats.size);
						await fileRecordDBService.insertFileRecord(filePath, stats.birthtime, stats.mtime, stats.size); // stats.ctime is changed time, created time is birthtime
					}
				} else if (stats.isDirectory() && !stats.isSymbolicLink()) {
					this.scannedFolders = this.scannedFolders + 1;
					this.scanDirectoryRecursive(filePath, false, depth + 1, maxDepth);
				}
			} else {
				console.log(err);
			}
		});
	}

	shouldScanFileQuick(filePath: string) {
		const hasExtension = filePath.includes(".");

		if (!hasExtension) {
			return true; // it's most likely a directory so continue the check... if directory or not..
		}

		return this.fileHasAllowedExtension(filePath);
	}

	fileHasAllowedExtension(filePath: string) {
		const extension = filePath.split(".").reverse()[0].toLowerCase();
		return ["exe", "zip", "msi", "rar", "tar", "tar.gz", "jar"].includes(extension);
	}
}

const runProgram = async () => {
	await fileRecordDBService.waitForInit();

	console.log(directoryPath);

	const start = Date.now();

	const scanner = new FolderScanner();
	
	// TODO: alternate between quick scans and full scans
	scanner.scanDirectoryRecursive(directoryPath, true);
	// scanner.scanDirectoryRecursive(directoryPath, false);

	process.on('exit', () => {
		const end = Date.now();
		const timeTook = (end - start);
		console.log(`finished ${directoryPath} in ${timeTook.toFixed(2)}ms`);
		console.log(`scanned: files: ${scanner.scannedFiles} folders: ${scanner.scannedFolders}`);
		console.log("exited");
	});
}


runProgram();