# Modular Multi-Game Platform Structure

## Overview
Your Baby BFT platform now has a clean, modular architecture that makes it easy to add new games while sharing wallet connection across all games.

## Folder Structure

```
src/
├── constants/
│   └── config.js              # All configuration, ABIs, addresses
├── context/
│   └── WalletContext.jsx       # Shared wallet connection logic
├── components/
│   ├── Header.jsx             # Shared header with wallet info
│   ├── WalletModal.jsx        # Wallet connection modal
│   └── TabNavigation.jsx      # Tab switcher component
├── games/
│   ├── SpinGame_Legacy.jsx    # Your current spin game (backed up)
│   └── SweepstakeGame.jsx     # New sweepstakes game
├── utils/
│   └── formatters.js          # Formatting utilities
├── App.jsx                    # Original spin game (current version)
└── AppWithTabs.jsx            # New multi-game app with tabs
```

## Key Files

### Configuration (`constants/config.js`)
- Contract addresses (TOKEN_ADDRESS, CONTRACT_ADDRESS)
- Network settings (BSC_CHAIN_ID, BSC_RPC_URL)
- ABIs (CONTRACT_ABI, TOKEN_ABI)
- UI constants (PRIZE_COLORS)

### Wallet Context (`context/WalletContext.jsx`)
Provides shared wallet functionality:
- `account` - Connected wallet address
- `provider` - Ethers provider
- `signer` - Ethers signer
- `bnbBalance` - BNB balance
- `connectMetaMask()` - Connect MetaMask
- `connectTrustWallet()` - Connect Trust Wallet
- `connectWalletConnect()` - Connect via WalletConnect
- `disconnectWallet()` - Disconnect wallet

### Shared Components

#### Header (`components/Header.jsx`)
- Displays app title and logo
- Shows wallet connection status
- Displays BBFT and BNB balances with USD values
- Connect/Disconnect buttons

#### WalletModal (`components/WalletModal.jsx`)
- Modal for selecting wallet type
- Handles MetaMask, Trust Wallet, WalletConnect
- Auto-detects mobile vs desktop

#### TabNavigation (`components/TabNavigation.jsx`)
- Tab switcher for different games
- Highlights active tab
- Easy to extend with new tabs

## How to Switch to Multi-Game Version

### Option 1: Test First (Recommended)
```bash
# Edit src/main.jsx, change line 4:
import App from './AppWithTabs.jsx'

# Start dev server:
npm run dev
```

### Option 2: Make it Permanent
```bash
# Rename files:
mv src/App.jsx src/App_SpinOnly.jsx
mv src/AppWithTabs.jsx src/App.jsx

# Already done - just run:
npm run dev
```

## Using the Wallet Context in Games

Any game component can access the shared wallet:

```jsx
import { useWallet } from '../context/WalletContext';

function MyGame() {
  const { account, provider, signer } = useWallet();

  if (!account) {
    return <div>Please connect wallet</div>;
  }

  return <div>Game content for {account}</div>;
}
```

## Adding a New Game

### Step 1: Create Game Component

Create `src/games/NewGame.jsx`:

```jsx
import React from 'react';
import { useWallet } from '../context/WalletContext';

export default function NewGame() {
  const { account } = useWallet();

  if (!account) {
    return <div className="text-center py-20">
      <p>Connect wallet to play</p>
    </div>;
  }

  return (
    <div>
      <h2>New Game</h2>
      {/* Your game logic here */}
    </div>
  );
}
```

### Step 2: Add Tab

In `src/AppWithTabs.jsx`:

```jsx
import NewGame from './games/NewGame';

const TABS = [
  { id: 'spin', label: 'Spin Game', icon: '🎰' },
  { id: 'sweepstake', label: 'Sweepstakes', icon: '🎫' },
  { id: 'newgame', label: 'New Game', icon: '🎮' }  // Add this
];

// In the render:
{activeTab === 'spin' && <SpinGameLegacy />}
{activeTab === 'sweepstake' && <SweepstakeGame />}
{activeTab === 'newgame' && <NewGame />}  // Add this
```

That's it! Your new game now shares the wallet connection.

## Current Games

### 🎰 Spin Game
- Full spin-to-win functionality
- Deposit BBFT to get spins
- Win prizes on the wheel
- **Status**: Fully functional (using legacy code)

### 🎫 Sweepstakes
- Coming soon placeholder
- Buy tickets for draws
- Automatic prize distribution
- **Status**: UI ready, awaiting implementation

## Benefits

✅ **Shared Wallet** - Connect once, play all games
✅ **Modular** - Each game in its own file
✅ **Scalable** - Easy to add unlimited games
✅ **Clean Code** - Utilities and config separated
✅ **Reusable Components** - Header, modals shared

## Development Tips

1. **Add new games in `src/games/`**
2. **Shared utilities go in `src/utils/`**
3. **Shared components in `src/components/`**
4. **Configuration in `src/constants/`**
5. **Use WalletContext for all wallet operations**

## Next Steps

1. Test multi-game platform
2. Refactor SpinGame to use WalletContext (optional)
3. Implement Sweepstakes logic
4. Add more games as needed

## File Sizes

- **App.jsx (original)**: 1437 lines
- **AppWithTabs.jsx**: ~30 lines
- **WalletContext.jsx**: ~340 lines
- **Each game**: Independent, self-contained

The modular structure makes the codebase much easier to maintain and extend!
