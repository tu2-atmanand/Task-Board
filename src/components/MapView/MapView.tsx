// /src/components/MapView/MapView.tsx

import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import {
	ReactFlow,
	ReactFlowProvider,
	addEdge,
	useNodesState,
	useEdgesState,
	Controls,
	Background,
	useReactFlow,
	Node,
	Edge,
	MiniMap,
	Connection,
	MarkerType,
	BackgroundVariant,
	SelectionMode,
	NodeChange,
	ControlButton
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { taskItem } from 'src/interfaces/TaskItem';
import TaskBoard from 'main';
import { Board } from 'src/interfaces/BoardConfigs';
import ResizableNodeSelected from './ResizableNodeSelected';
import TaskItem from '../KanbanView/TaskItem';
import CustomNodeResizer from './CustomNodeResizer';
import { updateTaskInFile } from 'src/utils/taskLine/TaskItemUtils';
import { debounce, Menu, Notice } from 'obsidian';
import { NODE_POSITIONS_STORAGE_KEY, NODE_SIZE_STORAGE_KEY, VIEWPORT_STORAGE_KEY } from 'src/interfaces/Constants';
import { sanitizeDependsOn } from 'src/utils/taskLine/TaskContentFormatter';
import { t } from 'src/utils/lang/helper';
import { MapViewMinimap } from './MapViewMinimap';
import { mapViewArrowDirection, mapViewBackgrounVariantTypes, mapViewScrollAction } from 'src/interfaces/Enums';
import { eventEmitter } from 'src/services/EventEmitter';
import { bugReporter } from 'src/services/OpenModals';
import { PanelLeftOpenIcon, Wand } from 'lucide-react';

type MapViewProps = {
	plugin: TaskBoard;
	boards: Board[];
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
	plugin, boards, activeBoardIndex, allTasksArranged, focusOnTaskId
}) => {
	plugin.settings.data.globalSettings.lastViewHistory.taskId = ""; // Clear the taskId after focusing once
	const mapViewSettings = plugin.settings.data.globalSettings.mapView;
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
	const [viewport, setViewport] = useState<viewPort>({ x: 10, y: 10, zoom: 1.5 });

	// Track when board changes to force node recalculation
	const [boardChangeKey, setBoardChangeKey] = useState(0);

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
			const boardPositions = allBoardPositions[String(activeBoardIndex)];
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

	// Viewport state
	const loadViewport = (): viewPort => {
		try {
			const stored = localStorage.getItem(VIEWPORT_STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (typeof parsed === 'object' && parsed !== null) {
					return {
						x: Number.isFinite(parsed.x) ? parsed.x : 10,
						y: Number.isFinite(parsed.y) ? parsed.y : 10,
						zoom: Number.isFinite(parsed.zoom) && parsed.zoom > 0 ? parsed.zoom : 1.5
					};
				}
			}
			return { x: 10, y: 10, zoom: 1.5 };
		} catch (error) {
			console.warn('Failed to load viewport from localStorage:', error);
			return { x: 10, y: 10, zoom: 1.5 };
		}
	};


	// Load all storage data on mount and when activeBoardIndex changes
	useEffect(() => {
		console.log("Loading Map View storage data for board index:", activeBoardIndex);
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

		// Load and sanitize viewport
		const vp = loadViewport();
		const sanitizedViewport: viewPort = {
			x: Number.isFinite(vp.x) ? vp.x : 10,
			y: Number.isFinite(vp.y) ? vp.y : 10,
			zoom: Number.isFinite(vp.zoom) && vp.zoom > 0 ? vp.zoom : 1.5
		};
		setViewport(sanitizedViewport);

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
		const columnSpacing = 350;
		const rowSpacing = 170;

		// Get default width with proper validation
		const getDefaultWidth = () => {
			const columnWidth = plugin.settings.data.globalSettings.columnWidth;
			if (columnWidth && Number.isFinite(Number(columnWidth))) {
				return Number(columnWidth);
			}
			return 300; // Fallback default width
		};
		const defaultWidth = getDefaultWidth();

		let xOffset = 0;
		allTasksArranged.forEach((columnTasks, colIdx) => {
			let yOffset = 0;
			columnTasks.forEach((task, rowIdx) => {
				if (task.legacyId) {
					const id = task.legacyId ? task.legacyId : String(task.id);
					if (usedIds.has(id)) {
						console.warn('Duplicate node id detected:', id, "\nTitle : ", task.title);
						bugReporter(plugin, `Duplicate node id "${id}" detected in Map View. This may cause unexpected behavior. Please report this issue to the developer with details about the tasks involved.`, "ERROR: Same id is present on two tasks", "MapView.tsx/initialNodes");
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

					newNodes.push({
						id,
						type: 'ResizableNodeSelected',
						data: {
							label: <TaskItem
								key={task.id}
								plugin={plugin}
								taskKey={task.id}
								task={task}
								activeBoardSettings={activeBoardSettings}
							/>
						},
						position: {
							x: Number.isFinite(savedPos.x) ? savedPos.x : xOffset,
							y: Number.isFinite(savedPos.y) ? savedPos.y : yOffset
						},
						width: nodeWidth,
					});
					yOffset += rowSpacing;
				}

			});
			xOffset += columnSpacing;
		});
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

	// Calculate edges from dependsOn property
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

		const z = Number.isFinite(viewport.zoom) ? viewport.zoom : 1.5;
		const clamped = Math.max(0.5, Math.min(2, z));
		const ratio = (clamped - 0.5) / (2 - 0.5); // 0..1
		const mapped = 1.5 - ratio * (1.5 - 1.2);
		// Keep a compact string value suitable for CSS variable
		const safeMarkerSize = 20 * mapped;

		tasks.forEach(task => {
			const sourceId = task.legacyId ? task.legacyId : String(task.id);
			if (Array.isArray(task.dependsOn)) {
				task.dependsOn.forEach(depId => {
					if (idToTask.has(depId)) {
						edges.push({
							id: `${sourceId}->${depId}`,
							source: depId,
							target: sourceId,
							type: mapViewSettings.edgeType ?? "default",
							animated: mapViewSettings.animatedEdges,
							markerStart: {
								type: MarkerType.ArrowClosed, // required property
								// optional properties
								color: 'var(--text-normal)',
								height: mapViewSettings.arrowDirection !== mapViewArrowDirection.childToParent ? safeMarkerSize : 0,
								width: mapViewSettings.arrowDirection !== mapViewArrowDirection.childToParent ? safeMarkerSize : 0,
							},
							markerEnd: {
								type: MarkerType.ArrowClosed, // required property
								// optional properties
								color: 'var(--text-normal)',
								height: mapViewSettings.arrowDirection !== mapViewArrowDirection.parentToChild ? safeMarkerSize : 0,
								width: mapViewSettings.arrowDirection !== mapViewArrowDirection.parentToChild ? safeMarkerSize : 0,
							},
						});
					}
				});
			}
		});
		return edges;
	}
	const edges = useMemo(() => getEdgesFromTasks(), [allTasksArranged]); // TODO : Why viewport.zoom is a dependency

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
			const updatedSourceTaskTitle = sanitizeDependsOn(plugin.settings.data.globalSettings, updatedTargetTask.title, updatedTargetTask.dependsOn);
			updatedTargetTask.title = updatedSourceTaskTitle;

			// console.log('Updated source task :', updatedSourceTask, "\nOld source task:", sourceTask);
			updateTaskInFile(plugin, updatedTargetTask, targetTask).then((newId) => {
				plugin.realTimeScanning.processAllUpdatedFiles(updatedTargetTask.filePath);
			});
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
			const safeViewport = {
				x: Number.isFinite(vp.x) ? vp.x : 10,
				y: Number.isFinite(vp.y) ? vp.y : 10,
				zoom: Number.isFinite(vp.zoom) && vp.zoom > 0 ? vp.zoom : 1.5
			};
			try {
				localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(safeViewport));
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
		console.log("This will open a side panel on the left side, where the tasks will be listed in column, rendered as TaskItem component and user can select them to import it inside the board. That is basically assign them a ID, which will trigger them to automatically appear on the board. Also provide a search menu within this panel on top, so user can search for the task easily. Also provide a nice animation while toggling this panel.")
	}


	if (!storageLoaded || initialNodes.length === 0 || allTasksArranged.length === 0) {
		return (
			<div className='mapViewWrapper'>
				<div className="mapView">
					<div className="taskBoardMapViewContainer" style={{ width: '100%', height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						<div className="spinner"></div>
						<span>{t('loading-map-data')}</span>
					</div>
				</div>
			</div>
		);
	}
	return (
		<div className='mapViewWrapper'>
			<div className="mapView">
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

							const z = Number.isFinite(viewport.zoom) ? viewport.zoom : 1.5;
							const clamped = Math.max(0.5, Math.min(2, z));
							const ratio = (clamped - 0.5) / (2 - 0.5); // 0..1
							const mapped = 1 - ratio * (2 - 1);
							// Keep a compact string value suitable for CSS variable
							return String(Number(mapped));
						})()
					} as React.CSSProperties}>
						<ReactFlow
							// Data Initialization
							proOptions={{ hideAttribution: true }}
							nodes={nodes}
							edges={edges}
							nodeTypes={nodeTypes}
							onNodesChange={onNodesChange}
							onNodeDragStop={() => {
								handleNodePositionChange();
							}}
							// fitView={true}

							// viewport controls
							panOnScroll={mapViewSettings.scrollAction === mapViewScrollAction.pan ? true : false}
							zoomOnScroll={mapViewSettings.scrollAction === mapViewScrollAction.zoom ? true : false}
							// preventScrolling={false}
							panOnDrag={[1, 2]}
							selectNodesOnDrag={true}
							selectionOnDrag={true}
							selectionMode={SelectionMode.Partial}

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
											setViewport(newVp);
											debouncedSetViewportStorage(newVp);
											return;
										}
									}
								}
								// Use current viewport if valid, otherwise fall back to defaults
								const currentVp = viewport;
								if (Number.isFinite(currentVp.x) && Number.isFinite(currentVp.y) && Number.isFinite(currentVp.zoom)) {
									instance.setViewport(currentVp);
								} else {
									const defaultVp = { x: 10, y: 10, zoom: 1.5 };
									instance.setViewport(defaultVp);
									setViewport(defaultVp);
								}
							}}
							defaultViewport={viewport}
							onMoveEnd={(_, vp) => {
								setViewport(vp);
								debouncedSetViewportStorage(vp);
								// throttledSetViewportStorage(vp);
							}}
							elevateEdgesOnSelect={true}
						>
							<Controls>
								<div className='taskBoardMapViewControlsBtnContainer'>
									<ControlButton onClick={() => toggleTasksImporterPanel()}>
										<PanelLeftOpenIcon />
									</ControlButton>
								</div>
							</Controls>

							{mapViewSettings.showMinimap && (
								<MapViewMinimap tagColors={tagColors} />
							)}

							<Background gap={12} size={1} color={mapViewSettings.background === mapViewBackgrounVariantTypes.transparent ? 'transparent' : ''} variant={userBackgroundVariant} />
						</ReactFlow>
					</div>
				</ReactFlowProvider>
			</div>
		</div>
	);
};

export default memo(MapView);
