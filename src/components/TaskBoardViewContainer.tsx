// src/components/TaskBoardViewContainer.tsx

import { Board, ColumnData, DEFAULT_BOARD, RootFilterState, View } from "../interfaces/BoardConfigs";
import { CirclePlus, RefreshCcw, Search, SearchX, Filter, Menu as MenuICon, Settings, EllipsisVertical, List, KanbanSquareIcon, Network, BrickWall, KanbanSquare, SquareKanban, Save, LayoutGridIcon } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadTasksAndMerge } from "src/utils/JsonFileOperations";
import { taskJsonMerged } from "src/interfaces/TaskItem";

import { App, debounce, Platform, Menu, WorkspaceLeaf } from "obsidian";
import type TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { openAddNewTaskModal, openBoardConfigModal, openScanVaultModal, openBoardsExplorerModal } from "../services/OpenModals";
import { t } from "src/utils/lang/helper";
import KanbanBoard from "./KanbanView/KanbanBoardView";
import MapView from "./MapView/MapView";
import { DEFAULT_DATE_FORMAT } from "src/interfaces/Constants";
import { TaskFilterPopover } from "./AdvancedFilterer/TaskFilterPopover";
import { advancedFilterer } from "src/utils/algorithms/AdvancedFilterer";
import { TaskFilterModal } from 'src/components/AdvancedFilterer';
import { taskPropertiesNames, viewsPanelPropertiesToShow, viewTypeNames } from "src/interfaces/Enums";
import { ScanVaultIcon, funnelIcon } from "src/interfaces/Icons";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";
import { getViewById, getViewIndex } from "src/utils/ViewUtils";

const TaskBoardViewContainer: React.FC<{ plugin: TaskBoard, currentBoardData: Board, currentLeaf: WorkspaceLeaf }> = ({ plugin, currentBoardData, currentLeaf }) => {
	// const [boards, setBoards] = useState<Board[]>(boardConfigs);
	const [boardData, setCurrentBoardData] = useState<Board>(currentBoardData);
	const [allTasks, setAllTasks] = useState<taskJsonMerged>();
	const [filteredTasks, setFilteredTasks] = useState<taskJsonMerged | null>(null);
	// Track current view by ID. Initialize to the first view if available
	const [currentViewIndex, setCurrentViewIndex] = useState<number>(0);
	const [currentView, setCurrentView] = useState<View | null>(() => {
		const initialBoard = currentBoardData;
		if (initialBoard?.views?.length > 0) {
			const lastViewIndex = getViewIndex(initialBoard, initialBoard.lastViewId);
			if (lastViewIndex !== -1) {
				setCurrentViewIndex(lastViewIndex);
				return initialBoard.views[lastViewIndex];
			}

			return initialBoard.views[0];
		}
		return null;
	});

	// Display a message that no views are present inside this board. Stop here only instead of moving with the rest of the code which is dependent on the views.
	if (!currentView) {
		return (
			<div className="taskBoardViewContainer noViews">
				<div className="noViewsMessage">
					<p>{t("no-views-in-board")}</p>
					<button onClick={() => openBoardConfigModal(plugin, boardData, currentViewIndex, (updatedBoard: Board) => {
						setCurrentBoardData(updatedBoard);
						plugin.taskBoardFileManager.saveBoard(updatedBoard);

						setTimeout(() => {
							eventEmitter.emit("REFRESH_BOARD");
						}, 100);
					})}>
						{t("add-view")}
					</button>
				</div>
			</div>
		);
	}

	const [refreshCount, setRefreshCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [freshInstall, setFreshInstall] = useState(false);
	const [showSearchInput, setShowSearchInput] = useState(plugin.settings.data.searchQuery ? true : false);
	const [searchQuery, setSearchQuery] = useState(plugin.settings.data.searchQuery ?? "");

	const filterPopoverRef = useRef<TaskFilterPopover | null>(null);
	const [mapViewDataUpdated, setMapViewDataUpdated] = useState<boolean>(false);

	const [viewWidth, setviewWidth] = useState<number>(currentLeaf.width);
	const [showAllElements, setShowAllElements] = useState(true); // show elements for screens larger than 1000px
	const [isMobileView, setIsMobileView] = useState(false); // show elements for screens smaller than 800px
	const [showViewsPanel, setshowViewsPanel] = useState(boardData.viewsPanel.isOpen);
	const [sidebarAnimating, setSidebarAnimating] = useState(false);
	const [editorModified, setEditorModified] = useState(plugin.editorModified);

	// // Derive current view from board data and currentViewId
	// const currentView: View | undefined = useMemo(() => {
	// 	if (boardData) {
	// 		return getViewById(boardData, currentViewId);
	// 	}
	// 	return undefined;
	// }, [boardData, currentViewId]);

	useEffect(() => {
		const handleResize = () => {
			const taskBoardLeaf = currentLeaf;
			if (taskBoardLeaf) {
				setviewWidth(taskBoardLeaf.width);
			}
		};

		handleResize();
		plugin.registerEvent(plugin.app.workspace.on("resize", handleResize));
		return () => {
			// cleanup if needed
		};
	}, []);

	useEffect(() => {
		setShowAllElements(viewWidth >= 1000);
		setIsMobileView(viewWidth <= 800); // For even little bigger screen smartphones, let go with 800
	}, [viewWidth]);

	// Update currentView when currentViewIndex or boardData changes
	useEffect(() => {
		if (boardData?.views && currentViewIndex >= 0 && currentViewIndex < boardData.views.length) {
			const newView = boardData.views[currentViewIndex];
			setCurrentView(newView);
		}
	}, [currentViewIndex, boardData?.views]);

	useEffect(() => {
		const fetchData = async () => {
			console.log("TASK BOARD : Does this run while switching boards...");
			try {
				// if (currentBoardData) {
				setCurrentBoardData(currentBoardData);

				// // Get index of the new board from the registry based on the board id.
				// const indexOfNewBoard = plugin.taskBoardFileManager.getBoardIndexFromRegistry(currentBoardData.id);;
				// const registryLength = Object.keys(plugin.settings.data.taskBoardFilesRegistry || {}).length; setActiveBoardIndex(indexOfNewBoard ?? registryLength);

				// // When board changes, automatically select the first view if available
				// if (currentBoardData?.views?.length > 0) {
				// 	const firstViewId = currentBoardData.views[0].viewId;
				// 	setCurrentViewId(firstViewId);
				// 	plugin.settings.data.lastViewHistory.currentViewId = firstViewId;
				// }
				// } else {
				// 	const data = await plugin.taskBoardFileManager.loadBoardUsingIndex(activeBoardIndex);
				// 	if (!data) throw "Board data not found.";

				// 	setCurrentBoardData(data);
				// }

				const allTasks = await loadTasksAndMerge(plugin, true);
				if (allTasks) {
					setAllTasks(allTasks);
					setFreshInstall(false);
				}
			} catch (error) {
				bugReporterManagerInsatance.addToLogs(
					131,
					`No need to worry about this bug, if its appearing on the fresh install.\n${String(error)}`,
					"TaskBoardViewContainer.tsx/loading boards and tasks useEffect",
				);
				setFreshInstall(true);
			}
		};

		fetchData();
	}, [refreshCount]);

	// First memo: Filter tasks by board filter and search query (but don't segregate by column yet)
	const filteredAndSearchedTasks = useMemo(() => {
		if (allTasks && boardData) {
			const currentBoard = boardData;
			const viewFilter = currentBoard.views?.find((view) => view.viewId === currentView.viewId)?.viewFilter;
			const dateFormat = plugin.settings.data.dateFormat || DEFAULT_DATE_FORMAT;

			// Apply board filters to tasks
			const boardFilteredTasks = {
				...allTasks,
				Pending: advancedFilterer(allTasks.Pending, viewFilter, dateFormat),
				Completed: advancedFilterer(allTasks.Completed, viewFilter, dateFormat),
			};

			let newBoardData = currentBoard;
			// Update task count in settings
			newBoardData.views[currentViewIndex].taskCount = {
				pending: boardFilteredTasks.Pending.length,
				completed: boardFilteredTasks.Completed.length,
			};

			setFilteredTasks(boardFilteredTasks);

			// Apply search filter if search query exists
			if (searchQuery.trim() !== "") {
				const searchFiltered = handleSearchSubmit(boardFilteredTasks);
				return searchFiltered || boardFilteredTasks;
			}

			return boardFilteredTasks;
		}
		return { Pending: [], Completed: [] };
	}, [allTasks, currentBoardData, searchQuery]);

	useEffect(() => {
		if (filteredAndSearchedTasks.Pending.length > 0 || filteredAndSearchedTasks.Completed.length > 0) {
			setLoading(false);
		}
	}, [filteredAndSearchedTasks]);

	const debouncedRefreshColumn = useCallback(
		debounce(async () => {
			try {
				const allTasks = await loadTasksAndMerge(plugin, false);
				setAllTasks(allTasks);
			} catch (error) {
				bugReporterManagerInsatance.showNotice(28, "Error loading tasks on column refresh", String(error), "TaskBoardViewContainer.tsx/debouncedRefreshColumn");
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
		const handleMapDataUpdated = (eventData: { status: boolean }) => {
			if (eventData.status)
				setMapViewDataUpdated(true);
			else
				setMapViewDataUpdated(false);
		};

		eventEmitter.on("MAP_UPDATED", handleMapDataUpdated);
		return () => eventEmitter.off("MAP_UPDATED", handleMapDataUpdated);
	}, []);

	useEffect(() => {
		const refreshView = (viewId: string) => {
			setCurrentView(getViewById(boardData, viewId)!);
			currentBoardData!.lastViewId = viewId;
			// plugin.settings.data.lastViewHistory.currentViewId = viewId;
			// plugin.saveSettings();
		};
		eventEmitter.on("SWITCH_VIEW", refreshView);
		return () => eventEmitter.off("SWITCH_VIEW", refreshView);
	}, []);

	// Listen to editor modified state changes
	useEffect(() => {
		const handleEditorModifiedChange = (modified: boolean) => {
			setEditorModified(modified);
		};

		eventEmitter.on("EDITOR_MODIFIED_CHANGED", handleEditorModifiedChange);
		return () => eventEmitter.off("EDITOR_MODIFIED_CHANGED", handleEditorModifiedChange);
	}, []);

	const refreshBoardButton = useCallback(() => {
		plugin.realTimeScanner.processAllUpdatedFiles(); //.then(() => console.log("Finished processing all updated files."));
		plugin.processCreateQueue(); //.then(() => console.log("Finished processing create queue."));
		plugin.processDeleteQueue(); //.then(() => console.log("Finished processing delete queue."));
		plugin.processRenameQueue(); //.then(() => console.log("Finished processing rename queue."));

		setTimeout(() => {
			eventEmitter.emit("REFRESH_BOARD");
		}, 100);
	}, []);

	function handleOpenAddNewTaskModal() {
		openAddNewTaskModal(plugin);
	}

	// function handleOpenTaskBoardActionsModal() {
	// 	if (boardData)
	// 		openTaskBoardActionsModal(plugin, boardData);
	// }

	function handleSearchButtonClick() {
		if (showSearchInput) {
			setSearchQuery("");
			// el.currentTarget.focus();
			plugin.settings.data.searchQuery = "";

			eventEmitter.emit("REFRESH_COLUMN");
			plugin.saveSettings();
			setShowSearchInput(false);
		} else {
			setSearchQuery(plugin.settings.data.searchQuery || "");
			handleSearchSubmit();
			setShowSearchInput(true);
		}
	}

	// function highlightMatch(text: string, query: string): string {
	// 	const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	// 	const regex = new RegExp(`(${escapedQuery})`, "gi");
	// 	return text.replace(regex, `<mark style="background: #FFF3A3A6;">$1</mark>`);
	// }

	function handleSearchSubmit(fileteredAllTasks?: taskJsonMerged): taskJsonMerged | null {
		if (!searchQuery.trim()) {
			return null;
		}

		const lowerQuery = searchQuery.toLowerCase();
		let searchFilteredTasks: taskJsonMerged | null = null;

		if (fileteredAllTasks) {
			searchFilteredTasks = {
				Pending: fileteredAllTasks.Pending.filter((task) => {
					if (lowerQuery.startsWith("file:")) {
						return task.filePath.toLowerCase().includes(lowerQuery.replace("file:", "").trim());
					} else {
						const titleMatch = task.title.toLowerCase().includes(lowerQuery);
						const bodyMatch = task.body.join("\n").toLowerCase().includes(lowerQuery);
						return titleMatch || bodyMatch;
					}
				}),
				Completed: fileteredAllTasks.Completed.filter((task) => {
					if (lowerQuery.startsWith("file:")) {
						return task.filePath.toLowerCase().includes(lowerQuery.replace("file:", "").trim());
					} else {
						const titleMatch = task.title.toLowerCase().includes(lowerQuery);
						const bodyMatch = task.body.join("\n").toLowerCase().includes(lowerQuery);
						return titleMatch || bodyMatch;
					}
				})
			};

			setTimeout(() => {
				plugin.settings.data.searchQuery = lowerQuery;
				plugin.saveSettings();
			}, 100);
		}

		return searchFilteredTasks;
	}

	function handleFilterButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
		try {
			const currentBoardConfig = boardData;
			if (Platform.isMobile || Platform.isMacOS) {
				// If its a mobile platform, then we will open a modal instead of popover.
				const filterModal = new TaskFilterModal(
					plugin, false, undefined, currentBoardConfig!.name
				);

				// Set initial filter state
				if (currentBoardConfig!.views[currentViewIndex].viewFilter) {
					setTimeout(() => {
						// Use type assertion to resolve non-null issues
						// const filterState = filterModal.liveFilterState as RootFilterState;
						if (filterModal.taskFilterComponent) {
							filterModal.taskFilterComponent.loadFilterState(currentBoardConfig!.views[currentViewIndex].viewFilter);
						}
					}, 100);
				}

				// Set the close callback - mainly used for handling cancel actions
				filterModal.filterCloseCallback = async (filterState) => {
					if (filterState) {
						// Save the filter state to the board
						const updatedcurrentBoardData = boardData;
						updatedcurrentBoardData!.views[currentViewIndex].viewFilter = filterState;
						setCurrentBoardData(updatedcurrentBoardData);

						// Persist to settings
						boardData!.views[currentViewIndex].viewFilter = filterState;
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
				const buttonRect = event.currentTarget?.getBoundingClientRect();
				const position = {
					x: buttonRect?.left ?? 100,
					y: buttonRect?.bottom ?? 100
				};

				// Create and show popover
				const popover = new TaskFilterPopover(
					plugin,
					false, // forColumn = false since this is for board-level filter
					undefined,
					boardData?.name || "Board",
				);

				// Load existing filter state if available
				if (currentBoardConfig!.views[currentViewIndex].viewFilter) {
					// Wait for component to be created and loaded
					setTimeout(() => {
						if (popover.taskFilterComponent) {
							popover.taskFilterComponent.loadFilterState(currentBoardConfig!.views[currentViewIndex].viewFilter!);
						}
					}, 100);
				}

				// Set up close callback to save filter state
				popover.onClose = async (filterState?: RootFilterState) => {
					if (filterState) {
						// Save the filter state to the board
						const updatedcurrentBoardData = boardData;
						updatedcurrentBoardData!.views[currentViewIndex].viewFilter = filterState;
						setCurrentBoardData(updatedcurrentBoardData);

						// Persist to settings
						boardData!.views[currentViewIndex].viewFilter = filterState;
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
			bugReporterManagerInsatance.showNotice(29, "Error showing filter popover", String(error), "TaskBoardViewContainer.tsx/handleFilterButtonClick");
		}
	}

	function togglePropertyNameInSettings(propertyName: string) {
		let visibleProperties = plugin.settings.data.visiblePropertiesList || [];

		if (visibleProperties.includes(propertyName)) {
			visibleProperties.splice(visibleProperties.indexOf(propertyName), 1);
			plugin.settings.data.visiblePropertiesList = visibleProperties;

		} else {
			let index = -1;
			switch (propertyName) {
				case taskPropertiesNames.SubTasks:
					index = visibleProperties.indexOf(taskPropertiesNames.SubTasksMinimized);
					if (index > -1)
						visibleProperties.splice(index, 1);
					break;
				case taskPropertiesNames.SubTasksMinimized:
					index = visibleProperties.indexOf(taskPropertiesNames.SubTasks);
					if (index > -1)
						visibleProperties.splice(index, 1);
					break;
				case taskPropertiesNames.Description:
					index = visibleProperties.indexOf(taskPropertiesNames.DescriptionMinimized);
					if (index > -1)
						visibleProperties.splice(index, 1);
					break;
				case taskPropertiesNames.DescriptionMinimized:
					index = visibleProperties.indexOf(taskPropertiesNames.Description);
					if (index > -1)
						visibleProperties.splice(index, 1);
					break;
			}
			visibleProperties.push(propertyName);

			plugin.settings.data.visiblePropertiesList = visibleProperties;
		}

		plugin.saveSettings();
		eventEmitter.emit("REFRESH_BOARD");
	}

	function handlePropertiesBtnClick(event: React.MouseEvent<HTMLButtonElement>) {
		const propertyMenu = new Menu();


		propertyMenu.addItem((item) => {
			item.setTitle(t("show-hide-properties"));
			item.setIsLabel(true);
		});
		propertyMenu.addSeparator();

		propertyMenu.addItem((item) => {
			item.setTitle(t("id"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.ID);
			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.ID))
		});

		propertyMenu.addItem((item) => {
			item.setTitle(t("checkbox"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Checkbox);
			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.Checkbox))
		});

		propertyMenu.addItem((item) => {
			item.setTitle(t("status"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Status);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.Status))
		});

		propertyMenu.addItem((item) => {
			item.setTitle(t("priority"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Priority);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.Priority))
		});

		propertyMenu.addItem((item) => {
			item.setTitle(t("tags"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Tags);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.Tags))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("time"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Time);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.Time))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("reminder"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Reminder);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.Reminder))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("created-date"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.CreatedDate);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.CreatedDate))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("start-date"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.StartDate);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.StartDate))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("scheduled-date"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.ScheduledDate);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.ScheduledDate))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("due-date"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.DueDate);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.DueDate))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("completed-date"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.CompletionDate);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.CompletionDate))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("cancelled-date"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.CancelledDate);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.CancelledDate))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("dependencies"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Dependencies);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.Dependencies))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("file-name"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.FilePath);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.FilePath))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("file-name-in-header"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.FilePathInHeader);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.FilePathInHeader))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("parent-folder"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.ParentFolder);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.ParentFolder))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("full-path"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.FullPath);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.FullPath))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("file-name-in-header"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.FilePathInHeader);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.FilePathInHeader))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("parent-folder"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.ParentFolder);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.ParentFolder))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("full-path"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.FullPath);

			})
			item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.FullPath))
		});

		propertyMenu.addSeparator();

		propertyMenu.addItem((item) => {
			item.setTitle(t("sub-tasks"));
			const subTasksMenu = item.setSubmenu()

			subTasksMenu.addItem((item) => {
				item.setTitle(t("visible"))
				item.onClick(async () => {
					togglePropertyNameInSettings(taskPropertiesNames.SubTasks);

				})
				item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.SubTasks));
			});

			subTasksMenu.addItem((item) => {
				item.setTitle(t("minimized"))
				item.onClick(async () => {
					togglePropertyNameInSettings(taskPropertiesNames.SubTasksMinimized);

				})
				item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.SubTasksMinimized));
			});

			// subTasksMenu.addItem((item) => {
			// 	item.setTitle(t("hidden"))
			// 	item.onClick(async () => {
			// 		togglePropertyNameInSettings(taskPropertiesNames.SubTasks);
			// 		togglePropertyNameInSettings(taskPropertiesNames.SubTasksMinimized);

			// 	})
			// 	item.setChecked(!plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.SubTasks) && !plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.SubTasksMinimized));
			// });
		});

		propertyMenu.addItem((item) => {
			item.setTitle(t("description"));
			const subTasksMenu = item.setSubmenu()

			subTasksMenu.addItem((item) => {
				item.setTitle(t("visible"))
				item.onClick(async () => {
					togglePropertyNameInSettings(taskPropertiesNames.Description);
					plugin.saveSettings();

				})
				item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.Description));
			});

			subTasksMenu.addItem((item) => {
				item.setTitle(t("minimized"))
				item.onClick(async () => {
					togglePropertyNameInSettings(taskPropertiesNames.DescriptionMinimized);
					plugin.saveSettings();

				})
				item.setChecked(plugin.settings.data.visiblePropertiesList?.includes(taskPropertiesNames.DescriptionMinimized));
			});
		});

		// Use native event if available (React event has nativeEvent property)
		propertyMenu.showAtMouseEvent(
			(event instanceof MouseEvent ? event : event.nativeEvent)
		);
	}

	function handleViewSelect(index: number) {
		if (index !== currentViewIndex) {
			setSearchQuery("");
			plugin.settings.data.searchQuery = "";
			setCurrentViewIndex(index);

			// Update the board's lastViewId to persist view selection
			if (boardData?.views && index >= 0 && index < boardData.views.length) {
				const updatedBoard = { ...boardData };
				updatedBoard.lastViewId = boardData.views[index].viewId;
				setCurrentBoardData(updatedBoard);
				plugin.taskBoardFileManager.debouncedSaveBoard(updatedBoard);
			}

			setTimeout(() => {
				eventEmitter.emit("REFRESH_BOARD");
				// plugin.saveSettings();
			}, 100);
		}
		// closeBoardSidebar(); // Close sidebar after selection
	}

	function toggleBoardSidebar() {
		if (showViewsPanel) {
			closeBoardSidebar();
		} else {
			openBoardSidebar();
		}
	}

	function openBoardSidebar() {
		setshowViewsPanel(true);
		setSidebarAnimating(true);
	}

	function closeBoardSidebar() {
		setSidebarAnimating(false);
		// Wait for animation to complete before hiding
		setTimeout(() => {
			setshowViewsPanel(false);
		}, 300); // Match animation duration
	}

	function openHeaderMoreOptionsMenu(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
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
			item.setTitle(t("show-hide-properties"));
			item.setIcon("list");
			item.onClick(async () => {
				handlePropertiesBtnClick(event);
			});
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("open-board-filters-modal"));
			item.setIcon(funnelIcon);
			item.onClick(async () => {
				handleFilterButtonClick(event);
			});
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("open-board-configuration-modal"));
			item.setIcon("settings");
			item.onClick(async () => {
				openBoardConfigModal(plugin, currentBoardData, currentViewIndex, (updatedBoard: Board) => {
					// handleUpdateBoards(plugin, updatedBoards, setCurrentBoardData)
					setCurrentBoardData(updatedBoard);
					plugin.taskBoardFileManager.saveBoard(updatedBoard);

					setTimeout(() => {
						eventEmitter.emit("REFRESH_BOARD");
					}, 100);
				}
				)
			});
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("scan-vault-modal"));
			item.setIcon(ScanVaultIcon);
			item.onClick(async () => {
				openScanVaultModal(plugin);
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
			item.setIcon("network");
			item.onClick(async () => {
				eventEmitter.emit("SWITCH_VIEW", 'map');
			});
		});

		// Use native event if available (React event has nativeEvent property)
		sortMenu.showAtMouseEvent(
			(event instanceof MouseEvent ? event : event.nativeEvent)
		);
	}

	// DEPRECATED: This function is no longer used since we have moved view switching to the header menu for better discoverability. We can remove this in future iterations.
	// function handleViewChangeDropdownClick(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
	// 	const viewMenu = new Menu();

	// 	setTimeout(() => {
	// 		eventEmitter.emit("SAVE_MAP");
	// 	}, 200)

	// 	// Show all available views in the current board
	// 	if (boardData && boardData.views && boardData.views.length > 0) {
	// 		boardData.views.forEach((view) => {
	// 			viewMenu.addItem((item) => {
	// 				item.setTitle(view.viewName);
	// 				const icon = view.viewType === viewTypeNames.kanban ? "square-kanban" : "network";
	// 				item.setIcon(icon);
	// 				item.onClick(async () => {
	// 					setCurrentViewId(view.viewId);
	// 					plugin.settings.data.lastViewHistory.currentViewId = view.viewId;
	// 					plugin.saveSettings();
	// 					eventEmitter.emit("SWITCH_VIEW", view.viewId);
	// 				});
	// 				// Mark current view as checked
	// 				if (view.viewId === currentViewId) {
	// 					item.setChecked(true);
	// 				}
	// 			});
	// 		});
	// 	} else {
	// 		viewMenu.addItem((item) => {
	// 			item.setTitle(t("no-views-available"));
	// 			item.setDisabled(true);
	// 		});
	// 	}

	// 	// Use native event if available (React event has nativeEvent property)
	// 	viewMenu.showAtMouseEvent(
	// 		(event instanceof MouseEvent ? event : event.nativeEvent)
	// 	);
	// }

	// useEffect(() => {
	// 	const taskBoardLeaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_TASKBOARD)[0];
	// 	if (taskBoardLeaf) {
	// 		console.log("View width :", taskBoardLeaf.width);
	// 	}
	// }, [viewWidth]);

	// Close sidebar when clicking outside or pressing escape
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape' && showViewsPanel) {
				closeBoardSidebar();
			}
		}

		if (showViewsPanel) {
			document.addEventListener('keydown', handleKeyDown);
			return () => document.removeEventListener('keydown', handleKeyDown);
		}
	}, [showViewsPanel]);

	const viewTypeIconComponent = (viewTypeName: string | undefined, size: number) => {
		let viewType = viewTypeName ?? boardData.views[currentViewIndex].viewType;
		switch (viewType) {
			case viewTypeNames.kanban:
				return <SquareKanban size={size} strokeWidth={1.5} />;
			case viewTypeNames.map:
				return <Network size={size - 2} strokeWidth={1.5} />;
			default:
				return <BrickWall size={size - 2} strokeWidth={1.5} />;
		}
	}

	return (
		<div className="taskBoardView">
			<button
				className="taskBoardHeaderPluginIconBtn"
				onClick={toggleBoardSidebar}
				aria-label={t("toggle-view-drawer")}
			>
				<BrickWall className="taskBoardHeaderPluginIcon" size={24} strokeWidth={1.5} />
			</button>

			{/* Drawer opened from the left side */}
			<div
				className={`boardSidebarDrawer ${showViewsPanel ? 'boardSidebarDrawer--open' : 'boardSidebarDrawer--closed'}`}
				onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside sidebar
				style={{ width: `${showViewsPanel ? boardData.viewsPanel.width : 0}px` }}
			>
				<div className="boardSidebar">
					<div className="boardSidebarBoardHeader">
						<h3>{boardData.name}</h3>
						<p>{boardData.description}</p>
					</div>

					<div className="boardSidebarViewHeader">
						<p>{t("your-views")}</p>
						<div className="boardSidebarViewHeaderButtons">
							<button
								className="boardSidebarViewHeaderViewsOptionsBtn"
								onClick={(event) => {
									const propertyMenu = new Menu();

									propertyMenu.addItem((item) => {
										item.setTitle(t("details"));
										const detailsSubMenu = item.setSubmenu();
										detailsSubMenu.addItem((item) => {
											item.setTitle(t("description"));
											item.setIcon("");
											item.setChecked(boardData.viewsPanel.propertiesToShow.contains(viewsPanelPropertiesToShow.Description))
											item.onClick(async () => {
												if (boardData.viewsPanel.propertiesToShow.contains(viewsPanelPropertiesToShow.Description)) {
													boardData.viewsPanel.propertiesToShow = boardData.viewsPanel.propertiesToShow.filter(prop => prop !== viewsPanelPropertiesToShow.Description);
												} else {
													boardData.viewsPanel.propertiesToShow.push(viewsPanelPropertiesToShow.Description);
												}
												setCurrentBoardData({ ...boardData });
												plugin.taskBoardFileManager.saveBoard(boardData);
												setTimeout(() => {
													eventEmitter.emit("REFRESH_BOARD");
												}, 100);
											});
										});
										detailsSubMenu.addItem((item) => {
											item.setTitle(t("progress"));
											item.setIcon("");
											item.setChecked(boardData.viewsPanel.propertiesToShow.contains(viewsPanelPropertiesToShow.progress))
											item.onClick(async () => {
												if (boardData.viewsPanel.propertiesToShow.contains(viewsPanelPropertiesToShow.progress)) {
													boardData.viewsPanel.propertiesToShow = boardData.viewsPanel.propertiesToShow.filter(prop => prop !== viewsPanelPropertiesToShow.progress);
												} else {
													boardData.viewsPanel.propertiesToShow.push(viewsPanelPropertiesToShow.progress);
												}
												setCurrentBoardData({ ...boardData });
												plugin.taskBoardFileManager.saveBoard(boardData);
												setTimeout(() => {
													eventEmitter.emit("REFRESH_BOARD");
												}, 100);
											});
										});

										// Use native event if available (React event has nativeEvent property)
										propertyMenu.showAtMouseEvent(
											(event instanceof MouseEvent ? event : event.nativeEvent));
									});
								}}
								aria-label={t("panel-options")}
							>
								<EllipsisVertical size={18} strokeWidth={1.5} />
							</button>
							<button
								className="boardSidebarViewHeaderViewsConfigureBtn"
								onClick={() =>
									openBoardConfigModal(plugin, currentBoardData, currentViewIndex, (updatedBoard: Board) => {
										// handleUpdateBoards(plugin, updatedBoards, setCurrentBoardData)
										setCurrentBoardData(updatedBoard);
										plugin.taskBoardFileManager.saveBoard(updatedBoard);

										setTimeout(() => {
											eventEmitter.emit("REFRESH_BOARD");
										}, 100);
									})
								}
								aria-label={t("configure-views")}
							>
								<Settings size={18} strokeWidth={1.5} />
							</button>
						</div>
					</div>

					<div className="boardSidebarContent">
						{boardData.views.length === 0 ? (
							<div className="noViewsMessage">
								{t("no-views-created-yet")}
							</div>
						) : (
							<div className="boardSidebarContentBtnContainer">
								{boardData.views.map((view, index) => (
									<div
										key={index}
										className={`boardSidebarCard ${index === currentViewIndex ? 'boardSidebarCard--active' : ''}`}
										onClick={() => handleViewSelect(index)}
									>
										<div className="boardSidebarCardTitle" >
											{viewTypeIconComponent(view.viewType, 20)}
											{view.viewName}
										</div>
										{boardData.viewsPanel.propertiesToShow.contains(viewsPanelPropertiesToShow.Description) && (
											<div className="boardSidebarCardDescription" >
												{view?.description}
											</div>
										)}
										{boardData.viewsPanel.propertiesToShow.contains(viewsPanelPropertiesToShow.progress) && (
											<div className="taskCountContainerProgress" >
												<div className={"taskCountContainerProgressBar"}>
													<div
														className="taskCountContainerProgressBarIndicator"
														style={{
															width: `${((view.taskCount.completed) / (view.taskCount.pending + view.taskCount.completed)) * 100}%`,
														}}
													/>
												</div>
												<span className="taskCountContainerProgressCount">
													{(view.taskCount.completed)} / {view.taskCount.pending + view.taskCount?.completed}
												</span>
											</div>
										)}
									</div>
								))}
							</div>
						)}
						{/* <div className="boardSidebarFooter">
							<button
								className="boardConfigureBtn"
								onClick={() =>
									openBoardConfigModal(plugin, currentBoardData, currentViewIndex, (updatedBoard: Board) => {
										// handleUpdateBoards(plugin, updatedBoards, setCurrentBoardData)
										setCurrentBoardData(updatedBoard);
										plugin.taskBoardFileManager.saveBoard(updatedBoard);

										setTimeout(() => {
											eventEmitter.emit("REFRESH_BOARD");
										}, 100);
									}
									)
								}
							>
								{t("configure-views")}
							</button>
						</div> */}
					</div>
				</div>
			</div>

			{/* Main content area with smooth transition */}
			<div className="taskBoardMainContent">
				<div className="taskBoardHeader">
					<div className="taskBoardHeaderLeftSec">
						{boardData.views && boardData.views.length > 0 ? (
							<>
								{!showViewsPanel && showAllElements ? (
									<div className="viewSwitcherBar">
										{boardData.views.map((view, index) => (
											<button
												key={index}
												className={`viewTitleButton${index === currentViewIndex ? "Active" : ""}`}
												onClick={() => handleViewSelect(index)}
											>
												{viewTypeIconComponent(view.viewType, 18)}
												{view.viewName}
											</button>
										))}
									</div>
								) : (
									<div className="mobileBoardHeader">
										{!showSearchInput && (
											<span className="currentViewName">{currentView.viewName}</span>
										)}
									</div>
								)}
							</>
						) : (
							<div className="mobileBoardHeader">
								{!showSearchInput && (
									<span className="currentViewName">{t("no-view-created")}</span>
								)}
							</div>
						)}
					</div>

					<div className="taskBoardHeaderRightSec">
						<div className="taskCountContainer">
							<div className={`taskCountContainerProgressBar${isMobileView ? "-hidden" : ""}`}>
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
							aria-label={t("show-hide-properties")}
							onClick={handlePropertiesBtnClick}
						>
							<List size={18} />
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
								openBoardConfigModal(plugin, currentBoardData, currentViewIndex, (updatedBoard: Board) => {
									// handleUpdateBoards(plugin, updatedBoards, setCurrentBoardData)
									setCurrentBoardData(updatedBoard);
									plugin.taskBoardFileManager.saveBoard(updatedBoard);

									setTimeout(() => {
										eventEmitter.emit("REFRESH_BOARD");
									}, 100);
								}
								)}
						>
							<Settings size={18} />
						</button>

						{/* <button className="taskboardActionshBtn" aria-label={t("task-board-actions-button")} onClick={handleOpenTaskBoardActionsModal}>
						<Bot size={20} />
					</button> */}

						{/* <div
						className={`taskBoardViewDropdown ${(isMobileView || Platform.isMobile) ? "taskBoardViewHeaderHideElements" : ""}`}
						onClick={(e) => handleViewChangeDropdownClick(e)}
					>
						<div className="taskBoardViewDropdownIcon">
							{viewTypeIconComponent()}
						</div>
						<div className="taskBoardViewDropdownName">{currentView?.viewName || "Unknown"}</div>
					</div> */}

						{currentView && currentView.viewType === viewTypeNames.map && (
							<button
								className={`taskBoardMapViewSaveIcon${mapViewDataUpdated ? ' red' : ""}`}
								onClick={(e) => {
									if (mapViewDataUpdated) {
										console.log("Emitting SAVE_MAP event...");
										eventEmitter.emit("SAVE_MAP");
										setMapViewDataUpdated(false);
									}
								}}
							>
								<Save size={18} />
							</button>
						)}

						<button className={`RefreshBtn ${Platform.isMobile ? "taskBoardViewHeaderHideElements" : ""}${editorModified ? "needrefresh" : ""}`} aria-label={t("refresh-board-button")} onClick={refreshBoardButton}>
							<RefreshCcw size={18} />
						</button>

						{(isMobileView || Platform.isMobile) && (
							<button className="taskBoardViewHeaderOptionsBtn" onClick={openHeaderMoreOptionsMenu}>
								<EllipsisVertical size={20} />
							</button>
						)}
					</div>
				</div>

				<div className={`taskBoardViewSectionWrapper ${showViewsPanel && boardData.views && boardData.views.length > 0 && !showAllElements ? 'taskBoardViewSectionWrapper--shifted' : ''}`}>
					<div className={Platform.isMobile ? "taskBoardViewSection-mobile" : "taskBoardViewSection"}>
						{boardData && currentView ? (
							currentView.viewType === viewTypeNames.kanban ? (
								<KanbanBoard
									plugin={plugin}
									currentBoardData={boardData}
									currentView={currentView}
									currentViewIndex={currentViewIndex}
									filteredAndSearchedTasks={filteredAndSearchedTasks}
									freshInstall={freshInstall}
								/>
							) : currentView.viewType === viewTypeNames.map ? (
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
										activeBoardData={boardData}
										currentView={currentView}
										currentViewIndex={currentViewIndex}
										filteredTasks={filteredAndSearchedTasks}
										focusOnTaskId={plugin.settings.data.lastViewHistory.taskId || ""}
									/>
								)
							) : (
								<div className="emptyBoardMessage">
									{/* Placeholder for other view types */}
									{"Unknown view type: " + currentView.viewType}
								</div>
							)
						) : (
							<div className="emptyBoardMessage">
								{boardData && boardData.views?.length === 0 ? "No views available in this board." : "Select or create a board to get started."}
							</div>
						)}
					</div>
				</div>
			</div>
		</div >
	);
};

export default TaskBoardViewContainer;
