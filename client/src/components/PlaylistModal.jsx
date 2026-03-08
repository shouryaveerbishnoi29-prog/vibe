import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Plus, Heart } from 'lucide-react';

export default function PlaylistModal({ song, onClose }) {
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPlaylists();
    checkIfLiked();
  }, [song.id]);

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

  const checkIfLiked = async () => {
    try {
      const res = await axios.get('/api/liked');
      if (res.data.success) {
        const liked = res.data.data.some(s => s.id === song.id);
        setIsLiked(liked);
      }
    } catch (e) { console.error(e); }
  };

  const toggleLike = async () => {
    try {
      if (isLiked) {
        await axios.delete(`/api/liked/${song.id}`);
      } else {
        await axios.post('/api/liked', song);
      }
      setIsLiked(!isLiked);
    } catch (e) { console.error(e); }
  };

  const createPlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName || loading) return;
    setLoading(true);
    try {
      await axios.post('/api/playlists', { name: newPlaylistName });
      setNewPlaylistName('');
      fetchPlaylists();
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const addToPlaylist = async (playlistId) => {
    if (loading) return;
    setLoading(true);
    try {
      await axios.post(`/api/playlists/${playlistId}/songs`, {
           song_id: song.id,
           title: song.title,
           subtitle: song.subtitle,
           image: song.image,
           downloadUrl: song.downloadUrl
      });
      onClose();
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', padding: '28px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Save to Playlist</h2>
            <X size={24} color="var(--text-secondary)" cursor="pointer" onClick={onClose} />
         </div>
         
         <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
             {song.image?.[0] && <img src={song.image[0].url} alt="" style={{ width: 64, height: 64, borderRadius: '8px', objectFit: 'cover', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />}
             <div style={{ minWidth: 0 }}>
                 <p style={{ margin: 0, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</p>
                 <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.subtitle}</p>
             </div>
         </div>

         <div className="song-list-row" onClick={toggleLike} style={{ marginBottom: '24px', padding: '12px 16px', background: 'var(--bg-glass)', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}>
            <Heart size={20} color={isLiked ? "var(--accent)" : "var(--text-secondary)"} fill={isLiked ? "var(--accent)" : "transparent"} />
            <span style={{ fontWeight: 600 }}>{isLiked ? 'In Liked Songs' : 'Add to Liked Songs'}</span>
         </div>

         <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Your Playlists</h3>

         <form onSubmit={createPlaylist} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
             <input 
                value={newPlaylistName} 
                onChange={e => setNewPlaylistName(e.target.value)} 
                placeholder="Create new playlist..." 
                style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', margin: 0 }}
             />
             <button type="submit" className="action-btn" style={{ width: '48px', height: '48px', padding: 0, borderRadius: '8px', background: 'var(--accent)', color: 'white' }}>
                <Plus size={20} />
             </button>
         </form>

         <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
            {playlists.length === 0 && <p style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>No other playlists yet</p>}
            {playlists.map(p => (
                <div 
                   key={p.id} 
                   className="song-list-row" 
                   onClick={() => addToPlaylist(p.id)}
                   style={{ padding: '12px 16px', background: 'var(--bg-glass)', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                   <span style={{ fontWeight: 500 }}>{p.name}</span>
                   <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{p.songs?.length || 0} songs</span>
                </div>
            ))}
         </div>
      </div>
    </div>
  );
}
