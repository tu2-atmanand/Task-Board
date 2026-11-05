// /src/components/ScanVaultModal.tsx

import { App, Component, Modal, Notice } from "obsidian";
import React, { useEffect, useRef, useState } from "react";
import {
	IdInjectionResult,
	jsonCacheData,
	taskItem,
} from "src/interfaces/TaskItem";

import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
import ReactDOM from "react-dom/client";
import VaultScanner, { fileTypeAllowedForScanning } from "src/managers/VaultScanner";
import TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { getFormattedTaskContent } from "src/utils/taskLine/TaskContentFormatter";
import { newReleaseVersion, VIEW_TYPE_TASKBOARD } from "src/interfaces/Constants";
import { getCurrentLocalDateTimeString } from "src/utils/DateTimeCalculations";
import { scanFilterForFilesNFoldersNFrontmatter } from "src/utils/algorithms/ScanningFilterer";
import { eventEmitter } from "src/services/EventEmitter";

const ScanVaultModalContent: React.FC<{ app: App, plugin: TaskBoard, vaultScanner: VaultScanner }> = ({ app, plugin, vaultScanner }) => {

	const [isRunning, setIsRunning] = useState(false);
	const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
	const [progress, setProgress] = useState(0);
	const [scannedFilesCount, setScannedFilesCount] = useState<number>();
	const [showCollectedTasks, setShowCollectedTasks] = useState(false);
	const [idInjectionResult, setIdInjectionResult] =
		useState<IdInjectionResult | null>(null);
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
		const globalSettings = plugin.settings.data.globalSettings;
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

		// Calibrate the counter before any new IDs are allocated.
		await vaultScanner.calibrateUniqueIdCounter();

		let idResult: IdInjectionResult | null = null;
		if (
			globalSettings.autoAddUniqueID === true &&
			globalSettings.addIdDuringScan === true
		) {
			const allCachedTasks = [
				...Object.values(vaultScanner.tasksCache.Pending).flat(),
				...Object.values(vaultScanner.tasksCache.Completed).flat(),
			];
			idResult = await vaultScanner.addMissingIdsToTasks(
				allCachedTasks,
			);

			if (
				idResult.filesUpdated.length > 0 ||
				idResult.filesFailed.length > 0
			) {
				setTerminalOutput((prev) => [
					...prev,
					...idResult!.filesUpdated.map(
						(filePath) => `Added missing IDs: ${filePath}`,
					),
					...idResult!.filesFailed.map(
						(filePath) => `Failed to add missing IDs: ${filePath}`,
					),
				]);
			}

			if (
				idResult.tasksUpdated > 0 ||
				idResult.filesFailed.length > 0
			) {
				new Notice(
					`${t("scan-tasks-ids-added")} : ${idResult.tasksUpdated}\n${t("scan-files-updated")} : ${idResult.filesUpdated.length}\n${t("scan-files-failed")} : ${idResult.filesFailed.length}`,
					8000,
				);
			}
		}
		setIdInjectionResult(idResult);

		// setIsRunning(false);
		setCollectedTasks(vaultScanner.tasksCache);
		setScannedFilesCount(totalScannedFilesCount);
		new Notice(t("vault-scanning-complete"));

		plugin.vaultScanner.tasksCache = vaultScanner.tasksCache;
		await vaultScanner.saveTasksToJsonCache();

		if (localStorage.getItem("manadatoryScan") === "true") {
			localStorage.setItem("manadatoryScan", "false");
			plugin.app.workspace.getLeavesOfType(VIEW_TYPE_TASKBOARD).forEach((leaf) => {
				leaf.detach();
			});
			plugin.registerTaskBoardView();
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
			{localStorage.getItem("manadatoryScan") === "true" ?
				(
					<>
						<div className="scanVaultModalHomeMandatoryScan">{t("scan-vault-from-the-vault-upgrade-message-1")} {newReleaseVersion}</div>
						<div className="scanVaultModalHomeMandatoryScan">{t("scan-vault-from-the-vault-upgrade-message-2")}</div>
						<br />
						<div className="scanVaultModalHomeMandatoryScan">{t("scan-vault-from-the-vault-upgrade-message-3")} : <a href={`https://github.com/tu2-atmanand/Task-Board/releases/tag/${newReleaseVersion}`}>Task Board v{newReleaseVersion}</a>.</div>
					</>
				) :
				(
					<>
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

			{progress === 100 && idInjectionResult && (
				<div className="scanVaultModalHomeScannedFilesCountSection">
					{t("scan-tasks-ids-added")} : {idInjectionResult.tasksUpdated} | {t("scan-files-updated")} : {idInjectionResult.filesUpdated.length} | {t("scan-files-failed")} : {idInjectionResult.filesFailed.length}
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

	constructor(app: App, plugin: TaskBoard) {
		super(app);
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
