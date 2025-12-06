
// Contract addresses and configuration
export const SPIN_GAME_CONTRACT_ADDRESS = "0x4227FB372Ce815D8F14259bCf44bcf5937B489bc";
export const TOKEN_ADDRESS = "0xfB69e2d3d673A8DB9Fa74ffc036A8Cf641255769";
export const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
export const BSC_CHAIN_ID = 56;
export const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";

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

export const TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

// UI Constants
export const PRIZE_COLORS = ['#3B82F6', '#A855F7', '#EC4899', '#10B981', '#F59E0B', '#6B7280'];
