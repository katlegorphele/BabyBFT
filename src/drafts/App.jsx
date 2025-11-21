import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Loader2, Wallet, TrendingUp, Trophy, RefreshCw, X } from 'lucide-react';

// Contract ABI (add your deployed contract address)

const CONTRACT_ADDRESS = "0xF8564E2C94633a714c2f0B8AA66E13C4c7c0cE98"; //"0x59c863E77791eEe6746E24E183cf026a1A6C94B9";//"0x7B8eFa883755Dd042D8e365432BA6238489BC69c";
const TOKEN_ADDRESS = "0x900186aa7B0CbDe4C43AeE8Db110d51b68DEe3B1";

const CONTRACT_ABI = [
  "function spin() external returns (uint256)",
  "function getPlayerSpins(address player) external view returns (uint256[])",
  "function getRecentWinners(uint256 count) external view returns (tuple(address player, uint256 spinCost, uint256 prizeAmount, uint256 tierIndex, uint256 timestamp, bytes32 requestId)[])",
  "function playerStats(address player) external view returns (uint256 totalSpins, uint256 totalWinnings, uint256 lastSpinTime)",
  "function getContractBalance() external view returns (uint256)",
  "function getAllPrizeTiers() external view returns (tuple(uint256 prizeAmount, uint256 probability, string name)[])",
  "event SpinCompleted(address indexed player, uint256 indexed spinId, uint256 tierIndex, uint256 prizeAmount, uint256 timestamp)"
];

const TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const PRIZE_COLORS = ['#3B82F6', '#A855F7', '#EC4899', '#10B981', '#F59E0B', '#6B7280'];
const SPIN_COST = "10000";

// WalletConnect Modal Component
function WalletModal({ isOpen, onClose, onSelectWallet }) {
  if (!isOpen) return null;

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
          <button
            onClick={() => onSelectWallet('metamask')}
            className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 p-4 rounded-xl transition"
          >
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🦊</span>
            </div>
            <div className="text-left">
              <p className="font-semibold">MetaMask</p>
              <p className="text-sm text-gray-400">Connect with MetaMask</p>
            </div>
          </button>

          <button
            onClick={() => onSelectWallet('walletconnect')}
            className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 p-4 rounded-xl transition"
          >
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🔗</span>
            </div>
            <div className="text-left">
              <p className="font-semibold">WalletConnect</p>
              <p className="text-sm text-gray-400">Scan with mobile wallet</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BabyBigFiveSpin() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [tokenContract, setTokenContract] = useState(null);
  
  const [balance, setBalance] = useState('0');
  const [contractBalance, setContractBalance] = useState('0');
  const [availableSpins, setAvailableSpins] = useState(0);
  const [totalWinnings, setTotalWinnings] = useState('0');
  const [playerStats, setPlayerStats] = useState({ totalSpins: 0, totalWinnings: '0' });
  const [recentWinners, setRecentWinners] = useState([]);
  const [prizeTiers, setPrizeTiers] = useState([]);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastWin, setLastWin] = useState(null);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Connect with MetaMask
  const connectMetaMask = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask!');
        return;
      }

      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      await web3Provider.send("eth_requestAccounts", []);
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);

      const gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, web3Signer);
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, web3Signer);
      
      setContract(gameContract);
      setTokenContract(token);

      await loadData(token, gameContract, address);
      setShowWalletModal(false);
    } catch (error) {
      console.error('Error connecting MetaMask:', error);
      alert('Failed to connect MetaMask');
    }
  };

  // Connect with WalletConnect
  const connectWalletConnect = async () => {
    try {
      // For WalletConnect v2, you would need @walletconnect/ethereum-provider
      // This is a simplified version showing the concept
      alert('WalletConnect integration requires @walletconnect/ethereum-provider package. For now, please use MetaMask or install the WalletConnect package.');
      
      // Example implementation (requires additional setup):
      /*
      const WalletConnectProvider = (await import('@walletconnect/ethereum-provider')).default;
      
      const wcProvider = await WalletConnectProvider.init({
        projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
        chains: [1], // Ethereum mainnet
        showQrModal: true
      });

      await wcProvider.enable();
      
      const web3Provider = new ethers.providers.Web3Provider(wcProvider);
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);

      const gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, web3Signer);
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, web3Signer);
      
      setContract(gameContract);
      setTokenContract(token);

      await loadData(token, gameContract, address);
      setShowWalletModal(false);
      */
    } catch (error) {
      console.error('Error connecting WalletConnect:', error);
      alert('Failed to connect WalletConnect');
    }
  };

  // Handle wallet selection
  const handleWalletSelect = (wallet) => {
    if (wallet === 'metamask') {
      connectMetaMask();
    } else if (wallet === 'walletconnect') {
      connectWalletConnect();
    }
  };

  // Load all contract data
  const loadData = async (token, gameContract, address) => {
    try {
      const [bal, allowance, stats, winners, tiers, contractBal] = await Promise.all([
        token.balanceOf(address),
        token.allowance(address, CONTRACT_ADDRESS),
        gameContract.playerStats(address),
        gameContract.getRecentWinners(3),
        gameContract.getAllPrizeTiers(),
        gameContract.getContractBalance()
      ]);

      const balanceFormatted = ethers.utils.formatEther(bal);
      setBalance(balanceFormatted);
      setAvailableSpins(Math.floor(parseFloat(balanceFormatted) / parseFloat(SPIN_COST)));
      
      const contractBalFormatted = ethers.utils.formatEther(contractBal);
      setContractBalance(contractBalFormatted);
      
      const allowanceFormatted = ethers.utils.formatEther(allowance);
      setNeedsApproval(parseFloat(allowanceFormatted) < parseFloat(SPIN_COST));

      setPlayerStats({
        totalSpins: stats.totalSpins.toNumber(),
        totalWinnings: ethers.utils.formatEther(stats.totalWinnings)
      });

      setTotalWinnings(ethers.utils.formatEther(stats.totalWinnings));

      const formattedWinners = winners.map(w => ({
        player: w.player,
        prizeAmount: ethers.utils.formatEther(w.prizeAmount),
        tierIndex: w.tierIndex,
        timestamp: new Date(w.timestamp.toNumber() * 1000)
      }));
      setRecentWinners(formattedWinners);

      const formattedTiers = tiers.map(t => ({
        prizeAmount: ethers.utils.formatEther(t.prizeAmount),
        probability: t.probability / 100,
        name: t.name
      }));
      setPrizeTiers(formattedTiers);

    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Approve token spending
  const approveTokens = async () => {
    if (!tokenContract) return;
    
    setIsApproving(true);
    try {
      const tx = await tokenContract.approve(
        CONTRACT_ADDRESS,
        ethers.constants.MaxUint256
      );
      await tx.wait();
      setNeedsApproval(false);
      alert('Approval successful! You can now spin.');
    } catch (error) {
      console.error('Error approving:', error);
      alert('Approval failed');
    } finally {
      setIsApproving(false);
    }
  };

  // Spin the wheel
  const spinWheel = async () => {
    if (!contract || isSpinning || needsApproval) return;
    
    setIsSpinning(true);
    setLastWin(null);

    try {
      // Send transaction first
      const tx = await contract.spin();
      
      // Wait for transaction and listen for event
      const receipt = await tx.wait();
      
      // Find SpinCompleted event
      const event = receipt.events?.find(e => e.event === 'SpinCompleted');
      
      if (event) {
        const tierIndex = event.args.tierIndex.toNumber();
        const prizeAmount = ethers.utils.formatEther(event.args.prizeAmount);
        
        // Calculate where the winning segment should land
        const segmentAngle = 360 / prizeTiers.length; // 60 degrees per segment
        
        // The wheel segments start from top center (0°) and go clockwise
        // We want the CENTER of the winning segment to align with the pointer
        // Each segment spans from (tierIndex * 60°) to ((tierIndex + 1) * 60°)
        // So the center of a segment is at (tierIndex * 60°) + 30°
        const segmentCenterOffset = segmentAngle / 2; // 30 degrees to center of segment
        const targetAngle = (tierIndex * segmentAngle) + segmentCenterOffset;
        
        // Calculate total rotation: multiple full spins + landing position
        const numberOfSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full rotations
        const currentRotation = rotation % 360;
        
        // We rotate TO the target, accounting for current position
        const finalRotation = rotation - currentRotation + (numberOfSpins * 360) + (360 - targetAngle);
        
        setRotation(finalRotation);
        
        setTimeout(() => {
          setLastWin({
            tier: prizeTiers[tierIndex]?.name || `Prize ${tierIndex}`,
            amount: prizeAmount
          });
        }, 3000);
      }

      // Reload data
      await loadData(tokenContract, contract, account);
      
    } catch (error) {
      console.error('Error spinning:', error);
      alert('Spin failed: ' + (error.reason || error.message));
    } finally {
      setTimeout(() => setIsSpinning(false), 3500);
    }
  };

  // Auto-load data on mount
  useEffect(() => {
    if (tokenContract && contract && account) {
      loadData(tokenContract, contract, account);
    }
  }, [tokenContract, contract, account]);

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatNumber = (num) => {
    return parseFloat(num).toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const getTimeSince = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    const days = Math.floor(seconds / 86400);
    if (days > 0) return `${days} days ago`;
    const hours = Math.floor(seconds / 3600);
    if (hours > 0) return `${hours} hours ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes} min ago`;
    return 'Just now';
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <WalletModal 
        isOpen={showWalletModal} 
        onClose={() => setShowWalletModal(false)}
        onSelectWallet={handleWalletSelect}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Baby Big Five Spin</h1>
              <p className="text-sm text-gray-400">Win BFT</p>
            </div>
          </div>
          
          {!account ? (
            <button
              onClick={() => setShowWalletModal(true)}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 px-6 py-3 rounded-xl font-semibold transition"
            >
              <Wallet className="w-5 h-5" />
              Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-xl">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="font-mono">{formatAddress(account)}</span>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">BBFT Balance</p>
            <p className="text-3xl font-bold">{formatNumber(balance)}</p>
            <p className="text-gray-500 text-xs mt-1">Available to spend</p>
          </div>
          
          <div className="bg-gray-900 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Available Spins</p>
            <p className="text-3xl font-bold text-orange-500">{availableSpins}</p>
            <p className="text-gray-500 text-xs mt-1">@ {formatNumber(SPIN_COST)} BBFT each</p>
          </div>
          
          <div className="bg-gray-900 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Total Winnings</p>
            <p className="text-3xl font-bold text-green-500">{formatNumber(totalWinnings)}</p>
            <p className="text-gray-500 text-xs mt-1">All time earnings</p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Prize Pool</p>
            <p className="text-3xl font-bold text-blue-500">{formatNumber(contractBalance)}</p>
            <p className="text-gray-500 text-xs mt-1">Contract balance</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Wheel Section */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 rounded-2xl p-8">
              <h2 className="text-xl font-bold mb-6">Spin the Wheel!</h2>
              
              {/* Wheel */}
              <div className="relative w-full max-w-md mx-auto mb-8">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                  <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[16px] border-l-transparent border-r-transparent border-t-orange-500"></div>
                </div>
                
                <svg
                  viewBox="0 0 200 200"
                  className="w-full h-auto"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: isSpinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
                  }}
                >
                  <circle cx="100" cy="100" r="95" fill="#1F2937" stroke="#F97316" strokeWidth="3"/>
                  {prizeTiers.map((tier, index) => {
                    const angle = (360 / prizeTiers.length) * index;
                    const nextAngle = (360 / prizeTiers.length) * (index + 1);
                    const startRad = (angle - 90) * Math.PI / 180;
                    const endRad = (nextAngle - 90) * Math.PI / 180;
                    
                    const x1 = 100 + 95 * Math.cos(startRad);
                    const y1 = 100 + 95 * Math.sin(startRad);
                    const x2 = 100 + 95 * Math.cos(endRad);
                    const y2 = 100 + 95 * Math.sin(endRad);
                    
                    const midAngle = (angle + nextAngle) / 2 - 90;
                    const midRad = midAngle * Math.PI / 180;
                    const textX = 100 + 65 * Math.cos(midRad);
                    const textY = 100 + 65 * Math.sin(midRad);
                    
                    // Format prize amount for display
                    const displayAmount = tier.prizeAmount === "0" ? "Try Again" : `${formatNumber(tier.prizeAmount)} BBFT`;
                    
                    return (
                      <g key={index}>
                        <path
                          d={`M 100 100 L ${x1} ${y1} A 95 95 0 0 1 ${x2} ${y2} Z`}
                          fill={PRIZE_COLORS[index % PRIZE_COLORS.length]}
                          stroke="#000"
                          strokeWidth="1.5"
                        />
                        <text
                          x={textX}
                          y={textY}
                          fill="white"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}
                        >
                          <tspan x={textX} dy="-5">{displayAmount.split(' ')[0]}</tspan>
                          <tspan x={textX} dy="10">{displayAmount.split(' ').slice(1).join(' ')}</tspan>
                        </text>
                      </g>
                    );
                  })}
                  <circle cx="100" cy="100" r="20" fill="#F97316" stroke="#000" strokeWidth="2"/>
                  <circle cx="100" cy="100" r="12" fill="#1F2937"/>
                  <text x="100" y="105" fill="white" fontSize="14" fontWeight="bold" textAnchor="middle">SPIN</text>
                </svg>
              </div>

              {/* Last Win Alert */}
              {lastWin && (
                <div className="bg-green-500/20 border border-green-500 rounded-xl p-4 mb-6 text-center animate-pulse">
                  <p className="text-green-400 font-bold text-lg">🎉 You won {formatNumber(lastWin.amount)} BBFT!</p>
                  <p className="text-gray-300 text-sm">Prize: {lastWin.tier}</p>
                </div>
              )}

              {/* Spin Button */}
              {!account ? (
                <button
                  onClick={() => setShowWalletModal(true)}
                  className="w-full bg-orange-500 hover:bg-orange-600 py-4 rounded-xl font-bold text-lg transition"
                >
                  Connect Wallet to Spin
                </button>
              ) : needsApproval ? (
                <button
                  onClick={approveTokens}
                  disabled={isApproving}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>Approve BBFT Tokens</>
                  )}
                </button>
              ) : (
                <button
                  onClick={spinWheel}
                  disabled={isSpinning || availableSpins === 0}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2"
                >
                  {isSpinning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Spinning...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      SPIN NOW ({availableSpins} available)
                    </>
                  )}
                </button>
              )}
              
              <p className="text-center text-gray-400 text-sm mt-3">
                💰 Costs {formatNumber(SPIN_COST)} BBFT per spin
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Prize Odds */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-orange-500" />
                Prize Odds
              </h3>
              <div className="space-y-3">
                {prizeTiers.map((tier, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: PRIZE_COLORS[index % PRIZE_COLORS.length] }}
                      ></div>
                      <span className="text-sm">{tier.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{formatNumber(tier.prizeAmount)} BBFT</span>
                      <span className="text-orange-500 font-bold text-sm">{tier.probability}%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-800 text-xs text-gray-400">
                ⚡ Fair & Transparent<br/>
                🔒 Verified on-chain randomness (VRF)
              </div>
            </div>

            {/* Recent Winners */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Recent Winners
              </h3>
              <div className="space-y-3">
                {recentWinners.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No winners yet</p>
                ) : (
                  recentWinners.map((winner, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                      <div>
                        <p className="font-mono text-sm">{formatAddress(winner.player)}</p>
                        <p className="text-xs text-gray-400">{getTimeSince(winner.timestamp)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-orange-500 font-bold">{formatNumber(winner.prizeAmount)} BBFT</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}