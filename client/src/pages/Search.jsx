import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import SongList from '../components/SongList';
import PlaylistModal from '../components/PlaylistModal';
import { PlayerContext } from '../context/PlayerContext';
import { Search as SearchIcon, History, ListEnd, ListPlus } from 'lucide-react';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalSong, setModalSong] = useState(null);
  const { playSong, addToQueue } = useContext(PlayerContext);

  useEffect(() => {
    axios.get('/api/history/listens')
      .then(res => {
         if (res.data.success) setHistory(res.data.data);
      }).catch(e => console.error(e));
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim()) {
        setLoading(true);
        axios.get(`/api/search?q=${query}`)
          .then(res => {
             if (res.data.success) {
                setResults(res.data.data.results || []);
             }
             setLoading(false);
          })
          .catch(err => {
             console.error(err);
             setLoading(false);
          });
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div className="fade-in">
      <div className="search-container" style={{ position: 'sticky', top: 0, zIndex: 20, marginTop: 0 }}>
        <SearchIcon size={20} color="var(--text-secondary)" />
        <input 
          type="text" 
          placeholder="What do you want to listen to?" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && <p>Searching...</p>}
      
      {!loading && query && results.length > 0 && (
        <SongList title="Top Results" songs={results} />
      )}
      
      {!loading && !query && history.length > 0 && (
        <div>
           <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <History size={20} /> Recent Listens
           </h2>
           <div className="recent-grid">
              {history.map(song => {
                const img = song.image?.find(i => i.quality === '150x150') || song.image?.[0];
                return (
                  <div key={song.id} className="recent-chip">
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => playSong(song, history)}>
                      {img && <img src={img.url} alt={song.title} />}
                      <span>{song.title}</span>
                    </div>
                    <div className="recent-chip-actions">
                      <button onClick={(e) => { e.stopPropagation(); addToQueue(song); }} title="Add to Queue">
                        <ListEnd size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setModalSong(song); }} title="Add to Playlist">
                        <ListPlus size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {!loading && query && results.length === 0 && (
        <p>No results found for "{query}". Try something else!</p>
      )}

      {modalSong && <PlaylistModal song={modalSong} onClose={() => setModalSong(null)} />}
    </div>
  );
}
