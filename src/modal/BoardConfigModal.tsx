// /src/modal/BoardConfigModal.tsx

import { AddColumnModal, columnDataProp } from "src/modal/AddColumnModal";
import { Modal, Notice } from "obsidian";
import { Board, columnTypeAndNameMapping } from "src/interfaces/BoardConfigs";
import Sortable from "sortablejs";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { FaAlignJustify, FaTrash } from 'react-icons/fa';
import ReactDOM from "react-dom/client";
import { RxDragHandleDots2 } from "react-icons/rx";
import { SettingsManager } from "src/settings/TaskBoardSettingConstructUI";
import TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { ClosePopupConfrimationModal } from "./ClosePopupConfrimationModal";
import { UniversalDateOptions, universalDateOptionsNames } from "src/interfaces/GlobalSettings";
import { bugReporter } from "src/services/OpenModals";
import { MultiSuggest, getFileSuggestions, getTagSuggestions } from "src/services/MultiSuggest";
import { priorityOptions } from "src/interfaces/TaskItem";

interface ConfigModalProps {
	plugin: TaskBoard;
	settingManager: SettingsManager;
	boards: Board[];
	activeBoardIndex: number;
	onSave: (updatedBoards: Board[]) => void;
	onClose: () => void;
	setIsEdited: (value: boolean) => void;
}

const ConfigModalContent: React.FC<ConfigModalProps> = ({
	plugin,
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
			bugReporter(plugin, "Error parsing boards data", e as string, "BoardConfigModal.tsx/localBoards");
			return [];
		}
	});
	const [selectedBoardIndex, setSelectedBoardIndex] = useState<number>(activeBoardIndex);
	const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
	const [filtersData, setFiltersData] = useState<string>(localBoards[activeBoardIndex]?.filters?.join(", ") || "");

	const globalSettingsHTMLSection = useRef<HTMLDivElement>(null);
	const columnListRef = useRef<HTMLDivElement | null>(null);
	const boardListRef = useRef<HTMLDivElement | null>(null);

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

	// useEffect for board sorting
	useEffect(() => {
		if (!boardListRef.current) return;

		const sortableBoards = Sortable.create(boardListRef.current, {
			animation: 150,
			handle: ".boardConfigModalSidebarBtnArea-btn-drag-handle", // Define a drag handle class
			onEnd: (evt) => {
				if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) {
					return;
				}

				const currentBoards = [...localBoards];
				const [movedBoard] = currentBoards.splice(evt.oldIndex, 1);
				currentBoards.splice(evt.newIndex, 0, movedBoard);

				// Update board.index to be the new 0-based array index
				const finalBoards = currentBoards.map((board, idx) => ({
					...board,
					index: idx // 0-based index
				}));

				setLocalBoards(finalBoards);

				// Update selectedBoardIndex (which is a 0-based array index)
				if (selectedBoardIndex === evt.oldIndex) {
					setSelectedBoardIndex(evt.newIndex);
				} else {
					// Adjust selectedBoardIndex if an item moved across it
					if (evt.oldIndex < selectedBoardIndex && evt.newIndex >= selectedBoardIndex) {
						// Item moved from before selected to at or after selected: selected moves left
						setSelectedBoardIndex(prevIdx => prevIdx - 1);
					} else if (evt.oldIndex > selectedBoardIndex && evt.newIndex <= selectedBoardIndex) {
						// Item moved from after selected to at or before selected: selected moves right
						setSelectedBoardIndex(prevIdx => prevIdx + 1);
					}
				}
				setIsEdited(true);
			},
		});

		return () => {
			sortableBoards.destroy();
		};
	}, [localBoards, selectedBoardIndex]);

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
			id: columnData.id,
			index: updatedBoards[boardIndex].columns.length + 1,
			colType: columnData.colType,
			active: true,
			collapsed: false,
			name: columnData.name,
			coltag: columnData.coltag,
			datedBasedColumn: columnData.datedBasedColumn,
			taskStatus: columnData.taskStatus,
			taskPriority: columnData.taskPriority,
			limit: columnData.limit,
			filePaths: columnData.filePaths,
		});
		setLocalBoards(updatedBoards);
		handleCloseAddColumnModal();
		setIsEdited(true);
	};

	// Function to render the Add Column Modal
	const renderAddColumnModal = () => {
		if (!isAddColumnModalOpen) return null;
		// TODO : THis wont work if you havent assigned a very high z-index to this specific modal.
		const modal = new AddColumnModal(plugin.app, {
			app: plugin.app,
			onCancel: handleCloseAddColumnModal, // Previously onClose
			onSubmit: (columnData: columnDataProp) => handleAddColumn(selectedBoardIndex, columnData),
		});
		modal.open();
	};

	const handleAddNewBoard = async (oldBoards: Board[]) => {
		const newBoard: Board = {
			name: t("new-board"),
			index: localBoards.length,
			columns: [],
			hideEmptyColumns: false,
			filters: [],
			filterPolarity: "",
			filterScope: "",
			showColumnTags: true,
			showFilteredTags: true
		};
		setLocalBoards([...oldBoards, newBoard]);
		setSelectedBoardIndex(localBoards.length);
		setIsEdited(true);
	};

	const handleDeleteCurrentBoard = () => {
		const mssg = t("board-delete-confirmation-message")
		const deleteModal = new DeleteConfirmationModal(app, {
			app,
			mssg,
			onConfirm: () => {
				if (selectedBoardIndex !== -1) {
					const updatedBoards = [...localBoards];
					updatedBoards.splice(selectedBoardIndex, 1);
					// Update indexes of boards below the deleted one
					for (let i = selectedBoardIndex; i < updatedBoards.length; i++) {
						updatedBoards[i].index = i;
					}
					setLocalBoards(updatedBoards);
					setIsEdited(true);
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

	const toggleActiveState = (boardIndex: number, columnIndex: number) => {
		const updatedBoards = [...localBoards];
		const column = updatedBoards[boardIndex].columns[columnIndex];
		column.active = !column.active; // Toggle the active state
		setLocalBoards(updatedBoards); // Update the state
		// onSave(updatedBoards); // Save the updated state
	};

	// Function to save changes
	const handleSave = () => {
		onSave(localBoards);
		// onClose();
	};

	const renderGlobalSettingsTab = (boardIndex: number) => {
		return (
			<div className="pluginGlobalSettingsTab" ref={globalSettingsHTMLSection} />
		);
	}

	useEffect(() => {
		if (selectedBoardIndex !== -1) return;

		if (globalSettingsHTMLSection.current) {
			settingManager.cleanUp();
			globalSettingsHTMLSection.current.empty();
			// Render global settings
			settingManager.constructUI(globalSettingsHTMLSection.current, t("plugin-global-settings"));
		}
	}, [selectedBoardIndex]);

	const filePathInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
	useEffect(() => {
		localBoards[selectedBoardIndex]?.columns.forEach((column, index) => {
			const fileInputElement = filePathInputRefs.current[column.id];
			if (!fileInputElement) return;

			if (filePathInputRefs.current[column.id] !== null && column.colType === "pathFiltered") {
				const suggestionContent = getFileSuggestions(plugin.app);
				const onSelectCallback = (selectedPath: string) => {
					// setNewFilePath(selectedPath);
					handleColumnChange(selectedBoardIndex, index, "filePaths", selectedPath);
				};
				new MultiSuggest(fileInputElement, new Set(suggestionContent), onSelectCallback, plugin.app);
			} else if (filePathInputRefs.current[column.id] !== null && column.colType === "namedTag") {
				const suggestionContent = getTagSuggestions(plugin.app);
				const onSelectCallback = (selectedTag: string) => {
					handleColumnChange(selectedBoardIndex, index, "coltag", selectedTag);
				};
				new MultiSuggest(fileInputElement, new Set(suggestionContent), onSelectCallback, plugin.app);
			}
		});
	}, [plugin.app, selectedBoardIndex, localBoards]);

	// Function to handle column change
	const handleColumnChange = (
		boardIndex: number,
		columnIndex: number,
		field: string,
		value: any
	) => {
		// evt?.preventDefault();
		// evt?.stopPropagation();
		// console.log(`Updating column at boardIndex: ${boardIndex}, columnIndex: ${columnIndex}, field: ${field}, value:`, value);
		const updatedBoards = [...localBoards];
		if (field in updatedBoards[boardIndex].columns[columnIndex]) {
			(updatedBoards[boardIndex].columns[columnIndex] as any)[field] = value;
		}
		setLocalBoards(updatedBoards);
		setIsEdited(true);
	};

	// Function to handle board name change
	const handleBoardNameChange = (index: number, newName: string) => {
		const updatedBoards = [...localBoards];
		updatedBoards[index].name = newName;
		setLocalBoards(updatedBoards);
		setIsEdited(true);
	};

	const handleFiltersChange = (boardIndex: number, value: string) => {
		setFiltersData(value);
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

	type BooleanBoardProperties = 'showColumnTags' | 'showFilteredTags' | 'hideEmptyColumns';
	const handleToggleChange = (boardIndex: number, field: BooleanBoardProperties, value: boolean) => {
		const updatedBoards = [...localBoards];
		if (updatedBoards[boardIndex]) {
			updatedBoards[boardIndex][field] = value as boolean;
		}
		setLocalBoards(updatedBoards);
		setIsEdited(true);
	};

	// Function to delete a column from the selected board
	const handleDeleteColumnFromBoard = (boardIndex: number, columnIndex: number) => {
		const updatedBoards = [...localBoards];
		updatedBoards[boardIndex].columns.splice(columnIndex, 1);
		setLocalBoards(updatedBoards);
		setIsEdited(true);
	};

	useEffect(() => {
		if (
			selectedBoardIndex === -1 ||
			!columnListRef.current ||
			!localBoards[selectedBoardIndex]
		)
			return;

		setFiltersData(localBoards[selectedBoardIndex].filters?.join(", ") || "");

		const sortable = Sortable.create(columnListRef.current, {
			animation: 150,
			handle: ".boardConfigModalColumnRowDragButton",
			ghostClass: "task-board-sortable-ghost",
			chosenClass: "task-board-sortable-chosen",
			dragClass: "task-board-sortable-drag",
			dragoverBubble: true,
			forceFallback: true,
			fallbackClass: "task-board-sortable-fallback",
			easing: "cubic-bezier(1, 0, 0, 1)",
			onSort: (evt) => {
				try {
					if (evt.oldIndex === undefined || evt.newIndex === undefined) return;

					const updatedBoards = [...localBoards];
					const [movedItem] = updatedBoards[selectedBoardIndex].columns.splice(evt.oldIndex, 1);
					updatedBoards[selectedBoardIndex].columns.splice(evt.newIndex, 0, movedItem);
					updatedBoards[selectedBoardIndex].columns.forEach((col, idx) => {
						col.index = idx + 1;
					});

					setLocalBoards(updatedBoards);
					setIsEdited(true);

					// I need to re-render the columnListRef section here
					// if (columnListRef.current) {
					// 	// Force re-render by updating the ref
					// 	columnListRef.current.innerHTML = columnListRef.current.innerHTML;
					// }
				} catch (error) {
					bugReporter(plugin, "Error in Sortable onSort", error as string, "BoardConfigModal.tsx/onSort");
				}
			},
		});

		return () => {
			sortable.destroy();
		};
	}, [selectedBoardIndex, localBoards]);

	// Function to render board settings
	const renderBoardSettings = (boardIndex: number) => {
		if (globalSettingsHTMLSection.current) {
			settingManager.cleanUp();
			globalSettingsHTMLSection.current.empty();
		}

		const board = localBoards[boardIndex];

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

					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<div className="boardConfigModalSettingName">{t("automatically-hide-empty-columns")}</div>
							<div className="boardConfigModalSettingDescription">{t("automatically-hide-empty-columns-info")}</div>
						</div>
						<input
							type="checkbox"
							checked={board.hideEmptyColumns}
							onChange={(e) => handleToggleChange(boardIndex, "hideEmptyColumns", e.target.checked)}
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
							value={filtersData}
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
								<div key={column.id} className="boardConfigModalColumnRow">
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
										<button className="boardConfigModalColumnRowContentColumnType">{columnTypeAndNameMapping[column.colType]}</button>
										<input
											type="text"
											value={column.name || ""}
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
												ref={(el) => {
													filePathInputRefs.current[column.id] = el;
												}}
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
										{column.colType === "taskStatus" && (
											<input
												type="text"
												placeholder={t("enter-status-placeholder")}
												value={column.taskStatus || ""}
												onChange={(e) =>
													handleColumnChange(
														boardIndex,
														columnIndex,
														"taskStatus",
														e.target.value
													)
												}
												className="boardConfigModalColumnRowContentColName"
											/>
										)}
										{column.colType === "taskPriority" && (
											<select
												aria-label="Select priority"
												value={column.taskPriority || priorityOptions[0].value}
												onChange={(e) =>
													handleColumnChange(
														boardIndex,
														columnIndex,
														"taskPriority",
														e.target.value
													)
												}
												className="boardConfigModalColumnRowContentColDatedVal"
											>
												{priorityOptions.map((option) => (
													<option key={option.value} value={option.value}>{option.text}</option>
												))}
											</select>
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
										{column.colType === "pathFiltered" && (
											<input
												type="text"
												ref={(el) => {
													filePathInputRefs.current[column.id] = el;
												}}
												className="boardConfigModalColumnRowContentColName"
												value={column.filePaths || ""}
												onChange={(e) =>
													handleColumnChange(
														boardIndex,
														columnIndex,
														"filePaths",
														e.target.value
													)
												}
												placeholder={t("enter-path-pattern")}
											/>
										)}
										{column.colType === "dated" && (
											<>
												<input
													type="number"
													placeholder={t("from")}
													value={column.datedBasedColumn?.from || ""}
													onChange={(e) =>
														handleColumnChange(
															boardIndex,
															columnIndex,
															"datedBasedColumn",
															{
																...column.datedBasedColumn,
																from: Number(e.target.value),
															}
														)
													}
													className="boardConfigModalColumnRowContentColDatedVal"
												/>
												<input
													type="number"
													placeholder={t("to")}
													value={column.datedBasedColumn?.to || ""}
													onChange={(e) =>
														handleColumnChange(
															boardIndex,
															columnIndex,
															"datedBasedColumn",
															{
																...column.datedBasedColumn,
																to: Number(e.target.value),
															}
														)
													}
													className="boardConfigModalColumnRowContentColDatedVal"
												/>
												<select
													aria-label="Select date type"
													value={column.datedBasedColumn?.dateType || plugin.settings.data.globalSettings.universalDate || UniversalDateOptions.dueDate}
													onChange={(e) =>
														handleColumnChange(
															boardIndex,
															columnIndex,
															"datedBasedColumn",
															{
																...column.datedBasedColumn,
																dateType: e.target.value,
															}
														)
													}
													className="boardConfigModalColumnRowContentColDatedVal"
												>
													<option value={UniversalDateOptions.dueDate}>{universalDateOptionsNames.dueDate}</option>
													<option value={UniversalDateOptions.startDate}>{universalDateOptionsNames.startDate}</option>
													<option value={UniversalDateOptions.scheduledDate}>{universalDateOptionsNames.scheduledDate}</option>
												</select>
											</>
										)}
										{column.colType === "undated" && (
											<>
												<select
													aria-label="Select date type"
													value={column.datedBasedColumn?.dateType || plugin.settings.data.globalSettings.universalDate || UniversalDateOptions.dueDate}
													onChange={(e) =>
														handleColumnChange(
															boardIndex,
															columnIndex,
															"datedBasedColumn",
															{
																from: 0,
																to: 0,
																dateType: e.target.value,
															}
														)
													}
													className="boardConfigModalColumnRowContentColDatedVal"
												>
													<option value={UniversalDateOptions.dueDate}>{universalDateOptionsNames.dueDate}</option>
													<option value={UniversalDateOptions.startDate}>{universalDateOptionsNames.startDate}</option>
													<option value={UniversalDateOptions.scheduledDate}>{universalDateOptionsNames.scheduledDate}</option>
												</select>
											</>
										)}
										<FaTrash className="boardConfigModalColumnRowDeleteButton" size={13} enableBackground={0} opacity={0.7} onClick={() => handleDeleteColumnFromBoard(boardIndex, columnIndex)} title={t("delete-column")} />
									</div>
								</div>
							))}
						</div>
					</div>
					<button className="boardConfigModalAddColumnButton" onClick={handleOpenAddColumnModal}>{t("add-column")}</button>
				</div>
				<hr className="boardConfigModalHr-100" />

				<button className="boardConfigModalDeleteBoardBtn" onClick={handleDeleteCurrentBoard}>{t("delete-this-board")}</button>
			</div>
		);
	};

	// For Small Screens UI
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
		return () => {
			if (isSidebarVisible) {
				// Cleanup event listener when the component unmounts or sidebar visibility changes
				document.removeEventListener("mousedown", handleClickOutside);
			}
		}
	}, [isSidebarVisible]);

	return (
		<>
			{renderAddColumnModal()}
			<button className="boardConfigModalSidebarToggleBtn" onClick={toggleSidebar} aria-label="Toggle Sidebar">
				<FaAlignJustify className="boardConfigModalSidebarToggleBtnIcon" size={15} enableBackground={0} />
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
						<div ref={boardListRef} className="boardConfigModalSidebarBtnAreaBoardBtnsSection">
							{localBoards.map((board, index) => (
								<div
									key={board.name} // Changed key from index to board.name
									className={`boardConfigModalSidebarBtnArea-btn${index === selectedBoardIndex ? "-active" : ""}`}
									onClick={() => {
										setSelectedBoardIndex(index);
										toggleSidebar();
									}}
								>
									<span>
										{board.name}
									</span>
									<RxDragHandleDots2 className="boardConfigModalSidebarBtnArea-btn-drag-handle" size={15} /> {/* Add drag handle */}
								</div>
							))}
						</div>
					</div>
					<div className="boardConfigModalSidebarBtnArea">
						<button className="boardConfigModalSidebarBtnAreaAddBoard" onClick={() => handleAddNewBoard(localBoards)}>{t("add-board")}</button>

						<hr className="boardConfigModalHr-100" />

						{selectedBoardIndex !== -1 && (
							<button className="boardConfigModalSidebarSaveBtn" onClick={handleSave}>{t("save")}</button>
						)}
					</div>
				</div>
				<div className="boardConfigModalMainContent">
					{selectedBoardIndex === -1
						? <>{renderGlobalSettingsTab(selectedBoardIndex)}</>
						: <div className="boardConfigModalMainContentBoardSettingTab">{renderBoardSettings(selectedBoardIndex)}</div>
					}
				</div>
			</div>
			{selectedBoardIndex !== -1 && (
				<button className="boardConfigModalSaveBtn-mobile" onClick={handleSave}>{t("save")}</button>
			)}
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
	plugin: TaskBoard;

	constructor(
		plugin: TaskBoard,
		boards: Board[],
		activeBoardIndex: number,
		onSave: (updatedBoards: Board[]) => void
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.boards = boards;
		this.activeBoardIndex = activeBoardIndex;
		this.isEdited = false;
		this.onSave = onSave;
		this.settingsManager = new SettingsManager(plugin);
		const { contentEl } = this;
		this.root = ReactDOM.createRoot(contentEl);
		this.modalEl.setAttribute('data-type', 'task-board-view');
		contentEl.setAttribute('data-type', 'task-board-view');
		this.modalEl.setAttribute('modal-type', 'task-board-board-config');
	}

	onOpen() {
		this.root.render(
			<ConfigModalContent
				plugin={this.plugin}
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
