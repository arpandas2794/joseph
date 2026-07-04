import React, { useState, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import SmartHandle from './SmartHandle';
import { Camera, Trash2, ChevronLeft, ChevronRight, ScanText, Loader2, AlertCircle, Images } from 'lucide-react';
import UngroupButton from './UngroupButton';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';

export default function CarouselNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const removeNode = useCanvasStore((state) => state.removeNode);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const [customTitle, setCustomTitle] = useState(data.customTitle || 'Carousel');
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { url, title, channel, thumbnail, slides = [], slideCount } = data.metadata || {};
  const totalSlides = slides.length || slideCount || 1;
  const caption = data.content || '';

  const triggerSave = (newTitle: string) => {
    useCanvasStore.getState().setNodes(
      useCanvasStore.getState().nodes.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, customTitle: newTitle } };
        }
        return node;
      })
    );
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (!workspaceId) return;
      workspaceApi
        .updateCardData(workspaceId, id, { ...data, customTitle: newTitle })
        .then(() => useCanvasStore.getState().setLastSaved(new Date()))
        .catch((err) => console.error('Failed to save custom title:', err));
    }, 1000);
  };

  const handleDelete = async () => {
    if (!workspaceId) return;
    try {
      await workspaceApi.deleteCard(id);
      removeNode(id);
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to delete carousel node:', err);
    }
  };

  const handleResizeEnd = (evt: any, params: any) => {
    if (!workspaceId) return;
    workspaceApi
      .upsertCard(workspaceId, {
        id,
        type: 'instagram_carousel',
        position: { x: params.x, y: params.y },
        width: params.width,
        height: params.height,
        data,
      })
      .then(() => useCanvasStore.getState().setLastSaved(new Date()))
      .catch(console.error);
  };

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlide((s) => (s - 1 + totalSlides) % totalSlides);
  };

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlide((s) => (s + 1) % totalSlides);
  };

  const currentImageUrl = slides[currentSlide] || thumbnail || '';

  return (
    <>
      <NodeResizer
        color="#e1306c"
        isVisible={selected}
        minWidth={300}
        minHeight={360}
        onResizeEnd={handleResizeEnd}
      />
      <div
        className={`w-full h-full bg-[#18181b] text-white rounded-xl shadow-2xl border flex flex-col overflow-hidden transition-all duration-200 ${
          selected ? 'border-pink-500 shadow-pink-500/20' : 'border-white/10'
        }`}
      >
        {/* ── Header ── */}
        <div className="h-12 flex-shrink-0 bg-white/5 border-b border-white/5 flex items-center px-3 justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Images className="w-4 h-4 text-pink-500 flex-shrink-0" />
            <input
              type="text"
              value={customTitle}
              onChange={(e) => {
                setCustomTitle(e.target.value);
                triggerSave(e.target.value);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-transparent text-xs font-semibold uppercase tracking-wider text-gray-300 border-none outline-none focus:ring-0 w-full min-w-0 placeholder:text-gray-500 cursor-text hover:text-white focus:text-white transition-colors"
              placeholder="Carousel"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {/* Slide counter badge */}
            <span className="text-[10px] font-mono bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
              {currentSlide + 1}/{totalSlides}
            </span>

            {/* OCR text toggle */}
            {caption && (
              <button
                onClick={() => setShowCaption(!showCaption)}
                className={`p-1 rounded transition-colors text-xs flex items-center gap-1 font-medium ${
                  showCaption ? 'bg-pink-500/20 text-pink-400' : 'text-gray-400 hover:text-white bg-white/5'
                }`}
                title="Toggle Extracted Text (OCR)"
              >
                <ScanText className="w-3.5 h-3.5" />
                <span>OCR</span>
              </button>
            )}
            {/* Ungroup */}
            <UngroupButton />

            {/* Delete */}
            <button
              onClick={handleDelete}
              className="text-red-500 hover:text-red-400 p-1 rounded-md hover:bg-white/5 transition-colors"
              title="Delete carousel card"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Slide Area ── */}
        <div className="flex-1 w-full bg-black relative min-h-0 group">
          {data.status === 'processing' && (
            <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
              <span className="text-sm font-medium text-white shadow-black drop-shadow-md">Processing Slides...</span>
            </div>
          )}
          {data.status === 'error' && (
            <div className="absolute inset-0 z-30 bg-red-950/90 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <span className="text-sm font-medium text-red-200 line-clamp-3">{data.content || 'Extraction failed'}</span>
            </div>
          )}

          {showCaption ? (
            // OCR Text view — scrollable, per-slide blocks
            <div
              className="absolute inset-0 bg-[#0f0f12] flex flex-col select-text nowheel custom-scrollbar"
              onWheel={(e) => e.stopPropagation()}
            >
              {/* Panel header */}
              <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-white/5 flex-shrink-0">
                <ScanText className="w-3.5 h-3.5 text-pink-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Extracted Text (OCR)</span>
              </div>

              {/* Scrollable slide content */}
              <div
                className="flex-1 overflow-y-scroll px-4 py-3 space-y-4"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#e1306c44 transparent',
                }}
              >
                {caption
                  ? caption
                      .split(/(?=---\s*Slide\s*\d+\s*---)/i)
                      .filter((block: string) => block.trim())
                      .map((block: string, idx: number) => {
                        const lines = block.trim().split('\n');
                        const headerLine = lines[0] || '';
                        const isSlideHeader = /---\s*Slide\s*\d+\s*---/i.test(headerLine);
                        const bodyLines = isSlideHeader ? lines.slice(1) : lines;
                        const body = bodyLines.join('\n').trim();

                        return (
                          <div key={idx} className="rounded-lg bg-white/[0.03] border border-white/5 overflow-hidden">
                            {isSlideHeader && (
                              <div className="px-3 py-1.5 bg-pink-500/10 border-b border-pink-500/20 flex items-center gap-2">
                                <span className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">
                                  {headerLine.replace(/---/g, '').trim()}
                                </span>
                              </div>
                            )}
                            {body && (
                              <p className="px-3 py-2.5 text-[11px] leading-relaxed whitespace-pre-wrap text-gray-300">
                                {body}
                              </p>
                            )}
                            {!body && !isSlideHeader && (
                              <p className="px-3 py-2.5 text-[11px] leading-relaxed whitespace-pre-wrap text-gray-300">
                                {block.trim()}
                              </p>
                            )}
                          </div>
                        );
                      })
                  : (
                    <p className="text-[11px] text-gray-500 text-center pt-8">No text was found in the slides.</p>
                  )
                }
              </div>
            </div>
          ) : (
            <>
              {/* Slide image */}
              {currentImageUrl && !imgErrors[currentSlide] ? (
                <img
                  key={currentSlide}
                  src={currentImageUrl}
                  alt={`Slide ${currentSlide + 1}`}
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                  onError={() => setImgErrors((prev) => ({ ...prev, [currentSlide]: true }))}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-600">
                  <Images className="w-10 h-10 text-pink-500/30" />
                  <span className="text-xs">Slide {currentSlide + 1}</span>
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">
                      Open on Instagram
                    </a>
                  )}
                </div>
              )}

              {/* Gradient overlays for arrows */}
              {totalSlides > 1 && (
                <>
                  <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-start">
                    <button
                      onClick={goPrev}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="ml-1.5 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all hover:scale-110 active:scale-95"
                      title="Previous slide"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end">
                    <button
                      onClick={goNext}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="mr-1.5 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all hover:scale-110 active:scale-95"
                      title="Next slide"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Dot indicators */}
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none">
                    {slides.map((_: string, i: number) => (
                      <div
                        key={i}
                        className={`rounded-full transition-all ${
                          i === currentSlide
                            ? 'w-3 h-1.5 bg-white'
                            : 'w-1.5 h-1.5 bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="h-12 flex-shrink-0 px-3 bg-black/40 border-t border-white/5 flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-pink-500 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-200 truncate">
              {channel || 'Instagram Creator'}
            </p>
            <p className="text-[10px] text-gray-500 truncate">
              {totalSlides} slides · {title?.substring(0, 40) || 'Instagram Carousel'}
            </p>
          </div>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              onMouseDown={(e) => e.stopPropagation()}
              className="flex-shrink-0 text-[10px] text-pink-400 hover:text-pink-300 hover:underline transition-colors"
            >
              Open ↗
            </a>
          )}
        </div>

        {/* Output handle only — carousels connect to chat boxes, not other assets */}
        <SmartHandle type="source" position={Position.Right} className="!bg-pink-500 !w-3 !h-3 !border-2 !border-black" />
      </div>
    </>
  );
}
