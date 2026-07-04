import React from 'react';
import { Handle, useNodeId, useReactFlow } from '@xyflow/react';
import type { HandleProps } from '@xyflow/react';

export default function SmartHandle(props: HandleProps) {
  const nodeId = useNodeId();
  const { getNode } = useReactFlow();
  const node = getNode(nodeId || '');
  
  // Hide handles if this node is inside a group
  if (node?.parentId) return null;
  
  return <Handle {...props} />;
}
