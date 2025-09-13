import React, { useState, useEffect, useCallback } from 'react';
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
	applyEdgeChanges,
	applyNodeChanges,
	Connection
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { taskItem } from 'src/interfaces/TaskItem';
import TaskBoard from 'main';
import { Board } from 'src/interfaces/BoardConfigs';
import ResizableNodeSelected from './ResizableNodeSelected';
import TaskItem from '../KanbanView/TaskItem';
import CustomNodeResizer from './CustomNodeResizer';

type MapViewProps = {
	plugin: TaskBoard;
	boards: Board[];
	activeBoardIndex: number;
	allTasksArranged: taskItem[][];
};

const STORAGE_KEY = 'taskboard_map_positions';
const EDGE_STORAGE_KEY = 'taskboard_map_edges';
const NODE_SIZE_STORAGE_KEY = 'taskboard_map_node_sizes';

const nodeTypes = {
	CustomNodeResizer,
	ResizableNodeSelected,
};

export const MapView: React.FC<MapViewProps> = ({
	plugin, boards, activeBoardIndex, allTasksArranged
}) => {
	// Load positions from localStorage
	const loadPositions = () => {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, { x: number; y: number; }>;
		} catch {
			return {};
		}
	};
	// Load edges from localStorage
	const loadEdges = () => {
		try {
			return JSON.parse(localStorage.getItem(EDGE_STORAGE_KEY) || '[]') as Edge[];
		} catch {
			return [];
		}
	};
	// Load node sizes from localStorage
	const loadNodeSizes = () => {
		try {
			return JSON.parse(localStorage.getItem(NODE_SIZE_STORAGE_KEY) || '{}') as Record<string, { width: number; height: number; }>;
		} catch {
			return {};
		}
	};

	const [positions, setPositions] = useState(loadPositions);
	const [nodeSizes, setNodeSizes] = useState(loadNodeSizes());
	const activeBoardSettings = plugin.settings.data.boardConfigs[activeBoardIndex];

	// const reactFlowInstance = useReactFlow();
	// useEffect(() => {
	// 	// Set initial viewport (x, y, zoom)
	// 	reactFlowInstance.setViewport({ x: positions[0].x, y: positions[0].y, zoom: 1 }); // TODO : Later store this value and then apply it. Also, a new feature can be added, where user will open this MapView with the position of a selected task. In this case, directly set the viewport to that position, with adequate zoom level.
	// }, []);

	// Kanban-style initial layout
	const initialNodes: Node[] = [];
	const allTasksFlat: taskItem[] = allTasksArranged.flat();
	let xOffset = 0;
	const columnSpacing = 350;
	const rowSpacing = 120;
	allTasksArranged.forEach((columnTasks, colIdx) => {
		let yOffset = 0;
		columnTasks.forEach((task, rowIdx) => {
			if (!task.legacyId) return;

			const id = task.legacyId ? task.legacyId : String(task.id);
			const savedPos = positions[id] || {};
			const savedSize = nodeSizes[id] || {};
			initialNodes.push({
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
		});
		xOffset += columnSpacing;
	});

	// Manage nodes state
	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

	// Calculate edges from dependsOn property
	function getEdgesFromTasks(tasks: taskItem[]): Edge[] {
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
							markerEnd: 'arrowclosed'
						});
					}
				});
			}
		});
		return edges;
	}
	const edges = getEdgesFromTasks(allTasksFlat);

	// Persist updated positions and sizes
	useEffect(() => {
		const posMap = nodes.reduce((acc, n) => {
			acc[n.id] = { x: n.position?.x || 0, y: n.position?.y || 0 };
			return acc;
		}, {} as Record<string, { x: number; y: number; }>);
		setPositions(posMap);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(posMap));

		const sizeMap = nodes.reduce((acc, n) => {
			acc[n.id] = { width: n.width ?? 300, height: n.height ?? 80 };
			return acc;
		}, {} as Record<string, { width: number; height: number; }>);
		setNodeSizes(sizeMap);
		localStorage.setItem(NODE_SIZE_STORAGE_KEY, JSON.stringify(sizeMap));
	}, [nodes]);

	// Handle edge creation (connecting nodes)
	const onConnect = useCallback((params: Connection) => {
		connectParentToChild(params.source, params.target);
		// You may want to update the dependsOn property of the source task and trigger a re-render
	}, []);

	// Dummy function for connecting parent to child
	function connectParentToChild(sourceNodeId: string, targetNodeId: string) {
		const allTasks = allTasksArranged.flat();
		console.log('Connecting', sourceNodeId, 'to', targetNodeId);
		console.log('Source Task:', allTasks.find(t => t.legacyId === sourceNodeId || String(t.id) === sourceNodeId));
		console.log('Target Task:', allTasks.find(t => t.legacyId === targetNodeId || String(t.id) === targetNodeId));
		// Implement your logic here to add dependency to the source task
		// For example:
		// plugin.addDependencyToTask(sourceNodeId, targetNodeId);
		// Or update the dependsOn property of the source task
		// console.log('Connecting', sourceNodeId, 'to', targetNodeId);
	}

	// Optionally, handle node resize events if your node type supports it
	// You may need to implement a custom node type with resize handles

	return (
		<div className="mapView">
			<ReactFlowProvider>
				<div className="mapViewContainer" style={{ width: '100%', height: '80vh' }}>
					<ReactFlow
						nodes={nodes}
						edges={edges}
						nodeTypes={nodeTypes}
						onNodesChange={onNodesChange}
						// onEdgesChange={onEdgesChange}
						onConnect={onConnect}
						fitView={true}
						panOnScroll={false}
						zoomOnPinch={true}
						zoomOnScroll={true}
						onlyRenderVisibleElements={true}
						onInit={(instance) => {
							// Set initial viewport here
							// instance.setViewport({ x: positions[0].x, y: positions[0].y, zoom: 2 });
							instance.setViewport({ x: 10, y: 10, zoom: 1.5 });
						}}
					>
						<Controls />
						<MiniMap />
						<Background gap={12} size={1} color='transparent' />
					</ReactFlow>
				</div>
			</ReactFlowProvider>
		</div>
	);
};

export default MapView;
