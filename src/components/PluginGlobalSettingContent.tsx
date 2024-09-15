// src/settings/PluginGlobalSettingContent.tsx

import React, { useEffect, useState } from "react";

import { GlobalSettings } from "src/interfaces/KanbanView";
import fs from "fs/promises"; // Changed to use promises-based API
import path from "path";

const dataFilePath = path.join(
	(window as any).app.vault.adapter.basePath,
	".obsidian",
	"plugins",
	"Task-Board",
	"plugindata.json"
);

const PluginGlobalSettingContent: React.FC = () => {
	const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);

	useEffect(() => {
		loadSettings();
	}, []);

	// Function to load settings from plugindata.json
	const loadSettings = async (): Promise<void> => {
		try {
			const data = await fs.readFile(dataFilePath, "utf8"); // Async file read
			const jsonData = JSON.parse(data);
			setGlobalSettings(jsonData.data.globalSettings);
		} catch (err) {
			console.error("Error loading settings:", err);
		}
	};

	// Function to save settings back to plugindata.json
	const saveSettings = async (updatedSettings: GlobalSettings) => {
		try {
			// Directly update the in-memory settings
			const data = await fs.readFile(dataFilePath, "utf8");
			const jsonData = JSON.parse(data);
			jsonData.data.globalSettings = updatedSettings;

			await fs.writeFile(dataFilePath, JSON.stringify(jsonData, null, 2)); // Async write
			console.log("New data written to the global settings:", updatedSettings);
		} catch (err) {
			console.error("Error saving settings:", err);
		}
	};

	if (!globalSettings) {
		return <p style={{ maxWidth: '33vw' }}>Failed to load Global settings.</p>;
	}

	const handleTextChange = (key: keyof GlobalSettings, value: string) => {
		const updatedSettings = { ...globalSettings, [key]: value };
		setGlobalSettings(updatedSettings);
		saveSettings(updatedSettings);
	};

	const handleColumnNameChange = (key: string, value: string) => {
		// Create a new updated defaultColumnNames object
		const updatedColumnNames = { ...globalSettings!.defaultColumnNames, [key]: value };

		// Update the globalSettings with the new defaultColumnNames
		const updatedSettings = { ...globalSettings, defaultColumnNames: updatedColumnNames };

		// Set the updated settings in state and save them
		setGlobalSettings(updatedSettings);
		saveSettings(updatedSettings);
	};


	const handleToggleChange = (key: keyof GlobalSettings, value: boolean) => {
		const updatedSettings = { ...globalSettings, [key]: value };
		setGlobalSettings(updatedSettings);
		saveSettings(updatedSettings);
	};

	const handleDropdownChange = (value: string) => {
		const updatedSettings = { ...globalSettings, firstDayOfWeek: value };
		setGlobalSettings(updatedSettings);
		console.log("Changes happened in the dropdown:", updatedSettings);
		saveSettings(updatedSettings);
	};

	return (
		<div className="globalSettingContentHome">
			{/* Setting for Filters */}
			<div className="globalSettingContentHomeElement">
				<div className="globalSettingContentHomeElementTag">
					<h4>Files and Paths to ignore</h4>
					<p style={{maxWidth: '33vw'}}>
						Enter the file names and Paths separated by comma. All tasks under
						these files will be ignored.
					</p>
					<p>
						NOTE: <b>You will need to Rescan the Vault by pressing the rescan button from the Title bar of the plugin window.</b>
					</p>
				</div>
				<input
					type="text"
					value={globalSettings.filters || ""}
					placeholder="Enter File and Folder names, separated with comma"
					onChange={(e) =>
						handleTextChange("filters", e.target.value)
					}
				/>
			</div>

			<hr width="100%" size="1" color="olive" style={{ "margin": '2px', "marginBottom": '1em' }} noshade="true"></hr>

			{/* Setting for First Day of the Week */}
			<div className="globalSettingContentHomeElement">
				<div className="globalSettingContentHomeElementTag">
					<h4>First Day of the Week</h4>
					<p style={{maxWidth: '33vw'}}>Set the first day of the week</p>
				</div>
				<select
					value={globalSettings.firstDayOfWeek}
					onChange={(e) => handleDropdownChange(e.target.value)}
				>
					<option value="1">Sunday</option>
					<option value="2">Monday</option>
					<option value="3">Tuesday</option>
					<option value="4">Wednesday</option>
					<option value="5">Thursday</option>
					<option value="6">Friday</option>
					<option value="7">Saturday</option>
				</select>
			</div>

			<hr width="100%" size="1" color="olive" style={{ "margin": '2px', "marginBottom": '1em' }} noshade="true"></hr>

			{/* Setting for ScanVaultAtStartup */}
			<div className="globalSettingContentHomeElement">
				<div className="globalSettingContentHomeElementTag">
					<h4>Auto Scan the Vault on Obsidian Startup</h4>
					<p style={{maxWidth: '33vw'}}>
						The plugin will scan the whole vault to detect all the undetected
						tasks from the whole vault every time Obsidian starts.
					</p>
					<p>
						NOTE: <b>If your vault contains a lot of files with huge data, this might affect the startup time of Obsidian.</b>
					</p>
				</div>
				<input
					type="checkbox"
					checked={globalSettings.ScanVaultAtStartup}
					onChange={(e) =>
						handleToggleChange("ScanVaultAtStartup", e.target.checked)
					}
				/>
			</div>

			<hr width="100%" size="1" color="olive" style={{ "margin": '2px', "marginBottom": '1em' }} noshade="true"></hr>

			{/* Setting for Task Completion in Local Time */}
			<div className="globalSettingContentHomeElement">
				<div className="globalSettingContentHomeElementTag">
					<h4>Task Completion in Local Time</h4>
					<p style={{maxWidth: '33vw'}}>Whether task completion times are shown in local time</p>
				</div>
				<input
					type="checkbox"
					checked={globalSettings.taskCompletionInLocalTime}
					onChange={(e) =>
						handleToggleChange("taskCompletionInLocalTime", e.target.checked)
					}
				/>
			</div>

			<hr width="100%" size="1" color="olive" style={{ "margin": '2px', "marginBottom": '1em' }} noshade="true"></hr>

			{/* Setting for Show UTC Offset for Task Completion */}
			<div className="globalSettingContentHomeElement">
				<div className="globalSettingContentHomeElementTag">
					<h4>Show UTC Offset for Task Completion</h4>
					<p style={{maxWidth: '33vw'}}>Whether to display the UTC offset for task completion times</p>
				</div>
				<input
					type="checkbox"
					checked={globalSettings.taskCompletionShowUtcOffset}
					onChange={(e) =>
						handleToggleChange("taskCompletionShowUtcOffset", e.target.checked)
					}
				/>
			</div>

			<hr width="100%" size="1" color="olive" style={{ "margin": '2px', "marginBottom": '1em' }} noshade="true"></hr>

			{/* Setting for Auto Adding Due Date */}
			<div className="globalSettingContentHomeElement">
				<div className="globalSettingContentHomeElementTag">
					<h4>Auto Add Due Date to Tasks</h4>
					<p style={{maxWidth: '33vw'}}>
						Whether to auto add Due Date as Today's date when the tasks are
						created from the Add New task shortcut.
					</p>
				</div>
				<input
					type="checkbox"
					checked={globalSettings.autoAddDue}
					onChange={(e) => handleToggleChange("autoAddDue", e.target.checked)}
				/>
			</div>

			<hr width="100%" size="1" color="olive" style={{ "margin": '2px', "marginBottom": '1em' }} noshade="true"></hr>

			{/* Setting for Auto Adding Due Date */}
			<div className="globalSettingContentHomeElement">
				<div className="globalSettingContentHomeElementTag">
					<h4>Day Planner Plugin Compatibility</h4>
					<p style={{ maxWidth: '33vw' }}>
						If you have installed Day Planner Plugin, this plugin enters the time at the start of the task body, instead in the metadata. After enabling this feature, the time will be shown according to the Day Planner plugin inside Markdown files, but in the Task Board, the time will be shown in the Task Footer.
					</p>
				</div>
				<input
					type="checkbox"
					checked={globalSettings.dayPlannerPlugin}
					onChange={(e) => handleToggleChange("dayPlannerPlugin", e.target.checked)}
				/>
			</div>

			<hr width="100%" size="1" color="olive" style={{ "margin": '2px', "marginBottom": '1em' }} noshade="true"></hr>

			{/* Settings for Default Column Names */}
			<h3>Default Column Names</h3>
			{Object.entries(globalSettings.defaultColumnNames).map(([key, value]) => (
				<div className="globalSettingContentHomeElement" key={key}>
					<div className="globalSettingContentHomeElementTag">
						<h4>{key}</h4>
						<p style={{ maxWidth: '33vw' }}>Enter the name for the {key} column</p>
					</div>
					<input
						type="text"
						value={value}
						placeholder="Enter New Column Name"
						onChange={(e) => handleColumnNameChange(key, e.target.value)}
					/>
				</div>
			))}

		</div>
	);
};

export default PluginGlobalSettingContent;
