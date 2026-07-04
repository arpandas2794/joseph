import React, { useState, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import SmartHandle from './SmartHandle';
import { Video, Trash2, AlignLeft, Play } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';

export default function ZoomNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const removeNode = useCanvasStore((state) => state.removeNode);

  const [customTitle, setCustomTitle] = useState(data.customTitle || 'Zoom Meeting');
  const [showTranscript, setShowTranscript] = useState(true);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transcript = data.content || '';
  const audioUrl = data.metadata?.audioUrl || '';

  const triggerSave = (newTitle: string) => {
    useCanvasStore.getState().setNodes(
      useCanvasStore.getState().nodes.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, customTitle: newTitle } };
        }
        return node;
      })
    );
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (!workspaceId) return;
      workspaceApi
        .updateCardData(workspaceId, id, { ...data, customTitle: newTitle })
        .then(() => useCanvasStore.getState().setLastSaved(new Date()))
        .catch(console.error);
    }, 1000);
  };

  const handleDelete = async () => {
    if (!workspaceId) return;
    try {
      await workspaceApi.deleteCard(id);
      removeNode(id);
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to delete Zoom node:', err);
    }
  };

  const handleResizeEnd = (evt: any, params: any) => {
    if (!workspaceId) return;
    workspaceApi
      .upsertCard(workspaceId, {
        id,
        type: 'voice',
        position: { x: params.x, y: params.y },
        width: params.width,
        height: params.height,
        data,
      })
      .then(() => useCanvasStore.getState().setLastSaved(new Date()))
      .catch(console.error);
  };

  return (
    <>
      <NodeResizer
        color="#3b82f6" // blue
        isVisible={selected}
        minWidth={280}
        minHeight={200}
        onResizeEnd={handleResizeEnd}
      />
      <div
        className={`w-full h-full bg-[#18181b] text-white rounded-xl shadow-2xl border flex flex-col overflow-hidden transition-all duration-200 ${selected ? 'border-blue-500 shadow-blue-500/20' : 'border-white/10'
          }`}
      >
        {/* Header */}
        <div className="h-12 flex-shrink-0 bg-white/5 border-b border-white/5 flex items-center px-3 justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Video className="w-4 h-4 text-blue-400 flex-shrink-0" />
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
              placeholder="Zoom Meeting"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {/* Toggle Transcript */}
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={`p-1 rounded transition-colors text-xs flex items-center gap-1 font-medium ${showTranscript ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white bg-white/5'
                }`}
              title="Toggle Transcript"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              className="text-red-500 hover:text-red-400 p-1 rounded-md hover:bg-white/5 transition-colors"
              title="Delete voice note"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full relative min-h-0 flex flex-col bg-black overflow-hidden">
          {showTranscript ? (
            <div
              className="absolute inset-0 bg-[#0f0f12] flex flex-col select-text"
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-white/5 flex-shrink-0">
                <AlignLeft className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Transcript</span>
              </div>
              <div
                className="flex-1 overflow-y-auto px-4 py-3 nowheel custom-scrollbar"
              >
                <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-gray-300">
                  {transcript || 'No transcript available.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-gray-500 gap-3">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center animate-pulse">
                <Video className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-xs text-center font-medium">Zoom Recording</p>
            </div>
          )}
        </div>

        {/* Footer with Audio Player */}
        <div className="h-14 flex-shrink-0 px-3 bg-black/40 border-t border-white/5 flex flex-col justify-center">
          {audioUrl ? (
            <audio
              controls
              src={audioUrl}
              className="w-full h-8 outline-none"
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-xs text-gray-500 italic text-center">Audio file not found</p>
          )}
        </div>

        {/* Output handle */}
        <SmartHandle type="source" position={Position.Right} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-black" />
      </div>
    </>
  );
}
