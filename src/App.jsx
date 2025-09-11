import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, DollarSign, Zap, AlertCircle, CheckCircle, Target, BarChart3, Percent, RefreshCw, Layers, ArrowRight, Clock, Award, Star, Gift } from 'lucide-react';
import { ethers } from 'ethers';
import Yields from './Yields.jsx';

import $u from './utils/$u.js';
import ERC20 from './contracts/abizar.json';
import Pendle_PT_25_SEP from './contracts/PT-25Sep.json';
import Morpho_ABI from './contracts/Morpho.json';
import Morpho_IRM from './contracts/Morpho_IRM.json';
import Ethena_SUSDE from './contracts/Ethena_stackedusde.json';
import Ethena_USDE from './contracts/Ethena_usde.json';
import Curve_ABI from './contracts/Curve.json';
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
    ethenaPoints: '0',
    ethenaPointsDaily: '0',
    ptExpirationDate: null
  });

  const [expire, setExpire] = useState('');
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [gasEstimates, setGasEstimates] = useState({
    swapGas: 150000,
    stakeGas: 120000,
    pendleSwapGas: 200000,
    morphoSupplyBorrowGas: 300000,
    gasPriceGwei: 20
  });

  // Contract instances
  const [usdcContract, setUsdcContract] = useState(null);
  const [usdeContract, setUsdeContract] = useState(null);
  const [susdeContract, setSUsdeContract] = useState(null);
  const [curveContract, setCurveContract] = useState(null);
  const [pendlePTContract, setPendlePTContract] = useState(null);
  const [morphoContract, setMorphoContract] = useState(null);

  // Contract addresses (Ethereum mainnet)
  const contracts = {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDE: '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3',
    SUSDE: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497',
    PT_SUSDE: '0x9F56094C450763769BA0EA9Fe2876070c0fD5F77',
    Morpho: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    Morpho_market: '0x3E37BD6E02277F15F93CD7534CE039E60D19D9298F4D1BC6A3A4F7BF64DE0A1C',
    IRM: '0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC',
    CURVE_POOL: "0x02950460e2b9529d0e00284a5fa2d7bdf3fa4d72"
  };

  const PENDLE_MARKET = "0xA36b60A14A1A5247912584768C6e53E1a269a9F7";
  const HOSTED_SDK_URL = 'https://api-v2.pendle.finance/core';
  const CHAIN_ID = 1;

  const steps = [
    { name: 'Swap USDC → USDe', icon: '🔄' },
    { name: 'Stake USDe → sUSDe', icon: '🏦' },
    { name: 'Swap sUSDe → PT-sUSDe', icon: '⚡' },
    { name: 'Supply PT & Borrow USDC', icon: '💰' }
  ];

  // Real yield rates from contracts
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

  // Fetch current gas price
  const fetchGasPrice = async () => {
    if (!account?.signer) return;
    
    try {
      const gasPrice = await account.signer.provider.getGasPrice();
      const gasPriceGwei = parseInt(ethers.utils.formatUnits(gasPrice, 'gwei'));
      
      setGasEstimates(prev => ({
        ...prev,
        gasPriceGwei: gasPriceGwei
      }));
      
      console.log('Current gas price:', gasPriceGwei, 'gwei');
    } catch (error) {
      console.error('Error fetching gas price:', error);
    }
  };

  // Calculate real gas costs in USD
  const calculateGasCosts = () => {
    const { swapGas, stakeGas, pendleSwapGas, morphoSupplyBorrowGas, gasPriceGwei } = gasEstimates;
    const totalGasPerLoop = swapGas + stakeGas + pendleSwapGas + morphoSupplyBorrowGas;
    const totalGasForAllLoops = totalGasPerLoop * maxLoops;
    
    // Estimate ETH price at $2400 (this could be fetched from an oracle)
    const ethPrice = 2400;
    const gasCostEth = (totalGasForAllLoops * gasPriceGwei) / 1e9;
    const gasCostUSD = gasCostEth * ethPrice;
    
    return {
      totalGasUnits: totalGasForAllLoops,
      gasCostEth: gasCostEth.toFixed(6),
      gasCostUSD: gasCostUSD.toFixed(2),
      perLoop: {
        gasUnits: totalGasPerLoop,
        costEth: ((totalGasPerLoop * gasPriceGwei) / 1e9).toFixed(6),
        costUSD: (((totalGasPerLoop * gasPriceGwei) / 1e9) * ethPrice).toFixed(2)
      }
    };
  };

  // Fetch real Morpho borrow rate using contracts
  const fetchMorphoBorrowRate = async () => {
    try {
      if (!morphoContract || !account?.signer) return null;
      
      console.log('Fetching real Morpho data...');
      
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
        console.log('Calculated Morpho APY:', apy.toFixed(4) + '%');
        
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
        return null;
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

      console.log('Fetching real Pendle PT data...');

      // Get onchain info from PT contract
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

      let impliedAPY = 0;

      try {
        console.log('Fetching PT implied APY from Pendle API...');

        const marketResponse = await axios.get(
          `${HOSTED_SDK_URL}/v1/sdk/${CHAIN_ID}/markets/${PENDLE_MARKET}/swapping-prices`
        );

        if (marketResponse.data) {
          const marketData = marketResponse.data;
          console.log('Pendle market data:', marketData);

          // Use impliedApy directly if present
          if (marketData.impliedApy) {
            impliedAPY = parseFloat(marketData.impliedApy) * 100;
            console.log('API Implied APY:', impliedAPY.toFixed(2) + '%');
          }

          // Fallback: calculate from ptToUnderlyingTokenRate
          if ((!impliedAPY || impliedAPY <= 0) && marketData.ptToUnderlyingTokenRate) {
            const ptPrice = parseFloat(marketData.ptToUnderlyingTokenRate);
            const yearsToMaturity = timeToExpiry / 365;

            if (yearsToMaturity > 0 && ptPrice > 0) {
              impliedAPY = (Math.pow(1 / ptPrice, 1 / yearsToMaturity) - 1) * 100;
              console.log('Calculated APY from PT price:', impliedAPY.toFixed(2) + '%');
            }
          }
        }
      } catch (apiError) {
        console.error('Pendle API calls failed:', apiError);
      }

      // Sanity bounds
      if (impliedAPY <= 0 || impliedAPY > 50 || !isFinite(impliedAPY)) {
        console.log('APY seems unreasonable, skipping update...');
        impliedAPY = 0; // Don't update with bad data
      } else {
        console.log('Final PT-sUSDe implied APY:', impliedAPY.toFixed(2) + '%');

        setYieldRates(prev => ({
          ...prev,
          ptSusdeImpliedApy: impliedAPY,
          lastUpdated: new Date().toISOString(),
        }));
      }

      return {
        expiry: expiryDate,
        expiryTimestamp: expiry.toNumber(),
        isExpired,
        daysToExpiry: Math.floor(timeToExpiry),
        impliedAPY,
        apiDataAvailable: impliedAPY > 0,
      };
    } catch (error) {
      console.error('Error fetching Pendle PT data:', error);
      return null;
    }
  };

  // Fetch real Ethena sUSDe data using contracts with historical data
  const fetchEthenaData = async () => {
    try {
      if (!susdeContract || !account?.signer) return null;
      
      console.log('Fetching real Ethena sUSDe data with historical analysis...');
      
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
      
      // Get historical data from different time periods
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
          
          console.log('sUSDe APY Calculation:');
          console.log('Rate growth:', rateGrowth.toFixed(6));
          console.log('Time period (years):', timeInYears.toFixed(3));
          console.log('Calculated APY:', calculatedAPY.toFixed(2) + '%');
        }
      }
      
      // Validate and set the APY
      let finalAPY = calculatedAPY;
      
      // Sanity check - sUSDe APY should be reasonable (1-20% typically)
      if (calculatedAPY < 0.1 || calculatedAPY > 50 || !isFinite(calculatedAPY)) {
        console.log('Calculated sUSDe APY seems unreasonable, not updating...');
        finalAPY = 0; // Don't update with bad data
      } else {
        console.log('Final sUSDe APY:', finalAPY.toFixed(2) + '%');
        
        setYieldRates(prev => ({
          ...prev,
          susdeApy: finalAPY,
          lastUpdated: new Date().toISOString()
        }));
      }
      
      return {
        currentExchangeRate,
        historicalRates,
        calculatedAPY: finalAPY,
        totalValueLocked: currentShareValue,
        totalShares: currentTotalShares
      };
      
    } catch (error) {
      console.error('Error fetching Ethena historical data:', error);
      return null;
    }
  };

  // Fetch balances using contracts
  const fetchBalances = async (address) => {
    if (!address || !usdcContract) return;
    
    try {
      console.log('Fetching real balances for:', address);
      
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

      // Calculate estimated rewards and Ethena points
      const susdeBalance = parseFloat($u.moveDecimalLeft(susdeRaw.toString(), 18));
      const ptSusdeBalance = parseFloat($u.moveDecimalLeft(ptSusdeRaw.toString(), 18));
      const usdeBalance = parseFloat($u.moveDecimalLeft(usdeRaw.toString(), 18));
      
      // Daily rewards calculations
      const susdeRewardsEstimate = yieldRates.susdeApy > 0 ? 
        (susdeBalance * yieldRates.susdeApy / 100 / 365).toFixed(6) : '0';
      const ptSusdeRewardsEstimate = yieldRates.ptSusdeImpliedApy > 0 ? 
        (ptSusdeBalance * yieldRates.ptSusdeImpliedApy / 100 / 365).toFixed(6) : '0';
      
      // Ethena points calculation (2 points per dollar per day for USDe/sUSDe)
      const totalEthenaExposure = usdeBalance + susdeBalance + ptSusdeBalance;
      const ethenaPointsDaily = (totalEthenaExposure * 2).toFixed(0); // 2 points per dollar per day
      const ethenaPointsEstimate = (totalEthenaExposure * 2 * 30).toFixed(0); // Monthly estimate
      
      setRewards({
        susdeRewards: susdeRewardsEstimate,
        ptSusdeRewards: ptSusdeRewardsEstimate,
        ethenaPoints: ethenaPointsEstimate,
        ethenaPointsDaily: ethenaPointsDaily,
        ptExpirationDate: new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000)
      });

      console.log('Balances updated successfully');
      console.log('Ethena points daily:', ethenaPointsDaily);

    } catch (error) {
      console.error('Error fetching balances:', error);
      setStatus('Error fetching balances: ' + error.message);
    }
  };

  // Connect wallet using ethers
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

      const allowedChains = [1, 11155111]; // Ethereum mainnet and Sepolia testnet

      if (!allowedChains.includes(network.chainId)) {
        alert("Please switch to Ethereum mainnet or Sepolia testnet.");
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

      const curve = new ethers.Contract(contracts.CURVE_POOL, Curve_ABI, signer);
      setCurveContract(curve);

      const PT_SUSDE = new ethers.Contract(contracts.PT_SUSDE, Pendle_PT_25_SEP, signer);
      setPendlePTContract(PT_SUSDE);

      const morpho = new ethers.Contract(contracts.Morpho, Morpho_ABI, signer);
      setMorphoContract(morpho);

      setStatus('Wallet connected successfully - Loading real data...');



      // Fetch real data from contracts
      setTimeout(async () => {
        try {
          await fetchGasPrice();
          await fetchBalances(address);
          await fetchMorphoBorrowRate();
          await fetchPendleData();
          await fetchEthenaData();
          await refreshBalances();
          setStatus('All real contract data loaded successfully');
        } catch (error) {
          console.error('Error loading contract data:', error);
          setStatus('Connected but some data failed to load: ' + error.message);
        }
      }, 1000);

      // Event listeners
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          setAccount(null);
          setBalances({ eth: '0', usdc: '0', usde: '0', susde: '0', ptSusde: '0' });
          setStatus('Wallet disconnected');
        } else {
          connectWallet();
        }
      });

      window.ethereum.on('chainChanged', () => {
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
          fetchGasPrice(),
          fetchBalances(account.address),
          fetchMorphoBorrowRate(),
          fetchPendleData(),
          fetchEthenaData()
        ]);
        setStatus('All data refreshed successfully');
      } catch (error) {
        console.error('Error refreshing data:', error);
        setStatus('Error refreshing data: ' + error.message);
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
      const estimatedUSDe = inputAmount * 0.995; // 0.5% slippage for USDC->USDe
      const estimatedSUSDe = estimatedUSDe; // 1:1 conversion
      const estimatedPTSUSDe = estimatedSUSDe * 0.99; // 1% slippage for sUSDe->PT-sUSDe
      const maxBorrowUSDC = estimatedPTSUSDe * (yieldRates.lltv || 0.75); // Use real LLTV or fallback
      
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
      
      if (actualBorrowAmount === 0 || actualBorrowAmount < 5) break;
    }

    // Calculate yields using real rates
    const totalPtYieldAnnual = yieldRates.ptSusdeImpliedApy > 0 ? 
      (totalCollateral * yieldRates.ptSusdeImpliedApy) / 100 : 0;
    const totalBorrowCostAnnual = yieldRates.morphoBorrowApy > 0 ? 
      (totalBorrowed * yieldRates.morphoBorrowApy) / 100 : 0;
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

  // Calculate APY for a single loop
  const calculateLoopAPY = (amount, loopCount) => {
    const estimates = calculateMultiLoopEstimates();
    return {
      apy: estimates.overallApy,
      leverage: estimates.leverageMultiplier
    };
  };

  const multiLoopEstimates = calculateMultiLoopEstimates();
  const gasCosts = calculateGasCosts();

  

  async function callSDK(path, params = {}) {
      const response = await axios.get(HOSTED_SDK_URL + path, {
        params
      });

      return response;
    }

  // Step 1: Swap USDC to USDe via Curve
  const simulateStep11 = async (loopData, loopNumber) => {
    if (!curveContract || !usdcContract) return null;
    setCurrentStep(1);
    setStatus(`Loop ${loopNumber}: Swapping ${loopData.inputUsdc.toFixed(2)} USDC → USDe...`);

    const { address, signer } = account;

    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const amountIn = parseFloat(loopData.inputUsdc) * 1000000; // Convert to 6 decimals
    const minAmountOut = parseFloat(loopData.estimatedUSDe) * Math.pow(10, 18); // 18 decimals

    const poolContract = new ethers.Contract(
      "0x02950460e2b9529d0e00284a5fa2d7bdf3fa4d72",
      [
        "function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint256)"
      ],
      signer
    );
    
    try {
      const allowance = await usdcContract.allowance(address, contracts.CURVE_POOL);
      if (BigInt(allowance.toString()) < BigInt(amountIn.toString())) {
        const approveTx = await usdcContract.approve(contracts.CURVE_POOL, amountIn);
        await approveTx.wait();
      }
      const tx = await poolContract.exchange(1, 0, amountIn, minAmountOut);
      const receipt = await tx.wait();
      setTxHash(receipt.transactionHash);
      
      setStatus("✅ USDC → USDe swap completed");
      setBalances(prev => ({ ...prev, usde: loopData.estimatedUSDe.toString() }));
    } catch (error) {
      console.error('Step 1 error:', error);
      setStatus("❌ USDC → USDe swap failed");
      throw error;
    }
  };


  // Step 1: Swap USDC to USDe via Curve
const simulateStep1 = async (loopData, loopNumber) => {
  if (!curveContract || !usdcContract) {
    throw new Error('Contracts not initialized');
  }
  
  setCurrentStep(1);
  setStatus(`Loop ${loopNumber}: Swapping ${loopData.inputUsdc.toFixed(2)} USDC → USDe...`);

  const { address, signer } = account;

  const poolContract = new ethers.Contract(
      "0x02950460e2b9529d0e00284a5fa2d7bdf3fa4d72",
      [
        "function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint256)"
      ],
      signer
    );

    console.log('Curve contract functions:', Object.keys(curveContract.functions));


  try {
    // Convert amounts with proper decimal handling using string inputs
    const amountIn = ethers.utils.parseUnits(loopData.inputUsdc.toString(), 6); // USDC has 6 decimals
    
    // Calculate minAmountOut with slippage - use string to avoid number precision issues
    const minAmountOutWithSlippage = (parseFloat(loopData.estimatedUSDe) * 0.995).toString();
    const minAmountOut = ethers.utils.parseUnits(minAmountOutWithSlippage, 18); // USDe has 18 decimals

    console.log('Swap parameters:', {
      amountIn: amountIn.toString(),
      minAmountOut: minAmountOut.toString(),
      estimatedUSDe: loopData.estimatedUSDe
    });

    // Check and set allowance
    const allowance = await usdcContract.allowance(address, contracts.CURVE_POOL);
    if (allowance.lt(amountIn)) {
      setStatus(`Approving USDC for Curve pool...`);
      const approveTx = await usdcContract.approve(contracts.CURVE_POOL, amountIn);
      await approveTx.wait();
    }

    setStatus(`Swapping ${loopData.inputUsdc.toFixed(2)} USDC to USDe...`);
    
    // Execute the swap
    const tx = await poolContract.exchange(
      1, // USDC index (check your specific pool)
      0, // USDe index (check your specific pool)
      amountIn,
      minAmountOut,
      // { gasLimit: 300000 } // Add explicit gas limit
    );
    
    const receipt = await tx.wait();
    setTxHash(receipt.transactionHash);
    
    setStatus("✅ USDC → USDe swap completed");
    
    // Update balances (approximate)
    const newUSDeBalance = (parseFloat(balances.usde) + parseFloat(loopData.estimatedUSDe)).toString();
    const newUSDCBalance = (parseFloat(balances.usdc) - parseFloat(loopData.inputUsdc)).toString();
    
    setBalances(prev => ({ 
      ...prev, 
      usdc: newUSDCBalance,
      usde: newUSDeBalance
    }));
    
    return receipt;
  } catch (error) {
    console.error('Step 1 error:', error);
    setStatus("❌ USDC → USDe swap failed: " + error.message);
    throw error;
  }
};

  

   

  










// Step 2: Stake USDe to get sUSDe (Fixed with balance check)
const simulateStep2 = async (loopData, loopNumber) => {
  if (!susdeContract || !usdeContract) return null;

  setCurrentStep(2);
  setStatus(`Loop ${loopNumber}: Staking ${loopData.estimatedUSDe.toFixed(2)} USDe → sUSDe...`);
  const { address } = account;
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const amountInStake = $u.moveDecimalRight(loopData.estimatedUSDe.toString(), 18);
  
  try {
    // Check sUSDe balance before staking
    const susdeBalanceBefore = await susdeContract.balanceOf(address);
    console.log("📊 sUSDe balance before staking:", ethers.utils.formatEther(susdeBalanceBefore));

    const allowanceStake = await usdeContract.allowance(address, contracts.SUSDE);
    if (BigInt(allowanceStake.toString()) < BigInt(amountInStake)) {
      const approveTx = await usdeContract.approve(contracts.SUSDE, amountInStake);
      await approveTx.wait();
    }
    
    const stakeTx = await susdeContract.deposit(amountInStake, address);
    const receiptStake = await stakeTx.wait();
    setTxHash(receiptStake.hash);
    
    // Check ACTUAL sUSDe balance after staking
    const susdeBalanceAfter = await susdeContract.balanceOf(address);
    const actualSUSDeReceived = susdeBalanceAfter.sub(susdeBalanceBefore);
    const actualSUSDeFormatted = parseFloat(ethers.utils.formatEther(actualSUSDeReceived));
    
    console.log("📊 sUSDe balance after staking:", ethers.utils.formatEther(susdeBalanceAfter));
    console.log("📊 Actual sUSDe received:", actualSUSDeFormatted);
    console.log("📊 Expected sUSDe:", loopData.estimatedSUSDe);
    console.log("📊 Conversion ratio:", (actualSUSDeFormatted / loopData.estimatedUSDe).toFixed(4));
    
    // Update loopData with ACTUAL sUSDe amount for next step
    loopData.actualSUSDeReceived = actualSUSDeFormatted;
    
    setStatus("✅ USDe → sUSDe staking completed");
    setBalances(prev => ({ ...prev, susde: actualSUSDeFormatted.toString() }));
    
    return actualSUSDeFormatted; // Return actual amount received
  } catch (error) {
    console.error('Step 2 error:', error);
    setStatus("❌ USDe → sUSDe staking failed");
    throw error;
  }
};

// Step 3: Swap sUSDe to PT-sUSDe via Pendle (Fixed with actual balance)
const simulateStep3 = async (loopData, loopNumber) => {
  setCurrentStep(3);
  
  // Use ACTUAL sUSDe received from step 2, not estimated
  const actualSUSDeToSwap = loopData.actualSUSDeReceived || loopData.estimatedSUSDe;
  setStatus(`Loop ${loopNumber}: Swapping ${actualSUSDeToSwap.toFixed(4)} sUSDe → PT-sUSDe...`);

  const { address, signer } = account;

  await new Promise(resolve => setTimeout(resolve, 2000));

  const amountInWei = $u.moveDecimalRight(actualSUSDeToSwap.toString(), 18);
  const CHAIN_ID = 1;
  const MARKET = '0xA36b60A14A1A5247912584768C6e53E1a269a9F7';

  console.log('=== STEP 3 DEBUG START ===');
  console.log('User address:', address);
  console.log('ACTUAL sUSDe amount to swap (decimal):', actualSUSDeToSwap.toString());
  console.log('ACTUAL sUSDe amount to swap (wei):', amountInWei.toString());
  console.log('Original estimated sUSDe:', loopData.estimatedSUSDe);

  try {
    // Create sUSDe contract instance
    const susdeContract = new ethers.Contract(
      contracts.SUSDE,
      [
        "function balanceOf(address account) external view returns (uint256)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)"
      ],
      signer
    );

    // Verify current sUSDe balance
    const susdeBalance = await susdeContract.balanceOf(address);
    const susdeBalanceFormatted = parseFloat(ethers.utils.formatEther(susdeBalance));
    console.log('=== BALANCE VERIFICATION ===');
    console.log('Current sUSDe balance:', susdeBalanceFormatted);
    console.log('Amount to swap:', actualSUSDeToSwap);
    
    if (susdeBalanceFormatted < actualSUSDeToSwap * 0.75) { // 1% tolerance for rounding
      throw new Error(`Insufficient sUSDe balance. Have: ${susdeBalanceFormatted.toFixed(4)}, Need: ${actualSUSDeToSwap.toFixed(4)}`);
    }

    // Adjust swap amount if needed (use slightly less to avoid rounding errors)
    const safeSwapAmount = Math.min(actualSUSDeToSwap, susdeBalanceFormatted * 0.999);
    const safeAmountInWei = $u.moveDecimalRight(safeSwapAmount.toString(), 18);
    
    console.log('Safe swap amount:', safeSwapAmount);
    console.log('Safe amount in wei:', safeAmountInWei);

    // Call Pendle SDK with safe amount
    console.log('=== CALLING PENDLE SDK ===');
    const res = await callSDK(`/v2/sdk/${CHAIN_ID}/markets/${MARKET}/swap`, {
      receiver: address,
      slippage: 0.01,
      tokenIn: contracts.SUSDE,
      tokenOut: contracts.PT_SUSDE,
      amountIn: safeAmountInWei,
      enableAggregator: false
    });

    console.log('=== PENDLE SDK RESPONSE ===');
    console.log('Transaction data:', res.data.tx);
    
    const spenderAddress = res.data.tx.to;
    console.log('Spender address (router):', spenderAddress);

    // Check and handle approvals
    const currentAllowance = await susdeContract.allowance(address, spenderAddress);
    console.log('Current allowance:', ethers.utils.formatEther(currentAllowance));

    if (currentAllowance.lt(safeAmountInWei)) {
      console.log('=== APPROVAL NEEDED ===');
      setStatus('⏳ Approving sUSDe tokens...');
      
      const maxApproval = ethers.constants.MaxUint256;
      
      // Reset allowance if needed
      if (currentAllowance.gt(0)) {
        console.log('Resetting allowance to 0...');
        const resetTx = await susdeContract.approve(spenderAddress, "0");
        await resetTx.wait();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const approvalTx = await susdeContract.approve(spenderAddress, maxApproval);
      console.log('Approval tx hash:', approvalTx.hash);
      
      const approvalReceipt = await approvalTx.wait();
      console.log('Approval confirmed');
      
      // Verify approval
      const newAllowance = await susdeContract.allowance(address, spenderAddress);
      if (newAllowance.lt(safeAmountInWei)) {
        throw new Error(`Approval failed. Required: ${safeAmountInWei.toString()}`);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Execute swap
    console.log('=== EXECUTING SWAP ===');
    
    const txParams = {
      to: res.data.tx.to,
      data: res.data.tx.data,
      from: res.data.tx.from,
      value: res.data.tx.value || "0"
    };

    // Gas estimation
    try {
      const gasEstimate = await signer.estimateGas(txParams);
      txParams.gasLimit = gasEstimate.mul(120).div(100);
    } catch (gasError) {
      console.log('Using manual gas limit due to estimation failure');
      txParams.gasLimit = "800000";
    }

    setStatus('⏳ Executing swap transaction...');
    
    const tx = await signer.sendTransaction(txParams);
    console.log('Swap transaction sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('Swap confirmed:', receipt.hash);
    
    // Check PT-sUSDe balance after swap
    const ptContract = new ethers.Contract(
      contracts.PT_SUSDE,
      ["function balanceOf(address account) external view returns (uint256)"],
      signer
    );
    
    const ptBalance = await ptContract.balanceOf(address);
    const actualPTReceived = parseFloat(ethers.utils.formatEther(ptBalance));
    
    console.log('📊 Actual PT-sUSDe received:', actualPTReceived);
    
    // Update loopData with actual PT amount
    loopData.actualPTSUSDeReceived = actualPTReceived;
    
    setTxHash(tx.hash);
    setStatus("✅ sUSDe → PT-sUSDe swap completed");
    setBalances(prev => ({ ...prev, ptSusde: actualPTReceived.toString() }));

    return actualPTReceived;

  } catch (error) {
    console.error("Step 3 error:", error);
    
    if (error.message.includes('insufficient allowance')) {
      setStatus("❌ Approval failed - insufficient allowance");
    } else if (error.message.includes('insufficient balance') || error.message.includes('Insufficient sUSDe')) {
      setStatus("❌ Insufficient sUSDe balance for swap");
    } else if (error.message.includes('user rejected')) {
      setStatus("❌ Transaction rejected by user");
    } else if (error.message.includes('UNPREDICTABLE_GAS_LIMIT')) {
      setStatus("❌ Transaction simulation failed - check approvals");
    } else {
      setStatus("❌ sUSDe → PT-sUSDe swap failed");
    }
    
    throw error;
  }
};












// Step 4: Supply PT-sUSDe as collateral and borrow USDC
const simulateStep4 = async (loopData, loopNumber) => {
  if (!usdcContract || !pendlePTContract) return null;

  setCurrentStep(4);
  setStatus(`Loop ${loopNumber}: Supplying ${loopData.estimatedPTSUSDe.toFixed(2)} PT-sUSDe and borrowing ${loopData.actualBorrowAmount.toFixed(2)} USDC...`);

  const { address, signer } = account;
  
  await new Promise(resolve => setTimeout(resolve, 2500));

  // Contracts
  const morphoContract = new ethers.Contract(contracts.Morpho, Morpho_ABI, signer);

  try {
    // First, get the correct market parameters from the existing market ID
    console.log("🔍 Fetching correct market parameters...");
    const marketId = "0x3E37BD6E02277F15F93CD7534CE039E60D19D9298F4D1BC6A3A4F7BF64DE0A1C";
    const marketParams = await morphoContract.idToMarketParams(marketId);
    console.log("📊 Correct market parameters:", marketParams);

    // Check PT-sUSDe balance
    console.log("💰 Checking PT-sUSDe balance...");
    const ptBalance = await pendlePTContract.balanceOf(address);
    const ptBalanceFormatted = parseFloat(ethers.utils.formatEther(ptBalance));
    console.log(`📊 PT-sUSDe balance: ${ptBalanceFormatted.toFixed(4)} PT-sUSDe`);

    // Use actual PT balance, but cap it to what we expect from step 3
    const availablePT = Math.min(ptBalanceFormatted, loopData.estimatedPTSUSDe);
    const collateralAmount = $u.moveDecimalRight(availablePT.toString(), 18);
    
    // Get market LLTV (Loan-to-Value ratio)
    const lltv = parseFloat(ethers.utils.formatEther(marketParams.lltv));
    console.log(`📊 Market LLTV: ${(lltv * 100).toFixed(2)}%`);
    
    // Calculate safe borrow amount (75% of available collateral value)
    // PT-sUSDe ≈ $1, so we can borrow 75% of PT value in USDC
    const safeBorrowAmount = Math.floor(availablePT * 0.75 * 1000000); // 6 decimals for USDC
    const borrowAmount = Math.min(safeBorrowAmount, Math.floor(parseFloat(loopData.actualBorrowAmount) * 1000000));
    
    console.log(`📊 Available PT: ${availablePT.toFixed(4)} PT-sUSDe`);
    console.log(`📊 Safe borrow amount: ${(safeBorrowAmount / 1000000).toFixed(2)} USDC`);
    console.log(`📊 Requested borrow: ${(parseFloat(loopData.actualBorrowAmount)).toFixed(2)} USDC`);
    console.log(`📊 Final borrow amount: ${(borrowAmount / 1000000).toFixed(2)} USDC`);

    if (availablePT < 0.01) {
      throw new Error("Insufficient PT-sUSDe balance for collateral");
    }

    let totalEstimatedGas = ethers.BigNumber.from(0);
    
    // Step 1: Check and approve PT-sUSDe for Morpho contract
    console.log("🔐 Checking PT-sUSDe allowance for Morpho...");
    const allowance = await pendlePTContract.allowance(address, contracts.Morpho);
    if (BigInt(allowance.toString()) < BigInt(collateralAmount)) {
      console.log("🔐 Estimating gas for PT-sUSDe approval...");
      const approveGas = await pendlePTContract.estimateGas.approve(contracts.Morpho, collateralAmount);
      console.log(`⛽ Approve gas estimate: ${approveGas.toString()}`);
      totalEstimatedGas = totalEstimatedGas.add(approveGas);
      
      console.log("🔐 Approving PT-sUSDe for Morpho...");
      const approveTx = await pendlePTContract.approve(contracts.Morpho, collateralAmount);
      await approveTx.wait();
      console.log("✅ PT-sUSDe approved for Morpho.");
    } else {
      console.log("✅ PT-sUSDe already approved for Morpho."); 
    }

    // Step 2: Estimate gas for supply collateral
    console.log("🔐 Estimating gas for collateral supply...");
    const supplyGas = await morphoContract.estimateGas.supplyCollateral(
      marketParams, 
      collateralAmount, 
      address, // onBehalf
      "0x" // data
    );
    console.log(`⛽ Supply collateral gas estimate: ${supplyGas.toString()}`);
    totalEstimatedGas = totalEstimatedGas.add(supplyGas);

    // Step 3: Supply PT-sUSDe as collateral FIRST
    console.log("🏦 Supplying PT-sUSDe as collateral...");
    const supplyTx = await morphoContract.supplyCollateral(
      marketParams, 
      collateralAmount, 
      address, // onBehalf
      "0x", // data
      { gasLimit: supplyGas.mul(110).div(100) } // Add 10% buffer
    );
    const supplyReceipt = await supplyTx.wait();
    console.log("✅ Collateral supplied:", supplyReceipt.hash);
    console.log(`⛽ Actual supply gas used: ${supplyReceipt.gasUsed.toString()}`);

    // Step 4: Now estimate gas for borrow (after collateral is supplied)
    console.log("🔐 Estimating gas for USDC borrow...");
    const borrowGas = await morphoContract.estimateGas.borrow(
      marketParams, 
      borrowAmount,
      0, // shares (0 means calculate from assets)
      address, // onBehalf
      address  // receiver
    );
    console.log(`⛽ Borrow gas estimate: ${borrowGas.toString()}`);
    totalEstimatedGas = totalEstimatedGas.add(borrowGas);

    console.log(`⛽ TOTAL ESTIMATED GAS: ${totalEstimatedGas.toString()}`);
    console.log(`💰 Estimated cost at 20 gwei: ${ethers.utils.formatEther(totalEstimatedGas.mul(20000000000))} ETH`);

    // Step 5: Borrow USDC
    console.log("💰 Borrowing USDC...");
    const borrowTx = await morphoContract.borrow(
      marketParams, 
      borrowAmount,
      0, // shares (0 means calculate from assets)
      address, // onBehalf
      address, // receiver
      { gasLimit: borrowGas.mul(110).div(100) } // Add 10% buffer
    );
    const borrowReceipt = await borrowTx.wait();
    console.log("✅ USDC borrowed:", borrowReceipt.hash);
    console.log(`⛽ Actual borrow gas used: ${borrowReceipt.gasUsed.toString()}`);

    const totalActualGas = supplyReceipt.gasUsed.add(borrowReceipt.gasUsed);
    console.log(`⛽ TOTAL ACTUAL GAS USED: ${totalActualGas.toString()}`);

    setStatus(`✅ Loop completed! Supplied ${actualPTAmount.toFixed(4)} PT-sUSDe, borrowed ${(borrowAmount / 1000000).toFixed(2)} USDC`);
    setCurrentStep(0);

  } catch (err) {
    console.error("❌ Borrow flow failed:", err);
    
    // More specific error handling
    if (err.message.includes("insufficient collateral") || err.message.includes("Insufficient PT-sUSDe")) {
      setStatus("❌ Insufficient collateral. Check PT-sUSDe balance and try smaller amount.");
    } else if (err.message.includes("unauthorized")) {
      setStatus("❌ Authorization failed. Please try again.");
    } else if (err.message.includes("allowance")) {
      setStatus("❌ Token approval failed. Please try again.");
    } else if (err.message.includes("gas")) {
      setStatus("❌ Gas estimation failed. Try adjusting amount.");
    } else {
      setStatus("❌ Morpho borrow failed. Check console for details.");
    }
  }
};

   const Morpho_Borrow1 = async () => {
      if (!morphoContract || !pendlePTContract) return null;
  
  
      const { address } = account;
      
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const amount = "2";
      const collateralAmount = $u.moveDecimalRight(amount, 18);
      const borrowAmount = Math.floor(parseFloat("0") * 1000000); // 6 decimals

      const INTERMEDIARY = "0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0";
      
      try {



      // First, get the correct market parameters from the existing market ID
      console.log("🔍 Fetching correct market parameters...");
      const marketId = "0x3E37BD6E02277F15F93CD7534CE039E60D19D9298F4D1BC6A3A4F7BF64DE0A1C";
      const marketParams = await morphoContract.idToMarketParams(marketId);
      console.log("📊 Correct market parameters:", marketParams);
  
      let totalEstimatedGas = ethers.BigNumber.from(0);
      // Step 1: Check and approve sUSDe for Morpho contract (not intermediary)
      console.log("🔐 Checking PT-sUSDe allowance for Morpho...");
      const allowance = await pendlePTContract.allowance(address, contracts.Morpho);
      if (BigInt(allowance.toString()) < BigInt(collateralAmount)) {
        console.log("🔐 Estimating gas for PT-sUSDe approval...");
        const approveGas = await pendlePTContract.estimateGas.approve(contracts.Morpho, collateralAmount);
        console.log(`⛽ Approve gas estimate: ${approveGas.toString()}`);
        totalEstimatedGas = totalEstimatedGas.add(approveGas);
        
        console.log("🔐 Approving PT-sUSDe for Morpho...");
        const approveTx = await pendlePTContract.approve(contracts.Morpho, collateralAmount);
        await approveTx.wait();
        console.log("✅ PT-sUSDe approved for Morpho.");
      } else {
        console.log("✅ PT-sUSDe already approved for Morpho.");
      }
  
      // Step 2: Check if authorization is already set
      console.log("🔐 Checking Morpho authorization...");
      const isAuthorized = await morphoContract.isAuthorized(address, INTERMEDIARY);
      
      if (!isAuthorized) {
        console.log("🔐 Estimating gas for Morpho authorization...");
        const authGas = await morphoContract.estimateGas.setAuthorization(INTERMEDIARY, true);
        console.log(`⛽ Authorization gas estimate: ${authGas.toString()}`);
        totalEstimatedGas = totalEstimatedGas.add(authGas);
        
        console.log("🏦 Setting Authorization to Morpho...");
        const authTx = await morphoContract.setAuthorization(INTERMEDIARY, true);
        await authTx.wait();
        console.log("✅ Morpho authorization set.");
      } else {
        console.log("✅ Morpho already authorized.");
      }
  
      // Step 3: Estimate gas for supply collateral
      console.log("🔐 Estimating gas for collateral supply...");
      const supplyGas = await morphoContract.estimateGas.supplyCollateral(
        marketParams, 
        collateralAmount, 
        address, // onBehalf
        "0x" // data
      );
      console.log(`⛽ Supply collateral gas estimate: ${supplyGas.toString()}`);
      totalEstimatedGas = totalEstimatedGas.add(supplyGas);
  
      // Step 4: Estimate gas for borrow
      console.log("🔐 Estimating gas for USDC borrow...");
      const borrowGas = await morphoContract.estimateGas.borrow(
        marketParams, // Use the market params struct
        borrowAmount,
        0, // shares (0 means calculate from assets)
        address, // onBehalf
        address  // receiver
      );
      console.log(`⛽ Borrow gas estimate: ${borrowGas.toString()}`);
      totalEstimatedGas = totalEstimatedGas.add(borrowGas);
  
      console.log(`⛽ TOTAL ESTIMATED GAS: ${totalEstimatedGas.toString()}`);
      console.log(`💰 Estimated cost at 20 gwei: ${ethers.utils.formatEther(totalEstimatedGas.mul(20000000000))} ETH`);
  
      // Step 5: Supply sUSDe as collateral
      console.log("🏦 Supplying sUSDe as collateral...");
      const supplyTx = await morphoContract.supplyCollateral(
        marketParams, 
        collateralAmount, 
        address, // onBehalf
        "0x", // data
        { gasLimit: supplyGas.mul(110).div(100) } // Add 10% buffer
      );
      const supplyReceipt = await supplyTx.wait();
      console.log("✅ Collateral supplied:", supplyReceipt.hash);
      console.log(`⛽ Actual supply gas used: ${supplyReceipt.gasUsed.toString()}`);
  
      // Step 6: Borrow USDC
      console.log("💰 Borrowing USDC...");
      const borrowTx = await morphoContract.borrow(
        marketParams, // Use the market params struct
        borrowAmount,
        0, // shares (0 means calculate from assets)
        address, // onBehalf
        address, // receiver
        { gasLimit: borrowGas.mul(110).div(100) } // Add 10% buffer
      );
      const borrowReceipt = await borrowTx.wait();
      console.log("✅ USDC borrowed:", borrowReceipt.hash);
      console.log(`⛽ Actual borrow gas used: ${borrowReceipt.gasUsed.toString()}`);
  
      const totalActualGas = supplyReceipt.gasUsed.add(borrowReceipt.gasUsed);
      console.log(`⛽ TOTAL ACTUAL GAS USED: ${totalActualGas.toString()}`);




































































       //// const marketParams = await morphoContract.idToMarketParams(contracts.Morpho_market);
        
        // Approve PT-sUSDe for Morpho 0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0
        // const allowance = await pendlePTContract.allowance(address, contracts.Morpho);
        // if (BigInt(allowance.toString()) < BigInt(collateralAmount)) {
        //   const approveTx = await pendlePTContract.approve(contracts.Morpho, collateralAmount);
        //   await approveTx.wait();
        // }

        // const allowance = await morphoContract.allowance(address, "0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0");
        // if (BigInt(allowance.toString()) < BigInt(collateralAmount)) {
        //   const approveTx = await morphoContract.approve("0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0", collateralAmount);
        //   await approveTx.wait();
        // }
        
        // Check if authorization is needed
        // const isAuthorized = await morphoContract.isAuthorized(address,"0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0");
        // if (!isAuthorized) {
        //   const authTx = await morphoContract.setAuthorization("0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0", true);
        //   await authTx.wait();
        // }
        
        // Supply collateral
        // const supplyTx = await morphoContract.supplyCollateral(
        //   marketParams, 
        //   collateralAmount, 
        //   address,
        //   "0x"
        // );
        // await supplyTx.wait();
        
        // Borrow USDC
        // const borrowTx = await morphoContract.borrow(
        //   marketParams,
        //   borrowAmount,
        //   0,
        //   address,
        //   address
        // );
        // const borrowReceipt = await borrowTx.wait();
        setTxHash(borrowReceipt.hash);
        
        setStatus(`✅ Loop completed! Borrowed ${loopData.actualBorrowAmount.toFixed(2)} USDC`);
      } catch (error) {
        console.error('Step 4 error:', error);
        setStatus("❌ Supply collateral and borrow failed");
        throw error;
      }
    };

    const Morpho_Borrow2 = async () => {
      if (!morphoContract || !pendlePTContract) return null;

      const { address } = account;
      
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const amount = "2";
      const collateralAmount = $u.moveDecimalRight(amount, 18);
      const borrowAmount = Math.floor(parseFloat("1") * 1000000); // 6 decimals

      const INTERMEDIARY = "0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0";
      
      try {
        // First, get the correct market parameters from the existing market ID
        console.log("🔍 Fetching correct market parameters...");
        const marketId = "0x3E37BD6E02277F15F93CD7534CE039E60D19D9298F4D1BC6A3A4F7BF64DE0A1C";
        const marketParams = await morphoContract.idToMarketParams(marketId);
        console.log("📊 Correct market parameters:", marketParams);

        // Step 1: Check and approve sUSDe for the INTERMEDIARY (not Morpho directly)
        console.log("🔐 Checking PT-sUSDe allowance for Intermediary...");
        const allowance = await pendlePTContract.allowance(address, INTERMEDIARY);
        if (BigInt(allowance.toString()) < BigInt(collateralAmount)) {
          console.log("🔐 Approving PT-sUSDe for Intermediary...");
          const approveTx = await pendlePTContract.approve(INTERMEDIARY, collateralAmount);
          await approveTx.wait();
          console.log("✅ PT-sUSDe approved for Intermediary.");
        } else {
          console.log("✅ PT-sUSDe already approved for Intermediary.");
        }

        // Step 2: Check if authorization is already set for the intermediary
        console.log("🔐 Checking Morpho authorization for Intermediary...");
        const isAuthorized = await morphoContract.isAuthorized(address, INTERMEDIARY);
        
        if (!isAuthorized) {
          console.log("🏦 Setting Authorization to Morpho for Intermediary...");
          const authTx = await morphoContract.setAuthorization(INTERMEDIARY, true);
          await authTx.wait();
          console.log("✅ Morpho authorization set for Intermediary.");
        } else {
          console.log("✅ Morpho already authorized for Intermediary.");
        }

        // Step 3: Create intermediary contract instance for the actual operations
        // You'll need to get the ABI for your intermediary contract
        const intermediaryContract = new ethers.Contract(
          INTERMEDIARY, 
          intermediaryABI, // You need to provide this ABI
          morphoContract.signer
        );

        // Step 4: Use the intermediary contract to supply collateral and borrow
        // The exact method name depends on your intermediary contract implementation
        console.log("🏦 Supplying collateral and borrowing through intermediary...");
        
        // This is a generic example - you'll need to adjust based on your intermediary contract's interface
        const combinedTx = await intermediaryContract.supplyCollateralAndBorrow(
          marketParams,
          collateralAmount,
          borrowAmount,
          address, // onBehalf
          address, // receiver
          {
            gasLimit: 500000 // Set a reasonable gas limit
          }
        );
    
        const receipt = await combinedTx.wait();
        console.log("✅ Operation completed:", receipt.hash);
        console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);

        setTxHash(receipt.hash);
        setStatus(`✅ Loop completed! Borrowed ${(borrowAmount / 1000000).toFixed(2)} USDC`);

      } catch (error) {
        console.error('Transaction error:', error);
        setStatus("❌ Supply collateral and borrow failed");
        throw error;
      }
    };

    // Alternative approach if you don't have a combined function in your intermediary:
    const Morpho_Borrow3 = async () => {
      if (!morphoContract || !pendlePTContract) return null;

      const { address } = account;
      
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const amount = "20000000000";
      const collateralAmount = $u.moveDecimalRight(amount, 18);
      const borrowAmount = Math.floor(parseFloat("1000") * 1000000);

      const INTERMEDIARY = "0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0";
      
      try {
        console.log("🔍 Fetching market parameters...");
        const marketId = "0x3E37BD6E02277F15F93CD7534CE039E60D19D9298F4D1BC6A3A4F7BF64DE0A1C";
        const marketParams = await morphoContract.idToMarketParams(marketId);

        // Step 1: Approve PT-sUSDe for Intermediary
        const allowance = await pendlePTContract.allowance(address, INTERMEDIARY);
        if (BigInt(allowance.toString()) < BigInt(collateralAmount)) {
          const approveTx = await pendlePTContract.approve(INTERMEDIARY, collateralAmount);
          await approveTx.wait();
        }

        // Step 2: Set Morpho authorization for Intermediary
        const isAuthorized = await morphoContract.isAuthorized(address, INTERMEDIARY);
        if (!isAuthorized) {
          const authTx = await morphoContract.setAuthorization(INTERMEDIARY, true);
          await authTx.wait();
        }

        // Step 3 & 4: Supply collateral directly to Morpho
        // Since your logs show this works, we can call Morpho directly for these operations
        console.log("🏦 Supplying collateral...");
        const supplyTx = await morphoContract.supplyCollateral(
          marketParams,
          collateralAmount,
          address,
          "0x",
          { gasLimit: 200000 } // Use manual gas limit to avoid estimation issues
        );
        await supplyTx.wait();

        // Step 5: Borrow from Morpho
        console.log("💰 Borrowing USDC...");
        const borrowTx = await morphoContract.borrow(
          marketParams,
          borrowAmount,
          0,
          address,
          address,
          { gasLimit: 200000 } // Use manual gas limit
        );
        const borrowReceipt = await borrowTx.wait();

        setTxHash(borrowReceipt.hash);
        setStatus(`✅ Loop completed! Borrowed ${(borrowAmount / 1000000).toFixed(2)} USDC`);

      } catch (error) {
        console.error('Transaction error:', error);
        setStatus("❌ Supply collateral and borrow failed");
        throw error;
      }
    };

   const Morpho_Borrow4 = async () => {
  if (!morphoContract || !pendlePTContract) return null;

  const { address } = account;
  
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  const amount = "2";
  
  const collateralAmount = $u.moveDecimalRight(amount, 18);
  const borrowAmount = Math.floor(parseFloat("0") * 1000000); // 6 decimals

  const INTERMEDIARY = "0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0";
  
  // Minimal intermediary ABI - only the functions we need
  const intermediaryABI = [
    {
      "inputs": [
        {
          "components": [
            {"internalType": "address", "name": "loanToken", "type": "address"},
            {"internalType": "address", "name": "collateralToken", "type": "address"},
            {"internalType": "address", "name": "oracle", "type": "address"},
            {"internalType": "address", "name": "irm", "type": "address"},
            {"internalType": "uint256", "name": "lltv", "type": "uint256"}
          ],
          "internalType": "struct MarketParams",
          "name": "marketParams",
          "type": "tuple"
        },
        {"internalType": "uint256", "name": "assets", "type": "uint256"},
        {"internalType": "address", "name": "onBehalf", "type": "address"},
        {"internalType": "bytes", "name": "data", "type": "bytes"}
      ],
      "name": "morphoSupplyCollateral",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {"internalType": "address", "name": "loanToken", "type": "address"},
            {"internalType": "address", "name": "collateralToken", "type": "address"},
            {"internalType": "address", "name": "oracle", "type": "address"},
            {"internalType": "address", "name": "irm", "type": "address"},
            {"internalType": "uint256", "name": "lltv", "type": "uint256"}
          ],
          "internalType": "struct MarketParams",
          "name": "marketParams",
          "type": "tuple"
        },
        {"internalType": "uint256", "name": "assets", "type": "uint256"},
        {"internalType": "uint256", "name": "shares", "type": "uint256"},
        {"internalType": "uint256", "name": "minSharePriceE27", "type": "uint256"},
        {"internalType": "address", "name": "receiver", "type": "address"}
      ],
      "name": "morphoBorrow",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  try {
    // Get market parameters
    console.log("🔍 Fetching market parameters...");
    const marketId = "0x3E37BD6E02277F15F93CD7534CE039E60D19D9298F4D1BC6A3A4F7BF64DE0A1C";
    const marketParams = await morphoContract.idToMarketParams(marketId);
    console.log("📊 Market parameters:", marketParams);

    // Create intermediary contract instance
    const intermediaryContract = new ethers.Contract(
      INTERMEDIARY, 
      intermediaryABI, 
      morphoContract.signer
    );

    // Step 1: Check and approve PT-sUSDe for intermediary
    console.log("🔐 Checking PT-sUSDe allowance for intermediary...");
    const allowance = await pendlePTContract.allowance(address, INTERMEDIARY);
    if (BigInt(allowance.toString()) < BigInt(collateralAmount)) {
      console.log("🔐 Approving PT-sUSDe for intermediary...");
      const approveTx = await pendlePTContract.approve(INTERMEDIARY, collateralAmount);
      await approveTx.wait();
      console.log("✅ PT-sUSDe approved for intermediary.");
    } else {
      console.log("✅ PT-sUSDe already approved for intermediary.");
    }

    // Step 2: Check Morpho authorization for intermediary
    console.log("🔐 Checking Morpho authorization for intermediary...");
    const isAuthorized = await morphoContract.isAuthorized(address, INTERMEDIARY);
    
    if (!isAuthorized) {
      console.log("🏦 Setting Morpho authorization for intermediary...");
      const authTx = await morphoContract.setAuthorization(INTERMEDIARY, true);
      await authTx.wait();
      console.log("✅ Morpho authorization set for intermediary.");
    } else {
      console.log("✅ Morpho already authorized for intermediary.");
    }

    // Step 3: Supply collateral through intermediary
    console.log("🏦 Supplying collateral through intermediary...");
    console.log("Market params:", marketParams);
    console.log("Collateral amount:", collateralAmount);
    console.log("User address:", address);
    
    // Check user's PT-sUSDe balance
    const userBalance = await pendlePTContract.balanceOf(address);
    console.log("User PT-sUSDe balance:", userBalance.toString());
    
    if (BigInt(userBalance.toString()) < BigInt(collateralAmount)) {
      throw new Error(`Insufficient PT-sUSDe balance. Have: ${userBalance.toString()}, Need: ${collateralAmount}`);
    }
    
    const supplyTx = await intermediaryContract.morphoSupplyCollateral(
      marketParams,
      collateralAmount,
      address, // onBehalf
      "0x", // data
      { gasLimit: 400000 } // Increased gas limit
    );
    const supplyReceipt = await supplyTx.wait();
    console.log("✅ Collateral supplied:", supplyReceipt.hash);
    console.log(`⛽ Supply gas used: ${supplyReceipt.gasUsed.toString()}`);

    // Step 4: Borrow through intermediary
    console.log("💰 Borrowing USDC through intermediary...");
    const borrowTx = await intermediaryContract.morphoBorrow(
      marketParams,
      borrowAmount, // assets
      0, // shares (0 means calculate from assets)
      0, // minSharePriceE27 (0 for no slippage protection)
      address, // receiver
      { gasLimit: 300000 } // Manual gas limit
    );
    const borrowReceipt = await borrowTx.wait();
    console.log("✅ USDC borrowed:", borrowReceipt.hash);
    console.log(`⛽ Borrow gas used: ${borrowReceipt.gasUsed.toString()}`);

    const totalGasUsed = supplyReceipt.gasUsed.add(borrowReceipt.gasUsed);
    console.log(`⛽ TOTAL GAS USED: ${totalGasUsed.toString()}`);

    setTxHash(borrowReceipt.hash);
    setStatus(`✅ Loop completed! Borrowed ${(borrowAmount / 1000000).toFixed(2)} USDC`);

  } catch (error) {
    console.error('Transaction error:', error);
    setStatus("❌ Supply collateral and borrow failed");
    throw error;
  }
};

   const Morpho_Borrow = async () => {

    if (!usdcContract || !pendlePTContract) return null;

  const { address, signer } = account;

    // Contracts
    const morphoContract = new ethers.Contract(contracts.Morpho, Morpho_ABI, signer);

    const amount = "1";
  
    // Convert UI amount (e.g. 10) to 18 decimals for sUSDe
    const collateralAmount = $u.moveDecimalRight(amount.toString(), 18).toString();
    
    // Calculate USDC to borrow (assuming 80% LTV for safety)
    // sUSDe ≈ $1, USDC = $1, so we can borrow ~80% of collateral value
    // USDC has 6 decimals, so convert accordingly
    const borrowAmount = Math.floor(parseFloat(amount) * 0.6 * 1000000).toString(); // 80% LTV, 6 decimals

    try {
      // First, get the correct market parameters from the existing market ID
      console.log("🔍 Fetching correct market parameters...");
      const marketId = "0x3E37BD6E02277F15F93CD7534CE039E60D19D9298F4D1BC6A3A4F7BF64DE0A1C";
      const marketParams = await morphoContract.idToMarketParams(marketId);
      console.log("📊 Correct market parameters:", marketParams);
  
      let totalEstimatedGas = ethers.BigNumber.from(0);
      // Step 1: Check and approve sUSDe for Morpho contract (not intermediary)
      console.log("🔐 Checking sUSDe allowance for Morpho...");
      const allowance = await pendlePTContract.allowance(address, contracts.Morpho);
      if (BigInt(allowance.toString()) < BigInt(collateralAmount)) {
        console.log("🔐 Estimating gas for sUSDe approval...");
        const approveGas = await pendlePTContract.estimateGas.approve(contracts.Morpho, collateralAmount);
        console.log(`⛽ Approve gas estimate: ${approveGas.toString()}`);
        totalEstimatedGas = totalEstimatedGas.add(approveGas);
        
        console.log("🔐 Approving sUSDe for Morpho...");
        const approveTx = await pendlePTContract.approve(contracts.Morpho, collateralAmount);
        await approveTx.wait();
        console.log("✅ sUSDe approved for Morpho.");
      } else {
        console.log("✅ sUSDe already approved for Morpho."); 
      }
  
      // Step 2: Check if authorization is already set
      // console.log("🔐 Checking Morpho authorization...");
      // const isAuthorized = await morphoContract.isAuthorized(address, INTERMEDIARY);
      
      // if (!isAuthorized) {
      //   console.log("🔐 Estimating gas for Morpho authorization...");
      //   const authGas = await morphoContract.estimateGas.setAuthorization(INTERMEDIARY, true);
      //   console.log(`⛽ Authorization gas estimate: ${authGas.toString()}`);
      //   totalEstimatedGas = totalEstimatedGas.add(authGas);
        
      //   console.log("🏦 Setting Authorization to Morpho...");
      //   const authTx = await morphoContract.setAuthorization(INTERMEDIARY, true);
      //   await authTx.wait();
      //   console.log("✅ Morpho authorization set.");
      // } else {
      //   console.log("✅ Morpho already authorized.");
      // }
  
      // Step 3: Estimate gas for supply collateral
      console.log("🔐 Estimating gas for collateral supply...");
      const supplyGas = await morphoContract.estimateGas.supplyCollateral(
        marketParams, 
        collateralAmount, 
        address, // onBehalf
        "0x" // data
      );
      console.log(`⛽ Supply collateral gas estimate: ${supplyGas.toString()}`);
      totalEstimatedGas = totalEstimatedGas.add(supplyGas);
  
      // Step 4: Estimate gas for borrow
      console.log("🔐 Estimating gas for USDC borrow...");
      const borrowGas = await morphoContract.estimateGas.borrow(
        marketParams, // Use the market params struct
        borrowAmount,
        0, // shares (0 means calculate from assets)
        address, // onBehalf
        address  // receiver
      );
      console.log(`⛽ Borrow gas estimate: ${borrowGas.toString()}`);
      totalEstimatedGas = totalEstimatedGas.add(borrowGas);
  
      console.log(`⛽ TOTAL ESTIMATED GAS: ${totalEstimatedGas.toString()}`);
      console.log(`💰 Estimated cost at 20 gwei: ${ethers.utils.formatEther(totalEstimatedGas.mul(20000000000))} ETH`);
  
      // Step 5: Supply sUSDe as collateral
      console.log("🏦 Supplying sUSDe as collateral...");
      const supplyTx = await morphoContract.supplyCollateral(
        marketParams, 
        collateralAmount, 
        address, // onBehalf
        "0x", // data
        { gasLimit: supplyGas.mul(110).div(100) } // Add 10% buffer
      );
      const supplyReceipt = await supplyTx.wait();
      console.log("✅ Collateral supplied:", supplyReceipt.hash);
      console.log(`⛽ Actual supply gas used: ${supplyReceipt.gasUsed.toString()}`);
  
      // Step 6: Borrow USDC
      console.log("💰 Borrowing USDC...");
      const borrowTx = await morphoContract.borrow(
        marketParams, // Use the market params struct
        borrowAmount,
        0, // shares (0 means calculate from assets)
        address, // onBehalf
        address, // receiver
        { gasLimit: borrowGas.mul(110).div(100) } // Add 10% buffer
      );
      const borrowReceipt = await borrowTx.wait();
      console.log("✅ USDC borrowed:", borrowReceipt.hash);
      console.log(`⛽ Actual borrow gas used: ${borrowReceipt.gasUsed.toString()}`);
  
      const totalActualGas = supplyReceipt.gasUsed.add(borrowReceipt.gasUsed);
      console.log(`⛽ TOTAL ACTUAL GAS USED: ${totalActualGas.toString()}`);
  
      setStatus(`✅ Successfully borrowed ${(parseFloat(borrowAmount) / 1000000).toFixed(2)} USDC!`);
      setTxHash(borrowReceipt.hash);
  
    } catch (err) {
      console.error("❌ Borrow flow failed:", err);
      
      // More specific error handling
      if (err.message.includes("insufficient collateral")) {
        setStatus("❌ Insufficient collateral for borrow amount.");
      } else if (err.message.includes("unauthorized")) {
        setStatus("❌ Authorization failed. Please try again.");
      } else if (err.message.includes("allowance")) {
        setStatus("❌ Token approval failed. Please try again.");
      } else if (err.message.includes("gas")) {
        setStatus("❌ Gas estimation failed. Try adjusting amount.");
      } else {
        setStatus("❌ Morpho borrow failed. Check console for details.");
      }
    }
  

    
   }

   

  // Updated executeLoop function
  const executeLoop = async (loopData, loopNumber) => {
    const stepActions = loopData.isLastLoop ? [
      () => simulateStep1(loopData, loopNumber),
      () => simulateStep2(loopData, loopNumber),
      () => simulateStep3(loopData, loopNumber)
    ] : [
      () => simulateStep1(loopData, loopNumber),
      () => simulateStep2(loopData, loopNumber),
      () => simulateStep3(loopData, loopNumber),
      () => simulateStep4(loopData, loopNumber)
    ];

    for (const stepAction of stepActions) {
      await stepAction();
    }
  };

  // Execute multi-loop strategy using real contracts
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
        
        // Use the real executeLoop function with actual loopData
        await executeLoop(multiLoopEstimates.loops[i], i + 1);
        
        // Add completed loop to history
        setLoops(prev => [...prev, {
          ...multiLoopEstimates.loops[i],
          completed: true,
          timestamp: new Date().toISOString()
        }]);

        // Small delay between loops if not the last one
        if (i < multiLoopEstimates.loops.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      setStatus(`All ${multiLoopEstimates.loops.length} loops completed! Total APY: ${multiLoopEstimates.overallApy}%`);
      setCurrentLoop(0);
      setCurrentStep(0);
      
      // Refresh balances after completion
      await refreshBalances();
      
    } catch (error) {
      console.error('Multi-loop failed:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
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
              Recursive leveraged yield farming with real contract data
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {account && (
              <div className="text-right">
                <div className="text-sm font-medium text-slate-300">
                  {account.address.slice(0, 6)}...{account.address.slice(-4)}
                </div>
                <div className="text-xs text-slate-400">
                  Chain ID: {account.chainId} {account.chainId === 1 ? '(Ethereum)' : account.chainId === 11155111 ? '(Sepolia)' : ''}
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

          {/* <button onClick={Morpho_Borrow}>  Morpho</button> */}
          
          {/* Left Column - Input & Configuration */}
          <div className="space-y-6">
            {/* Real Yield Rates from Contracts */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <TrendingUp className="w-6 h-6 mr-3 text-green-400" />
                  <h3 className="text-xl font-semibold">Live Yield Rates</h3>
                </div>
                <button
                  onClick={refreshBalances}
                  disabled={isConnecting || !account}
                  className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh all data"
                >
                  <RefreshCw className={`w-4 h-4 ${isConnecting ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              {yieldRates.lastUpdated && (
                <div className="text-xs text-gray-400 mb-3">
                  Last updated: {new Date(yieldRates.lastUpdated).toLocaleTimeString()}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400">sUSDe APY</div>
                  <div className="text-2xl font-bold text-green-400">
                    {yieldRates.susdeApy > 0 ? yieldRates.susdeApy.toFixed(2) : '--'}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">From staking rewards</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400">PT-sUSDe APY</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {yieldRates.ptSusdeImpliedApy > 0 ? yieldRates.ptSusdeImpliedApy.toFixed(2) : '--'}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Fixed yield till expiry</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400">Morpho Borrow</div>
                  <div className="text-2xl font-bold text-red-400">
                    {yieldRates.morphoBorrowApy > 0 ? yieldRates.morphoBorrowApy.toFixed(2) : '--'}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Variable borrow rate</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400">LLTV</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {yieldRates.lltv > 0 ? (yieldRates.lltv * 100).toFixed(1) : '--'}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Max loan-to-value</div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-purple-400 mr-2" />
                    <span className="text-sm text-purple-300">PT Expiry</span>
                  </div>
                  <span className="text-sm text-purple-400 font-medium">{expire || 'Loading...'}</span>
                </div>
                {daysRemaining > 0 && (
                  <div className="text-xs text-slate-400 mt-1">
                    {daysRemaining} days remaining
                  </div>
                )}
              </div>

              {/* Yield Spread Indicator */}
              {yieldRates.ptSusdeImpliedApy > 0 && yieldRates.morphoBorrowApy > 0 && (
                <div className="mt-4 p-3 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-300">Net Yield Spread</span>
                    <span className={`text-sm font-bold ${
                      (yieldRates.ptSusdeImpliedApy - yieldRates.morphoBorrowApy) > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      +{(yieldRates.ptSusdeImpliedApy - yieldRates.morphoBorrowApy).toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {(yieldRates.ptSusdeImpliedApy - yieldRates.morphoBorrowApy) > 0 ? 
                      'Strategy is profitable' : 'Strategy may not be profitable'}
                  </div>
                </div>
              )}
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
                  {account && balances.usdc && parseFloat(balances.usdc) > 0 && (
                    <div className="text-xs text-slate-400 mt-1">
                      Available: {parseFloat(balances.usdc).toFixed(2)} USDC
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
                    Loop Iterations: {maxLoops}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={maxLoops}
                    onChange={(e) => setMaxLoops(parseInt(e.target.value))}
                    className="w-full accent-purple-500"
                    disabled={isProcessing}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    More loops = Higher APY but increased gas costs
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
                    <span className="font-semibold text-green-400">{parseFloat(balances.usdc).toFixed(2)}</span> 
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        USDe
                      </div>
                      <div>
                        <div className="text-slate-300">Ethena USD</div>
                        {parseFloat(balances.usde) > 0 && (
                          <div className="text-xs text-blue-400">
                            +{rewards.ethenaPointsDaily} pts/day
                          </div>
                        )}
                      </div>
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
                          <div className="flex space-x-2 text-xs">
                            <span className="text-green-400">
                              ~{parseFloat(rewards.susdeRewards).toFixed(4)} daily
                            </span>
                            <span className="text-blue-400">
                              +{Math.floor(parseFloat(balances.susde) * 2)} pts/day
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-orange-400">{parseFloat(balances.susde).toFixed(4)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        PT
                      </div>
                      <div>
                        <div className="text-slate-300">PT-sUSDe</div>
                        {parseFloat(balances.ptSusde) > 0 && (
                          <div className="flex space-x-2 text-xs">
                            <span className="text-purple-400">
                              ~{parseFloat(rewards.ptSusdeRewards).toFixed(4)} daily
                            </span>
                            <span className="text-blue-400">
                              +{Math.floor(parseFloat(balances.ptSusde) * 2)} pts/day
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-pink-400">{parseFloat(balances.ptSusde).toFixed(4)}</span>
                  </div>
                </div>

                {/* Ethena Points Summary */}
                {(parseFloat(balances.usde) > 0 || parseFloat(balances.susde) > 0 || parseFloat(balances.ptSusde) > 0) && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <Star className="w-4 h-4 text-blue-400 mr-2" />
                        <span className="text-sm text-blue-300 font-medium">Ethena Points</span>
                      </div>
                      <Gift className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="text-slate-400">Daily Points</div>
                        <div className="text-blue-400 font-bold">{rewards.ethenaPointsDaily}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Monthly Est.</div>
                        <div className="text-purple-400 font-bold">{rewards.ethenaPoints}</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      2 points per dollar of USDe/sUSDe/PT-sUSDe exposure daily
                    </div>
                  </div>
                )}
              </div>
            )}


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
                        {loop.isLastLoop && (
                          <span className="text-xs bg-purple-600 px-2 py-1 rounded">Final</span>
                        )}
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
                    <a 
                      href={`https://etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-300 underline"
                    >
                      View TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                    </a>
                  </div>
                )}
              </div>

              {/* Pre-execution checks */}
              {account && yieldRates.ptSusdeImpliedApy > 0 && yieldRates.morphoBorrowApy > 0 && (
                <div className="mb-4 p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-xs text-slate-400 mb-2">Pre-flight checks:</div>
                  <div className="space-y-1 text-xs">
                    <div className={`flex items-center space-x-2 ${
                      (yieldRates.ptSusdeImpliedApy - yieldRates.morphoBorrowApy) > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      <div className="w-2 h-2 rounded-full bg-current"></div>
                      <span>
                        Net spread: {(yieldRates.ptSusdeImpliedApy - yieldRates.morphoBorrowApy).toFixed(2)}%
                        {(yieldRates.ptSusdeImpliedApy - yieldRates.morphoBorrowApy) > 0 ? ' ✓' : ' ⚠️'}
                      </span>
                    </div>
                    <div className={`flex items-center space-x-2 ${
                      parseFloat(balances.usdc) >= parseFloat(usdcAmount) ? 'text-green-400' : 'text-red-400'
                    }`}>
                      <div className="w-2 h-2 rounded-full bg-current"></div>
                      <span>
                        USDC balance: {parseFloat(balances.usdc).toFixed(2)} 
                        {parseFloat(balances.usdc) >= parseFloat(usdcAmount) ? ' ✓' : ' insufficient'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-yellow-400">
                      <div className="w-2 h-2 rounded-full bg-current"></div>
                      <span>Est. gas cost: {gasCosts.gasCostUSD} USD</span>
                    </div>
                  </div>
                </div>
              )}
              
              <button
                onClick={executeMultiLoop}
                disabled={
                  isProcessing || 
                  !usdcAmount || 
                  parseFloat(usdcAmount) <= 0 || 
                  !account ||
                  parseFloat(balances.usdc) < parseFloat(usdcAmount) ||
                  (yieldRates.ptSusdeImpliedApy > 0 && yieldRates.morphoBorrowApy > 0 && yieldRates.ptSusdeImpliedApy <= yieldRates.morphoBorrowApy)
                }
                className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
                  isProcessing || !usdcAmount || parseFloat(usdcAmount) <= 0 || !account ||
                  parseFloat(balances.usdc) < parseFloat(usdcAmount) ||
                  (yieldRates.ptSusdeImpliedApy > 0 && yieldRates.morphoBorrowApy > 0 && yieldRates.ptSusdeImpliedApy <= yieldRates.morphoBorrowApy)
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg'
                }`}
              >
                {isProcessing ? `Executing Loop ${currentLoop}...` : 
                 !account ? 'Connect Wallet First' :
                 parseFloat(balances.usdc) < parseFloat(usdcAmount) ? 'Insufficient USDC Balance' :
                 (yieldRates.ptSusdeImpliedApy > 0 && yieldRates.morphoBorrowApy > 0 && yieldRates.ptSusdeImpliedApy <= yieldRates.morphoBorrowApy) ? 'Strategy Not Profitable' :
                 `Execute ${multiLoopEstimates.loops.length} Loops (${multiLoopEstimates.overallApy}% APY)`}
              </button>

              {!account && (
                <div className="mt-3 text-xs text-slate-400 text-center">
                  Connect your wallet to see real-time data and execute trades
                </div>
              )}
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
                        Daily rewards: ~{(parseFloat(balances.susde) * parseFloat(yieldRates.susdeApy) / 100 / 365).toFixed(6)} sUSDe
                      </div>
                      <div className="text-sm text-blue-400">
                        Weekly: ~{(parseFloat(balances.susde) * parseFloat(yieldRates.susdeApy) / 100 / 52).toFixed(6)} sUSDe
                      </div>
                      <div className="text-sm text-purple-400">
                        Monthly: ~{(parseFloat(balances.susde) * parseFloat(yieldRates.susdeApy) / 100 / 12).toFixed(6)} sUSDe
                      </div>
                      <div className="text-sm text-yellow-400">
                        Annual: ~{(parseFloat(balances.susde) * parseFloat(yieldRates.susdeApy) / 100).toFixed(6)} sUSDe
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
                        Daily yield: ~{(parseFloat(balances.ptSusde) * parseFloat(yieldRates.ptSusdeImpliedApy) / 100 / 365).toFixed(6)} PT
                      </div>
                      <div className="text-sm text-blue-400">
                        Weekly: ~{(parseFloat(balances.ptSusde) * parseFloat(yieldRates.ptSusdeImpliedApy) / 100 / 52).toFixed(6)} PT
                      </div>
                      <div className="text-sm text-purple-400">
                        Monthly: ~{(parseFloat(balances.ptSusde) * parseFloat(yieldRates.ptSusdeImpliedApy) / 100 / 12).toFixed(6)} PT
                      </div>
                      <div className="text-sm text-yellow-400">
                        Annual: ~{(parseFloat(balances.ptSusde) * parseFloat(yieldRates.ptSusdeImpliedApy) / 100).toFixed(6)} PT
                      </div>
                      {rewards.ptExpirationDate && (
                        <div className="text-sm text-yellow-400 mt-1">
                          Expires: {expire} ({daysRemaining} days remaining)
                        </div>
                      )}
                    </div>
                  )}

                  {/* Total Rewards Summary */}
                  {(parseFloat(balances.susde) > 0 && parseFloat(balances.ptSusde) > 0) && (
                    <div className="bg-gradient-to-r from-purple-800/50 to-blue-800/50 rounded-lg p-4 mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">Total Combined Rewards</span>
                        <span className="text-green-400 font-bold">
                          {(
                            (parseFloat(balances.susde) * parseFloat(yieldRates.susdeApy) / 100) +
                            (parseFloat(balances.ptSusde) * parseFloat(yieldRates.ptSusdeImpliedApy) / 100)
                          ).toFixed(6)} Annual Yield
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-slate-300">Daily:</div>
                        <div className="text-green-400">
                          ~{(
                            (parseFloat(balances.susde) * parseFloat(yieldRates.susdeApy) / 100 / 365) +
                            (parseFloat(balances.ptSusde) * parseFloat(yieldRates.ptSusdeImpliedApy) / 100 / 365)
                          ).toFixed(6)}
                        </div>
                        <div className="text-slate-300">Monthly:</div>
                        <div className="text-blue-400">
                          ~{(
                            (parseFloat(balances.susde) * parseFloat(yieldRates.susdeApy) / 100 / 12) +
                            (parseFloat(balances.ptSusde) * parseFloat(yieldRates.ptSusdeImpliedApy) / 100 / 12)
                          ).toFixed(6)}
                        </div>
                      </div>
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
                    <div key={loops} className={`flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                      isActive ? 'bg-purple-900/50 border border-purple-500' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                    onClick={() => setMaxLoops(loops)}
                    >
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
                  +{(parseFloat(multiLoopEstimates.overallApy) - parseFloat(calculateLoopAPY(parseFloat(usdcAmount) || 100, 1).apy)).toFixed(1)}% 
                  <span className="text-sm font-normal text-slate-400">vs single loop</span>
                </div>
              </div>
            </div>

            {/* Network & Gas Information */}
            {account && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center mb-4">
                  <Zap className="w-5 h-5 text-yellow-400 mr-2" />
                  <h2 className="text-xl font-semibold">Network & Gas</h2>
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
                    <span className="text-sm text-slate-300">Gas Price</span>
                    <span className="text-yellow-400 font-semibold">
                      {gasEstimates.gasPriceGwei} gwei
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <span className="text-sm text-slate-300">Est. Total Gas Cost</span>
                    <div className="text-right">
                      <div className="text-yellow-400 font-semibold">
                        ${gasCosts.gasCostUSD}
                      </div>
                      <div className="text-xs text-slate-400">
                        {gasCosts.gasCostEth} ETH
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <span className="text-sm text-slate-300">Gas per Loop</span>
                    <div className="text-right">
                      <div className="text-purple-400 font-semibold">
                        ${gasCosts.perLoop.costUSD}
                      </div>
                      <div className="text-xs text-slate-400">
                        {gasCosts.perLoop.gasUnits.toLocaleString()} units
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <span className="text-sm text-slate-300">Total Transactions</span>
                    <span className="text-purple-400 font-semibold">
                      {multiLoopEstimates.loops.reduce((acc, loop) => acc + (loop.isLastLoop ? 3 : 4), 0)} TXs
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
                    <div className={`text-lg font-bold ${
                      (yieldRates.ptSusdeImpliedApy - yieldRates.morphoBorrowApy) > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {yieldRates.ptSusdeImpliedApy > 0 && yieldRates.morphoBorrowApy > 0 ? 
                        (yieldRates.ptSusdeImpliedApy - yieldRates.morphoBorrowApy).toFixed(1) : '--'}%
                    </div>
                    <div className="text-xs text-slate-400">Rate Spread</div>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4 text-center">
                    <div className="text-lg font-bold text-blue-400">
                      {yieldRates.lltv > 0 ? (yieldRates.lltv * 100).toFixed(0) : '--'}%
                    </div>
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
                    <span className="text-sm text-slate-300">Gas Cost Impact</span>
                    <span className={`text-sm font-semibold ${
                      parseFloat(gasCosts.gasCostUSD) / parseFloat(usdcAmount || 100) < 0.02 ? 'text-green-400' : 
                      parseFloat(gasCosts.gasCostUSD) / parseFloat(usdcAmount || 100) < 0.05 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {((parseFloat(gasCosts.gasCostUSD) / parseFloat(usdcAmount || 100)) * 100).toFixed(2)}%
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
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">Rate Volatility</span>
                    <span className="text-sm font-semibold text-yellow-400">Medium</span>
                  </div>
                </div>
                
                <div className="p-3 bg-gradient-to-r from-yellow-900/50 to-orange-900/50 rounded-lg">
                  <div className="text-xs text-yellow-300 font-medium mb-1">⚠️ Important Notes:</div>
                  <ul className="text-xs text-slate-300 space-y-1">
                    <li>• Monitor rate spread - must stay positive for profitability</li>
                    <li>• PT tokens expire on {expire || 'Sep 25, 2025'} - plan exit accordingly</li>
                    <li>• Gas costs scale with loop count and network congestion</li>
                    <li>• Higher leverage increases both rewards and risks</li>
                    <li>• Smart contract risks include bugs, exploits, and governance changes</li>
                  </ul>
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
                      <span className="text-purple-400 font-semibold">{multiLoopEstimates.loops[loop.loopNumber-1]?.estimatedPTSUSDe.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Borrowed:</span>
                      <span className="text-yellow-400 font-semibold">{multiLoopEstimates.loops[loop.loopNumber-1]?.actualBorrowAmount.toFixed(2) || '0.00'} USDC</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-300">Efficiency:</span>
                      <span className="text-blue-400">
                        {multiLoopEstimates.loops[loop.loopNumber-1] ? 
                          ((multiLoopEstimates.loops[loop.loopNumber-1].actualBorrowAmount / multiLoopEstimates.loops[loop.loopNumber-1].inputUsdc) * 100).toFixed(1) : 
                          '0.0'}%
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
                  +{(parseFloat(multiLoopEstimates.overallApy) - parseFloat(calculateLoopAPY(parseFloat(usdcAmount) || 100, 1).apy)).toFixed(1)}%
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
              <div className="text-sm font-medium text-blue-300 mb-2">Strategy Insights:</div>
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
};

export default App;