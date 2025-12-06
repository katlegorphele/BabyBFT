import React from 'react';
import { X } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { isMobile } from '../utils/formatters';

export default function WalletModal({ isOpen, onClose }) {
  const { connectMetaMask, connectTrustWallet, connectWalletConnect } = useWallet();

  if (!isOpen) return null;

  const handleSelectWallet = async (walletType) => {
    if (walletType === 'metamask') {
      await connectMetaMask();
    } else if (walletType === 'trustwallet') {
      await connectTrustWallet();
    } else {
      await connectWalletConnect();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Connect Wallet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-3">
          {!isMobile() && (
            <button
              onClick={() => handleSelectWallet('trustwallet')}
              className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 p-4 rounded-xl transition"
            >
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-2xl">
                🛡️
              </div>
              <div className="text-left">
                <p className="font-semibold">Trust Wallet</p>
                <p className="text-sm text-gray-400">Connect with Trust Wallet</p>
              </div>
            </button>
          )}
          <button
            onClick={() => handleSelectWallet('metamask')}
            className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 p-4 rounded-xl transition"
          >
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-2xl">
              🦊
            </div>
            <div className="text-left">
              <p className="font-semibold">MetaMask</p>
              <p className="text-sm text-gray-400">Connect with MetaMask</p>
            </div>
          </button>
          <button
            onClick={() => handleSelectWallet('walletconnect')}
            className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 p-4 rounded-xl transition"
          >
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-2xl">
              🔗
            </div>
            <div className="text-left">
              <p className="font-semibold">WalletConnect</p>
              <p className="text-sm text-gray-400">
                {isMobile() ? 'Connect with your mobile wallet' : 'Scan with mobile wallet'}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
