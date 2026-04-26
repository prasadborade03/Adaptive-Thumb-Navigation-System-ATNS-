import React from 'react';

export default function PageContent({ activeTab }) {
  const tabNames = ['Home', 'Search', 'Reels', 'Profile'];
  
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'white',
        opacity: 0.3,
        fontSize: '48px',
        fontWeight: '700',
        pointerEvents: 'none', /* so clicks pass through to background */
        transition: 'all 200ms ease'
      }}
    >
      {tabNames[activeTab]}
    </div>
  );
}
