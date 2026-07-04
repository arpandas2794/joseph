import type { Node } from '@xyflow/react';

const PADDING_X = 40;
const PADDING_Y_TOP = 60;
const PADDING_Y_BOTTOM = 40;
const GAP = 20;

export function layoutGroupChildren(groupNode: Node, children: Node[]) {
  if (children.length === 0) {
    return {
      updatedChildren: [],
      newGroupStyle: { ...groupNode.style },
    };
  }

  // Determine group width. Ensure it's at least wide enough for the widest child + padding
  let groupWidth = Number(groupNode.style?.width || 400);
  
  const maxChildWidth = Math.max(...children.map(c => Number(c.style?.width || 256)));
  const minRequiredWidth = maxChildWidth + (PADDING_X * 2);
  
  if (groupWidth < minRequiredWidth) {
    groupWidth = minRequiredWidth;
  }

  let currentX = PADDING_X;
  let currentY = PADDING_Y_TOP;
  let rowMaxHeight = 0;

  const updatedChildren = children.map((child) => {
    const childW = Number(child.style?.width || 256);
    const childH = Number(child.style?.height || 256);

    // If this child exceeds the group width (and it's not the first in the row), wrap to next row
    if (currentX + childW > groupWidth - PADDING_X && currentX > PADDING_X) {
      currentX = PADDING_X;
      currentY += rowMaxHeight + GAP;
      rowMaxHeight = 0;
    }

    const newPosition = { x: currentX, y: currentY };
    
    currentX += childW + GAP;
    if (childH > rowMaxHeight) {
      rowMaxHeight = childH;
    }

    return {
      ...child,
      position: newPosition,
      // Retain originalPosition if it already exists, otherwise it will be set by the caller
    };
  });

  const finalHeight = currentY + rowMaxHeight + PADDING_Y_BOTTOM;

  return {
    updatedChildren,
    newGroupStyle: {
      ...groupNode.style,
      width: groupWidth,
      height: finalHeight,
    }
  };
}
