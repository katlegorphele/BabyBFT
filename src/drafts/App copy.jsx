import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, DollarSign, Zap, AlertCircle, CheckCircle, Target, BarChart3, Percent, RefreshCw, Layers, ArrowRight, Clock, Award } from 'lucide-react';
import { ethers } from 'ethers';
import Yields from './Yields.jsx';


import $u from './utils/$u.js';
import ERC20 from './contracts/abizar.json';
import Pendle_PT_25_SEP from './contracts/PT-25Sep.json';
import Morpho_ABI from './contracts/Morpho.json';
import Morpho_IRM from './contracts/Morpho_IRM.json';
import Ethena_SUSDE from './contracts/Ethena_stackedusde.json';
import Ethena_USDE from './contracts/Ethena_usde.json';
import axios from 'axios';

const App = () => {
  const [usdcAmount, setUsdcAmount] = useState('100');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [maxLoops, setMaxLoops] = useState(3);
  const [currentLoop, setCurrentLoop] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState('Ready to start');
  const [txHash, setTxHash] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [account, setAccount] = useState(null);
  const [loops, setLoops] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balances, setBalances] = useState({
    eth: '0',
    usdc: '0',
    usde: '0',
    susde: '0',
    ptSusde: '0'
  });
  const [rewards, setRewards] = useState({
    susdeRewards: '0',
    ptSusdeRewards: '0',
    ptExpirationDate: null
  });

  const [expire, setExpire] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState(0);
  




  // const [usdcBalance, setUsdcBalance] = useState("0.00");
  // const [usdeBalance, setUsdeBalance] = useState("0.00");
  // const [susdeBalance, setSUsdeBalance] = useState("0.00");
  // const [pendleBalance, setPendleBalance] = useState("0.00");

  const [usdcContract, setUsdcContract] = useState(null);
  const [usdeContract, setUsdeContract] = useState(null);
  const [susdeContract, setSUsdeContract] = useState(null);
  const [pendlePTContract, setPendlePTContract] = useState(null);
  const [morphoContract, setMorphoContract] = useState(null);
  // const [pendleContract, setPendleContract] = useState(null);
  // const [pendleV4Contract, setPendleV4Contract] = useState(null);


  // const [router, setRouter] = useState(null);
  // const [amount, setAmount] = useState('');





  // Contract addresses (Ethereum mainnet)
  const contracts = {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDE: '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3',
    SUSDE: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497',
    PT_SUSDE: '0x9F56094C450763769BA0EA9Fe2876070c0fD5F77',
    Morpho: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    Morpho_market: '0x85C7F4374F3A403B36D54CC284983B2B02BBD8581EE0F3C36494447B87D9FCAB',
    IRM: '0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC'
  };

  const steps = [
    { name: 'Swap USDC → USDe', icon: '🔄' },
    { name: 'Stake USDe → sUSDe', icon: '🏦' },
    { name: 'Swap sUSDe → PT-sUSDe', icon: '⚡' },
    { name: 'Supply PT & Borrow USDC', icon: '💰' }
  ];



    // Real yield rates (will be fetched from contracts)
    const [yieldRates, setYieldRates] = useState({
      susdeApy: 0,
      ptSusdeImpliedApy: 0,
      morphoBorrowApy: 0,
      lltv: 0,
      lastUpdated: null
    });

  // Check if MetaMask is installed
  const isMetaMaskInstalled = () => {
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
  };

  // Get token balance
  const getTokenBalance = async (tokenAddress, userAddress, decimals = 18) => {
    if (!window.ethereum || !userAddress) return '0';
    
    try {
      // ERC20 balanceOf function selector
      const data = `0x70a08231000000000000000000000000${userAddress.slice(2)}`;
      
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{
          to: tokenAddress,
          data: data
        }, 'latest']
      });

      // Convert hex result to decimal and format
      const balance = parseInt(result, 16) / Math.pow(10, decimals);
      return balance.toFixed(4);
    } catch (error) {
      console.error(`Error fetching balance for ${tokenAddress}:`, error);
      return '0';
    }
  };

  // Get ETH balance
  const getETHBalance = async (userAddress) => {
    if (!window.ethereum || !userAddress) return '0';
    
    try {
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [userAddress, 'latest']
      });
      
      // Convert from wei to ETH
      const ethBalance = parseInt(balance, 16) / Math.pow(10, 18);
      return ethBalance.toFixed(4);
    } catch (error) {
      console.error('Error fetching ETH balance:', error);
      return '0';
    }
  };




 

  




  // Fetch real Morpho borrow rate using contracts
    const fetchMorphoBorrowRate = async () => {
      try {
        if (!morphoContract) return null;
        
        console.log('Fetching Morpho data...');
        
        // Get market parameters
        const marketParams = await morphoContract.idToMarketParams(contracts.Morpho_market);
        const rawLLTV = marketParams.lltv;
        const lltvReadable = Number(ethers.utils.formatUnits(rawLLTV, 18));
        
        console.log("LLTV (human readable):", lltvReadable);
        console.log("Market params:", marketParams);
  
        // Get current market state
        const market = await morphoContract.market(contracts.Morpho_market);
        console.log("Market state:", market);
  
        // Create IRM contract and get borrow rate
        if (account?.signer) {
          const irm = new ethers.Contract(contracts.IRM, Morpho_IRM, account.signer);
          
          try {
            const borrowRateWei = await irm.borrowRateView(marketParams, market);
            console.log('Borrow rate (wei):', borrowRateWei.toString());
            
            // Convert from wei per second to APY percentage
            const ratePerSecond = parseFloat(ethers.utils.formatUnits(borrowRateWei, 18));
            const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
            
            // Calculate APY: (1 + ratePerSecond)^secondsPerYear - 1
            const apy = (Math.pow(1 + ratePerSecond, SECONDS_PER_YEAR) - 1) * 100;
            
            console.log('Rate per second:', ratePerSecond);
            console.log('APY:', apy.toFixed(4) + '%');
            
            const finalRate = Math.max(0, Math.min(100, apy));
            
            setYieldRates(prev => ({
              ...prev,
              morphoBorrowApy: finalRate,
              lltv: lltvReadable,
              lastUpdated: new Date().toISOString()
            }));
            
            return finalRate;
          } catch (irmError) {
            console.error('IRM call failed:', irmError);
            // Fallback to reasonable estimate
            const fallbackRate = 9;
            setYieldRates(prev => ({
              ...prev,
              morphoBorrowApy: fallbackRate,
              lltv: lltvReadable,
              lastUpdated: new Date().toISOString()
            }));
            return fallbackRate;
          }
        }
        
      } catch (error) {
        console.error('Error fetching Morpho borrow rate:', error);
        return null;
      }
    };




    // Fetch real Pendle PT-sUSDe data using contracts and API
    const fetchPendleData = async () => {
      try {
        if (!pendlePTContract) return null;

        console.log('Fetching Pendle PT data with API integration...');

        // --- Onchain info from PT contract ---
        const expiry = await pendlePTContract.expiry();
        const isExpired = await pendlePTContract.isExpired();

        const expiryDate = new Date(expiry.toNumber() * 1000);
        const currentDate = new Date();
        const timeToExpiry = (expiryDate - currentDate) / (1000 * 60 * 60 * 24); // days

        setExpire(expiryDate.toLocaleDateString());
        setDaysRemaining(Math.floor(timeToExpiry));

        console.log('PT Token Info:');
        console.log('Expiry date:', expiryDate.toLocaleDateString());
        console.log('Days to expiry:', Math.floor(timeToExpiry));
        console.log('Is expired:', isExpired);

        // --- Pendle API config ---
        const HOSTED_SDK_URL = 'https://api-v2.pendle.finance/core';
        const CHAIN_ID = 1; // Ethereum mainnet
        const MARKET_ADDRESS = '0xA36b60A14A1A5247912584768C6e53E1a269a9F7'; // PT-sUSDe market

        let impliedAPY = 0;

        try {
          console.log('Fetching PT implied APY from Pendle API...');

          const marketResponse = await fetch(
            `${HOSTED_SDK_URL}/v1/sdk/${CHAIN_ID}/markets/${MARKET_ADDRESS}/swapping-prices`
          );

          if (marketResponse.ok) {
            const marketData = await marketResponse.json();
            console.log('Pendle market data:', marketData);

            // 1. Use impliedApy directly if present
            if (marketData.impliedApy) {
              impliedAPY = parseFloat(marketData.impliedApy) * 100;
              console.log('API Implied APY:', impliedAPY.toFixed(2) + '%');
            }

            // 2. Fallback: calculate from ptToUnderlyingTokenRate
            if ((!impliedAPY || impliedAPY <= 0) && marketData.ptToUnderlyingTokenRate) {
              const ptPrice = parseFloat(marketData.ptToUnderlyingTokenRate);
              const yearsToMaturity = timeToExpiry / 365;

              if (yearsToMaturity > 0 && ptPrice > 0) {
                impliedAPY = (Math.pow(1 / ptPrice, 1 / yearsToMaturity) - 1) * 100;
                console.log('Calculated APY from PT price:', impliedAPY.toFixed(2) + '%');
              }
            }
          } else {
            console.warn('Market API call failed:', marketResponse.status);
          }
        } catch (apiError) {
          console.error('Pendle API calls failed:', apiError);
        }

        // 3. Last resort fallback
        if (!impliedAPY || impliedAPY <= 0 || !isFinite(impliedAPY)) {
          console.log('API data unavailable, calculating fallback...');
          const yearsToMaturity = timeToExpiry / 365;
          if (yearsToMaturity > 0) {
            const typicalDiscount = 0.08; // 8% typical PT discount
            impliedAPY = (typicalDiscount / yearsToMaturity) * 100;
            impliedAPY = Math.max(5, Math.min(30, impliedAPY));
          } else {
            impliedAPY = 10; // default
          }
          console.log('Fallback implied APY:', impliedAPY.toFixed(2) + '%');
        }

        // Sanity bounds
        if (impliedAPY > 50 || impliedAPY < 0) {
          console.log('APY seems unreasonable, applying bounds...');
          impliedAPY = Math.max(5, Math.min(30, impliedAPY));
        }

        console.log('Final PT-sUSDe implied APY:', impliedAPY.toFixed(2) + '%');

        // Update state
        setYieldRates(prev => ({
          ...prev,
          ptSusdeImpliedApy: impliedAPY,
          lastUpdated: new Date().toISOString(),
        }));

        return {
          expiry: expiryDate,
          expiryTimestamp: expiry.toNumber(),
          isExpired,
          daysToExpiry: Math.floor(timeToExpiry),
          impliedAPY,
          apiDataAvailable: true,
        };
      } catch (error) {
        console.error('Error fetching Pendle PT data:', error);

        const fallbackAPY = 12;
        setYieldRates(prev => ({
          ...prev,
          ptSusdeImpliedApy: fallbackAPY,
          lastUpdated: new Date().toISOString(),
        }));

        return null;
      }
    };


    // Fetch real Ethena sUSDe data using contracts with historical data
      const fetchEthenaData = async () => {
        try {
          if (!susdeContract || !account?.signer) return null;
          
          console.log('Fetching Ethena sUSDe data with historical analysis...');
          
          const provider = account.signer.provider;
          const currentBlock = await provider.getBlockNumber();
          
          // Get current exchange rate
          const [totalSupply, totalAssets] = await Promise.all([
            susdeContract.totalSupply(),
            susdeContract.totalAssets()
          ]);
          
          const currentShareValue = parseFloat(ethers.utils.formatUnits(totalAssets, 18));
          const currentTotalShares = parseFloat(ethers.utils.formatUnits(totalSupply, 18));
          const currentExchangeRate = currentTotalShares > 0 ? currentShareValue / currentTotalShares : 1;
          
          console.log('Current sUSDe data:');
          console.log('Total Supply:', currentTotalShares.toFixed(2));
          console.log('Total Assets:', currentShareValue.toFixed(2));
          console.log('Current Exchange Rate:', currentExchangeRate.toFixed(6));
          
          // Get historical data from 7 days ago
          const blocksPerDay = Math.floor(24 * 60 * 60 / 12); // ~7200 blocks per day (12s block time)
          const historicalBlocks = [
            currentBlock - (1 * blocksPerDay),   // 1 day ago
            currentBlock - (7 * blocksPerDay),   // 1 week ago
            currentBlock - (30 * blocksPerDay),  // ~1 month ago
          ];
          
          const historicalRates = [];
          
          for (const blockNumber of historicalBlocks) {
            try {
              const [histSupply, histAssets] = await Promise.all([
                susdeContract.totalSupply({ blockTag: blockNumber }),
                susdeContract.totalAssets({ blockTag: blockNumber })
              ]);
              
              const histShareValue = parseFloat(ethers.utils.formatUnits(histAssets, 18));
              const histTotalShares = parseFloat(ethers.utils.formatUnits(histSupply, 18));
              const histExchangeRate = histTotalShares > 0 ? histShareValue / histTotalShares : 1;
              
              // Get block timestamp for accurate time calculation
              const block = await provider.getBlock(blockNumber);
              const daysAgo = (Date.now() / 1000 - block.timestamp) / (24 * 60 * 60);
              
              historicalRates.push({
                blockNumber,
                timestamp: block.timestamp,
                daysAgo: daysAgo,
                exchangeRate: histExchangeRate,
                totalSupply: histTotalShares,
                totalAssets: histShareValue
              });
              
              console.log(`Historical data (${daysAgo.toFixed(1)} days ago):`, {
                exchangeRate: histExchangeRate.toFixed(6),
                block: blockNumber
              });
              
            } catch (histError) {
              console.log(`Could not fetch data for block ${blockNumber}:`, histError.message);
            }
          }
          
          // Calculate APY from historical data
          let calculatedAPY = 0;
          
          if (historicalRates.length > 0) {
            // Use the oldest available data point for most accurate APY
            const oldestRate = historicalRates[historicalRates.length - 1];
            const rateGrowth = currentExchangeRate / oldestRate.exchangeRate;
            const timeInYears = oldestRate.daysAgo / 365;
            
            if (timeInYears > 0 && rateGrowth > 0) {
              // Calculate compound annual growth rate
              calculatedAPY = (Math.pow(rateGrowth, 1 / timeInYears) - 1) * 100;
              
              console.log('APY Calculation:');
              console.log('Rate growth:', rateGrowth.toFixed(6));
              console.log('Time period (years):', timeInYears.toFixed(3));
              console.log('Calculated APY:', calculatedAPY.toFixed(2) + '%');
            }
            
            // Also calculate shorter term rates for comparison
            const dailyRates = historicalRates.filter(rate => rate.daysAgo < 2);
            const weeklyRates = historicalRates.filter(rate => rate.daysAgo >= 6 && rate.daysAgo <= 8);
            
            if (dailyRates.length > 0) {
              const dailyRate = dailyRates[0];
              const dailyGrowth = currentExchangeRate / dailyRate.exchangeRate;
              const dailyAPY = (Math.pow(dailyGrowth, 365 / dailyRate.daysAgo) - 1) * 100;
              console.log('24h APY:', dailyAPY.toFixed(2) + '%');
            }
            
            if (weeklyRates.length > 0) {
              const weeklyRate = weeklyRates[0];
              const weeklyGrowth = currentExchangeRate / weeklyRate.exchangeRate;
              const weeklyAPY = (Math.pow(weeklyGrowth, 365 / weeklyRate.daysAgo) - 1) * 100;
              console.log('7d APY:', weeklyAPY.toFixed(2) + '%');
            }
          }
          
          // Validate and set the APY
          let finalAPY = calculatedAPY;
          
          // Sanity check - sUSDe APY should be reasonable (3-15% typically)
          if (calculatedAPY < 1 || calculatedAPY > 50 || !isFinite(calculatedAPY)) {
            console.log('Calculated APY seems unreasonable, using fallback method...');
            
            // Fallback: try to get APY from recent yield accrual
            if (historicalRates.length > 0) {
              const recentRate = historicalRates[0]; // Most recent historical data
              const shortTermGrowth = currentExchangeRate / recentRate.exchangeRate;
              const shortTermAPY = (Math.pow(shortTermGrowth, 365 / recentRate.daysAgo) - 1) * 100;
              
              if (shortTermAPY > 1 && shortTermAPY < 50 && isFinite(shortTermAPY)) {
                finalAPY = shortTermAPY;
                console.log('Using short-term APY:', finalAPY.toFixed(2) + '%');
              } else {
                finalAPY = 7.74; // Market fallback
                console.log('Using market fallback APY');
              }
            } else {
              finalAPY = 7.74;
            }
          }
          
          // Update state with real historical APY
          setYieldRates(prev => ({
            ...prev,
            susdeApy: finalAPY,
            lastUpdated: new Date().toISOString()
          }));
          
          console.log('Final sUSDe APY:', finalAPY.toFixed(2) + '%');
          
          return {
            currentExchangeRate,
            historicalRates,
            calculatedAPY: finalAPY,
            totalValueLocked: currentShareValue,
            totalShares: currentTotalShares
          };
          
        } catch (error) {
          console.error('Error fetching Ethena historical data:', error);
          
          // Final fallback
          const fallbackAPY = 7.74;
          setYieldRates(prev => ({
            ...prev,
            susdeApy: fallbackAPY,
            lastUpdated: new Date().toISOString()
          }));
          
          return null;
        }
      };



  // Fetch balances using contracts
    const fetchBalances = async (address) => {
      if (!address || !usdcContract) return;
      
      try {
        console.log('Fetching balances for:', address);
        
        // Get ETH balance
        const ethBalance = await account.signer.provider.getBalance(address);
        const formattedEthBalance = $u.moveDecimalLeft(ethBalance.toString(), 18);
        
        // Get token balances
        const [usdcRaw, usdeRaw, susdeRaw, ptSusdeRaw] = await Promise.all([
          usdcContract.balanceOf(address),
          usdeContract.balanceOf(address),
          susdeContract.balanceOf(address),
          pendlePTContract.balanceOf(address)
        ]);
  
        setBalances({
          eth: Number(formattedEthBalance).toFixed(4),
          usdc: $u.moveDecimalLeft(usdcRaw.toString(), 6),
          usde: $u.moveDecimalLeft(usdeRaw.toString(), 18),
          susde: $u.moveDecimalLeft(susdeRaw.toString(), 18),
          ptSusde: $u.moveDecimalLeft(ptSusdeRaw.toString(), 18)
        });
  
        // Calculate estimated rewards
        const susdeBalance = parseFloat($u.moveDecimalLeft(susdeRaw.toString(), 18));
        const ptSusdeBalance = parseFloat($u.moveDecimalLeft(ptSusdeRaw.toString(), 18));
        
        const susdeRewardsEstimate = (susdeBalance * yieldRates.susdeApy / 100 / 365).toFixed(4);
        const ptSusdeRewardsEstimate = (ptSusdeBalance * yieldRates.ptSusdeImpliedApy / 100 / 365).toFixed(4);
        
        setRewards({
          susdeRewards: susdeRewardsEstimate,
          ptSusdeRewards: ptSusdeRewardsEstimate,
          ptExpirationDate: new Date(Date.now() + 8 * 30 * 24 * 60 * 60 * 1000) // Approx 8 months
        });
  
        console.log('Balances updated successfully');
  
      } catch (error) {
        console.error('Error fetching balances:', error);
        setStatus('Error fetching balances');
      }
    };


    // Connect wallet using ethers (as requested)
      const connectWallet = async () => {
        if (!isMetaMaskInstalled()) {
          alert("Please install MetaMask to continue.");
          window.open('https://metamask.io/download/', '_blank');
          return;
        }
        
        setIsConnecting(true);
        
        try {
          
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          await provider.send("eth_requestAccounts", []);
          const signer = provider.getSigner();
          const address = await signer.getAddress();
          const network = await provider.getNetwork();
    
          const allowedChains = [1, 8453, 42161, 11155111]; 
    
          if (!allowedChains.includes(network.chainId)) {
            alert("Please switch to an allowed network: Ethereum, Base, Arbitrum, or Sepolia.");
            setIsConnecting(false);
            return;
          }
    
          const balance = await provider.getBalance(address);
          const formattedBalance = $u.moveDecimalLeft(balance.toString(), 18);
          setAccount({ address, signer, balance: Number(formattedBalance).toFixed(4), chainId: network.chainId });
    
          // Initialize contract instances
          const usdc = new ethers.Contract(contracts.USDC, ERC20, signer);
          setUsdcContract(usdc);
    
          const usde = new ethers.Contract(contracts.USDE, Ethena_USDE, signer);
          setUsdeContract(usde);
          
          const susde = new ethers.Contract(contracts.SUSDE, Ethena_SUSDE, signer);
          setSUsdeContract(susde);
    
          const PT_SUSDE = new ethers.Contract(contracts.PT_SUSDE, Pendle_PT_25_SEP, signer);
          setPendlePTContract(PT_SUSDE);
    
          const morpho = new ethers.Contract(contracts.Morpho, Morpho_ABI, signer);
          setMorphoContract(morpho);
    
          setStatus('Wallet connected successfully - Loading data...');
    
          // Fetch real data from contracts
          setTimeout(async () => {
            try {
              await fetchBalances(address);
              await fetchMorphoBorrowRate();
              await fetchPendleData();
              await fetchEthenaData();
              await refreshBalances();
              setStatus('All data loaded successfully');
            } catch (error) {
              console.error('Error loading contract data:', error);
              setStatus('Connected but some data failed to load');
            }
          }, 1000);
    
          // Event listeners
          window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
              setAccount(null);
              setBalances({
                eth: '0',
                usdc: '0',
                usde: '0',
                susde: '0',
                ptSusde: '0'
              });
              setStatus('Wallet disconnected');
            } else {
              // Reconnect with new account
              connectWallet();
            }
          });
    
          window.ethereum.on('chainChanged', (chainId) => {
            window.location.reload();
          });
    
        } catch (err) {
          console.error("Wallet connection failed:", err);
          setStatus(`Connection failed: ${err.message}`);
        } finally {
          setIsConnecting(false);
        }
      };
      

      // Refresh all data from contracts
  const refreshBalances = async () => {
    if (account?.address && account?.signer) {
      setIsConnecting(true);
      setStatus('Refreshing data from contracts...');
      
      try {
        await Promise.all([
          fetchBalances(account.address),
          fetchMorphoBorrowRate(),
          fetchPendleData(),
          fetchEthenaData()
        ]);
        setStatus('Data refreshed successfully');
      } catch (error) {
        console.error('Error refreshing data:', error);
        setStatus('Error refreshing data');
      } finally {
        setIsConnecting(false);
      }
    }
  };










  // Calculate multi-loop estimates using real rates
  const calculateMultiLoopEstimates = () => {
    let totalCollateral = 0;
    let totalBorrowed = 0;
    let totalInputUsed = parseFloat(usdcAmount) || 0;
    let loopEstimates = [];
    let availableUSDC = totalInputUsed;

    for (let i = 0; i < maxLoops && availableUSDC > 1; i++) {
      const inputAmount = availableUSDC;
      const isLastLoop = (i === maxLoops - 1);
      
      // Calculate conversions with realistic slippage
      const estimatedUSDe = inputAmount * 0.995; // 0.5% slippage
      const estimatedSUSDe = estimatedUSDe;
      const estimatedPTSUSDe = estimatedSUSDe * 0.99; // 1% slippage
      const maxBorrowUSDC = estimatedPTSUSDe * (yieldRates.lltv || 0.75); // Use real LLTV or 75% default
      
      const customBorrowAmount = parseFloat(borrowAmount) || 0;
      
      // For the final loop, don't borrow again
      const actualBorrowAmount = isLastLoop ? 0 : (
        (i === 0 && customBorrowAmount > 0) 
          ? Math.min(customBorrowAmount, maxBorrowUSDC) 
          : Math.min(maxBorrowUSDC, availableUSDC * 0.8)
      );

      totalCollateral += estimatedPTSUSDe;
      totalBorrowed += actualBorrowAmount;
      
      loopEstimates.push({
        loopNumber: i + 1,
        inputUsdc: inputAmount,
        estimatedUSDe: estimatedUSDe,
        estimatedSUSDe: estimatedSUSDe,
        estimatedPTSUSDe: estimatedPTSUSDe,
        maxBorrowUSDC: maxBorrowUSDC,
        actualBorrowAmount: actualBorrowAmount,
        cumulativeCollateral: totalCollateral,
        cumulativeBorrowed: totalBorrowed,
        isLastLoop: isLastLoop
      });
      
      availableUSDC = actualBorrowAmount;
      
      // If we're not borrowing or the borrow amount is too small, stop
      if (actualBorrowAmount === 0 || actualBorrowAmount < 5) break;
    }

    // Calculate yields using real rates
    const totalPtYieldAnnual = (totalCollateral * yieldRates.ptSusdeImpliedApy) / 100;
    const totalBorrowCostAnnual = (totalBorrowed * yieldRates.morphoBorrowApy) / 100;
    const netYieldAnnual = totalPtYieldAnnual - totalBorrowCostAnnual;
    const overallApy = totalInputUsed > 0 ? (netYieldAnnual / totalInputUsed) * 100 : 0;
    const leverageMultiplier = totalInputUsed > 0 ? (totalInputUsed + totalBorrowed) / totalInputUsed : 1;

    return {
      loops: loopEstimates,
      totalCollateral: totalCollateral.toFixed(2),
      totalBorrowed: totalBorrowed.toFixed(2),
      totalPtYieldAnnual: totalPtYieldAnnual.toFixed(2),
      totalBorrowCostAnnual: totalBorrowCostAnnual.toFixed(2),
      netYieldAnnual: netYieldAnnual.toFixed(2),
      overallApy: overallApy.toFixed(2),
      leverageMultiplier: leverageMultiplier.toFixed(2),
      totalInputUsed: totalInputUsed.toFixed(2)
    };
  };

  const multiLoopEstimates = calculateMultiLoopEstimates();

  // Execute multi-loop strategy (simulation for now)
  const executeMultiLoop = async () => {
    if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
      setStatus('Please enter a valid USDC amount');
      return;
    }

    if (!account) {
      setStatus('Please connect your wallet first');
      return;
    }

    if (parseFloat(balances.usdc) < parseFloat(usdcAmount)) {
      setStatus(`Insufficient USDC balance. You have ${balances.usdc} USDC`);
      return;
    }

    setIsProcessing(true);
    setCurrentLoop(0);
    setCurrentStep(0);
    setLoops([]);
    
    try {
      for (let i = 0; i < multiLoopEstimates.loops.length; i++) {
        setCurrentLoop(i + 1);
        setStatus(`Executing Loop ${i + 1} of ${multiLoopEstimates.loops.length}...`);
        
        await executeLoop(multiLoopEstimates.loops[i], i + 1);
        
        setLoops(prev => [...prev, {
          ...multiLoopEstimates.loops[i],
          completed: true,
          timestamp: new Date().toISOString()
        }]);

        if (i < multiLoopEstimates.loops.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      setStatus(`All ${multiLoopEstimates.loops.length} loops completed! Total APY: ${multiLoopEstimates.overallApy}%`);
      setCurrentLoop(0);
      setCurrentStep(0);
      
      await refreshBalances();
      
    } catch (error) {
      console.error('Multi-loop failed:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeLoop = async (loopData, loopNumber) => {
    // For the final loop, skip the borrow step
    const stepActions = loopData.isLastLoop ? [
      () => simulateStep1(1, loopNumber, `Swapping ${loopData.inputUsdc.toFixed(2)} USDC → USDe`, 1500),
      () => simulateStep2(2, loopNumber, `Staking ${loopData.estimatedUSDe.toFixed(2)} USDe → sUSDe`, 1200),
      () => simulateStep3(3, loopNumber, `Swapping ${loopData.estimatedSUSDe.toFixed(2)} sUSDe → PT-sUSDe (Final Loop - No Borrowing)`, 1800)
    ] : [
      () => simulateStep1(1, loopNumber, `Swapping ${loopData.inputUsdc.toFixed(2)} USDC → USDe`, 1500),
      () => simulateStep2(2, loopNumber, `Staking ${loopData.estimatedUSDe.toFixed(2)} USDe → sUSDe`, 1200),
      () => simulateStep3(3, loopNumber, `Swapping ${loopData.estimatedSUSDe.toFixed(2)} sUSDe → PT-sUSDe`, 1800),
      () => simulateStep4(4, loopNumber, `Supplying ${loopData.estimatedPTSUSDe.toFixed(2)} PT-sUSDe and borrowing ${loopData.actualBorrowAmount.toFixed(2)} USDC`, 2000)
    ];

    for (const stepAction of stepActions) {
      await stepAction();
    }
  };


  const simulateStep1 = async (loopData, loopNumber) => {
    setCurrentStep(1);
    setStatus(`Loop ${loopNumber}: Swapping ${loopData.inputUsdc.toFixed(2)} USDC → USDe...`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setStatus(`✅ Loop ${loopNumber}: USDC → USDe swap completed`);
    setTxHash(`0x${loopNumber}234567890abcdef1234567890abcdef12345678`);
  };

  const simulateStep2 = async (loopData, loopNumber) => {
    setCurrentStep(2);
    setStatus(`Loop ${loopNumber}: Staking ${loopData.estimatedUSDe.toFixed(2)} USDe → sUSDe...`);
    await new Promise(resolve => setTimeout(resolve, 1200));
    setStatus(`✅ Loop ${loopNumber}: USDe → sUSDe staking completed`);
    setTxHash(`0xabc${loopNumber}ef1234567890abcdef1234567890abcdef12`);
  };

  const simulateStep3 = async (loopData, loopNumber) => {
    setCurrentStep(3);
    setStatus(`Loop ${loopNumber}: Swapping ${loopData.estimatedSUSDe.toFixed(2)} sUSDe → PT-sUSDe...`);
    await new Promise(resolve => setTimeout(resolve, 1800));
    setStatus(`✅ Loop ${loopNumber}: sUSDe → PT-sUSDe swap completed`);
    setTxHash(`0x567${loopNumber}90abcdef1234567890abcdef1234567890ab`);
  };

  const simulateStep4 = async (loopData, loopNumber) => {
    setCurrentStep(4);
    setStatus(`Loop ${loopNumber}: Supplying ${loopData.estimatedPTSUSDe.toFixed(2)} PT-sUSDe and borrowing ${loopData.actualBorrowAmount.toFixed(2)} USDC...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setStatus(`✅ Loop ${loopNumber} completed! Borrowed ${loopData.actualBorrowAmount.toFixed(2)} USDC`);
    setTxHash(`0x90abc${loopNumber}ef1234567890abcdef1234567890abcdef`);
    setCurrentStep(0);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="w-full bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              DeFi Leveraged Yield Strategy
            </h1>
            <p className="text-slate-400 text-sm">
              Recursive leveraged yield farming
            </p>
            <button onClick={fetchMorphoBorrowRate}>
              Morpho
            </button> 

      


          </div>
          
          <div className="flex items-center space-x-4">
            {account && (
              <div className="text-right">
                <div className="text-sm font-medium text-slate-300">
                  {account.address.slice(0, 6)}...{account.address.slice(-4)}
                </div>
                <div className="text-xs text-slate-400">
                  Chain ID: {account.chainId} {account.chainId === 1 ? '(Ethereum)' : ''}
                </div>
              </div>
            )}
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                account 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : isConnecting
                  ? 'bg-slate-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isConnecting ? 'Connecting...' : account ? '✅ Connected' : '🔗 Connect MetaMask'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Input & Loop Configuration */}
          <div className="space-y-6">



            <div className="space-y-6">
                        {/* Real Yield Rates from Contracts */}
                        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
                          <div className="flex items-center mb-4">
                            <TrendingUp className="w-6 h-6 mr-3 text-green-400" />
                            <h3 className="text-xl font-semibold">Live Yield Rates</h3>
                            {yieldRates.lastUpdated && (
                              <span className="ml-auto text-xs text-gray-400">
                                {new Date(yieldRates.lastUpdated).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-700/50 rounded-lg p-4">
                              <div className="text-sm text-gray-400">sUSDe APY</div>
                              <div className="text-2xl font-bold text-green-400">
                                {yieldRates.susdeApy ? yieldRates.susdeApy.toFixed(2) : '--'}%
                              </div>
                            </div>
                            <div className="bg-slate-700/50 rounded-lg p-4">
                              <div className="text-sm text-gray-400">PT-sUSDe APY</div>
                              <div className="text-2xl font-bold text-blue-400">
                                {yieldRates.ptSusdeImpliedApy ? yieldRates.ptSusdeImpliedApy.toFixed(2) : '--'}%
                              </div>
                            </div>
                            <div className="bg-slate-700/50 rounded-lg p-4">
                              <div className="text-sm text-gray-400">Morpho Borrow</div>
                              <div className="text-2xl font-bold text-red-400">
                                {yieldRates.morphoBorrowApy ? yieldRates.morphoBorrowApy.toFixed(2) : '--'}%
                              </div>
                            </div>
                            <div className="bg-slate-700/50 rounded-lg p-4">
                              <div className="text-sm text-gray-400">PT Expiry</div>
                              <div className="text-lg font-bold text-yellow-400">{expire}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                {daysRemaining > 0 ? `${daysRemaining} days left` : daysRemaining === 0 ? 'Expires today' : 'Expired'}
                              </div>
                            </div>
                            <div className="bg-slate-700/50 rounded-lg p-4">
                              <div className="text-sm text-gray-400">LLTV</div>
                              <div className="text-2xl font-bold text-purple-400">
                                {yieldRates.lltv ? (yieldRates.lltv * 100).toFixed(1) : '--'}%
                              </div>
                            </div>
                          </div>
                        </div>
            
                        
            
                       
                      </div>
            
            {/* Loop Configuration */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center mb-4">
                <RefreshCw className="w-5 h-5 text-purple-400 mr-2" />
                <h2 className="text-xl font-semibold">Loop Configuration</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Initial USDC Amount
                  </label>
                  <input
                    type="number"
                    value={usdcAmount}
                    onChange={(e) => setUsdcAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter USDC amount"
                    min="1"
                    step="0.01"
                    disabled={!account || isProcessing}
                  />
                  {account && balances.usdc && (
                    <div className="text-xs text-slate-400 mt-1">
                      Available: {balances.usdc} USDC
                      <button 
                        onClick={() => setUsdcAmount((parseFloat(balances.usdc) * 0.95).toFixed(2))}
                        className="ml-2 text-blue-400 hover:text-blue-300"
                        disabled={isProcessing}
                      >
                        Use 95%
                      </button>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Loop Iterations
                  </label>
                  <div>
                              <label className="block text-sm font-medium text-gray-400 mb-2">
                                Maximum Loops: {maxLoops}
                              </label>
                              <input
                                type="range"
                                min="1"
                                max="5"
                                value={maxLoops}
                                onChange={(e) => setMaxLoops(parseInt(e.target.value))}
                                className="w-full accent-purple-500"
                              />
                              <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                              </div>
                            </div>
                  <div className="text-xs text-slate-400 mt-1">
                    More loops = Higher APY but increased complexity
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    First Loop Borrow Amount (Optional)
                  </label>
                  <input
                    type="number"
                    value={borrowAmount}
                    onChange={(e) => setBorrowAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Auto-calculated if empty"
                    min="0"
                    step="0.01"
                    disabled={!account || isProcessing}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {[100, 500, 1000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setUsdcAmount(amount.toString())}
                      disabled={!account || isProcessing}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors"
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Wallet Balances */}
            {account && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <DollarSign className="w-5 h-5 text-green-400 mr-2" />
                    <h2 className="text-xl font-semibold">Your Balances</h2>
                  </div>
                  <button
                    onClick={refreshBalances}
                    disabled={isProcessing}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    title="Refresh balances"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        ETH
                      </div>
                      <span className="text-slate-300">Ethereum</span>
                    </div>
                    <span className="font-semibold text-blue-400">{parseFloat(balances.eth).toFixed(4)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        USDC
                      </div>
                      <span className="text-slate-300">USD Coin</span>
                    </div>
                    <span className="font-semibold text-green-400">{parseFloat(balances.usdc).toFixed(4)}</span> 
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        USDe
                      </div>
                      <span className="text-slate-300">Ethena USD</span>
                    </div>
                    <span className="font-semibold text-yellow-400">{parseFloat(balances.usde).toFixed(4)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        sUSDe
                      </div>
                      <div>
                        <div className="text-slate-300">Staked USDe</div>
                        {parseFloat(balances.susde) > 0 && (
                          <div className="text-xs text-green-400">
                            ~{rewards.susdeRewards} daily rewards
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-orange-400">{balances.susde}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        PT
                      </div>
                      <div>
                        <div className="text-slate-300">PT-sUSDe</div>
                        {parseFloat(balances.ptSusde).toFixed(4) > 0 && (
                          <div className="text-xs text-purple-400">
                            ~{rewards.ptSusdeRewards} daily rewards
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-pink-400">{balances.ptSusde}</span>
                  </div>
                </div> 
                
                {/* PT Expiration Info */}
                {parseFloat(balances.ptSusde).toFixed(4) > 0 && rewards.ptExpirationDate && (
                  <div className="mt-4 p-3 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 text-purple-400 mr-2" />
                        <span className="text-sm text-purple-300">PT Expiration</span>
                      </div>
                      <span className="text-sm text-purple-400 font-medium">
                        {expire}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {daysRemaining > 0 ? `${daysRemaining} days remaining` : daysRemaining === 0 ? 'Expires today' : 'Expired'} 
                    </div>
                  </div>
                )}
              </div>
            )}

            


            
          </div>

          

          {/* Middle Column - Loop Progress & Estimates */}
          <div className="space-y-6">

            {/* Multi-Loop Overview */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center mb-4">
                <Layers className="w-5 h-5 text-blue-400 mr-2" />
                <h2 className="text-xl font-semibold">Loop Overview</h2>
                <div className="ml-auto bg-gradient-to-r from-green-500 to-blue-500 px-3 py-1 rounded-full text-sm font-bold">
                  {multiLoopEstimates.overallApy}% APY
                </div>
              </div>
              
              <div className="space-y-3">
                {multiLoopEstimates.loops.map((loop, index) => (
                  <div key={index} className={`p-4 rounded-lg border ${
                    currentLoop === loop.loopNumber ? 'bg-blue-900/50 border-blue-500' :
                    loops.find(l => l.loopNumber === loop.loopNumber) ? 'bg-green-900/50 border-green-500' :
                    'bg-slate-700 border-slate-600'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          currentLoop === loop.loopNumber ? 'bg-blue-500 animate-pulse' :
                          loops.find(l => l.loopNumber === loop.loopNumber) ? 'bg-green-500' :
                          'bg-slate-600'
                        }`}>
                          {loops.find(l => l.loopNumber === loop.loopNumber) ? <CheckCircle className="w-4 h-4" /> : loop.loopNumber}
                        </div>
                        <span className="font-medium">Loop {loop.loopNumber}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="text-slate-400">Input USDC</div>
                        <div className="text-green-400 font-semibold">{loop.inputUsdc.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">PT-sUSDe Output</div>
                        <div className="text-purple-400 font-semibold">{loop.estimatedPTSUSDe.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Borrow Amount</div>
                        <div className="text-yellow-400 font-semibold">{loop.actualBorrowAmount.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Cumulative PT</div>
                        <div className="text-blue-400 font-semibold">{loop.cumulativeCollateral.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Loop Progress */}
            {isProcessing && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center mb-4">
                  <TrendingUp className="w-5 h-5 text-purple-400 mr-2" />
                  <h2 className="text-xl font-semibold">Current Progress</h2>
                  <div className="ml-auto text-sm text-slate-400">
                    Loop {currentLoop} of {multiLoopEstimates.loops.length}
                  </div>
                </div>
                
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        currentStep > index + 1 ? 'bg-green-500' : 
                        currentStep === index + 1 ? 'bg-blue-500 animate-pulse' :
                        'bg-slate-600'
                      }`}>
                        {currentStep > index + 1 ? <CheckCircle className="w-4 h-4" /> : step.icon}
                      </div>
                      <span className={`${
                        currentStep > index + 1 ? 'text-green-400' :
                        currentStep === index + 1 ? 'text-blue-400' :
                        'text-slate-400'
                      }`}>
                        {step.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execute Section */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Zap className="w-5 h-5 text-yellow-400 mr-2" />
                  <h2 className="text-xl font-semibold">Execute Strategy</h2>
                </div>
                {isProcessing && (
                  <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                )}
              </div>
              
              <div className="mb-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-slate-300">{status}</span>
                </div>
                {txHash && (
                  <div className="mt-2 text-xs text-blue-400 break-all">
                    TX: {txHash}
                  </div>
                )}
              </div>
              
              <button
                onClick={executeMultiLoop}
                disabled={isProcessing || !usdcAmount || parseFloat(usdcAmount) <= 0 || !account}
                className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
                  isProcessing || !usdcAmount || parseFloat(usdcAmount) <= 0 || !account
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg'
                }`}
              >
                {isProcessing ? `Executing Loop ${currentLoop}...` : 
                 `Execute ${multiLoopEstimates.loops.length} Loops (${multiLoopEstimates.overallApy}% APY)`}
              </button>
            </div>

            {/* Rewards Summary */}
            {account && (parseFloat(balances.susde) > 0 || parseFloat(balances.ptSusde) > 0) && (
              <div className="bg-gradient-to-r from-green-800/50 to-blue-800/50 rounded-xl p-6 border border-green-600">
                <div className="flex items-center mb-4">
                  <Award className="w-5 h-5 text-green-400 mr-2" />
                  <h2 className="text-xl font-semibold">Active Rewards</h2>
                </div>
                
                <div className="space-y-3">
                  {parseFloat(balances.susde) > 0 && (
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-orange-300">sUSDe Staking Rewards</span>
                        <span className="text-orange-400 font-bold">{parseFloat(yieldRates.susdeApy).toFixed(2)}% APY</span>
                      </div>
                      <div className="text-sm text-slate-300">
                        Balance: {parseFloat(balances.susde).toFixed(4)} sUSDe
                      </div>
                      <div className="text-sm text-green-400">
                        Daily rewards: ~{rewards.susdeRewards} sUSDe
                      </div>
                    </div>
                  )}
                  
                  {parseFloat(balances.ptSusde) > 0 && (
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-pink-300">PT-sUSDe Fixed Yield</span>
                        <span className="text-pink-400 font-bold">{parseFloat(yieldRates.ptSusdeImpliedApy).toFixed(2)}% APY</span>
                      </div>
                      <div className="text-sm text-slate-300">
                        Balance: {parseFloat(balances.ptSusde).toFixed(4)} PT-sUSDe
                      </div>
                      <div className="text-sm text-green-400">
                        Daily yield: ~{rewards.ptSusdeRewards} PT
                      </div>
                      {rewards.ptExpirationDate && (
                        <div className="text-sm text-yellow-400 mt-1">
                          Expires: {expire}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Advanced Analytics */}
          <div className="space-y-6">
            {/* Multi-Loop Yield Analysis */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center mb-4">
                <BarChart3 className="w-5 h-5 text-green-400 mr-2" />
                <h2 className="text-xl font-semibold">Yield Analysis</h2>
              </div>
              
              <div className="space-y-4">
                {/* Overall Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-green-800 to-green-700 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-200">{multiLoopEstimates.overallApy}%</div>
                    <div className="text-xs text-green-300 font-medium">Total APY</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-800 to-blue-700 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-200">{multiLoopEstimates.leverageMultiplier}x</div>
                    <div className="text-xs text-blue-300 font-medium">Leverage</div>
                  </div>
                </div>

                {/* Position Summary */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-300">Position Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                      <span className="text-sm text-slate-300">Total PT-sUSDe</span>
                      <span className="text-purple-400 font-semibold">{multiLoopEstimates.totalCollateral}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                      <span className="text-sm text-slate-300">Total Borrowed</span>
                      <span className="text-red-400 font-semibold">{multiLoopEstimates.totalBorrowed} USDC</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-900 to-blue-900 rounded-lg">
                      <span className="text-sm text-white font-medium">Net Annual Profit</span>
                      <span className="text-green-300 font-bold">+${multiLoopEstimates.netYieldAnnual}</span>
                    </div>
                  </div>
                </div>

                {/* Yield Breakdown */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-300">Annual Yield Breakdown</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                      <span className="text-sm text-slate-300">PT Yield Earned</span>
                      <span className="text-green-400 font-semibold">+${multiLoopEstimates.totalPtYieldAnnual}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                      <span className="text-sm text-slate-300">Total Borrow Cost</span>
                      <span className="text-red-400 font-semibold">-${multiLoopEstimates.totalBorrowCostAnnual}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* APY Comparison Chart */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center mb-4">
                <TrendingUp className="w-5 h-5 text-purple-400 mr-2" />
                <h2 className="text-xl font-semibold">APY by Loop Count</h2>
              </div>
              
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((loops) => {
                  const tempEstimate = calculateLoopAPY(parseFloat(usdcAmount) || 100, loops);
                  const isActive = loops === maxLoops;
                  
                  return (
                    <div key={loops} className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                      isActive ? 'bg-purple-900/50 border border-purple-500' : 'bg-slate-700 hover:bg-slate-600'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isActive ? 'bg-purple-500' : 'bg-slate-600'
                        }`}>
                          {loops}
                        </div>
                        <span className={`text-sm ${isActive ? 'text-purple-300' : 'text-slate-300'}`}>
                          {loops} Loop{loops > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${isActive ? 'text-purple-400' : 'text-slate-400'}`}>
                          {tempEstimate.apy}%
                        </div>
                        <div className="text-xs text-slate-500">
                          {tempEstimate.leverage}x leverage
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 p-4 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg">
                <div className="text-xs text-slate-300 mb-2">APY Improvement:</div>
                <div className="text-lg font-bold text-purple-300">
                  +{(parseFloat(multiLoopEstimates.overallApy) - calculateLoopAPY(parseFloat(usdcAmount) || 100, 1).apy).toFixed(1)}% 
                  <span className="text-sm font-normal text-slate-400">vs single loop</span>
                </div>
              </div>
            </div>

            {/* Network & Gas Information */}
            {account && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center mb-4">
                  <Zap className="w-5 h-5 text-yellow-400 mr-2" />
                  <h2 className="text-xl font-semibold">Network Information</h2>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <span className="text-sm text-slate-300">Network</span>
                    <span className="text-blue-400 font-semibold">
                      {account.chainId === 1 ? 'Ethereum Mainnet' : 
                       account.chainId === 11155111 ? 'Sepolia Testnet' : 
                       `Chain ID: ${account.chainId}`}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <span className="text-sm text-slate-300">Est. Gas Cost</span>
                    <span className="text-yellow-400 font-semibold">
                      ${(multiLoopEstimates.loops.length * 25).toFixed(0)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <span className="text-sm text-slate-300">Transactions</span>
                    <span className="text-purple-400 font-semibold">
                      {multiLoopEstimates.loops.length * 4} TXs
                    </span>
                  </div>
                  
                  {account.chainId !== 1 && (
                    <div className="p-3 bg-yellow-900/50 rounded-lg">
                      <div className="text-xs text-yellow-300 font-medium mb-1">⚠️ Wrong Network</div>
                      <div className="text-xs text-slate-300">
                        Please switch to Ethereum Mainnet for live trading
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Risk Analysis */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center mb-4">
                <AlertCircle className="w-5 h-5 text-orange-400 mr-2" />
                <h2 className="text-xl font-semibold">Risk Analysis</h2>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700 rounded-lg p-4 text-center">
                    <div className="text-lg font-bold text-orange-400">
                      {(yieldRates.ptSusdeImpliedApy - yieldRates.morphoBorrowApy).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-400">Rate Spread</div>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4 text-center">
                    <div className="text-lg font-bold text-blue-400">75%</div>
                    <div className="text-xs text-slate-400">Max LTV</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">Complexity Level</span>
                    <span className={`text-sm font-semibold ${
                      maxLoops <= 2 ? 'text-green-400' : 
                      maxLoops <= 3 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {maxLoops <= 2 ? 'Low' : maxLoops <= 3 ? 'Medium' : 'High'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">Gas Cost Est.</span>
                    <span className="text-sm font-semibold text-blue-400">
                      ${(multiLoopEstimates.loops.length * 25).toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">Liquidation Risk</span>
                    <span className="text-sm font-semibold text-green-400">Low</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">Smart Contract Risk</span>
                    <span className="text-sm font-semibold text-yellow-400">Medium</span>
                  </div>
                </div>
                
                <div className="p-3 bg-gradient-to-r from-yellow-900/50 to-orange-900/50 rounded-lg">
                  <div className="text-xs text-yellow-300 font-medium mb-1">⚠️ Important Notes:</div>
                  <ul className="text-xs text-slate-300 space-y-1">
                    <li>• Higher loops increase complexity and gas costs</li>
                    <li>• Rate spread must remain positive for profitability</li>
                    <li>• Monitor liquidation thresholds closely</li>
                    <li>• PT tokens have expiration dates</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Time-based Projections */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center mb-4">
                <Percent className="w-5 h-5 text-cyan-400 mr-2" />
                <h2 className="text-xl font-semibold">Yield Timeline</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-emerald-800 to-emerald-700 rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-emerald-200">
                    ${(parseFloat(multiLoopEstimates.netYieldAnnual) / 365).toFixed(3)}
                  </div>
                  <div className="text-xs text-emerald-300 font-medium">Daily Yield</div>
                  <div className="text-xs text-emerald-400 mt-1">
                    {(parseFloat(multiLoopEstimates.overallApy) / 365).toFixed(4)}% daily
                  </div>
                </div>
                <div className="bg-gradient-to-br from-cyan-800 to-cyan-700 rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-cyan-200">
                    ${(parseFloat(multiLoopEstimates.netYieldAnnual) / 52).toFixed(2)}
                  </div>
                  <div className="text-xs text-cyan-300 font-medium">Weekly Yield</div>
                  <div className="text-xs text-cyan-400 mt-1">
                    {(parseFloat(multiLoopEstimates.overallApy) / 52).toFixed(3)}% weekly
                  </div>
                </div>
                <div className="bg-gradient-to-br from-yellow-800 to-yellow-700 rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-yellow-200">
                    ${(parseFloat(multiLoopEstimates.netYieldAnnual) / 12).toFixed(2)}
                  </div>
                  <div className="text-xs text-yellow-300 font-medium">Monthly Yield</div>
                  <div className="text-xs text-yellow-400 mt-1">
                    {(parseFloat(multiLoopEstimates.overallApy) / 12).toFixed(2)}% monthly
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-800 to-green-700 rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-green-200">
                    ${multiLoopEstimates.netYieldAnnual}
                  </div>
                  <div className="text-xs text-green-300 font-medium">Annual Yield</div>
                  <div className="text-xs text-green-400 mt-1">
                    {multiLoopEstimates.overallApy}% APY
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Completed Loops History */}
        {loops.length > 0 && (
          <div className="mt-6 bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center mb-4">
              <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
              <h2 className="text-xl font-semibold">Completed Loops History</h2>
              <div className="ml-auto bg-gradient-to-r from-green-500 to-blue-500 px-3 py-1 rounded-full text-sm font-bold">
                {loops.length} / {multiLoopEstimates.loops.length} Complete
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loops.map((loop, index) => (
                <div key={index} className="bg-gradient-to-br from-slate-700 to-slate-600 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <span className="font-semibold">Loop {loop.loopNumber}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(loop.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Input:</span>
                      <span className="text-green-400 font-semibold">{loop.inputUsdc.toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">PT Minted:</span>
                      <span className="text-purple-400 font-semibold">{loop.estimatedPTSUSDe.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Borrowed:</span>
                      <span className="text-yellow-400 font-semibold">{loop.actualBorrowAmount.toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-300">Efficiency:</span>
                      <span className="text-blue-400">
                        {((loop.actualBorrowAmount / loop.inputUsdc) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strategy Performance Summary */}
        {multiLoopEstimates.loops.length > 1 && (
          <div className="mt-6 bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
            <div className="flex items-center mb-4">
              <Target className="w-5 h-5 text-green-400 mr-2" />
              <h2 className="text-xl font-semibold">Multi-Loop Strategy Performance</h2>
              <div className="ml-auto flex items-center space-x-4">
                <span className="text-green-400 font-bold text-2xl">{multiLoopEstimates.overallApy}% APY</span>
                <span className="text-blue-400 font-bold text-lg">{multiLoopEstimates.leverageMultiplier}x Leverage</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-lg p-4">
                <div className="text-sm text-slate-300 mb-2">Total Position Value</div>
                <div className="text-2xl font-bold text-green-400">
                  ${(parseFloat(multiLoopEstimates.totalInputUsed) + parseFloat(multiLoopEstimates.totalBorrowed)).toFixed(2)}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {multiLoopEstimates.leverageMultiplier}x from ${multiLoopEstimates.totalInputUsed} initial
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-lg p-4">
                <div className="text-sm text-slate-300 mb-2">Annual Profit</div>
                <div className="text-2xl font-bold text-purple-400">
                  +${multiLoopEstimates.netYieldAnnual}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  ${(parseFloat(multiLoopEstimates.netYieldAnnual) / 365).toFixed(3)} per day
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 rounded-lg p-4">
                <div className="text-sm text-slate-300 mb-2">Efficiency Gain</div>
                <div className="text-2xl font-bold text-blue-400">
                  +{(parseFloat(multiLoopEstimates.overallApy) - calculateLoopAPY(parseFloat(usdcAmount) || 100, 1).apy).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  vs single loop strategy
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-900/50 to-red-900/50 rounded-lg p-4">
                <div className="text-sm text-slate-300 mb-2">Capital Efficiency</div>
                <div className="text-2xl font-bold text-orange-400">
                  {((parseFloat(multiLoopEstimates.totalCollateral) / parseFloat(multiLoopEstimates.totalInputUsed)) * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  PT-sUSDe per input dollar
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg">
              <div className="text-sm font-medium text-blue-300 mb-2">💡 Strategy Insights:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
                <ul className="space-y-1">
                  <li>• Each loop compounds your yield exposure</li>
                  <li>• Borrowing capacity decreases with each iteration</li>
                  <li>• Total APY increases significantly vs single loop</li>
                </ul>
                <ul className="space-y-1">
                  <li>• Gas costs scale linearly with loop count</li>
                  <li>• Rate spread sustainability is critical</li>
                  <li>• Position becomes more complex to unwind</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
      <Yields />
    </div>
  );

  // Helper function to calculate APY for different loop counts
  function calculateLoopAPY(inputAmount, loopCount) {
    let totalCollateral = 0;
    let totalBorrowed = 0;
    let availableUSDC = inputAmount;

    for (let i = 0; i < loopCount && availableUSDC > 1; i++) {
      const estimatedUSDe = availableUSDC * (1 - 0.005);
      const estimatedSUSDe = estimatedUSDe;
      const estimatedPTSUSDe = estimatedSUSDe * (1 - 0.01);
      const maxBorrowUSDC = estimatedPTSUSDe * 0.75;
      const actualBorrowAmount = Math.min(maxBorrowUSDC, availableUSDC * 0.8);

      totalCollateral += estimatedPTSUSDe;
      totalBorrowed += actualBorrowAmount;
      availableUSDC = actualBorrowAmount;

      if (actualBorrowAmount < 5) break;
    }

    const totalPtYieldAnnual = (totalCollateral * yieldRates.ptSusdeImpliedApy) / 100;
    const totalBorrowCostAnnual = (totalBorrowed * yieldRates.morphoBorrowApy) / 100;
    const netYieldAnnual = totalPtYieldAnnual - totalBorrowCostAnnual;
    const apy = inputAmount > 0 ? (netYieldAnnual / inputAmount) * 100 : 0;
    const leverage = inputAmount > 0 ? (inputAmount + totalBorrowed) / inputAmount : 1;

    return {
      apy: apy.toFixed(1),
      leverage: leverage.toFixed(2)
    };
  }
};

export default App;