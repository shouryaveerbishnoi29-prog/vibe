import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { PlayerContext } from '../context/PlayerContext';
import { Play, Trash2, Heart, List, X, Shuffle, ListEnd, ListPlus } from 'lucide-react';
import PlaylistModal from '../components/PlaylistModal';

export default function Library() {
  const [likedSongs, setLikedSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [modalSong, setModalSong] = useState(null);
  const { playSong, shufflePlay, playSequential, addToQueue } = useContext(PlayerContext);

  useEffect(() => {
    fetchLiked();
    fetchPlaylists();
  }, []);

  const fetchLiked = async () => {
    try {
      const res = await axios.get('/api/liked');
      if (res.data.success) {
        setLikedSongs(res.data.data);
      }
    } catch (e) { console.error(e); }
  };

  const fetchPlaylists = async () => {
    try {
      const res = await axios.get('/api/playlists');
      if (res.data.success) {
        setPlaylists(res.data.data);
      }
    } catch (e) { console.error(e); }
  };

  const removeSong = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`/api/liked/${id}`);
      fetchLiked();
    } catch (e) { console.error(e); }
  };

  const deletePlaylist = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`/api/playlists/${id}`);
      fetchPlaylists();
    } catch (e) { console.error(e); }
  };

  const removePlaylistSong = async (playlistSongId, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`/api/playlists/songs/${playlistSongId}`);
      fetchPlaylists();
    } catch(e) { console.error(e); }
  };

  return (
    <div className="fade-in">
      <h1>Your Library</h1>
      
      <div className="glass-panel" style={{ padding: '24px', marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 0 }}>
             <Heart size={24} color="var(--accent)" fill="var(--accent)" /> Liked Songs
          </h2>
          {likedSongs.length > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="control-btn" onClick={() => playSequential(likedSongs)} title="Play in order" style={{ background: 'var(--accent)', borderRadius: '50%', width: 36, height: 36, color: 'white' }}>
                <Play size={18} style={{ marginLeft: 2 }} />
              </button>
              <button className="control-btn" onClick={() => shufflePlay(likedSongs)} title="Shuffle play" style={{ background: 'var(--bg-glass-hover)', borderRadius: '50%', width: 36, height: 36 }}>
                <Shuffle size={18} />
              </button>
            </div>
          )}
        </div>
        
        {likedSongs.length === 0 ? (
          <p style={{ marginTop: '16px' }}>No liked songs yet. Go search and like some vibes!</p>
        ) : (
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {likedSongs.map((song, index) => {
              const image = song.image?.find(i => i.quality === '150x150') || song.image?.[1] || song.image?.[0];
              return (
                <div key={song.id} className="song-list-row" onClick={() => playSong(song, likedSongs)}>
                  <span className="index">{index + 1}</span>
                  <div className="info-col">
                     {image && <img src={image.url} alt={song.title} />}
                     <div>
                       <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{song.title}</div>
                       <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{song.subtitle}</div>
                     </div>
                  </div>
                  <div className="actions">
                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); addToQueue(song); }} title="Add to Queue">
                      <ListEnd size={18} />
                    </button>
                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); setModalSong(song); }} title="Add to Playlist">
                      <ListPlus size={18} />
                    </button>
                    <button className="action-btn" onClick={(e) => removeSong(song.id, e)} title="Remove from Liked">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {playlists.map(playlist => (
        <div key={playlist.id} className="glass-panel" style={{ padding: '24px', marginTop: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 0 }}>
               <List size={24} color="var(--text-primary)" /> {playlist.name}
            </h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {playlist.songs.length > 0 && (
                <>
                  <button className="control-btn" onClick={() => playSequential(playlist.songs)} title="Play in order" style={{ background: 'var(--accent)', borderRadius: '50%', width: 36, height: 36, color: 'white' }}>
                    <Play size={18} style={{ marginLeft: 2 }} />
                  </button>
                  <button className="control-btn" onClick={() => shufflePlay(playlist.songs)} title="Shuffle play" style={{ background: 'var(--bg-glass-hover)', borderRadius: '50%', width: 36, height: 36 }}>
                    <Shuffle size={18} />
                  </button>
                </>
              )}
              <button className="action-btn" onClick={(e) => deletePlaylist(playlist.id, e)} title="Delete Playlist">
                 <X size={24} color="var(--text-secondary)" />
              </button>
            </div>
          </div>
          
          {playlist.songs.length === 0 ? (
            <p style={{ marginTop: '16px' }}>This playlist is empty. Add songs from your searches!</p>
          ) : (
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {playlist.songs.map((song, index) => {
                const image = song.image?.find(i => i.quality === '150x150') || song.image?.[1] || song.image?.[0];
                return (
                  <div key={song.playlist_song_id} className="song-list-row" onClick={() => playSong(song, playlist.songs)}>
                    <span className="index">{index + 1}</span>
                    <div className="info-col">
                       {image && <img src={image.url} alt={song.title} />}
                       <div>
                         <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{song.title}</div>
                         <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{song.subtitle}</div>
                       </div>
                    </div>
                    <div className="actions">
                      <button className="action-btn" onClick={(e) => { e.stopPropagation(); addToQueue(song); }} title="Add to Queue">
                        <ListEnd size={18} />
                      </button>
                      <button className="action-btn" onClick={(e) => { e.stopPropagation(); setModalSong(song); }} title="Add to Playlist">
                        <ListPlus size={18} />
                      </button>
                      <button className="action-btn" onClick={(e) => removePlaylistSong(song.playlist_song_id, e)} title="Remove from Playlist">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      {modalSong && <PlaylistModal song={modalSong} onClose={() => { setModalSong(null); fetchPlaylists(); fetchLiked(); }} />}
    </div>
  );
}
