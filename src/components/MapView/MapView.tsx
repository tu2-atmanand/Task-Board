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
	SelectionMode
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
	// console.log('MapView rendered with', { activeBoardIndex, boards, allTasksArranged, focusOnTaskId });
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
			// if (!Number.isFinite(sizes[id].height)) sizes[id].height = 80;
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
	// 	reactFlowInstance.setViewport({ x: positions[0].x, y: positions[0].y, zoom: 1 });
	// }, []);


	// Kanban-style initial layout, memoized
	const initialNodes: Node[] = useMemo(() => {
		const nodes: Node[] = [];
		const usedIds = new Set<string>();
		const columnSpacing = 350;
		const rowSpacing = 170;

		let xOffset = 0;
		allTasksArranged.forEach((columnTasks, colIdx) => {
			let yOffset = 0;
			columnTasks.forEach((task, rowIdx) => {
				if (task.legacyId) {
					const id = task.legacyId ? task.legacyId : String(task.id);
					if (usedIds.has(id)) {
						console.warn('Duplicate node id detected:', id, "\nTitle : ", task.title);
						return; // Skip duplicate
					}
					usedIds.add(id);
					const savedPos = positions[id] || {};
					const savedSize = nodeSizes[id] || {};
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
							x: Number.isFinite(savedPos.x) ? savedPos.x : xOffset,
							y: Number.isFinite(savedPos.y) ? savedPos.y : yOffset
						},
						// style: {
						// 	width: savedSize.width ?? 300,
						// 	height: savedSize.height ?? 80,
						// },
						width: Number.isFinite(savedSize.width) ? savedSize.width : Number(plugin.settings.data.globalSettings.columnWidth),
						// height: Number.isFinite(savedSize.height) ? savedSize.height : undefined,
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
							animated: mapViewSettings.animatedEdges,
							markerStart: {
								type: MarkerType.ArrowClosed, // required property
								// optional properties
								color: 'var(--text-normal)',
								height: mapViewSettings.arrowDirection !== mapViewArrowDirection.childToParent ? 30 : 0,
								width: mapViewSettings.arrowDirection !== mapViewArrowDirection.childToParent ? 30 : 0,
							},
							markerEnd: {
								type: MarkerType.ArrowClosed, // required property
								// optional properties
								color: 'var(--text-normal)',
								height: mapViewSettings.arrowDirection !== mapViewArrowDirection.parentToChild ? 30 : 0,
								width: mapViewSettings.arrowDirection !== mapViewArrowDirection.parentToChild ? 30 : 0,
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

		const updatedSourceTask = {
			...sourceTask,
			dependsOn: Array.isArray(sourceTask.dependsOn) ? [...sourceTask.dependsOn] : []
		};

		const targetLegacyId = targetTask.legacyId ? targetTask.legacyId : String(targetTask.id);
		// console.log('Adding dependency on targetLegacyId:', targetLegacyId);
		if (!updatedSourceTask.dependsOn.includes(targetLegacyId)) {
			updatedSourceTask.dependsOn.push(targetLegacyId);
			const updatedSourceTaskTitle = sanitizeDependsOn(plugin.settings.data.globalSettings, updatedSourceTask.title, updatedSourceTask.dependsOn);
			updatedSourceTask.title = updatedSourceTaskTitle;

			// console.log('Updated source task :', updatedSourceTask, "\nOld source task:", sourceTask);
			updateTaskInFile(plugin, updatedSourceTask, sourceTask).then((newId) => {
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
			localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(vp));
			lastViewportSaveTime.current = now;
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


	if (!storageLoaded) {
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
					<div className="taskBoardMapViewContainer" style={{ width: '100%', height: '85vh' }}>
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
							onlyRenderVisibleElements={false} // TODO : If this is true, then the initial render is faster, but while panning the experience is little laggy.
							onInit={(instance) => {
								if (focusOnTaskId) {
									const node = nodes.find(n => n.id === focusOnTaskId);
									if (node) {
										const newVp: viewPort = {
											x: - (node.position.x - 200),
											y: - (node.position.y),
											zoom: 1
										};
										instance.setViewport(newVp);
										setViewport(newVp);
										// localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(newVp));
										debouncedSetViewportStorage(newVp);
										// throttledSetViewportStorage(newVp);
										return;
									}
								}
								else {
									instance.setViewport(viewport);
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
							<Controls />

							{mapViewSettings.showMinimap && (
								<MapViewMinimap />
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
