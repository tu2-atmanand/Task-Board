// /src/modal/BoardConfigModal.tsx - V2

import { App, Modal, Notice } from "obsidian";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd"; // For drag-and-drop
import { DraggableProvided, DropResult } from 'react-beautiful-dnd';
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { FaEdit, FaTrash } from 'react-icons/fa';
import React, { useEffect, useRef, useState } from "react";

import AddColumnModal from "src/modal/AddColumnModal";
import { Board } from "src/interfaces/BoardConfigs";
import ReactDOM from "react-dom/client";
import { RxDragHandleDots2 } from "react-icons/rx";
import { SettingsManager } from "src/services/TaskBoardSettingConstructUI";
import TaskBoard from "main";

interface ConfigModalProps {
	app: App;
	settingManager: SettingsManager;
	boards: Board[];
	activeBoardIndex: number;
	onClose: () => void;
	onSave: (updatedBoards: Board[]) => void;
}

const ConfigModalContent: React.FC<ConfigModalProps> = ({
	app,
	settingManager,
	boards,
	activeBoardIndex,
	onClose,
	onSave,
}) => {
	const [localBoards, setLocalBoards] = useState<Board[]>(() => {
		try {
			return boards ? JSON.parse(JSON.stringify(boards)) : [];
		} catch (e) {
			console.error("Failed to parse boards:", e);
			return [];
		}
	});

	const [selectedBoardIndex, setSelectedBoardIndex] = useState<number>(
		activeBoardIndex
	);
	// const [settings, setSettings] = useState<GlobalSettings>();

	// Function to handle board name change
	const handleBoardNameChange = (index: number, newName: string) => {
		const updatedBoards = [...localBoards];
		updatedBoards[index].name = newName;
		setLocalBoards(updatedBoards);
	};

	// Function to handle column change
	const handleColumnChange = (
		boardIndex: number,
		columnIndex: number,
		field: string,
		value: any
	) => {
		const updatedBoards = [...localBoards];
		if (field in updatedBoards[boardIndex].columns[columnIndex].data) {
			(updatedBoards[boardIndex].columns[columnIndex].data as any)[field] = value;
		}
		setLocalBoards(updatedBoards);
	};

	const handleFiltersChange = (boardIndex: number, value: string) => {
		const updatedBoards = [...localBoards];
		// Split input string by commas and trim spaces to create an array
		updatedBoards[boardIndex].filters = value.split(",").map(tag => tag.trim());
		setLocalBoards(updatedBoards);
	};

	const handleFilterPolarityChange = (boardIndex: number, value: string) => {
		const updatedBoards = [...localBoards];
		updatedBoards[boardIndex].filterPolarity = value;
		setLocalBoards(updatedBoards);
	};

	const handleToggleChange = (boardIndex: number, field: keyof Board, value: boolean) => {
		const updatedBoards = [...localBoards];
		if (updatedBoards[boardIndex]) {
			updatedBoards[boardIndex][field] = value;
		}
		setLocalBoards(updatedBoards);
	};

	// Function to add a new column to the selected board

	// const addColumnToBoard = (boardIndex: number) => {
	// 	const updatedBoards = [...localBoards];
	// 	updatedBoards[boardIndex].columns.push({
	// 		colType: "undated",
	// 		data: {
	// 			collapsed: false,
	// 			name: `Column ${updatedBoards[boardIndex].columns.length + 1}`,
	// 			index: updatedBoards[boardIndex].columns.length + 1,
	// 		},
	// 	});
	// 	setLocalBoards(updatedBoards);
	// };

	const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);

	const handleOpenAddColumnModal = () => {
		setIsAddColumnModalOpen(true);
		// renderAddColumnModal();
	};

	const handleCloseAddColumnModal = () => {
		setIsAddColumnModalOpen(false);
	};

	const handleAddColumn = (boardIndex: number, columnData: { colType: string; name: string, active: boolean }) => {
		const updatedBoards = [...localBoards];
		updatedBoards[boardIndex].columns.push({
			colType: columnData.colType,
			active: columnData.active,
			collapsed: false,
			data: {
				name: columnData.name,
				index: updatedBoards[boardIndex].columns.length + 1,
			},
		});
		setLocalBoards(updatedBoards);
		handleCloseAddColumnModal();
	};

	// Function to render the Add Column Modal
	const renderAddColumnModal = () => {
		if (!isAddColumnModalOpen) return null; // Return null if the modal is not open
		console.log("Inside the renderAddColumnModal");
		return (
			<AddColumnModal
				isOpen={isAddColumnModalOpen}
				onClose={handleCloseAddColumnModal}
				onSubmit={(columnData) => handleAddColumn(activeBoardIndex, columnData)}
			/>
		);
	};

	// Function to delete a column from the selected board
	const deleteColumnFromBoard = (boardIndex: number, columnIndex: number) => {
		const updatedBoards = [...localBoards];
		updatedBoards[boardIndex].columns.splice(columnIndex, 1);
		setLocalBoards(updatedBoards);
	};

	const deleteCurrentBoard = () => {
		if (selectedBoardIndex !== -1) {
			const updatedBoards = [...localBoards];
			updatedBoards.splice(selectedBoardIndex, 1);
			setLocalBoards(updatedBoards);
			setSelectedBoardIndex(-1); // Reset to global settings or no board selected
		} else {
			new Notice("No board selected to delete.");
		}
	};

	// Function to handle column drag-and-drop
	const onDragEnd = (result) => {
		if (!result.destination) return;

		const updatedBoards = [...localBoards];
		const [movedColumn] = updatedBoards[selectedBoardIndex].columns.splice(
			result.source.index,
			1
		);
		updatedBoards[selectedBoardIndex].columns.splice(
			result.destination.index,
			0,
			movedColumn
		);

		// Update indices
		updatedBoards[selectedBoardIndex].columns.forEach((col, idx) => {
			col.data.index = idx + 1;
		});

		setLocalBoards(updatedBoards);
	};

	// Function to save changes
	const handleSave = () => {
		onSave(localBoards);
		onClose();
	};

	// Function to render global settings
	// useEffect(() => {
	// 	console.log("Inside the useEffect to render Global Settings ...............");
	// 	// <div>
	// 	// 	<h3>Task Board Plugin - Global Settings</h3>
	// 	// 	<hr width="50%" size="2" color="olive" noshade="true"></hr>
	// 	// 	<PluginGlobalSettingContent />
	// 	// </div>
	// 	if (globalSettingsHTMLSection.current) {
	// 		settingManager.constructUI(globalSettingsHTMLSection.current, "Plugin Global Settings");
	// 	}
	// }, [selectedBoardIndex === -1]);

	// useEffect(() => {
	// 	console.log("Outside the useEffect to render Global Settings ...............");

	// 	if (globalSettingsHTMLSection.current) {
	// 		globalSettingsHTMLSection.current.innerHTML = '';
	// 	}
	// }, [selectedBoardIndex !== -1]);

	const globalSettingsHTMLSection = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (globalSettingsHTMLSection.current) {
			if (selectedBoardIndex === -1) {
				// Render global settings
				settingManager.constructUI(globalSettingsHTMLSection.current, "Plugin Global Settings");
			} else {
				// Cleanup global settings UI
				settingManager.cleanUp();
				// globalSettingsHTMLSection.current.innerHTML = ''; // Clear the content
				// globalSettingsHTMLSection.current.detach();
				globalSettingsHTMLSection.current.remove();
				// globalSettingsHTMLSection.current.removeClass("pluginGlobalSettingsTab");
			}
		}
	}, [selectedBoardIndex]);


	const toggleActiveState = (boardIndex: number, columnIndex: number) => {
		const updatedBoards = [...localBoards];
		const column = updatedBoards[boardIndex].columns[columnIndex];
		column.active = !column.active; // Toggle the active state
		setLocalBoards(updatedBoards); // Update the state
		onSave(updatedBoards); // Save the updated state
	};

	// Function to render board settings
	const renderBoardSettings = (boardIndex: number) => {
		const board = localBoards[boardIndex];
		return (
			<div className="boardConfigModalMainContent-Active">
				<h2 className="boardConfigModalMainContent-Active-Heading">{board.name} Settings</h2>
				<hr width="50%" size="2" color="olive" style={{ "margin": 0 }} noshade="true"></hr>
				<div className="boardConfigModalMainContent-Active-Body">
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<h4>Board Name</h4>
							<div>Name of the Board which will appear as a tab in the tab header inside the plugin.</div>
						</div>
						<input
							type="text"
							value={board.name}
							onChange={(e) => handleBoardNameChange(boardIndex, e.target.value)}
						/>
					</div>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<h4>Show Column Tags</h4>
							<div>Whether to show tags on the columns.</div>
						</div>
						<input
							type="checkbox"
							checked={board.showColumnTags}
							onChange={(e) => handleToggleChange(boardIndex, "showColumnTags", e.target.checked)}
						/>
					</div>

					<hr width="100%" size="2" color="olive" style={{ "margin": 0 }} noshade="true"></hr>

					<h3>Board Filters</h3>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<h4>Filter Tags</h4>
							<div>Enter the tags, separated with comman, you want to see in this board. Only tasks with these tags will be shown.</div>

						</div>
						<input
							type="text"
							value={board.filters?.join(", ")}
							onChange={(e) => handleFiltersChange(boardIndex, e.target.value)}
						/>
					</div>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<h4>Filter Polarity</h4>
							<div>Enable or disable the above filter tags inside the boards.</div>
						</div>
						<select
							value={board.filterPolarity}
							onChange={(e) => handleFilterPolarityChange(boardIndex, e.target.value)}
						>
							<option value="Allow">Allow</option>
							<option value="Deny">Deny</option>
						</select>
					</div>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<h4>Show Filtered Tags</h4>
							<div>Whether to show the filtered tags on the columns.</div>
						</div>
						<input
							type="checkbox"
							checked={board.showFilteredTags}
							onChange={(e) => handleToggleChange(boardIndex, "showFilteredTags", e.target.checked)}
						/>
					</div>

					<hr width="100%" size="2" color="olive" style={{ "margin": 0 }} noshade="true"></hr>

					<div className="boardConfigModalMainContent-Active-BodyColumnSec">
						<h3>Columns</h3>
						<Droppable droppableId="columns" className="boardConfigModalMainContent-Active-BodyColumnsList">
							{(provided) => (
								<div ref={provided.innerRef} {...provided.droppableProps}>
									{board.columns.map((column, columnIndex) => (
										<Draggable
											key={columnIndex}
											draggableId={columnIndex.toString()}
											index={columnIndex}
										>
											{(provided) => (
												<div
													ref={provided.innerRef}
													{...provided.draggableProps}
													{...provided.dragHandleProps}
												>
													<div className="boardConfigModalColumnRow">
														<RxDragHandleDots2 size={15} enableBackground={0} />
														{column.active ? (
															<EyeIcon
																onClick={() => toggleActiveState(boardIndex, columnIndex)}
																style={{ cursor: 'pointer' }}
															/>
														) : (
															<EyeOffIcon
																onClick={() => toggleActiveState(boardIndex, columnIndex)}
																style={{ cursor: 'pointer' }}
															/>
														)}
														<div className="boardConfigModalColumnRowContent">
															<button style={{ width: '100%', minWidth: '8em' }}>{column.colType}</button>
															<input
																type="text"
																value={column.data.name}
																onChange={(e) =>
																	handleColumnChange(
																		boardIndex,
																		columnIndex,
																		"name",
																		e.target.value
																	)
																}
															/>
															{column.colType === "namedTag" && (
																<input
																	type="text"
																	placeholder="Enter tag"
																	value={column.data.coltag || ""}
																	onChange={(e) =>
																		handleColumnChange(
																			boardIndex,
																			columnIndex,
																			"coltag",
																			e.target.value
																		)
																	}
																/>
															)}
															{column.colType === "completed" && (
																<input
																	type="number"
																	placeholder="Max items"
																	value={column.data.limit || ""}
																	onChange={(e) =>
																		handleColumnChange(
																			boardIndex,
																			columnIndex,
																			"limit",
																			Number(e.target.value)
																		)
																	}
																/>
															)}
															{column.colType === "dated" && (
																<>
																	<input
																		type="number"
																		placeholder="From"
																		value={column.data.range?.rangedata.from || ""}
																		onChange={(e) =>
																			handleColumnChange(
																				boardIndex,
																				columnIndex,
																				"range",
																				{
																					...column.data.range,
																					rangedata: {
																						...column.data.range?.rangedata,
																						from: Number(e.target.value),
																					},
																				}
																			)
																		}
																	/>
																	<input
																		type="number"
																		placeholder="To"
																		value={column.data.range?.rangedata.to || ""}
																		onChange={(e) =>
																			handleColumnChange(
																				boardIndex,
																				columnIndex,
																				"range",
																				{
																					...column.data.range,
																					rangedata: {
																						...column.data.range?.rangedata,
																						to: Number(e.target.value),
																					},
																				}
																			)
																		}
																	/>
																</>
															)}
														</div>
														<FaTrash size={13} enableBackground={0} opacity={0.7} onClick={() => deleteColumnFromBoard(boardIndex, columnIndex)} title="Delete Column" />
													</div>
												</div>
											)}
										</Draggable>
									))}
									{provided.placeholder}
								</div>
							)}
						</Droppable>
					</div>
					<button onClick={handleOpenAddColumnModal}>Add Column</button>
				</div>
				<hr width="100%" size="2" color="olive" style={{ "margin": 0 }} noshade="true"></hr>
				<button style={{ backgroundColor: "darkred" }} onClick={deleteCurrentBoard}>Delete This Board</button>
			</div>
		);
	};

	return (
		<>
			{renderAddColumnModal()}
			<div className="boardConfigModalHome">
				<div className="boardConfigModalSidebar">
					<div className="boardConfigModalSidebarBtnArea" >
						<div className="boardConfigModalSidebarBtnAreaGlobal" onClick={() => setSelectedBoardIndex(-1)}>Global Settings</div>
						<hr width="100%" size="2" color="olive" style={{ "margin": 0 }} noshade="true"></hr>
						<h6>Boards</h6>
						{localBoards.map((board, index) => (
							<div
								key={index}
								onClick={() => setSelectedBoardIndex(index)}
								className={`boardConfigModalSidebarBtnArea-btn${index === selectedBoardIndex ? "-active" : ""}`}
							>
								{board.name}
							</div>
						))}
					</div>
					<div className="boardConfigModalSidebarBtnArea">
						<button style={{ width: '100%' }} onClick={() => {
							const newBoard: Board = {
								name: `Board ${localBoards.length + 1}`,
								index: localBoards.length + 1,
								columns: [],
							};
							setLocalBoards([...localBoards, newBoard]);
						}}>+ Add Board</button>
						<hr width="100%" size="2" color="olive" noshade="true"></hr>
						<button style={{ width: '100%', backgroundColor: "darkgreen" }} onClick={handleSave}>Save</button>
					</div>
				</div>
				<DragDropContext onDragEnd={onDragEnd}>
					<div className="boardConfigModalMainContent">
						{selectedBoardIndex === -1
							? <div className="pluginGlobalSettingsTab" ref={globalSettingsHTMLSection} />
							: renderBoardSettings(selectedBoardIndex)}
					</div>
				</DragDropContext>
			</div>
		</>
	);
};

// BoardConfigureModal class for modal behavior
export class BoardConfigureModal extends Modal {
	root: ReactDOM.Root;
	settingsManager: SettingsManager;
	boards: Board[];
	activeBoardIndex: number;
	onSave: (updatedBoards: Board[]) => void;
	// root: ReactDOM.Root;

	constructor(
		app: App,
		plugin: TaskBoard,
		boards: Board[],
		activeBoardIndex: number,
		onSave: (updatedBoards: Board[]) => void
	) {
		super(app);
		this.boards = boards;
		this.activeBoardIndex = activeBoardIndex;
		this.onSave = onSave;
		this.settingsManager = new SettingsManager(app, plugin);
		const { contentEl } = this;
		// this.root = null;
		this.root = ReactDOM.createRoot(contentEl);
	}

	onOpen() {
		// contentEl.empty();
		// modalEl.addClass('global-settings-modal');
		this.root.render(
			<ConfigModalContent
				app={this.app}
				settingManager={this.settingsManager}
				boards={this.boards}
				activeBoardIndex={this.activeBoardIndex}
				onClose={() => this.close()}
				onSave={this.onSave}
			/>
		);
	}

	onClose() {
		// Clean up React rendering
		if (this.root) {
			this.root.unmount();
		}

		// Clean up settings manager if needed
		if (this.settingsManager) {
			this.settingsManager.cleanUp();
		}

		// Clear the content element
		const { contentEl } = this;
		contentEl.empty();

		// Call the super method to correctly close the modal
		super.onClose();
	}

}
