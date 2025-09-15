import { memo, ReactNode, FC } from 'react';
import { Handle, Position, NodeResizer, NodeProps } from '@xyflow/react';
import { nodeSize } from './MapView';

interface ResizableNodeSelectedProps {
	data: { label: ReactNode };
	selected: boolean;
}

const ResizableNodeSelected: FC<NodeProps & ResizableNodeSelectedProps> = ({ id, data, selected, width, height }) => {
	console.log('Rendering ResizableNodeSelected for node:', id, { width, height, data });

	return (
		<>
			<NodeResizer
				color="#ff0071"
				isVisible={selected}
				autoScale={true}
				minWidth={width ?? 100}
				minHeight={height ?? 30}
				onResizeEnd={(newSize) => {
					console.log('Node resized to:', newSize, "\nNode ID:", id);
					// try {
					// 	const sizeData: Record<string, nodeSize> = JSON.parse(localStorage.getItem('NODE_SIZE_STORAGE_KEY') || '{}');
					// 	sizeData[id] = { width: newSize.width, height: newSize.height };
					// 	localStorage.setItem('NODE_SIZE_STORAGE_KEY', JSON.stringify(sizeData));
					// } catch (e) {
					// 	console.error('Failed to update node size in localStorage:', e);
					// }
				}}
			/>
			<Handle type="target" position={Position.Top} />
			<div style={{
				padding: 1,
				// minHeight: height ?? 30,
				// minWidth: width ?? 100
			}}>{data.label}</div>
			<Handle type="source" position={Position.Bottom} />
		</>
	);
};

export default memo(ResizableNodeSelected);
