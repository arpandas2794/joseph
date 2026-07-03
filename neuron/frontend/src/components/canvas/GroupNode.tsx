import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function GroupNode({ data }: { data: any }) {
  return (
    <div className="w-full h-full min-w-[200px] min-h-[200px] bg-white/[0.02] border-2 border-white/10 rounded-2xl p-4 backdrop-blur-sm">
      <div className="absolute -top-3 left-4 bg-black px-2 py-0.5 text-xs font-semibold text-gray-400 border border-white/10 rounded-full flex items-center gap-2">
        {data.title || 'Group'}
        <span className="bg-white/10 px-1.5 py-0.5 rounded-full text-[10px] text-white">
          {data.count || 0}
        </span>
      </div>
      
      <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}
