// /src/modal/BoardConfigModal.tsx - V2

import { App, Modal, Notice } from "obsidian";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd"; // For drag-and-drop
import { EyeIcon, EyeOffIcon } from "lucide-react";
import React, { ComponentPropsWithRef, useEffect, useRef, useState } from "react";

import AddColumnModal from "src/modal/AddColumnModal";
import { Board } from "src/interfaces/BoardConfigs";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { FaTrash } from 'react-icons/fa';
import ReactDOM from "react-dom/client";
import { RxDragHandleDots2 } from "react-icons/rx";
import { SettingsManager } from "src/settings/TaskBoardSettingConstructUI";
import TaskBoard from "main";
import { t } from "src/utils/lang/helper";

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

	type BooleanBoardProperties = 'showColumnTags' | 'showFilteredTags';
	const handleToggleChange = (boardIndex: number, field: BooleanBoardProperties, value: boolean) => {
		const updatedBoards = [...localBoards];
		if (updatedBoards[boardIndex]) {
			updatedBoards[boardIndex][field] = value as boolean;
		}
		setLocalBoards(updatedBoards);
	};

	// Function to add a new column to the selected board
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
		if (!isAddColumnModalOpen) return null;
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
		const mssg = t(129)
		const deleteModal = new DeleteConfirmationModal(app, {
			app,
			mssg,
			onConfirm: () => {
				if (selectedBoardIndex !== -1) {
					const updatedBoards = [...localBoards];
					updatedBoards.splice(selectedBoardIndex, 1);
					setLocalBoards(updatedBoards);
					setSelectedBoardIndex(-1); // Reset to global settings or no board selected
				} else {
					new Notice(t(35));
				}
			},
			onCancel: () => {
				// console.log("Board Deletion Operation Cancelled.");
			},
		});
		deleteModal.open();
	};

	// Function to handle column drag-and-drop
	const onDragEnd = (result: any) => {
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

	let globalSettingsHTMLSection = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (globalSettingsHTMLSection.current) {

			// Render global settings
			settingManager.constructUI(globalSettingsHTMLSection.current, t(36));
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
		if (globalSettingsHTMLSection.current) {
			// Cleanup global settings UI
			settingManager.cleanUp();
			globalSettingsHTMLSection.current.empty();
		}

		const board = localBoards[boardIndex];
		return (
			<div className="boardConfigModalMainContent-Active">
				<h2 className="boardConfigModalMainContent-Active-Heading">{board.name} {t(37)}</h2>
				<hr className="boardConfigModalHr-50" />
				<div className="boardConfigModalMainContent-Active-Body">
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<h5>{t(38)}</h5>
							<div>{t(39)}</div>
						</div>
						<input
							type="text"
							value={board.name}
							onChange={(e) => handleBoardNameChange(boardIndex, e.target.value)}
						/>
					</div>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<h5>{t(40)}</h5>
							<div>{t(41)}</div>
						</div>
						<input
							type="checkbox"
							checked={board.showColumnTags}
							onChange={(e) => handleToggleChange(boardIndex, "showColumnTags", e.target.checked)}
						/>
					</div>

					<hr className="boardConfigModalHr-100" />

					<h3>{t(139)}</h3>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<h5>{t(42)}</h5>
							<div>{t(43)}</div>

						</div>
						<input
							type="text"
							value={board.filters?.join(", ")}
							onChange={(e) => handleFiltersChange(boardIndex, e.target.value)}
						/>
					</div>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<h5>{t(44)}</h5>
							<div>{t(45)}</div>
						</div>
						<select
							value={board.filterPolarity}
							onChange={(e) => handleFilterPolarityChange(boardIndex, e.target.value)}
						>
							<option value="1">{t(46)}</option>
							<option value="0">{t(47)}</option>
						</select>
					</div>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<h5>{t(48)}</h5>
							<div>{t(49)}</div>
						</div>
						<input
							type="checkbox"
							checked={board.showFilteredTags}
							onChange={(e) => handleToggleChange(boardIndex, "showFilteredTags", e.target.checked)}
						/>
					</div>

					<hr className="boardConfigModalHr-100" />

					<div className="boardConfigModalMainContent-Active-BodyColumnSec">
						<h3>{t(50)}</h3>
						<Droppable droppableId="columns" className="boardConfigModalMainContent-Active-BodyColumnsList">
							{(provided: any) => (
								<div ref={provided.innerRef} {...provided.droppableProps}>
									{board.columns.map((column, columnIndex) => (
										<Draggable
											key={columnIndex}
											draggableId={columnIndex.toString()}
											index={columnIndex}
										>
											{(provided: any) => (
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
															<button className="boardConfigModalColumnRowContentColumnType">{column.colType}</button>
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
																className="boardConfigModalColumnRowContentColName"
															/>
															{column.colType === "namedTag" && (
																<input
																	type="text"
																	placeholder={t(51)}
																	value={column.data.coltag || ""}
																	onChange={(e) =>
																		handleColumnChange(
																			boardIndex,
																			columnIndex,
																			"coltag",
																			e.target.value
																		)
																	}
																	className="boardConfigModalColumnRowContentColName"
																/>
															)}
															{column.colType === "completed" && (
																<input
																	type="number"
																	placeholder={t(52)}
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
																		placeholder={t(53)}
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
																		className="boardConfigModalColumnRowContentColDatedVal"
																	/>
																	<input
																		type="number"
																		placeholder={t(54)}
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
																		className="boardConfigModalColumnRowContentColDatedVal"
																	/>
																</>
															)}
														</div>
														<FaTrash size={13} enableBackground={0} opacity={0.7} onClick={() => deleteColumnFromBoard(boardIndex, columnIndex)} title={t(55)} />
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
					<button className="boardConfigModalAddColumnButton" onClick={handleOpenAddColumnModal}>{t(56)}</button>
				</div>

				<hr className="boardConfigModalHr-100" />

				<button className="boardConfigModalDeleteBoardBtn" onClick={deleteCurrentBoard}>{t(57)}</button>
			</div>
		);
	};

	const renderGlobalSettingsTab = (boardIndex: number) => {
		return (
			<div className="pluginGlobalSettingsTab" ref={globalSettingsHTMLSection} />
		);
	}

	return (
		<>
			{renderAddColumnModal()}
			<div className="boardConfigModalHome">
				<div className="boardConfigModalSidebar">
					<div className="boardConfigModalSidebarBtnArea" >
						<div className="boardConfigModalSidebarBtnAreaGlobal" onClick={() => setSelectedBoardIndex(-1)}>{t(58)}</div>

						<hr className="boardConfigModalHr-100" />

						<h6>All Boards</h6>
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
						<button className="boardConfigModalSidebarBtnAreaAddBoard" onClick={() => {
							const newBoard: Board = {
								name: `Board ${localBoards.length + 1}`,
								index: localBoards.length + 1,
								columns: [],
							};
							setLocalBoards([...localBoards, newBoard]);
						}}>{t(59)}</button>

						<hr className="boardConfigModalHr-100" />
						
						<button className="boardConfigModalSidebarSaveBtn" onClick={handleSave}>{t(1)}</button>
					</div>
				</div>
				<DragDropContext onDragEnd={onDragEnd}>
					<div className="boardConfigModalMainContent">
						{selectedBoardIndex === -1
							? <div>{renderGlobalSettingsTab(selectedBoardIndex)}</div>
							: <div className="boardConfigModalMainContentBoardSettingTab">{renderBoardSettings(selectedBoardIndex)}</div>
						}
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
		this.root = ReactDOM.createRoot(contentEl);
		this.modalEl.setAttribute('data-type', 'task-board-view');
		contentEl.setAttribute('data-type', 'task-board-view');
	}

	onOpen() {
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
