import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BundleGrid from '../components/BundleGrid';

export default function Home() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user dynamic recommendations based on listen history
    axios.get('/api/recommendations')
      .then(res => {
         if (res.data.success && res.data.data.length > 0) {
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
            <h2>Made For You</h2>
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
