import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { X } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { workspaceApi } from '../../lib/api';

export default function DottedDeleteEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd } = props;
  
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [isHovered, setIsHovered] = useState(false);
  const edges = useCanvasStore((state) => state.edges);
  const setEdges = useCanvasStore((state) => state.setEdges);

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Update local state immediately
    setEdges(edges.filter((edge) => edge.id !== id));
    
    // Save deletion to database
    try {
      await workspaceApi.deleteEdge(id);
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to delete edge in DB', err);
    }
  };

  return (
    <g 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Invisible wider interaction path for easy hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
      />
      {/* Animated step wire */}
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          stroke: isHovered ? '#ef4444' : (style.stroke || '#a855f7'),
          strokeWidth: isHovered ? 4 : (style.strokeWidth || 3),
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
        markerEnd={markerEnd}
        interactionWidth={0}
      />
      
      {isHovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              onClick={onDelete}
              className="w-6 h-6 flex items-center justify-center bg-red-500 hover:bg-red-600 active:scale-95 text-white rounded-full shadow-lg border border-white transition-all cursor-pointer"
              title="Delete connection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}
