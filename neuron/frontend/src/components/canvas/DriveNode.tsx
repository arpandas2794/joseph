import React, { useState, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { FileText, Trash2, AlignLeft, HardDrive } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';

export default function DriveNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const removeNode = useCanvasStore((state) => state.removeNode);

  const [customTitle, setCustomTitle] = useState(data.customTitle || data.metadata?.title || 'Google Drive Document');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const content = data.content || '';
  const url = data.metadata?.url || '';
  const documentType = data.metadata?.documentType || 'document'; // 'document' or 'spreadsheet'

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
      console.error('Failed to delete drive node:', err);
    }
  };

  const handleResizeEnd = (evt: any, params: any) => {
    if (!workspaceId) return;
    workspaceApi
      .upsertCard(workspaceId, {
        id,
        type: 'google_drive',
        position: { x: params.x, y: params.y },
        width: params.width,
        height: params.height,
        data,
      })
      .then(() => useCanvasStore.getState().setLastSaved(new Date()))
      .catch(console.error);
  };

  const openLink = () => {
    if (url) window.open(url, '_blank');
  };

  // Determine icon and color based on doc type
  const isSheet = documentType === 'spreadsheet';
  const iconColor = isSheet ? 'text-green-400' : 'text-blue-400';
  const borderColor = isSheet ? 'border-green-500' : 'border-blue-500';
  const shadowColor = isSheet ? 'shadow-green-500/20' : 'shadow-blue-500/20';
  const headerIconColor = isSheet ? 'text-green-400' : 'text-blue-400';

  return (
    <>
      <NodeResizer
        color={isSheet ? '#22c55e' : '#3b82f6'}
        isVisible={selected}
        minWidth={280}
        minHeight={200}
        onResizeEnd={handleResizeEnd}
      />
      <div
        className={`w-full h-full bg-[#18181b] text-white rounded-xl shadow-2xl border flex flex-col overflow-hidden transition-all duration-200 ${
          selected ? `${borderColor} ${shadowColor}` : 'border-white/10'
        }`}
      >
        {/* Header */}
        <div className="h-12 flex-shrink-0 bg-white/5 border-b border-white/5 flex items-center px-3 justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <HardDrive className={`w-4 h-4 flex-shrink-0 ${headerIconColor}`} />
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
              placeholder="Google Drive File"
              title={customTitle}
            />
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 pl-2">
            {url && (
              <button
                onClick={openLink}
                className="text-gray-400 hover:text-white text-[10px] uppercase font-bold bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors"
                title="Open original document"
              >
                OPEN
              </button>
            )}
            {/* Delete */}
            <button
              onClick={handleDelete}
              className="text-red-500 hover:text-red-400 p-1.5 rounded-md hover:bg-white/5 transition-colors"
              title="Delete Google Drive file"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full relative min-h-0 flex flex-col bg-[#0f0f12]">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-white/5 flex-shrink-0">
            <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
            <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Document Text</span>
          </div>
          <div
            className="flex-1 overflow-y-auto px-4 py-3 select-text nowheel custom-scrollbar"
            onWheel={(e) => e.stopPropagation()}
          >
            <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-gray-300 font-mono">
              {content || 'No text extracted.'}
            </p>
          </div>
        </div>

        {/* Output handle */}
        <Handle 
          type="source" 
          position={Position.Right} 
          className={`!w-3 !h-3 !border-2 !border-black ${isSheet ? '!bg-green-500' : '!bg-blue-500'}`} 
        />
      </div>
    </>
  );
}
