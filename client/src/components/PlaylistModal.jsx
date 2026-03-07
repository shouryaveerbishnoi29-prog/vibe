import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Plus } from 'lucide-react';

export default function PlaylistModal({ song, onClose }) {
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const res = await axios.get('/api/playlists');
      if (res.data.success) {
        setPlaylists(res.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createPlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName) return;
    try {
      await axios.post('/api/playlists', { name: newPlaylistName });
      setNewPlaylistName('');
      fetchPlaylists();
    } catch (e) { console.error(e); }
  };

  const addToPlaylist = async (playlistId) => {
    try {
      // Need to map the song into the right format if it comes from search
      await axios.post(`/api/playlists/${playlistId}/songs`, {
           song_id: song.id,
           title: song.title,
           subtitle: song.subtitle,
           image: song.image,
           downloadUrl: song.downloadUrl
      });
      onClose(); // auto close when added
    } catch (e) { console.error(e); }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 999 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2>Add to Playlist</h2>
            <X size={24} color="var(--text-secondary)" cursor="pointer" onClick={onClose} />
         </div>
         
         <p style={{ marginBottom: '16px' }}>Song: {song.title}</p>

         <form onSubmit={createPlaylist} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
             <input 
                value={newPlaylistName} 
                onChange={e => setNewPlaylistName(e.target.value)} 
                placeholder="New playlist name..." 
                style={{ margin: 0 }}
             />
             <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '12px' }}>
                <Plus size={20} />
             </button>
         </form>

         <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
            {playlists.length === 0 && <p>No playlists yet. Create one above!</p>}
            {playlists.map(p => (
                <div 
                   key={p.id} 
                   className="song-list-row" 
                   onClick={() => addToPlaylist(p.id)}
                   style={{ padding: '12px', background: 'var(--bg-glass)', borderRadius: '8px', cursor: 'pointer' }}
                >
                   {p.name} <span style={{color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: 'auto'}}>{p.songs?.length || 0} songs</span>
                </div>
            ))}
         </div>
      </div>
    </div>
  );
}
