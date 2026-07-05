import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, FileText, StickyNote } from 'lucide-react';
import { motion } from 'framer-motion';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';

interface MobileNoteScreenProps {
  workspaceId: string;
  node: any;
  onBack: () => void;
}

export default function MobileNoteScreen({ workspaceId, node, onBack }: MobileNoteScreenProps) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { setNodes, nodes } = useCanvasStore();

  useEffect(() => {
    // Strip simple HTML tags if the desktop editor added them (like <p>)
    let text = node.data?.content || '';
    
    // For simple plain-text mobile editing, we replace common tags
    // A robust solution would use a rich text editor or TipTap on mobile too, 
    // but for now we provide a raw text area and strip <p> and <h1> for cleaner display
    if (text.includes('<p>') || text.includes('<h1>')) {
      text = text.replace(/<h1>/g, '# ')
                 .replace(/<\/h1>/g, '\n\n')
                 .replace(/<p>/g, '')
                 .replace(/<\/p>/g, '\n\n')
                 .replace(/<br>/g, '\n');
    }
    
    setContent(text);
  }, [node.data?.content]);

  // Save changes to DB and store
  const handleSave = async (newContent: string) => {
    setIsSaving(true);
    try {
      const updatedNode = {
        ...node,
        data: { ...node.data, content: newContent }
      };
      
      // Update global store
      setNodes(nodes.map(n => n.id === node.id ? updatedNode : n));
      
      // Update DB
      await workspaceApi.updateCardData(workspaceId, node.id, updatedNode.data);
    } catch (err) {
      console.error("Failed to save note content", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced auto-save effect
  useEffect(() => {
    const handler = setTimeout(() => {
      // Only save if it actually changed and isn't empty on first load
      if (content !== undefined && content !== node.data?.content) {
        // Just a basic check so we don't save immediately on mount if logic differs
        handleSave(content);
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(handler);
  }, [content, workspaceId, node.id]);

  const title = node.data?.title || node.data?.customTitle || 'Note';
  const Icon = node.type === 'document' ? FileText : StickyNote;

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
            <Icon className={`w-4 h-4 ${node.type === 'document' ? 'text-indigo-400' : 'text-yellow-400'}`} />
            <h2 className="font-semibold text-[15px] text-white truncate max-w-[150px]">{title}</h2>
          </div>
        </div>
        
        <div className="flex items-center text-xs text-gray-500 font-medium">
          {isSaving ? (
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> Saving...</span>
          ) : (
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Saved</span>
          )}
        </div>
      </header>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[#0a0a0c]">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing..."
          className="flex-1 w-full bg-transparent border-none outline-none text-gray-200 text-[15px] leading-relaxed p-6 resize-none custom-scrollbar"
        />
      </div>
    </motion.div>
  );
}
