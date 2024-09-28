// /src/components/ReScanVaultModal.tsx

import { App, Modal, Notice } from "obsidian";
import React, { useEffect, useState } from "react";

import ReactDOM from "react-dom/client";
import { ScanningVault } from "src/utils/ScanningVault";
import { tasksJson } from "src/interfaces/TaskItem";

interface ReScanVaultModalProps {
	app: App;
}

const ReScanVaultModalContent: React.FC<{ app: App; scanningVault: ScanningVault }> = ({ app, scanningVault }) => {
	// collectedTasks: any = { Pending: {}, Completed: {} };
	scanningVault: ScanningVault;

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
			setTerminalOutput((prev) => [...prev, `Scanning file: ${file.path}`]);

			await scanningVault.extractTasksFromFile(file, scanningVault.tasks);

			setProgress(((i + 1) / files.length) * 100); // Update progress
		}

		setCollectedTasks(scanningVault.tasks);
		// setIsRunning(false);
		new Notice("Vault scanning complete.");
		console.log("Vault scanning complete.");
		scanningVault.saveTasksToFile();

	};

	const toggleView = () => {
		setShowCollectedTasks(!showCollectedTasks);
	};

	return (
		<div className="reScanVaultModalHome">
			<h2 style={{ textAlign: "center" }}>Scan Tasks from the Vault</h2>
			<p>You dont have to run this often. The plugin has a real-time detection mechanism, which detects the newly added task automatically. The tasks will be updated in the board within 5 minutes. If you want to use the real-time feature, see the respective option in the plugin setting.
				This is only for the first time after the plugin has been installed. There is also an option in setting if you want to run this functionality on the Obsidian startup, if it slows down the startup time, then you can disable the option.</p>

			<div className="reScanVaultModalHomeSecondSection" >
				<div style={{ flexGrow: 1, width: "80%" }}>
					<progress max="100" value={progress} style={{ width: "100%" }}></progress>
				</div>
				<button className="reScanVaultModalHomeSecondSectionButton" onClick={runScan} disabled={isRunning}>
					{isRunning ? progress.toFixed(0) : "Run"}
				</button>
			</div>

			<div className="reScanVaultModalHomeTerminal"
			>
				{terminalOutput.map((line, index) => (
					<div key={index}>{line}</div>
				))}
			</div>

			<button onClick={toggleView} style={{ marginTop: "20px" }}>
				{showCollectedTasks ? "Hide Tasks Collected" : "Show Tasks Collected"}
			</button>

			{showCollectedTasks && (
				<div className="reScanVaultModalHomeTasksCollected"
				>
					{Object.keys(collectedTasks.Pending).map((filePath, index) => (
						<div key={index}>
							<h4>{filePath}</h4>
							<ul>
								{collectedTasks.Pending[filePath].map((task: any, taskIndex: number) => (
									<li key={taskIndex}>{task.body}</li>
								))}
							</ul>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export class ReScanVaultModal extends Modal {
	scanningVault: ScanningVault;

	constructor(app: App) {
		super(app);
		this.scanningVault = new ScanningVault(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		console.log("ReScanVaultModal : Opening the Modal...");

		const container = document.createElement("div");
		contentEl.appendChild(container);

		const root = ReactDOM.createRoot(this.contentEl);

		root.render(<ReScanVaultModalContent
			app={this.app}
			scanningVault={this.scanningVault}
		/>);

		// Render React component inside the Obsidian modal
		// this.renderModal();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
