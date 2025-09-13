import { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';

interface ResizableNodeSelectedProps {
	data: { label: string };
	selected: boolean;
}

const ResizableNodeSelected = ({ data, selected }: ResizableNodeSelectedProps) => {
	return (
		<>
			<NodeResizer
				color="#ff0071"
				isVisible={selected}
				autoScale={true}
				minWidth={100}
				minHeight={30}
			/>
			<Handle type="target" position={Position.Top} />
			<div style={{ padding: 1 }}>{data.label}</div>
			<Handle type="source" position={Position.Bottom} />
		</>
	);
};

export default memo(ResizableNodeSelected);
