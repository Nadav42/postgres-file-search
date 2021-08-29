import fs from 'fs';
import { fileRecordDBService, sleep } from './file-record-db-service';
import { elasticSearchDBService } from './elastic-search-db-service';

//joining path of directory 
const directoryPath = "C:/";
const MIN_SIZE_IN_BYTES = 50 * 1024; // at least X kb
const ALLOWED_EXTENSIONS = ["exe", "zip", "msi", "rar", "tar", "tar.gz", "jar"];

class FolderScanner {
	scannedFiles: number = 0;
	scannedFolders: number = 0;
	pathsProcessing: Map<string, boolean> = new Map<string, boolean>();
	onStartCB: () => void;
	onFinishCB: () => void;

	constructor(onStartCB: () => void, onFinishCB: () => void) {
		this.onStartCB = onStartCB;
		this.onFinishCB = onFinishCB;
	}

	scanDirectory(directoryPath: string, quick: boolean) {
		this.onStart();
		this.scanDirectoryRecursive(directoryPath, quick);
	}

	private scanDirectoryRecursive(directoryPath: string, quick: boolean, depth: number = 0, maxDepth: number = 250) {
		this.markProcessingPath(directoryPath);

		if (depth > maxDepth) {
			console.log("reached depth limit...");
			this.unmarkProcessingPath(directoryPath);
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
			this.unmarkProcessingPath(directoryPath);
		});
	}

	processFiles(directoryPath: string, files: string[], quick: boolean, depth: number, maxDepth: number) {
		for (let index = 0; index < files.length; index++) {
			const file = files[index];
			const filePath = `${directoryPath}/${file}`;
			this.markProcessingPath(filePath);
			quick ? this.processFileQuick(filePath, depth, maxDepth) : this.processFile(filePath, false, depth, maxDepth);
		}
	}

	// quick scan because it will treat all paths with extensions as files and filter non allowed extensions
	// this will however miss directories like Intellij 2021.3.4
	processFileQuick(filePath: string, depth: number, maxDepth: number) {
		if (!this.shouldScanFileQuick(filePath)) {
			this.scannedFiles = this.scannedFiles + 1;
			this.unmarkProcessingPath(filePath);
			return;
		}

		this.processFile(filePath, true, depth, maxDepth);
	}

	// full scan because it will check if a path is a file or directory even when it doesn't have an extension
	processFile(filePath: string, quick: boolean, depth: number, maxDepth: number) {
		fs.stat(filePath, async (err, stats) => {
			if (!err) {
				if (stats.isFile()) {
					this.scannedFiles = this.scannedFiles + 1;
					if (this.fileHasAllowedExtension(filePath) && stats.size > MIN_SIZE_IN_BYTES) {
						// console.log(filePath, stats.birthtime, stats.mtime, stats.size);
						await fileRecordDBService.insertFileRecord(filePath, stats.birthtime, stats.mtime, stats.size); // stats.ctime is changed time, created time is birthtime
						await elasticSearchDBService.insertRecord(filePath, stats.birthtime, stats.mtime, stats.size);
					}
					this.unmarkProcessingPath(filePath); // only unmark if it's a file, if it's a directory then the scanDirectory func will unmark it
				} else if (stats.isDirectory() && !stats.isSymbolicLink()) {
					this.scannedFolders = this.scannedFolders + 1;
					this.scanDirectoryRecursive(filePath, quick, depth + 1, maxDepth);
				}
			} else {
				console.log(err);
				this.unmarkProcessingPath(filePath);
			}
		});
	}

	shouldScanFileQuick(filePath: string) {
		const hasExtension = filePath.includes(".");

		if (!hasExtension) {
			return true; // it's most likely a directory so continue the check... if directory or not..
		}

		return this.fileHasQuickScanExtension(filePath);
	}

	// should save to db or not
	fileHasAllowedExtension(filePath: string) {
		const extension = filePath.split(".").reverse()[0].toLowerCase();
		return ALLOWED_EXTENSIONS.includes(extension);
	}

	// should check if directory in quickscan
	fileHasQuickScanExtension(filePath: string) {
		const extension = filePath.split(".").reverse()[0].toLowerCase();
		const isNumeric = extension.length <= 4 && /^\d+$/.test(extension); // to not miss intellij folders like intellij.2021.3.1
		return isNumeric || ALLOWED_EXTENSIONS.includes(extension);
	}

	markProcessingPath(filePath: string) {
		this.pathsProcessing.set(filePath, true);
		// console.log("[markProcessingPath] this.pathsProcessing:", this.pathsProcessing.size);
	}

	unmarkProcessingPath(filePath: string) {
		this.pathsProcessing.delete(filePath);
		// console.log("[unmarkProcessingPath] this.pathsProcessing:", this.pathsProcessing.size);

		if (this.pathsProcessing.size <= 0) {
			this.onFinish();
		}
	}

	async onStart() {
		this.onStartCB && await this.onStartCB();
	}

	async onFinish() {
		this.onFinishCB && await this.onFinishCB();
		fileRecordDBService.close();
	}
}

const runProgram = async () => {
	await fileRecordDBService.waitForInit();

	console.log(directoryPath);

	let start: number = 0;

	const onStart = async () => {
		start = Date.now();
	}

	const onFinish = async () => {
		const end = Date.now();
		const timeTook = (end - start);
		console.log(`finished ${directoryPath} in ${timeTook.toFixed(2)}ms`);
		console.log(`scanned: files: ${scanner.scannedFiles} folders: ${scanner.scannedFolders}`);
		console.log("exited");

		// do whatever you want here, can save to DB how much time the scan took etc..

		await sleep(1000);
		console.log("fake mock save scan time to db...");
	}

	const scanner = new FolderScanner(onStart, onFinish);

	// TODO: alternate between quick scans and full scans?
	scanner.scanDirectory(directoryPath, true);
	// scanner.scanDirectory(directoryPath, false);
}


runProgram();