// /src/utils/RealTimeScanning.ts

import { App, TFile } from "obsidian";

import { ScanningVault } from "src/utils/ScanningVault";
import TaskBoard from "main";
import fs from "fs";
import path from "path";

export class RealTimeScanning {
	app: App;
	plugin: TaskBoard;
	fileStack: string[] = [];
	stackFilePath: string;
	scanTimer: number;
	scanningVault: ScanningVault;

	constructor(app: App, plugin: TaskBoard) {
		this.app = app;
		this.plugin = plugin;
		this.stackFilePath = path.join(
			(window as any).app.vault.adapter.basePath,
			".obsidian",
			"plugins",
			"Task-Board",
			"file-stack.json"
		);
		this.scanTimer = 0;
		this.scanningVault = new ScanningVault(app, plugin);
	}

	async initializeStack(realTimeScanning: boolean) {
		if (realTimeScanning) return;
		try {
			console.log(
				"The data inside the localstorage at startup : ",
				localStorage.getItem("fileStack")
			);
			const storedStack = localStorage.getItem("fileStack");
			if (storedStack) {
				this.fileStack = JSON.parse(storedStack);
				console.log(
					"I think the local storage have been created, value of fileStack : ",
					this.fileStack
				);
			} else if (fs.existsSync(this.stackFilePath)) {
				// Fallback to loading from file if localStorage isn't available
				const data = fs.readFileSync(this.stackFilePath, "utf8");
				this.fileStack = JSON.parse(data) || [];
				console.log(
					"The data i stored inside the file-stack.json, which i have put inside the localStorage : ",
					this.fileStack
				);
			}
			this.startScanTimer();
		} catch (error) {
			console.error("Error loading file stack:", error);
		}
	}

	async saveStack() {
		try {
			localStorage.setItem("fileStack", JSON.stringify(this.fileStack));

			console.log(
				"saveStack() : The data inside localStorage after setItem : ",
				localStorage.getItem("fileStack")
			);
			console.log("After updating the data is : ", this.fileStack);

			// Save to file as fallback
			fs.writeFileSync(
				this.stackFilePath,
				JSON.stringify(this.fileStack, null, 2)
			);
		} catch (error) {
			console.error("Error saving file stack:", error);
		}
	}

	async startScanTimer() {
		// 	console.log(
		// 		"Creating LocalStorage, starting 10 min timer which will run forever : ",
		// 		this.fileStack
		// 	);

		this.scanTimer = window.setInterval(() => {
			this.processStack();
		}, 2 * 60 * 1000); // Set to 10 minutes
	}

	async processStack() {
		console.log(
			"TIME UP : 1 minute has passed, scanning the following files: ",
			this.fileStack
		);
		const filesToProcess = this.fileStack.slice();
		this.fileStack = [];
		const files = filesToProcess
			.map((filePath) => this.getFileFromPath(filePath))
			.filter((file) => !!file);

		if (files.length > 0) {
			// Send all files for scanning and updating tasks
			await this.scanningVault.updateTasksFromFiles(files);
		}
		// Save updated stack (which should now be empty)
		await this.saveStack();
	}

	getFileFromPath(filePath: string): TFile {
		return (window as any).app.vault.getAbstractFileByPath(
			filePath
		) as TFile;
	}

	async onFileChange(file: TFile, realTimeScanning: boolean) {
		if (file.extension === "md") {
			console.log(`File modified: ${file.path}`);
			// console.log("The value of realTimeScanning : ", this.settings.data.globalSettings.realTimeScanning);
			// console.log(
			// 	"The data inside LocalStorage Before adding the new modified file : ",
			// 	this.fileStack
			// );

			// If real-time scanning is enabled, scan the file immediately
			if (realTimeScanning) {
				console.log(
					"Reat-Time Scanning is ON. Scanning following file : ",
					file
				);
				this.scanningVault.updateTasksFromFiles([file]);
			} else {
				// console.log(
				// 	"So the tasks will be updated after 10 seconds. This will only run in the following is true : !this.fileStack.includes(file.path) : ",
				// 	!this.fileStack.includes(file.path)
				// );
				// If the file is already in the stack, ignore it
				console.log(
					"The value of localStorage before adding updated file : ",
					this.fileStack
				);

				if (this.fileStack.at(0) === undefined) {
					this.fileStack.push(file.path); // Add the file to the stack
				} else if (!this.fileStack.includes(file.path)) {
					this.fileStack.push(file.path);
					await this.saveStack(); // Save the updated stack
				} else {
					console.log(
						"The file alrady exists in fileStack : ",
						file.path
					);
				}
			}
		}
	}

	clearScanTimer() {
		window.clearInterval(this.scanTimer);
	}
}
