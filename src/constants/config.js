
// Contract addresses and configuration
export const SPIN_GAME_CONTRACT_ADDRESS = "0x4227FB372Ce815D8F14259bCf44bcf5937B489bc";
export const TOKEN_ADDRESS = "0xfB69e2d3d673A8DB9Fa74ffc036A8Cf641255769";
export const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
export const BSC_CHAIN_ID = 56;
export const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";

// BSC Testnet Configuration (for Sweepstake)
export const BSC_TESTNET_CHAIN_ID = 97;
export const BSC_TESTNET_RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545/";
export const SWEEPSTAKE_CONTRACT_ADDRESS = "0x7658008b09b91Cd67D7571471580d5056Bd57bd9";
export const SWEEPSTAKE_TOKEN_ADDRESS = "0xEd611a47eD426e26030e1b2780Bb6675576A51b7";

export const NETWORK_KEYS = {
  MAINNET: "mainnet",
  TESTNET: "testnet",
};

export const DEFAULT_NETWORK_KEY = NETWORK_KEYS.MAINNET;
export const LAST_NETWORK_KEY = "bbft_last_network";

export const NETWORK_CONFIGS = {
  [NETWORK_KEYS.MAINNET]: {
    key: NETWORK_KEYS.MAINNET,
    chainId: BSC_CHAIN_ID,
    chainName: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrl: BSC_RPC_URL,
    blockExplorerUrl: "https://bscscan.com",
    shortLabel: "Mainnet",
  },
  [NETWORK_KEYS.TESTNET]: {
    key: NETWORK_KEYS.TESTNET,
    chainId: BSC_TESTNET_CHAIN_ID,
    chainName: "BNB Smart Chain Testnet",
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    rpcUrl: BSC_TESTNET_RPC_URL,
    blockExplorerUrl: "https://testnet.bscscan.com",
    shortLabel: "Testnet",
  },
};

export const SWEEPSTAKE_DEPLOYMENTS = {
  [NETWORK_KEYS.MAINNET]: {
    contractAddress: import.meta.env.VITE_SWEEPSTAKE_MAINNET_CONTRACT_ADDRESS || "",
    tokenAddress: import.meta.env.VITE_SWEEPSTAKE_MAINNET_TOKEN_ADDRESS || "",
  },
  [NETWORK_KEYS.TESTNET]: {
    contractAddress: SWEEPSTAKE_CONTRACT_ADDRESS,
    tokenAddress: SWEEPSTAKE_TOKEN_ADDRESS,
  },
};

// URLs
export const BUY_TOKEN_URL = `https://pancakeswap.finance/swap?inputCurrency=${TOKEN_ADDRESS}`;
export const SELL_TOKEN_URL = `https://pancakeswap.finance/swap?inputCurrency=${TOKEN_ADDRESS}`;

// Wallet types
export const WALLET_TYPES = {
  METAMASK: 'metamask',
  TRUST_WALLET: 'trustwallet',
  WALLETCONNECT: 'walletconnect'
};

export const LAST_WALLET_KEY = 'bbft_last_wallet';

// Contract ABIs
export const SPIN_GAME_ABI = [
  "function spin() external returns (uint256)",
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function getPlayerSpinInfo(address player) external view returns (uint256 depositedAmount, uint256 totalSpinsAllowance, uint256 availableSpins, uint256 totalSpinsUsed)",
  "function getPlayerUsageStats(address player) external view returns (uint256 totalSpins, uint256 totalWinnings, uint256 lastSpinTime)",
  "function getRecentWinners(uint256 count) external view returns (tuple(address player, uint256 prizeAmount, uint256 feeAmount, uint256 tierIndex, uint256 timestamp, bytes32 requestId, uint256 randomSeed)[])",
  "function getContractBalance() external view returns (uint256)",
  "function getAllPrizeTiers() external view returns (tuple(uint256 prizeAmount, uint256 probability, string name)[])",
  "function getTotalFeesCollected() external view returns (uint256)",
  "function getTreasury() external view returns (address)",
  "function getSpinCost() external view returns (uint256)",
  "event SpinCompleted(address indexed player, uint256 indexed spinId, uint256 tierIndex, uint256 prizeAmount, uint256 feeAmount, uint256 timestamp, uint256 randomSeed)"
];

export const SWEEPSTAKE_ABI = [
  "function joinPool() external",
  "function requestWinner() external",
  "function withdrawPrize() external",
  "function canDistribute() external view returns (bool)",
  "function roundId() external view returns (uint256)",
  "function getParticipantCount() external view returns (uint256)",
  "function getParticipants() external view returns (address[])",
  "function getRoundTimeRemaining() external view returns (uint256)",
  "function claimableBalance(address) external view returns (uint256)",
  "function getRoundWinners(uint256) external view returns (address[])",
  "function getRoundResult(uint256) external view returns (address[], uint256, uint256, uint256, uint256)",
  "function prizePool() external view returns (uint256)",
  "function entryFee() external view returns (uint256)",
  "function paused() external view returns (bool)",
  "function version() external view returns (string)",
  "function admin() external view returns (address)",
];

export const TOKEN_ABI = [
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
];

// UI Constants
export const PRIZE_COLORS = ['#3B82F6', '#A855F7', '#EC4899', '#10B981', '#F59E0B', '#6B7280'];
