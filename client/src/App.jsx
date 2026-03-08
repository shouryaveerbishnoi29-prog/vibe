import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import TopHeader from './components/TopHeader';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';

function App() {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-view">
         <TopHeader />
         <div className="view-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/library" element={<Library />} />
            </Routes>
         </div>
      </div>
      <Player />
    </div>
  );
}

export default App;
