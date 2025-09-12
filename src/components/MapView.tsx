import React, { useState, useEffect, useCallback } from 'react';
import {
	ReactFlow,
	ReactFlowProvider,
	addEdge,
	useNodesState,
	Controls,
	Background,
	useReactFlow,
	Node,
	MiniMap,
	applyEdgeChanges,
	applyNodeChanges
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { taskItem } from 'src/interfaces/TaskItem';
import TaskItem from './TaskItem';
import TaskBoard from 'main';
import { Board } from 'src/interfaces/BoardConfigs';

type MapViewProps = {
	plugin: TaskBoard;
	boards: Board[];
	activeBoardIndex: number;
	allTasksArranged: taskItem[][];
};

const STORAGE_KEY = 'taskboard_map_positions';

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

	const [positions, setPositions] = useState(loadPositions);
	const activeBoardSettings = plugin.settings.data.boardConfigs[activeBoardIndex];

	// Generate initial node structure
	const initialNodes: Node[] = allTasksArranged[activeBoardIndex].map((task: taskItem, idx: number) => {
		const id = String(task.id);
		const saved = positions[id] || {};
		return {
			id,
			type: 'default',
			data: {
				label: <TaskItem
					key={task.id}
					plugin={plugin}
					taskKey={task.id}
					task={task}
					activeBoardSettings={activeBoardSettings}
				/>
			},
			position: { x: saved.x ?? (idx % 5) * 250, y: saved.y ?? Math.floor(idx / 5) * 200 },
			width: 300,
		};
	});

	// Manage nodes state
	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	// const { project } = useReactFlow();

	// Persist updated positions
	useEffect(() => {
		const posMap = nodes.reduce((acc, n) => {
			acc[n.id] = { x: n.position?.x || 0, y: n.position?.y || 0 };
			return acc;
		}, {} as Record<string, { x: number; y: number; }>);
		setPositions(posMap);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(posMap));
	}, [nodes]);

	return (
		<div className="mapView">
			<ReactFlowProvider>
				<div className="mapViewContainer" style={{ width: '100%', height: '80vh' }}>
					<ReactFlow
						nodes={nodes}
						edges={[]} // No linking initially
						onNodesChange={onNodesChange}
						fitView={true}
						panOnScroll={false}
						zoomOnPinch={true}
						zoomOnScroll={true}
						onlyRenderVisibleElements={true}
					>
						<Controls />
						<MiniMap />
						<Background gap={12} size={1} />
					</ReactFlow>
				</div>
			</ReactFlowProvider>
		</div>
	);
};

export default MapView;
