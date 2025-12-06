import React, { useState } from 'react';
import { Trophy, Ticket, Clock, Gift } from 'lucide-react';
import { useWallet } from '../context/WalletContext';

export default function SweepstakeGame() {
  const { account } = useWallet();
  const [selectedTickets, setSelectedTickets] = useState(1);

  if (!account) {
    return (
      <div className="text-center py-20">
        <Trophy className="w-20 h-20 text-purple-500 mx-auto mb-4 opacity-50" />
        <p className="text-gray-400 text-lg">Connect your wallet to play Sweepstakes</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-purple-800 rounded-2xl p-8 mb-6 border border-purple-700">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Ticket className="w-8 h-8 text-purple-300" />
              <h2 className="text-3xl font-bold">BBFT Sweepstakes</h2>
            </div>
            <p className="text-purple-200">Buy tickets for a chance to win massive prizes!</p>
          </div>
          <div className="text-right bg-purple-950/50 rounded-xl p-4">
            <p className="text-purple-300 text-sm mb-1">Next Draw</p>
            <p className="text-2xl font-bold">Coming Soon</p>
          </div>
        </div>
      </div>

      {/* Coming Soon Content */}
      <div className="bg-gray-900 rounded-2xl p-12 text-center border border-gray-800 mb-6">
        <div className="mb-8">
          <Trophy className="w-24 h-24 text-purple-500 mx-auto mb-6 animate-pulse" />
          <h3 className="text-3xl font-bold mb-3">Sweepstakes Coming Soon!</h3>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            We're building an exciting sweepstakes platform where you can win huge BBFT prizes.
            Stay tuned for the launch!
          </p>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition">
            <Ticket className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h4 className="font-semibold text-lg mb-2">Buy Tickets</h4>
            <p className="text-sm text-gray-400">
              Purchase multiple tickets with BBFT tokens to increase your winning chances
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition">
            <Clock className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h4 className="font-semibold text-lg mb-2">Regular Draws</h4>
            <p className="text-sm text-gray-400">
              Automatic draws at scheduled times with transparent on-chain results
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition">
            <Gift className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h4 className="font-semibold text-lg mb-2">Big Prizes</h4>
            <p className="text-sm text-gray-400">
              Win massive BBFT rewards with multiple prize tiers for every draw
            </p>
          </div>
        </div>
      </div>

      {/* How It Will Work */}
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
        <h3 className="text-2xl font-bold mb-6 text-center">How Sweepstakes Will Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-purple-400">1</span>
            </div>
            <h4 className="font-semibold mb-2">Buy Tickets</h4>
            <p className="text-sm text-gray-400">Choose how many tickets you want to purchase</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-400">2</span>
            </div>
            <h4 className="font-semibold mb-2">Wait for Draw</h4>
            <p className="text-sm text-gray-400">Draws happen automatically at set times</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-yellow-400">3</span>
            </div>
            <h4 className="font-semibold mb-2">Winners Selected</h4>
            <p className="text-sm text-gray-400">Random, provably fair selection on-chain</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-green-400">4</span>
            </div>
            <h4 className="font-semibold mb-2">Claim Prizes</h4>
            <p className="text-sm text-gray-400">Winners receive BBFT directly to wallet</p>
          </div>
        </div>
      </div>

      {/* Notification Box */}
      <div className="mt-6 bg-purple-500/10 border border-purple-500 rounded-xl p-6 text-center">
        <p className="text-purple-300 font-semibold mb-2">
          💡 Want to be notified when sweepstakes launches?
        </p>
        <p className="text-gray-400 text-sm">
          Follow us on social media or check back soon for updates!
        </p>
      </div>
    </div>
  );
}
