// /src/modal/BoardConfigModal.tsx

import { Modal, Notice } from "obsidian";
import Sortable from "sortablejs";
import { BrickWall, EyeIcon, EyeOffIcon, Network, SquareKanban } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { FaAlignJustify, FaTrash } from 'react-icons/fa';
import ReactDOM from "react-dom/client";
import { RxDragHandleDots2, RxDragHandleHorizontal } from "react-icons/rx";
import { SettingsManager } from "src/settings/SettingConstructUI";
import TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { ClosePopupConfrimationModal } from "./ClosePopupConfrimationModal";
import { MultiSuggest, getFileSuggestions, getTagSuggestions } from "src/services/MultiSuggest";
import { colTypeNames, UniversalDateOptions, viewTypeNames } from "src/interfaces/Enums";
import { Board, ColumnData, swimlaneConfigs, View } from "src/interfaces/BoardConfigs";
import { columnTypeAndNameMapping, getPriorityOptionsForDropdown } from "src/interfaces/Mapping";
import { AddColumnModal } from "./AddColumnModal";
import { AddViewModal } from "./AddViewModal";
import { SwimlanesConfigModal } from "./SwimlanesConfigModal";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";
import { generateRandomTempTaskId } from "src/utils/TaskItemUtils";

interface ConfigModalProps {
	plugin: TaskBoard;
	settingManager: SettingsManager;
	currentBoardData: Board;
	currentViewIndex: number;
	onSave: (updatedBoard: Board) => void;
	onClose: () => void;
	setIsEdited: (value: boolean) => void;
}

const ConfigModalContent: React.FC<ConfigModalProps> = ({
	plugin,
	settingManager,
	currentBoardData,
	currentViewIndex,
	onSave,
	onClose,
	setIsEdited,
}) => {
	const [allViewsData, setAllViewsData] = useState<View[]>(() => {
		try {
			return currentBoardData.views ? JSON.parse(JSON.stringify(currentBoardData.views)) : [];
		} catch (e) {
			bugReporterManagerInsatance.showNotice(34, "Error parsing boards data", e as string, "BoardConfigModal.tsx/allViewsData");
			return [];
		}
	});
	const [selectedViewIndex, setSelectedViewIndex] = useState<number>(currentViewIndex);
	const [activeBoardData, setActiveBoardData] = useState<Board>(currentBoardData);
	const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);

	const globalSettingsHTMLSection = useRef<HTMLDivElement>(null);
	const columnListRef = useRef<HTMLDivElement | null>(null);
	const boardListRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (
			selectedViewIndex === -1 ||
			!columnListRef.current ||
			!allViewsData[selectedViewIndex] ||
			allViewsData[selectedViewIndex].viewType !== viewTypeNames.kanban
		)
			return;

		const sortable = Sortable.create(columnListRef.current, {
			animation: 150,
			handle: ".boardConfigModalColumnRowDragButton",
			onEnd: (evt) => {
				if (evt.oldIndex === undefined || evt.newIndex === undefined) return;

				const updatedViewsData = [...allViewsData];
				// const columns = updatedViewsData[selectedViewIndex].kanbanView!.columns;
				const [movedItem] = updatedViewsData[selectedViewIndex].kanbanView!.columns.splice(evt.oldIndex, 1);
				updatedViewsData[selectedViewIndex].kanbanView!.columns.splice(evt.newIndex, 0, movedItem);
				updatedViewsData[selectedViewIndex].kanbanView!.columns.forEach((col, idx) => (col.index = idx + 1));

				setAllViewsData(updatedViewsData);
				setIsEdited(true);
			},
		});

		return () => {
			sortable.destroy();
		};
	}, [selectedViewIndex, allViewsData]);

	// useEffect for view order sorting
	useEffect(() => {
		if (!boardListRef.current) return;

		const sortableBoards = Sortable.create(boardListRef.current, {
			animation: 150,
			handle: ".boardConfigModalSidebarBtnArea-btn-drag-handle", // Define a drag handle class
			onEnd: (evt) => {
				if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) {
					return;
				}

				// Reorder the views inside the allViewsData state based on the new order after drag-and-drop
				const updatedViewsData = [...allViewsData];
				const [movedBoard] = updatedViewsData.splice(evt.oldIndex, 1);
				updatedViewsData.splice(evt.newIndex, 0, movedBoard);

				setAllViewsData(updatedViewsData);
				setIsEdited(true);
			},
		});

		return () => {
			sortableBoards.destroy();
		};
	}, [allViewsData, selectedViewIndex]);

	// --------------------------------------------------------------
	// ALL EVENT HANDLING LOGIC BELOW
	// --------------------------------------------------------------

	// Kanban Column - Function to handle opening a modal for adding a new column
	const handleOpenAddColumnModal = () => {
		setIsAddColumnModalOpen(true);
		// renderAddColumnModal();
	};

	// Kanban Column - Function to handle closing the add column modal
	const handleCloseAddColumnModal = () => {
		setIsAddColumnModalOpen(false);
	};

	// Kanban Column - Function to handle adding a new column to the selected Kanban specific view using the data submitted from the add column modal
	const handleAddColumn = (viewIndex: number, columnData: ColumnData) => {
		const updatedViewsData = [...allViewsData];
		updatedViewsData[viewIndex].kanbanView!.columns.push({
			id: columnData.id,
			index: updatedViewsData[viewIndex].kanbanView!.columns.length + 1,
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
		setAllViewsData(updatedViewsData);
		handleCloseAddColumnModal();
		setIsEdited(true);
	};

	// Kanban Column - UseEffect to initialize the MultiSuggest component for file path inputs in column configuration when the add/edit column modal is opened
	const filePathInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
	useEffect(() => {
		const view = allViewsData[selectedViewIndex];
		if (!view || view.viewType !== viewTypeNames.kanban) return;

		view.kanbanView?.columns.forEach((column, index) => {
			const fileInputElement = filePathInputRefs.current[column.id];
			if (!fileInputElement) return;

			if (filePathInputRefs.current[column.id] !== null && column.colType === colTypeNames.pathFiltered) {
				const suggestionContent = getFileSuggestions(plugin.app);
				const onSelectCallback = (selectedPath: string) => {
					// setNewFilePath(selectedPath);
					handleColumnChange(selectedViewIndex, index, "filePaths", selectedPath);
				};
				new MultiSuggest(fileInputElement, new Set(suggestionContent), onSelectCallback, plugin.app);
			} else if (filePathInputRefs.current[column.id] !== null && column.colType === colTypeNames.namedTag) {
				const suggestionContent = getTagSuggestions(plugin.app);
				const onSelectCallback = (selectedTag: string) => {
					handleColumnChange(selectedViewIndex, index, "coltag", selectedTag);
				};
				new MultiSuggest(fileInputElement, new Set(suggestionContent), onSelectCallback, plugin.app);
			}
		});
	}, [plugin.app, selectedViewIndex, allViewsData]);

	// Kanban Column - UseEffect to handle column reordering using SortableJS whenever the selected view or its columns change
	useEffect(() => {
		if (
			selectedViewIndex === -1 ||
			!columnListRef.current ||
			!allViewsData[selectedViewIndex] ||
			allViewsData[selectedViewIndex].viewType !== viewTypeNames.kanban
		)
			return;

		const sortable = Sortable.create(columnListRef.current, {
			animation: 150,
			handle: ".boardConfigModalColumnRowDragButton",
			ghostClass: "task-view-sortable-ghost",
			chosenClass: "task-view-sortable-chosen",
			dragClass: "task-view-sortable-drag",
			dragoverBubble: true,
			forceFallback: true,
			fallbackClass: "task-view-sortable-fallback",
			easing: "cubic-bezier(1, 0, 0, 1)",
			onSort: (evt) => {
				try {
					if (evt.oldIndex === undefined || evt.newIndex === undefined) return;

					const updatedViewsData = [...allViewsData];
					const [movedItem] = updatedViewsData[selectedViewIndex].kanbanView!.columns.splice(evt.oldIndex, 1);
					updatedViewsData[selectedViewIndex].kanbanView!.columns.splice(evt.newIndex, 0, movedItem);
					updatedViewsData[selectedViewIndex].kanbanView!.columns.forEach((col, idx) => {
						col.index = idx + 1;
					});

					setAllViewsData(updatedViewsData);
					setIsEdited(true);

					// I need to re-render the columnListRef section here
					// if (columnListRef.current) {
					// 	// Force re-render by updating the ref
					// 	columnListRef.current.innerHTML = columnListRef.current.innerHTML;
					// }
				} catch (error) {
					bugReporterManagerInsatance.showNotice(36, "Error in Sortable onSort", error as string, "BoardConfigModal.tsx/onSort");
				}
			},
		});

		return () => {
			sortable.destroy();
		};
	}, [selectedViewIndex, allViewsData]);

	// Kanban Column - Function to handle any property change for a specific column in the selected Kanban specific view. This is a generic function that can be used for changing any property of a column by passing the appropriate field and value.
	const handleColumnChange = (
		viewIndex: number,
		columnIndex: number,
		field: string,
		value: any
	) => {
		// evt?.preventDefault();
		// evt?.stopPropagation();
		// console.log(`Updating column at viewIndex: ${viewIndex}, columnIndex: ${columnIndex}, field: ${field}, value:`, value);
		const updatedViewsData = [...allViewsData];
		(updatedViewsData[viewIndex].kanbanView!.columns[columnIndex] as any)[field] = value;

		setAllViewsData(updatedViewsData);
		setIsEdited(true);
	};

	// Kanban Column - Function to handle toggling the visibility of a column in the selected Kanban specific view by toggling its "active" property
	const toggleActiveState = (viewIndex: number, columnIndex: number) => {
		const updatedViewsData = [...allViewsData];
		const column = updatedViewsData[viewIndex].kanbanView!.columns[columnIndex];
		column.active = !column.active; // Toggle the active state
		setAllViewsData(updatedViewsData); // Update the state
		setIsEdited(true);
	};

	// Kanban Column - Function to handle deleting a column from the selected Kanban specific view after confirming the action in a confirmation modal
	const handleDeleteColumnFromBoard = (viewIndex: number, columnIndex: number) => {
		const app = plugin.app;
		const mssg = t("column-delete-confirmation-message") + allViewsData[viewIndex].kanbanView!.columns[columnIndex].name;

		const deleteModal = new DeleteConfirmationModal(app, {
			app,
			mssg,
			onConfirm: () => {
				if (columnIndex !== -1) {
					const updatedViewsData = [...allViewsData];
					updatedViewsData[viewIndex].kanbanView!.columns.splice(columnIndex, 1);
					setAllViewsData(updatedViewsData);
					setIsEdited(true);
				} else {
					bugReporterManagerInsatance.showNotice(35, "There was an error while trying to delete the column. The column index was -1 for some reason.", `RROR : Column index is -1\nColumn name :${allViewsData[viewIndex].kanbanView!.columns[columnIndex].name}`, "BoardConfigModal.tsx/handleDeleteColumnFromBoard");
				}
			},
			onCancel: () => {
				// console.log("Board Deletion Operation Cancelled.");
			},
		});
		deleteModal.open();
	};

	// Kanban Swimlanes - Function to handle opening the swimlane configuration modal for the selected Kanban specific view and passing the current swimlane configuration to the modal
	const handleSwimlanesConfigureBtnClick = () => {
		if (selectedViewIndex === -1) {
			new Notice(t("no-view-selected"));
			return;
		}

		const view = allViewsData[selectedViewIndex];
		const currentSwimlaneConfig = view.kanbanView!.swimlanes || {
			enabled: false,
			hideEmptySwimlanes: false,
			property: 'tags',
			customValue: '',
			sortCriteria: 'asc',
			customSortOrder: [],
			minimized: false,
			maxHeight: '300px',
		};

		const swimlaneModal = new SwimlanesConfigModal(
			plugin.app,
			currentSwimlaneConfig,
			(updatedConfig: swimlaneConfigs) => {
				const updatedViewsData = [...allViewsData];
				updatedViewsData[selectedViewIndex].kanbanView!.swimlanes = updatedConfig;
				setAllViewsData(updatedViewsData);
				setIsEdited(true);
			}
		);

		swimlaneModal.open();
	};

	// View Management - Function to handle duplicating the currently selected view in the board configuration modal by creating a copy of the view data with a new name and adding it to the list of views in the state
	const handleDuplicateCurrentView = async () => {
		if (selectedViewIndex === -1) {
			new Notice(t("no-view-selected-to-duplicate"));
			return;
		}
		const viewToDuplicate = allViewsData[selectedViewIndex];
		const duplicatedView: View = {
			...JSON.parse(JSON.stringify(viewToDuplicate)), // Deep copy
			viewId: generateRandomTempTaskId(),
			viewName: `${viewToDuplicate.viewName} ${t("copy-suffix")}`,
		};

		// Regenerate IDs for all columns to ensure uniqueness
		if (duplicatedView?.kanbanView && duplicatedView.kanbanView!.columns && duplicatedView.kanbanView!.columns.length > 0) {
			duplicatedView.kanbanView!.columns = duplicatedView.kanbanView!.columns.map((column) => ({
				...column,
				id: Number(generateRandomTempTaskId()), // Generate new numeric ID for each column
			}));
		}

		const updatedViewsData = [...allViewsData, duplicatedView];
		setAllViewsData(updatedViewsData);
		setSelectedViewIndex(updatedViewsData.length - 1);
		setIsEdited(true);
	}

	// View Management - Function to handle opening the add view modal when the "Add View" button is clicked in the sidebar of the board configuration modal
	const handleAddNewView = () => {
		const app = plugin.app;
		const modal = new AddViewModal(
			app,
			currentBoardData,
			{
				onCancel: () => {
					// Do nothing on cancel
				},
				onSubmit: (updatedBoardData: Board) => {
					setActiveBoardData(updatedBoardData);
					setAllViewsData(updatedBoardData.views || []);
					setSelectedViewIndex(updatedBoardData.views ? updatedBoardData.views.length - 1 : -1);
					setIsEdited(true);
				},
			}
		);
		modal.open();
	};

	// View Management - Function to handle deleting the currently selected view from the board configuration after confirming the action in a confirmation modal
	const handleDeleteCurrentView = () => {
		const app = plugin.app;
		const mssg = t("view-delete-confirmation-message");
		const deleteModal = new DeleteConfirmationModal(app, {
			app,
			mssg,
			onConfirm: () => {
				new Notice('NOT IMPLEMENTED');

				if (selectedViewIndex !== -1) {
					const updatedViewsData = [...allViewsData];
					updatedViewsData.splice(selectedViewIndex, 1);
					setAllViewsData(updatedViewsData);
					setIsEdited(true);
					// if (updatedViewsData.length === 0) {
					// 	handleAddNewBoard(updatedViewsData);
					// 	setSelectedViewIndex(0);
					// } else if (selectedViewIndex !== 0) {
					// 	setSelectedViewIndex(selectedViewIndex - 1);
					// }
				} else {
					new Notice(t("no-view-selected-to-delete"));
				}
			},
			onCancel: () => {
				// console.log("Board Deletion Operation Cancelled.");
			},
		});
		deleteModal.open();
	};

	// Board Management - Function to handle changing the name of the active view.
	const handleViewNameChange = (index: number, newName: string) => {
		const updatedViewsData = [...allViewsData];
		updatedViewsData[index].viewName = newName;
		setAllViewsData(updatedViewsData);
		setIsEdited(true);
	};

	// Board Management - Function to handle changing the description of the active view.
	const handleBoardDescriptionChange = (index: number, description: string) => {
		const updatedViewsData = [...allViewsData];
		updatedViewsData[index].description = description;
		setAllViewsData(updatedViewsData);
		setIsEdited(true);
	};

	// Board Management - Function to handle duplicating the currently active board by creating a copy of the board data with a new name and adding it to the file system. After duplication, the new board is opened in a new view.
	const handleDuplicateCurrentBoard = () => {
		const duplicatedBoard: Board = {
			...JSON.parse(JSON.stringify(activeBoardData)), // Deep copy
			id: generateRandomTempTaskId(),
			name: `${activeBoardData.name} ${t("copy-suffix")}`,
			views: activeBoardData.views ? activeBoardData.views.map((view: View) => ({
				...view,
				viewId: generateRandomTempTaskId(), // New unique ID for each view
			})) : [],
		};

		onClose();
	};

	// Toggle Settings - Function to handle toggling any boolean setting for the board or for a specific view by passing the appropriate field and value to the generic toggle functions defined below
	type BooleanBoardProperties = 'showFilteredTags';
	type BooleanKanbanProperties = 'hideEmptyColumns' | 'showColumnTags';
	const handleToggleBoardSettings = (viewIndex: number, field: BooleanBoardProperties, value: boolean) => {
		const updatedViewsData = [...allViewsData];
		if (updatedViewsData[viewIndex]) {
			(updatedViewsData[viewIndex] as any)[field] = value as boolean;
		}
		setAllViewsData(updatedViewsData);
		setIsEdited(true);
	};
	const handleToggleKanbanViewSettings = (viewIndex: number, field: BooleanKanbanProperties, value: boolean) => {
		const updatedViewsData = [...allViewsData];
		if (updatedViewsData[viewIndex] && updatedViewsData[viewIndex].kanbanView) {
			(updatedViewsData[viewIndex].kanbanView as any)[field] = value as boolean;
		}
		setAllViewsData(updatedViewsData);
		setIsEdited(true);
	};

	// Board Management - Function to handle saving the complete board configuration by saving the updated board data to the file system and updating the current view with the new board data after saving.
	const handleSave = async () => {
		let boardToSave = activeBoardData;
		boardToSave.views = allViewsData;

		if (boardToSave) {
			const filePath = plugin.taskBoardFileManager.getBoardFilepathFromRegistry(boardToSave.id);
			if (filePath) {
				await plugin.taskBoardFileManager.saveBoard(boardToSave, filePath);
			}
		}

		// Find and return the updated current view data
		// const updatedCurrentBoard = allViewsData.find(view => view.id === currentBoardData.id);
		// if (updatedCurrentBoard) {
		onSave(boardToSave);
		// }
	};

	// --------------------------------------------------------------
	// ALL RENDERING LOGIC BELOW
	// --------------------------------------------------------------

	const getViewTypeIconComponent = (viewTypeName: string | undefined, size: number) => {
		let viewType = viewTypeName ?? currentBoardData.views[currentViewIndex].viewType;
		switch (viewType) {
			case viewTypeNames.kanban:
				return <SquareKanban size={size} strokeWidth={1.5} />;
			case viewTypeNames.map:
				return <Network size={size - 2} strokeWidth={1.5} />;
			default:
				return <BrickWall size={size - 2} strokeWidth={1.5} />;
		}
	}

	// For Small Screens UI - Toggle Sidebar Visibility
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

	// Function to render the add column modal when the "Add Column" button is clicked in the configuration of a Kanban specific view.
	const renderAddColumnModal = () => {
		if (!isAddColumnModalOpen) return null;

		const modal = new AddColumnModal(plugin.app, {
			app: plugin.app,
			onCancel: handleCloseAddColumnModal, // Previously onClose
			onSubmit: (columnData: ColumnData) => handleAddColumn(selectedViewIndex, columnData),
		});
		modal.open();
	};

	// UseEffect and function to render the global settings UI in the board configuration modal when the global settings tab is selected and to clean up the global settings UI when switching to a different tab or when the component unmounts.
	useEffect(() => {
		if (selectedViewIndex !== -2) return;

		if (globalSettingsHTMLSection.current) {
			settingManager.cleanUp();
			globalSettingsHTMLSection.current.empty();
			// Render global settings
			settingManager.constructUI(globalSettingsHTMLSection.current, t("plugin-global-settings"));
		}
	}, [selectedViewIndex]);
	const renderGlobalSettingsTab = (viewIndex: number) => {
		return (
			<div className="pluginGlobalSettingsTab" ref={globalSettingsHTMLSection} />
		);
	}

	// Function to render the board settings UI in the board configuration modal when a specific view is selected and to clean up the global settings UI when switching to a different tab or when the component unmounts.
	const renderBoardConfigTab = () => {
		if (globalSettingsHTMLSection.current) {
			settingManager.cleanUp();
			globalSettingsHTMLSection.current.empty();
		}

		return (
			<div className="boardConfigTab">
				<div className="boardConfigModalMainContent-Active">
					<h2 className="boardConfigModalMainContent-Active-Heading">{activeBoardData.name} {t("configurations")}</h2>
					<hr className="boardConfigModalHr-50" />
					<div className="boardConfigModalMainContent-Active-Body">
						<div className="boardConfigModalMainContent-Active-Body-InputItems">
							<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
								<div className="boardConfigModalSettingName">{t("view-name")}</div>
								<div className="boardConfigModalSettingDescription">{t("view-name-info")}</div>
							</div>
							<input
								type="text"
								value={activeBoardData.name || ""}
								onChange={(e) => {
									setActiveBoardData({
										...activeBoardData,
										name: e.target.value,
									});
									setIsEdited(true);
								}}
							/>
						</div>
						<div className="boardConfigModalMainContent-Active-Body-InputItems">
							<div className="boardConfigModalMainContent-Active-Body-boardDescriptionTag">
								<div className="boardConfigModalSettingName">{t("view-description")}</div>
								<div className="boardConfigModalSettingDescription">{t("view-description-info")}</div>
							</div>
							<textarea
								rows={4}
								value={activeBoardData.description || ""}
								onChange={(e) => {
									setActiveBoardData({
										...activeBoardData,
										description: e.target.value,
									});
									setIsEdited(true);
								}}
							/>
						</div>
					</div>

					<hr className="boardConfigModalHr-100" />

					<div className="boardConfigModalDoubleBtnContainer">
						<button className="boardConfigModalDuplicateBoardBtn" onClick={handleDuplicateCurrentBoard}>{t("duplicate-this-board")}</button>
					</div>
				</div>
			</div>
		);
	}

	// Function to render the view specific settings UI in the board configuration modal when a specific view is selected and to clean up the global settings UI when switching to a different tab or when the component unmounts. This function also handles rendering the UI for configuring the settings of a Kanban specific view and for configuring the columns in a Kanban specific view.
	const renderViewSettings = (viewIndex: number) => {
		if (globalSettingsHTMLSection.current) {
			settingManager.cleanUp();
			globalSettingsHTMLSection.current.empty();
		}

		let view: View | undefined;
		if (allViewsData && allViewsData.length > 0)
			view = allViewsData[viewIndex];
		if (!view) view = allViewsData[0];

		if (!view) {
			return (
				<div className="boardConfigModalMainContent-Active">
					<div className="boardConfigModalNoViewSelected">{t("no-view-selected")}</div>
				</div>
			);
		}

		return (
			<div className="boardConfigModalMainContent-Active">
				<h2 className="boardConfigModalMainContent-Active-Heading">{view.viewName} {t("configurations")}</h2>
				<hr className="boardConfigModalHr-50" />
				<div className="boardConfigModalMainContent-Active-Body">
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
							<div className="boardConfigModalSettingName">{t("view-name")}</div>
							<div className="boardConfigModalSettingDescription">{t("view-name-info")}</div>
						</div>
						<input
							type="text"
							value={view.viewName}
							onChange={(e) => handleViewNameChange(viewIndex, e.target.value)}
						/>
					</div>
					<div className="boardConfigModalMainContent-Active-Body-InputItems">
						<div className="boardConfigModalMainContent-Active-Body-boardDescriptionTag">
							<div className="boardConfigModalSettingName">{t("view-description")}</div>
							<div className="boardConfigModalSettingDescription">{t("view-description-info")}</div>
						</div>
						<textarea
							rows={4}
							value={view?.description || ""}
							onChange={(e) => handleBoardDescriptionChange(viewIndex, e.target.value)}
						/>
					</div>

					{view.viewType === viewTypeNames.kanban && (
						<>
							<div className="boardConfigModalMainContent-Active-Body-InputItems">
								<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
									<div className="boardConfigModalSettingName">{t("show-tags-in-the-columns-of-type-tagged")}</div>
									<div className="boardConfigModalSettingDescription">{t("show-tags-in-the-columns-of-type-tagged-info")}</div>
								</div>
								<input
									type="checkbox"
									checked={view.kanbanView!.showColumnTags}
									onChange={(e) => handleToggleKanbanViewSettings(viewIndex, "showColumnTags", e.target.checked)}
								/>
							</div>
							<div className="boardConfigModalMainContent-Active-Body-InputItems">
								<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
									<div className="boardConfigModalSettingName">{t("automatically-hide-empty-columns")}</div>
									<div className="boardConfigModalSettingDescription">{t("automatically-hide-empty-columns-info")}</div>
								</div>
								<input
									type="checkbox"
									checked={view.kanbanView!.hideEmptyColumns}
									onChange={(e) => handleToggleKanbanViewSettings(viewIndex, "hideEmptyColumns", e.target.checked)}
								/>
							</div>
							<div className="boardConfigModalMainContent-Active-Body-InputItems">
								<div className="boardConfigModalMainContent-Active-Body-boardNameTag">
									<div className="boardConfigModalSettingName">{t("configure-kanban-swimlanes")}</div>
									<div className="boardConfigModalSettingDescription">{t("configure-kanban-swimlanes-info")}</div>
								</div>
								<button
									className="boardConfigModalMainContentConfigureSwimlanesBtn"
									onClick={handleSwimlanesConfigureBtnClick}
								>{t("configure")}</button>
							</div>

							<hr className="boardConfigModalHr-100" />

							<div className="boardConfigModalMainContent-Active-BodyColumnSec">
								<h3>{t("columns")}</h3>
								<div
									ref={columnListRef}
									className="boardConfigModalMainContent-Active-BodyColumnsList"
								>
									{view.kanbanView!.columns.map((column, columnIndex) => (
										<div key={column.id} className={`boardConfigModalColumnRow${column.active ? "" : " Hidden"}`}>
											<RxDragHandleHorizontal className="boardConfigModalColumnRowDragButton" size={15} enableBackground={0} />
											{column.active ? (
												<EyeIcon
													onClick={() => toggleActiveState(viewIndex, columnIndex)}
													className="boardConfigModalColumnRowEyeButton"
												/>
											) : (
												<EyeOffIcon
													onClick={() => toggleActiveState(viewIndex, columnIndex)}
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
															viewIndex,
															columnIndex,
															"name",
															e.target.value
														)
													}
													className="boardConfigModalColumnRowContentColName"
												/>
												{column.colType === colTypeNames.allPending && (
													<input
														type="number"
														placeholder={t("work-limit")}
														aria-label={t("work-limit-info")}
														value={column.workLimit ?? 0}
														onChange={(e) =>
															handleColumnChange(
																viewIndex,
																columnIndex,
																"workLimit",
																Number(e.target.value)
															)
														}
														className="boardConfigModalColumnRowContentColName"
													/>
												)}
												{column.colType === colTypeNames.namedTag && (
													<>
														<input
															type="text"
															ref={(el) => {
																filePathInputRefs.current[column.id] = el;
															}}
															placeholder={t("enter-tag")}
															value={column.coltag || ""}
															onChange={(e) =>
																handleColumnChange(
																	viewIndex,
																	columnIndex,
																	"coltag",
																	e.target.value
																)
															}
															className="boardConfigModalColumnRowContentColName"
														/>
														<input
															type="number"
															placeholder={t("work-limit")}
															aria-label={t("work-limit-info")}
															value={column.workLimit || 0}
															onChange={(e) =>
																handleColumnChange(
																	viewIndex,
																	columnIndex,
																	"workLimit",
																	Number(e.target.value)
																)
															}
															className="boardConfigModalColumnRowContentColName"
														/>
													</>
												)}
												{column.colType === colTypeNames.taskStatus && (
													<>
														<input
															type="text"
															placeholder={t("enter-status-placeholder")}
															value={column.taskStatus || ""}
															onChange={(e) =>
																handleColumnChange(
																	viewIndex,
																	columnIndex,
																	colTypeNames.taskStatus,
																	e.target.value
																)
															}
															className="boardConfigModalColumnRowContentColName"
														/>
														<input
															type="number"
															placeholder={t("work-limit")}
															aria-label={t("work-limit-info")}
															value={column.workLimit || 0}
															onChange={(e) =>
																handleColumnChange(
																	viewIndex,
																	columnIndex,
																	"workLimit",
																	Number(e.target.value)
																)
															}
															className="boardConfigModalColumnRowContentColName"
														/>
													</>
												)}
												{column.colType === colTypeNames.taskPriority && (
													<>
														<select
															aria-label="Select priority"
															value={column.taskPriority || getPriorityOptionsForDropdown()[0].value}
															onChange={(e) =>
																handleColumnChange(
																	viewIndex,
																	columnIndex,
																	colTypeNames.taskPriority,
																	Number(e.target.value)
																)
															}
															className="boardConfigModalColumnRowContentPriorityDropdown"
														>
															{getPriorityOptionsForDropdown().map((option) => (
																<option key={option.value} value={option.value}>{option.text}</option>
															))}
														</select>
														<input
															type="number"
															placeholder={t("work-limit")}
															aria-label={t("work-limit-info")}
															value={column.workLimit || 0}
															onChange={(e) =>
																handleColumnChange(
																	viewIndex,
																	columnIndex,
																	"workLimit",
																	Number(e.target.value)
																)
															}
															className="boardConfigModalColumnRowContentColName"
														/>
													</>
												)}
												{column.colType === colTypeNames.completed && (
													<input
														type="number"
														placeholder={t("max-items")}
														value={column.limit || ""}
														onChange={(e) =>
															handleColumnChange(
																viewIndex,
																columnIndex,
																"limit",
																Number(e.target.value)
															)
														}
														className="boardConfigModalColumnRowContentColDatedVal"
													/>
												)}
												{column.colType === colTypeNames.pathFiltered && (
													<input
														type="text"
														ref={(el) => {
															filePathInputRefs.current[column.id] = el;
														}}
														className="boardConfigModalColumnRowContentColName"
														value={column.filePaths || ""}
														onChange={(e) =>
															handleColumnChange(
																viewIndex,
																columnIndex,
																"filePaths",
																e.target.value
															)
														}
														placeholder={t("enter-path-pattern")}
													/>
												)}
												{column.colType === colTypeNames.dated && (
													<>
														<input
															type="number"
															placeholder={t("from")}
															value={column.datedBasedColumn?.from || 0}
															onChange={(e) =>
																handleColumnChange(
																	viewIndex,
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
															value={column.datedBasedColumn?.to || 0}
															onChange={(e) =>
																handleColumnChange(
																	viewIndex,
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
															value={column.datedBasedColumn?.dateType || plugin.settings.data.universalDate || UniversalDateOptions.dueDate}
															onChange={(e) =>
																handleColumnChange(
																	viewIndex,
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
															<option value={UniversalDateOptions.startDate}>{t("start-date")}</option>
															<option value={UniversalDateOptions.scheduledDate}>{t("scheduled-date")}</option>
															<option value={UniversalDateOptions.dueDate}>{t("due-date")}</option>
														</select>
														<input
															type="number"
															placeholder={t("work-limit")}
															aria-label={t("work-limit-info")}
															value={column.workLimit || 0}
															onChange={(e) =>
																handleColumnChange(
																	viewIndex,
																	columnIndex,
																	"workLimit",
																	Number(e.target.value)
																)
															}
															className="boardConfigModalColumnRowContentColName"
														/>
													</>
												)}
												{column.colType === colTypeNames.undated && (
													<>
														<select
															aria-label="Select date type"
															value={column.datedBasedColumn?.dateType || plugin.settings.data.universalDate || UniversalDateOptions.dueDate}
															onChange={(e) =>
																handleColumnChange(
																	viewIndex,
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
															<option value={UniversalDateOptions.startDate}>{t("start-date")}</option>
															<option value={UniversalDateOptions.scheduledDate}>{t("scheduled-date")}</option>
															<option value={UniversalDateOptions.dueDate}>{t("due-date")}</option>
														</select>
													</>
												)}
												<FaTrash className="boardConfigModalColumnRowDeleteButton" size={13} enableBackground={0} opacity={0.7} onClick={() => handleDeleteColumnFromBoard(viewIndex, columnIndex)} title={t("delete-column")} />
											</div>
										</div>
									))}
								</div>
							</div>
							<button className="boardConfigModalAddColumnButton" onClick={handleOpenAddColumnModal}>{t("add-column")}</button>
						</>
					)}

				</div>
				<hr className="boardConfigModalHr-100" />
				<div className="boardConfigModalDoubleBtnContainer">
					<button className="boardConfigModalDuplicateBoardBtn" onClick={handleDuplicateCurrentView}>{t("duplicate-this-view")}</button>
					<button className="boardConfigModalDeleteBoardBtn" onClick={handleDeleteCurrentView}>{t("delete-this-view")}</button>
				</div>
			</div>
		);
	};

	// Main render function for the board configuration modal which renders the sidebar with the list of views and the global settings tab and the main content area with the settings for the selected view or for the global settings based on the current state of the selected view index. This function also handles rendering the toggle button for the sidebar on small screens and rendering the add column modal when it is open.
	return (
		<>
			{renderAddColumnModal()}
			{allViewsData && (
				<button className="boardConfigModalSidebarToggleBtn" onClick={toggleSidebar} aria-label="Toggle Sidebar">
					<FaAlignJustify className="boardConfigModalSidebarToggleBtnIcon" size={15} enableBackground={0} />
				</button>
			)}
			<div className="boardConfigModalHome">
				{allViewsData && (
					<>
						<div ref={sidebarRef} className={`boardConfigModalSidebar ${isSidebarVisible ? "visible" : ""}`}>
							<div className="boardConfigModalSidebarBtnArea" >
								<div className="boardConfigModalSidebarBtnAreaGlobal" onClick={() => {
									setSelectedViewIndex(-2);
									toggleSidebar();
								}}>
									{t("global-settings")}
								</div>

								<hr className="boardConfigModalHr-100" />

								<div className="boardConfigModalSidebarBtnAreaGlobal" onClick={() => {
									setSelectedViewIndex(-1);
									toggleSidebar();
								}}>
									{t("board-settings")}
								</div>

								<hr className="boardConfigModalHr-100" />

								{allViewsData.length > 0 && (
									<>
										<div className="boardConfigModalSettingDescription">{t("your-views")}</div>
										<div ref={boardListRef} className="boardConfigModalSidebarBtnAreaBoardBtnsSection">
											{allViewsData.map((view, index) => (
												<div
													key={view.viewName} // Changed key from index to view.name
													className={`boardConfigModalSidebarBtnArea-btn${index === selectedViewIndex ? "-active" : ""}`}
													onClick={() => {
														setSelectedViewIndex(index);
														toggleSidebar();
													}}
												>
													{getViewTypeIconComponent(view.viewType, 14)}
													<span>
														{view.viewName}
													</span>
													<RxDragHandleDots2 className="boardConfigModalSidebarBtnArea-btn-drag-handle" size={15} /> {/* Add drag handle */}
												</div>
											))}
										</div>
									</>
								)}
							</div>
							<div className="boardConfigModalSidebarBtnAreaConfigBtnsSection">
								<button className="boardConfigModalSidebarBtnAreaAddBoard" onClick={() => handleAddNewView()}>{t("add-view")}</button>
								<hr className="boardConfigModalHr-100" />
								<button className="boardConfigModalSidebarSaveBtn" onClick={handleSave}>{t("save")}</button>
							</div>
						</div>

						<div className="boardConfigModalMainContent">
							{selectedViewIndex === -2
								? renderGlobalSettingsTab(selectedViewIndex)
								: selectedViewIndex === -1
									? renderBoardConfigTab()
									: <div className="boardConfigModalMainContentBoardSettingTab">{renderViewSettings(selectedViewIndex)}</div>}
						</div>
					</>
				)}
			</div>

			<button className="boardConfigModalSaveBtn-mobile" onClick={handleSave}>{t("save")}</button>
		</>
	);
};

/**
 * BoardConfigureModal is a modal component that provides a user interface for configuring the settings of a task board and its views in the TaskBoard plugin. It allows users to manage their boards and views, configure settings for each view, and save their configurations. The modal uses React for rendering the UI and manages its state using React's useState and useEffect hooks. It also integrates with the Obsidian plugin API to handle file management and settings management for the task boards.
 */
export class BoardConfigureModal extends Modal {
	root: ReactDOM.Root;
	settingsManager: SettingsManager;
	currentBoardData: Board;
	currentViewIndex: number;
	isEdited: boolean;
	onSave: (updatedBoard: Board) => void;
	plugin: TaskBoard;

	/**
	 * Constructor for the BoardConfigureModal class which initializes the modal with the current board data, the index of the currently active view, and a callback function to handle saving the updated board data when the user saves their configurations. It also sets up the React root for rendering the modal content and initializes the settings manager for managing global settings in the modal.
	 * @param plugin - The instance of the TaskBoard plugin that is opening the modal, used for accessing plugin settings and file management functionalities.
	 * @param currentBoardData - The data of the currently active board that is being configured in the modal, used for populating the UI with the current settings and for saving the updated settings back to the file system.
	 * @param currentViewIndex - The index of the currently active view in the board that is being configured, used for determining which view's settings to display and edit in the modal.
	 * @param onSave - A callback function that is called when the user saves their configurations in the modal, which receives the updated board data as an argument and is responsible for handling the saving of the updated board data to the file system and updating the current view with the new board data after saving.
	 */
	constructor(
		plugin: TaskBoard,
		currentBoardData: Board,
		currentViewIndex: number,
		onSave: (updatedBoard: Board) => void
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.currentBoardData = currentBoardData;
		this.currentViewIndex = currentViewIndex;
		this.onSave = onSave;

		this.isEdited = false;
		this.settingsManager = new SettingsManager(plugin);
		const { contentEl } = this;
		this.root = ReactDOM.createRoot(contentEl);

		this.modalEl.setAttribute('modal-type', 'task-board-config');
	}

	onOpen() {
		this.root.render(
			<ConfigModalContent
				plugin={this.plugin}
				settingManager={this.settingsManager}
				currentBoardData={this.currentBoardData}
				currentViewIndex={this.currentViewIndex}
				onSave={(updatedBoard: Board) => {
					this.isEdited = false;
					this.onSave(updatedBoard);
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

	// handleSave() {
	// 	// Trigger save functionality if required before closing
	// 	this.onSave(this.boards);
	// 	this.isEdited = false;
	// 	this.close();
	// }

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
