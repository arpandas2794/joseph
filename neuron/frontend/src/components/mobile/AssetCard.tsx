import { PlayCircle, Camera, Music2, HardDrive, Video, FileText, Globe, Mic, StickyNote, MoreHorizontal, Trash2, Link as LinkIcon } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { useCanvasStore } from '../../store/canvasStore';

interface AssetCardProps {
  node: any;
  onOpenActions: (node: any) => void;
  onTap: (node: any) => void;
  onDelete?: () => void;
  onConnectToChat?: () => void;
}

const getPlatformConfig = (type: string) => {
  switch (type) {
    case 'youtube': return { icon: PlayCircle, color: 'text-red-500', label: 'YouTube' };
    case 'instagram':
    case 'instagram_carousel': return { icon: Camera, color: 'text-pink-500', label: 'Instagram' };
    case 'tiktok': return { icon: Music2, color: 'text-cyan-400', label: 'TikTok' };
    case 'google_drive': return { icon: HardDrive, color: 'text-blue-500', label: 'Google Drive' };
    case 'loom': return { icon: Video, color: 'text-purple-400', label: 'Loom' };
    case 'document': return { icon: FileText, color: 'text-indigo-400', label: 'Document' };
    case 'website': return { icon: Globe, color: 'text-emerald-400', label: 'Website' };
    case 'voice': return { icon: Mic, color: 'text-amber-400', label: 'Voice Note' };
    case 'sticky': return { icon: StickyNote, color: 'text-yellow-400', label: 'Note' };
    default: return { icon: FileText, color: 'text-gray-400', label: 'Asset' };
  }
};

export default function AssetCard({ node, onOpenActions, onTap, onDelete, onConnectToChat }: AssetCardProps) {
  const controls = useAnimation();
  const config = getPlatformConfig(node.type);
  const Icon = config.icon;
  const title = node.data?.customTitle || node.data?.title || node.data?.metadata?.title || node.data?.name || 'Untitled';
  const subtitle = node.data?.metadata?.channel || node.data?.metadata?.author || config.label;
  const thumbnailUrl = node.data?.metadata?.thumbnail;
  const status = node.data?.status;

  const edges = useCanvasStore((state) => state.edges);
  const connectedChatCount = (edges ?? []).filter((e: any) => e.source === node.id).length;

  const handleDragEnd = async (_event: any, info: PanInfo) => {
    if (info.offset.x < -80 && onDelete) onDelete();
    else if (info.offset.x > 80 && onConnectToChat) onConnectToChat();
    controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
  };

  return (
    <div className="relative w-full shrink-0">
      <div className="absolute inset-0 flex items-center justify-between px-6 rounded-3xl bg-black/40 overflow-hidden border border-white/5">
        <div className="text-indigo-400 flex flex-col items-center gap-1 opacity-80">
          <LinkIcon className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Connect</span>
        </div>
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
        className="w-full bg-[#1a1a24] border border-white/5 rounded-3xl p-4 text-white flex flex-col gap-4 cursor-pointer select-none overflow-hidden relative shadow-xl backdrop-blur-md transition-colors"
      >
        {status === 'processing' && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600/90 px-4 py-2 rounded-full shadow-2xl border border-indigo-500/50">
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              Processing
            </div>
          </div>
        )}
        <div className="flex gap-4">
          {thumbnailUrl ? (
            <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-black/60 border border-white/10 relative shadow-inner">
              <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-2xl flex-shrink-0 flex items-center justify-center border border-white/5 bg-indigo-500/10 shadow-inner relative overflow-hidden">
              <Icon className="w-10 h-10 text-indigo-400 relative z-10" />
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col pt-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-[17px] leading-snug text-white line-clamp-2">{title}</h3>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenActions(node); }}
                className="p-2 -mr-2 -mt-1 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0 backdrop-blur-sm"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-auto pt-2">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/30 border border-white/5">
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-[12px] font-medium text-gray-400 truncate">{subtitle}</p>
                </div>
                {connectedChatCount > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.7)' }} />
                    <p className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider whitespace-nowrap">
                      {connectedChatCount} {connectedChatCount === 1 ? 'Chat' : 'Chats'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
