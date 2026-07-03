import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';
import { Trash2 } from 'lucide-react';

export default function StickyNode({ id, data, selected }: { id: string, data: any, selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const setNodes = useCanvasStore((state) => state.setNodes);
  const removeNode = useCanvasStore((state) => state.removeNode);
  
  const [content, setContent] = useState(data.content || '');
  const [title, setTitle] = useState(data.title || 'Untitled');
  const [color, setColor] = useState(data.color || 'bg-yellow-200');
  const [isEditing, setIsEditing] = useState(false);
  
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colors = [
    { name: 'yellow', class: 'bg-yellow-200', border: 'border-yellow-400' },
    { name: 'blue', class: 'bg-blue-200', border: 'border-blue-400' },
    { name: 'green', class: 'bg-green-200', border: 'border-green-400' },
    { name: 'pink', class: 'bg-pink-200', border: 'border-pink-400' },
    { name: 'purple', class: 'bg-purple-200', border: 'border-purple-400' },
  ];

  const triggerSave = (newTitle: string, newContent: string, newColor: string) => {
    // Correctly update the React Flow global state so it's not lost on re-renders
    setNodes(useCanvasStore.getState().nodes.map(node => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, title: newTitle, content: newContent, color: newColor } };
      }
      return node;
    }));

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    
    saveTimeout.current = setTimeout(() => {
      if (!workspaceId) return;
      workspaceApi.updateCardData(workspaceId, id, { title: newTitle, content: newContent, color: newColor })
        .then(() => useCanvasStore.getState().setLastSaved(new Date()))
        .catch(err => console.error("Failed to save sticky note:", err));
    }, 1000);
  };

  const handleDelete = async () => {
    if (!workspaceId) return;
    try {
      await workspaceApi.deleteCard(id);
      removeNode(id);
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to delete sticky note:", err);
    }
  };

  const handleResizeEnd = (evt: any, params: any) => {
    if (!workspaceId) return;
    workspaceApi.upsertCard(workspaceId, {
      id,
      type: 'sticky',
      position: { x: params.x, y: params.y },
      width: params.width,
      height: params.height,
      data: { title, content, color }
    }).then(() => useCanvasStore.getState().setLastSaved(new Date())).catch(console.error);
  };

  const currentColorConfig = colors.find(c => c.class === color) || colors[0];

  return (
    <>
      <NodeResizer 
        color="#eab308" 
        isVisible={selected} 
        minWidth={200} 
        minHeight={200}
        onResizeEnd={handleResizeEnd}
      />
      <div className={`w-full h-full min-w-[200px] min-h-[200px] flex flex-col ${color} text-black rounded-lg shadow-xl border ${currentColorConfig.border} overflow-hidden transition-colors cursor-grab active:cursor-grabbing`}>
        {/* Header with Title */}
        <div className={`h-12 flex-shrink-0 border-b ${currentColorConfig.border} flex items-center px-3 bg-black/5`}>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              triggerSave(e.target.value, content, color);
            }}
            className="bg-transparent font-semibold text-sm border-none outline-none focus:ring-0 w-full placeholder:text-black/50"
            placeholder="Untitled"
          />
          <button 
            onClick={handleDelete}
            className="ml-auto text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-black/10 transition-colors"
            title="Delete sticky note"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        
        {/* Color picker (only shows when selected) */}
        {selected && (
          <div className="absolute top-10 right-2 flex gap-1 bg-white/50 backdrop-blur-md p-1 rounded-md shadow-sm z-10">
            {colors.map(c => (
              <button
                key={c.name}
                onClick={() => {
                  setColor(c.class);
                  triggerSave(title, content, c.class);
                }}
                className={`w-4 h-4 rounded-full ${c.class} border ${c.class === color ? 'border-black border-2' : 'border-transparent hover:border-black/50'}`}
                title={c.name}
              />
            ))}
          </div>
        )}
        
        <div className="flex-1 p-3 relative">
          <textarea 
            className="absolute inset-0 p-3 w-full h-full bg-transparent border-none outline-none resize-none font-medium text-black/80 placeholder:text-black/40 text-sm leading-relaxed"
            placeholder="Type your notes here..."
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              triggerSave(title, e.target.value, color);
            }}
          />
        </div>

        <Handle type="source" position={Position.Right} className="!bg-black !w-3 !h-3 !border-2 !border-white" />
      </div>
    </>
  );
}
