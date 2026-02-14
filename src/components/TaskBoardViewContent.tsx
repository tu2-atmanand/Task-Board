// src/components/TaskBoardViewContent.tsx

import { Board, ColumnData, RootFilterState } from "../interfaces/BoardConfigs";
import { CirclePlus, RefreshCcw, Search, SearchX, Filter, Menu as MenuICon, Settings, EllipsisVertical, List, KanbanSquareIcon, Network, BrickWall, KanbanSquare, SquareKanban } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadBoardsData, loadTasksAndMerge } from "src/utils/JsonFileOperations";
import { taskJsonMerged } from "src/interfaces/TaskItem";

import { App, debounce, Platform, Menu } from "obsidian";
import type TaskBoard from "main";
import { eventEmitter } from "src/services/EventEmitter";
import { handleUpdateBoards } from "../utils/BoardOperations";
import { openAddNewTaskModal, openBoardConfigModal, openScanVaultModal, openTaskBoardActionsModal } from "../services/OpenModals";
import { columnSegregator } from 'src/utils/algorithms/ColumnSegregator';
import { t } from "src/utils/lang/helper";
import KanbanBoard from "./KanbanView/KanbanBoardView";
import MapView from "./MapView/MapView";
import { VIEW_TYPE_TASKBOARD } from "src/interfaces/Constants";
import { ViewTaskFilterPopover } from "./BoardFilters/ViewTaskFilterPopover";
import { boardFilterer } from "src/utils/algorithms/BoardFilterer";
import { ViewTaskFilterModal } from 'src/components/BoardFilters';
import { taskPropertiesNames, viewTypeNames } from "src/interfaces/Enums";
import { ScanVaultIcon, funnelIcon } from "src/interfaces/Icons";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";

const TaskBoardViewContent: React.FC<{ app: App; plugin: TaskBoard; boardConfigs: Board[] }> = ({ app, plugin, boardConfigs }) => {
	const [boards, setBoards] = useState<Board[]>(boardConfigs);
	const [activeBoardIndex, setActiveBoardIndex] = useState(plugin.settings.data.globalSettings.lastViewHistory.boardIndex ?? 0);
	const [allTasks, setAllTasks] = useState<taskJsonMerged>();
	const [filteredTasks, setFilteredTasks] = useState<taskJsonMerged | null>(null);
	const [viewType, setViewType] = useState<string>(plugin.settings.data.globalSettings.lastViewHistory.viewedType || viewTypeNames.kanban);

	const [refreshCount, setRefreshCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [freshInstall, setFreshInstall] = useState(false);
	const [showSearchInput, setShowSearchInput] = useState(plugin.settings.data.globalSettings.searchQuery ? true : false);
	const [searchQuery, setSearchQuery] = useState(plugin.settings.data.globalSettings.searchQuery ?? "");

	const filterPopoverRef = useRef<ViewTaskFilterPopover | null>(null);

	const [showAllElements, setShowAllElements] = useState(true);
	const [leafWidth, setLeafWidth] = useState<number>(1000);
	const [isMobileView, setIsMobileView] = useState(false);
	const [showBoardSidebar, setShowBoardSidebar] = useState(false);
	const [sidebarAnimating, setSidebarAnimating] = useState(false);
	const [editorModified, setEditorModified] = useState(plugin.editorModified);

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
				bugReporterManagerInsatance.addToLogs(
					131,
					`No need to worry about this bug, if its appearing on the fresh install.\n${String(error)}`,
					"TaskBoardViewContent.tsx/loading boards and tasks useEffect",
				);
				setFreshInstall(true);
			}
		};

		fetchData();
	}, [refreshCount]);

	// First memo: Filter tasks by board filter and search query (but don't segregate by column yet)
	const filteredAndSearchedTasks = useMemo(() => {
		if (allTasks && boards[activeBoardIndex]) {
			const currentBoard = boards[activeBoardIndex];
			const boardFilter = currentBoard.boardFilter;

			// Apply board filters to tasks
			const boardFilteredTasks = {
				...allTasks,
				Pending: boardFilterer(allTasks.Pending, boardFilter),
				Completed: boardFilterer(allTasks.Completed, boardFilter),
			};

			// Update task count in settings
			plugin.settings.data.boardConfigs[activeBoardIndex].taskCount = {
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
	}, [allTasks, activeBoardIndex, searchQuery]);

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
				bugReporterManagerInsatance.showNotice(28, "Error loading tasks on column refresh", String(error), "TaskBoardViewContent.tsx/debouncedRefreshColumn");
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
		}, 100)
	}, []);

	function handleOpenAddNewTaskModal() {
		openAddNewTaskModal(app, plugin);
	}

	function handleOpenTaskBoardActionsModal() {
		openTaskBoardActionsModal(plugin, activeBoardIndex);
	}

	function handleSearchButtonClick() {
		if (showSearchInput) {
			setSearchQuery("");
			// el.currentTarget.focus();
			plugin.settings.data.globalSettings.searchQuery = "";

			eventEmitter.emit("REFRESH_COLUMN");
			plugin.saveSettings();
			setShowSearchInput(false);
		} else {
			setSearchQuery(plugin.settings.data.globalSettings.searchQuery || "");
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
				plugin.settings.data.globalSettings.searchQuery = lowerQuery;
				plugin.saveSettings();
			}, 100);
		}

		return searchFilteredTasks;
	}

	function handleFilterButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
		try {
			const currentBoardConfig = boards[activeBoardIndex];
			if (Platform.isMobile || Platform.isMacOS) {
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
				const buttonRect = event.currentTarget?.getBoundingClientRect();
				const position = {
					x: buttonRect?.left ?? 100,
					y: buttonRect?.bottom ?? 100
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
			bugReporterManagerInsatance.showNotice(29, "Error showing filter popover", String(error), "TaskBoardViewContent.tsx/handleFilterButtonClick");
		}
	}

	function togglePropertyNameInSettings(propertyName: string) {
		let visibleProperties = plugin.settings.data.globalSettings.visiblePropertiesList || [];

		if (visibleProperties.includes(propertyName)) {
			visibleProperties.splice(visibleProperties.indexOf(propertyName), 1);
			plugin.settings.data.globalSettings.visiblePropertiesList = visibleProperties;

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

			plugin.settings.data.globalSettings.visiblePropertiesList = visibleProperties;
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
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.ID))
		});

		propertyMenu.addItem((item) => {
			item.setTitle(t("checkbox"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Checkbox);
			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.Checkbox))
		});

		propertyMenu.addItem((item) => {
			item.setTitle(t("status"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Status);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.Status))
		});

		propertyMenu.addItem((item) => {
			item.setTitle(t("priority"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Priority);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.Priority))
		});

		propertyMenu.addItem((item) => {
			item.setTitle(t("tags"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Tags);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.Tags))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("time"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Time);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.Time))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("reminder"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Reminder);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.Reminder))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("created-date"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.CreatedDate);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.CreatedDate))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("start-date"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.StartDate);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.StartDate))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("scheduled-date"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.ScheduledDate);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.ScheduledDate))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("due-date"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.DueDate);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.DueDate))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("completed-date"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.CompletionDate);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.CompletionDate))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("cancelled-date"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.CancelledDate);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.CancelledDate))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("dependencies"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.Dependencies);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.Dependencies))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("file-name"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.FilePath);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.FilePath))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("file-name-in-header"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.FilePathInHeader);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.FilePathInHeader))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("parent-folder"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.ParentFolder);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.ParentFolder))
		});
		propertyMenu.addItem((item) => {
			item.setTitle(t("full-path"));
			item.onClick(async () => {
				togglePropertyNameInSettings(taskPropertiesNames.FullPath);

			})
			item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.FullPath))
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
				item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.SubTasks));
			});

			subTasksMenu.addItem((item) => {
				item.setTitle(t("minimized"))
				item.onClick(async () => {
					togglePropertyNameInSettings(taskPropertiesNames.SubTasksMinimized);

				})
				item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.SubTasksMinimized));
			});

			// subTasksMenu.addItem((item) => {
			// 	item.setTitle(t("hidden"))
			// 	item.onClick(async () => {
			// 		togglePropertyNameInSettings(taskPropertiesNames.SubTasks);
			// 		togglePropertyNameInSettings(taskPropertiesNames.SubTasksMinimized);

			// 	})
			// 	item.setChecked(!plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.SubTasks) && !plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.SubTasksMinimized));
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
				item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.Description));
			});

			subTasksMenu.addItem((item) => {
				item.setTitle(t("minimized"))
				item.onClick(async () => {
					togglePropertyNameInSettings(taskPropertiesNames.DescriptionMinimized);
					plugin.saveSettings();

				})
				item.setChecked(plugin.settings.data.globalSettings.visiblePropertiesList?.includes(taskPropertiesNames.DescriptionMinimized));
			});
		});

		// Use native event if available (React event has nativeEvent property)
		propertyMenu.showAtMouseEvent(
			(event instanceof MouseEvent ? event : event.nativeEvent)
		);
	}

	function handleBoardSelection(index: number) {
		if (index !== activeBoardIndex) {
			setSearchQuery("");
			plugin.settings.data.globalSettings.searchQuery = "";
			plugin.settings.data.globalSettings.lastViewHistory.boardIndex = index;
			setActiveBoardIndex(index);
			setTimeout(() => {
				eventEmitter.emit("REFRESH_BOARD");
				plugin.saveSettings();
			}, 100);

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

	function handleViewChangeDropdownClick(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
		const viewMenu = new Menu();

		viewMenu.addItem((item) => {
			item.setTitle(t("kanban-view"));
			item.setIcon("square-kanban");
			item.onClick(async () => {
				const newViewType = viewTypeNames.kanban;
				setViewType(newViewType);
				plugin.settings.data.globalSettings.lastViewHistory.viewedType = newViewType;
				plugin.saveSettings();
			});
		});

		viewMenu.addItem((item) => {
			item.setTitle(t("map-view"));
			item.setIcon("network");
			item.onClick(async () => {
				const newViewType = viewTypeNames.map;
				setViewType(newViewType);
				plugin.settings.data.globalSettings.lastViewHistory.viewedType = newViewType;
				plugin.saveSettings();
			});
		});

		// Use native event if available (React event has nativeEvent property)
		viewMenu.showAtMouseEvent(
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

	const viewTypeIconComponent = () => {
		switch (viewType) {
			case viewTypeNames.kanban:
				return <SquareKanban size={20} />;
			case viewTypeNames.map:
				return <Network size={18} />;
			default:
				return <BrickWall size={18} />;
		}
	}

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

					<div
						className={`taskBoardViewDropdown ${(isMobileView || Platform.isMobile) ? "taskBoardViewHeaderHideElements" : ""}`}
						onClick={(e) => {
							handleViewChangeDropdownClick(e)
						}}
					>
						<div className="taskBoardViewDropdownIcon">
							{viewTypeIconComponent()}
						</div>
						<div className="taskBoardViewDropdownName">{t(viewType)}</div>
					</div>

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
							filteredAndSearchedTasks={filteredAndSearchedTasks}
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
								activeBoardIndex={activeBoardIndex}
								filteredTasks={filteredAndSearchedTasks}
								focusOnTaskId={plugin.settings.data.globalSettings.lastViewHistory.taskId || ""}
							/>
						)
					) : (
						<div className="emptyBoardMessage">
							{/* Placeholder for other view types */}
							{viewType === "list" && "List view coming soon."}
							{viewType === "table" && "Table view coming soon."}
							{viewType === "inbox" && "Inbox view coming soon."}
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
