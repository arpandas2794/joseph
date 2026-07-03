import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Link, Globe } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';
import { Trash2 } from 'lucide-react';

export default function WebsiteNode({ id, data, selected }: { id: string, data: any, selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const removeNode = useCanvasStore((state) => state.removeNode);

  const handleDelete = async () => {
    if (!workspaceId) return;
    try {
      await workspaceApi.deleteCard(id);
      removeNode(id);
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to delete website node:", err);
    }
  };

  const { title, description, image, url } = data.metadata || {};

  return (
    <div className={`w-72 bg-[#18181b] text-white rounded-xl shadow-2xl border ${selected ? 'border-blue-500 shadow-blue-500/20' : 'border-white/10'} overflow-hidden transition-all duration-200`}>
      {/* Header */}
      <div className="h-12 bg-white/5 border-b border-white/5 flex items-center px-3 justify-between">
        <div className="flex items-center gap-2 text-gray-400">
          <Globe className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-medium uppercase tracking-wider">Website</span>
        </div>
        
        <button 
          onClick={handleDelete}
          className="text-red-500 hover:text-red-400 p-1 rounded-md hover:bg-white/5 transition-colors"
          title="Delete website card"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {/* Preview Image */}
      {image && (
        <div className="w-full h-36 bg-black/50 border-b border-white/5 overflow-hidden">
          <img src={image} alt="Preview" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex flex-col gap-2">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2" title={title}>
          {title || 'Unknown Website'}
        </h3>
        
        {description && (
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
            {description}
          </p>
        )}
        
        <a 
          href={url} 
          target="_blank" 
          rel="noreferrer"
          className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 w-fit"
        >
          <Link className="w-3 h-3" />
          Visit Website
        </a>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-black" />
    </div>
  );
}
