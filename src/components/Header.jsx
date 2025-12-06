import React, { useState, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { formatNumber, formatAddress } from '../utils/formatters';
import WalletModal from './WalletModal';

export default function Header({ tokenBalance }) {
  const { account, bnbBalance, disconnectWallet } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [bnbPrice, setBnbPrice] = useState(0);

  // Fetch BNB price
  useEffect(() => {
    const fetchBnbPrice = async () => {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
        const data = await response.json();
        if (data.price) {
          setBnbPrice(parseFloat(data.price) || 0);
        }
      } catch {
        // Silently fail
      }
    };

    fetchBnbPrice();
    const priceInterval = setInterval(fetchBnbPrice, 60000);
    return () => clearInterval(priceInterval);
  }, []);

  return (
    <>
      <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <img src="/BBFT_LOGO.jpg" alt="BBFT Logo" className="w-12 h-12 rounded-xl object-cover" />
          <div>
            <h1 className="text-2xl font-bold">Baby Big Five Games</h1>
            <p className="text-sm text-gray-400">Play & Win BBFT Tokens</p>
          </div>
        </div>

        {!account ? (
          <button
            onClick={() => setShowWalletModal(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 px-6 py-3 rounded-xl font-semibold transition"
          >
            <Wallet className="w-5 h-5" /> Connect Wallet
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            {tokenBalance !== undefined && tokenBalance !== null && (
              <div className="flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-xl">
                <span className="text-orange-500 font-semibold">{formatNumber(tokenBalance)} BBFT</span>
              </div>
            )}
            <div className="bg-gray-900 px-4 py-2 rounded-xl">
              <span className="text-yellow-500 font-semibold">{bnbBalance} BNB</span>
              {bnbPrice > 0 && parseFloat(bnbBalance) > 0 && (
                <p className="text-gray-400 text-xs mt-0.5">
                  ≈ ${(parseFloat(bnbBalance) * bnbPrice).toFixed(2)} USD
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-xl">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="font-mono">{formatAddress(account)}</span>
            </div>
            <button
              onClick={disconnectWallet}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm transition"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </>
  );
}
