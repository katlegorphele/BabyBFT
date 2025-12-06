import React, { useState } from 'react';
import { WalletProvider } from './context/WalletContext';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import SweepstakeGame from './games/SweepstakeGame';

// Import the legacy spin game (current App.jsx)
import SpinGameLegacy from './games/SpinGame_Legacy';

const TABS = [
  { id: 'spin', label: 'Spin Game', icon: '🎰' },
  { id: 'sweepstake', label: 'Sweepstakes', icon: '🎫' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('spin');
  const [tokenBalance, setTokenBalance] = useState(0);

  return (
    <WalletProvider>
      <div className="min-h-screen bg-black text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Header tokenBalance={tokenBalance} />
          <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} tabs={TABS} />

          {/* Render active game */}
          {activeTab === 'spin' && <SpinGameLegacy />}
          {activeTab === 'sweepstake' && <SweepstakeGame />}
        </div>
      </div>
    </WalletProvider>
  );
}
