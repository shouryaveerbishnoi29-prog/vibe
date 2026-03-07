import React, { useState, useContext } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { Play, ListPlus, ListEnd } from 'lucide-react';
import PlaylistModal from './PlaylistModal';

export default function SongList({ title, songs }) {
  const { playSong, addToQueue } = useContext(PlayerContext);
  const [modalSong, setModalSong] = useState(null);

  if (!songs || songs.length === 0) return null;

  return (
    <div style={{ marginBottom: '48px' }}>
      {title && <h2>{title}</h2>}
      <div className="song-grid">
        {songs.map((song) => {
          const image = song.image?.find(img => img.quality === '150x150') || song.image?.[1] || song.image?.[0];
          
          return (
            <div key={song.id} className="song-card fade-in">
              <div className="song-image-wrapper" onClick={() => playSong(song, songs)}>
                {image && <img src={image.url} alt={song.title} className="song-image" />}
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
                    <button 
                        className="action-btn" 
                        onClick={(e) => { e.stopPropagation(); addToQueue(song); }}
                        style={{ padding: '4px' }}
                        title="Add to Queue"
                    >
                       <ListEnd size={18} />
                    </button>
                    <button 
                        className="action-btn" 
                        onClick={(e) => { e.stopPropagation(); setModalSong(song); }}
                        style={{ padding: '4px' }}
                        title="Add to Playlist"
                    >
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
