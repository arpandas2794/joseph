import React from 'react';
import { MessageSquare, Sparkles, User, BrainCircuit, ChevronRight, MoreHorizontal, Trash2 } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { useCanvasStore } from '../../store/canvasStore';

interface MobileChatCardProps {
  node: any;
  onOpenActions: (node: any) => void;
  onTap: (node: any) => void;
  onDelete?: () => void;
}

export default function MobileChatCard({ node, onOpenActions, onTap, onDelete }: MobileChatCardProps) {
  const edges = useCanvasStore((state) => state.edges);
  const controls = useAnimation();
  
  // Calculate how many sources are connected
  const sourceCount = edges.filter(e => e.target === node.id).length;
  const title = node.data?.title || 'AI Assistant';

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
      <div className="absolute inset-0 flex items-center justify-end px-6 rounded-3xl bg-black/40 overflow-hidden border border-indigo-500/10">
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
        whileTap={{ scale: 0.97 }}
        onClick={() => onTap(node)}
        className="w-full bg-[#1a1a24] border border-indigo-500/20 rounded-3xl p-5 text-white flex flex-col gap-4 cursor-pointer select-none relative overflow-hidden shadow-xl backdrop-blur-md transition-colors"
      >
      <div className="flex gap-4">
        <div className="w-[80px] h-[80px] sm:w-[90px] sm:h-[90px] rounded-2xl flex-shrink-0 flex items-center justify-center bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 relative z-10 shadow-inner">
          <BrainCircuit className="w-8 h-8 relative z-10" />
          <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col pt-1 relative z-10">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-[18px] leading-snug text-indigo-50 line-clamp-2">{title}</h3>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onOpenActions(node);
              }}
              className="p-2 -mr-2 -mt-1 text-indigo-400/60 hover:text-indigo-200 bg-indigo-500/5 hover:bg-indigo-500/20 rounded-full transition-colors flex-shrink-0 backdrop-blur-sm"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mt-auto pt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <p className="text-[12px] font-semibold text-indigo-300 uppercase tracking-wider">
                {sourceCount} {sourceCount === 1 ? 'Source' : 'Sources'} Connected
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative background element */}
      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-10 -left-10 w-32 h-32 bg-indigo-400/5 rounded-full blur-3xl pointer-events-none" />
      </motion.div>
    </div>
  );
}
