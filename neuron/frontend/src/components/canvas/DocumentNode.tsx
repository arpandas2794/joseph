import React, { useRef, useState } from 'react';
import { NodeResizer, Position } from '@xyflow/react';
import SmartHandle from './SmartHandle';
import UngroupButton from './UngroupButton';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3, Trash2, Palette, FileText } from 'lucide-react';

const COLORS = ['#000000', '#6B7280', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'];

export default function DocumentNode({ id, data, selected }: { id: string, data: any, selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const removeNode = useCanvasStore((state) => state.removeNode);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!workspaceId) return;
    const newTitle = e.target.value;
    const freshNodes = useCanvasStore.getState().nodes;
    useCanvasStore.getState().setNodes(
      freshNodes.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, title: newTitle } };
        }
        return n;
      })
    );
    try {
      await workspaceApi.updateCardData(workspaceId, id, { ...data, title: newTitle });
    } catch (err) {
      console.error('Failed to update document title', err);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    content: data.content || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      
      saveTimeout.current = setTimeout(() => {
        if (!workspaceId) return;
        workspaceApi.updateCardData(workspaceId, id, { ...data, content: html })
          .then(() => useCanvasStore.getState().setLastSaved(new Date()))
          .catch(err => console.error("Failed to save document:", err));
      }, 1000);
    },
  });

  const handleDelete = async () => {
    if (!workspaceId) return;
    try {
      await workspaceApi.deleteCard(id);
      removeNode(id);
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to delete document node:", err);
    }
  };

  const handleResizeEnd = (evt: any, params: any) => {
    if (!workspaceId) return;
    workspaceApi.upsertCard(workspaceId, {
      id,
      type: 'document',
      position: { x: params.x, y: params.y },
      width: params.width,
      height: params.height,
      data
    }).then(() => useCanvasStore.getState().setLastSaved(new Date())).catch(console.error);
  };

  if (!editor) return null;

  return (
    <>
      <NodeResizer 
        color="#3b82f6" 
        isVisible={selected} 
        minWidth={250} 
        minHeight={150} 
        onResizeEnd={handleResizeEnd} 
      />
      
      <div className={`w-full h-full bg-[#18181b] text-white rounded-xl shadow-2xl border flex flex-col overflow-hidden transition-all duration-200 ${selected ? 'border-emerald-500 shadow-emerald-500/20' : 'border-white/10'}`}>
        
        {/* Header */}
        <div className="h-12 flex-shrink-0 bg-white/5 border-b border-white/5 flex items-center px-3 justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <input
              type="text"
              value={data.title || ''}
              onChange={handleTitleChange}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-transparent text-xs font-semibold uppercase tracking-wider text-gray-300 border-none outline-none focus:ring-0 w-full min-w-0 placeholder:text-gray-500 cursor-text hover:text-white focus:text-white transition-colors"
              placeholder="Document"
            />
          </div>

          <div className="flex items-center gap-2">
            <UngroupButton />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-red-500 hover:text-red-400 p-1 rounded-md hover:bg-white/5 transition-colors"
              title="Delete Document"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full bg-white flex flex-col min-h-0 relative">
          
          {/* Pinned Toolbar */}
          <div className="flex items-center gap-1 p-2 border-b border-gray-100 bg-gray-50/50 nodrag">
          <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded transition-colors ${editor.isActive('bold') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
              title="Bold"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded transition-colors ${editor.isActive('italic') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
              title="Italic"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded transition-colors ${editor.isActive('underline') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
              title="Underline"
            >
              <UnderlineIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 px-2 border-r border-gray-200">
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
              title="Heading 1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
              title="Heading 2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
              title="Heading 3"
            >
              <Heading3 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 pl-2 relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="Text Color"
            >
              <Palette className="w-4 h-4" />
            </button>
            
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-lg shadow-xl border border-gray-100 flex gap-1 z-50">
                {COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      editor.chain().focus().setColor(color).run();
                      setShowColorPicker(false);
                    }}
                    className="w-5 h-5 rounded-full cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #e5e7eb' : 'none' }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor Content area */}
        <div className="flex-1 overflow-auto p-4 cursor-text nodrag nowheel document-scrollbar text-gray-900">
          <EditorContent editor={editor} className="min-h-full" />
        </div>
        
        </div>
      </div>

      <SmartHandle type="target" position={Position.Left} />
      <SmartHandle type="source" position={Position.Right} />
    </>
  );
}
