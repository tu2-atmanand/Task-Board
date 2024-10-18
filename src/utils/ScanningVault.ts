// /src/utils/ScanningVaults.ts

import { App, Notice, TFile } from "obsidian";
import { loadTasksJsonFromSS, writeTasksJsonToDisk, writeTasksJsonToSS } from "./tasksCache";
import { scanFilterForFilesNFolders, scanFilterForTags } from "./Checker";

import type TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { priorityEmojis } from "src/interfaces/TaskItemProps";
import { readDataOfVaultFiles } from "./MarkdownFileOperations";

export class ScanningVault {
	app: App;
	plugin: TaskBoard;
	tasks: any = { Pending: {}, Completed: {} };
	TaskDetected: boolean;

	constructor(app: App, plugin: TaskBoard) {
		this.app = app;
		this.plugin = plugin;
		this.TaskDetected = false;
	}

	// Scan all markdown files for tasks
	// Modify scanVaultForTasks to accept a callback function for terminal updates

	async scanVaultForTasks() {
		console.log(
			"Scanning The Whole Vault, either on Startup or using Modal..."
		);
		const files = this.app.vault.getMarkdownFiles();
		this.tasks = { Pending: {}, Completed: {} }; // Reset task structure

		for (const file of files) {
			const scanFilters =
				this.plugin.settings.data.globalSettings.scanFilters;
			// onFileScanned(file.path); // Pass file name to callback for live updates
			if (scanFilterForFilesNFolders(file, scanFilters)) {
				await this.extractTasksFromFile(file, this.tasks, scanFilters);
			}
		}

		console.log(
			"Following tasks has been collected after Vault Scan : ",
			this.tasks
		);

		this.saveTasksToFile();
		// Emit the event
		eventEmitter.emit("REFRESH_BOARD");
	}

	// Extract tasks from a specific file
	async extractTasksFromFile(file: TFile, tasks: any, scanFilters: any) {
		const fileNameWithPath = file.path;
		const fileContent = await readDataOfVaultFiles(
			this.plugin,
			fileNameWithPath
		);
		const lines = fileContent.split("\n");

		tasks.Pending[fileNameWithPath] = [];
		tasks.Completed[fileNameWithPath] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.startsWith("- [ ]") || line.startsWith("- [x]")) {
				const tag = this.extractTag(line);

				if (scanFilterForTags(tag, scanFilters)) {
					this.TaskDetected = true;
					const isCompleted = line.startsWith("- [x]");
					const title = this.extractTitle(line);
					const time = this.extractTime(line);
					const due = this.extractDueDate(line);
					const priority = this.extractPriority(line);
					const completionDate = this.extractCompletionDate(line);
					const body = this.extractBody(lines, i + 1);

					const task = {
						id: this.generateTaskId(),
						title,
						body,
						time,
						due,
						tag,
						priority,
						filePath: fileNameWithPath,
						completed: completionDate,
					};

					console.log(
						"extractTasksFromFile : Scanned the following task, because it allowed in setting : ",
						task
					);
					if (isCompleted) {
						tasks.Completed[fileNameWithPath].push(task);
					} else {
						tasks.Pending[fileNameWithPath].push(task);
					}
				} else {
					console.log("The tasks is not allowed...");
				}
			}
		}
	}

	// Generate a unique ID for each task
	generateTaskId(): number {
		const array = new Uint32Array(1);
		crypto.getRandomValues(array);
		console.log("The random value generated : ", array[0]);
		return array[0];
	}

	// // Helper function to load the existing tasks from the tasks.json file
	// async loadTasksFromFile() {
	// 	if (fs.existsSync(tasksPath)) {
	// 		const data = fs.readFileSync(tasksPath, "utf8");
	// 		return JSON.parse(data);
	// 	}
	// 	return { Pending: {}, Completed: {} }; // Return an empty object if no file exists
	// }

	// Update tasks for an array of files (overwrite existing tasks for each file)
	async updateTasksFromFiles(files: TFile[]) {
		const moment = require("moment");
		console.log("Following files have been received for scanning: ", files);

		// Load the existing tasks from tasks.json once
		const oldTasks = await loadTasksJsonFromSS(this.plugin);
		console.log(
			"Following Old data has been loaded from tasks.json: ",
			oldTasks
		);
		const scanFilters =
			this.plugin.settings.data.globalSettings.scanFilters;

		for (const file of files) {
			const fileNameWithPath = file.path;
			const fileContent = await this.app.vault.read(file);
			const lines = fileContent.split("\n");
			const newPendingTasks: any[] = [];
			const newCompletedTasks: any[] = [];

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line.startsWith("- [ ]") || line.startsWith("- [x]")) {
					const tag = this.extractTag(line);

					if (scanFilterForTags(tag, scanFilters)) {
						this.TaskDetected = true;
						const isCompleted = line.startsWith("- [x]");
						const title = this.extractTitle(line);
						const time = this.extractTime(line);
						const priority = this.extractPriority(line);
						const completionDate = this.extractCompletionDate(line);
						const body = this.extractBody(lines, i + 1);

						let due = this.extractDueDate(line);
						// if (!due) {
						// 	const moment = require("moment");
						// 	console.log(
						// 		"Following thing  has been written by the moment library. Let see what it return if the file name is : ",
						// 		file.basename,
						// 		" | OUTPUT : ",
						// 		moment().format(file.basename)
						// 	);
						// 	if (moment().format(file.basename)) {
						// 		due = moment().format(file.basename);
						// 	}
						// }

						if (
							!due &&
							this.plugin.settings.data.globalSettings
								.dailyNotesPluginComp
						) {
							const dueFormat =
								this.plugin.settings.data.globalSettings
									.dueDateFormat;
							const basename = file.basename;

							console.log(
								"Following thing  has been written by the moment library. Let see what it return if the file name is : ",
								file.basename,
								" | OUTPUT : ",
								moment().format(file.basename)
							);
							// Check if the basename matches the dueFormat using moment
							if (moment(basename, dueFormat, true).isValid()) {
								due = basename; // If the basename matches the dueFormat, assign it to due
							} else {
								due = ""; // If not, assign an empty string
							}
						}

						const task = {
							id: this.generateTaskId(),
							title,
							body,
							time,
							due,
							tag,
							priority,
							filePath: fileNameWithPath,
							completed: completionDate,
						};

						if (isCompleted) {
							newCompletedTasks.push(task);
						} else {
							newPendingTasks.push(task);
						}
					} else {
						console.log("The tasks is not allowed...");
					}
				}
			}

			console.log("Tasks extracted from the file: ", {
				newPendingTasks,
				newCompletedTasks,
			});

			// Only replace the tasks for the specific file
			this.tasks.Pending = {
				...oldTasks.Pending, // Keep the existing tasks for other files
				[fileNameWithPath]: newPendingTasks, // Update only the tasks for the current file
			};

			this.tasks.Completed = {
				...oldTasks.Completed, // Keep the existing tasks for other files
				[fileNameWithPath]: newCompletedTasks, // Update only the tasks for the current file
			};
		}

		// Save the updated tasks back to tasks.json after processing all files
		// console.log(
		// 	"Value of this.plugin.settings.data.globalSettings.realTimeScanning : ",
		// 	this.plugin.settings.data.globalSettings.realTimeScanning
		// );

		// TODO : At this present commit and the prsent state of the codeBase, the feature that when a user writes at a high speed, the task will be getting refreshed in real-Time is happening perfectly. For that you will have to disable the below line. Also just to mention, you will have to do an optimization, since, if the user is typing at a double speed then mine, then the my CPU was running at 40%.
		this.TaskDetected = !this.plugin.settings.data.globalSettings
			.realTimeScanning
			? true
			: false;
		console.log(
			"After Tasks are extracted and when realTimeScanning is OFF, value of this.TaskDetected : ",
			this.TaskDetected
		);
		this.saveTasksToFile();

		// console.log(
		// 	"ScanningVault : Running the function from Main.ts to re-Render..."
		// );
		// refreshKanbanBoard(this.app);
	}

	// Save tasks to JSON file
	async saveTasksToFile() {
		await writeTasksJsonToSS(this.plugin, this.tasks);
		await writeTasksJsonToDisk(this.plugin); // Since this updateTasksFromFiles will be run only after 5 min, so its fine to write the data to disk.

		// Refresh the board only if any task has be extracted from the updated file.
		if (this.TaskDetected) {
			// new Notice("Tasks scanned from the modified files.");
			eventEmitter.emit("REFRESH_COLUMN");
			this.TaskDetected = false;
		}
	}

	// New function to extract task body
	extractBody(lines: string[], startLineIndex: number): string[] {
		const bodyLines = [];
		for (let i = startLineIndex; i < lines.length; i++) {
			const line = lines[i];

			if (line.trim() === "") {
				// Empty line indicates the end of the task body
				// console.log(
				// 	"The current line detected should be empty :",
				// 	line,
				// 	": There shouldnt be any space between the two colons"
				// );
				break;
			}

			if (line.startsWith("\t") || line.startsWith("    ")) { //TODO : YOu cannot simply put hardcoded 4 spaces here for tab, it should be taken from the settings, how many spaces for one tab
				// If the line has one level of indentation, consider it part of the body
				bodyLines.push(line);
			} else {
				// If no indentation is detected, stop reading the body
				break;
			}
		}
		return bodyLines;
	}

	// Extract title from task line
	extractTitle(text: string): string {
		const timeAtStartMatch = text.match(
			/^- \[[x ]\]\s*\d{2}:\d{2} - \d{2}:\d{2}/
		);

		if (timeAtStartMatch) {
			// If time is at the start, extract title after the time and till the pipe symbol
			return text
				.replace(/^- \[[x ]\]\s*\d{2}:\d{2} - \d{2}:\d{2}\s*/, "")
				.split("|")[0]
				.trim();
		} else {
			// Default case: no time at start, extract title till the pipe symbol
			return text.includes("|")
				? text
						.split("|")[0]
						.replace(/^- \[[x ]\]\s*/, "")
						.trim()
				: text.replace(/^- \[[x ]\]\s*/, "").trim();
		}
	}

	// Extract time from task line
	extractTime(text: string): string {
		// Check if time is at the start of the task
		const timeAtStartMatch = text.match(
			/^- \[[x ]\]\s*(\d{2}:\d{2} - \d{2}:\d{2})/
		);

		if (timeAtStartMatch) {
			// If time is at the start, extract it
			return timeAtStartMatch[1];
		}

		// Otherwise, look for time elsewhere in the line
		const timeIntitleMatch = text.match(
			/⏰\s*\[(\d{2}:\d{2} - \d{2}:\d{2})\]/
		);
		return timeIntitleMatch ? timeIntitleMatch[1] : "";
	}

	// Extract date from task title
	extractDueDate(text: string): string {
		let match = text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);

		if (!match) {
			match = text.match(/\[due::\s*(\d{4}-\d{2}-\d{2})\]/);
		}

		if (!match) {
			match = text.match(/\@due\(\s*(\d{4}-\d{2}-\d{2})\)/);
		}

		return match ? match[1] : "";
	}

	// Extract priority from task title using RegEx
	extractPriority(text: string): string {
		// Create a regex pattern to match any priority emoji
		const emojiPattern = new RegExp(
			`\\|?\\s*(${Object.values(priorityEmojis).join("|")})\\s*`,
			"g"
		);

		// Execute the regex to find the emoji in the text
		const match = text.match(emojiPattern);
		
		// If a match is found, map it back to the corresponding priority number
		if (match) {
			const emojiFound = match[0].trim().replace('|', '').trim();
			console.log(
				"Following is the match I found for the Priority :",
				emojiFound
			);

			const priorityMatch = Object.entries(priorityEmojis).find(
				([, emoji]) => emoji === emojiFound
			);

			console.log("The match i found for this emoji from the mapping :", priorityMatch);
			return priorityMatch?.[0] || "0";
		}

		// Default priority if no emoji is found
		return "0";
	}

	// // Extract priority from task title
	// extractPriority(text: string): string {
	// 	const priorityMatch = Object.entries(priorityEmojis).find(
	// 		([key, emoji]) => text.includes(emoji)
	// 	);
	// 	// console.log(
	// 	// 	"This is what has been extracted as emoji : ",
	// 	// 	priorityMatch,
	// 	// 	" Of the task : ",
	// 	// 	text
	// 	// );
	// 	// console.log([...text].map((char) => char.codePointAt(0).toString(16)));
	// 	return priorityMatch?.[0] || "0";
	// }

	// Extract tag from task title
	extractTag(text: string): string {
		const match = text.match(/#(\w+)/);
		return match ? `#${match[1]}` : "";
	}

	// extractCompletionDate(text: string): string {
	// 	// const match =
	// 	// 	text.match(/✅\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/) ||
	// 	// 	text.match(/✅\s*(\d{4}-\d{2}-\d{2}/);
	// 	let match = text.match(/✅\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
	// 	// if (!match) {
	// 	// 	match = text.match(/✅\s*(\d{4}-\d{2}-\d{2}/);
	// 	// }

	// 	return match ? match[1] : "";
	// }

	extractCompletionDate(text: string): string {
		// Match cases like ✅2024-09-26T11:30 or ✅ 2024-09-28
		// let match = text.match(
		// 	/✅\s*([\d\w]+)[\s.\-\/\\](?:[a-zA-Z0-9]+)[\s.\-\/\\](?:[a-zA-Z0-9]+)(\d{2}:\d{2})?/
		// );

		let match = text.match(
			/✅\s*([\d\w]+)[\s.\-\/\\](?:[a-zA-Z0-9]+)[\s.\-\/\\](?:[a-zA-Z0-9]+)([T\s.\-/\\]\d{2}:\d{2})?/
		);

		// If not found, try to match the completion:: 2024-09-28 format
		if (!match) {
			match = text.match(
				/\[completion::\s*([\d\w]+)[\s.\-\/\\](?:[a-zA-Z0-9]+)[\s.\-\/\\](?:[a-zA-Z0-9]+)([T\s.\-/\\]\d{2}:\d{2})?\]/
			);

			if (match) {
				return match
					? match[0]
							.replace("[completion::", "")
							.replace("]", "")
							.trim()
					: "";
			}
		}

		if (!match) {
			match = text.match(
				/\@completion\(\s*([\d\w]+)[\s.\-\/\\](?:[a-zA-Z0-9]+)[\s.\-\/\\](?:[a-zA-Z0-9]+)([T\s.\-/\\]\d{2}:\d{2})?\)/
			);

			if (match) {
				return match
					? match[0]
							.replace("@completion(", "")
							.replace(")", "")
							.trim()
					: "";
			}
		}

		console.log("Following thing detected for completion date : ", match);
		// Return the matched date or date-time, or an empty string if no match
		return match ? match[0].replace("✅", "").trim() : "";
	}
}
