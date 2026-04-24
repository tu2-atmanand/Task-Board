import { App, Modal, normalizePath } from "obsidian";
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import TaskBoard from "../../../main.js";
import { showReloadObsidianNotice } from "../SettingSynchronizer.js";
import { MigrationResult, migrateVersion1_to_Version2, saveMigrationLogsToFile } from "./MigrationUtils.js";

interface LogEntry {
	id: string;
	timestamp: string;
	message: string;
	status: "info" | "success" | "error" | "warning";
	boardName?: string;
}

const MigrationModalContent: React.FC<{
	app: App;
	plugin: TaskBoard;
	onMigrationComplete: (result: MigrationResult) => void;
}> = ({ app, plugin, onMigrationComplete }) => {
	const [isRunning, setIsRunning] = useState(false);
	const [progress, setProgress] = useState(0);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
	const terminalRef = useRef<HTMLDivElement>(null);
	const logIdRef = useRef(0);

	const addLog = (message: string, status: "info" | "success" | "error" | "warning" = "info", boardName?: string) => {
		const timestamp = new Date().toLocaleTimeString();
		const logEntry: LogEntry = {
			id: `log-${logIdRef.current++}`,
			timestamp,
			message,
			status,
			boardName,
		};

		setLogs((prev) => [...prev, logEntry]);

		// Auto-scroll to bottom
		setTimeout(() => {
			if (terminalRef.current) {
				terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
			}
		}, 0);
	};

	const getStatusIcon = (status: string): string => {
		switch (status) {
			case "success":
				return "✓";
			case "error":
				return "✗";
			case "warning":
				return "⚠";
			default:
				return "•";
		}
	};

	const handleStartMigration = async () => {
		setIsRunning(true);
		setLogs([]);
		logIdRef.current = 0;

		addLog("Initializing migration process...", "info");
		await sleep(500);
		addLog("", "info");

		try {
			let currentProgress = 0;

			const result = await migrateVersion1_to_Version2(
				plugin,
				// onStepStart
				(stepNumber, totalSteps, stepName) => {
					currentProgress = ((stepNumber - 1) / totalSteps) * 100;
					setProgress(currentProgress);
					addLog(`[Step ${stepNumber}/${totalSteps}] ${stepName}`, "info");
				},
				// onStepProgress
				(message, boardName, status) => {
					// Parse status from message if not explicitly provided
					let msgStatus: "success" | "error" | "warning" | "info" = "info";
					if (message.startsWith("✓")) {
						msgStatus = "success";
					} else if (message.startsWith("✗")) {
						msgStatus = "error";
					} else if (message.startsWith("⚠")) {
						msgStatus = "warning";
					}

					addLog(message, msgStatus, boardName);
				},
				// onStepComplete
				(stepNumber, totalSteps) => {
					currentProgress = (stepNumber / totalSteps) * 100;
					setProgress(currentProgress);
					addLog("", "info");
				},
			);

			// Add logs to the result
			result.logs = logs.map((log) => ({
				timestamp: log.timestamp,
				status: log.status,
				message: log.message,
				boardName: log.boardName,
			}));

			setMigrationResult(result);
			setProgress(100);

			if (result.success) {
				addLog("✓ Migration completed successfully!", "success");
				await sleep(500);
				await plugin.taskBoardFileManager.scanAllTaskBoardFiles();
				addLog(`Migrated ${result.migratedBoards.filter((b) => b.status === "success").length} boards. You can find them at the following path : Meta/Task_Board/Boards/`, "success");
				await sleep(500);
			} else {
				addLog("⚠ Migration completed with warnings or errors. Kindly report this issue to the developer.", "warning");
			}

			if (result.errors.length > 0) {
				addLog("", "info");
				addLog("Errors encountered:", "error");
				result.errors.forEach((error) => {
					addLog(`  - ${error}`, "error");
				});
			}

			if (result.backupPath) {
				addLog("", "info");
				addLog(`Backup file will be available at the root of the vault: ${result.backupPath}`, "success");
			}

			// Show Notice to reload Obsidian and make the "Reload Obsidian" button visible
			showReloadObsidianNotice(plugin);

			// Save logs to file after migration completes
			const logSaveResult = await saveMigrationLogsToFile(
				plugin.app,
				result.logs || [],
				result.errors
			);
			if (logSaveResult.success && logSaveResult.filePath) {
				result.logFilePath = logSaveResult.filePath;
				addLog("", "info");
				addLog(
					`✓ Migration logs saved to: ${logSaveResult.filePath}`,
					"success",
				);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			addLog(`✗ Unexpected error: ${errorMsg}`, "error");
		} finally {
			setIsRunning(false);
		}
	};

	const handleReloadObsidian = () => {
		app.commands.executeCommandById("app:reload");
	};

	const handleOpenBoardsFolder = async () => {
		try {
			// Try to open the Meta/Task_Board/Boards folder
			const boardsFolder = app.vault.getFolderByPath(normalizePath("Meta/Task_Board/Boards"));
			if (boardsFolder) {
				// Emit event to open the folder in navigator (if available)
				const event = new CustomEvent("file-explorer-focus", {
					detail: { file: boardsFolder },
				});
				app.workspace.containerEl.dispatchEvent(event);
			}
		} catch {
			// Silently fail if folder doesn't exist yet
		}
	};

	const handleClose = () => {
		if (migrationResult) {
			onMigrationComplete(migrationResult);
		}
	};

	const successfulBoards = migrationResult?.migratedBoards.filter((b) => b.status === "success").length || 0;
	const failedBoards = migrationResult?.migratedBoards.filter((b) => b.status === "error").length || 0;

	return (
		<div className="migration-modal-content">
			<p className="migration-description">
				Task Board plugin has undergone some major architectural level changes, so backward compatibility is not possible in all the version in 2.x.x series. Please read the following wiki to understand everything about the migrations and incase if any error occured during the migration, how to revert back to the previous version : <a href="https://tu2-atmanand.github.io/task-board-docs/docs/Migrating_To_2.x.x/">Task Board v2.x.x migration guide.</a>
			</p>

			{/* Progress Section */}
			<div className="migration-progress-section">
				<div className="migration-progress-container">
					<progress
						max="100"
						value={progress}
						style={{
							width: "100%",
							height: "25px",
							borderRadius: "3px",
						}}
					/>
				</div>
				<div className="migration-progress-text">{progress.toFixed(0)}%</div>
			</div>

			{/* Control Button */}
			{!migrationResult ? (
				<div className="migration-button-container">
					<button
						className="migration-run-button"
						onClick={handleStartMigration}
						disabled={isRunning}
					>
						{isRunning ? "Running..." : "Run migrations"}
					</button>
				</div>
			) : null}

			{/* Terminal Output */}
			<div className="migration-terminal-section">
				<div className="migration-terminal-header">Migration Log</div>
				<div className="migration-terminal" ref={terminalRef}>
					{logs.map((log) => (
						<div
							key={log.id}
							className={`migration-log-line migration-log-${log.status}`}
						>
							<span className="migration-log-timestamp">[{log.timestamp}]</span>
							<span className="migration-log-icon">{getStatusIcon(log.status)}</span>
							<span className="migration-log-message">{log.message}</span>
						</div>
					))}
				</div>
			</div>

			{/* Completion Summary */}
			{migrationResult ? (
				<div className="migration-summary-section">
					<h3>Migration Summary</h3>
					<div className="migration-summary-stats">
						<div className="migration-stat">
							<span className="migration-stat-label">Total Boards:</span>
							<span className="migration-stat-value">
								{migrationResult.migratedBoards.length}
							</span>
						</div>
						<div className="migration-stat">
							<span className="migration-stat-label">Successful:</span>
							<span className="migration-stat-value" style={{ color: "#4caf50" }}>
								{successfulBoards}
							</span>
						</div>
						{failedBoards > 0 && (
							<div className="migration-stat">
								<span className="migration-stat-label">Failed:</span>
								<span className="migration-stat-value" style={{ color: "#f44336" }}>
									{failedBoards}
								</span>
							</div>
						)}
					</div>

					{migrationResult.errors.length > 0 && (
						<div className="migration-errors-section">
							<h4>Errors</h4>
							<ul className="migration-error-list">
								{migrationResult.errors.map((error, idx) => (
									<li key={idx} className="migration-error-item">
										{error}
									</li>
								))}
							</ul>
						</div>
					)}

					{migrationResult.success && (
						<div className="migration-actions-section">
							{/* <button className="migration-open-folder-button" onClick={handleOpenBoardsFolder}>
								Open Boards Folder
							</button> */}
							<button className="migration-reload-button" onClick={handleReloadObsidian}>
								Reload Obsidian
							</button>
						</div>
					)}
				</div>
			) : null}
		</div>
	);
};

export class MigrationModal extends Modal {
	plugin: TaskBoard;
	onMigrationComplete?: (result: MigrationResult) => void;

	constructor(plugin: TaskBoard, onMigrationComplete?: (result: MigrationResult) => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.onMigrationComplete = onMigrationComplete;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.setAttribute("modal-type", "task-board-migration-modal");

		this.setTitle("Task Board v2.x.x migrations");

		const root = createRoot(contentEl);
		root.render(
			<MigrationModalContent
				app={this.app}
				plugin={this.plugin}
				onMigrationComplete={(result) => {
					if (this.onMigrationComplete) {
						this.onMigrationComplete(result);
					}
				}}
			/>,
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
