import React, { useContext, useState, useRef } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { X, Trash2, GripVertical, Radio, ListPlus } from 'lucide-react';
import PlaylistModal from './PlaylistModal';

export default function QueuePanel({ onClose }) {
  const { queue, currentIndex, playSong, removeFromQueue, reorderQueue, isRadioMode } = useContext(PlayerContext);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [modalSong, setModalSong] = useState(null);
  const touchStartY = useRef(null);
  const touchStartIdx = useRef(null);
  const itemRefs = useRef({});

  const upcomingSongs = queue.slice(currentIndex + 1);
  const currentSong = queue[currentIndex];

  // ... (drag handlers unchanged)
  const handleDragStart = (e, realIdx) => {
    setDragIndex(realIdx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, realIdx) => {
    e.preventDefault();
    setOverIndex(realIdx);
  };
  const handleDrop = (e, realIdx) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== realIdx) {
      reorderQueue(dragIndex, realIdx);
    }
    setDragIndex(null);
    setOverIndex(null);
  };
  const handleDragEnd = () => { setDragIndex(null); setOverIndex(null); };

  const handleTouchStart = (e, realIdx) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartIdx.current = realIdx;
    setDragIndex(realIdx);
  };

  const handleTouchMove = (e, relIdx) => {
    if (touchStartIdx.current === null) return;
    const touchY = e.touches[0].clientY;
    for (const [key, ref] of Object.entries(itemRefs.current)) {
      if (ref) {
        const rect = ref.getBoundingClientRect();
        if (touchY >= rect.top && touchY <= rect.bottom) {
          setOverIndex(parseInt(key));
          break;
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      reorderQueue(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
    touchStartIdx.current = null;
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 999 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '85vh', overflowY: 'auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <h2 style={{ marginBottom: 0 }}>Queue</h2>
             {isRadioMode && (
               <span style={{ fontSize: '0.7rem', background: 'var(--accent)', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                 <Radio size={10} style={{ marginRight: 4 }} />RADIO
               </span>
             )}
           </div>
           <X size={24} color="var(--text-secondary)" cursor="pointer" onClick={onClose} />
        </div>

        {currentSong && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontWeight: '700', color: 'var(--accent)', marginBottom: '8px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Now Playing</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'rgba(225, 29, 72, 0.08)', borderRadius: '10px', borderLeft: '3px solid var(--accent)' }}>
              {currentSong.image?.[0] && <img src={currentSong.image[0].url} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentSong.title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{currentSong.subtitle}</div>
              </div>
              <button 
                  className="action-btn" 
                  onClick={(e) => { e.stopPropagation(); setModalSong(currentSong); }}
                  style={{ padding: '8px' }}
                  title="Add to Playlist"
              >
                 <ListPlus size={18} />
              </button>
            </div>
          </div>
        )}

        <div>
           <p style={{ fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
            Next Up · {upcomingSongs.length} {isRadioMode ? '(auto-generated)' : 'songs'}
          </p>
          
          {upcomingSongs.length === 0 ? (
            <p style={{ padding: '16px 0', color: 'var(--text-secondary)' }}>Queue is empty. Add songs to keep the vibe going!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {upcomingSongs.map((song, i) => {
                const realIndex = currentIndex + 1 + i;
                const img = song.image?.find(im => im.quality === '150x150') || song.image?.[0];
                const isDragging = dragIndex === realIndex;
                const isOver = overIndex === realIndex;
                return (
                  <div 
                    key={`${song.id}-${realIndex}`}
                    ref={el => itemRefs.current[realIndex] = el}
                    draggable
                    onDragStart={e => handleDragStart(e, realIndex)}
                    onDragOver={e => handleDragOver(e, realIndex)}
                    onDrop={e => handleDrop(e, realIndex)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={e => handleTouchStart(e, realIndex)}
                    onTouchMove={e => handleTouchMove(e, i)}
                    onTouchEnd={handleTouchEnd}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px',
                      borderRadius: '8px',
                      cursor: 'grab',
                      opacity: isDragging ? 0.4 : 1,
                      background: isOver ? 'rgba(225, 29, 72, 0.1)' : 'transparent',
                      borderTop: isOver ? '2px solid var(--accent)' : '2px solid transparent',
                      transition: 'background 0.15s ease, opacity 0.15s ease',
                      touchAction: 'none'
                    }}
                  >
                    <GripVertical size={16} color="var(--text-secondary)" style={{ flexShrink: 0, opacity: 0.5 }} />
                    <span style={{ width: '20px', fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{i + 1}</span>
                    <div 
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: 'pointer' }}
                      onClick={() => { playSong(song, queue); onClose(); }}
                    >
                      {img && <img src={img.url} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.subtitle}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                            className="action-btn" 
                            onClick={(e) => { e.stopPropagation(); setModalSong(song); }}
                            style={{ padding: '6px' }}
                            title="Add to Playlist"
                        >
                            <ListPlus size={16} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); removeFromQueue(realIndex); }} 
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px', flexShrink: 0 }}
                            title="Remove"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {modalSong && <PlaylistModal song={modalSong} onClose={() => setModalSong(null)} />}
      </div>
    </div>
  );
}

