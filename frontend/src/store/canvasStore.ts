import { create } from 'zustand';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from '@xyflow/react';

export type NeuronNode = Node;

interface CanvasState {
  nodes: NeuronNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<NeuronNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: NeuronNode) => void;
  removeNode: (id: string) => void;
  setNodes: (nodes: NeuronNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  lastSaved: Date | null;
  setLastSaved: (time: Date) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  onNodesChange: (changes: NodeChange<NeuronNode>[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },
  addNode: (node: NeuronNode) => {
    set({
      nodes: [...get().nodes, node],
    });
  },
  removeNode: (id: string) => {
    set({
      nodes: get().nodes.filter(n => n.id !== id),
      edges: get().edges.filter(e => e.source !== id && e.target !== id)
    });
  },
  setNodes: (nodes: NeuronNode[]) => {
    set({ nodes });
  },
  setEdges: (edges: Edge[]) => {
    set({ edges });
  },
  lastSaved: null,
  setLastSaved: (time: Date) => {
    set({ lastSaved: time });
  }
}));
