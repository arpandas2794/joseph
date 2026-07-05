import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export default function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
  // Prevent scrolling on body when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[101] bg-[#1a1a24] rounded-t-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col w-full max-w-[480px] mx-auto border-t border-white/10"
            onClick={(e) => e.stopPropagation()}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
          >
            {/* Drag Handle */}
            <div className="w-full flex justify-center py-3 cursor-grab active:cursor-grabbing flex-shrink-0">
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
            </div>

            {title && (
              <div className="px-6 pb-2 text-center flex-shrink-0">
                <h3 className="text-white font-semibold text-lg">{title}</h3>
              </div>
            )}

            <div className="overflow-y-auto px-6 pb-8 pt-2 custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
