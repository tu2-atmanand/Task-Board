// /src/modal/BoardConfigModal.tsx - V2

import { AddColumnModal, columnDataProp } from "src/modal/AddColumnModal";
import { App, Modal, Notice } from "obsidian";
import { Board, ColumnData } from "src/interfaces/BoardConfigs";
import Sortable from "sortablejs";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import React, { ComponentPropsWithRef, useEffect, useRef, useState } from "react";

import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { FaTrash } from 'react-icons/fa';
import ReactDOM from "react-dom/client";
import { RxDragHandleDots2 } from "react-icons/rx";
import { SettingsManager } from "src/settings/TaskBoardSettingConstructUI";
import TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { ClosePopupConfrimationModal } from "./ClosePopupConfrimationModal";

interface ConfigModalProps {
	app: App;
	settingManager: SettingsManager;
	boards: Board[];
	activeBoardIndex: number;
	onSave: (updatedBoards: Board[]) => void;
	onClose: () => void;
	setIsEdited: (value: boolean) => void;
}

const ConfigModalContent: React.FC<ConfigModalProps> = ({
	app,
	settingManager,
	boards,
	activeBoardIndex,
	onSave,
	onClose,
	setIsEdited,
}) => {
	const [localBoards, setLocalBoards] = useState<Board[]>(() => {
		try {
			return boards ? JSON.parse(JSON.stringify(boards)) : [];
		} catch (e) {
			console.error("Failed to parse boards:", e);
			return [];
		}
	});
	const [selectedBoardIndex, setSelectedBoardIndex] = useState<number>(activeBoardIndex);
	const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);

	const columnListRef = useRef<HTMLDivElement | null>(null);
	let globalSettingsHTMLSection = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (
			selectedBoardIndex === -1 ||
			!columnListRef.current ||
			!localBoards[selectedBoardIndex]
		)
			return;

		const sortable = Sortable.create(columnListRef.current, {
			animation: 150,
			handle: ".boardConfigModalColumnRowDragButton",
			onEnd: (evt) => {
				if (evt.oldIndex === undefined || evt.newIndex === undefined) return;

				const updatedBoards = [...localBoards];
				// const columns = updatedBoards[selectedBoardIndex].columns;
				const [movedItem] = updatedBoards[selectedBoardIndex].columns.splice(evt.oldIndex, 1);
				updatedBoards[selectedBoardIndex].columns.splice(evt.newIndex, 0, movedItem);
				updatedBoards[selectedBoardIndex].columns.forEach((col, idx) => (col.index = idx + 1));

				setLocalBoards(updatedBoards);
				setIsEdited(true);
			},
		});

		return () => {
			sortable.destroy();
		};
	}, [selectedBoardIndex, localBoards]);


	// Function to handle board name change
	const handleBoardNameChange = (index: number, newName: string) => {
		const updatedBoards = [...localBoards];
		updatedBoards[index].name = newName;
		setLocalBoards(updatedBoards);
		setIsEdited(true);
	};

	// Function to handle column change
	const handleColumnChange = (
		boardIndex: number,
		columnIndex: number,
		field: string,
		value: any
	) => {
		const updatedBoards = [...localBoards];
		if (field in updatedBoards[boardIndex].columns[columnIndex]) {
			(updatedBoards[boardIndex].columns[columnIndex] as any)[field] = value;
		}
		setLocalBoards(updatedBoards);
		setIsEdited(true);
	};

	const handleFiltersChange = (boardIndex: number, value: string) => {
		const updatedBoards = [...localBoards];
		// Split input string by commas and trim spaces to create an array
		updatedBoards[boardIndex].filters = value.split(",").map(tag => tag.trim());
		setLocalBoards(updatedBoards);
		setIsEdited(true);
	};

	const handleFilterPolarityChange = (boardIndex: number, value: string) => {
		const updatedBoards = [...localBoards];
		updatedBoards[boardIndex].filterPolarity = value;
		setLocalBoards(updatedBoards);
		setIsEdited(true);
	};

	type BooleanBoardProperties = 'showColumnTags' | 'showFilteredTags';
	const handleToggleChange = (boardIndex: number, field: BooleanBoardProperties, value: boolean) => {
		const updatedBoards = [...localBoards];
		if (updatedBoards[boardIndex]) {
			updatedBoards[boardIndex][field] = value as boolean;
		}
		setLocalBoards(updatedBoards);
		setIsEdited(true);
	};

	// Function to add a new column to the selected board
	const handleOpenAddColumnModal = () => {
		setIsAddColumnModalOpen(true);
		// renderAddColumnModal();
	};

	const handleCloseAddColumnModal = () => {
		setIsAddColumnModalOpen(false);
	};

	const handleAddColumn = (boardIndex: number, columnData: columnDataProp) => {
		const updatedBoards = [...localBoards];
		updatedBoards[boardIndex].columns.push({
			colType: columnData.colType,
			active: true,
			collapsed: false,
			name: columnData.name,
			index: updatedBoards[boardIndex].columns.length + 1,
			coltag: columnData.coltag,
			range: columnData.range,
			limit: columnData.limit,
		});
		setLocalBoards(updatedBoards);
		handleCloseAddColumnModal();
		setIsEdited(true);
	};

	// Function to render the Add Column Modal
	const renderAddColumnModal = () => {
		if (!isAddColumnModalOpen) return null;
		// TODO : THis wont work if you havent assigned a very high z-index to this specific modal.
		const modal = new AddColumnModal(app, {
			app,
			onCancel: handleCloseAddColumnModal, // Previously onClose
			onSubmit: (columnData: columnDataProp) => handleAddColumn(selectedBoardIndex, columnData),
		});
		modal.open();
	};

	// Function to delete a column from the selected board
	const deleteColumnFromBoard = (boardIndex: number, columnIndex: number) => {
		const updatedBoards = [...localBoards];
		updatedBoards[boardIndex].columns.splice(columnIndex, 1);
		setLocalBoards(updatedBoards);
		setIsEdited(true);
	};

	const handleAddNewBoard = async (oldBoards: Board[]) => {
		const newBoard: Board = {
			name: t("new-board"),
			index: localBoards.length + 1,
			columns: [],
		};
		console.log("Old Boards: ", localBoards);
		setLocalBoards([...oldBoards, newBoard]);
		setSelectedBoardIndex(localBoards.length);
		setIsEdited(true);
	};

	const deleteCurrentBoard = () => {
		const mssg = t("board-delete-confirmation-message")
		const deleteModal = new DeleteConfirmationModal(app, {
			app,
			mssg,
			onConfirm: () => {
				if (selectedBoardIndex !== -1) {
					const updatedBoards = [...localBoards];
					updatedBoards.splice(selectedBoardIndex, 1);
					setLocalBoards(updatedBoards);
					setIsEdited(true);
					console.log("Board Deleted. New Boards: ", updatedBoards);
					if (updatedBoards.length === 0) {
						handleAddNewBoard(updatedBoards);
						setSelectedBoardIndex(0);
					} else if (selectedBoardIndex !== 0) {
						setSelectedBoardIndex(selectedBoardIndex - 1);
					}
				} else {
					new Notice(t("no-board-selected-to-delete"));
				}
			},
			onCancel: () => {
				// console.log("Board Deletion Operation Cancelled.");
			},
		});
		deleteModal.open();
	};

	// Function to save changes
	const handleSave = () => {
		onSave(localBoards);
		// onClose();
	};

	const toggleActiveState = (boardIndex: number, columnIndex: number) => {
		const updatedBoards = [...localBoards];
		const column = updatedBoards[boardIndex].columns[columnIndex];
		column.active = !column.active; // Toggle the active state
		setLocalBoards(updatedBoards); // Update the state
		// onSave(updatedBoards); // Save the updated state
	};

	useEffect(() => {
		// if (selectedBoardIndex !== -1) return;

		console.log("Selected Board Index: ", selectedBoardIndex);
		if (globalSettingsHTMLSection.current) {
			console.log("Cleaning up global settings section");
			settingManager.cleanUp();
			globalSettingsHTMLSection.current.empty();
			// Render global settings
			settingManager.constructUI(globalSettingsHTMLSection.current, t("plugin-global-settings"));
		}
	}, [selectedBoardIndex]);

	const renderGlobalSettingsTab = (boardIndex: number) => {
		console.log("Rendering global settings");

		// console.log("Selected Board Index: ", selectedBoardIndex);
		// if (globalSettingsHTMLSection.current) {
		// 	console.log("Cleaning up global settings section");
		// 	// Render global settings
		// 	settingManager.constructUI(globalSettingsHTMLSection.current, t("plugin-global-settings"));
		// }
		return (
			<div className="pluginGlobalSettingsTab" ref={globalSettingsHTMLSection} />
		);
		// return (
		// 	<div>This is a test</div>
		// );
	}

	// Function to render board settings
	const renderBoardSettings = (boardIndex: number) => {
		if (globalSettingsHTMLSection.current) {
			settingManager.cleanUp();
			globalSettingsHTMLSection.current.empty();
		}

		const board = localBoards[boardIndex];

		// useEffect(() => {
		// 	if (!columnListRef.current) return;

		// 	const sortable = Sortable.create(columnListRef.current, {
		// 		animation: 150,
		// 		handle: ".boardConfigModalColumnRowDragButton",
		// 		onEnd: (evt) => {
		// 			if (evt.oldIndex === undefined || evt.newIndex === undefined) return;

		// 			const updatedBoards = [...localBoards];
		// 			// const columns = updatedBoards[selectedBoardIndex].columns;
		// 			const [movedItem] = updatedBoards[selectedBoardIndex].columns.splice(evt.oldIndex, 1);
		// 			updatedBoards[selectedBoardIndex].columns.splice(evt.newIndex, 0, movedItem);

		// 			updatedBoards[selectedBoardIndex].columns.forEach((col, idx) => (col.index = idx + 1));

		// 			setLocalBoards(updatedBoards);
		// 			setIsEdited(true);
		// 		},
		// 	});

		// 	return () => {
		// 		sortable.destroy();
		// 	};
		// }, [selectedBoardIndex, localBoards]);

		return (
			<div className="boardConfigModalMainContent-Active">
				<h2 className="boardConfigModalMainContent-Active-Heading">{board.name} {t("configurations")}</h2>
				<hr className="boardConfigModalHr-50" />
				<div className="boardConfigModalMainContent-Active-Body">
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<div className="boardConfigModalSettingName">{t("board-name")}</div>
							<div className="boardConfigModalSettingDescription">{t("board-name-info")}</div>
						</div>
						<input
							type="text"
							value={board.name}
							onChange={(e) => handleBoardNameChange(boardIndex, e.target.value)}
						/>
					</div>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<div className="boardConfigModalSettingName">{t("show-tags-in-the-columns-of-type-tagged")}</div>
							<div className="boardConfigModalSettingDescription">{t("show-tags-in-the-columns-of-type-tagged-info")}</div>
						</div>
						<input
							type="checkbox"
							checked={board.showColumnTags}
							onChange={(e) => handleToggleChange(boardIndex, "showColumnTags", e.target.checked)}
						/>
					</div>

					<hr className="boardConfigModalHr-100" />

					<h3>{t("board-filters")}</h3>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<div className="boardConfigModalSettingName">{t("filter-tags")}</div>
							<div className="boardConfigModalSettingDescription">{t("filter-tags-setting-info")}</div>

						</div>
						<input
							type="text"
							placeholder={t("filter-tags-input-placeholder")}
							value={board.filters?.join(", ")}
							onChange={(e) => handleFiltersChange(boardIndex, e.target.value)}
						/>
					</div>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<div className="boardConfigModalSettingName">{t("filter-polarity")}</div>
							<div className="boardConfigModalSettingDescription">{t("filter-polarity-info")}</div>
						</div>
						<select
							value={board.filterPolarity}
							onChange={(e) => handleFilterPolarityChange(boardIndex, e.target.value)}
						>
							<option value="1">{t("activate")}</option>
							<option value="0">{t("deactivate")}</option>
						</select>
					</div>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<div className="boardConfigModalSettingName">{t("show-filtered-tags")}</div>
							<div className="boardConfigModalSettingDescription">{t("show-filtered-tags-info")}</div>
						</div>
						<input
							type="checkbox"
							checked={board.showFilteredTags}
							onChange={(e) => handleToggleChange(boardIndex, "showFilteredTags", e.target.checked)}
						/>
					</div>

					<hr className="boardConfigModalHr-100" />
					<div className="boardConfigModalMainContent-Active-BodyColumnSec">
						<h3>{t("columns")}</h3>
						<div
							ref={columnListRef}
							className="boardConfigModalMainContent-Active-BodyColumnsList"
						>
							{board.columns.map((column, columnIndex) => (
								<div key={Math.random()} className="boardConfigModalColumnRow">
									<RxDragHandleDots2 className="boardConfigModalColumnRowDragButton" size={15} enableBackground={0} />
									{column.active ? (
										<EyeIcon
											onClick={() => toggleActiveState(boardIndex, columnIndex)}
											className="boardConfigModalColumnRowEyeButton"
										/>
									) : (
										<EyeOffIcon
											onClick={() => toggleActiveState(boardIndex, columnIndex)}
											className="boardConfigModalColumnRowEyeButton"
										/>
									)}
									<div className="boardConfigModalColumnRowContent">
										<button className="boardConfigModalColumnRowContentColumnType">{column.colType}</button>
										<input
											type="text"
											value={column.name}
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
												placeholder={t("enter-tag")}
												value={column.coltag || ""}
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
												placeholder={t("max-items")}
												value={column.limit || ""}
												onChange={(e) =>
													handleColumnChange(
														boardIndex,
														columnIndex,
														"limit",
														Number(e.target.value)
													)
												}
												className="boardConfigModalColumnRowContentColDatedVal"
											/>
										)}
										{column.colType === "dated" && (
											<>
												<input
													type="number"
													placeholder={t("from")}
													value={column.range?.rangedata.from || ""}
													onChange={(e) =>
														handleColumnChange(
															boardIndex,
															columnIndex,
															"range",
															{
																...column.range,
																rangedata: {
																	...column.range?.rangedata,
																	from: Number(e.target.value),
																},
															}
														)
													}
													className="boardConfigModalColumnRowContentColDatedVal"
												/>
												<input
													type="number"
													placeholder={t("to")}
													value={column.range?.rangedata.to || ""}
													onChange={(e) =>
														handleColumnChange(
															boardIndex,
															columnIndex,
															"range",
															{
																...column.range,
																rangedata: {
																	...column.range?.rangedata,
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
									<FaTrash className="boardConfigModalColumnRowDeleteButton" size={13} enableBackground={0} opacity={0.7} onClick={() => deleteColumnFromBoard(boardIndex, columnIndex)} title={t("delete-column")} />
								</div>
							))}
						</div>
					</div>
					<button className="boardConfigModalAddColumnButton" onClick={handleOpenAddColumnModal}>{t("add-column")}</button>
				</div>
				<hr className="boardConfigModalHr-100" />

				<button className="boardConfigModalDeleteBoardBtn" onClick={deleteCurrentBoard}>{t("delete-this-board")}</button>
			</div>
		);
	};


	const [isSidebarVisible, setIsSidebarVisible] = useState(false);
	const sidebarRef = useRef<HTMLDivElement>(null);

	const toggleSidebar = () => setIsSidebarVisible(!isSidebarVisible);

	const handleClickOutside = (event: MouseEvent) => {
		if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
			setIsSidebarVisible(false);
		}
	};

	useEffect(() => {
		if (isSidebarVisible) {
			document.addEventListener("mousedown", handleClickOutside);
		} else {
			document.removeEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isSidebarVisible]);

	return (
		<>
			{renderAddColumnModal()}
			<button className="boardConfigModalSidebarToggleBtn" onClick={toggleSidebar} aria-label="Toggle Sidebar">
				☰ {/* Replace with an icon later */}
			</button>
			<div className="boardConfigModalHome">
				<div ref={sidebarRef} className={`boardConfigModalSidebar ${isSidebarVisible ? "visible" : ""}`}>
					<div className="boardConfigModalSidebarBtnArea" >
						<div className="boardConfigModalSidebarBtnAreaGlobal" onClick={() => {
							setSelectedBoardIndex(-1);
							toggleSidebar();
						}}>{t("global-settings")}</div>

						<hr className="boardConfigModalHr-100" />

						<div className="boardConfigModalSettingDescription">{t("your-boards")}</div>
						{localBoards.map((board, index) => (
							<div
								key={index}
								onClick={() => {
									setSelectedBoardIndex(index);
									toggleSidebar();

								}}
								className={`boardConfigModalSidebarBtnArea-btn${index === selectedBoardIndex ? "-active" : ""}`}
							>
								{board.name}
							</div>
						))}
					</div>
					<div className="boardConfigModalSidebarBtnArea">
						<button className="boardConfigModalSidebarBtnAreaAddBoard" onClick={() => handleAddNewBoard(localBoards)}>{t("add-board")}</button>

						<hr className="boardConfigModalHr-100" />

						<button className="boardConfigModalSidebarSaveBtn" onClick={handleSave}>{t("save")}</button>
					</div>
				</div>
				<div className="boardConfigModalMainContent">
					{selectedBoardIndex === -1
						? renderGlobalSettingsTab(selectedBoardIndex)
						: <div className="boardConfigModalMainContentBoardSettingTab">{renderBoardSettings(selectedBoardIndex)}</div>
					}
				</div>
			</div>
			<button className="boardConfigModalSaveBtn-mobile" onClick={handleSave}>{t("save")}</button>
		</>
	);
};

// BoardConfigureModal class for modal behavior
export class BoardConfigureModal extends Modal {
	root: ReactDOM.Root;
	settingsManager: SettingsManager;
	boards: Board[];
	activeBoardIndex: number;
	isEdited: boolean;
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
		this.isEdited = false;
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
				onSave={(updatedBoards: Board[]) => {
					this.isEdited = false;
					this.onSave(updatedBoards);
					this.close();
				}}
				onClose={() => this.close()}
				setIsEdited={(value: boolean) => this.isEdited = value}
			/>
		);
	}

	handleCloseAttempt() {
		// Open confirmation modal
		const mssg = t("edit-task-modal-close-confirm-mssg");
		const closeConfirmModal = new ClosePopupConfrimationModal(this.app, {
			app: this.app,
			mssg,
			onDiscard: () => {
				this.isEdited = false;
				this.close();
			},
			onGoBack: () => {
				// Do nothing
			}
		});
		closeConfirmModal.open();
	}

	handleSave() {
		// Trigger save functionality if required before closing
		this.onSave(this.boards);
		this.isEdited = false;
		this.close();
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

	public close(): void {
		if (this.isEdited) {
			this.handleCloseAttempt();
		} else {
			this.onClose();
			super.close();
		}
	}

}
