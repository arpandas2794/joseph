import React, { useState, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import SmartHandle from './SmartHandle';
import { Video, Trash2, FileText, Loader2, AlertCircle } from 'lucide-react';
import UngroupButton from './UngroupButton';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';

export default function LoomNode({ id, data, selected }: { id: string, data: any, selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const removeNode = useCanvasStore((state) => state.removeNode);
  const [showTranscript, setShowTranscript] = useState(false);
  const [customTitle, setCustomTitle] = useState(data.customTitle || 'Loom');
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
      console.error("Failed to delete loom node:", err);
    }
  };

  const handleResizeEnd = (evt: any, params: any) => {
    if (!workspaceId) return;
    workspaceApi.upsertCard(workspaceId, {
      id,
      type: 'loom',
      position: { x: params.x, y: params.y },
      width: params.width,
      height: params.height,
      data
    }).then(() => useCanvasStore.getState().setLastSaved(new Date())).catch(console.error);
  };

  const { videoId, title, channel, thumbnail } = data.metadata || {};

  return (
    <>
      <NodeResizer
        color="#625DF5"
        isVisible={selected}
        minWidth={320}
        minHeight={240}
        onResizeEnd={handleResizeEnd}
      />
      <div
        className={`w-full h-full bg-[#18181b] text-white rounded-xl shadow-2xl border flex flex-col overflow-hidden transition-all duration-200 ${selected ? 'border-[#625DF5] shadow-[#625DF5]/20' : 'border-white/10'
          }`}
      >
        {/* Header */}
        <div className="h-12 flex-shrink-0 bg-white/5 border-b border-white/5 flex items-center px-3 justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Video className="w-4 h-4 text-[#625DF5] flex-shrink-0" />
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
              placeholder="Loom"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={`p-1 rounded transition-colors text-xs flex items-center gap-1 font-medium ${showTranscript ? 'bg-[#625DF5]/20 text-[#625DF5]' : 'text-gray-400 hover:text-white bg-white/5'}`}
              title="Toggle Transcript"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Transcript</span>
            </button>
            
            <UngroupButton />

            <button
              onClick={handleDelete}
              className="text-[#625DF5] hover:text-[#514deb] p-1 rounded-md hover:bg-white/5 transition-colors"
              title="Delete Loom card"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Main Content Area (Video or Transcript) */}
        <div className="flex-1 w-full bg-black relative min-h-0">
          {data.status === 'processing' && (
            <div className="absolute inset-0 z-20 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-[#625DF5] animate-spin" />
              <span className="text-sm font-medium text-white shadow-black drop-shadow-md">Processing Transcript...</span>
            </div>
          )}
          {data.status === 'error' && (
            <div className="absolute inset-0 z-20 bg-red-950/90 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <span className="text-sm font-medium text-red-200 line-clamp-3">{data.content || 'Extraction failed'}</span>
            </div>
          )}

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
            videoId || thumbnail ? (
              <div className="w-full h-full relative group">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt="Loom Preview"
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#625DF5] to-[#2b2791] opacity-60 group-hover:opacity-80 transition-opacity flex items-center justify-center">
                    <Video className="w-20 h-20 text-white/10" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <a
                    href={`https://www.loom.com/share/${videoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 bg-gradient-to-r from-[#625DF5] to-[#514deb] hover:from-[#514deb] hover:to-[#413dd6] text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    Open Loom Video
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

        <SmartHandle type="source" position={Position.Right} className="!bg-[#625DF5] !w-3 !h-3 !border-2 !border-black" />
      </div>
    </>
  );
}
