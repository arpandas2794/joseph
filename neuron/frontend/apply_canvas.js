const fs = require('fs');
let canvas = fs.readFileSync('src/components/canvas/Canvas.tsx', 'utf-8');

const targetStart = canvas.indexOf('setExtracting(true);\\n    setExtractError(\'\');\\n    try {\\n      const extracted');
const targetEnd = canvas.indexOf('} finally {\\n      setExtracting(false);\\n    }\\n  };');

if (targetStart === -1 || targetEnd === -1) {
  console.log('Could not find target strings');
  process.exit(1);
}

const replacement = `    setExtractError('');
    setShowLinkModal(false); // Close instantly for streaming

    const nodeId = crypto.randomUUID();
    const newNodeType = activePlatform === 'google_drive' ? 'google_drive' : activePlatform;
    const isYoutube = newNodeType === 'youtube';
    const isShorts = ['instagram', 'tiktok'].includes(newNodeType);
    const isGoogleDrive = newNodeType === 'google_drive';
    const isZoom = newNodeType === 'zoom';
    
    // Create Placeholder Node instantly!
    const newNode = {
      id: nodeId,
      type: newNodeType,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      style: { 
        width: ['youtube', 'instagram', 'tiktok', 'google_drive', 'zoom'].includes(newNodeType) ? 320 : 288, 
        height: isYoutube ? 280 : isShorts ? 400 : isGoogleDrive ? 400 : isZoom ? 320 : 220 
      },
      data: { 
        customTitle: 'Processing...', 
        content: '',
        metadata: {},
        isExtracting: true,
        extractionStatus: 'Starting...'
      },
    };

    useCanvasStore.getState().setNodes([...useCanvasStore.getState().nodes, newNode as any]);

    try {
      const finalExtractedData = await workspaceApi.extractLink(linkUrl, passcode, (event) => {
        if (event.type === 'status') {
          useCanvasStore.getState().setNodes(
            useCanvasStore.getState().nodes.map(n => 
              n.id === nodeId ? { ...n, data: { ...n.data, extractionStatus: event.data.status } } : n
            )
          );
        } else if (event.type === 'metadata') {
          useCanvasStore.getState().setNodes(
            useCanvasStore.getState().nodes.map(n => 
              n.id === nodeId ? { ...n, data: { ...n.data, metadata: event.data.metadata } } : n
            )
          );
        } else if (event.type === 'chunk') {
          useCanvasStore.getState().setNodes(
            useCanvasStore.getState().nodes.map(n => 
              n.id === nodeId ? { ...n, data: { ...n.data, content: n.data.content + event.data.text } } : n
            )
          );
        }
      });

      // Update node with final completed data and save
      const finalNode = {
        ...newNode,
        type: finalExtractedData.type,
        data: { ...finalExtractedData, isExtracting: false, extractionStatus: 'Complete' }
      };

      useCanvasStore.getState().setNodes(
        useCanvasStore.getState().nodes.map(n => n.id === nodeId ? finalNode : n)
      );

      await workspaceApi.upsertCard(workspaceId, finalNode as any);
      useCanvasStore.getState().setLastSaved(new Date());
      setLinkUrl('');
      setPasscode('');
    } catch (err: any) {
      useCanvasStore.getState().setNodes(
        useCanvasStore.getState().nodes.filter(n => n.id !== nodeId)
      );
      setExtractError(err.message || 'Failed to extract link');
      setShowLinkModal(true); // Re-open modal to show error
    `;

canvas = canvas.slice(0, targetStart) + replacement + canvas.slice(targetEnd);
fs.writeFileSync('src/components/canvas/Canvas.tsx', canvas);
console.log('Success');
