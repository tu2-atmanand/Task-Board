import React, { FC, memo } from 'react';
import { NodeProps } from '@xyflow/react';

interface dataProps extends React.ReactElement<unknown, string> {
}

interface ResizableNodeSelectedProps {
	data: { label: dataProps };
	selected: boolean;
}

const MapOverlayNode: FC<NodeProps & ResizableNodeSelectedProps> = ({ id, data, selected, width, height }) => {

	return (
		<div>
			{data.label}
			{/* No handles, because this node should not connect to anything */}
		</div>
	);
};

export default memo(MapOverlayNode);
