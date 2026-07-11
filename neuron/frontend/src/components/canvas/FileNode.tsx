import React, { useState, useRef } from 'react';
import { NodeResizer, Position } from '@xyflow/react';
import SmartHandle from './SmartHandle';
import { File, Trash2, FileText, Download, Loader2 } from 'lucide-react';
import UngroupButton from './UngroupButton';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';

export default function FileNode({ id, data, selected }: { id: string, data: any, selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const removeNode = useCanvasStore((state) => state.removeNode);
  const [customTitle, setCustomTitle] = useState(data.customTitle || data.metadata?.title || 'File');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = (newTitle: string) => {
    useCanvasStore.getState().setNodes(useCanvasStore.getState().nodes.map(node => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, customTitle: newTitle } };
      }
      return node;
    }));

    if (saveTimeout.current) clearTimeout(saveTimeout.current);

    saveTimeout.current = setTimeout(() => {
      if (!workspaceId) return;
      workspaceApi.updateCardData(workspaceId, id, { ...data, customTitle: newTitle })
        .then(() => useCanvasStore.getState().setLastSaved(new Date()))
        .catch(err => console.error("Failed to save custom title:", err));
    }, 1000);
  };

  const handleDelete = async () => {
    if (!workspaceId) return;
    try {
      await workspaceApi.deleteCard(id);
      removeNode(id);
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to delete File node:", err);
    }
  };

  const handleResizeEnd = (evt: any, params: any) => {
    if (!workspaceId) return;
    workspaceApi.upsertCard(workspaceId, {
      id,
      type: 'file',
      position: { x: params.x, y: params.y },
      width: params.width,
      height: params.height,
      data
    }).then(() => useCanvasStore.getState().setLastSaved(new Date())).catch(console.error);
  };

  const url = data.metadata?.url;
  const content = data.content || data.metadata?.content || 'No text extracted.';

  return (
    <>
      <NodeResizer
        color="#F59E0B"
        isVisible={selected}
        minWidth={250}
        minHeight={150}
        onResizeEnd={handleResizeEnd}
      />
      <div
        className={`w-full h-full bg-[#18181b] text-white rounded-xl shadow-2xl border flex flex-col overflow-hidden transition-all duration-200 ${selected ? 'border-amber-500 shadow-amber-500/20' : 'border-white/10'
          }`}
      >
        {/* Header */}
        <div className="h-12 flex-shrink-0 bg-white/5 border-b border-white/5 flex items-center px-3 justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <File className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <input
              type="text"
              value={customTitle}
              onChange={(e) => {
                setCustomTitle(e.target.value);
                triggerSave(e.target.value);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-transparent text-xs font-semibold uppercase tracking-wider text-gray-300 border-none outline-none focus:ring-0 w-full min-w-0 placeholder:text-gray-500 cursor-text hover:text-white focus:text-white transition-colors"
              placeholder="File"
            />
          </div>

          <div className="flex items-center gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded transition-colors text-xs flex items-center gap-1 font-medium text-gray-400 hover:text-white bg-white/5"
                title="Download File"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            )}
            
            {data.groupId && (
              <UngroupButton nodeId={id} groupId={data.groupId} />
            )}
            <button
              onClick={handleDelete}
              className="p-1.5 hover:bg-red-500/20 hover:text-red-400 text-gray-400 rounded-lg transition-colors ml-1"
              title="Delete node"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 relative overflow-y-auto bg-black/20 p-4 custom-scrollbar">
          <div className="flex items-center gap-2 mb-3 text-amber-400 border-b border-white/5 pb-2">
            <FileText className="w-4 h-4" />
            <h3 className="text-sm font-semibold tracking-wide">Document Text</h3>
          </div>
          <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {data.isUploading ? (
              <div className="flex flex-col items-center justify-center h-24 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-sm font-medium animate-pulse text-amber-400">Extracting document text...</span>
              </div>
            ) : content}
          </div>
        </div>

        {/* Smart Handles */}
        <SmartHandle type="target" position={Position.Left} id="left" />
        <SmartHandle type="target" position={Position.Top} id="top" />
        <SmartHandle type="source" position={Position.Right} id="right" />
        <SmartHandle type="source" position={Position.Bottom} id="bottom" />
      </div>
    </>
  );
}
