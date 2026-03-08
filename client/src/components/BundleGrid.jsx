import React, { useState, useContext } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { Play, X, ListEnd, ListPlus, Music } from 'lucide-react';
import PlaylistModal from './PlaylistModal';

export default function BundleGrid({ bundles }) {
  const { playSong, addToQueue, performanceMode } = useContext(PlayerContext);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [modalSong, setModalSong] = useState(null);

  if (!bundles || bundles.length === 0) return null;

  return (
    <>
      <div className="bundle-grid">
        {bundles.map((bundle, idx) => {
          const coverImage = bundle.image?.find(img => img.quality === '500x500') || bundle.image?.find(img => img.quality === '150x150') || bundle.image?.[0];
          
          return (
            <div key={idx} className="bundle-card fade-in" onClick={() => setSelectedBundle(bundle)}>
              <div className="bundle-image-wrapper">
                {!performanceMode && coverImage ? (
                  <img src={coverImage.url} alt={bundle.title} className="bundle-image" loading="lazy" />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Music size={40} color="var(--text-secondary)" />
                  </div>
                )}
                <div className="play-on-hover bundle-play">
                  <Play size={28} style={{ marginLeft: 4 }} color="black" fill="black" />
                </div>
              </div>
              <div className="bundle-info">
                  <h3>{bundle.title}</h3>
                  <p>{bundle.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {selectedBundle && (
        <div className="modal-overlay" onClick={() => setSelectedBundle(null)} style={{ zIndex: 999 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                   {!performanceMode && selectedBundle.image?.[0] ? (
                     <img src={selectedBundle.image[0].url} style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} alt="Mix Cover" />
                   ) : (
                    <div style={{ width: 60, height: 60, borderRadius: 8, background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Music size={24} color="var(--text-secondary)" />
                    </div>
                   )}
                   <div>
                       <h2 style={{ marginBottom: 4 }}>{selectedBundle.title}</h2>
                       <p>{selectedBundle.subtitle}</p>
                   </div>
               </div>
               <X size={28} color="var(--text-secondary)" cursor="pointer" onClick={() => setSelectedBundle(null)} style={{ alignSelf: 'flex-start' }} />
            </div>

            <button 
                className="btn-primary" 
                style={{ width: '100%', marginBottom: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                onClick={() => {
                    playSong(selectedBundle.songs[0], selectedBundle.songs);
                    setSelectedBundle(null);
                }}
            >
               <Play size={20} fill="white" /> Play Mix
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {selectedBundle.songs.map((song, index) => {
                   const image = song.image?.find(i => i.quality === '150x150') || song.image?.[0];
                   return (
                     <div key={song.id} className="song-list-row">
                        <span className="index">{index + 1}</span>
                        <div className="info-col" style={{ cursor: 'pointer' }} onClick={() => { playSong(song, selectedBundle.songs); setSelectedBundle(null); }}>
                           {!performanceMode && image ? (
                             <img src={image.url} alt={song.title} loading="lazy" />
                           ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>
                              <Music size={16} color="var(--text-secondary)" />
                            </div>
                           )}
                           <div style={{ minWidth: 0 }}>
                             <div style={{ color: 'var(--text-primary)', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                             <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.subtitle}</div>
                           </div>
                        </div>
                        <div className="actions">
                          <button className="action-btn" onClick={(e) => { e.stopPropagation(); addToQueue(song); }} title="Add to Queue">
                            <ListEnd size={18} />
                          </button>
                          <button className="action-btn" onClick={(e) => { e.stopPropagation(); setModalSong(song); }} title="Add to Playlist">
                            <ListPlus size={18} />
                          </button>
                        </div>
                     </div>
                   );
                })}
            </div>
          </div>
        </div>
      )}

      {modalSong && <PlaylistModal song={modalSong} onClose={() => setModalSong(null)} />}
    </>
  );
}
