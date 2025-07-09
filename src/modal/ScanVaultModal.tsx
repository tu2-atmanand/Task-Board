// /src/components/ScanVaultModal.tsx

import { App, Component, Modal, Notice } from "obsidian";
import React, { useEffect, useRef, useState } from "react";
import { jsonCacheData, taskItem } from "src/interfaces/TaskItem";

import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
import ReactDOM from "react-dom/client";
import { ScanningVault } from "src/utils/ScanningVault";
import TaskBoard from "main";
import { scanFilterForFilesNFolders } from "src/utils/FiltersVerifier";
import { t } from "src/utils/lang/helper";
import { taskContentFormatter } from "src/utils/TaskContentFormatter";
import { VIEW_TYPE_TASKBOARD } from "src/types/GlobalVariables";

const ScanVaultModalContent: React.FC<{ app: App, plugin: TaskBoard, scanningVault: ScanningVault }> = ({ app, plugin, scanningVault }) => {

	const [isRunning, setIsRunning] = useState(false);
	const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
	const [progress, setProgress] = useState(0);
	const [showCollectedTasks, setShowCollectedTasks] = useState(false);
	const [collectedTasks, setCollectedTasks] = useState<jsonCacheData>({
		VaultName: plugin.app.vault.getName(),
		Modified_at: new Date().toISOString(),
		Pending: {},
		Completed: {},
		Notes: [],
	});

	const runScan = async () => {
		setIsRunning(true);
		const files = app.vault.getMarkdownFiles();
		setProgress(0); // Reset progress

		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			const scanFilters = plugin.settings.data.globalSettings.scanFilters;
			if (scanFilterForFilesNFolders(file, scanFilters)) {
				setTerminalOutput((prev) => [...prev, `Scanning file: ${file.path}`]);
				await scanningVault.extractTasksFromFile(file, scanningVault.tasks, scanFilters);
			}

			setProgress(((i + 1) / files.length) * 100); // Update progress
		}

		setCollectedTasks(scanningVault.tasks);
		// setIsRunning(false);
		new Notice(t("vault-scanning-complete"));
		scanningVault.saveTasksToFile();

		if (localStorage.getItem("manadatoryScan") === "true") {
			localStorage.setItem("manadatoryScan", "false");
			plugin.app.workspace.getLeavesOfType(VIEW_TYPE_TASKBOARD).forEach((leaf) => {
				leaf.detach();
			});
			plugin.registerTaskBoardView();
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

					const formatedContent = taskContentFormatter(plugin, newTaskContent);

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
		}
	}, [showCollectedTasks, collectedTasks]);

	return (
		<div className="scanVaultModalHome">
			<h2>{t("scan-tasks-from-the-vault")}</h2>
			{localStorage.getItem("manadatoryScan") === "true" ?
				(<>
					<div className="scanVaultModalHomeMandatoryScan">Looks like you have recently updated this plugin.</div>
					<div className="scanVaultModalHomeMandatoryScan">This new release has brought various new features, which requires you to re-scan the whole vault.</div>
					<br />
					<div className="scanVaultModalHomeMandatoryScan">Read the release notes for this new version here : <a href="https://github.com/tu2-atmanand/Task-Board/releases/tag/1.5.0">Task Board v1.5.0</a>.</div>
				</>
				) :
				(<>
					<div className="setting-item-description">{t("scan-tasks-from-the-vault-description-1")}</div>
					<div className="setting-item-description">{t("scan-tasks-from-the-vault-description-2")}</div>
					<div className="setting-item-description">{t("scan-tasks-from-the-vault-description-3")}</div>
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
												ref={(descEl) => (taskRendererRef.current[uniqueKey] = descEl)}
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
		</div>
	);
}

export class ScanVaultModal extends Modal {
	scanningVault: ScanningVault;
	plugin: TaskBoard;

	constructor(app: App, plugin: TaskBoard) {
		super(app);
		this.plugin = plugin;
		this.scanningVault = new ScanningVault(app, plugin);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.setAttribute('data-type', 'task-board-view');
		contentEl.setAttribute('data-type', 'task-board-view');

		const root = ReactDOM.createRoot(this.contentEl);

		root.render(<ScanVaultModalContent
			app={this.app}
			plugin={this.plugin}
			scanningVault={this.scanningVault}
		/>);

		// Render React component inside the Obsidian modal
		// this.renderModal();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
