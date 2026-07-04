import React from 'react';
import { Handle, Position, useReactFlow, useNodeId, NodeResizer } from '@xyflow/react';
import { Trash2, Layers } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';
import { layoutGroupChildren } from '../../utils/gridLayout';

export default function GroupNode({ data, selected }: { data: any, selected?: boolean }) {
  const { id: workspaceId } = useParams();
  const nodeId = useNodeId();
  const reactFlow = useReactFlow();
  const state = useCanvasStore();

  const currentNodes = reactFlow.getNodes();
  const childCount = currentNodes.filter(n => n.parentId === nodeId).length;

  const handleTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!nodeId || !workspaceId) return;
    const newTitle = e.target.value;
    const freshNodes = reactFlow.getNodes();
    state.setNodes(
      freshNodes.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, title: newTitle } };
        }
        return n;
      })
    );
    try {
      await workspaceApi.updateCardData(workspaceId, nodeId, { ...data, title: newTitle });
    } catch (err) {
      console.error('Failed to update group title', err);
    }
  };

  const handleDeleteGroup = async () => {
    if (!nodeId || !workspaceId) return;
    
    // Safe delete: reparent all children to canvas root first
    const nodes = reactFlow.getNodes();
    const children = nodes.filter(n => n.parentId === nodeId);
    
    const updatedNodes = nodes.map(n => {
      if (n.parentId === nodeId) {
        return { 
          ...n, 
          parentId: undefined, 
          position: (n as any).positionAbsolute || n.position 
        };
      }
      return n;
    }).filter(n => n.id !== nodeId);

    state.setNodes(updatedNodes);

    try {
      await Promise.all(children.map(child => workspaceApi.upsertCard(workspaceId, {
        ...child,
        parentId: undefined,
        position: (child as any).positionAbsolute || child.position
      })));
      await workspaceApi.deleteCard(nodeId);
    } catch (err) {
      console.error('Failed to delete group', err);
    }
  };

  const handleResizeEnd = async (evt: any, params: any) => {
    if (!nodeId || !workspaceId) return;

    const nodes = reactFlow.getNodes();
    const groupNode = nodes.find(n => n.id === nodeId);
    if (!groupNode) return;

    const updatedGroupNode = {
      ...groupNode,
      position: { x: params.x, y: params.y },
      style: { ...groupNode.style, width: params.width, height: params.height } as any
    };

    const children = nodes.filter(n => n.parentId === nodeId);
    const { updatedChildren, newGroupStyle } = layoutGroupChildren(updatedGroupNode, children);
    updatedGroupNode.style = newGroupStyle;

    const finalNodes = nodes.map(n => {
      if (n.id === nodeId) return updatedGroupNode;
      const childMatch = updatedChildren.find(c => c.id === n.id);
      if (childMatch) return childMatch;
      return n;
    });

    state.setNodes(finalNodes);

    try {
      await workspaceApi.upsertCard(workspaceId, updatedGroupNode);
      await Promise.all(updatedChildren.map(c => workspaceApi.upsertCard(workspaceId, c)));
      state.setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save resized group layout', err);
    }
  };

  return (
    <>
      <NodeResizer 
        color="#a855f7" 
        isVisible={selected} 
        minWidth={300} 
        minHeight={200} 
        onResizeEnd={handleResizeEnd} 
      />
      <div className="w-full h-full min-w-[200px] min-h-[200px] bg-white/[0.02] border border-dashed border-white/20 rounded-3xl p-4 backdrop-blur-sm group/node">
      <div className="absolute -top-4 left-6 bg-[#18181b] border border-white/10 rounded-xl flex items-center gap-2 pr-2 shadow-xl">
        <div className="bg-white/5 p-2 rounded-l-xl border-r border-white/5">
          <Layers className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <input
          className="nodrag bg-transparent border-none outline-none text-xs font-semibold text-gray-300 w-32 px-1 placeholder-gray-600 focus:text-white"
          value={data.title || ''}
          onChange={handleTitleChange}
          placeholder="Group Title"
        />
        <div className="w-px h-4 bg-white/10" />
        <span className="text-[10px] text-gray-500 font-mono font-medium px-1">
          {childCount}
        </span>
      </div>

      <button
        onClick={handleDeleteGroup}
        className="absolute -top-3 -right-3 bg-[#18181b] border border-white/10 p-2 rounded-xl text-red-500 hover:bg-red-500/20 hover:scale-110 active:scale-95 transition-all opacity-0 group-hover/node:opacity-100 shadow-xl"
        title="Delete Group (Keeps contents)"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-6 h-6 -right-3 bg-purple-500 border-4 border-[#18181b] hover:bg-purple-400 hover:scale-110 transition-transform cursor-crosshair z-50" 
      />
      </div>
    </>
  );
}
