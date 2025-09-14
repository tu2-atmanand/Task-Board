import { memo, ReactNode } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { nodeSize } from './MapView';

interface ResizableNodeSelectedProps {
	data: { label: ReactNode };
	selected: boolean;
}

const ResizableNodeSelected = ({ data, selected }: ResizableNodeSelectedProps) => {
	// let width: number | undefined = undefined;
	// let height: number | undefined = undefined;
	// const sizeData: Record<string, nodeSize> = JSON.parse(localStorage.getItem('NODE_SIZE_STORAGE_KEY') || '{}');
	// if (sizeData && data.label && typeof (data.label as any).key === 'string') {
	// 	try {
	// 		const parsed = sizeData[(data.label as any).key as string];
	// 		width = parsed?.width ?? undefined;
	// 		height = parsed?.height ?? undefined;
	// 	} catch {
	// 		// ignore parse errors
	// 	}
	// }

	// console.log('Node size from localStorage:', { width, height });

	return (
		<>
			<NodeResizer
				color="#ff0071"
				isVisible={selected}
				autoScale={true}
				// minWidth={width ?? 100}
				// minHeight={height ?? 30}
				onResizeEnd={(newSize) => {
					console.log('Node resized to:', newSize);

					// if (data.label && typeof (data.label as any).key === 'string') {
					// 	const sizeData: Record<string, nodeSize> = JSON.parse(localStorage.getItem('NODE_SIZE_STORAGE_KEY') || '{}');
					// 	sizeData[(data.label as any).key as string] = newSize;
					// 	localStorage.setItem('NODE_SIZE_STORAGE_KEY', JSON.stringify(sizeData));
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
