import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronUp, MoreHorizontal, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { useCanvasStore } from '../../store/canvasStore';
import AssetCard from './AssetCard';
import MobileChatCard from './MobileChatCard';

interface MobileGroupCardProps {
  node: any;
  onOpenActions: (node: any) => void;
  onTapAsset: (node: any) => void;
  onDelete?: () => void;
  onDeleteChild?: (node: any) => void;
  onConnectChild?: (node: any) => void;
}

export default function MobileGroupCard({ node, onOpenActions, onTapAsset, onDelete, onDeleteChild, onConnectChild }: MobileGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const nodes = useCanvasStore((state) => state.nodes);
  const controls = useAnimation();
  
  // Find all children
  const children = nodes.filter(n => n.parentId === node.id);
  const title = node.data?.title || 'Group';

  const handleDragEnd = async (event: any, info: PanInfo) => {
    const threshold = 80;
    if (info.offset.x < -threshold && onDelete) {
      onDelete();
    }
    controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
  };

  return (
    <div className="relative w-full shrink-0">
      {/* Background Actions */}
      <div className="absolute inset-0 flex items-center justify-end px-6 rounded-[32px] bg-black/40 overflow-hidden border border-white/5">
        <div className="text-red-500 flex flex-col items-center gap-1 opacity-80">
          <Trash2 className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
        </div>
      </div>

      <motion.div 
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="w-full shrink-0 flex flex-col border border-white/10 rounded-[32px] bg-[#1a1a24] overflow-hidden shadow-xl backdrop-blur-sm transition-colors relative z-10"
      >
      {/* Group Header */}
      <motion.div
        whileTap={{ scale: 0.97 }}
        onTap={() => setIsExpanded(!isExpanded)}
        className={`p-5 flex items-center justify-between cursor-pointer select-none hover:bg-white/[0.02] transition-colors ${isExpanded ? 'bg-white/[0.02]' : ''}`}
      >
        <div className="flex items-center gap-4">
          <div className="w-[60px] h-[60px] rounded-2xl flex items-center justify-center bg-gray-800/80 text-gray-400 border border-white/10 shadow-inner">
            <Layers className="w-7 h-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-bold text-[18px] text-white">{title}</h3>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/30 border border-white/5 self-start">
              <p className="text-[12px] font-medium text-gray-400">{children.length} {children.length === 1 ? 'Asset' : 'Assets'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onOpenActions(node);
            }}
            className="p-2 hover:bg-white/10 hover:text-white rounded-full transition-colors -mr-2 bg-white/5 backdrop-blur-sm"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          <div className="p-1">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </motion.div>

      {/* Expanded Children */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 flex flex-col gap-3 border-t border-white/5 mt-2">
          {children.length === 0 ? (
            <p className="text-xs text-center text-gray-500 py-2">Empty Group</p>
          ) : (
            children.map(child => (
              child.type === 'ai_chat' ? (
                <MobileChatCard 
                  key={child.id} 
                  node={child} 
                  onTap={onTapAsset}
                  onOpenActions={onOpenActions}
                  onDelete={onDeleteChild ? () => onDeleteChild(child) : undefined}
                />
              ) : (
                <AssetCard 
                  key={child.id} 
                  node={child} 
                  onTap={onTapAsset}
                  onOpenActions={onOpenActions}
                  onDelete={onDeleteChild ? () => onDeleteChild(child) : undefined}
                  onConnectToChat={onConnectChild ? () => onConnectChild(child) : undefined}
                />
              )
            ))
          )}
        </div>
        )}
      </motion.div>
    </div>
  );
}
