// src/components/TaskBoardViewContent.tsx

import { Board, ColumnData, RootFilterState, getActiveColumns } from "../interfaces/BoardConfigs";
import { CirclePlus, RefreshCcw, Search, SearchX, Filter, Menu as MenuICon, Settings, EllipsisVertical } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadBoardsData, loadTasksAndMerge } from "src/utils/JsonFileOperations";
import { taskJsonMerged } from "src/interfaces/TaskItem";

import { App, debounce, Platform, Menu, addIcon } from "obsidian";
import type TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { handleUpdateBoards } from "../utils/BoardOperations";
import { bugReporter, openAddNewTaskModal, openBoardConfigModal, openScanVaultModal, openTaskBoardActionsModal } from "../services/OpenModals";
import { columnSegregator } from 'src/utils/algorithms/ColumnSegregator';
import { t } from "src/utils/lang/helper";
import KanbanBoard from "./KanbanView/KanbanBoardView";
import MapView from "./MapView/MapView";
import { PENDING_SCAN_FILE_STACK, VIEW_TYPE_TASKBOARD } from "src/interfaces/Constants";
import { ViewTaskFilterPopover } from "./BoardFilters/ViewTaskFilterPopover";
import { boardFilterer } from "src/utils/algorithms/BoardFilterer";
import { ViewTaskFilterModal } from 'src/components/BoardFilters';
import { viewTypeNames } from "src/interfaces/Enums";
import { ScanVaultIcon, funnelIcon } from "src/interfaces/Icons";

const TaskBoardViewContent: React.FC<{ app: App; plugin: TaskBoard; boardConfigs: Board[] }> = ({ app, plugin, boardConfigs }) => {
	const [boards, setBoards] = useState<Board[]>(boardConfigs);
	const [activeBoardIndex, setActiveBoardIndex] = useState(plugin.settings.data.globalSettings.lastViewHistory.boardIndex ?? 0);
	const [allTasks, setAllTasks] = useState<taskJsonMerged>();
	const [filteredTasks, setFilteredTasks] = useState<taskJsonMerged | null>(null);
	const [filteredTasksPerColumn, setFilteredTasksPerColumn] = useState<typeof allTasksArrangedPerColumn>([]);
	const [viewType, setViewType] = useState<string>(plugin.settings.data.globalSettings.lastViewHistory.viewedType || viewTypeNames.kanban);

	const [refreshCount, setRefreshCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [freshInstall, setFreshInstall] = useState(false);
	const [showSearchInput, setShowSearchInput] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	const filterPopoverRef = useRef<ViewTaskFilterPopover | null>(null);

	const [showAllElements, setShowAllElements] = useState(true);
	const [leafWidth, setLeafWidth] = useState<number>(1000);
	const [isMobileView, setIsMobileView] = useState(false);
	const [showBoardSidebar, setShowBoardSidebar] = useState(false);
	const [sidebarAnimating, setSidebarAnimating] = useState(false);

	// plugin.registerEvent(
	// 	plugin.app.workspace.on("resize", () => {
	// 		// Now I should find if the leaf of type taskboard-view is active or not. If its active then I should find its width. If its less than 400px then hide the progress bar.
	// 		const taskBoardLeaf =
	// 			plugin.app.workspace.getLeavesOfType(VIEW_TYPE_TASKBOARD)[0];
	// 		console.log(
	// 			"Window resized",
	// 			"\nTaskBoardLeaf:",
	// 			taskBoardLeaf
	// 		);
	// 		if (taskBoardLeaf) {
	// 			const width = taskBoardLeaf.width;
	// 			console.log("TaskBoardLeaf width:", width);
	// 			setLeafWidth(width);
	// 		}
	// 	})
	// );

	useEffect(() => {
		const handleResize = () => {
			const taskBoardLeaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_TASKBOARD)[0];
			if (taskBoardLeaf) {
				setLeafWidth(taskBoardLeaf.width);
			}
		};
		handleResize();
		plugin.registerEvent(plugin.app.workspace.on("resize", handleResize));
		return () => {
			// cleanup if needed
		};
	}, []);

	useEffect(() => {
		setShowAllElements(leafWidth >= 1000);
		setIsMobileView(leafWidth <= 800); // For even little bigger screen smartphones, let go with 800
	}, [leafWidth]);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const data = await loadBoardsData(plugin);
				setBoards(data);

				const allTasks = await loadTasksAndMerge(plugin, true);
				if (allTasks) {
					setAllTasks(allTasks);
					setFreshInstall(false);
				}
			} catch (error) {
				console.error(
					"Error loading tasks cache from disk\nIf this is appearing on a fresh install then no need to worry.\n",
					error
				);
				setFreshInstall(true);
			}
		};

		fetchData();
	}, [refreshCount]);

	const allTasksArrangedPerColumn = useMemo(() => {
		if (allTasks && boards[activeBoardIndex]) {
			// Apply board filters to pending tasks
			const currentBoard = boards[activeBoardIndex];
			const boardFilter = currentBoard.boardFilter;

			// Create a copy of allTasks with filtered pending tasks
			const filteredAllTasks = {
				...allTasks,
				Pending: boardFilterer(allTasks.Pending, boardFilter),
				Completed: boardFilterer(allTasks.Completed, boardFilter),
			};
			plugin.settings.data.boardConfigs[activeBoardIndex].taskCount = {
				pending: filteredAllTasks.Pending.length,
				completed: filteredAllTasks.Completed.length,
			};
			setFilteredTasks(filteredAllTasks);

			return getActiveColumns(currentBoard)
				.filter((column) => column.active)
				.map((column: ColumnData) =>
					columnSegregator(plugin, activeBoardIndex, column, filteredAllTasks)
				);
		}
		return [];
	}, [allTasks, boards, activeBoardIndex]);

	useEffect(() => {
		if (allTasksArrangedPerColumn.length > 0) {
			setLoading(false);
		}
	}, [allTasksArrangedPerColumn]);

	const debouncedRefreshColumn = useCallback(
		debounce(async () => {
			try {
				const allTasks = await loadTasksAndMerge(plugin, false);
				setAllTasks(allTasks);
			} catch (error) {
				bugReporter(plugin, "Error loading tasks on column refresh", String(error), "TaskBoardViewContent.tsx/debouncedRefreshColumn");
			}
		}, 500),
		[plugin]
	);

	useEffect(() => {
		eventEmitter.on("REFRESH_COLUMN", debouncedRefreshColumn);
		return () => eventEmitter.off("REFRESH_COLUMN", debouncedRefreshColumn);
	}, [debouncedRefreshColumn]);

	useEffect(() => {
		const refreshBoardListener = () => setRefreshCount((prev) => prev + 1);
		eventEmitter.on("REFRESH_BOARD", refreshBoardListener);
		return () => eventEmitter.off("REFRESH_BOARD", refreshBoardListener);
	}, []);

	useEffect(() => {
		const refreshView = (viewType: string) => {
			setViewType(viewType);
			plugin.settings.data.globalSettings.lastViewHistory.viewedType = viewType;
			plugin.saveSettings();
		};
		eventEmitter.on("SWITCH_VIEW", refreshView);
		return () => eventEmitter.off("SWITCH_VIEW", refreshView);
	}, []);

	const refreshBoardButton = useCallback(async () => {
		const fileStackString = localStorage.getItem(PENDING_SCAN_FILE_STACK);
		const fileStack = fileStackString ? JSON.parse(fileStackString) : null;

		if (fileStack && fileStack.length > 0) {
			await plugin.realTimeScanning.processAllUpdatedFiles();
		}
		eventEmitter.emit("REFRESH_BOARD");

	}, [plugin]);

	function handleOpenAddNewTaskModal() {
		openAddNewTaskModal(app, plugin);
	}

	function handleOpenTaskBoardActionsModal() {
		openTaskBoardActionsModal(plugin, activeBoardIndex);
	}

	function handleSearchButtonClick() {
		setShowSearchInput((prev) => !prev);
		if (showSearchInput) {
			setSearchQuery("");
			// el.currentTarget.focus();
			setFilteredTasksPerColumn([]);
			plugin.settings.data.globalSettings.searchQuery = "";
		} else {
			setSearchQuery(plugin.settings.data.globalSettings.searchQuery || "");
			handleSearchSubmit();
		}
	}

	// function highlightMatch(text: string, query: string): string {
	// 	const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	// 	const regex = new RegExp(`(${escapedQuery})`, "gi");
	// 	return text.replace(regex, `<mark style="background: #FFF3A3A6;">$1</mark>`);
	// }

	function handleSearchSubmit() {
		if (!searchQuery.trim()) {
			setFilteredTasksPerColumn([]);
			return;
		}

		plugin.settings.data.globalSettings.searchQuery = searchQuery;

		const lowerQuery = searchQuery.toLowerCase();

		const filtered = allTasksArrangedPerColumn.map((column) => {
			const filteredTasks = column
				.filter((task) => {
					if (lowerQuery.startsWith("file:")) {
						return task.filePath.toLowerCase().includes(lowerQuery.replace("file:", "").trim());
					} else {
						const titleMatch = task.title.toLowerCase().includes(lowerQuery);
						const bodyMatch = task.body.join("\n").toLowerCase().includes(lowerQuery);
						return titleMatch || bodyMatch;
					}
				});
			// .map((task) => {
			// 	const highlightedTitle = highlightMatch(task.title, searchQuery);
			// 	const highlightedBody = highlightMatch(task.body.join("\n"), searchQuery);

			// 	return {
			// 		...task,
			// 		title: highlightedTitle,
			// 		body: highlightedBody.split("\n"),
			// 	};
			// });
			return filteredTasks;
		});

		setFilteredTasksPerColumn(filtered);
	}

	function handleViewTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
		const newViewType = e.target.value;
		setViewType(newViewType);
		plugin.settings.data.globalSettings.lastViewHistory.viewedType = newViewType;
		plugin.saveSettings();
	}

	function handleFilterButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
		try {
			const currentBoardConfig = boards[activeBoardIndex];
			if (Platform.isMobile) {
				// If its a mobile platform, then we will open a modal instead of popover.
				const filterModal = new ViewTaskFilterModal(
					plugin, false, undefined, activeBoardIndex, currentBoardConfig.name
				);

				// Set initial filter state
				if (currentBoardConfig.boardFilter) {
					setTimeout(() => {
						// Use type assertion to resolve non-null issues
						// const filterState = filterModal.liveFilterState as RootFilterState;
						if (filterModal.taskFilterComponent) {
							filterModal.taskFilterComponent.loadFilterState(currentBoardConfig.boardFilter!);
						}
					}, 100);
				}

				// Set the close callback - mainly used for handling cancel actions
				filterModal.filterCloseCallback = async (filterState) => {
					if (filterState) {
						// Save the filter state to the board
						const updatedBoards = [...boards];
						updatedBoards[activeBoardIndex].boardFilter = filterState;
						setBoards(updatedBoards);

						// Persist to settings
						plugin.settings.data.boardConfigs[activeBoardIndex].boardFilter = filterState;
						await plugin.saveSettings();

						// Refresh the board view
						eventEmitter.emit('REFRESH_BOARD');
					}
				};

				filterModal.open();

			} else {
				// If the platform is not mobile, then we will open a popover near the button.

				// Close existing popover if open
				if (filterPopoverRef.current) {
					filterPopoverRef.current.close();
					filterPopoverRef.current = null;
					return;
				}

				// Get button position
				const buttonRect = event.currentTarget.getBoundingClientRect();
				const position = {
					x: buttonRect.left,
					y: buttonRect.bottom
				};

				// Create and show popover
				const popover = new ViewTaskFilterPopover(
					plugin,
					false, // forColumn = false since this is for board-level filter
					undefined,
					activeBoardIndex,
					boards[activeBoardIndex]?.name || "Board",
				);

				// Load existing filter state if available
				if (currentBoardConfig.boardFilter) {
					// Wait for component to be created and loaded
					setTimeout(() => {
						if (popover.taskFilterComponent) {
							popover.taskFilterComponent.loadFilterState(currentBoardConfig.boardFilter!);
						}
					}, 100);
				}

				// Set up close callback to save filter state
				popover.onClose = async (filterState?: RootFilterState) => {
					if (filterState) {
						// Save the filter state to the board
						const updatedBoards = [...boards];
						updatedBoards[activeBoardIndex].boardFilter = filterState;
						setBoards(updatedBoards);

						// Persist to settings
						plugin.settings.data.boardConfigs[activeBoardIndex].boardFilter = filterState;
						await plugin.saveSettings();

						// Refresh the board view
						eventEmitter.emit('REFRESH_BOARD');
					}
					filterPopoverRef.current = null;
				};

				popover.showAtPosition(position);
				filterPopoverRef.current = popover;
			}
		} catch (error) {
			bugReporter(plugin, "Error showing filter popover", String(error), "TaskBoardViewContent.tsx/handleFilterButtonClick");
		}
	}

	function handleBoardSelection(index: number) {
		if (index !== activeBoardIndex) {
			setActiveBoardIndex(index);
			plugin.settings.data.globalSettings.lastViewHistory.boardIndex = index;
			plugin.saveSettings();
		}
		closeBoardSidebar(); // Close sidebar after selection
	}

	function toggleBoardSidebar() {
		if (showBoardSidebar) {
			closeBoardSidebar();
		} else {
			openBoardSidebar();
		}
	}

	function openBoardSidebar() {
		setShowBoardSidebar(true);
		setSidebarAnimating(true);
	}

	function closeBoardSidebar() {
		setSidebarAnimating(false);
		// Wait for animation to complete before hiding
		setTimeout(() => {
			setShowBoardSidebar(false);
		}, 300); // Match animation duration
	}

	function openHeaderMoreOptionsMenu(event: MouseEvent | React.MouseEvent) {
		const sortMenu = new Menu();

		sortMenu.addItem((item) => {
			item.setTitle(t("quick-actions"));
			item.setIsLabel(true);
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("refresh-the-board"));
			item.setIcon("rotate-cw");
			item.onClick(async () => {
				refreshBoardButton();
			});
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("open-board-filters-modal"));
			item.setIcon(funnelIcon);
			item.onClick(async (event) => {
				if (event instanceof MouseEvent) {
					handleFilterButtonClick(event as unknown as React.MouseEvent<HTMLButtonElement, MouseEvent>);
				}
			});
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("open-board-configuration-modal"));
			item.setIcon("settings");
			item.onClick(async () => {
				openBoardConfigModal(plugin, boards, activeBoardIndex, (updatedBoards) =>
					handleUpdateBoards(plugin, updatedBoards, setBoards)
				);
			});
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("scan-vault-modal"));
			item.setIcon(ScanVaultIcon);
			item.onClick(async () => {
				openScanVaultModal(plugin.app, plugin);
			});
		});


		sortMenu.addItem((item) => {
			item.setTitle(t("view-type"));
			item.setIsLabel(true);
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("kanban-view"));
			item.setIcon("square-kanban");
			item.onClick(async () => {
				eventEmitter.emit("SWITCH_VIEW", 'kanban');
			});
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("map-view"));
			item.setIcon("waypoints");
			item.onClick(async () => {
				eventEmitter.emit("SWITCH_VIEW", 'map');
			});
		});

		// Use native event if available (React event has nativeEvent property)
		sortMenu.showAtMouseEvent(
			(event instanceof MouseEvent ? event : event.nativeEvent)
		);
	}

	// useEffect(() => {
	// 	const taskBoardLeaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_TASKBOARD)[0];
	// 	if (taskBoardLeaf) {
	// 		console.log("View width :", taskBoardLeaf.width);
	// 	}
	// }, [leafWidth]);

	// Close sidebar when clicking outside or pressing escape
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape' && showBoardSidebar) {
				closeBoardSidebar();
			}
		}

		if (showBoardSidebar) {
			document.addEventListener('keydown', handleKeyDown);
			return () => document.removeEventListener('keydown', handleKeyDown);
		}
	}, [showBoardSidebar]);

	return (
		<div className="taskBoardView">
			<div className="taskBoardHeader">
				{!showAllElements ? (
					// Mobile view: Hamburger button + current board name
					<div className="mobileBoardHeader">
						<button
							className="hamburgerMenuButton"
							onClick={toggleBoardSidebar}
							aria-label={t("toggle-board-drawer")}
						>
							<MenuICon size={20} />
						</button>
						{!showSearchInput && (
							<span className="currentBoardName">{boards[activeBoardIndex]?.name}</span>
						)}
					</div>
				) : (
					// Desktop view: Original board titles
					<div className="boardTitles">
						{boards.map((board, index) => (
							<button
								key={index}
								className={`boardTitleButton${index === activeBoardIndex ? "Active" : ""}`}
								onClick={() => handleBoardSelection(index)}
							>
								{board.name}
							</button>
						))}
					</div>
				)}
				<div className="taskBoardHeaderBtns">
					<div className="taskCountContainer">
						<div className={`taskCountContainerProgressBar${leafWidth >= 1500 ? "" : "-hidden"}`}>
							<div
								className="taskCountContainerProgressBarProgress"
								style={{
									width: `${((filteredTasks ? filteredTasks?.Completed.length : 0) / (filteredTasks ? filteredTasks?.Pending.length + filteredTasks?.Completed.length : 1)) * 100}%`,
								}}
							/>
						</div>
						<span className="taskCountContainerTaskCount">
							{(filteredTasks ? filteredTasks?.Completed.length : 0)} / {filteredTasks ? filteredTasks?.Pending.length + filteredTasks?.Completed.length : 0}
						</span>
					</div>
					{showSearchInput && (
						<input
							type="text"
							className="taskBoardSearchInput"
							placeholder="Search tasks..."
							aria-label={t("enter-task-content-to-search")}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									handleSearchSubmit();
								}
							}}
							ref={input => {
								if (input && showSearchInput) {
									input.focus();
								}
							}}
						/>
					)}
					<button
						className="searchTaskBtn"
						onClick={() => handleSearchButtonClick()}
					>
						{showSearchInput ? <SearchX size={20} aria-label={t("clear-search-query")} /> : <Search size={20} aria-label={t("search-tasks")} />}
					</button>

					<button className="AddNewTaskBtn" aria-label={t("add-new-task")} onClick={handleOpenAddNewTaskModal}>
						<CirclePlus size={18} />
					</button>

					<button
						className={`filterTaskBtn ${(isMobileView || Platform.isMobile) ? "taskBoardViewHeaderHideElements" : ""}`}
						aria-label={t("apply-advanced-board-filters")}
						onClick={handleFilterButtonClick}
					>
						<Filter size={18} />
					</button>

					<button
						className={`ConfigureBtn ${(isMobileView || Platform.isMobile) ? "taskBoardViewHeaderHideElements" : ""}`}
						aria-label={t("board-configure-button")}
						onClick={() =>
							openBoardConfigModal(plugin, boards, activeBoardIndex, (updatedBoards) =>
								handleUpdateBoards(plugin, updatedBoards, setBoards)
							)
						}
					>
						<Settings size={18} />
					</button>

					{/* <button className="taskboardActionshBtn" aria-label={t("task-board-actions-button")} onClick={handleOpenTaskBoardActionsModal}>
						<Bot size={20} />
					</button> */}

					<select
						className={`taskBoardViewDropdown ${(isMobileView || Platform.isMobile) ? "taskBoardViewHeaderHideElements" : ""}`}
						value={viewType}
						onChange={(e) => { handleViewTypeChange(e); }}
					>
						<option value={viewTypeNames.kanban}>{t("kanban")}</option>
						{/* <option value="list">List</option>
							<option value="table">Table</option> */}
						<option value={viewTypeNames.map}>{t("map")}</option>
					</select>

					<button className={`RefreshBtn ${Platform.isMobile ? "taskBoardViewHeaderHideElements" : ""}`} aria-label={t("refresh-board-button")} onClick={refreshBoardButton}>
						<RefreshCcw size={18} />
					</button>
					{(isMobileView || Platform.isMobile) && (
						<button className="taskBoardViewHeaderOptionsBtn" onClick={openHeaderMoreOptionsMenu}>
							<EllipsisVertical size={20} />
						</button>
					)}
				</div>
			</div>

			{/* Mobile board sidebar overlay */}
			{!showAllElements && showBoardSidebar && (
				<div className="boardSidebarOverlay" onClick={closeBoardSidebar}>
					<div
						className={`boardSidebar ${sidebarAnimating ? 'boardSidebar--slide-in' : 'boardSidebar--slide-out'}`}
						onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside sidebar
					>
						<div className="boardSidebarHeader">
							<h3>{t("your-boards")}</h3>
						</div>
						<div className="boardSidebarContent">
							<div className="boardSidebarContentBtnContainer">
								{boards.map((board, index) => (
									<div
										key={index}
										className={`boardSidebarCard ${index === activeBoardIndex ? 'boardSidebarCard--active' : ''}`}
										onClick={() => handleBoardSelection(index)}
									>
										<div className="boardSidebarCardTitle" >
											{board.name}
										</div>
										<div className="boardSidebarCardDescription" >
											{board?.description}
										</div>
										<div className="taskCountContainerProgress" >
											<div className={"taskCountContainerProgressBar"}>
												<div
													className="taskCountContainerProgressBarIndicator"
													style={{
														width: `${((board?.taskCount ? board.taskCount.completed : 0) / (board?.taskCount ? board?.taskCount.pending + board.taskCount.completed : 1)) * 100}%`,
													}}
												/>
											</div>
											<span className="taskCountContainerProgressCount">
												{(board?.taskCount ? board.taskCount.completed : 0)} / {board?.taskCount ? board?.taskCount.pending + board?.taskCount?.completed : 0}
											</span>
										</div>
									</div>
								))}
							</div>
							<div className="boardSidebarFooter">
								<button
									className="boardConfigureBtn"
									onClick={() =>
										openBoardConfigModal(plugin, boards, activeBoardIndex, (updatedBoards) =>
											handleUpdateBoards(plugin, updatedBoards, setBoards)
										)
									}
								>
									{t("configure-boards")}
								</button>
							</div>
						</div>
					</div>
				</div>
			)
			}

			<div className={Platform.isMobile ? "taskBoardViewSection-mobile" : "taskBoardViewSection"}>
				{boards[activeBoardIndex] ? (
					viewType === viewTypeNames.kanban ? (
						<KanbanBoard
							app={app}
							plugin={plugin}
							board={boards[activeBoardIndex]}
							allTasks={allTasks}
							tasksPerColumn={filteredTasksPerColumn.length > 0 ? filteredTasksPerColumn : allTasksArrangedPerColumn}
							loading={loading}
							freshInstall={freshInstall}
						/>
					) : viewType === viewTypeNames.map ? (
						loading ? (
							<div className="loadingContainer" >
								{freshInstall ? (
									<h2 className="initializationMessage" >
										{t("fresh-install-1")}
										<br />
										<br />
										{t("fresh-install-2")}
										<br />
										<br />
										{t("fresh-install-3")}
									</h2>
								) : (
									<>
										<div className="spinner"></div>
										<p>{t("loading-tasks")}</p>
									</>
								)}
							</div>
						) : (
							<MapView
								plugin={plugin}
								boards={boards}
								activeBoardIndex={activeBoardIndex}
								allTasksArranged={allTasksArrangedPerColumn}
								focusOnTaskId={plugin.settings.data.globalSettings.lastViewHistory.taskId || ""}
							/>
						)
					) : (
						<div className="emptyBoardMessage">
							{/* Placeholder for other view types */}
							{viewType === "list" && "List view coming soon."}
							{viewType === "table" && "Table view coming soon."}
							{viewType === "calender" && "Calender view coming soon."}
							{viewType === "gantt" && "Gantt chart view coming soon."}
						</div>
					)
				) : (
					<div className="emptyBoardMessage">
						Switch to different board.
					</div>
				)}
			</div>
		</div >
	);
};

export default TaskBoardViewContent;
