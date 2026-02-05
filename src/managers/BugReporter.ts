import { t } from "i18next";
import TaskBoard from "main";
import { Notice, } from "obsidian";
import { BugReporterModal } from "src/modals/BugReporterModal";
import { fsPromises } from "src/services/FileSystem";
import { getObsidianDebugInfo } from "src/services/ObsidianDebugInfo";
import { getCurrentLocalTimeString } from "src/utils/DateTimeCalculations";

/**
 * Interface for bug report entries
 */
interface BugReportEntry {
	timestamp: string;
	id: number;
	message: string;
	context: string;
	bugContent: string;
}

/**
 * BugReporterManager - A singleton manager class that handles following functionalities :
 * - Showing a Obsidian notice with the encountered bug.
 * - Ensuring only one notice is shown for each bug.
 * - Appending the new bug log in the task-board-logs.md file.
 * - Maintaining a log file with system info and last 5 bug reports.
 */
class BugReporterManager {
	private static instance: BugReporterManager;
	private plugin: TaskBoard | null = null;
	private alreadyShownBugsIDs: number[] = [];
	private LOG_FILE_PATH = "";
	private readonly MAX_RECENT_LOGS = 20;
	private readonly MAX_USED_ID = 179; // This constant will not be used anywhere, its simply to keep track of the the recent ID used.

	private constructor() {
		// Private constructor to enforce singleton pattern
	}

	// --------------------------------------
	// Basic GET/SET functions
	// --------------------------------------

	/**
	 * Gets the singleton instance of BugReporterManager
	 * @returns {BugReporterManager} The singleton instance
	 */
	static getInstance(): BugReporterManager {
		if (!BugReporterManager.instance) {
			BugReporterManager.instance = new BugReporterManager();
		}
		return BugReporterManager.instance;
	}

	/**
	 * Set the plugin instance for use in bug reporting operations
	 * Should be called once during plugin initialization
	 */
	setPlugin(plugin: TaskBoard): void {
		this.plugin = plugin;
		this.LOG_FILE_PATH = `${plugin.app.vault.configDir}/plugins/task-board/task-board-logs.log`;
	}

	/**
	 * Ensure the log file exists with proper structure
	 */
	private async ensureLogFileExists(): Promise<void> {
		try {
			const vault = this.plugin?.app.vault;
			if (!vault) return;

			let existingContent = "";
			try {
				existingContent = await vault.adapter.read(this.LOG_FILE_PATH);
			} catch (e) {
				if (!existingContent) {
					// Create new log file with system info
					const systemInfo = await getObsidianDebugInfo(
						this.plugin!.app,
					);
					const systemInfoText = this.formatSystemInfo(systemInfo);
					const initialContent = `# Task Board Logs\n\n## System Information\n\n${systemInfoText}\n\n## Recent Bug Reports\n\n`;
					await vault.adapter.write(
						this.LOG_FILE_PATH,
						initialContent,
					);
				}
			}
		} catch (error) {
			console.error("Error ensuring log file exists:", error);
		}
	}

	/**
	 * Format system information for the log file
	 */
	private formatSystemInfo(systemInfo: Record<string, any>): string {
		return Object.entries(systemInfo)
			.map(([key, value]) => {
				if (Array.isArray(value)) {
					return `- **${key}**: \n${value
						.map((v) => `  - ${v}`)
						.join("\n")}`;
				}
				return `- **${key}**: ${value}`;
			})
			.join("\n");
	}

	/**
	 * Parse the log file and extract recent bug reports
	 */
	private async parseBugReportEntries(): Promise<BugReportEntry[]> {
		try {
			const vault = this.plugin?.app.vault;
			if (!vault) return [];

			const content = await vault.adapter.read(this.LOG_FILE_PATH);

			// Find the "Recent Bug Reports" section
			const recentBugsSectionStart = content.indexOf(
				"## Recent Bug Reports",
			);
			if (recentBugsSectionStart === -1) return [];

			// Extract content after "## Recent Bug Reports"
			const contentAfterHeader = content.substring(
				recentBugsSectionStart + "## Recent Bug Reports".length,
			);

			// Split by the separator line
			const bugReportSections =
				contentAfterHeader.split(/\n\s*-{5,}\s*\n/);

			const bugEntries: BugReportEntry[] = [];

			for (const section of bugReportSections) {
				if (!section.trim()) continue;

				const parsed = this.parseBugReportEntry(section);
				if (parsed) {
					bugEntries.push(parsed);
				}
			}

			return bugEntries;
		} catch (error) {
			console.error("Error parsing log file:", error);
			return [];
		}
	}

	/**
	 * Parse individual bug report entry from markdown
	 */
	private parseBugReportEntry(entryText: string): BugReportEntry | null {
		try {
			const entry: Partial<BugReportEntry> = {};

			// Extract each field with more flexible matching
			const timestampMatch = entryText.match(
				/Timestamp\s*:\s*(.+?)(?=\n|$)/,
			);
			if (timestampMatch) {
				entry.timestamp = timestampMatch[1].trim();
			}

			const idMatch = entryText.match(/ID\s*:\s*(\d+)/);
			if (idMatch) {
				entry.id = parseInt(idMatch[1]);
			}

			const messageMatch = entryText.match(
				/Message\s*:\s*(.+?)(?=\nContext|$)/,
			);
			if (messageMatch) {
				entry.message = messageMatch[1].trim();
			}

			const contextMatch = entryText.match(
				/Context\s*:\s*([\s\S]*?)(?=\n#### Bug Content|\n\n|$)/,
			);
			if (contextMatch) {
				entry.context = contextMatch[1].trim();
			}

			// Extract bug content from code block
			const bugContentMatch = entryText.match(/```log\n([\s\S]*?)\n```/);
			if (bugContentMatch) {
				entry.bugContent = bugContentMatch[1].trim();
			}

			// Validate that all required fields are present
			if (
				entry.timestamp &&
				entry.id !== undefined &&
				entry.message &&
				entry.context &&
				entry.bugContent
			) {
				return entry as BugReportEntry;
			}

			return null;
		} catch (error) {
			console.error("Error parsing bug report entry:", error);
			return null;
		}
	}

	/**
	 * Format a bug report entry for the log file
	 */
	private formatBugReportEntry(entry: BugReportEntry): string {
		return `Timestamp : ${entry.timestamp}
ID : ${entry.id}
Message : ${entry.message}
Context : ${entry.context}

#### Bug Content
\`\`\`log
${entry.bugContent}
\`\`\``;
	}

	/**
	 * Append a new bug report to the log file
	 */
	private async appendBugReport(
		id: number,
		message: string,
		bugContent: string,
		context: string,
	): Promise<void> {
		try {
			const vault = this.plugin?.app.vault;
			if (!vault) return;

			await this.ensureLogFileExists();

			// Parse existing bug reports
			let bugReports = await this.parseBugReportEntries();

			// Create new bug report entry
			const newEntry: BugReportEntry = {
				timestamp: getCurrentLocalTimeString(),
				id,
				message,
				context,
				bugContent,
			};

			// Add new entry at the end (appended below older entries)
			bugReports.push(newEntry);

			// Keep only the most recent MAX_RECENT_LOGS reports
			bugReports = bugReports.slice(-this.MAX_RECENT_LOGS);

			// Format recent bug reports section
			const recentBugsText = bugReports
				.map((entry) => this.formatBugReportEntry(entry))
				.join("\n\n-------------\n\n");

			// Read current file to extract system info
			const currentContent = await vault.adapter.read(this.LOG_FILE_PATH);
			const systemInfoMatch = currentContent.match(
				/(## System Information\n\n[\s\S]*?)(?=## Recent Bug Reports)/,
			);
			const systemInfoSection = systemInfoMatch
				? systemInfoMatch[1].trim()
				: "## System Information\n\n";

			// Rebuild the file content
			const newContent = `# Task Board Logs\n\n${systemInfoSection}\n\n## Recent Bug Reports\n\n${recentBugsText}\n`;

			await vault.adapter.write(this.LOG_FILE_PATH, newContent);
		} catch (error) {
			console.error("Error appending bug report to log file:", error);
		}
	}

	/**
	 * Show a notice for a bug and log it if it hasn't been shown before
	 */
	showNotice = (
		id: number,
		message: string,
		bugContent: string,
		context: string,
	) => {
		// STEP 1 - Check if this type of bug, based on the id, is already visible to the user or not
		if (this.alreadyShownBugsIDs.includes(id)) {
			// Bug already shown, don't show again
			return;
		}

		// Store the ID to prevent showing the same error again
		this.alreadyShownBugsIDs.push(id);

		// STEP 2 - Show the notice to the user
		const bugReportNotice = new Notice(
			createFragment((f) => {
				f.createDiv("bugReportNotice", (el) => {
					el.createEl("p", {
						text: t("bug-report-notice-message"),
					});
					el.createEl("button", {
						text: t("show-error"),
						cls: "reportBugButton",
						onclick: () => {
							const bugReportModal = new BugReporterModal(
								this.plugin!,
								message,
								bugContent,
								context,
							);
							bugReportModal.open();
							el.hide();
						},
					});
					el.createEl("button", {
						text: t("ignore-this-bug"),
						cls: "ignoreBugButton",
						onclick: () => {
							el.hide();
						},
					});
				});
			}),
			0,
		);

		bugReportNotice.messageEl.onClickEvent((e) => {
			if (!(e.target instanceof HTMLButtonElement)) {
				e.stopPropagation();
				e.preventDefault();
				e.stopImmediatePropagation();
			}
		});

		// STEP 3 - Append the bug report to the task-board-logs.md file
		this.appendBugReport(id, message, bugContent, context);
	};

	/**
	 * Appends a new bug report at the end of the log file.
	 */
	addToLogs = (
		id: number,
		bugContent: string,
		context: string,
	) => {
		// STEP 1 - Check if this type of bug, based on the id, is already visible to the user or not
		if (this.alreadyShownBugsIDs.includes(id)) {
			// Bug already shown, don't show again
			return;
		}

		// STEP 2 - Store the ID to prevent showing the same error again
		this.alreadyShownBugsIDs.push(id);

		// STEP 3 - Append the bug report to the task-board-logs.md file
		this.appendBugReport(id, "", bugContent, context);
	};

	async exportLogFile(): Promise<void> {
		try {
			const vault = this.plugin?.app.vault;
			if (!vault) return;

			await this.ensureLogFileExists();

			const data = await vault.adapter.read(this.LOG_FILE_PATH);
			const exportFileName = "task-board-logs.txt";
			// const fileContent = JSON.stringify(data, null, 2);

			// Desktop folder picker
			if (
				(window as any).electron &&
				(window as any).electron.remote &&
				(window as any).electron.remote.dialog
			) {
				let folderPaths: string[] = (
					window as any
				).electron.remote.dialog.showOpenDialogSync({
					title: "Pick folder to export settings",
					properties: ["openDirectory", "dontAddToRecent"],
				});
				if (!folderPaths || folderPaths.length === 0) {
					new Notice("Export cancelled or folder not selected.");
					return;
				}
				const folderPath = folderPaths[0];
				const exportPath =
					folderPath.endsWith("/") || folderPath.endsWith("\\")
						? folderPath + exportFileName
						: folderPath +
							(folderPath.includes("/") ? "/" : "\\") +
							exportFileName;
				await fsPromises.writeFile(exportPath, data, "utf8");
				new Notice(`Log file exported to ${exportPath}`);
			} else {
				// Web: use file save dialog
				let a = document.createElement("a");
				a.href = URL.createObjectURL(
					new Blob([data], { type: "application/json" }),
				);
				a.download = exportFileName;
				document.body.appendChild(a);
				a.click();
				setTimeout(() => {
					document.body.removeChild(a);
					URL.revokeObjectURL(a.href);
				}, 1000);
				new Notice(
					"Log file exported. Check the folder where you downloaded the file.",
				);
			}
		} catch (err) {
			new Notice("Failed to export logs.");
			console.error(err);
		}
	}
}

// Export the singleton instance for easy access
export const bugReporterManagerInsatance = BugReporterManager.getInstance();
