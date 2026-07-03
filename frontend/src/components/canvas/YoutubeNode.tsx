import React, { useState, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { PlayCircle, Trash2, FileText } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';

export default function YoutubeNode({ id, data, selected }: { id: string, data: any, selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const removeNode = useCanvasStore((state) => state.removeNode);
  const [showTranscript, setShowTranscript] = useState(false);
  const [customTitle, setCustomTitle] = useState(data.customTitle || 'YouTube');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = (newTitle: string) => {
    // Update local React Flow state
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
      console.error("Failed to delete youtube node:", err);
    }
  };

  const handleResizeEnd = (evt: any, params: any) => {
    if (!workspaceId) return;
    workspaceApi.upsertCard(workspaceId, {
      id,
      type: 'youtube',
      position: { x: params.x, y: params.y },
      width: params.width,
      height: params.height,
      data
    }).then(() => useCanvasStore.getState().setLastSaved(new Date())).catch(console.error);
  };

  const { videoId, title, channel } = data.metadata || {};

  return (
    <>
      <NodeResizer
        color="#ef4444"
        isVisible={selected}
        minWidth={320}
        minHeight={240}
        onResizeEnd={handleResizeEnd}
      />
      <div
        className={`w-full h-full bg-[#18181b] text-white rounded-xl shadow-2xl border flex flex-col overflow-hidden transition-all duration-200 ${selected ? 'border-red-500 shadow-red-500/20' : 'border-white/10'
          }`}
      >
        {/* Header */}
        <div className="h-12 flex-shrink-0 bg-white/5 border-b border-white/5 flex items-center px-3 justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <PlayCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
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
              placeholder="YouTube"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={`p-1 rounded transition-colors text-xs flex items-center gap-1 font-medium ${showTranscript ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white bg-white/5'}`}
              title="Toggle Transcript"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Transcript</span>
            </button>

            <button
              onClick={handleDelete}
              className="text-red-500 hover:text-red-400 p-1 rounded-md hover:bg-white/5 transition-colors"
              title="Delete YouTube card"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Main Content Area (Video or Transcript) */}
        <div className="flex-1 w-full bg-black relative min-h-0">
          {showTranscript ? (
            <div
              className="absolute inset-0 p-4 overflow-y-auto text-xs text-gray-300 bg-[#0f0f12] select-text nowheel custom-scrollbar"
              onWheel={(e) => e.stopPropagation()}
            >
              <h4 className="font-semibold text-gray-200 mb-2">Extracted Subtitles:</h4>
              <p className="leading-relaxed whitespace-pre-wrap">
                {data.content || "No transcript found or transcript is empty."}
              </p>
            </div>
          ) : (
            videoId ? (
              <div className="w-full h-full relative group">
                <img
                  src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                  alt="YouTube Preview"
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <a
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Open YouTube Video
                  </a>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                Invalid Video
              </div>
            )
          )}
        </div>

        {/* Footer Info */}
        <div className="h-14 flex-shrink-0 p-3 bg-black/40 border-t border-white/5 flex flex-col justify-center">
          <h3 className="font-medium text-sm leading-tight truncate" title={title}>
            {title || 'Unknown Title'}
          </h3>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {channel || 'Unknown Channel'}
          </p>
        </div>

        <Handle type="source" position={Position.Right} className="!bg-red-500 !w-3 !h-3 !border-2 !border-black" />
      </div>
    </>
  );
}
