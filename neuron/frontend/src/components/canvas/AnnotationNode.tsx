import React, { useState, useRef, useEffect } from 'react';
import { NodeResizer } from '@xyflow/react';
import { Trash2, GripHorizontal } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';

const SIZE_OPTIONS = [
  { label: 'XL', className: 'text-4xl font-black', key: 'xl' },
  { label: 'LG', className: 'text-2xl font-bold', key: 'lg' },
  { label: 'MD', className: 'text-lg font-semibold', key: 'md' },
  { label: 'SM', className: 'text-sm font-medium', key: 'sm' },
] as const;

const COLOR_OPTIONS = [
  { key: 'white',  tw: 'text-white' },
  { key: 'gray',   tw: 'text-gray-400' },
  { key: 'yellow', tw: 'text-yellow-400' },
  { key: 'pink',   tw: 'text-pink-400' },
  { key: 'cyan',   tw: 'text-cyan-400' },
  { key: 'red',    tw: 'text-red-400' },
  { key: 'green',  tw: 'text-emerald-400' },
  { key: 'purple', tw: 'text-purple-400' },
];

type SizeKey = 'xl' | 'lg' | 'md' | 'sm';

export default function AnnotationNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const removeNode = useCanvasStore((state) => state.removeNode);

  const [text, setText] = useState<string>(data.text || 'Headline');
  const [size, setSize] = useState<SizeKey>((data.size as SizeKey) || 'xl');
  const [color, setColor] = useState<string>(data.color || 'white');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sizeConfig = SIZE_OPTIONS.find((s) => s.key === size) || SIZE_OPTIONS[0]!;
  const colorConfig = COLOR_OPTIONS.find((c) => c.key === color) || COLOR_OPTIONS[0]!;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const triggerSave = (newText: string, newSize: SizeKey, newColor: string) => {
    useCanvasStore.getState().setNodes(
      useCanvasStore.getState().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, text: newText, size: newSize, color: newColor } }
          : node
      )
    );
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (!workspaceId) return;
      workspaceApi
        .updateCardData(workspaceId, id, { text: newText, size: newSize, color: newColor })
        .then(() => useCanvasStore.getState().setLastSaved(new Date()))
        .catch(console.error);
    }, 800);
  };

  const handleDelete = async () => {
    if (!workspaceId) return;
    try {
      await workspaceApi.deleteCard(id);
      removeNode(id);
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to delete annotation:', err);
    }
  };

  const handleResizeEnd = (evt: any, params: any) => {
    if (!workspaceId) return;
    workspaceApi
      .upsertCard(workspaceId, {
        id,
        type: 'annotation',
        position: { x: params.x, y: params.y },
        width: params.width,
        height: params.height,
        data,
      })
      .then(() => useCanvasStore.getState().setLastSaved(new Date()))
      .catch(console.error);
  };

  return (
    <>
      <NodeResizer
        color="rgba(255,255,255,0.2)"
        isVisible={selected}
        minWidth={80}
        minHeight={32}
        onResizeEnd={handleResizeEnd}
      />

      {/* Toolbar — visible on hover/select */}
      <div
        className={`absolute -top-9 left-0 flex items-center gap-1 transition-all duration-150 ${
          selected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Size picker */}
        <div className="flex items-center bg-black/80 backdrop-blur border border-white/10 rounded-lg px-1 py-0.5 gap-0.5">
          {SIZE_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => { setSize(s.key); triggerSave(text, s.key, color); }}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors font-bold ${
                size === s.key ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Color picker */}
        <div className="flex items-center bg-black/80 backdrop-blur border border-white/10 rounded-lg px-1.5 py-1 gap-1">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.key}
              onClick={() => { setColor(c.key); triggerSave(text, size, c.key); }}
              className={`w-3 h-3 rounded-full transition-all ${c.tw} ${
                color === c.key ? 'ring-2 ring-white ring-offset-1 ring-offset-black scale-110' : 'opacity-60 hover:opacity-100'
              }`}
              style={{ backgroundColor: 'currentColor' }}
              title={c.key}
            />
          ))}
        </div>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="flex items-center justify-center w-7 h-7 bg-black/80 backdrop-blur border border-white/10 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          title="Delete annotation"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* The annotation text itself */}
      <div 
        className={`w-full h-full flex items-center drag-handle cursor-grab active:cursor-grabbing select-none group`}
        onDoubleClick={() => setIsEditing(true)}
      >
        {isEditing ? (
          <textarea
            ref={inputRef}
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              triggerSave(e.target.value, size, color);
            }}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Enter') {
                e.preventDefault();
                setIsEditing(false);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className={`w-full bg-transparent border-none outline-none resize-none leading-tight cursor-text ${sizeConfig.className} ${colorConfig.tw}`}
            style={{ fontFamily: 'inherit' }}
          />
        ) : (
          <span
            className={`leading-tight whitespace-pre-wrap break-words w-full ${sizeConfig.className} ${colorConfig.tw} ${
              selected
                ? 'opacity-100'
                : 'group-hover:opacity-90 opacity-100'
            }`}
          >
            {text || 'Headline'}
          </span>
        )}

        {/* Subtle double-click hint */}
        {!isEditing && selected && (
          <span className="absolute -bottom-5 left-0 text-[9px] text-white/30 whitespace-nowrap pointer-events-none">
            Double-click to edit
          </span>
        )}
      </div>
    </>
  );
}
