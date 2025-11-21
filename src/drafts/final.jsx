import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Loader2, Wallet, TrendingUp, Trophy, RefreshCw, X, Plus, Minus, Clock } from 'lucide-react';

const CONTRACT_ADDRESS = "0x0b3330d9D5806E00910c870ef4C4201C1105Ae5F";
const TOKEN_ADDRESS = "0xfB69e2d3d673A8DB9Fa74ffc036A8Cf641255769";
//const WALLETCONNECT_PROJECT_ID = "905f16b4b770b18620f2739ed4757d0c";


const CONTRACT_ABI = [
  "function spin() external returns (uint256)",
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function getPlayerSpinInfo(address player) external view returns (uint256 depositedAmount, uint256 totalSpinsAllowance, uint256 availableSpins, uint256 totalSpinsUsed)",
  "function getPlayerUsageStats(address player) external view returns (uint256 totalSpins, uint256 totalWinnings, uint256 lastSpinTime)",
  "function getRecentWinners(uint256 count) external view returns (tuple(address player, uint256 prizeAmount, uint256 feeAmount, uint256 tierIndex, uint256 timestamp, bytes32 requestId)[])",
  "function getContractBalance() external view returns (uint256)",
  "function getAllPrizeTiers() external view returns (tuple(uint256 prizeAmount, uint256 probability, string name)[])",
  "function getTotalFeesCollected() external view returns (uint256)",
  "function getFeeRecipient() external view returns (address)",
  "function getSpinCost() external view returns (uint256)",
  "event SpinCompleted(address indexed player, uint256 indexed spinId, uint256 tierIndex, uint256 prizeAmount, uint256 feeAmount, uint256 timestamp)"
];

const TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const PRIZE_COLORS = ['#3B82F6', '#A855F7', '#EC4899', '#10B981', '#F59E0B', '#6B7280'];
const TIER_AMOUNT = "10000";

// WalletConnect configuration
const WALLETCONNECT_PROJECT_ID = "YOUR_WALLETCONNECT_PROJECT_ID"; // Get from https://cloud.walletconnect.com

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

        <div className="mt-4 p-3 bg-gray-800 rounded-lg text-xs text-gray-400">
          💡 <strong>WalletConnect Setup:</strong> Get your project ID from{' '}
          <a 
            href="https://cloud.walletconnect.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            WalletConnect Cloud
          </a>
        </div>
      </div>
    </div>
  );
}

// Deposit/Withdraw Modal
function DepositModal({ isOpen, onClose, onDeposit, onWithdraw, balance, depositedAmount, needsApproval }) {
  const [amount, setAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  if (!isOpen) return null;

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) < parseFloat(TIER_AMOUNT)) return;
    setIsDepositing(true);
    try {
      await onDeposit(amount);
      setAmount('');
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) > parseFloat(depositedAmount)) return;
    setIsWithdrawing(true);
    try {
      await onWithdraw(amount);
      setAmount('');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Manage Deposit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          {needsApproval && (
            <div className="bg-yellow-500/20 border border-yellow-500 rounded-xl p-3">
              <p className="text-yellow-500 text-sm font-semibold mb-1">⚠️ Approval Required</p>
              <p className="text-yellow-200 text-xs">First deposit requires token approval. You'll sign 2 transactions.</p>
            </div>
          )}

          <div>
            <p className="text-sm text-gray-400 mb-1">Your Wallet Balance</p>
            <p className="text-2xl font-bold">{parseFloat(balance).toLocaleString()} BBFT</p>
          </div>

          <div>
            <p className="text-sm text-gray-400 mb-1">Currently Deposited</p>
            <p className="text-2xl font-bold text-orange-500">{parseFloat(depositedAmount).toLocaleString()} BBFT</p>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Amount (multiples of 10,000)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10000"
              step="10000"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setAmount('10000')}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
              >
                10k
              </button>
              <button
                onClick={() => setAmount('20000')}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
              >
                20k
              </button>
              <button
                onClick={() => setAmount('50000')}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
              >
                50k
              </button>
              <button
                onClick={() => setAmount('100000')}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
              >
                100k
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDeposit}
              disabled={isDepositing || !amount || parseFloat(amount) < 10000 || parseFloat(amount) % 10000 !== 0}
              className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
            >
              {isDepositing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Depositing...</>
              ) : (
                <><Plus className="w-5 h-5" /> Deposit</>
              )}
            </button>

            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !amount || parseFloat(depositedAmount) === 0}
              className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
            >
              {isWithdrawing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Withdrawing...</>
              ) : (
                <><Minus className="w-5 h-5" /> Withdraw</>
              )}
            </button>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 text-sm">
            <p className="text-gray-400 mb-2">💡 How Spins Work:</p>
            <ul className="space-y-1 text-gray-300">
              <li>• 10k BBFT = 5 spins</li>
              <li>• Each spin costs {formatNumber(spinCost)} BBFT from your deposit</li>
              <li>• Winnings have a 1% fee</li>
              <li>• Withdraw unused deposit anytime!</li>
            </ul>
          </div>
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
  const [wcProvider, setWcProvider] = useState(null);
  
  const [balance, setBalance] = useState('0');
  const [depositedAmount, setDepositedAmount] = useState('0');
  const [contractBalance, setContractBalance] = useState('0');
  const [spinCost, setSpinCost] = useState('2000');
  const [accumulatedFees, setAccumulatedFees] = useState('0');
  const [playerInfo, setPlayerInfo] = useState({
    totalSpinsAllowance: 0,
    availableSpins: 0,
    totalSpinsUsed: 0,
    totalWinnings: '0'
  });
  const [recentWinners, setRecentWinners] = useState([]);
  const [prizeTiers, setPrizeTiers] = useState([]);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastWin, setLastWin] = useState(null);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

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

      const network = await web3Provider.getNetwork();
      console.log('Connected to network:', network.name, 'Chain ID:', network.chainId);

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);

      if (CONTRACT_ADDRESS === "YOUR_CONTRACT_ADDRESS_HERE" || TOKEN_ADDRESS === "YOUR_BBFT_TOKEN_ADDRESS_HERE") {
        alert('⚠️ Please set CONTRACT_ADDRESS and TOKEN_ADDRESS in the code first!');
        setShowWalletModal(false);
        return;
      }

      const gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, web3Signer);
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, web3Signer);
      
      setContract(gameContract);
      setTokenContract(token);

      try {
        await loadData(token, gameContract, address);
      } catch (loadError) {
        console.error('Error loading initial data:', loadError);
        alert('Connected to wallet, but could not load contract data. Please check:\n1. You are on the correct network\n2. Contract addresses are correct\n3. Contracts are deployed');
      }
      
      setShowWalletModal(false);
    } catch (error) {
      console.error('Error connecting MetaMask:', error);
      alert('Failed to connect MetaMask: ' + (error.message || 'Unknown error'));
    }
  };

  // Connect with WalletConnect
  const connectWalletConnect = async () => {
    try {
      // Dynamic import for WalletConnect
      const EthereumProvider = (await import('@walletconnect/ethereum-provider')).default;
      
      // Check if project ID is set
      if (WALLETCONNECT_PROJECT_ID === "YOUR_WALLETCONNECT_PROJECT_ID") {
        alert('⚠️ Please set WALLETCONNECT_PROJECT_ID in the code!\n\nGet your free project ID from: https://cloud.walletconnect.com');
        return;
      }

      // Initialize WalletConnect provider
      const walletConnectProvider = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [1], // Ethereum mainnet - adjust based on your network
        showQrModal: true,
        qrModalOptions: {
          themeMode: 'dark'
        }
      });

      // Enable session (triggers QR Code modal)
      await walletConnectProvider.enable();

      // Create ethers provider
      const web3Provider = new ethers.providers.Web3Provider(walletConnectProvider);
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();

      console.log('WalletConnect connected:', address);

      setWcProvider(walletConnectProvider);
      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);

      if (CONTRACT_ADDRESS === "YOUR_CONTRACT_ADDRESS_HERE" || TOKEN_ADDRESS === "YOUR_BBFT_TOKEN_ADDRESS_HERE") {
        alert('⚠️ Please set CONTRACT_ADDRESS and TOKEN_ADDRESS in the code first!');
        setShowWalletModal(false);
        return;
      }

      const gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, web3Signer);
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, web3Signer);
      
      setContract(gameContract);
      setTokenContract(token);

      try {
        await loadData(token, gameContract, address);
      } catch (loadError) {
        console.error('Error loading initial data:', loadError);
        alert('Connected to wallet, but could not load contract data.');
      }

      setShowWalletModal(false);

      // Listen for disconnect
      walletConnectProvider.on('disconnect', () => {
        console.log('WalletConnect disconnected');
        disconnectWallet();
      });

    } catch (error) {
      console.error('Error connecting WalletConnect:', error);
      
      if (error.message.includes('Cannot find module')) {
        alert('WalletConnect package not found. To use WalletConnect:\n\n1. Install: npm install @walletconnect/ethereum-provider\n2. Get project ID from: https://cloud.walletconnect.com\n3. Set WALLETCONNECT_PROJECT_ID in the code\n\nFor now, please use MetaMask.');
      } else {
        alert('Failed to connect WalletConnect: ' + (error.message || 'Unknown error'));
      }
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    if (wcProvider) {
      wcProvider.disconnect();
    }
    setWcProvider(null);
    setProvider(null);
    setSigner(null);
    setAccount('');
    setContract(null);
    setTokenContract(null);
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
      const [bal, allowance] = await Promise.all([
        token.balanceOf(address).catch(err => {
          console.error('Error fetching balance:', err);
          return ethers.BigNumber.from(0);
        }),
        token.allowance(address, CONTRACT_ADDRESS).catch(err => {
          console.error('Error fetching allowance:', err);
          return ethers.BigNumber.from(0);
        })
      ]);

      const balanceFormatted = ethers.utils.formatEther(bal);
      setBalance(balanceFormatted);
      
      const allowanceFormatted = ethers.utils.formatEther(allowance);
      setNeedsApproval(parseFloat(allowanceFormatted) < 10000);

      const [spinInfo, usageStats, winners, tiers, contractBal] = await Promise.all([
        gameContract.getPlayerSpinInfo(address).catch(err => {
          console.error('Error fetching spin info:', err);
          return {
            depositedAmount: ethers.BigNumber.from(0),
            totalSpinsAllowance: ethers.BigNumber.from(0),
            availableSpins: ethers.BigNumber.from(0),
            totalSpinsUsed: ethers.BigNumber.from(0)
          };
        }),
        gameContract.getPlayerUsageStats(address).catch(err => {
          console.error('Error fetching usage stats:', err);
          return {
            totalSpins: ethers.BigNumber.from(0),
            totalWinnings: ethers.BigNumber.from(0),
            lastSpinTime: ethers.BigNumber.from(0)
          };
        }),
        gameContract.getRecentWinners(3).catch(err => {
          console.error('Error fetching winners:', err);
          return [];
        }),
        gameContract.getAllPrizeTiers().catch(err => {
          console.error('Error fetching tiers:', err);
          return [];
        }),
        gameContract.getContractBalance().catch(err => {
          console.error('Error fetching contract balance:', err);
          return ethers.BigNumber.from(0);
        })
      ]);
      
      const depositedFormatted = ethers.utils.formatEther(spinInfo.depositedAmount);
      setDepositedAmount(depositedFormatted);
      
      const contractBalFormatted = ethers.utils.formatEther(contractBal);
      setContractBalance(contractBalFormatted);

      setPlayerInfo({
        totalSpinsAllowance: spinInfo.totalSpinsAllowance.toNumber(),
        availableSpins: spinInfo.availableSpins.toNumber(),
        totalSpinsUsed: spinInfo.totalSpinsUsed.toNumber(),
        totalWinnings: ethers.utils.formatEther(usageStats.totalWinnings)
      });

      const formattedWinners = winners.map(w => ({
        player: w.player,
        prizeAmount: ethers.utils.formatEther(w.prizeAmount),
        feeAmount: ethers.utils.formatEther(w.feeAmount),
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

      // Get spin cost and accumulated fees
      try {
        const cost = await gameContract.getSpinCost();
        setSpinCost(ethers.utils.formatEther(cost));
        
        const fees = await gameContract.getAccumulatedFees();
        setAccumulatedFees(ethers.utils.formatEther(fees));
      } catch (err) {
        console.error('Error fetching spin cost/fees:', err);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Deposit tokens
  const handleDeposit = async (amount) => {
    if (!contract || !tokenContract) return;
    
    try {
      const currentAllowance = await tokenContract.allowance(account, CONTRACT_ADDRESS);
      const depositAmount = ethers.utils.parseEther(amount);
      
      if (currentAllowance.lt(depositAmount)) {
        alert('First, you need to approve the contract to spend your tokens.');
        const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, ethers.constants.MaxUint256);
        alert('Approving... Please wait for confirmation.');
        await approveTx.wait();
        alert('Approval successful! Now depositing...');
      }
      
      const tx = await contract.deposit(depositAmount);
      alert('Depositing... Please wait for confirmation.');
      await tx.wait();
      await loadData(tokenContract, contract, account);
      setShowDepositModal(false);
      alert('Deposit successful! You can now spin.');
    } catch (error) {
      console.error('Error depositing:', error);
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        alert('Transaction cancelled by user.');
      } else {
        alert('Deposit failed: ' + (error.reason || error.message));
      }
    }
  };

  // Withdraw tokens
  const handleWithdraw = async (amount) => {
    if (!contract) return;
    
    try {
      const tx = await contract.withdraw(ethers.utils.parseEther(amount));
      await tx.wait();
      await loadData(tokenContract, contract, account);
      setShowDepositModal(false);
      alert('Withdrawal successful!');
    } catch (error) {
      console.error('Error withdrawing:', error);
      alert('Withdrawal failed: ' + (error.reason || error.message));
    }
  };

  // Spin the wheel
  const spinWheel = async () => {
    if (!contract || isSpinning) return;
    
    setIsSpinning(true);
    setLastWin(null);

    try {
      const tx = await contract.spin();
      const receipt = await tx.wait();
      
      const event = receipt.events?.find(e => e.event === 'SpinCompleted');
      
      if (event) {
        const tierIndex = event.args.tierIndex.toNumber();
        const prizeAmount = ethers.utils.formatEther(event.args.prizeAmount);
        
        const segmentAngle = 360 / prizeTiers.length;
        const segmentCenterOffset = segmentAngle / 2;
        const targetAngle = (tierIndex * segmentAngle) + segmentCenterOffset;
        
        const numberOfSpins = 5 + Math.floor(Math.random() * 3);
        const currentRotation = rotation % 360;
        
        const finalRotation = rotation - currentRotation + (numberOfSpins * 360) + (360 - targetAngle);
        
        setRotation(finalRotation);
        
        setTimeout(() => {
          setLastWin({
            tier: prizeTiers[tierIndex]?.name || `Prize ${tierIndex}`,
            amount: prizeAmount
          });
        }, 3000);
      }

      await loadData(tokenContract, contract, account);
      
    } catch (error) {
      console.error('Error spinning:', error);
      alert('Spin failed: ' + (error.reason || error.message));
    } finally {
      setTimeout(() => setIsSpinning(false), 3500);
    }
  };

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

      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onDeposit={handleDeposit}
        onWithdraw={handleWithdraw}
        balance={balance}
        depositedAmount={depositedAmount}
        needsApproval={needsApproval}
      />

      <div className="max-w-7xl mx-auto">
        {/* Setup Warning */}
        {(CONTRACT_ADDRESS === "YOUR_CONTRACT_ADDRESS_HERE" || TOKEN_ADDRESS === "YOUR_BBFT_TOKEN_ADDRESS_HERE") && (
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-2xl p-6 mb-8">
            <h3 className="text-xl font-bold text-yellow-500 mb-3">⚠️ Setup Required</h3>
            <p className="text-gray-300 mb-4">Please configure your contract addresses in the code:</p>
            <div className="bg-gray-900 rounded-xl p-4 font-mono text-sm space-y-2">
              <p className="text-gray-400">const CONTRACT_ADDRESS = "<span className="text-orange-500">YOUR_DEPLOYED_CONTRACT_ADDRESS</span>";</p>
              <p className="text-gray-400">const TOKEN_ADDRESS = "<span className="text-orange-500">YOUR_BBFT_TOKEN_ADDRESS</span>";</p>
              <p className="text-gray-400">const WALLETCONNECT_PROJECT_ID = "<span className="text-orange-500">YOUR_PROJECT_ID</span>";</p>
            </div>
            <p className="text-gray-400 text-sm mt-4">
              💡 Get WalletConnect project ID from: <a href="https://cloud.walletconnect.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">cloud.walletconnect.com</a>
            </p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Baby Big Five Spin</h1>
              <p className="text-sm text-gray-400">Win BBFT Tokens</p>
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
            <div className="flex items-center gap-3">
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Wallet Balance</p>
            <p className="text-3xl font-bold">{formatNumber(balance)}</p>
            <p className="text-gray-500 text-xs mt-1">Available BBFT</p>
          </div>
          
          <div className="bg-gray-900 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Deposited</p>
            <p className="text-3xl font-bold text-orange-500">{formatNumber(depositedAmount)}</p>
            <button
              onClick={() => setShowDepositModal(true)}
              className="text-orange-500 text-xs mt-1 hover:underline"
            >
              Manage Deposit →
            </button>
          </div>
          
          <div className="bg-gray-900 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Spins Available</p>
            <p className="text-3xl font-bold text-green-500">
              {playerInfo.availableSpins}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Total: {playerInfo.totalSpinsAllowance - playerInfo.totalSpinsUsed}/{playerInfo.totalSpinsAllowance}
            </p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Total Winnings</p>
            <p className="text-3xl font-bold text-blue-500">{formatNumber(playerInfo.totalWinnings)}</p>
            <p className="text-gray-500 text-xs mt-1">All time earnings</p>
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
              ) : parseFloat(depositedAmount) < parseFloat(TIER_AMOUNT) ? (
                <button
                  onClick={() => setShowDepositModal(true)}
                  className="w-full bg-orange-500 hover:bg-orange-600 py-4 rounded-xl font-bold text-lg transition"
                >
                  Deposit 10k BBFT to Play
                </button>
              ) : (
                <button
                  onClick={spinWheel}
                  disabled={isSpinning || playerInfo.availableSpins === 0}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2"
                >
                  {isSpinning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Spinning...
                    </>
                  ) : playerInfo.availableSpins === 0 ? (
                    <>No Spins Remaining - Deposit More!</>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      SPIN NOW ({playerInfo.availableSpins} spins left)
                    </>
                  )}
                </button>
              )}
              
              <p className="text-center text-gray-400 text-sm mt-3">
                💰 Each spin costs {formatNumber(spinCost)} BBFT | 1% fee on winnings
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
                🔒 On-chain randomness
              </div>
            </div>

            {/* Deposit Info */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-green-500" />
                How It Works
              </h3>
              <div className="space-y-3 text-sm">
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400">Deposit 10k BBFT</span>
                    <span className="text-green-500 font-bold">5 Spins</span>
                  </div>
                  <p className="text-xs text-gray-500">Each spin costs {formatNumber(spinCost)} BBFT</p>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400">Deposit 20k BBFT</span>
                    <span className="text-green-500 font-bold">10 Spins</span>
                  </div>
                  <p className="text-xs text-gray-500">Deposit reduces as you spin</p>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400">Win Prizes</span>
                    <span className="text-yellow-500 font-bold">1% Fee</span>
                  </div>
                  <p className="text-xs text-gray-500">Up to 5,000 BBFT per spin!</p>
                </div>
              </div>
              
              <button
                onClick={() => setShowDepositModal(true)}
                className="w-full mt-4 bg-orange-500 hover:bg-orange-600 py-2 rounded-lg font-semibold text-sm transition"
              >
                Manage Deposit
              </button>
            </div>

            {/* Recent Winners */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Recent Winners
              </h3>
              <div className="space-y-3">
                {recentWinners.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No winners yet. Be the first! 🎉</p>
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

            {/* Prize Pool */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-2">Prize Pool</h3>
              <p className="text-3xl font-bold text-blue-500">{formatNumber(contractBalance)}</p>
              <p className="text-xs text-gray-400 mt-1">BBFT available for prizes</p>
            </div>
          </div>
        </div>

        {/* Instructions Footer */}
        <div className="mt-8 bg-gray-900 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4">🚀 Quick Start Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-2xl mb-2">1️⃣</div>
              <h4 className="font-semibold mb-1">Connect Wallet</h4>
              <p className="text-sm text-gray-400">Use MetaMask or WalletConnect to connect your wallet</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-2xl mb-2">2️⃣</div>
              <h4 className="font-semibold mb-1">Deposit BBFT</h4>
              <p className="text-sm text-gray-400">Deposit 10k BBFT = 5 spins. Each spin costs {formatNumber(spinCost)} BBFT from your deposit</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-2xl mb-2">3️⃣</div>
              <h4 className="font-semibold mb-1">Spin & Win</h4>
              <p className="text-sm text-gray-400">Click SPIN NOW and win up to 5,000 BBFT!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}