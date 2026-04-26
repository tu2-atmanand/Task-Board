// /src/components/ScanVaultModal.tsx

import { t } from "i18next";
import { App, Component, Modal, Notice } from "obsidian";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";

import TaskBoard from "../../main.js";
import { MANDATORY_SCAN_KEY, VIEW_TYPE_TASKBOARD, newReleaseVersion } from "../interfaces/Constants.js";
import { jsonCacheData, taskItem } from "../interfaces/TaskItem.js";
import VaultScanner, { fileTypeAllowedForScanning } from "../managers/VaultScanner.js";
import { eventEmitter } from "../services/EventEmitter.js";
import { MarkdownUIRenderer } from "../services/MarkdownUIRenderer.js";
import { scanFilterForFilesNFoldersNFrontmatter } from "../utils/algorithms/ScanningFilterer.js";
import { getCurrentLocalDateTimeString } from "../utils/DateTimeCalculations.js";
import { getFormattedTaskContent } from "../utils/taskLine/TaskContentFormatter.js";

export const findMaxIdCounterAndUpdateSettings = (plugin: TaskBoard) => {
	let maxId = 0;

	// Check Pending tasks
	Object.values(plugin.vaultScanner.tasksCache.Pending).forEach((tasks) => {
		tasks.forEach((task) => {
			const taskIdNum = task.legacyId ? parseInt(task.legacyId as unknown as string, 10) : 0;
			if (!isNaN(taskIdNum) && taskIdNum > maxId) {
				maxId = taskIdNum;
			}
		});
	});

	// Check Completed tasks
	Object.values(plugin.vaultScanner.tasksCache.Completed).forEach((tasks) => {
		tasks.forEach((task) => {
			const taskIdNum = task.legacyId ? parseInt(task.legacyId as unknown as string, 10) : 0;
			if (!isNaN(taskIdNum) && taskIdNum > maxId) {
				maxId = taskIdNum;
			}
		});
	});

	// Update the uniqueIdCounter in settings to be one more than the max found ID
	plugin.settings.data.uniqueIdCounter = maxId + 1;
	plugin.saveSettings();
}

const ScanVaultModalContent: React.FC<{ app: App, plugin: TaskBoard, vaultScanner: VaultScanner }> = ({ app, plugin, vaultScanner }) => {

	const [isRunning, setIsRunning] = useState(false);
	const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
	const [progress, setProgress] = useState(0);
	const [scannedFilesCount, setScannedFilesCount] = useState<number>();
	const [showCollectedTasks, setShowCollectedTasks] = useState(false);
	const [collectedTasks, setCollectedTasks] = useState<jsonCacheData>({
		VaultName: app.vault.getName(),
		Modified_at: getCurrentLocalDateTimeString(),
		Pending: {},
		Completed: {},
	});

	const runScan = async () => {
		setIsRunning(true);
		let totalScannedFilesCount = 0;

		// Reset terminal output and collected tasks
		vaultScanner.tasksCache.Pending = {};
		vaultScanner.tasksCache.Completed = {};
		vaultScanner.tasksCache.VaultName = app.vault.getName();
		vaultScanner.tasksCache.Modified_at = getCurrentLocalDateTimeString();

		const files = app.vault.getFiles();
		setProgress(0); // Reset progress
		const globalSettings = plugin.settings.data;
		const scanFilters = globalSettings.scanFilters;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			if (fileTypeAllowedForScanning(globalSettings, file)) {
				if (scanFilterForFilesNFoldersNFrontmatter(plugin, file, scanFilters)) {
					setTerminalOutput((prev) => [...prev, `Scanning file: ${file.path}`]);
					await vaultScanner.extractTasksFromFile(file, scanFilters);
					totalScannedFilesCount++;
				}
			}

			setProgress(((i + 1) / files.length) * 100); // Update progress
		}

		// setIsRunning(false);
		setCollectedTasks(vaultScanner.tasksCache);
		setScannedFilesCount(totalScannedFilesCount);
		new Notice(t("vault-scanning-complete"));

		plugin.vaultScanner.tasksCache = vaultScanner.tasksCache;
		await vaultScanner.saveTasksToJsonCache();

		findMaxIdCounterAndUpdateSettings(plugin);

		// If mandatory scan, close all existing Task Board views to force re-opening with the newly scanned data. Else, just emit REFRESH_BOARD event to update the existing board(s) with the newly scanned data.
		if (localStorage.getItem(MANDATORY_SCAN_KEY) === "true") {
			localStorage.setItem(MANDATORY_SCAN_KEY, "false");
			plugin.app.workspace.getLeavesOfType(VIEW_TYPE_TASKBOARD).forEach((leaf) => {
				leaf.detach();
			});
		} else {
			// Emit REFRESH_BOARD event to update the board with newly scanned tasks
			eventEmitter.emit("REFRESH_BOARD");
		}
	};

	const toggleView = () => {
		setShowCollectedTasks(!showCollectedTasks);
	};

	const componentRef = useRef<Component | null>(null);
	useEffect(() => {
		// Initialize Obsidian Component on mount
		componentRef.current = plugin.view;
	}, []);

	const taskRendererRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
	useEffect(() => {
		// Render tasks in collectedTasks when the view is toggled to show
		if (showCollectedTasks) {
			Object.keys(collectedTasks.Pending).forEach(filePath => {
				const tasks = collectedTasks.Pending[filePath];
				tasks.forEach((task, taskIndex) => {
					const newTaskContent: taskItem = {
						...task,
						title: task.title,
						body: task.body,
						due: task.due,
						tags: task.tags,
						time: task.time,
						priority: task.priority,
					};

					getFormattedTaskContent(newTaskContent).then((formatedContent) => {

						const uniqueKey = `${filePath}-task-${taskIndex}`;
						const descElement = taskRendererRef.current[uniqueKey];

						if (descElement && formatedContent !== "") {
							descElement.empty();
							// Render task description using MarkdownUIRenderer
							MarkdownUIRenderer.renderTaskDisc(
								app,
								formatedContent,
								descElement,
								task.filePath,
								componentRef.current
							);
						}
					});
				});
			});
		}
	}, [showCollectedTasks, collectedTasks]);

	return (
		<div className="scanVaultModalHome">
			<h2>{t("vault-scanner")}</h2>
			{localStorage.getItem(MANDATORY_SCAN_KEY) === "true" ?
				(<>
					<div className="scanVaultModalHomeMandatoryScan">{t("scan-vault-from-the-vault-upgrade-message-1")} {newReleaseVersion}</div>
					<div className="scanVaultModalHomeMandatoryScan">{t("scan-vault-from-the-vault-upgrade-message-2")}</div>
					<br />
					<div className="scanVaultModalHomeMandatoryScan">{t("scan-vault-from-the-vault-upgrade-message-3")} : <a href={`https://github.com/tu2-atmanand/Task-Board/releases/tag/${newReleaseVersion}`}>Task Board v{newReleaseVersion}</a>.</div>
				</>
				) :
				(<>
					<div className="setting-item-description">{t("scan-tasks-from-the-vault-info-1")}</div>
					<div className="setting-item-description">{t("scan-tasks-from-the-vault-info-2")}</div>
				</>
				)}

			<div className="scanVaultModalHomeSecondSection" >
				<div className="scanVaultModalHomeSecondSectionProgressBarContainer">
					<progress max="100" value={progress} style={{ width: "100%", height: '35px' }}></progress>
				</div>
				<button className="scanVaultModalHomeSecondSectionButton" onClick={runScan} disabled={isRunning}>
					{isRunning ? progress.toFixed(0) : t("run")}
				</button>
			</div>

			{progress === 100 && (
				<div className="scanVaultModalHomeScannedFilesCountSection">
					Total files scanned : {scannedFilesCount}
				</div>
			)}

			<div className="scanVaultModalHomeThirdSection">
				<div className={`scanVaultModalHomeTerminal ${showCollectedTasks ? 'scanVaultModalHomeTerminalSlideOut' : 'scanVaultModalHomeTerminalSlideIn'}`}>
					{terminalOutput.map((line, index) => (
						<div key={index}>{line}</div>
					))}
				</div>
				<div className={`scanVaultModalHomeTasksCollected ${showCollectedTasks ? 'slideIn' : 'slideOut'}`}>
					{Object.keys(collectedTasks.Pending).map((filePath, index) => (
						<div key={index}>
							<h3>{filePath}</h3>
							<div>
								{collectedTasks.Pending[filePath].map((task: any, taskIndex: number) => {
									const uniqueKey = `${filePath}-task-${taskIndex}`;
									return (
										<div key={taskIndex}>
											<div
												ref={(descEl) => { taskRendererRef.current[uniqueKey] = descEl; }}
												id={uniqueKey}
											/>
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</div>

			<button className="scanVaultModalHomeToggleButton" onClick={toggleView}>
				{showCollectedTasks ? t("hide-collected-tasks") : t("show-collected-tasks")}
			</button>


			<div>
				<h4>{t("points-to-note")}</h4>
				<li className="setting-item-description">{t("scan-tasks-from-the-vault-description-1")}</li>
				<li className="setting-item-description">{t("scan-tasks-from-the-vault-description-2")}</li>
				<li className="setting-item-description">{t("scan-tasks-from-the-vault-description-3")}</li>
			</div>
		</div>
	);
}

export class ScanVaultModal extends Modal {
	vaultScanner: VaultScanner;
	plugin: TaskBoard;

	constructor(plugin: TaskBoard) {
		super(plugin.app);
		this.plugin = plugin;
		this.vaultScanner = plugin.vaultScanner;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.setAttribute('modal-type', 'task-board-scan-vault-modal');

		const root = ReactDOM.createRoot(this.contentEl);

		root.render(<ScanVaultModalContent
			app={this.app}
			plugin={this.plugin}
			vaultScanner={this.vaultScanner}
		/>);

		// Render React component inside the Obsidian modal
		// this.renderModal();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
