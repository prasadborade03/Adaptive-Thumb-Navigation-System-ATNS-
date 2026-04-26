import React, { useState } from 'react';
import './App.css';
import FluidNav from './components/FluidNav';
import PageContent from './components/PageContent';

function App() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="mobile-container">
      <PageContent activeTab={activeTab} />
      <FluidNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;
