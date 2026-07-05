import React, { useState } from 'react';
import BottomSheet from './BottomSheet';
import { Pencil, Copy, Move, Trash2, Link, BrainCircuit, X, FolderPlus } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { workspaceApi } from '../../lib/api';
import { layoutGroupChildren } from '../../utils/gridLayout';

interface ActionMenuProps {
  workspaceId: string;
  node: any;
  isOpen: boolean;
  initialView?: 'actions' | 'connect_chat' | 'rename' | 'move_to_group';
  onClose: () => void;
}

export default function ActionMenu({ workspaceId, node, isOpen, initialView = 'actions', onClose }: ActionMenuProps) {
  const [view, setView] = React.useState<'actions' | 'connect_chat' | 'rename' | 'move_to_group'>(initialView);
  const [renameInput, setRenameInput] = useState('');
  const { nodes, removeNode, addNode, setNodes } = useCanvasStore();

  React.useEffect(() => {
    if (isOpen) {
      setView(initialView);
    }
  }, [isOpen, initialView]);

  const handleClose = () => {
    setView('actions');
    onClose();
  };

  const handleDelete = async () => {
    try {
      removeNode(node.id);
      await workspaceApi.deleteCard(node.id);
      handleClose();
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const handleDuplicate = async () => {
    try {
      const newNode = {
        ...node,
        id: crypto.randomUUID(),
        position: { x: node.position.x + 50, y: node.position.y + 50 },
      };
      addNode(newNode);
      await workspaceApi.upsertCard(workspaceId, newNode);
      handleClose();
    } catch (err) {
      console.error("Failed to duplicate", err);
    }
  };

  const handleRenameSubmit = async () => {
    if (!renameInput.trim()) return;
    try {
      const isMediaNode = ['youtube', 'instagram', 'tiktok', 'instagram_carousel', 'loom', 'voice', 'google_drive', 'zoom', 'website'].includes(node.type);
      const updatedNode = {
        ...node,
        data: { ...node.data, ...(isMediaNode ? { customTitle: renameInput } : { title: renameInput }) }
      };
      setNodes(nodes.map(n => n.id === node.id ? updatedNode : n));
      await workspaceApi.updateCardData(workspaceId, node.id, updatedNode.data);
      handleClose();
    } catch (err) {
      console.error("Failed to rename", err);
    }
  };

  const handleConnectToChat = async (chatNode: any) => {
    try {
      const edgeId = crypto.randomUUID();
      const edge = {
        id: edgeId,
        source: node.id,
        target: chatNode.id,
      };

      // Update store
      useCanvasStore.getState().setEdges([...useCanvasStore.getState().edges, edge]);

      // Update DB
      await workspaceApi.createEdge(workspaceId, {
        id: edgeId,
        source_id: node.id,
        target_id: chatNode.id,
        source_type: node.type,
      });

      handleClose();
    } catch (err) {
      console.error("Failed to connect", err);
    }
  };

  const handleCreateNewChat = async () => {
    try {
      // 1. Create a new chat node
      const newChatId = crypto.randomUUID();
      const newChatNode = {
        id: newChatId,
        type: 'ai_chat',
        position: { x: node.position.x + 400, y: node.position.y },
        data: { title: 'New AI Chat' },
      };

      addNode(newChatNode);
      await workspaceApi.upsertCard(workspaceId, newChatNode);

      // 2. Connect the current asset to this new chat
      await handleConnectToChat(newChatNode);

    } catch (err) {
      console.error("Failed to create new chat", err);
    }
  };

  // Find all available chat nodes
  const chatNodes = nodes.filter(n => n.type === 'ai_chat');

  // Find all available group nodes
  const groupNodes = nodes.filter(n => n.type === 'group' && n.id !== node.id);

  const handleMoveToGroup = async (groupNode: any) => {
    try {
      const updatedNode = { ...node, parentId: groupNode.id };
      const groupChildren = nodes.filter(n => n.parentId === groupNode.id && n.id !== node.id);
      groupChildren.push(updatedNode);

      const { updatedChildren, newGroupStyle } = layoutGroupChildren(groupNode, groupChildren);
      const updatedGroupNode = { ...groupNode, style: newGroupStyle };

      // Update store
      const newNodes = nodes.map(n => {
        if (n.id === groupNode.id) return updatedGroupNode;
        const childMatch = updatedChildren.find(c => c.id === n.id);
        if (childMatch) return childMatch;
        return n;
      });
      setNodes(newNodes);

      // Update DB
      await workspaceApi.upsertCard(workspaceId, updatedGroupNode);
      await Promise.all(updatedChildren.map(c => workspaceApi.upsertCard(workspaceId, c)));

      handleClose();
    } catch (err) {
      console.error("Failed to move to group", err);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title={view === 'actions' ? 'Actions' : view === 'rename' ? 'Rename' : view === 'connect_chat' ? 'Connect to Chat' : 'Move to Group'}
    >
      {view === 'actions' && (
        <div className="flex flex-col gap-2">
          {node.type !== 'ai_chat' && (
            <button
              onClick={() => setView('connect_chat')}
              className="flex items-center gap-3 w-full p-4 rounded-xl hover:bg-white/5 text-indigo-400 active:scale-[0.98] transition-transform"
            >
              <Link className="w-5 h-5" />
              <span className="font-medium text-[15px]">Connect to Chat</span>
            </button>
          )}

          {node.type !== 'group' && node.type !== 'ai_chat' && !node.parentId && groupNodes.length > 0 && (
            <button
              onClick={() => setView('move_to_group')}
              className="flex items-center gap-3 w-full p-4 rounded-xl hover:bg-white/5 text-emerald-400 active:scale-[0.98] transition-transform"
            >
              <FolderPlus className="w-5 h-5" />
              <span className="font-medium text-[15px]">Move to Group</span>
            </button>
          )}

          <button
            onClick={() => {
              setRenameInput(node.data?.title || node.data?.customTitle || 'Untitled');
              setView('rename');
            }}
            className="flex items-center gap-3 w-full p-4 rounded-xl hover:bg-white/5 text-white active:scale-[0.98] transition-transform"
          >
            <Pencil className="w-5 h-5" />
            <span className="font-medium text-[15px]">Rename</span>
          </button>

          <button
            onClick={handleDuplicate}
            className="flex items-center gap-3 w-full p-4 rounded-xl hover:bg-white/5 text-white active:scale-[0.98] transition-transform"
          >
            <Copy className="w-5 h-5" />
            <span className="font-medium text-[15px]">Duplicate</span>
          </button>

          {/* Simple spacer */}
          <div className="h-[1px] bg-white/10 my-2" />

          <button
            onClick={handleDelete}
            className="flex items-center gap-3 w-full p-4 rounded-xl hover:bg-white/5 text-red-500 active:scale-[0.98] transition-transform"
          >
            <Trash2 className="w-5 h-5" />
            <span className="font-medium text-[15px]">Delete</span>
          </button>
        </div>
      )}

      {view === 'rename' && (
        <div className="flex flex-col gap-4">
          <input
            autoFocus
            type="text"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
            }}
          />
          <div className="flex gap-3">
            <button
              onClick={() => setView('actions')}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-3 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRenameSubmit}
              disabled={!renameInput.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-semibold transition-colors disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {view === 'connect_chat' && (
        <div className="flex flex-col gap-3">
          {chatNodes.length === 0 ? (
            <div className="text-center py-8">
              <BrainCircuit className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-gray-400 text-sm mb-6">No chat workspaces available.</p>

              <button
                onClick={handleCreateNewChat}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-semibold transition-colors"
              >
                <BrainCircuit className="w-5 h-5" />
                Create New Chat
              </button>

              <button
                onClick={handleClose}
                className="mt-4 text-gray-400 text-sm font-medium hover:text-white"
              >
                Go Back
              </button>
            </div>
          ) : (
            <>
              <div className="max-h-[50vh] overflow-y-auto custom-scrollbar flex flex-col gap-2">
                <button
                  onClick={handleCreateNewChat}
                  className="flex items-center gap-3 p-4 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-left transition-colors mb-2"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-500 text-white flex-shrink-0">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-indigo-400 truncate">Create New Chat</h4>
                    <p className="text-xs text-indigo-400/70 truncate mt-0.5">Start a new conversation</p>
                  </div>
                </button>

                {chatNodes.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => handleConnectToChat(chat)}
                    className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-500/20 text-indigo-400 flex-shrink-0">
                      <BrainCircuit className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-white truncate">{chat.data?.title || 'AI Assistant'}</h4>
                      <p className="text-xs text-gray-500 truncate mt-0.5">Connect as context source</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setView('actions')}
                className="w-full mt-4 bg-white/5 hover:bg-white/10 text-white rounded-xl py-3 font-semibold transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {view === 'move_to_group' && (
        <div className="flex flex-col gap-3">
          <div className="max-h-[50vh] overflow-y-auto custom-scrollbar flex flex-col gap-2">
            {groupNodes.map(group => (
              <button
                key={group.id}
                onClick={() => handleMoveToGroup(group)}
                className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/20 text-emerald-400 flex-shrink-0">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-white truncate">{group.data?.title || 'Group'}</h4>
                  <p className="text-xs text-gray-500 truncate mt-0.5">Move asset here</p>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setView('actions')}
            className="w-full mt-4 bg-white/5 hover:bg-white/10 text-white rounded-xl py-3 font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
