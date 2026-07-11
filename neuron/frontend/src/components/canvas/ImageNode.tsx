import React, { useState, useRef } from 'react';
import { NodeResizer, Position } from '@xyflow/react';
import SmartHandle from './SmartHandle';
import { Image as ImageIcon, Trash2, FileText, Download, Loader2 } from 'lucide-react';
import UngroupButton from './UngroupButton';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';

export default function ImageNode({ id, data, selected }: { id: string, data: any, selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const removeNode = useCanvasStore((state) => state.removeNode);
  const [showTranscript, setShowTranscript] = useState(false);
  const [customTitle, setCustomTitle] = useState(data.customTitle || data.metadata?.title || 'Image');
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
      console.error("Failed to delete Image node:", err);
    }
  };

  const handleResizeEnd = (evt: any, params: any) => {
    if (!workspaceId) return;
    workspaceApi.upsertCard(workspaceId, {
      id,
      type: 'image',
      position: { x: params.x, y: params.y },
      width: params.width,
      height: params.height,
      data
    }).then(() => useCanvasStore.getState().setLastSaved(new Date())).catch(console.error);
  };

  const url = data.metadata?.url;
  const content = data.content || data.metadata?.content || 'No OCR text extracted.';

  return (
    <>
      <NodeResizer
        color="#8B5CF6"
        isVisible={selected}
        minWidth={280}
        minHeight={200}
        onResizeEnd={handleResizeEnd}
      />
      <div
        className={`w-full h-full bg-[#18181b] text-white rounded-xl shadow-2xl border flex flex-col overflow-hidden transition-all duration-200 ${selected ? 'border-purple-500 shadow-purple-500/20' : 'border-white/10'
          }`}
      >
        {/* Header */}
        <div className="h-12 flex-shrink-0 bg-white/5 border-b border-white/5 flex items-center px-3 justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ImageIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
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
              placeholder="Image"
            />
          </div>

          <div className="flex items-center gap-2">
            {content !== 'No OCR text extracted.' && (
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className={`p-1 rounded transition-colors text-xs flex items-center gap-1 font-medium ${showTranscript ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white bg-white/5'}`}
                title="Toggle OCR Text"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Text</span>
              </button>
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
        <div className="flex-1 relative overflow-hidden flex flex-col bg-black/20">
          {showTranscript ? (
            <div className="absolute inset-0 bg-[#18181b] z-10 overflow-y-auto p-4 custom-scrollbar">
              <div className="flex items-center gap-2 mb-3 text-purple-400 border-b border-white/5 pb-2">
                <FileText className="w-4 h-4" />
                <h3 className="text-sm font-semibold tracking-wide">Extracted Text</h3>
              </div>
              <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {content}
              </div>
            </div>
          ) : (
            <div className="flex-1 w-full h-full p-2 flex items-center justify-center">
              {data.isUploading ? (
                <div className="text-gray-400 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  <span className="text-sm font-medium animate-pulse text-purple-300">Extracting image text...</span>
                </div>
              ) : url ? (
                <img src={url} alt={customTitle} className="max-w-full max-h-full rounded-md object-contain" />
              ) : (
                <div className="text-gray-500 flex flex-col items-center gap-2">
                  <ImageIcon className="w-8 h-8 opacity-50" />
                  <span className="text-sm">Image not found</span>
                </div>
              )}
            </div>
          )}
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
