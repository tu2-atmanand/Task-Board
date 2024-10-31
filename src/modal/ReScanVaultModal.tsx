// /src/components/ReScanVaultModal.tsx

import { App, Component, Modal, Notice } from "obsidian";
import React, { useEffect, useRef, useState } from "react";
import { taskItem, tasksJson } from "src/interfaces/TaskItemProps";

import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
import ReactDOM from "react-dom/client";
import { ScanningVault } from "src/utils/ScanningVault";
import TaskBoard from "main";
import { scanFilterForFilesNFolders } from "src/utils/FiltersVerifier";
import { t } from "src/utils/lang/helper";
import { taskElementsFormatter } from "src/utils/TaskItemUtils";

const ReScanVaultModalContent: React.FC<{ app: App, plugin: TaskBoard, scanningVault: ScanningVault }> = ({ app, plugin, scanningVault }) => {

	const [isRunning, setIsRunning] = useState(false);
	const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
	const [progress, setProgress] = useState(0);
	const [showCollectedTasks, setShowCollectedTasks] = useState(false);
	const [collectedTasks, setCollectedTasks] = useState<tasksJson>({
		Pending: {},
		Completed: {},
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
		new Notice(t(64));
		scanningVault.saveTasksToFile();
	};

	const toggleView = () => {
		setShowCollectedTasks(!showCollectedTasks);
	};

	const componentRef = useRef<Component | null>(null);
	useEffect(() => {
		// Initialize Obsidian Component on mount
		componentRef.current = new Component();
		componentRef.current.load();

		return () => {
			// Cleanup the component on unmount
			componentRef.current?.unload();
		};
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

					const formatedContent = taskElementsFormatter(plugin, newTaskContent);
					
					const uniqueKey = `${filePath}-task-${taskIndex}`;
					const descElement = taskRendererRef.current[uniqueKey];

					if (descElement) {
						descElement.innerHTML = '';
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
		<div className="reScanVaultModalHome">
			<h2 style={{ textAlign: "center" }}>{t(65)}</h2>
			<p>{t(66)}</p>
			<p>{t(67)}</p>
			<p>{t(68)}</p>

			<div className="reScanVaultModalHomeSecondSection" >
				<div style={{ flexGrow: 1, width: "80%" }}>
					<progress max="100" value={progress} style={{ width: "100%", height: '35px' }}></progress>
				</div>
				<button className="reScanVaultModalHomeSecondSectionButton" onClick={runScan} disabled={isRunning}>
					{isRunning ? progress.toFixed(0) : t(69)}
				</button>
			</div>

			<div className="reScanVaultModalHomeThirdSection">
				<div className={`reScanVaultModalHomeTerminal ${showCollectedTasks ? 'reScanVaultModalHomeTerminalSlideOut' : 'reScanVaultModalHomeTerminalSlideIn'}`}>
					{terminalOutput.map((line, index) => (
						<div key={index}>{line}</div>
					))}
				</div>
				<div className={`reScanVaultModalHomeTasksCollected ${showCollectedTasks ? 'slideIn' : 'slideOut'}`}>
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

			<button onClick={toggleView} style={{ marginTop: "20px" }}>
				{showCollectedTasks ? t(70) : t(71)}
			</button>
		</div>
	);
}

export class ReScanVaultModal extends Modal {
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
		const container = document.createElement("div");
		contentEl.appendChild(container);

		const root = ReactDOM.createRoot(this.contentEl);

		root.render(<ReScanVaultModalContent
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
