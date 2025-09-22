import React from 'react';
import type { AnyLayer } from '../types.ts';
import { IconPlay, IconPause } from './Icons.tsx';

type Handle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'ml' | 'bm' | 'mr' | 'rotate';

interface SelectionBoxProps {
    layers: AnyLayer[];
    zoom: number;
    cropLayerId: string | null;
    playingVideoIds: Set<string>;
    onToggleVideoPlayback: (id: string) => void;
}

const SelectionBox: React.FC<SelectionBoxProps> = ({ layers, zoom, cropLayerId, playingVideoIds, onToggleVideoPlayback }) => {
    if (layers.length !== 1) {
        if (layers.length > 1) {
            const xs = layers.map(l => l.x);
            const ys = layers.map(l => l.y);
            const widths = layers.map(l => l.width);
            const heights = layers.map(l => l.height);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs.map((x, i) => x + widths[i]));
            const maxY = Math.max(...ys.map((y, i) => y + heights[i]));
            
            return (
                 <div 
                    style={{
                        position: 'absolute',
                        left: minX,
                        top: minY,
                        width: maxX - minX,
                        height: maxY - minY,
                        outline: '1px dashed #4CAF50',
                        pointerEvents: 'none',
                    }} 
                />
            )
        }
        return null;
    }

    const layer = layers[0];
    const isCropping = cropLayerId === layer.id;
    const handleSize = 10 / zoom;
     const handleStyle: React.CSSProperties = {
        position: 'absolute',
        background: 'white',
        border: `1px solid ${isCropping ? '#fbbf24' : '#4CAF50'}`,
        borderRadius: '50%',
        pointerEvents: 'auto',
    };
    const isPlaying = layer.type === 'video' && playingVideoIds.has(layer.id);

    if (isCropping) {
        const cornerHandleStyle = { ...handleStyle, width: handleSize, height: handleSize };
        const sideHandleStyle: React.CSSProperties = {
            ...handleStyle,
            borderRadius: 2,
            width: handleSize * 1.5,
            height: handleSize / 2,
            background: '#fbbf24',
            border: '1px solid white',
        };
        const halfHandle = handleSize / 2;
        return (
             <div 
                style={{
                    position: 'absolute',
                    left: layer.x,
                    top: layer.y,
                    width: layer.width,
                    height: layer.height,
                    outline: `2px solid #fbbf24`,
                    transform: `rotate(${layer.rotation}deg)`,
                    transformOrigin: 'center center',
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                }}
            >
                <div data-handle="tl" style={{ ...cornerHandleStyle, top: -halfHandle, left: -halfHandle, cursor: 'nwse-resize' }}></div>
                <div data-handle="tr" style={{ ...cornerHandleStyle, top: -halfHandle, right: -halfHandle, cursor: 'nesw-resize' }}></div>
                <div data-handle="bl" style={{ ...cornerHandleStyle, bottom: -halfHandle, left: -halfHandle, cursor: 'nesw-resize' }}></div>
                <div data-handle="br" style={{ ...cornerHandleStyle, bottom: -halfHandle, right: -halfHandle, cursor: 'nwse-resize' }}></div>
                <div data-handle="tm" style={{ ...sideHandleStyle, top: -halfHandle / 2, left: `calc(50% - ${handleSize * 0.75}px)`, cursor: 'ns-resize' }}></div>
                <div data-handle="bm" style={{ ...sideHandleStyle, bottom: -halfHandle / 2, left: `calc(50% - ${handleSize * 0.75}px)`, cursor: 'ns-resize' }}></div>
                <div data-handle="ml" style={{ ...sideHandleStyle, width: handleSize / 2, height: handleSize * 1.5, top: `calc(50% - ${handleSize * 0.75}px)`, left: -halfHandle / 2, cursor: 'ew-resize' }}></div>
                <div data-handle="mr" style={{ ...sideHandleStyle, width: handleSize / 2, height: handleSize * 1.5, top: `calc(50% - ${handleSize * 0.75}px)`, right: -halfHandle / 2, cursor: 'ew-resize' }}></div>
            </div>
        )
    }
    
    const halfHandle = handleSize / 2;
    const sideHandleStyle: React.CSSProperties = { ...handleStyle, borderRadius: 2, width: handleSize * 1.5, height: handleSize / 2 , background: '#4CAF50', border: '1px solid white' };
    
    const rotationHandleOffset = 30 / zoom;
    const rotationHandleSize = 12 / zoom;

    return (
        <div 
            style={{
                position: 'absolute',
                left: layer.x,
                top: layer.y,
                width: layer.width,
                height: layer.height,
                outline: '1px solid #4CAF50',
                transform: `rotate(${layer.rotation}deg)`,
                transformOrigin: 'center center',
                pointerEvents: 'none',
            }}
        >
            <div data-handle="tl" style={{ ...handleStyle, width: handleSize, height: handleSize, top: -halfHandle, left: -halfHandle, cursor: 'nwse-resize' }}></div>
            <div data-handle="tr" style={{ ...handleStyle, width: handleSize, height: handleSize, top: -halfHandle, right: -halfHandle, cursor: 'nesw-resize' }}></div>
            <div data-handle="bl" style={{ ...handleStyle, width: handleSize, height: handleSize, bottom: -halfHandle, left: -halfHandle, cursor: 'nesw-resize' }}></div>
            <div data-handle="br" style={{ ...handleStyle, width: handleSize, height: handleSize, bottom: -halfHandle, right: -halfHandle, cursor: 'nwse-resize' }}></div>
            
            <div data-handle="tm" style={{ ...sideHandleStyle, top: -halfHandle/2, left: `calc(50% - ${handleSize * 0.75}px)`, cursor: 'ns-resize' }}></div>
            <div data-handle="bm" style={{ ...sideHandleStyle, bottom: -halfHandle/2, left: `calc(50% - ${handleSize * 0.75}px)`, cursor: 'ns-resize' }}></div>
            <div data-handle="ml" style={{ ...sideHandleStyle, width: handleSize / 2, height: handleSize * 1.5, top: `calc(50% - ${handleSize * 0.75}px)`, left: -halfHandle/2, cursor: 'ew-resize' }}></div>
            <div data-handle="mr" style={{ ...sideHandleStyle, width: handleSize / 2, height: handleSize * 1.5, top: `calc(50% - ${handleSize * 0.75}px)`, right: -halfHandle/2, cursor: 'ew-resize' }}></div>

             {/* Rotation Handle */}
            <div
                style={{
                    position: 'absolute',
                    bottom: `-${rotationHandleOffset + rotationHandleSize}px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'auto',
                }}
            >
                <div style={{ margin: '0 auto', width: '1px', height: `${rotationHandleOffset}px`, background: '#4CAF50' }} />
                <div
                    data-handle="rotate"
                    style={{
                        ...handleStyle,
                        width: `${rotationHandleSize}px`,
                        height: `${rotationHandleSize}px`,
                        cursor: 'alias',
                    }}
                />
            </div>
            
            {/* Video Play/Pause Control */}
            {layer.type === 'video' && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'auto',
                    }}
                >
                    <button
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            onToggleVideoPlayback(layer.id);
                        }}
                        style={{
                            width: Math.max(32, 48 / zoom),
                            height: Math.max(32, 48 / zoom),
                            borderRadius: '50%',
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'white'
                        }}
                    >
                        {isPlaying ? (
                            <IconPause className="w-1/2 h-1/2" />
                        ) : (
                            <IconPlay className="w-1/2 h-1/2" />
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default SelectionBox;