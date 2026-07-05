import React from 'react';
import { ArrowLeft, PlayCircle, Globe, Camera, Video, FileText, Music2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface MobileAssetViewerProps {
  node: any;
  onBack: () => void;
}

export default function MobileAssetViewer({ node, onBack }: MobileAssetViewerProps) {
  const getIcon = () => {
    switch (node.type) {
      case 'youtube':
      case 'loom': return PlayCircle;
      case 'website': return Globe;
      case 'instagram': return Camera;
      case 'tiktok': return Video;
      case 'voice': return Music2;
      default: return FileText;
    }
  };

  const Icon = getIcon();
  const title = node.data?.customTitle || node.data?.title || node.data?.metadata?.title || node.data?.name || 'Asset View';
  const content = node.data?.content || 'No transcript or content available for this asset.';
  const thumbnailUrl = node.data?.metadata?.thumbnail;

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-[#0a0a0c] z-[100] flex flex-col w-full h-full"
    >
      {/* Header */}
      <header className="h-14 border-b border-white/10 bg-[#121214] flex items-center px-4 flex-shrink-0 justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-indigo-400" />
            <h2 className="font-semibold text-[15px] text-white truncate max-w-[200px]">{title}</h2>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#0a0a0c] flex flex-col gap-6">
        
        {/* Thumbnail if available */}
        {thumbnailUrl && (
          <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/10 relative flex-shrink-0">
            <img 
              src={thumbnailUrl} 
              alt={title} 
              className="w-full h-full object-cover"
            />
            {(node.type === 'youtube' || node.type === 'loom' || node.type === 'tiktok' || node.type === 'instagram') && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <PlayCircle className="w-12 h-12 text-white opacity-80" />
              </div>
            )}
          </div>
        )}

        {/* Text Content / Transcript */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            {node.type === 'voice' || node.type === 'youtube' || node.type === 'tiktok' || node.type === 'instagram' ? 'Transcript' : 'Content'}
          </h3>
          <div className="prose prose-invert prose-sm max-w-none">
            <div className="text-gray-300 leading-relaxed whitespace-pre-wrap font-mono text-[13px]">
              {content}
            </div>
          </div>
        </div>
        
      </div>
    </motion.div>
  );
}
