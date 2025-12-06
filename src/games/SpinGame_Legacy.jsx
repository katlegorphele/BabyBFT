import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  Loader2,
  Wallet,
  Trophy,
  RefreshCw,
  X,
  Plus,
  Minus,
  ExternalLink,
} from "lucide-react";

const CONTRACT_ADDRESS = "0x4227FB372Ce815D8F14259bCf44bcf5937B489bc";
const TOKEN_ADDRESS = "0xfB69e2d3d673A8DB9Fa74ffc036A8Cf641255769";
const WALLETCONNECT_PROJECT_ID = "905f16b4b770b18620f2739ed4757d0c";
const BSC_CHAIN_ID = 56;
const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";

// Wallet type constants for persistence
const WALLET_TYPES = {
  METAMASK: "metamask",
  TRUST_WALLET: "trustwallet",
  WALLETCONNECT: "walletconnect",
};
const LAST_WALLET_KEY = "bbft_last_wallet";

const BUY_TOKEN_URL = `https://pancakeswap.finance/swap?inputCurrency=${TOKEN_ADDRESS}`;
const SELL_TOKEN_URL = `https://pancakeswap.finance/swap?inputCurrency=${TOKEN_ADDRESS}`;

const CONTRACT_ABI = [
  "function spin() external returns (uint256)",
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function getPlayerSpinInfo(address player) external view returns (uint256 depositedAmount, uint256 totalSpinsAllowance, uint256 availableSpins, uint256 totalSpinsUsed)",
  "function getPlayerUsageStats(address player) external view returns (uint256 totalSpins, uint256 totalWinnings, uint256 lastSpinTime)",
  "function getRecentWinners(uint256 count) external view returns (tuple(address player, uint256 prizeAmount, uint256 feeAmount, uint256 tierIndex, uint256 timestamp, bytes32 requestId, uint256 randomSeed)[])", // Added randomSeed here
  "function getContractBalance() external view returns (uint256)",
  "function getAllPrizeTiers() external view returns (tuple(uint256 prizeAmount, uint256 probability, string name)[])",
  "function getTotalFeesCollected() external view returns (uint256)",
  "function getTreasury() external view returns (address)",
  "function getSpinCost() external view returns (uint256)",
  "event SpinCompleted(address indexed player, uint256 indexed spinId, uint256 tierIndex, uint256 prizeAmount, uint256 feeAmount, uint256 timestamp, uint256 randomSeed)", // Added randomSeed here
];

const TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

const PRIZE_COLORS = [
  "#3B82F6",
  "#A855F7",
  "#EC4899",
  "#10B981",
  "#F59E0B",
  "#6B7280",
];

const formatNumber = (num) =>
  parseFloat(num).toLocaleString("en-US", { maximumFractionDigits: 0 });
const formatAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
const getTimeSince = (date) => {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ago`;
  return "Just now";
};

function WalletModal({ isOpen, onClose, onSelectWallet, isMobileDevice }) {
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
          {/* On mobile, only show WalletConnect. On desktop, show all options */}
          {!isMobileDevice && (
            <>
              <button
                onClick={() => onSelectWallet("trustwallet")}
                className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 p-4 rounded-xl transition"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-2xl">
                  🛡️
                </div>
                <div className="text-left">
                  <p className="font-semibold">Trust Wallet</p>
                  <p className="text-sm text-gray-400">
                    Connect with Trust Wallet
                  </p>
                </div>
              </button>
            </>
          )}
          <button
            onClick={() => onSelectWallet("metamask")}
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
            onClick={() => onSelectWallet("walletconnect")}
            className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 p-4 rounded-xl transition"
          >
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-2xl">
              🔗
            </div>
            <div className="text-left">
              <p className="font-semibold">WalletConnect</p>
              <p className="text-sm text-gray-400">
                {isMobileDevice
                  ? "Connect with your mobile wallet"
                  : "Scan with mobile wallet"}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function DepositModal({
  isOpen,
  onClose,
  onDeposit,
  onWithdraw,
  balance,
  depositedAmount,
  needsApproval,
  spinCost,
}) {
  const [amount, setAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  if (!isOpen) return null;

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) < 10000) return;
    setIsDepositing(true);
    try {
      await onDeposit(amount);
      setAmount("");
    } finally {
      setIsDepositing(false);
    }
  };
  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) > parseFloat(depositedAmount)) return;
    setIsWithdrawing(true);
    try {
      await onWithdraw(amount);
      setAmount("");
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
              <p className="text-yellow-500 text-sm font-semibold">
                ⚠️ Approval Required
              </p>
              <p className="text-yellow-200 text-xs">
                First deposit requires token approval.
              </p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-400 mb-1">Wallet Balance</p>
            <p className="text-2xl font-bold">{formatNumber(balance)} BBFT</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Deposited</p>
            <p className="text-2xl font-bold text-orange-500">
              {formatNumber(depositedAmount)} BBFT
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              Amount (multiples of 10,000)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10000"
              step="10000"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-2 mt-2">
              {["10000", "20000", "50000", "100000"].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
                >
                  {parseInt(v) / 1000}k
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDeposit}
              disabled={
                isDepositing ||
                !amount ||
                parseFloat(amount) < 10000 ||
                parseFloat(amount) % 10000 !== 0
              }
              className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
            >
              {isDepositing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Depositing...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Deposit
                </>
              )}
            </button>
            <button
              onClick={handleWithdraw}
              disabled={
                isWithdrawing || !amount || parseFloat(depositedAmount) === 0
              }
              className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
            >
              {isWithdrawing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Withdrawing...
                </>
              ) : (
                <>
                  <Minus className="w-5 h-5" />
                  Withdraw
                </>
              )}
            </button>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-sm">
            <p className="text-gray-400 mb-2">💡 How Spins Work:</p>
            <ul className="space-y-1 text-gray-300">
              <li>• 10k BBFT = 5 spins</li>
              <li>• Each spin costs {formatNumber(spinCost)} BBFT</li>
              <li>• Winnings have a 1% fee</li>
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
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [tokenContract, setTokenContract] = useState(null);
  const [wcProvider, setWcProvider] = useState(null);
  const [balance, setBalance] = useState("0");
  const [bnbBalance, setBnbBalance] = useState("0");
  const [walletType, setWalletType] = useState(null);
  const [depositedAmount, setDepositedAmount] = useState("0");
  const [contractBalance, setContractBalance] = useState("0");
  const [spinCost, setSpinCost] = useState("2000");
  const [playerInfo, setPlayerInfo] = useState({
    totalSpinsAllowance: 0,
    availableSpins: 0,
    totalSpinsUsed: 0,
    totalWinnings: "0",
  });
  const [recentWinners, setRecentWinners] = useState([]);
  const [prizeTiers, setPrizeTiers] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastWin, setLastWin] = useState(null);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [bbftPrice, setBbftPrice] = useState(0);
  const [bnbPrice, setBnbPrice] = useState(0);
  const [showDepositModal, setShowDepositModal] = useState(false);

  // Helper to detect mobile device
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  };

  // Helper to reset wallet state before connecting a new wallet
  const resetWalletState = () => {
    wcProvider?.disconnect();
    setWcProvider(null);
    setProvider(null);
    setSigner(null);
    setAccount("");
    setContract(null);
    setTokenContract(null);
    setBnbBalance("0");
    setBalance("0");
    setDepositedAmount("0");
    setPlayerInfo({
      totalSpinsAllowance: 0,
      availableSpins: 0,
      totalSpinsUsed: 0,
      totalWinnings: "0",
    });
    setNeedsApproval(true);
    setWalletType(null);
  };

  // Helper to switch to BSC during wallet connection
  const switchToBsc = async (ethereumProvider) => {
    try {
      await ethereumProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${BSC_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await ethereumProvider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${BSC_CHAIN_ID.toString(16)}`,
              chainName: "BNB Smart Chain",
              nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
              rpcUrls: [BSC_RPC_URL],
              blockExplorerUrls: ["https://bscscan.com"],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  };

  const connectMetaMask = async () => {
    try {
      // Find the actual MetaMask provider (handles multiple wallet extensions)
      let metamaskProvider = null;

      // On mobile, check if we're inside MetaMask's in-app browser
      // Otherwise fall back to WalletConnect
      if (isMobile()) {
        if (window.ethereum?.isMetaMask && !window.ethereum?.isTrust) {
          metamaskProvider = window.ethereum;
        } else {
          await connectWalletConnect();
          return;
        }
      } else {
        // Check for multiple providers (when multiple wallet extensions are installed)
        if (window.ethereum?.providers?.length) {
          for (const p of window.ethereum.providers) {
            if (p.isMetaMask && !p.isTrust) {
              metamaskProvider = p;
              break;
            }
          }
        }

        // If not found in providers array, check window.ethereum directly
        if (!metamaskProvider && window.ethereum) {
          if (window.ethereum.isMetaMask && !window.ethereum.isTrust) {
            metamaskProvider = window.ethereum;
          }
        }

        // If still not found on desktop, show error
        if (!metamaskProvider) {
          if (window.ethereum) {
            alert(
              "MetaMask not detected. Another wallet is installed. Please use Trust Wallet or WalletConnect instead, or install MetaMask extension."
            );
          } else {
            alert(
              "No wallet detected. Please install MetaMask or use WalletConnect."
            );
          }
          return;
        }
      }

      // Clear previous wallet state before connecting
      resetWalletState();

      // Switch to BSC first
      await switchToBsc(metamaskProvider);

      const web3Provider = new ethers.providers.Web3Provider(metamaskProvider);
      await web3Provider.send("eth_requestAccounts", []);
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();
      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      setWalletType(WALLET_TYPES.METAMASK);
      localStorage.setItem(LAST_WALLET_KEY, WALLET_TYPES.METAMASK);
      const gameContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        web3Signer
      );
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, web3Signer);
      setContract(gameContract);
      setTokenContract(token);
      await loadData(token, gameContract, address, web3Provider);
      setShowWalletModal(false);
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to connect: " + error.message);
    }
  };

  const connectTrustWallet = async () => {
    try {
      // Find the actual Trust Wallet provider (handles multiple wallet extensions)
      let trustProvider = null;

      // On mobile, check if we're inside Trust Wallet's in-app browser
      // Otherwise fall back to WalletConnect
      if (isMobile()) {
        if (window.trustwallet) {
          trustProvider = window.trustwallet;
        } else if (window.ethereum?.isTrust) {
          trustProvider = window.ethereum;
        } else {
          await connectWalletConnect();
          return;
        }
      } else {
        // Desktop: Find Trust Wallet provider
        if (window.trustwallet) {
          trustProvider = window.trustwallet;
        } else if (window.ethereum?.providers?.length) {
          // Multiple wallets installed - find Trust Wallet specifically
          trustProvider = window.ethereum.providers.find((p) => p.isTrust);
        } else if (window.ethereum?.isTrust) {
          // Single wallet and it's Trust Wallet
          trustProvider = window.ethereum;
        }

        if (!trustProvider) {
          // Fall back to WalletConnect (Trust Wallet supports it)
          alert(
            "Trust Wallet not detected. Opening WalletConnect for mobile connection..."
          );
          await connectWalletConnect();
          return;
        }
      }

      // Clear previous wallet state before connecting
      resetWalletState();

      // Switch to BSC first
      await switchToBsc(trustProvider);

      const web3Provider = new ethers.providers.Web3Provider(trustProvider);
      await web3Provider.send("eth_requestAccounts", []);
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();
      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      setWalletType(WALLET_TYPES.TRUST_WALLET);
      localStorage.setItem(LAST_WALLET_KEY, WALLET_TYPES.TRUST_WALLET);
      const gameContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        web3Signer
      );
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, web3Signer);
      setContract(gameContract);
      setTokenContract(token);
      await loadData(token, gameContract, address, web3Provider);
      setShowWalletModal(false);
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to connect Trust Wallet: " + error.message);
    }
  };

  const connectWalletConnect = async () => {
    try {
      // Clear previous wallet state before connecting
      resetWalletState();

      const EthereumProvider = (
        await import("@walletconnect/ethereum-provider")
      ).default;
      if (WALLETCONNECT_PROJECT_ID === "YOUR_WALLETCONNECT_PROJECT_ID") {
        alert("Please set WALLETCONNECT_PROJECT_ID");
        return;
      }
      const wc = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [BSC_CHAIN_ID],
        optionalChains: [1, BSC_CHAIN_ID],
        rpcMap: {
          [BSC_CHAIN_ID]: BSC_RPC_URL,
          1: "https://eth.llamarpc.com",
        },
        showQrModal: true,
        metadata: {
          name: "Baby Big Five Spin",
          description:
            "Win BBFT tokens by spinning the wheel! Play now and win big prizes.",
          url: window.location.origin,
          icons: [`${window.location.origin}/BBFT_LOGO.jpg`],
        },
        methods: [
          "eth_sendTransaction",
          "personal_sign",
          "eth_signTypedData",
          "wallet_switchEthereumChain",
          "wallet_addEthereumChain",
        ],
      });
      await wc.enable();

      // Check and request BSC network switch if needed
      const currentChainId = await wc.request({ method: "eth_chainId" });

      if (parseInt(currentChainId, 16) !== BSC_CHAIN_ID) {
        try {
          await wc.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${BSC_CHAIN_ID.toString(16)}` }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await wc.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: `0x${BSC_CHAIN_ID.toString(16)}`,
                  chainName: "BNB Smart Chain",
                  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
                  rpcUrls: [BSC_RPC_URL],
                  blockExplorerUrls: ["https://bscscan.com"],
                },
              ],
            });
          } else {
            alert(
              "Please switch to BNB Smart Chain (BSC) in your wallet to continue."
            );
          }
        }
      }

      // Create provider after ensuring BSC chain - use 'any' network to handle chain switches
      const web3Provider = new ethers.providers.Web3Provider(wc, "any");
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();

      setWcProvider(wc);
      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      setWalletType(WALLET_TYPES.WALLETCONNECT);
      localStorage.setItem(LAST_WALLET_KEY, WALLET_TYPES.WALLETCONNECT);
      const gameContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        web3Signer
      );
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, web3Signer);
      setContract(gameContract);
      setTokenContract(token);
      await loadData(token, gameContract, address, web3Provider);
      setShowWalletModal(false);
      wc.on("disconnect", disconnectWallet);
    } catch (error) {
      console.error("Error:", error);
      alert("WalletConnect failed. Try MetaMask or Trust Wallet.");
    }
  };

  const disconnectWallet = () => {
    wcProvider?.disconnect();
    setWcProvider(null);
    setProvider(null);
    setSigner(null);
    setAccount("");
    setContract(null);
    setTokenContract(null);
    setBnbBalance("0");
    setBalance("0");
    setWalletType(null);
    localStorage.removeItem(LAST_WALLET_KEY);
  };

  const handleWalletSelect = (w) => {
    if (w === "metamask") connectMetaMask();
    else if (w === "trustwallet") connectTrustWallet();
    else connectWalletConnect();
  };

  // Fetch BBFT price from multiple sources
  const fetchBbftPrice = async () => {
    try {
      // Try PancakeSwap API first
      const response = await fetch(
        `https://api.pancakeswap.info/api/v2/tokens/${TOKEN_ADDRESS}`
      );
      const data = await response.json();
      if (data.data?.price) {
        setBbftPrice(parseFloat(data.data.price) || 0);
        return;
      }
    } catch (error) {
      console.log("PancakeSwap API failed, trying alternative...");
    }

    // Fallback: Try DexScreener API
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`
      );
      const data = await response.json();
      if (data.pairs && data.pairs.length > 0) {
        // Find BSC pair
        const bscPair = data.pairs.find((pair) => pair.chainId === "bsc");
        if (bscPair && bscPair.priceUsd) {
          setBbftPrice(parseFloat(bscPair.priceUsd) || 0);
          return;
        }
      }
    } catch (error) {
      console.log("DexScreener API failed");
    }

    // If all APIs fail, set to 0
    setBbftPrice(0);
  };

  // Fetch BNB price from Binance API
  const fetchBnbPrice = async () => {
    try {
      const response = await fetch(
        "https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT"
      );
      const data = await response.json();
      if (data.price) {
        setBnbPrice(parseFloat(data.price) || 0);
      }
    } catch {
      // Silently fail - price display will show $0
    }
  };

  // Fetch prices on mount and refresh every 60 seconds
  useEffect(() => {
    fetchBbftPrice();
    fetchBnbPrice();
    const priceInterval = setInterval(() => {
      fetchBbftPrice();
      fetchBnbPrice();
    }, 60000);
    return () => clearInterval(priceInterval);
  }, []);

  const loadData = async (
    token,
    gameContract,
    address,
    web3Provider = provider
  ) => {
    try {
      // Fetch native BNB balance alongside token balance
      const [bal, allowance, nativeBalance] = await Promise.all([
        token.balanceOf(address).catch(() => ethers.BigNumber.from(0)),
        token
          .allowance(address, CONTRACT_ADDRESS)
          .catch(() => ethers.BigNumber.from(0)),
        web3Provider
          ?.getBalance(address)
          .catch(() => ethers.BigNumber.from(0)) ||
          Promise.resolve(ethers.BigNumber.from(0)),
      ]);

      setBalance(ethers.utils.formatEther(bal));
      setBnbBalance(
        parseFloat(ethers.utils.formatEther(nativeBalance)).toFixed(4)
      );
      setNeedsApproval(parseFloat(ethers.utils.formatEther(allowance)) < 10000);
      const [spinInfo, usageStats, winners, tiers, contractBal, cost] =
        await Promise.all([
          gameContract.getPlayerSpinInfo(address),
          gameContract.getPlayerUsageStats(address),
          gameContract.getRecentWinners(5).catch(() => []),
          gameContract.getAllPrizeTiers().catch(() => []),
          gameContract
            .getContractBalance()
            .catch(() => ethers.BigNumber.from(0)),
          gameContract
            .getSpinCost()
            .catch(() => ethers.utils.parseEther("2000")),
        ]);
      setDepositedAmount(ethers.utils.formatEther(spinInfo.depositedAmount));
      setContractBalance(ethers.utils.formatEther(contractBal));
      setSpinCost(ethers.utils.formatEther(cost));
      setPlayerInfo({
        totalSpinsAllowance: spinInfo.totalSpinsAllowance.toNumber(),
        availableSpins: spinInfo.availableSpins.toNumber(),
        totalSpinsUsed: spinInfo.totalSpinsUsed.toNumber(),
        totalWinnings: ethers.utils.formatEther(usageStats.totalWinnings),
      });
      setRecentWinners(
        winners.map((w) => ({
          player: w.player,
          prizeAmount: ethers.utils.formatEther(w.prizeAmount),
          tierIndex: w.tierIndex,
          timestamp: new Date(w.timestamp.toNumber() * 1000),
        }))
      );
      setPrizeTiers(
        tiers.map((t) => ({
          prizeAmount: ethers.utils.formatEther(t.prizeAmount),
          probability: t.probability / 100,
          name: t.name,
        }))
      );
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  // Refresh balances periodically (every 15 seconds when connected)
  useEffect(() => {
    if (!tokenContract || !contract || !account || !provider) return;

    const refreshInterval = setInterval(() => {
      loadData(tokenContract, contract, account, provider);
    }, 15000);

    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenContract, contract, account, provider]);

  // Auto-reconnect on page load
  useEffect(() => {
    const lastWallet = localStorage.getItem(LAST_WALLET_KEY);
    if (!lastWallet || account) return;

    const attemptReconnect = async () => {
      try {
        if (lastWallet === WALLET_TYPES.METAMASK) {
          // Find MetaMask provider properly
          let metamaskProvider = null;
          if (window.ethereum?.providers?.length) {
            metamaskProvider = window.ethereum.providers.find(
              (p) => p.isMetaMask === true && p.isTrust !== true
            );
          } else if (
            window.ethereum?.isMetaMask === true &&
            window.ethereum?.isTrust !== true
          ) {
            metamaskProvider = window.ethereum;
          }

          if (metamaskProvider) {
            const accounts = await metamaskProvider.request({
              method: "eth_accounts",
            });
            if (accounts.length > 0) {
              await connectMetaMask();
            }
          }
        } else if (lastWallet === WALLET_TYPES.TRUST_WALLET) {
          // Find Trust Wallet provider properly
          let trustProvider = null;
          if (window.trustwallet) {
            trustProvider = window.trustwallet;
          } else if (window.ethereum?.providers?.length) {
            trustProvider = window.ethereum.providers.find((p) => p.isTrust);
          } else if (window.ethereum?.isTrust) {
            trustProvider = window.ethereum;
          }

          if (trustProvider) {
            const accounts = await trustProvider.request({
              method: "eth_accounts",
            });
            if (accounts.length > 0) {
              await connectTrustWallet();
            }
          }
        } else if (lastWallet === WALLET_TYPES.WALLETCONNECT) {
          // Try to restore WalletConnect session
          const EthereumProvider = (
            await import("@walletconnect/ethereum-provider")
          ).default;
          const wc = await EthereumProvider.init({
            projectId: WALLETCONNECT_PROJECT_ID,
            chains: [BSC_CHAIN_ID],
            optionalChains: [1, BSC_CHAIN_ID],
            rpcMap: {
              [BSC_CHAIN_ID]: BSC_RPC_URL,
              1: "https://eth.llamarpc.com",
            },
            showQrModal: false, // Don't show modal on auto-reconnect
            metadata: {
              name: "Baby Big Five Spin",
              description:
                "Win BBFT tokens by spinning the wheel! Play now and win big prizes.",
              url: window.location.origin,
              icons: [`${window.location.origin}/BBFT_LOGO.jpg`],
            },
            methods: [
              "eth_sendTransaction",
              "personal_sign",
              "eth_signTypedData",
              "wallet_switchEthereumChain",
              "wallet_addEthereumChain",
            ],
          });

          // Check if there's an existing session
          if (wc.session) {
            const web3Provider = new ethers.providers.Web3Provider(wc, "any");
            const web3Signer = web3Provider.getSigner();
            const address = await web3Signer.getAddress();

            setWcProvider(wc);
            setProvider(web3Provider);
            setSigner(web3Signer);
            setAccount(address);
            setWalletType(WALLET_TYPES.WALLETCONNECT);

            const gameContract = new ethers.Contract(
              CONTRACT_ADDRESS,
              CONTRACT_ABI,
              web3Signer
            );
            const token = new ethers.Contract(
              TOKEN_ADDRESS,
              TOKEN_ABI,
              web3Signer
            );
            setContract(gameContract);
            setTokenContract(token);

            await loadData(token, gameContract, address, web3Provider);

            wc.on("disconnect", disconnectWallet);
          } else {
            localStorage.removeItem(LAST_WALLET_KEY);
          }
        }
      } catch {
        localStorage.removeItem(LAST_WALLET_KEY);
      }
    };

    attemptReconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to check and switch to BSC network
  const ensureBscNetwork = async () => {
    if (!provider) return false;
    try {
      const network = await provider.getNetwork();
      if (network.chainId !== BSC_CHAIN_ID) {
        // Try to switch to BSC
        try {
          await window.ethereum?.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${BSC_CHAIN_ID.toString(16)}` }],
          });
          return true;
        } catch (switchError) {
          // Chain not added, try to add it
          if (switchError.code === 4902) {
            await window.ethereum?.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: `0x${BSC_CHAIN_ID.toString(16)}`,
                  chainName: "BNB Smart Chain",
                  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
                  rpcUrls: [BSC_RPC_URL],
                  blockExplorerUrls: ["https://bscscan.com"],
                },
              ],
            });
            return true;
          }
          alert("Please switch to BNB Smart Chain (BSC) network to continue.");
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("Network check failed:", error);
      return false;
    }
  };

  const handleDeposit = async (amount) => {
    if (!contract || !tokenContract) return;
    try {
      // Ensure we're on BSC network
      const onBsc = await ensureBscNetwork();
      if (!onBsc) return;

      const depositAmount = ethers.utils.parseEther(amount);
      const currentAllowance = await tokenContract.allowance(
        account,
        CONTRACT_ADDRESS
      );
      if (currentAllowance.lt(depositAmount)) {
        const approveTx = await tokenContract.approve(
          CONTRACT_ADDRESS,
          ethers.constants.MaxUint256
        );
        await approveTx.wait();
      }
      const tx = await contract.deposit(depositAmount);
      await tx.wait();
      await loadData(tokenContract, contract, account);
      setShowDepositModal(false);
    } catch (error) {
      console.error("Error:", error);
      if (error.code === "CALL_EXCEPTION" && error.data === "0x") {
        alert(
          "Contract not found. Please make sure you are connected to BNB Smart Chain (BSC)."
        );
      } else {
        alert("Deposit failed: " + (error.reason || error.message));
      }
    }
  };

  const handleWithdraw = async (amount) => {
    if (!contract) return;
    try {
      const tx = await contract.withdraw(ethers.utils.parseEther(amount));
      await tx.wait();
      await loadData(tokenContract, contract, account);
      setShowDepositModal(false);
    } catch (error) {
      console.error("Error:", error);
      alert("Withdraw failed: " + (error.reason || error.message));
    }
  };

  const spinWheel = async () => {
    if (!contract || isSpinning) return;
    setIsSpinning(true);
    setLastWin(null);
    try {
      const tx = await contract.spin();
      const receipt = await tx.wait();
      const event = receipt.events?.find((e) => e.event === "SpinCompleted");
      if (event) {
        const tierIndex = event.args.tierIndex.toNumber();
        const prizeAmount = ethers.utils.formatEther(event.args.prizeAmount);
        const segAngle = 360 / prizeTiers.length;
        const targetAngle = tierIndex * segAngle + segAngle / 2;
        const spins = 5 + Math.floor(Math.random() * 3);
        setRotation((r) => r - (r % 360) + spins * 360 + (360 - targetAngle));
        setTimeout(
          () =>
            setLastWin({
              tier: prizeTiers[tierIndex]?.name || `Prize ${tierIndex}`,
              amount: prizeAmount,
            }),
          3000
        );
      }
      await loadData(tokenContract, contract, account);
    } catch (error) {
      console.error("Error:", error);
      alert("Spin failed: " + (error.reason || error.message));
    } finally {
      setTimeout(() => setIsSpinning(false), 3500);
    }
  };

  useEffect(() => {
    if (tokenContract && contract && account)
      loadData(tokenContract, contract, account);
  }, [tokenContract, contract, account]);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <WalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onSelectWallet={handleWalletSelect}
        isMobileDevice={isMobile()}
      />
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onDeposit={handleDeposit}
        onWithdraw={handleWithdraw}
        balance={balance}
        depositedAmount={depositedAmount}
        needsApproval={needsApproval}
        spinCost={spinCost}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/BBFT_LOGO.jpg"
              alt="BBFT Logo"
              className="w-12 h-12 rounded-xl object-cover"
            />
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
              <Wallet className="w-5 h-5" /> Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-xl">
                <span className="text-orange-500 font-semibold">
                  {formatNumber(balance)} BBFT
                </span>
              </div>
              <div className="bg-gray-900 px-4 py-2 rounded-xl">
                <span className="text-yellow-500 font-semibold">
                  {bnbBalance} BNB
                </span>
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

        {/* Prize Pool + Buy/Sell */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-2xl p-6 border border-blue-700">
            <p className="text-blue-300 text-sm mb-1">🏆 Prize Pool</p>
            <p className="text-4xl font-bold">
              {formatNumber(contractBalance)}
            </p>
            <p className="text-blue-300 text-xs mt-1">BBFT available</p>
            {/* {bbftPrice > 0 && <p className="text-blue-200 text-sm mt-1">≈ ${formatNumber(parseFloat(contractBalance) * bbftPrice)} USD</p>} */}
            <div className="flex">
              {bbftPrice > 0 && (
                <p className="text-blue-200 text-sm mt-1 ml-auto">
                 ${formatNumber(parseFloat(contractBalance) * bbftPrice)} USD
                </p>
              )}
            </div>
          </div>
          <a
            href={BUY_TOKEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-green-900 to-green-800 rounded-2xl p-6 border border-green-700 hover:from-green-800 hover:to-green-700 transition group"
          >
            <p className="text-green-300 text-sm mb-1">💰 Buy BBFT</p>
            <p className="text-2xl font-bold flex items-center gap-2">
              Buy Tokens{" "}
              <ExternalLink className="w-5 h-5 group-hover:translate-x-1 transition" />
            </p>
            <p className="text-green-300 text-xs mt-1">
              Get BBFT on Pancake Swap
            </p>
          </a>
          <a
            href={SELL_TOKEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-red-900 to-red-800 rounded-2xl p-6 border border-red-700 hover:from-red-800 hover:to-red-700 transition group"
          >
            <p className="text-red-300 text-sm mb-1">💸 Sell BBFT</p>
            <p className="text-2xl font-bold flex items-center gap-2">
              Sell Tokens{" "}
              <ExternalLink className="w-5 h-5 group-hover:translate-x-1 transition" />
            </p>
            <p className="text-red-300 text-xs mt-1">
              Swap BBFT on Pancake Swap
            </p>
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 rounded-2xl p-4 md:p-6">
            <p className="text-gray-400 text-sm mb-1">Wallet</p>
            <p className="text-xl md:text-3xl font-bold">
              {formatNumber(balance)}
            </p>
            <p className="text-gray-500 text-xs">BBFT</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 md:p-6">
            <p className="text-gray-400 text-sm mb-1">Deposited</p>
            <p className="text-xl md:text-3xl font-bold text-orange-500">
              {formatNumber(depositedAmount)}
            </p>
            <button
              onClick={() => setShowDepositModal(true)}
              className="text-orange-500 text-xs hover:underline"
            >
              Manage →
            </button>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 md:p-6">
            <p className="text-gray-400 text-sm mb-1">Spins</p>
            <p className="text-xl md:text-3xl font-bold text-green-500">
              {playerInfo.availableSpins}
            </p>
            <p className="text-gray-500 text-xs">
              of {playerInfo.totalSpinsAllowance}
            </p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 md:p-6">
            <p className="text-gray-400 text-sm mb-1">Winnings</p>
            <p className="text-xl md:text-3xl font-bold text-blue-500">
              {formatNumber(playerInfo.totalWinnings)}
            </p>
            <p className="text-gray-500 text-xs">All time</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Wheel */}
          <div className="lg:col-span-2 bg-gray-900 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold mb-6">Spin the Wheel!</h2>
            <div className="relative w-full max-w-md mx-auto mb-8">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[16px] border-l-transparent border-r-transparent border-t-orange-500"></div>
              </div>
              <svg
                viewBox="0 0 200 200"
                className="w-full h-auto"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: isSpinning
                    ? "transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
                    : "none",
                }}
              >
                <circle
                  cx="100"
                  cy="100"
                  r="95"
                  fill="#1F2937"
                  stroke="#F97316"
                  strokeWidth="3"
                />
                {prizeTiers.map((tier, i) => {
                  const segAngle = 360 / prizeTiers.length;
                  const startRad = ((i * segAngle - 90) * Math.PI) / 180;
                  const endRad = (((i + 1) * segAngle - 90) * Math.PI) / 180;
                  const x1 = 100 + 95 * Math.cos(startRad),
                    y1 = 100 + 95 * Math.sin(startRad);
                  const x2 = 100 + 95 * Math.cos(endRad),
                    y2 = 100 + 95 * Math.sin(endRad);
                  const midRad = (((i + 0.5) * segAngle - 90) * Math.PI) / 180;
                  const tx = 100 + 65 * Math.cos(midRad),
                    ty = 100 + 65 * Math.sin(midRad);
                  const label =
                    tier.prizeAmount === "0"
                      ? "Try Again"
                      : formatNumber(tier.prizeAmount);
                  return (
                    <g key={i}>
                      <path
                        d={`M 100 100 L ${x1} ${y1} A 95 95 0 0 1 ${x2} ${y2} Z`}
                        fill={PRIZE_COLORS[i % PRIZE_COLORS.length]}
                        stroke="#000"
                        strokeWidth="1.5"
                      />
                      <text
                        x={tx}
                        y={ty}
                        fill="white"
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${
                          (i + 0.5) * segAngle
                        }, ${tx}, ${ty})`}
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}
                <circle
                  cx="100"
                  cy="100"
                  r="20"
                  fill="#F97316"
                  stroke="#000"
                  strokeWidth="2"
                />
                <text
                  x="100"
                  y="104"
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  SPIN
                </text>
              </svg>
            </div>
            {lastWin && (
              <div className="bg-green-500/20 border border-green-500 rounded-xl p-4 mb-6 text-center">
                <p className="text-green-400 font-bold text-lg">
                  🎉 Won {formatNumber(lastWin.amount)} BBFT!
                </p>
                <p className="text-gray-300 text-sm">{lastWin.tier}</p>
              </div>
            )}
            {!account ? (
              <button
                onClick={() => setShowWalletModal(true)}
                className="w-full bg-orange-500 hover:bg-orange-600 py-4 rounded-xl font-bold text-lg transition"
              >
                Connect Wallet to Spin
              </button>
            ) : parseFloat(depositedAmount) < 10000 &&
              playerInfo.availableSpins === 0 ? (
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
                    <Loader2 className="w-5 h-5 animate-spin" /> Spinning...
                  </>
                ) : playerInfo.availableSpins === 0 ? (
                  "No Spins - Deposit More!"
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" /> SPIN (
                    {playerInfo.availableSpins} left)
                  </>
                )}
              </button>
            )}
            <p className="text-center text-gray-400 text-sm mt-3">
              💰 Each spin costs {formatNumber(spinCost)} BBFT | 1% fee on
              winnings
            </p>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-orange-500" /> Prize Odds
              </h3>
              <div className="space-y-3">
                {prizeTiers.map((tier, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            PRIZE_COLORS[i % PRIZE_COLORS.length],
                        }}
                      ></div>
                      <span className="text-sm">{tier.name}</span>
                    </div>
                    <span className="text-orange-500 font-bold text-sm">
                      {tier.probability}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-green-500" /> How It Works
              </h3>
              <div className="space-y-3 text-sm">
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Deposit 10k BBFT</span>
                    <span className="text-green-500 font-bold">5 Spins</span>
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Deposit 20k BBFT</span>
                    <span className="text-green-500 font-bold">10 Spins</span>
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Win Prizes</span>
                    <span className="text-yellow-500 font-bold">1% Fee</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowDepositModal(true)}
                className="w-full mt-4 bg-orange-500 hover:bg-orange-600 py-2 rounded-lg font-semibold text-sm transition"
              >
                Manage Deposit
              </button>
            </div>

            <div className="bg-gray-900 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" /> Recent Winners
              </h3>
              <div className="space-y-3">
                {recentWinners.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No winners yet! 🎉
                  </p>
                ) : (
                  recentWinners.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-gray-800 rounded-lg p-3"
                    >
                      <div>
                        <p className="font-mono text-sm">
                          {formatAddress(w.player)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {getTimeSince(w.timestamp)}
                        </p>
                      </div>
                      <p className="text-orange-500 font-bold">
                        {formatNumber(w.prizeAmount)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 bg-gray-900 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4">🚀 Quick Start</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-2xl mb-2">1️⃣</div>
              <h4 className="font-semibold mb-1">Connect Wallet</h4>
              <p className="text-sm text-gray-400">
                Use MetaMask or WalletConnect
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-2xl mb-2">2️⃣</div>
              <h4 className="font-semibold mb-1">Deposit BBFT</h4>
              <p className="text-sm text-gray-400">10k BBFT = 5 spins</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-2xl mb-2">3️⃣</div>
              <h4 className="font-semibold mb-1">Spin & Win</h4>
              <p className="text-sm text-gray-400">Win up to 5,000 BBFT!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
