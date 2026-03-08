import React, { useState, useContext } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { Play, ListPlus, ListEnd, Music } from 'lucide-react';
import PlaylistModal from './PlaylistModal';

export default function SongList({ title, songs, layout = 'grid', hideThumbnails = null }) {
  const { playSong, addToQueue, performanceMode } = useContext(PlayerContext);
  const [modalSong, setModalSong] = useState(null);

  const shouldHideThumbs = hideThumbnails !== null ? hideThumbnails : performanceMode;

  if (!songs || songs.length === 0) return null;

  if (layout === 'list') {
    return (
      <div style={{ marginBottom: '48px' }}>
        {title && <h2 style={{ marginBottom: '16px' }}>{title}</h2>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {songs.map((song, index) => {
            const image = song.image?.find(img => img.quality === '150x150') || song.image?.[0];
            return (
              <div 
                key={song.id} 
                className="song-list-row"
                style={{ padding: '6px 12px' }}
                onClick={() => playSong(song, songs)}
              >
                {!shouldHideThumbs ? (
                   <img 
                    src={image?.url} 
                    alt="" 
                    loading="lazy"
                    style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} 
                   />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Music size={16} color="var(--text-secondary)" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0, marginLeft: '12px' }}>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.subtitle}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="action-btn" onClick={(e) => { e.stopPropagation(); addToQueue(song); }}>
                    <ListEnd size={18} />
                  </button>
                  <button className="action-btn" onClick={(e) => { e.stopPropagation(); setModalSong(song); }}>
                    <ListPlus size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {modalSong && <PlaylistModal song={modalSong} onClose={() => setModalSong(null)} />}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '48px' }}>
      {title && <h2>{title}</h2>}
      <div className="song-grid">
        {songs.map((song) => {
          const image = song.image?.find(img => img.quality === '150x150') || song.image?.[1] || song.image?.[0];
          return (
            <div key={song.id} className="song-card fade-in">
              <div className="song-image-wrapper" onClick={() => playSong(song, songs)}>
                {!shouldHideThumbs && image ? (
                  <img src={image.url} alt={song.title} className="song-image" loading="lazy" />
                ) : (
                   <div style={{ width: '100%', height: '100%', background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <Music size={32} color="var(--text-secondary)" />
                   </div>
                )}
                <div className="play-on-hover">
                  <Play size={24} style={{ marginLeft: 4 }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, paddingRight: '4px', cursor: 'pointer', minWidth: 0 }} onClick={() => playSong(song, songs)}>
                      <h3 style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</h3>
                      <p style={{ marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.subtitle}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); addToQueue(song); }} title="Add to Queue">
                       <ListEnd size={18} />
                    </button>
                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); setModalSong(song); }} title="Add to Playlist">
                       <ListPlus size={18} />
                    </button>
                  </div>
              </div>
            </div>
          );
        })}
      </div>
      {modalSong && <PlaylistModal song={modalSong} onClose={() => setModalSong(null)} />}
    </div>
  );
}
