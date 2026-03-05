import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  WALLETCONNECT_PROJECT_ID,
  BSC_CHAIN_ID,
  BSC_TESTNET_CHAIN_ID,
  BSC_RPC_URL,
  BSC_TESTNET_RPC_URL,
  WALLET_TYPES,
  LAST_WALLET_KEY,
  NETWORK_CONFIGS,
  NETWORK_KEYS,
  DEFAULT_NETWORK_KEY,
  LAST_NETWORK_KEY
} from '../constants/config';
import { isMobile } from '../utils/formatters';

const WalletContext = createContext();

const OPTIONAL_WALLETCONNECT_CHAINS = [1, BSC_CHAIN_ID, BSC_TESTNET_CHAIN_ID];
const WALLETCONNECT_RPC_MAP = {
  [BSC_CHAIN_ID]: BSC_RPC_URL,
  [BSC_TESTNET_CHAIN_ID]: BSC_TESTNET_RPC_URL,
  1: 'https://eth.llamarpc.com'
};

const getStoredNetwork = () => {
  if (typeof window === 'undefined') return DEFAULT_NETWORK_KEY;
  const saved = localStorage.getItem(LAST_NETWORK_KEY);
  return NETWORK_CONFIGS[saved] ? saved : DEFAULT_NETWORK_KEY;
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [wcProvider, setWcProvider] = useState(null);
  const [bnbBalance, setBnbBalance] = useState('0');
  const [walletType, setWalletType] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState(getStoredNetwork);

  const selectedNetworkConfig = NETWORK_CONFIGS[selectedNetwork] || NETWORK_CONFIGS[DEFAULT_NETWORK_KEY];
  const availableNetworks = Object.values(NETWORK_CONFIGS);

  const updateNetworkPreference = (networkKey) => {
    if (!NETWORK_CONFIGS[networkKey]) return;
    setSelectedNetwork(networkKey);
    localStorage.setItem(LAST_NETWORK_KEY, networkKey);
  };

  const refreshNativeBalance = async (activeProvider = provider, activeAccount = account) => {
    if (!activeProvider || !activeAccount) {
      setBnbBalance('0');
      return;
    }

    try {
      const nativeBalance = await activeProvider.getBalance(activeAccount);
      setBnbBalance(parseFloat(ethers.utils.formatEther(nativeBalance)).toFixed(4));
    } catch {
      setBnbBalance('0');
    }
  };

  const switchToNetwork = async (ethereumProvider, networkConfig = selectedNetworkConfig) => {
    try {
      await ethereumProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${networkConfig.chainId.toString(16)}` }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await ethereumProvider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${networkConfig.chainId.toString(16)}`,
            chainName: networkConfig.chainName,
            nativeCurrency: networkConfig.nativeCurrency,
            rpcUrls: [networkConfig.rpcUrl],
            blockExplorerUrls: [networkConfig.blockExplorerUrl]
          }],
        });
      } else {
        throw switchError;
      }
    }
  };

  const resetWalletState = () => {
    wcProvider?.disconnect();
    setWcProvider(null);
    setProvider(null);
    setSigner(null);
    setAccount('');
    setBnbBalance('0');
    setWalletType(null);
  };

  const connectMetaMask = async () => {
    try {
      let metamaskProvider = null;

      if (isMobile()) {
        if (window.ethereum?.isMetaMask && !window.ethereum?.isTrust) {
          metamaskProvider = window.ethereum;
        } else {
          await connectWalletConnect();
          return;
        }
      } else {
        if (window.ethereum?.providers?.length) {
          for (const p of window.ethereum.providers) {
            if (p.isMetaMask && !p.isTrust) {
              metamaskProvider = p;
              break;
            }
          }
        }

        if (!metamaskProvider && window.ethereum?.isMetaMask && !window.ethereum?.isTrust) {
          metamaskProvider = window.ethereum;
        }

        if (!metamaskProvider) {
          if (window.ethereum) {
            alert('MetaMask not detected. Another wallet is installed.');
          } else {
            alert('No wallet detected. Please install MetaMask.');
          }
          return;
        }
      }

      resetWalletState();
      await switchToNetwork(metamaskProvider, selectedNetworkConfig);

      const web3Provider = new ethers.providers.Web3Provider(metamaskProvider, 'any');
      await web3Provider.send('eth_requestAccounts', []);
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      setWalletType(WALLET_TYPES.METAMASK);
      localStorage.setItem(LAST_WALLET_KEY, WALLET_TYPES.METAMASK);
      await refreshNativeBalance(web3Provider, address);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to connect: ' + error.message);
    }
  };

  const connectTrustWallet = async () => {
    try {
      let trustProvider = null;

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
        if (window.trustwallet) {
          trustProvider = window.trustwallet;
        } else if (window.ethereum?.providers?.length) {
          trustProvider = window.ethereum.providers.find(p => p.isTrust);
        } else if (window.ethereum?.isTrust) {
          trustProvider = window.ethereum;
        }

        if (!trustProvider) {
          alert('Trust Wallet not detected. Opening WalletConnect...');
          await connectWalletConnect();
          return;
        }
      }

      resetWalletState();
      await switchToNetwork(trustProvider, selectedNetworkConfig);

      const web3Provider = new ethers.providers.Web3Provider(trustProvider, 'any');
      await web3Provider.send('eth_requestAccounts', []);
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      setWalletType(WALLET_TYPES.TRUST_WALLET);
      localStorage.setItem(LAST_WALLET_KEY, WALLET_TYPES.TRUST_WALLET);
      await refreshNativeBalance(web3Provider, address);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to connect Trust Wallet: ' + error.message);
    }
  };

  const connectWalletConnect = async () => {
    try {
      resetWalletState();

      const EthereumProvider = (await import('@walletconnect/ethereum-provider')).default;
      const wc = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [selectedNetworkConfig.chainId],
        optionalChains: OPTIONAL_WALLETCONNECT_CHAINS,
        rpcMap: WALLETCONNECT_RPC_MAP,
        showQrModal: true,
        metadata: {
          name: 'Baby Big Five Games',
          description: 'Play games and win BBFT tokens!',
          url: window.location.origin,
          icons: [`${window.location.origin}/BBFT_LOGO.jpg`]
        },
        methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData', 'wallet_switchEthereumChain', 'wallet_addEthereumChain'],
      });
      await wc.enable();

      const currentChainId = await wc.request({ method: 'eth_chainId' });
      if (parseInt(currentChainId, 16) !== selectedNetworkConfig.chainId) {
        try {
          await wc.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${selectedNetworkConfig.chainId.toString(16)}` }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await wc.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${selectedNetworkConfig.chainId.toString(16)}`,
                chainName: selectedNetworkConfig.chainName,
                nativeCurrency: selectedNetworkConfig.nativeCurrency,
                rpcUrls: [selectedNetworkConfig.rpcUrl],
                blockExplorerUrls: [selectedNetworkConfig.blockExplorerUrl]
              }],
            });
          }
        }
      }

      const web3Provider = new ethers.providers.Web3Provider(wc, 'any');
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();

      setWcProvider(wc);
      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      setWalletType(WALLET_TYPES.WALLETCONNECT);
      localStorage.setItem(LAST_WALLET_KEY, WALLET_TYPES.WALLETCONNECT);
      await refreshNativeBalance(web3Provider, address);

      wc.on('disconnect', disconnectWallet);
    } catch (error) {
      console.error('Error:', error);
      alert('WalletConnect failed. Try MetaMask or Trust Wallet.');
    }
  };

  const disconnectWallet = () => {
    wcProvider?.disconnect();
    setWcProvider(null);
    setProvider(null);
    setSigner(null);
    setAccount('');
    setBnbBalance('0');
    setWalletType(null);
    localStorage.removeItem(LAST_WALLET_KEY);
  };

  const switchToSelectedNetwork = async () => {
    if (!account) return;

    const networkConfig = selectedNetworkConfig;
    try {
      if (walletType === WALLET_TYPES.WALLETCONNECT && wcProvider) {
        await switchToNetwork(wcProvider, networkConfig);
      } else {
        const activeProvider = provider?.provider || window.ethereum;
        if (activeProvider?.request) {
          await switchToNetwork(activeProvider, networkConfig);
        }
      }
      await refreshNativeBalance();
    } catch (error) {
      console.error('Network switch failed:', error);
      throw error;
    }
  };

  const setPreferredNetwork = async (networkKey) => {
    if (!NETWORK_CONFIGS[networkKey]) return;

    updateNetworkPreference(networkKey);

    if (!account) return;

    try {
      const networkConfig = NETWORK_CONFIGS[networkKey];
      if (walletType === WALLET_TYPES.WALLETCONNECT && wcProvider) {
        await switchToNetwork(wcProvider, networkConfig);
      } else {
        const activeProvider = provider?.provider || window.ethereum;
        if (activeProvider?.request) {
          await switchToNetwork(activeProvider, networkConfig);
        }
      }
      await refreshNativeBalance();
    } catch (error) {
      console.error('Failed to apply selected network:', error);
      throw error;
    }
  };

  // Auto-reconnect on mount
  useEffect(() => {
    const lastWallet = localStorage.getItem(LAST_WALLET_KEY);
    if (!lastWallet || account) return;

    const attemptReconnect = async () => {
      try {
        if (lastWallet === WALLET_TYPES.METAMASK) {
          let metamaskProvider = null;
          if (window.ethereum?.providers?.length) {
            metamaskProvider = window.ethereum.providers.find(p => p.isMetaMask === true && p.isTrust !== true);
          } else if (window.ethereum?.isMetaMask === true && window.ethereum?.isTrust !== true) {
            metamaskProvider = window.ethereum;
          }

          if (metamaskProvider) {
            const accounts = await metamaskProvider.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
              await connectMetaMask();
            }
          }
        } else if (lastWallet === WALLET_TYPES.TRUST_WALLET) {
          let trustProvider = null;
          if (window.trustwallet) {
            trustProvider = window.trustwallet;
          } else if (window.ethereum?.providers?.length) {
            trustProvider = window.ethereum.providers.find(p => p.isTrust);
          } else if (window.ethereum?.isTrust) {
            trustProvider = window.ethereum;
          }

          if (trustProvider) {
            const accounts = await trustProvider.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
              await connectTrustWallet();
            }
          }
        } else if (lastWallet === WALLET_TYPES.WALLETCONNECT) {
          const EthereumProvider = (await import('@walletconnect/ethereum-provider')).default;
          const wc = await EthereumProvider.init({
            projectId: WALLETCONNECT_PROJECT_ID,
            chains: [selectedNetworkConfig.chainId],
            optionalChains: OPTIONAL_WALLETCONNECT_CHAINS,
            rpcMap: WALLETCONNECT_RPC_MAP,
            showQrModal: false,
            metadata: {
              name: 'Baby Big Five Games',
              description: 'Play games and win BBFT tokens!',
              url: window.location.origin,
              icons: [`${window.location.origin}/BBFT_LOGO.jpg`]
            },
            methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData', 'wallet_switchEthereumChain', 'wallet_addEthereumChain'],
          });

          if (wc.session) {
            const web3Provider = new ethers.providers.Web3Provider(wc, 'any');
            const web3Signer = web3Provider.getSigner();
            const address = await web3Signer.getAddress();

            setWcProvider(wc);
            setProvider(web3Provider);
            setSigner(web3Signer);
            setAccount(address);
            setWalletType(WALLET_TYPES.WALLETCONNECT);
            await refreshNativeBalance(web3Provider, address);

            wc.on('disconnect', disconnectWallet);
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

  const value = {
    provider,
    signer,
    account,
    bnbBalance,
    walletType,
    selectedNetwork,
    selectedNetworkConfig,
    availableNetworks,
    connectMetaMask,
    connectTrustWallet,
    connectWalletConnect,
    disconnectWallet,
    setPreferredNetwork,
    switchToSelectedNetwork
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
