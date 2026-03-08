import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BundleGrid from '../components/BundleGrid';

// Simple session cache to prevent re-fetching on every tab switch
let recommendationCache = null;

export default function Home() {
  const [cards, setCards] = useState(recommendationCache || []);
  const [loading, setLoading] = useState(!recommendationCache);

  useEffect(() => {
    // If we already have recommendations cached for this session, don't fetch again
    if (recommendationCache) return;

    axios.get('/api/recommendations')
      .then(res => {
         if (res.data.success && res.data.data.length > 0) {
             recommendationCache = res.data.data;
             setCards(res.data.data);
         }
         setLoading(false);
      })
      .catch(err => {
         console.error(err);
         setLoading(false);
      });
  }, []);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <div style={{ width: 36, height: 36, background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <span style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Vibe</span>
      </div>

      {loading ? (
          <p>Loading your mixes...</p>
      ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0 }}>Made For You</h2>
                <button 
                  onClick={() => { recommendationCache = null; window.location.reload(); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Refresh Mixes
                </button>
            </div>
            {cards.length > 0 ? (
                <BundleGrid bundles={cards} />
            ) : (
                <p>Listen to some music to unlock your personalized flashcard mixes!</p>
            )}
          </div>
      )}
    </div>
  );
}
