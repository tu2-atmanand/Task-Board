// /src/components/MapView/MapView.tsx

import React, { useState, useEffect, useRef, memo, useMemo, useCallback, MouseEvent as ReactMouseEvent } from 'react';
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
import { debounce, Menu, Notice, Platform } from 'obsidian';
import { PanelLeftOpenIcon } from 'lucide-react';
import { t } from 'i18next';
import TaskBoard from '../../../main.js';
import { Board, TaskBoardViewType, viewPortType, nodeDataType, nodePositionData } from '../../interfaces/BoardConfigs.js';
import { mapViewBackgrounVariantTypes, viewTypeNames, mapViewScrollAction, mapViewArrowDirection } from '../../interfaces/Enums.js';
import { taskJsonMerged, taskItem, UpdateTaskEventData } from '../../interfaces/TaskItem.js';
import { bugReporterManagerInsatance } from '../../managers/BugReporter.js';
import { eventEmitter } from '../../services/EventEmitter.js';
import { isTaskCompleted } from '../../utils/CheckBoxUtils.js';
import { sanitizeDependsOn } from '../../utils/taskLine/TaskContentFormatter.js';
import { updateTaskInFile } from '../../utils/taskLine/TaskLineUtils.js';
import { isTaskNotePresentInTags, updateFrontmatterInMarkdownFile } from '../../utils/taskNote/TaskNoteUtils.js';
import TaskItem from '../TaskCard/TaskItem.js';
import { MapViewMinimap } from './MapViewMinimap.js';
import ResizableNodeSelected from './ResizableNodeSelected.js';
import { TasksImporterPanel } from './TasksImporterPanel.js';

type MapViewProps = {
	plugin: TaskBoard;
	activeBoardData: Board;
	currentView: TaskBoardViewType;
	currentViewIndex: number;
	filteredTasks: taskJsonMerged;
	focusOnTaskId?: string;
};

const nodeTypes = {
	// CustomNodeResizer,
	ResizableNodeSelected,
};


const MapView: React.FC<MapViewProps> = ({
	plugin, activeBoardData, currentView, currentViewIndex, filteredTasks, focusOnTaskId
}) => {
	plugin.settings.data.lastViewHistory.taskId = ""; // Clear the taskId after focusing once
	const mapViewSettings = plugin.settings.data.mapView;
	const taskNoteIdentifierTag = plugin.settings.data.taskNoteIdentifierTag;
	const tagColors = plugin.settings.data.tagColors;
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

	// Flatten the filtered tasks from taskJsonMerged to a single array for MapView
	// IMPORTANT: Memoize to prevent infinite loop - prevents recreating array on every render
	const allTasksFlattened = useMemo(() =>
		filteredTasks ? [...filteredTasks.Completed, ...filteredTasks.Pending] : [],
		[filteredTasks]
	);
	// Loading state for board map data (stored on the board object)
	const [storageLoaded, setStorageLoaded] = useState(false);
	// const [activeBoardSettings, setActiveBoardSettings] = useState(activeBoardData)
	const [boardChangeKey, setBoardChangeKey] = useState(0); 	// Track when board changes to force node recalculation
	const [isImporterPanelVisible, setIsImporterPanelVisible] = useState(false); 	// Task importer panel state

	const mapDataUpdated = useRef<boolean>(false);
	const viewPortDataUpdated = useRef<boolean>(false);
	// Store node positions in ref to avoid re-renders during drag operations
	const allNodesData = useRef<nodeDataType>({});
	const viewPortData = useRef<viewPortType>({ x: 10, y: 10, zoom: 1 });
	// const [viewport, setViewport] = useState<viewPortType>({ x: 10, y: 10, zoom: 1 });
	// ReactFlow instance ref so we can programmatically set viewport when switching boards
	// const reactFlowInstanceRef = useRef<any | null>(null);

	// -------------------------------------------------------------
	//            LOADING MAP DATA FROM BOARD FILE
	// -------------------------------------------------------------

	// Load positions from the active board data
	const loadAllNodesData = (): nodeDataType => {
		console.log("loadAllNodesData called...");

		try {
			const list = currentView?.mapView?.nodesData ? currentView.mapView.nodesData : {};
			// const map: Record<string, nodeDataType> = {};
			// list.forEach(item => {
			// 	if (item && typeof item.key === 'string') {
			// 		map[item.id] = { x: Number.isFinite(item.x) ? item.x : 0, y: Number.isFinite(item.y) ? item.y : 0 };
			// 	}
			// });
			return list;
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(92, String(error), 'MapView.tsx/loadPositions');
			return {};
		}
	};

	// Load viewport from the active board data
	const loadViewport = (): viewPortType => {
		console.log("loadViewport called...");
		try {
			const vp = currentView?.mapView?.viewPortData;
			if (vp && typeof vp === 'object') {
				return {
					x: Number.isFinite(vp.x) ? vp.x : 10,
					y: Number.isFinite(vp.y) ? vp.y : 10,
					zoom: Number.isFinite(vp.zoom) && vp.zoom > 0 ? vp.zoom : 1,
				};
			}
			return { x: 10, y: 10, zoom: 1 };
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(95, String(error), 'MapView.tsx/loadViewport');
			return { x: 10, y: 10, zoom: 1 };
		}
	};

	// Load all map data from the active board on mount and when activeBoardData changes
	useEffect(() => {
		setStorageLoaded(false);
		// Load and sanitize positions
		const nodesData: nodeDataType = loadAllNodesData();
		const sanitizedPositions: Record<string, nodePositionData> = {};
		Object.keys(nodesData).forEach(id => {
			sanitizedPositions[id] = {
				x: Number.isFinite(nodesData[id]?.x) ? nodesData[id].x : 0,
				y: Number.isFinite(nodesData[id]?.y) ? nodesData[id].y : 0,
				width: Number.isFinite(nodesData[id]?.width) ? nodesData[id].width : 300,
			};
		});
		// Update useRef instead of state to avoid re-render
		allNodesData.current = sanitizedPositions;

		// Load and sanitize viewport
		const rawVp = loadViewport();
		const sanitizedForBoard: viewPortType = {
			x: Number.isFinite(rawVp.x) ? rawVp.x : 10,
			y: Number.isFinite(rawVp.y) ? rawVp.y : 10,
			zoom: Number.isFinite(rawVp.zoom) ? rawVp.zoom : 1.5
		};
		// setViewport(sanitizedForBoard);
		viewPortData.current = sanitizedForBoard;

		setStorageLoaded(true);
		// Increment board change key to force initialNodes recalculation
		setBoardChangeKey(prev => prev + 1);
	}, [activeBoardData]);


	// -------------------------------------------------------------
	//         EVENT EMITTERS FOR SAVING BOARD FILE
	// -------------------------------------------------------------

	useEffect(() => {
		const saveMapDataListener = () => {
			// console.log("[Task Board] [MapView] SAVE_MAP signal fired...\nmapDataUpdated = ", mapDataUpdated.current, "\nviewPortDataUpdated = ", viewPortDataUpdated.current);
			if (!mapDataUpdated.current && !viewPortDataUpdated.current) return;

			let newBoardData = activeBoardData;
			// Update the currentView's mapView data
			// const viewIndex = newBoardData.views.findIndex(v => v.viewId === currentView.viewId);
			if (currentViewIndex >= 0 && currentViewIndex < newBoardData.views.length) {
				newBoardData.views[currentViewIndex].mapView = {
					viewPortData: viewPortData.current,
					nodesData: allNodesData.current,
				};
			}
			// console.log("Will now going to save the view index :", newBoardData.lastViewIndex);
			plugin.taskBoardFileManager.saveBoard(newBoardData);

			mapDataUpdated.current = false;
			viewPortDataUpdated.current = false;
			emitMapDataUpdatedSignal(false);
		};

		eventEmitter.on("SAVE_MAP", saveMapDataListener);
		return () => eventEmitter.off("SAVE_MAP", saveMapDataListener);
	}, [activeBoardData]);

	/**
	 * This function should be called when you want to emit a signal for 
	 * other entities to know whether the map view is in UNSAVED sate or
	 * it the updated data has been properly saved.
	 * 
	 * DONT CALL THIS FUNCTION WHEN VIEWPORT DATA HAS BEEN CHANGED.
	 * 
	 * It also transmits a JSON data in the following form : { onlyviewport: boolean }. 
	 * True -> Means, only the viewport data has been updated. (Viewport data is 
	 * not considered to be a very important data in some scenarios, but still needs 
	 * to be saved to board file.)
	 * False -> Means, other important map data has been updated along with 
	 * the viewport data.
	 * 
	 * @param flag - The flag tells what kind of signal to emit. 
	 * True -> The map view is in unsaved state. 
	 * False -> The map view has been saved to board file successfully.
	 */
	const emitMapDataUpdatedSignal = (flag: boolean) => {
		if (flag) {
			if (!mapDataUpdated.current) {
				eventEmitter.emit("MAP_UNSAVED", { onlyviewport: false });
				mapDataUpdated.current = true;
			}
		} else {
			eventEmitter.emit("MAP_SAVED");
			mapDataUpdated.current = false;
		}
	}


	// const reactFlowInstance = useReactFlow();
	// useEffect(() => {
	// 	// Set initial viewport (x, y, zoom)
	// 	reactFlowInstance.setViewport({ x: positions[0].x, y: positions[0].y, zoom: 1 });
	// }, []);

	// ===== DEBUG: Selection monitoring component =====
	// This component monitors which nodes are actually selected by ReactFlow
	// to debug the "ghost node" selection issue
	// SOLUTION : This issue has been fixed, the root-cause of this issue was Numeric strings
	// present in the tasks cache. So, when I was initializing the nodes, the numeric ID 
	// tasks were also getting initialized and it was causing this strange behavior.
	// const MapViewSelectionDebugger: React.FC = () => {
	// 	useOnSelectionChange({
	// 		onChange: (changes) => {
	// 			const selectedNodeCount = changes.nodes?.length ?? 0;
	// 			const selectedNodeIds = changes.nodes?.map((n) => n.id) ?? [];
	// 			const selectedEdgeCount = changes.edges?.length ?? 0;
	// 			const selectedEdgeIds = changes.edges?.map((e) => e.id) ?? [];

	// 			console.group('🔍 [MapView] Selection Change Debug Info');
	// 			console.log(`📊 Selected Nodes: ${selectedNodeCount}`);
	// 			console.log('📝 Selected Node IDs:', selectedNodeIds);
	// 			console.log(`📊 Selected Edges: ${selectedEdgeCount}`);
	// 			console.log('📝 Selected Edge IDs:', selectedEdgeIds);
	// 			console.log('🎯 Full Selection Changes Object:', changes);
	// 			console.log('📋 Total nodes in map:', nodes.length);
	// 			console.log('📋 All node IDs in map:', nodes.map(n => n.id));
	// 			console.groupEnd();

	// 			// If selection count seems suspicious, log more details
	// 			if (selectedNodeCount > (nodes?.length ?? 0) || selectedNodeCount < 0) {
	// 				console.error(
	// 					`⚠️  SUSPICIOUS: Selected ${selectedNodeCount} nodes, but only ${nodes?.length ?? 0} nodes exist in the map!`,
	// 					changes
	// 				);
	// 			}

	// 			// Check for ghost nodes - nodes that are selected but don't exist in our nodes array
	// 			const ghostNodes = selectedNodeIds.filter(selectedId =>
	// 				!nodes.some(node => node.id === selectedId)
	// 			);
	// 			if (ghostNodes.length > 0) {
	// 				console.error('👻 GHOST NODES DETECTED! Selected node IDs that don\'t exist in nodes array:', ghostNodes);
	// 			}

	// 			// If user selected more nodes than available, log for investigation
	// 			if (selectedNodeCount > 0) {
	// 				const selectedNodeObjects = nodes?.filter((n) => selectedNodeIds.includes(n.id)) ?? [];
	// 				console.log('🔎 Detailed info on selected nodes:', {
	// 					nodesCount: selectedNodeObjects.length,
	// 					nodes: selectedNodeObjects.map((n) => ({
	// 						id: n.id,
	// 						position: n.position,
	// 						width: n.width,
	// 						selected: n.selected,
	// 					}))
	// 				});
	// 			}
	// 		}
	// 	});

	// 	return null; // This component doesn't render anything
	// };
	// ===== END DEBUG: Selection monitoring component =====

	// -------------------------------------------------------------
	//          ALL REACTFLOW INITIALIZATION CODE
	// -------------------------------------------------------------

	// Kanban-style initial layout, memoized - now used for dynamic node updates
	const computedNodes: Node[] = useMemo(() => {
		// Don't calculate nodes until storage data is loaded
		if (!storageLoaded) { return []; }
		const newNodes: Node[] = [];
		const usedIds = new Set<string>();
		const duplicateIds = new Set<string>();
		const columnSpacing = 350; // base gap between columns
		const rowSpacing = 200;
		const tasksPerColumn = 20; // wrap after 20 tasks per column

		// Get default width with proper validation
		const getDefaultWidth = () => {
			try {
				const columnWidth = plugin.settings.data.columnWidth;
				if (!columnWidth || typeof columnWidth !== 'string') {
					return 300; // Fallback if missing or not a string
				}
				const cleaned = columnWidth.replace('px', '').trim();
				const parsed = Number(cleaned);
				if (Number.isFinite(parsed) && parsed > 0) {
					return parsed;
				}
			} catch (e) {
				bugReporterManagerInsatance.addToLogs(96, String(e), 'MapView.tsx/getDefaultWidth');
				return 300; // Fallback default width
			}
			return 300; // Fallback default width
		};
		const defaultWidth = getDefaultWidth();

		// Counter for tasks that do NOT have saved positions so we can place them in a grid
		let autoIndex = 0;
		let maxColumnCount = 0;

		allTasksFlattened.forEach((task) => {
			if (task.legacyId) {
				/**
				 * We should cast this value to string cumpulsorily even though 
				 * its already a string, else there is a possibility 
				 * that atleast one of the id might be of type Numeric which can start 
				 * causing the "GHOST NODE issue". 
				 * 
				 * @link - https://github.com/tu2-atmanand/Task-Board/issues/665
				 */
				const id = String(task.legacyId);
				if (usedIds.has(id)) {
					duplicateIds.add(id);
					return;
				}
				usedIds.add(id);

				const nodeData = allNodesData.current[id];

				// Ensure width is always a valid number
				let nodeWidth = defaultWidth;
				if (nodeData?.width && Number.isFinite(nodeData.width) && nodeData.width > 0) {
					nodeWidth = nodeData.width;
				}

				// Determine position: use saved position if present and valid, else compute grid position
				let posX: number;
				let posY: number;
				const hasSavedPos = nodeData && Number.isFinite(nodeData.x) && Number.isFinite(nodeData.y);
				if (hasSavedPos) {
					posX = nodeData.x;
					posY = nodeData.y;
				} else {
					const columnIndex = Math.floor(autoIndex / tasksPerColumn);
					const rowIndex = autoIndex % tasksPerColumn;
					// Space columns by node width + columnSpacing so variable widths are respected
					posX = columnIndex * (defaultWidth + columnSpacing);
					posY = rowIndex * rowSpacing;
					autoIndex += 1;
					maxColumnCount = Math.max(maxColumnCount, columnIndex + 1);
				}

				const safeX = Number.isFinite(posX) ? posX : 0;
				const safeY = Number.isFinite(posY) ? posY : 0;

				newNodes.push({
					id,
					type: 'ResizableNodeSelected',
					data: {
						label: <TaskItem
							dataAttributeIndex={0}
							plugin={plugin}
							task={task}
							activeViewType={viewTypeNames.map}
							activeViewIndex={currentViewIndex}
							activeBoardID={activeBoardData.id}
						/>
					},
					position: {
						x: safeX,
						y: safeY,
					},
					width: nodeWidth,
				});
			}
		});

		if (duplicateIds.size > 0) {
			const stringOfListOfDuplicateIds = Array.from(duplicateIds).join(',');
			bugReporterManagerInsatance.showNotice(17, `Following duplicate IDs has been found for tasks with IDs: "${stringOfListOfDuplicateIds}". This may cause unexpected behavior. Please consider changing the IDs of these tasks.`, "ERROR: Same id is present on two tasks", "MapView.tsx/initialNodes");
			duplicateIds.clear();
		}

		return newNodes;
	}, [allTasksFlattened, activeBoardData, storageLoaded, boardChangeKey]);

	// Manage nodes state - start with empty array as suggested by ReactFlow team
	const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);

	// Update nodes dynamically when computedNodes changes (ReactFlow team suggestion)
	useEffect(() => {
		console.log("[MapView] Updating nodes via setNodes - computedNodes length:", computedNodes.length);
		setNodes(computedNodes);
	}, [computedNodes, setNodes]);

	// TODO : Its not a good idea to use debounce and allow stale data. I am already storing the data in localStorage on resize end in ResizableNodeSelected component. And there its much better as I can capture the final size directly based on the callback.
	// Custom handler that intercepts dimension changes and updates nodeSizeTypes state
	// const handleNodesChange = (changes: NodeChange[]) => {
	// 	// First, apply the changes to ReactFlow's state
	// 	onNodesChange(changes);

	// 	updateSinglenodeSizeTypeOnDiskDebounced(changes);

	// };

	// const updateSinglenodeSizeTypeOnDiskDebounced = debounce(
	// 	async (changes: NodeChange[]): Promise<void> => {
	// 		if (changes.length !== 1 || changes[0].type !== "dimensions") return;

	// 		// Update nodeSizeTypes state and localStorage
	// 		const updatedSizes = { ...nodeSizeTypes };
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
	// 			// setnodeSizeTypes(updatedSizes);
	// 			try {
	// 				localStorage.setItem(NODE_SIZE_STORAGE_KEY, JSON.stringify(updatedSizes));
	// 			} catch (error) {
	// 				bugReporterManagerInsatance.addToLogs(
	// 					179,
	// 					`Failed to save node sizes: ${String(error)}`,
	// 					"MapView.tsx/updateSinglenodeSizeTypeOnDiskDebounced",
	// 				);
	// 			}
	// 		}
	// 	},
	// 	500
	// );

	// When the active board or viewport data changes, apply the stored viewport to the ReactFlow instance.
	// useEffect(() => {
	// 	const instance = reactFlowInstanceRef.current;
	// 	if (!instance) return;
	// 	const vpForBoard = viewport;
	// 	if (vpForBoard && Number.isFinite(vpForBoard.x) && Number.isFinite(vpForBoard.y) && Number.isFinite(vpForBoard.zoom)) {
	// 		try {
	// 			instance.setViewport(vpForBoard);
	// 		} catch (e) {
	// 			// ignore - instance may be transitioning
	// 		}
	// 	}
	// }, [viewport]);

	// Calculate edges from dependsOn property
	// TODO : Might be efficient to make use of the addEdge api of reactflow.
	function getEdgesFromTasks(): Edge[] {
		console.log("getEdgesFromTasks : How many times is this running and when...");
		const tasks: taskItem[] = allTasksFlattened;
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

		// const vpForBoard = viewport || { x: 10, y: 10, zoom: 1.5 };
		// const zoom = Number.isFinite(vpForBoard?.zoom) ? vpForBoard.zoom : 1.5;
		// const clamped = Math.max(0.5, Math.min(2, zoom));
		// const ratio = (clamped - 0.5) / (2 - 0.5); // 0..1
		// const mapped = 1.5 - ratio * (1.5 - 1.2);
		// // Keep a compact string value suitable for CSS variable
		// const safeMarkerSize: number = Number.isFinite(mapped) ? 15 * mapped : 15;

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
									height: mapViewSettings.arrowDirection !== mapViewArrowDirection.childToParent ? undefined : 0,
									width: mapViewSettings.arrowDirection !== mapViewArrowDirection.childToParent ? undefined : 0,
								},
								markerEnd: {
									type: MarkerType.ArrowClosed, // required property
									// optional properties
									// color: 'var(--text-normal)',
									height: mapViewSettings.arrowDirection !== mapViewArrowDirection.parentToChild ? undefined : 0,
									width: mapViewSettings.arrowDirection !== mapViewArrowDirection.parentToChild ? undefined : 0,
								},
							});
						}
					}
				});
			}
		});
		return edges;
	}
	const edges = useMemo(() => getEdgesFromTasks(), [allTasksFlattened]);

	// -------------------------------------------------------------
	//           ALL EVENT HANDLING
	// -------------------------------------------------------------

	const handlenodePositionChange = useCallback(() => {
		try {
			// Update positions for current board with validation
			const nodesDataMap: Record<string, nodePositionData> = {};
			for (const node of nodes) {
				const x = Number.isFinite(node.position?.x) ? node.position.x : 0;
				const y = Number.isFinite(node.position?.y) ? node.position.y : 0;
				const width = Number.isFinite(node?.width) ? node.width ?? 300 : 300;
				nodesDataMap[node.id] = { x, y, width };
			}

			// Only update useRef - no state update needed, avoiding re-render
			allNodesData.current = nodesDataMap;
			emitMapDataUpdatedSignal(true);
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(98, String(error), 'MapView.tsx/handlenodePositionTypeChange');
		}
	}, [nodes, emitMapDataUpdatedSignal]);

	// Persist updated positions and sizes
	// const prevnodeSizeTypesRef = useRef<Record<string, { width: number; height: number }>>({});

	// Only save sizes if they have changed
	// useEffect(() => {
	// 	const sizeMap = nodes.reduce((acc, n) => {
	// 		acc[n.id] = { width: n.width ?? 300, height: n.height ?? 80 };
	// 		return acc;
	// 	}, {} as Record<string, { width: number; height: number }>);

	// 	// Compare with previous sizes
	// 	const prevSizes = prevnodeSizeTypesRef.current;
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
	// 		setnodeSizeTypes(sizeMap);
	// 		localStorage.setItem(NODE_SIZE_STORAGE_KEY, JSON.stringify(sizeMap));
	// 		prevnodeSizeTypesRef.current = sizeMap;
	// 	}
	// }, [nodes]);

	// Handle edge creation (connecting nodes)
	const onConnect = useMemo<((params: Connection) => void)>(() => {
		const flattenedTasks = allTasksFlattened;
		return (params: Connection) => {
			connectParentToChild(params.source, params.target, flattenedTasks);
		};
	}, [allTasksFlattened]);

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
				const updatedTargetTaskTitle = sanitizeDependsOn(plugin.settings.data, updatedTargetTask.title, updatedTargetTask.dependsOn);
				updatedTargetTask.title = updatedTargetTaskTitle;

				// console.log('Updated source task :', updatedSourceTask, "\nOld source task:", sourceTask);
				updateTaskInFile(plugin, updatedTargetTask, targetTask).then((newId) => {
					plugin.realTimeScanner.processAllUpdatedFiles(updatedTargetTask.filePath);
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
						plugin.realTimeScanner.processAllUpdatedFiles(
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

	// const throttledSetViewportStorage = throttle((vp: viewPortType) => {
	// 	console.log('Saving viewport:', vp);
	// 	localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(vp));
	// }, 20000);

	// const lastViewportSaveTime = useRef(0);
	const debouncedSetViewportStorage = useCallback(debounce((vp: viewPortType) => {
		// const now = Date.now();
		// if (now - lastViewportSaveTime.current > 2000) {
		try {
			if (!viewPortDataUpdated.current) {
				eventEmitter.emit("MAP_UNSAVED", { onlyviewport: true });
			}

			// Validate viewport values before saving
			const safeViewport: viewPortType = {
				x: Number.isFinite(vp.x) ? vp.x : 10,
				y: Number.isFinite(vp.y) ? vp.y : 10,
				zoom: Number.isFinite(vp.zoom) && vp.zoom > 0 ? vp.zoom : 1.5
			};
			// Update the in-memory board object; persisting to disk will be handled by SAVE_MAP elsewhere
			// setViewport(safeViewport);
			viewPortData.current = safeViewport;
			// emitMapDataUpdatedSignal(true);
			// console.log("Will make the viewPortDataUpdated TRUE on fresh render...");
			viewPortDataUpdated.current = true;
			// lastViewportSaveTime.current = now;
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(99, String(error), 'MapView.tsx/debouncedSetViewportStorage');
		}
		// }
	}, 500), []);


	const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {

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
					plugin.settings.data.mapView.background = mapViewBackgrounVariantTypes.transparent;
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
					plugin.settings.data.mapView.background = mapViewBackgrounVariantTypes.dots;
					plugin.saveSettings();

					eventEmitter.emit('REFRESH_BOARD');
				})
				item.setChecked(mapViewSettings.background === mapViewBackgrounVariantTypes.dots);
			})

			backgroundMenu.addItem((item) => {
				item.setTitle(t("lines"));
				item.setIcon("grid-3x3");
				item.onClick(() => {
					plugin.settings.data.mapView.background = mapViewBackgrounVariantTypes.lines;
					plugin.saveSettings();

					eventEmitter.emit('REFRESH_BOARD');
				})
				item.setChecked(mapViewSettings.background === mapViewBackgrounVariantTypes.lines);
			})

			backgroundMenu.addItem((item) => {
				item.setTitle(t("cross"));
				item.setIcon("x");
				item.onClick(() => {
					plugin.settings.data.mapView.background = mapViewBackgrounVariantTypes.cross;
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
				plugin.settings.data.mapView.showMinimap = !plugin.settings.data.mapView.showMinimap;
				plugin.saveSettings();

				eventEmitter.emit('REFRESH_BOARD');
			})
			item.setChecked(mapViewSettings.showMinimap);
		});

		sortMenu.addItem((item) => {
			item.setTitle(t("animate-links"));
			item.setIcon("worm");
			item.onClick(async () => {
				plugin.settings.data.mapView.animatedEdges = !plugin.settings.data.mapView.animatedEdges;
				plugin.saveSettings();

				eventEmitter.emit('REFRESH_BOARD');
			})
			item.setChecked(mapViewSettings.animatedEdges);
		});

		// Use native event if available (React event has nativeEvent property)
		sortMenu.showAtMouseEvent(
			(event instanceof MouseEvent ? event : event.nativeEvent)
		);
	}, [mapViewSettings.background, mapViewSettings.showMinimap, mapViewSettings.animatedEdges]);

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

	const deleteEdge = async (event: ReactMouseEvent, edge: Edge) => {
		// Edge id format: `${targetId}->${sourceId}`
		const [targetId, sourceId] = edge.id.split('->');
		const allTasks = allTasksFlattened;
		const targetTask = allTasks.find(t => (t.legacyId ? t.legacyId : String(t.id)) === targetId);
		if (!targetTask) {
			bugReporterManagerInsatance.showNotice(18, "The parent task was not found in the cache. Maybe the ID didnt match or the task itself was not present in the file. Or the file has been moved to a different location.", `Parent task id : ${targetId}\nChild task id : ${sourceId}`, "MapView.tsx/handleEdgeClick");
			return;
		}

		if (!Array.isArray(targetTask.dependsOn)) {
			bugReporterManagerInsatance.showNotice(19, "The parent task contains no such dependency. There is some descripancy in the cache or the cache might have been corrupted.", `Parent task id : ${targetId}\nChild task id : ${sourceId}\nParent task cache : ${JSON.stringify(targetTask)}`, "MapView.tsx/handleEdgeClick");
			return;
		}

		const updatedDependsOn = targetTask.dependsOn.filter((dep: string) => dep !== sourceId);
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
				const updatedTargetTaskTitle = sanitizeDependsOn(plugin.settings.data, updatedTargetTask.title, updatedTargetTask.dependsOn);
				updatedTargetTask.title = updatedTargetTaskTitle;

				await updateTaskInFile(plugin, updatedTargetTask, targetTask);
				sleep(100).then(() => {
					plugin.realTimeScanner.processAllUpdatedFiles(updatedTargetTask.filePath);
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
						plugin.realTimeScanner.processAllUpdatedFiles(
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
			bugReporterManagerInsatance.showNotice(20, "There was an error while updating the parent task inside the file. Please see the below error message.", String(err), "MapView.tsx/handleEdgeClick");
		}
	}

	const toggleTasksImporterPanel = useCallback(() => {
		setIsImporterPanelVisible(prev => !prev);
	}, []);

	const handleEdgeClick = useCallback((event: ReactMouseEvent, edge: Edge) => {
		// Show Obsidian menu for the selected edge
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle(t("delete-dependency"));
			item.setIcon("trash");
			item.onClick(async () => {
				deleteEdge(event, edge);
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
	}, [allTasksFlattened, taskNoteIdentifierTag, plugin]);


	// -------------------------------------------------------------
	//            ALL RENDERING CODE
	// -------------------------------------------------------------

	if (allTasksFlattened.length === 0) {
		return (
			<div className='taskBoardMapViewWrapper'>
				<div className="taskBoardMapView">
					<div className="taskBoardMapViewContainer">
						<span className="taskBoardMapViewContainerInitialMessage">{t("no-tasks-found-for-current-board-message")}</span>
					</div>
				</div>
			</div>
		);
	} else if (storageLoaded && computedNodes.length === 0) {
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
						allTasksArranged={[allTasksFlattened]}
						activeBoardSettings={activeBoardData}
						activeViewData={currentView}
						activeViewIndex={currentViewIndex}
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

							const vpForBoard = viewPortData.current || { x: 10, y: 10, zoom: 1.5 };
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
							onEdgeContextMenu={deleteEdge}
							onNodesChange={onNodesChange}
							onNodeDragStop={(node) => {
								console.log("Following node position has been updated : ", node);
								handlenodePositionChange();
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
							onMoveEnd={(event, vp) => {
								// setViewport(prev => ({ ...prev, [activeBoardIndex]: vp })); // NOTE : Dont update the viewport here again, as it is giving a glitching behavior.
								if (event)
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
								console.log("Reactflow Initializing...");
								// store reactflow instance for later programmatic viewport updates
								// try {
								// 	reactFlowInstanceRef.current = instance;
								// } catch (e) {
								// 	// ignore
								// }
								if (focusOnTaskId) {
									const node = nodes.find(n => n.id === focusOnTaskId);
									if (node && Number.isFinite(node.position.x) && Number.isFinite(node.position.y)) {
										const newVp: viewPortType = {
											x: - (node.position.x - 300),
											y: - (node.position.y - 300),
											zoom: 1
										};
										// Validate the new viewport before setting
										if (Number.isFinite(newVp.x) && Number.isFinite(newVp.y) && Number.isFinite(newVp.zoom)) {
											instance.setViewport(newVp);
											// setViewport(newVp);
											viewPortData.current = newVp;
											// console.log("We are running the debouncedSetViewportStorage from here.");
											debouncedSetViewportStorage(newVp);
											viewPortDataUpdated.current = true;
											return;
										}
									}
								}
								// Use current viewport if valid for this board, otherwise fall back to defaults
								const currentVpForBoard = viewPortData.current;
								if (currentVpForBoard && Number.isFinite(currentVpForBoard.x) && Number.isFinite(currentVpForBoard.y) && Number.isFinite(currentVpForBoard.zoom) && currentVpForBoard.zoom > 0) {
									instance.setViewport(currentVpForBoard);
								} else {
									const defaultVp: viewPortType = { x: 10, y: 10, zoom: 1.5 };
									instance.setViewport(defaultVp);
									// setViewport(defaultVp);
									viewPortData.current = defaultVp;
								}
							}}
							defaultViewport={viewPortData.current}
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

							{/* DEBUG: Selection monitoring */}
							{/* <MapViewSelectionDebugger /> */}
						</ReactFlow>

						<TasksImporterPanel
							plugin={plugin}
							allTasksArranged={[allTasksFlattened]}
							activeBoardSettings={activeBoardData}
							activeViewData={currentView}
							activeViewIndex={currentViewIndex}
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
