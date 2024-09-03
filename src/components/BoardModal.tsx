// /src/compoenents/BoardModal.tsx

import { App, Modal, Notice } from "obsidian";
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { GlobalSettings } from "../settings/TaskBoardSettingTab"; // Assume this contains the settings UI

interface Board {
	name: string;
	columns: Array<{
		tag: string;
		data: { collapsed: boolean; name: string };
	}>;
}

interface ConfigModalProps {
	app: App;
	boards: Board[];
	activeBoardIndex: number;
	onClose: () => void;
	onSave: (updatedBoards: Board[]) => void;
}

// Define a React component for the modal content
const ConfigModalContent: React.FC<ConfigModalProps> = ({
	boards,
	activeBoardIndex,
	onClose,
	onSave
}) => {
	const [localBoards, setLocalBoards] = useState<Board[]>(JSON.parse(JSON.stringify(boards))); // Deep clone
	const [selectedBoardIndex, setSelectedBoardIndex] = useState<number>(activeBoardIndex);
	const [settings, setSettings] = useState<GlobalSettings>({}); // Local state to store global settings

	// Function to handle board name change
	const handleBoardNameChange = (index: number, newName: string) => {
		const updatedBoards = [...localBoards];
		updatedBoards[index].name = newName;
		setLocalBoards(updatedBoards);
	};

	// Function to add a new column to the selected board
	const addColumnToBoard = (boardIndex: number) => {
		const updatedBoards = [...localBoards];
		updatedBoards[boardIndex].columns.push({
			tag: "custom",
			data: { collapsed: false, name: `Column ${updatedBoards[boardIndex].columns.length + 1}` }
		});
		setLocalBoards(updatedBoards);
	};

	// Function to save changes
	const handleSave = () => {
		onSave(localBoards);
		onClose();
	};

	// Function to render global settings
	const renderGlobalSettings = () => {
		return (
			<div>
				<h3>Global Settings</h3>
				{/* Here, render the global settings component */}
				{/* Example: <GlobalSettingsComponent settings={settings} onSettingsChange={setSettings} /> */}
			</div>
		);
	};

	// Function to render board settings
	const renderBoardSettings = (boardIndex: number) => {
		const board = localBoards[boardIndex];
		return (
			<div>
				<h3>{board.name} Settings</h3>
				{/* Board configuration inputs */}
				<input
					type="text"
					value={board.name}
					onChange={(e) => handleBoardNameChange(boardIndex, e.target.value)}
				/>
				{board.columns.map((column, columnIndex) => (
					<div key={columnIndex}>
						<input
							type="text"
							value={column.data.name}
							onChange={(e) => {
								const updatedBoards = [...localBoards];
								updatedBoards[boardIndex].columns[columnIndex].data.name = e.target.value;
								setLocalBoards(updatedBoards);
							}}
						/>
					</div>
				))}
				<button onClick={() => addColumnToBoard(boardIndex)}>+ Add Column</button>
			</div>
		);
	};

	return (
		<div className="config-modal">
			<div className="config-modal-sidebar">
				<div onClick={() => setSelectedBoardIndex(-1)}>Global Settings</div>
				{localBoards.map((board, index) => (
					<div key={index} onClick={() => setSelectedBoardIndex(index)} className={index === selectedBoardIndex ? "active" : ""}>
						{board.name}
					</div>
				))}
			</div>
			<div className="config-modal-content">
				{selectedBoardIndex === -1 ? renderGlobalSettings() : renderBoardSettings(selectedBoardIndex)}
				<button onClick={handleSave}>Save</button>
				<button onClick={onClose}>Close</button>
			</div>
		</div>
	);
};

// Define the modal class that integrates with Obsidian
export default class ConfigModal extends Modal {
	boards: Board[];
	activeBoardIndex: number;
	onSave: (updatedBoards: Board[]) => void;

	constructor(app: App, boards: Board[], activeBoardIndex: number, onSave: (updatedBoards: Board[]) => void) {
		super(app);
		this.boards = boards;
		this.activeBoardIndex = activeBoardIndex;
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Create a container for React content
		const container = document.createElement("div");
		contentEl.appendChild(container);

		const root = ReactDOM.createRoot(this.contentEl);

		root.render(
			<ConfigModalContent
				app={this.app}
				boards={this.boards}
				activeBoardIndex={this.activeBoardIndex}
				onClose={() => this.close()}
				onSave={this.onSave}
			/>
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Usage example: You can use this modal in your plugin like this:

