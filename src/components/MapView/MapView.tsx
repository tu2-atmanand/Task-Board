// /src/components/MapView/MapView.tsx

import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import {
	ReactFlow,
	ReactFlowProvider,
	useNodesState,
	Controls,
	Background,
	Node,
	Edge,
	Connection,
	MarkerType,
	BackgroundVariant,
	SelectionMode,
	ControlButton,
} from '@xyflow/react';
// import '@xyflow/react/dist/style.css';
import { taskItem, UpdateTaskEventData } from 'src/interfaces/TaskItem';
import TaskBoard from 'main';
import ResizableNodeSelected from './ResizableNodeSelected';
import TaskItem from '../KanbanView/TaskItem';
import { updateTaskInFile } from 'src/utils/taskLine/TaskItemUtils';
import { debounce, Menu, Notice, Platform } from 'obsidian';
import { NODE_POSITIONS_STORAGE_KEY, NODE_SIZE_STORAGE_KEY, VIEWPORT_STORAGE_KEY } from 'src/interfaces/Constants';
import { sanitizeDependsOn } from 'src/utils/taskLine/TaskContentFormatter';
import { t } from 'src/utils/lang/helper';
import { MapViewMinimap } from './MapViewMinimap';
import { mapViewArrowDirection, mapViewBackgrounVariantTypes, mapViewScrollAction } from 'src/interfaces/Enums';
import { eventEmitter } from 'src/services/EventEmitter';
import { bugReporter } from 'src/services/OpenModals';
import { PanelLeftOpenIcon } from 'lucide-react';
import { TasksImporterPanel } from './TasksImporterPanel';
import { isTaskNotePresentInTags, updateFrontmatterInMarkdownFile } from 'src/utils/taskNote/TaskNoteUtils';
import { isTaskCompleted } from 'src/utils/CheckBoxUtils';

type MapViewProps = {
	plugin: TaskBoard;
	activeBoardIndex: number;
	allTasksArranged: taskItem[][];
	// loading: boolean;
	// freshInstall: boolean;
	focusOnTaskId?: string;
};

export type viewPort = {
	x: number;
	y: number;
	zoom: number;
}

export type nodeSize = {
	width: number;
	// height: number;
}

export type nodePosition = {
	x: number;
	y: number;
}

const nodeTypes = {
	// CustomNodeResizer,
	ResizableNodeSelected,
};


const MapView: React.FC<MapViewProps> = ({
	plugin, activeBoardIndex, allTasksArranged, focusOnTaskId
}) => {
	plugin.settings.data.globalSettings.lastViewHistory.taskId = ""; // Clear the taskId after focusing once
	const mapViewSettings = plugin.settings.data.globalSettings.mapView;
	const taskNoteIdentifierTag = plugin.settings.data.globalSettings.taskNoteIdentifierTag;

	const userBackgroundVariant: BackgroundVariant | undefined = (() => {
		switch (mapViewSettings.background) {
			case mapViewBackgrounVariantTypes.dots:
				return BackgroundVariant.Dots;
			case mapViewBackgrounVariantTypes.lines:
				return BackgroundVariant.Lines;
			case mapViewBackgrounVariantTypes.cross:
				return BackgroundVariant.Cross;
			default:
				return undefined;
		}
	})();
	const tagColors = plugin.settings.data.globalSettings.tagColors;
	const activeBoardSettings = plugin.settings.data.boardConfigs[activeBoardIndex];

	// Loading state for localStorage data
	const [storageLoaded, setStorageLoaded] = useState(false);
	const [positions, setPositions] = useState<Record<string, nodePosition>>({});
	const [nodeSizes, setNodeSizes] = useState<Record<string, nodeSize>>({});
	const [viewport, setViewport] = useState<Record<number, viewPort>>({});

	// Track when board changes to force node recalculation
	const [boardChangeKey, setBoardChangeKey] = useState(0);

	// Task importer panel state
	const [isImporterPanelVisible, setIsImporterPanelVisible] = useState(false);

	// ReactFlow instance ref so we can programmatically set viewport when switching boards
	const reactFlowInstanceRef = useRef<any | null>(null);

	// Load positions from localStorage, board-wise
	const loadPositions = () => {
		let allBoardPositions: Record<string, Record<string, nodePosition>> = {};
		try {
			const stored = localStorage.getItem(NODE_POSITIONS_STORAGE_KEY);
			if (stored) {
				allBoardPositions = JSON.parse(stored);
				// Validate the structure
				if (typeof allBoardPositions !== 'object' || allBoardPositions === null) {
					allBoardPositions = {};
				}
			}
		} catch (error) {
			console.warn('Failed to load node positions from localStorage:', error);
			allBoardPositions = {};
		}

		try {
			const boardPositions = allBoardPositions[activeBoardIndex];
			if (typeof boardPositions === 'object' && boardPositions !== null) {
				return boardPositions;
			}
			return {};
		} catch (error) {
			console.warn('Failed to get positions for board', activeBoardIndex, ':', error);
			return {};
		}
	};

	// Load node sizes from localStorage
	const loadNodeSizes = () => {
		try {
			const stored = localStorage.getItem(NODE_SIZE_STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (typeof parsed === 'object' && parsed !== null) {
					return parsed as Record<string, nodeSize>;
				}
			}
			return {};
		} catch (error) {
			console.warn('Failed to load node sizes from localStorage:', error);
			return {};
		}
	};

	// Viewport state (board-wise)
	const loadViewport = (): Record<string, viewPort> => {
		try {
			const stored = localStorage.getItem(VIEWPORT_STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (typeof parsed === 'object' && parsed !== null) {
					return parsed as Record<string, viewPort>;
				}
			}
			return { [activeBoardIndex]: { x: 10, y: 10, zoom: 1.5 } };
		} catch (error) {
			console.warn('Failed to load viewport from localStorage:', error);
			return { [activeBoardIndex]: { x: 10, y: 10, zoom: 1.5 } };
		}
	};


	// Load all storage data on mount and when activeBoardIndex changes
	useEffect(() => {
		setStorageLoaded(false);
		// Load and sanitize positions
		const pos = loadPositions();
		const sanitizedPositions: Record<string, nodePosition> = {};
		Object.keys(pos).forEach(id => {
			sanitizedPositions[id] = {
				x: Number.isFinite(pos[id]?.x) ? pos[id].x : 0,
				y: Number.isFinite(pos[id]?.y) ? pos[id].y : 0
			};
		});
		setPositions(sanitizedPositions);

		// Load and sanitize node sizes
		const sizes = loadNodeSizes();
		const sanitizedSizes: Record<string, nodeSize> = {};
		Object.keys(sizes).forEach(id => {
			sanitizedSizes[id] = {
				width: Number.isFinite(sizes[id]?.width) && sizes[id].width > 0 ? sizes[id].width : 300
			};
		});
		setNodeSizes(sanitizedSizes);

		// Load and sanitize viewport (board-wise)
		const vpMap = loadViewport();
		const rawForBoard = vpMap[activeBoardIndex] || { x: 10, y: 10, zoom: 1.5 };
		const sanitizedForBoard: viewPort = {
			x: Number.isFinite(rawForBoard.x) ? rawForBoard.x : 10,
			y: Number.isFinite(rawForBoard.y) ? rawForBoard.y : 10,
			zoom: Number.isFinite(rawForBoard.zoom) ? rawForBoard.zoom : 1.5
		};
		setViewport(prev => ({ ...vpMap, [activeBoardIndex]: sanitizedForBoard }));

		setStorageLoaded(true);
		// Increment board change key to force initialNodes recalculation
		setBoardChangeKey(prev => prev + 1);
	}, [activeBoardIndex]);


	// const reactFlowInstance = useReactFlow();
	// useEffect(() => {
	// 	// Set initial viewport (x, y, zoom)
	// 	reactFlowInstance.setViewport({ x: positions[0].x, y: positions[0].y, zoom: 1 });
	// }, []);


	// Kanban-style initial layout, memoized
	const initialNodes: Node[] = useMemo(() => {
		// Don't calculate nodes until storage data is loaded
		if (!storageLoaded) {
			return [];
		}

		const newNodes: Node[] = [];
		const usedIds = new Set<string>();
		const duplicateIds = new Set<string>();
		const columnSpacing = 350;
		const rowSpacing = 170;

		// Get default width with proper validation
		const getDefaultWidth = () => {
			try {
				const columnWidth = plugin.settings.data.globalSettings.columnWidth;
				if (!columnWidth || typeof columnWidth !== 'string') {
					return 300; // Fallback if missing or not a string
				}
				const cleaned = columnWidth.replace('px', '').trim();
				const parsed = Number(cleaned);
				if (Number.isFinite(parsed) && parsed > 0) {
					return parsed;
				}
			} catch (e) {
				console.warn('Error parsing columnWidth:', e);
			}
			return 300; // Fallback default width
		};
		const defaultWidth = getDefaultWidth();

		let xOffset = 0;
		allTasksArranged.forEach((columnTasks, colIdx) => {
			let yOffset = 0;
			columnTasks.forEach((task, rowIdx) => {
				if (task.legacyId) {
					const id = task.legacyId;
					if (usedIds.has(id)) {
						console.warn('Duplicate node id detected:', id, "\nTitle : ", task.title);
						duplicateIds.add(id);
						return; // Skip duplicate
					}
					usedIds.add(id);
					const savedPos = positions[id] || {};
					const savedSize = nodeSizes[id] || {};

					// Ensure width is always a valid number
					let nodeWidth = defaultWidth;
					if (savedSize.width && Number.isFinite(savedSize.width) && savedSize.width > 0) {
						nodeWidth = savedSize.width;
					}

					// Ensure positions are always valid finite numbers
					const nodeX = Number.isFinite(savedPos.x) ? savedPos.x : xOffset;
					const nodeY = Number.isFinite(savedPos.y) ? savedPos.y : yOffset;

					// Safety check: if computed offsets are somehow NaN, use fallback
					const safeX = Number.isFinite(nodeX) ? nodeX : (colIdx * 350);
					const safeY = Number.isFinite(nodeY) ? nodeY : (rowIdx * 170);

					newNodes.push({
						id,
						type: 'ResizableNodeSelected',
						data: {
							label: <TaskItem
								plugin={plugin}
								task={task}
								activeBoardSettings={activeBoardSettings}
							/>
						},
						position: {
							x: safeX,
							y: safeY
						},
						width: nodeWidth,
					});
					yOffset += rowSpacing;
				}

			});
			xOffset += columnSpacing;
		});

		if (duplicateIds.size > 0) {
			const stringOfListOfDuplicateIds = Array.from(duplicateIds).join(',');
			// bugReporter(plugin, `Following duplicate IDs has been found for tasks : "${stringOfListOfDuplicateIds}" detected in Map View. This may cause unexpected behavior. Please consider changing the IDs of these tasks.`, "ERROR: Same id is present on two tasks", "MapView.tsx/initialNodes");
			duplicateIds.clear();
		}

		return newNodes;
	}, [allTasksArranged, activeBoardSettings, activeBoardIndex, storageLoaded, boardChangeKey]);

	// Manage nodes state
	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

	// TODO : Its not a good idea to use debounce and allow stale data. I am already storing the data in localStorage on resize end in ResizableNodeSelected component. And there its much better as I can capture the final size directly based on the callback.
	// Custom handler that intercepts dimension changes and updates nodeSizes state
	// const handleNodesChange = (changes: NodeChange[]) => {
	// 	// First, apply the changes to ReactFlow's state
	// 	onNodesChange(changes);

	// 	updateSingleNodeSizeOnDiskDebounced(changes);

	// };

	// const updateSingleNodeSizeOnDiskDebounced = debounce(
	// 	async (changes: NodeChange[]): Promise<void> => {
	// 		if (changes.length !== 1 || changes[0].type !== "dimensions") return;

	// 		// Update nodeSizes state and localStorage
	// 		const updatedSizes = { ...nodeSizes };
	// 		let hasChanges = false;


	// 		if (changes[0].dimensions?.width) {
	// 			const nodeId = changes[0].id;
	// 			const newWidth = changes[0].dimensions.width;

	// 			// Only update if the width has actually changed
	// 			if (!updatedSizes[nodeId] || updatedSizes[nodeId].width !== newWidth) {
	// 				updatedSizes[nodeId] = { width: newWidth };
	// 				hasChanges = true;
	// 			}
	// 		}

	// 		if (hasChanges) {
	// 			// setNodeSizes(updatedSizes);
	// 			try {
	// 				localStorage.setItem(NODE_SIZE_STORAGE_KEY, JSON.stringify(updatedSizes));
	// 			} catch (error) {
	// 				console.warn('Failed to save node sizes:', error);
	// 			}
	// 		}
	// 	},
	// 	500
	// );

	// Reset nodes when initialNodes changes
	useEffect(() => {
		setNodes(initialNodes);
	}, [initialNodes, setNodes]);

	// When the active board or viewport data changes, apply the stored viewport to the ReactFlow instance.
	useEffect(() => {
		const instance = reactFlowInstanceRef.current;
		if (!instance) return;
		const vpForBoard = viewport[activeBoardIndex];
		if (vpForBoard && Number.isFinite(vpForBoard.x) && Number.isFinite(vpForBoard.y) && Number.isFinite(vpForBoard.zoom)) {
			try {
				instance.setViewport(vpForBoard);
			} catch (e) {
				// ignore - instance may be transitioning
			}
		}
	}, [activeBoardIndex, viewport]);

	// Calculate edges from dependsOn property
	// TODO : Might be efficient to make use of the addEdge api of reactflow.
	function getEdgesFromTasks(): Edge[] {
		const tasks: taskItem[] = allTasksArranged.flat();
		const edges: Edge[] = [];
		const idToTask = new Map<string, taskItem>();
		tasks.forEach(task => {
			const id = task.legacyId ? task.legacyId : String(task.id);
			idToTask.set(id, task);
		});

		// Calculate marker size based on zoom level (inverse scaling to keep visual size consistent)
		// const baseMarkerSize = 40;
		// const zoomLevel = Number.isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport.zoom : 1.5;
		// const scaledMarkerSize = baseMarkerSize / (zoomLevel > 1.2 ? 1 : (zoomLevel < 0.7 ? 1 : zoomLevel));
		// const safeMarkerSize = Number.isFinite(scaledMarkerSize) ? scaledMarkerSize : baseMarkerSize;

		// const minZ = 0.5;
		// const maxZ = 2;
		// const cssMin = 1.2; // value when zoom is maxZ
		// const cssMax = 1.5;   // value when zoom is minZ

		const vpForBoard = viewport[activeBoardIndex] || { x: 10, y: 10, zoom: 1.5 };
		const zoom = Number.isFinite(vpForBoard?.zoom) ? vpForBoard.zoom : 1.5;
		const clamped = Math.max(0.5, Math.min(2, zoom));
		const ratio = (clamped - 0.5) / (2 - 0.5); // 0..1
		const mapped = 1.5 - ratio * (1.5 - 1.2);
		// Keep a compact string value suitable for CSS variable
		const safeMarkerSize: number = Number.isFinite(mapped) ? 15 * mapped : 15;

		tasks.forEach(task => {
			const sourceId = task.legacyId ? task.legacyId : String(task.id);
			if (Array.isArray(task.dependsOn)) {
				task.dependsOn.forEach(depId => {
					if (idToTask.has(depId)) {
						const childTask = idToTask.get(depId);
						if (childTask) {
							const isChildTaskCompleted = isTaskNotePresentInTags(taskNoteIdentifierTag, childTask.tags) ?
								isTaskCompleted(childTask.status, true, plugin.settings)
								: isTaskCompleted(childTask.title, false, plugin.settings);
							edges.push({
								id: `${sourceId}->${depId}`,
								source: depId,
								target: sourceId,
								type: mapViewSettings.edgeType,
								animated: isChildTaskCompleted ? false : mapViewSettings.animatedEdges,
								style: {
									opacity: isChildTaskCompleted ? '50%' : "100%",
								},
								markerStart: {
									type: MarkerType.ArrowClosed, // required property
									// optional properties
									// color: 'var(--text-normal)',
									height: (mapViewSettings.arrowDirection !== mapViewArrowDirection.childToParent && Number.isFinite(safeMarkerSize)) ? safeMarkerSize : 0,
									width: (mapViewSettings.arrowDirection !== mapViewArrowDirection.childToParent && Number.isFinite(safeMarkerSize)) ? safeMarkerSize : 0,
								},
								markerEnd: {
									type: MarkerType.ArrowClosed, // required property
									// optional properties
									// color: 'var(--text-normal)',
									height: (mapViewSettings.arrowDirection !== mapViewArrowDirection.parentToChild && Number.isFinite(safeMarkerSize)) ? safeMarkerSize : 0,
									width: (mapViewSettings.arrowDirection !== mapViewArrowDirection.parentToChild && Number.isFinite(safeMarkerSize)) ? safeMarkerSize : 0,
								},
							});
						}
					}
				});
			}
		});
		return edges;
	}
	const edges = useMemo(() => getEdgesFromTasks(), [allTasksArranged]);

	const handleNodePositionChange = () => {
		let allBoardPositions: Record<string, Record<string, nodePosition>> = {};
		try {
			const stored = localStorage.getItem(NODE_POSITIONS_STORAGE_KEY);
			if (stored) {
				allBoardPositions = JSON.parse(stored);
				if (typeof allBoardPositions !== 'object' || allBoardPositions === null) {
					allBoardPositions = {};
				}
			}
		} catch (error) {
			console.warn('Failed to load existing positions:', error);
			allBoardPositions = {};
		}

		// Update positions for current board with validation
		const posMap = nodes.reduce((acc, n) => {
			const x = Number.isFinite(n.position?.x) ? n.position.x : 0;
			const y = Number.isFinite(n.position?.y) ? n.position.y : 0;
			acc[n.id] = { x, y };
			return acc;
		}, {} as Record<string, nodePosition>);

		setPositions(posMap);
		allBoardPositions[String(activeBoardIndex)] = posMap;

		try {
			localStorage.setItem(NODE_POSITIONS_STORAGE_KEY, JSON.stringify(allBoardPositions));
		} catch (error) {
			console.warn('Failed to save node positions:', error);
		}
	};

	// Persist updated positions and sizes
	// const prevNodeSizesRef = useRef<Record<string, { width: number; height: number }>>({});

	// Only save sizes if they have changed
	// useEffect(() => {
	// 	const sizeMap = nodes.reduce((acc, n) => {
	// 		acc[n.id] = { width: n.width ?? 300, height: n.height ?? 80 };
	// 		return acc;
	// 	}, {} as Record<string, { width: number; height: number }>);

	// 	// Compare with previous sizes
	// 	const prevSizes = prevNodeSizesRef.current;
	// 	let changed = false;
	// 	for (const id in sizeMap) {
	// 		if (
	// 			!prevSizes[id] ||
	// 			prevSizes[id].width !== sizeMap[id].width ||
	// 			prevSizes[id].height !== sizeMap[id].height
	// 		) {
	// 			changed = true;
	// 			break;
	// 		}
	// 	}

	// 	if (changed) {
	// 		setNodeSizes(sizeMap);
	// 		localStorage.setItem(NODE_SIZE_STORAGE_KEY, JSON.stringify(sizeMap));
	// 		prevNodeSizesRef.current = sizeMap;
	// 	}
	// }, [nodes]);

	// Handle edge creation (connecting nodes)
	const onConnect = useMemo<((params: Connection) => void)>(() => {
		const flattenedTasks = allTasksArranged.flat();
		return (params: Connection) => {
			connectParentToChild(params.source, params.target, flattenedTasks);
			// You may want to update the dependsOn property of the source task and trigger a re-render
		};
	}, [allTasksArranged]);

	// Function for connecting parent to child
	function connectParentToChild(sourceNodeId: string, targetNodeId: string, allTasks: taskItem[]) {
		// const allTasks = allTasksArranged.flat();
		// console.log("AllTasksArranged:", allTasksArranged);
		// console.log('Connecting', sourceNodeId, 'to', targetNodeId);
		// console.log('Source Task:', allTasks.find(t => t.legacyId === sourceNodeId || String(t.id) === sourceNodeId));
		// console.log('Target Task:', allTasks.find(t => t.legacyId === targetNodeId || String(t.id) === targetNodeId));

		const sourceTask = allTasks.find(t => t.legacyId === sourceNodeId || String(t.id) === sourceNodeId);
		if (!sourceTask) return;
		const targetTask = allTasks.find(t => t.legacyId === targetNodeId || String(t.id) === targetNodeId);
		if (!targetTask) return;

		const updatedTargetTask = {
			...targetTask,
			dependsOn: Array.isArray(targetTask.dependsOn) ? [...targetTask.dependsOn] : []
		};

		const sourceLegacyId = sourceTask.legacyId ? sourceTask.legacyId : String(sourceTask.id);
		// console.log('Adding dependency on targetLegacyId:', targetLegacyId);
		if (!updatedTargetTask.dependsOn.includes(sourceLegacyId)) {
			updatedTargetTask.dependsOn.push(sourceLegacyId);
			let eventData: UpdateTaskEventData = {
				taskID: updatedTargetTask.id,
				state: true,
			};
			eventEmitter.emit("UPDATE_TASK", eventData);
			if (!isTaskNotePresentInTags(taskNoteIdentifierTag, updatedTargetTask.tags)) {
				const updatedTargetTaskTitle = sanitizeDependsOn(plugin.settings.data.globalSettings, updatedTargetTask.title, updatedTargetTask.dependsOn);
				updatedTargetTask.title = updatedTargetTaskTitle;

				// console.log('Updated source task :', updatedSourceTask, "\nOld source task:", sourceTask);
				updateTaskInFile(plugin, updatedTargetTask, targetTask).then((newId) => {
					plugin.realTimeScanning.processAllUpdatedFiles(updatedTargetTask.filePath);
					setTimeout(() => {
						// This event emmitter will stop any loading animation of ongoing task-card.
						eventEmitter.emit("UPDATE_TASK", {
							taskID: updatedTargetTask.id,
							state: false,
						});
					}, 500);
				});
			} else {
				updateFrontmatterInMarkdownFile(plugin, updatedTargetTask).then(() => {
					// This is required to rescan the updated file and refresh the board.
					sleep(500).then(() => {
						plugin.realTimeScanning.processAllUpdatedFiles(
							updatedTargetTask.filePath
						);

						setTimeout(() => {
							// This event emmitter will stop any loading animation of ongoing task-card.
							eventEmitter.emit("UPDATE_TASK", {
								taskID: updatedTargetTask.id,
								state: false,
							});
						}, 500);
					});
				});
			}
		}
	}

	// Debounce utility
	// function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
	//   let timer: ReturnType<typeof setTimeout> | null = null;
	//   return ((...args: any[]) => {
	//     if (timer) clearTimeout(timer);
	//     timer = setTimeout(() => fn(...args), delay);
	//   }) as T;
	// }

	// function throttle<T extends (...args: any[]) => void>(fn: T, delay: number): T {
	// 	let lastCall = 0;
	// 	let timer: ReturnType<typeof setTimeout> | null = null;
	// 	let lastArgs: any[] | null = null;

	// 	return ((...args: any[]) => {
	// 		const now = Date.now();
	// 		if (now - lastCall >= delay) {
	// 			lastCall = now;
	// 			fn(...args);
	// 		} else {
	// 			lastArgs = args;
	// 			if (!timer) {
	// 				timer = setTimeout(() => {
	// 					lastCall = Date.now();
	// 					fn(...(lastArgs as any[]));
	// 					timer = null;
	// 					lastArgs = null;
	// 				}, delay - (now - lastCall));
	// 			}
	// 		}
	// 	}) as T;
	// }

	// const throttledSetViewportStorage = throttle((vp: viewPort) => {
	// 	console.log('Saving viewport:', vp);
	// 	localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(vp));
	// }, 20000);

	const lastViewportSaveTime = useRef(0);
	const debouncedSetViewportStorage = debounce((vp: viewPort) => {
		const now = Date.now();
		if (now - lastViewportSaveTime.current > 2000) {
			// Validate viewport values before saving
			const safeViewport: viewPort = {
				x: Number.isFinite(vp.x) ? vp.x : 10,
				y: Number.isFinite(vp.y) ? vp.y : 10,
				zoom: Number.isFinite(vp.zoom) && vp.zoom > 0 ? vp.zoom : 1.5
			};
			try {
				// Load existing map, update only current board entry
				const stored = localStorage.getItem(VIEWPORT_STORAGE_KEY);
				let parsed: Record<string, viewPort> = {};
				if (stored) {
					try {
						const p = JSON.parse(stored);
						if (typeof p === 'object' && p !== null) parsed = p;
					} catch (e) {
						parsed = {};
					}
				}
				parsed[activeBoardIndex] = safeViewport;
				localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(parsed));
				lastViewportSaveTime.current = now;
			} catch (error) {
				console.warn('Failed to save viewport:', error);
			}
		}
	}, 2000);


	const handlePaneContextMenu = (event: MouseEvent | React.MouseEvent) => {

		const sortMenu = new Menu();

		sortMenu.addItem((item) => {
			item.setTitle(t("add-new-task"));
			item.setIcon("square-check");
			item.onClick(async () => {
				new Notice(t("under-development-feature-message")); // TODO: Will be implemented in the next version.
			})
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("add-sticky-note"));
			item.setIcon("sticky-note");
			item.onClick(async () => {
				new Notice(t("under-development-feature-message")); // TODO: Will be implemented in the next version.
			})
		});

		sortMenu.addSeparator();

		sortMenu.addItem((item) => {
			item.setTitle(t("background-style"));
			item.setIcon("square");
			const backgroundMenu = item.setSubmenu()

			backgroundMenu.addItem((item) => {
				item.setTitle(t("transparent"));
				item.setIcon("eye-off");
				item.onClick(() => {
					plugin.settings.data.globalSettings.mapView.background = mapViewBackgrounVariantTypes.transparent;
					plugin.saveSettings();

					// Refresh the board view
					eventEmitter.emit('REFRESH_BOARD');
				})
				item.setChecked(mapViewSettings.background === mapViewBackgrounVariantTypes.transparent);
			})

			backgroundMenu.addItem((item) => {
				item.setTitle(t("dots"));
				item.setIcon("grip");
				item.onClick(() => {
					plugin.settings.data.globalSettings.mapView.background = mapViewBackgrounVariantTypes.dots;
					plugin.saveSettings();

					eventEmitter.emit('REFRESH_BOARD');
				})
				item.setChecked(mapViewSettings.background === mapViewBackgrounVariantTypes.dots);
			})

			backgroundMenu.addItem((item) => {
				item.setTitle(t("lines"));
				item.setIcon("grid-3x3");
				item.onClick(() => {
					plugin.settings.data.globalSettings.mapView.background = mapViewBackgrounVariantTypes.lines;
					plugin.saveSettings();

					eventEmitter.emit('REFRESH_BOARD');
				})
				item.setChecked(mapViewSettings.background === mapViewBackgrounVariantTypes.lines);
			})

			backgroundMenu.addItem((item) => {
				item.setTitle(t("cross"));
				item.setIcon("x");
				item.onClick(() => {
					plugin.settings.data.globalSettings.mapView.background = mapViewBackgrounVariantTypes.cross;
					plugin.saveSettings();

					eventEmitter.emit('REFRESH_BOARD');
				})
				item.setChecked(mapViewSettings.background === mapViewBackgrounVariantTypes.cross);
			})

		});

		sortMenu.addItem((item) => {
			item.setTitle(t("show-minimap"));
			item.setIcon("map");
			item.onClick(async () => {
				plugin.settings.data.globalSettings.mapView.showMinimap = !plugin.settings.data.globalSettings.mapView.showMinimap;
				plugin.saveSettings();

				eventEmitter.emit('REFRESH_BOARD');
			})
			item.setChecked(mapViewSettings.showMinimap);
		});

		sortMenu.addItem((item) => {
			item.setTitle(t("animate-links"));
			item.setIcon("worm");
			item.onClick(async () => {
				plugin.settings.data.globalSettings.mapView.animatedEdges = !plugin.settings.data.globalSettings.mapView.animatedEdges;
				plugin.saveSettings();

				eventEmitter.emit('REFRESH_BOARD');
			})
			item.setChecked(mapViewSettings.animatedEdges);
		});

		// Use native event if available (React event has nativeEvent property)
		sortMenu.showAtMouseEvent(
			(event instanceof MouseEvent ? event : event.nativeEvent)
		);
	}

	// Will implement the below function if required in future.
	// const handleOnDragOver = () => {
	// 	console.log("On Drag Over...");
	// }

	// const handleNodeMouseEnter = (node: Node) => {
	// 	console.log("Mouse entered inside the node...\nNode :", node);
	// 	node.selected = true;
	// }

	// const handleNodeMouseLeave = (node: Node) => {
	// 	console.log("Mouse left the node...\nNode :", node);
	// 	node.selected = false;
	// }

	const toggleTasksImporterPanel = () => {
		setIsImporterPanelVisible(prev => !prev);
	}

	const handleEdgeClick = (event: any, edge: Edge) => {
		// Show Obsidian menu for the selected edge
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle(t("delete-dependency"));
			item.setIcon("trash");
			item.onClick(async () => {
				// Edge id format: `${targetId}->${sourceId}`
				const [targetId, sourceId] = edge.id.split('->');
				const allTasks = allTasksArranged.flat();
				const targetTask = allTasks.find(t => (t.legacyId ? t.legacyId : String(t.id)) === targetId);
				if (!targetTask) {
					bugReporter(plugin, "The parent task was not found in the cache. Maybe the ID didnt match or the task itself was not present in the file. Or the file has been moved to a different location.", `Parent task id : ${targetId}\nChild task id : ${sourceId}`, "MapView.tsx/handleEdgeClick");
					return;
				}

				if (!Array.isArray(targetTask.dependsOn)) {
					bugReporter(plugin, "The parent task contains no such dependency. There is some descripancy in the cache or the cache might have been corrupted.", `Parent task id : ${targetId}\nChild task id : ${sourceId}\nParent task cache : ${JSON.stringify(targetTask)}`, "MapView.tsx/handleEdgeClick");
					return;
				}

				const updatedDependsOn = targetTask.dependsOn.filter(dep => dep !== sourceId);
				const updatedTargetTask = {
					...targetTask,
					dependsOn: updatedDependsOn
				};

				let eventData: UpdateTaskEventData = {
					taskID: updatedTargetTask.id,
					state: true,
				};
				eventEmitter.emit("UPDATE_TASK", eventData);

				try {
					if (!isTaskNotePresentInTags(taskNoteIdentifierTag, updatedTargetTask.tags)) {
						const updatedTargetTaskTitle = sanitizeDependsOn(plugin.settings.data.globalSettings, updatedTargetTask.title, updatedTargetTask.dependsOn);
						updatedTargetTask.title = updatedTargetTaskTitle;

						await updateTaskInFile(plugin, updatedTargetTask, targetTask);
						sleep(100).then(() => {
							plugin.realTimeScanning.processAllUpdatedFiles(updatedTargetTask.filePath);
							new Notice(t("dependency-deleted"));

							setTimeout(() => {
								// This event emmitter will stop any loading animation of ongoing task-card.
								eventEmitter.emit("UPDATE_TASK", {
									taskID: updatedTargetTask.id,
									state: false,
								});
							}, 500);
						})
						// eventEmitter.emit('REFRESH_BOARD');
					} else {
						updateFrontmatterInMarkdownFile(plugin, updatedTargetTask).then(() => {
							// This is required to rescan the updated file and refresh the board.
							sleep(500).then(() => {
								plugin.realTimeScanning.processAllUpdatedFiles(
									updatedTargetTask.filePath
								);
								new Notice(t("dependency-deleted"));
								setTimeout(() => {
									// This event emmitter will stop any loading animation of ongoing task-card.
									eventEmitter.emit("UPDATE_TASK", {
										taskID: updatedTargetTask.id,
										state: false,
									});
								}, 500);
							});
						});
					}
				} catch (err) {
					bugReporter(plugin, "There was an error while updating the parent task inside the file. Please see the below error message.", String(err), "MapView.tsx/handleEdgeClick");
				}
			});
		});

		menu.addItem((item) => {
			item.setTitle(t("toggle-animation"));
			item.setIcon("sparkles");
			item.onClick(() => {
				console.log("Will be implemented in future...");
			});
			item.setDisabled(true);
		});

		menu.addItem((item) => {
			item.setTitle(t("change-color"));
			item.setIcon("palette");
			item.onClick(() => {
				console.log("Will be implemented in future...");
			});
			item.setDisabled(true);
		});

		menu.showAtMouseEvent(event instanceof MouseEvent ? event : event.nativeEvent);
	}


	if (allTasksArranged.flat().length === 0) {
		return (
			<div className='taskBoardMapViewWrapper'>
				<div className="taskBoardMapView">
					<div className="taskBoardMapViewContainer">
						<span className="taskBoardMapViewContainerInitialMessage">{t("no-tasks-found-for-current-board-message")}</span>
					</div>
				</div>
			</div>
		);
	} else if (storageLoaded && initialNodes.length === 0) {
		return (
			<div className='taskBoardMapViewWrapper'>
				<div className="taskBoardMapView">
					<div className="taskBoardMapViewContainer">
						<span className="taskBoardMapViewContainerInitialMessage">{t("tasks-on-this-board-have-no-id-message-1")}</span>
						<br />
						<br />
						<span className="taskBoardMapViewContainerInitialMessage">{t("note")} : {t("tasks-on-this-board-have-no-id-message-2")}</span>
					</div>
					<button className='taskBoardMapViewImportPanelBtn'
						onClick={() => toggleTasksImporterPanel()} ><PanelLeftOpenIcon size={20} />
					</button>

					<TasksImporterPanel
						plugin={plugin}
						allTasksArranged={allTasksArranged}
						activeBoardSettings={activeBoardSettings}
						isVisible={isImporterPanelVisible}
						onClose={() => setIsImporterPanelVisible(false)}
					/>
				</div>
			</div>
		);
	} else if (!storageLoaded) {
		return (
			<div className='taskBoardMapViewWrapper'>
				<div className="taskBoardMapView">
					<div className="taskBoardMapViewContainer">
						<div className="spinner"></div>
						<span>{t('loading-map-data')}</span>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='taskBoardMapViewWrapper'>
			<div className="taskBoardMapView">
				<ReactFlowProvider>
					<div className="taskBoardMapViewContainer" style={{
						width: '100%',
						height: '85vh',
						// Map viewport.zoom (0.5..2) inversely to CSS variable such that:
						// zoom=2   -> 0.7
						// zoom=0.5 -> 4
						'--task-board-map-zoom': (() => {
							// const minZ = 0.5;
							// const maxZ = 2;
							// const cssMin = 1; // value when zoom is maxZ
							// const cssMax = 2;   // value when zoom is minZ

							const vpForBoard = viewport[activeBoardIndex] || { x: 10, y: 10, zoom: 1.5 };
							const z = Number.isFinite(vpForBoard?.zoom) ? vpForBoard.zoom : 1.5;
							const clamped = Math.max(0.5, Math.min(2, z));
							const ratio = (clamped - 0.5) / (2 - 0.5); // 0..1
							// Map so that zoom 0.5 -> 2 and zoom 2 -> 1
							const mapped = 2 - ratio;
							const safeMapped = Number.isFinite(mapped) ? mapped : 1;

							// Keep a compact string value suitable for CSS variable
							return String(safeMapped);
						})()
					} as React.CSSProperties}>
						<ReactFlow
							// Data Initialization
							proOptions={{ hideAttribution: true }}
							nodes={nodes}
							edges={edges}
							nodeTypes={nodeTypes}
							onEdgeClick={handleEdgeClick}
							onNodesChange={onNodesChange}
							onNodeDragStop={() => {
								handleNodePositionChange();
							}}

							// viewport controls
							// fitView={true}
							panOnScroll={mapViewSettings.scrollAction === mapViewScrollAction.pan ? true : false}
							zoomOnScroll={mapViewSettings.scrollAction === mapViewScrollAction.zoom ? true : false}
							// preventScrolling={false}
							panOnDrag={[1, 2]}
							selectNodesOnDrag={false}
							selectionOnDrag={Platform.isPhone ? false : true}
							selectionMode={SelectionMode.Partial}
							onMoveEnd={(_, vp) => {
								// setViewport(prev => ({ ...prev, [activeBoardIndex]: vp })); // NOTE : Dont update the viewport here again, as it is giving a glitching behavior.
								debouncedSetViewportStorage(vp);
								// throttledSetViewportStorage(vp);
							}}

							// Events
							// onEdgesChange={onEdgesChange}
							onConnect={onConnect}
							onPaneContextMenu={(event) => handlePaneContextMenu(event)}
							// onNodeMouseEnter={(event, node) => handleNodeMouseEnter(node)} // TODO : For now lets user select the node and then resize it, instead of hover and resize feature, similar to cavnas. Since this Map view shouldnt emulate exactly like the canvas, hence this decision.
							// onNodeMouseLeave={(event, node) => handleNodeMouseLeave(node)}
							// onEdgeMouseEnter={handleEdgeMouseEnter}
							// onEdgeMouseLeave={handleEdgeMouseLeave}
							// onDrag={handleOnDragOver}

							// rendering
							onlyRenderVisibleElements={mapViewSettings.renderVisibleNodes} // TODO : If this is true, then the initial render is faster, but while panning the experience is little laggy.
							onInit={(instance) => {
								// store reactflow instance for later programmatic viewport updates
								try {
									reactFlowInstanceRef.current = instance;
								} catch (e) {
									// ignore
								}
								if (focusOnTaskId) {
									const node = nodes.find(n => n.id === focusOnTaskId);
									if (node && Number.isFinite(node.position.x) && Number.isFinite(node.position.y)) {
										const newVp: viewPort = {
											x: - (node.position.x - 200),
											y: - (node.position.y),
											zoom: 1
										};
										// Validate the new viewport before setting
										if (Number.isFinite(newVp.x) && Number.isFinite(newVp.y) && Number.isFinite(newVp.zoom)) {
											instance.setViewport(newVp);
											setViewport(prev => ({ ...prev, [activeBoardIndex]: newVp }));
											debouncedSetViewportStorage(newVp);
											return;
										}
									}
								}
								// Use current viewport if valid for this board, otherwise fall back to defaults
								const currentVpForBoard = viewport[activeBoardIndex];
								if (currentVpForBoard && Number.isFinite(currentVpForBoard.x) && Number.isFinite(currentVpForBoard.y) && Number.isFinite(currentVpForBoard.zoom) && currentVpForBoard.zoom > 0) {
									instance.setViewport(currentVpForBoard);
								} else {
									const defaultVp: viewPort = { x: 10, y: 10, zoom: 1.5 };
									instance.setViewport(defaultVp);
									setViewport(prev => ({ ...prev, [activeBoardIndex]: defaultVp }));
								}
							}}
							defaultViewport={viewport[activeBoardIndex]}
							elevateEdgesOnSelect={true}
						>
							<Controls>
								<div className='taskBoardMapViewControlsBtnContainer'>
									<ControlButton aria-label='Open left panel' onClick={() => toggleTasksImporterPanel()}>
										<PanelLeftOpenIcon size={34} />
									</ControlButton>
								</div>
							</Controls>

							{mapViewSettings.showMinimap && (
								<MapViewMinimap tagColors={tagColors} />
							)}

							<Background gap={12} size={1} color={mapViewSettings.background === mapViewBackgrounVariantTypes.transparent ? 'transparent' : ''} variant={userBackgroundVariant} />
						</ReactFlow>

						<TasksImporterPanel
							plugin={plugin}
							allTasksArranged={allTasksArranged}
							activeBoardSettings={activeBoardSettings}
							isVisible={isImporterPanelVisible}
							onClose={() => setIsImporterPanelVisible(false)}
						/>
					</div>
				</ReactFlowProvider>
			</div>
		</div>
	);
};

export default memo(MapView);
