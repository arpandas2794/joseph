import React from 'react';
import { LogOut } from 'lucide-react';
import { useReactFlow, useNodeId } from '@xyflow/react';
import { useCanvasStore } from '../../store/canvasStore';
import { workspaceApi } from '../../lib/api';
import { useParams } from 'react-router-dom';
import { layoutGroupChildren } from '../../utils/gridLayout';

export default function UngroupButton({ className }: { className?: string }) {
  const { id: workspaceId } = useParams();
  const nodeId = useNodeId();
  const reactFlow = useReactFlow();
  const state = useCanvasStore();

  const node = reactFlow.getNode(nodeId || '');
  if (!node || !node.parentId) return null;

  const handleUngroup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nodeId || !workspaceId) return;
    
    const parentNode = reactFlow.getNode(node.parentId as string);
    const absX = (parentNode?.position?.x || 0) + node.position.x;
    const absY = (parentNode?.position?.y || 0) + node.position.y;

    let newPosition: { x: number, y: number } = { x: absX, y: absY };
    let restData = { ...node.data };
    if (restData.originalPosition) {
      newPosition = restData.originalPosition as { x: number, y: number };
      delete restData.originalPosition;
    }

    const updatedNode = {
      ...node,
      parentId: undefined,
      position: newPosition,
      data: restData,
    };

    const nodes = reactFlow.getNodes();
    let finalNodes = nodes.map(n => n.id === nodeId ? updatedNode : n);

    let updatedChildrenToSave: any[] = [];
    if (parentNode) {
      const remainingChildren = nodes.filter(n => n.parentId === parentNode.id && n.id !== nodeId);
      const { updatedChildren, newGroupStyle } = layoutGroupChildren(parentNode, remainingChildren);
      
      finalNodes = finalNodes.map(n => {
        if (n.id === parentNode.id) return { ...parentNode, style: newGroupStyle };
        const childMatch = updatedChildren.find(c => c.id === n.id);
        if (childMatch) return childMatch;
        return n;
      });
      
      updatedChildrenToSave = updatedChildren;
      workspaceApi.upsertCard(workspaceId, { ...parentNode, style: newGroupStyle });
    }

    state.setNodes(finalNodes);

    try {
      await workspaceApi.upsertCard(workspaceId, updatedNode);
      await Promise.all(updatedChildrenToSave.map(c => workspaceApi.upsertCard(workspaceId, c)));
      state.setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to ungroup node', err);
    }
  };

  return (
    <button
      onClick={handleUngroup}
      className={`p-1 rounded-md transition-colors flex items-center justify-center ${className || 'text-gray-400 hover:text-white hover:bg-white/10'}`}
      title="Remove from Group"
    >
      <LogOut className="w-4 h-4" style={{ transform: 'rotate(-90deg)' }} />
    </button>
  );
}
