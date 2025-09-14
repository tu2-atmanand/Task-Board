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
	MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { taskItem } from 'src/interfaces/TaskItem';
import TaskBoard from 'main';
import { Board } from 'src/interfaces/BoardConfigs';
import ResizableNodeSelected from './ResizableNodeSelected';
import TaskItem from '../KanbanView/TaskItem';
import CustomNodeResizer from './CustomNodeResizer';
import { updateTaskInFile } from 'src/utils/TaskItemUtils';
import { debounce } from 'obsidian';
import { NODE_POSITIONS_STORAGE_KEY, NODE_SIZE_STORAGE_KEY, VIEWPORT_STORAGE_KEY } from 'src/types/GlobalVariables';
import { sanitizeDependsOn } from 'src/utils/TaskContentFormatter';

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
	height: number;
}

export type nodePosition = {
	x: number;
	y: number;
}

const nodeTypes = {
	CustomNodeResizer,
	ResizableNodeSelected,
};

const MapView: React.FC<MapViewProps> = ({
	plugin, boards, activeBoardIndex, allTasksArranged, focusOnTaskId
}) => {
	// console.log('MapView rendered with', { activeBoardIndex, boards, allTasksArranged, focusOnTaskId });

	// Load positions from localStorage, board-wise
	const loadPositions = () => {
		let allBoardPositions: Record<string, Record<string, nodePosition>> = {};
		try {
			allBoardPositions = JSON.parse(localStorage.getItem(NODE_POSITIONS_STORAGE_KEY) || '{}');
		} catch {
			allBoardPositions = {};
		}

		try {
			return allBoardPositions[String(activeBoardIndex)] || {};
		} catch {
			return {};
		}
	};
	// Load node sizes from localStorage
	const loadNodeSizes = () => {
		try {
			return JSON.parse(localStorage.getItem(NODE_SIZE_STORAGE_KEY) || '{}') as Record<string, nodeSize>;
		} catch {
			return {};
		}
	};
	// Viewport state
	const loadViewport = (): viewPort => {
		try {
			return JSON.parse(localStorage.getItem(VIEWPORT_STORAGE_KEY) || '{}') as viewPort;
		} catch {
			return { x: 10, y: 10, zoom: 1.5 };
		}
	};


	// Loading state for localStorage data
	const [storageLoaded, setStorageLoaded] = useState(false);
	const [positions, setPositions] = useState<Record<string, nodePosition>>({});
	const [nodeSizes, setNodeSizes] = useState<Record<string, nodeSize>>({});
	const [viewport, setViewport] = useState<viewPort>({ x: 10, y: 10, zoom: 1.5 });

	// Load all storage data on mount and when activeBoardIndex changes
	useEffect(() => {
		// Load and sanitize positions
		const pos = loadPositions();
		Object.keys(pos).forEach(id => {
			if (!Number.isFinite(pos[id].x)) pos[id].x = 0;
			if (!Number.isFinite(pos[id].y)) pos[id].y = 0;
		});
		setPositions(pos);

		// Load and sanitize node sizes
		const sizes = loadNodeSizes();
		Object.keys(sizes).forEach(id => {
			if (!Number.isFinite(sizes[id].width)) sizes[id].width = 300;
			if (!Number.isFinite(sizes[id].height)) sizes[id].height = 80;
		});
		setNodeSizes(sizes);

		// Load and sanitize viewport
		const vp = loadViewport();
		if (!Number.isFinite(vp.x)) vp.x = 10;
		if (!Number.isFinite(vp.y)) vp.y = 10;
		if (!Number.isFinite(vp.zoom)) vp.zoom = 1.5;
		setViewport(vp);

		setStorageLoaded(true);
	}, [activeBoardIndex]);
	const activeBoardSettings = plugin.settings.data.boardConfigs[activeBoardIndex];

	// const reactFlowInstance = useReactFlow();
	// useEffect(() => {
	// 	// Set initial viewport (x, y, zoom)
	// 	reactFlowInstance.setViewport({ x: positions[0].x, y: positions[0].y, zoom: 1 }); // TODO : Later store this value and then apply it. Also, a new feature can be added, where user will open this MapView with the position of a selected task. In this case, directly set the viewport to that position, with adequate zoom level.
	// }, []);


	// Kanban-style initial layout, memoized
	const initialNodes: Node[] = useMemo(() => {
		console.log("Are all the nodes re-calculating when the allTasksArranged changes or only specific ones?\nAllTasksArranged:", allTasksArranged, "\nPositions:", positions, "\nNodeSizes:", nodeSizes);
		const nodes: Node[] = [];
		// const allTasksFlat: taskItem[] = allTasksArranged.flat();
		let xOffset = 0;
		const columnSpacing = 350;
		const rowSpacing = 120;
		allTasksArranged.forEach((columnTasks, colIdx) => {
			let yOffset = 0;
			columnTasks.forEach((task, rowIdx) => {
				if (task.legacyId) {
					const id = task.legacyId ? task.legacyId : String(task.id);
					const savedPos = positions[id] || {};
					const savedSize = nodeSizes[id] || {};
					console.log('Rendering node for task with id:', id, '\nsavedPos:', savedPos, '\nsavedSize:', savedSize);
					nodes.push({
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
							x: savedPos.x ?? xOffset,
							y: savedPos.y ?? yOffset
						},
						width: savedSize.width ?? 300,
						height: savedSize.height ?? 80,
					});
					yOffset += rowSpacing;
				}

			});
			xOffset += columnSpacing;
		});
		return nodes;
	}, [allTasksArranged, activeBoardSettings, activeBoardIndex, positions]);

	// Manage nodes state
	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

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
		tasks.forEach(task => {
			const sourceId = task.legacyId ? task.legacyId : String(task.id);
			if (Array.isArray(task.dependsOn)) {
				task.dependsOn.forEach(depId => {
					if (idToTask.has(depId)) {
						edges.push({
							id: `${sourceId}->${depId}`,
							source: sourceId,
							target: depId,
							type: 'default',
							animated: false,
							markerEnd: {
								type: MarkerType.ArrowClosed, // required property
								// optional properties
								color: 'white',
								height: 30,
								width: 30,
							},
						});
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
			allBoardPositions = JSON.parse(localStorage.getItem(NODE_POSITIONS_STORAGE_KEY) || '{}');
		} catch {
			allBoardPositions = {};
		}

		// Update positions for current board
		const posMap = nodes.reduce((acc, n) => {
			acc[n.id] = { x: n.position?.x || 0, y: n.position?.y || 0 };
			return acc;
		}, {} as Record<string, nodePosition>);
		setPositions(posMap);
		// console.log('Updated positions map:', posMap);
		allBoardPositions[String(activeBoardIndex)] = posMap;
		localStorage.setItem(NODE_POSITIONS_STORAGE_KEY, JSON.stringify(allBoardPositions));
		// console.log('Saved all board positions inside localStorage:', JSON.parse(localStorage.getItem(NODE_POSITIONS_STORAGE_KEY) || '{}'));
	};

	// Persist updated positions and sizes
	const prevNodeSizesRef = useRef<Record<string, { width: number; height: number }>>({});

	// Only save sizes if they have changed
	useEffect(() => {
		const sizeMap = nodes.reduce((acc, n) => {
			acc[n.id] = { width: n.width ?? 300, height: n.height ?? 80 };
			return acc;
		}, {} as Record<string, { width: number; height: number }>);

		// Compare with previous sizes
		const prevSizes = prevNodeSizesRef.current;
		let changed = false;
		for (const id in sizeMap) {
			if (
				!prevSizes[id] ||
				prevSizes[id].width !== sizeMap[id].width ||
				prevSizes[id].height !== sizeMap[id].height
			) {
				changed = true;
				break;
			}
		}

		if (changed) {
			setNodeSizes(sizeMap);
			localStorage.setItem(NODE_SIZE_STORAGE_KEY, JSON.stringify(sizeMap));
			prevNodeSizesRef.current = sizeMap;
		}
	}, [nodes]);

	// Handle edge creation (connecting nodes)
	const onConnect = useMemo<((params: Connection) => void)>(() => {
		const flattenedTasks = allTasksArranged.flat();
		return (params: Connection) => {
			connectParentToChild(params.source, params.target, flattenedTasks);
			// You may want to update the dependsOn property of the source task and trigger a re-render
		};
	}, [allTasksArranged]);

	// Dummy function for connecting parent to child
	function connectParentToChild(sourceNodeId: string, targetNodeId: string, allTasks: taskItem[]) {
		// const allTasks = allTasksArranged.flat();
		console.log("AllTasksArranged:", allTasksArranged);
		console.log('Connecting', sourceNodeId, 'to', targetNodeId);
		console.log('Source Task:', allTasks.find(t => t.legacyId === sourceNodeId || String(t.id) === sourceNodeId));
		console.log('Target Task:', allTasks.find(t => t.legacyId === targetNodeId || String(t.id) === targetNodeId));

		const sourceTask = allTasks.find(t => t.legacyId === sourceNodeId || String(t.id) === sourceNodeId);
		if (!sourceTask) return;
		const targetTask = allTasks.find(t => t.legacyId === targetNodeId || String(t.id) === targetNodeId);
		if (!targetTask) return;

		const updatedSourceTask = {
			...sourceTask,
			dependsOn: Array.isArray(sourceTask.dependsOn) ? [...sourceTask.dependsOn] : []
		};

		const targetLegacyId = targetTask.legacyId ? targetTask.legacyId : String(targetTask.id);
		console.log('Adding dependency on targetLegacyId:', targetLegacyId);
		if (!updatedSourceTask.dependsOn.includes(targetLegacyId)) {
			updatedSourceTask.dependsOn.push(targetLegacyId);
			const updatedSourceTaskTitle = sanitizeDependsOn(plugin.settings.data.globalSettings, updatedSourceTask.title, updatedSourceTask.dependsOn);
			updatedSourceTask.title = updatedSourceTaskTitle;

			console.log('Updated source task :', updatedSourceTask, "\nOld source task:", sourceTask);
			updateTaskInFile(plugin, updatedSourceTask, sourceTask).finally(() => {
				plugin.realTimeScanning.processAllUpdatedFiles(updatedSourceTask.filePath);
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
			console.log('Saving viewport:', vp);
			localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(vp));
			lastViewportSaveTime.current = now;
		}
	}, 2000);


	if (!storageLoaded) {
		return (
			<div className='mapViewWrapper'>
				<div className="mapView">
					<div className="mapViewContainer" style={{ width: '100%', height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						<div className="spinner"></div>
						<span>Loading map data...</span>
					</div>
				</div>
			</div>
		);
	}
	return (
		<div className='mapViewWrapper'>
			<div className="mapView">
				<ReactFlowProvider>
					<div className="mapViewContainer" style={{ width: '100%', height: '80vh' }}>
						<ReactFlow
							nodes={nodes}
							edges={edges}
							nodeTypes={nodeTypes}
							onNodesChange={onNodesChange}
							onNodeDragStop={() => {
								console.log('Node drag stopped');
								handleNodePositionChange();
							}}
							// onEdgesChange={onEdgesChange}
							onConnect={onConnect}
							// fitView={true}
							panOnScroll={false}
							zoomOnPinch={true}
							zoomOnScroll={true}
							onlyRenderVisibleElements={true}
							defaultViewport={viewport}
							onMoveEnd={(_, vp) => {
								setViewport(vp);
								debouncedSetViewportStorage(vp);
								// throttledSetViewportStorage(vp);
							}}
							onInit={(instance) => {
								if (focusOnTaskId) {
									const node = nodes.find(n => n.id === focusOnTaskId);
									if (node) {
										const newVp: viewPort = {
											x: node.position.x - 100,
											y: node.position.y - 100,
											zoom: 1.5
										};
										instance.setViewport(newVp);
										setViewport(newVp);
										// localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(newVp));
										debouncedSetViewportStorage(newVp);
										// throttledSetViewportStorage(newVp);
										return;
									}
								}
								instance.setViewport(viewport);
							}}
						>
							<Controls />
							<MiniMap />
							<Background gap={12} size={1} color='transparent' />
						</ReactFlow>
					</div>
				</ReactFlowProvider>
			</div>
		</div>
	);
};

export default memo(MapView);
