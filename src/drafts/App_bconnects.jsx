import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, DollarSign, Zap, AlertCircle, CheckCircle, Target, BarChart3, Percent, RefreshCw, Layers, ArrowRight } from 'lucide-react';

const USDCLoopInterface = () => {
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
  const [balances, setBalances] = useState({
    eth: '0',
    usdc: '0',
    usde: '0',
    susde: '0',
    ptSusde: '0'
  });

  const steps = [
    { name: 'Swap USDC → USDe', icon: '🔄' },
    { name: 'Stake USDe → sUSDe', icon: '🏦' },
    { name: 'Swap sUSDe → PT-sUSDe', icon: '⚡' },
    { name: 'Supply PT & Borrow USDC', icon: '💰' }
  ];

  // Yield rates
  const yieldRates = {
    susdeApy: 12.5,
    ptSusdeImpliedApy: 15.2,
    morphoBorrowApy: 8.3,
    loopedYield: 0
  };

  // Calculate multi-loop estimates
  const calculateMultiLoopEstimates = () => {
    let totalCollateral = 0;
    let totalBorrowed = 0;
    let totalInputUsed = parseFloat(usdcAmount) || 0;
    let loopEstimates = [];
    let availableUSDC = totalInputUsed;

    for (let i = 0; i < maxLoops && availableUSDC > 1; i++) {
      const inputAmount = i === 0 ? availableUSDC : availableUSDC;
      
      // Calculate conversions with slippage
      const estimatedUSDe = inputAmount * (1 - 0.005);
      const estimatedSUSDe = estimatedUSDe;
      const estimatedPTSUSDe = estimatedSUSDe * (1 - 0.01);
      const maxBorrowUSDC = estimatedPTSUSDe * 0.75; // 75% LTV
      
      // Use custom borrow amount for first loop, max for subsequent loops
      const customBorrowAmount = parseFloat(borrowAmount) || 0;
      const actualBorrowAmount = (i === 0 && customBorrowAmount > 0) 
        ? Math.min(customBorrowAmount, maxBorrowUSDC) 
        : Math.min(maxBorrowUSDC, availableUSDC * 0.8); 

      totalCollateral += estimatedPTSUSDe;
      totalBorrowed += actualBorrowAmount;
      
      const loopData = {
        loopNumber: i + 1,
        inputUsdc: inputAmount,
        estimatedUSDe: estimatedUSDe,
        estimatedSUSDe: estimatedSUSDe,
        estimatedPTSUSDe: estimatedPTSUSDe,
        maxBorrowUSDC: maxBorrowUSDC,
        actualBorrowAmount: actualBorrowAmount,
        cumulativeCollateral: totalCollateral,
        cumulativeBorrowed: totalBorrowed
      };
      
      loopEstimates.push(loopData);
      
      // Next loop uses the borrowed USDC
      availableUSDC = actualBorrowAmount;
      
      // Stop if borrowed amount becomes too small
      if (actualBorrowAmount < 5) break;
    }

    // Calculate overall yields
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

  // Connect wallet function
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask.");
      return;
    }

    try {
      const mockAccount = {
        address: '0x742D35Cc6C4C5632C3F77f1c6a4c5b5c5d5e5f60',
        balance: '2.4563',
        chainId: 1
      };
      
      setAccount(mockAccount);
      
      setBalances({
        eth: '2.4563',
        usdc: '2500.00',
        usde: '340.25',
        susde: '158.75',
        ptSusde: '89.50'
      });

      setStatus('Wallet connected successfully');

    } catch (err) {
      console.error("Wallet connection failed:", err);
      setStatus("Wallet connection failed");
    }
  };

  const executeMultiLoop = async () => {
    if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
      setStatus('Please enter a valid USDC amount');
      return;
    }

    if (!account) {
      setStatus('Please connect your wallet first');
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
        
        // Add completed loop to history
        setLoops(prev => [...prev, {
          ...multiLoopEstimates.loops[i],
          completed: true,
          timestamp: new Date().toISOString()
        }]);

        // Small delay between loops
        if (i < multiLoopEstimates.loops.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      setStatus(`✅ All ${multiLoopEstimates.loops.length} loops completed! Total APY: ${multiLoopEstimates.overallApy}%`);
      setCurrentLoop(0);
      setCurrentStep(0);
      
    } catch (error) {
      console.error('Multi-loop failed:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeLoop = async (loopData, loopNumber) => {
    await simulateStep1(loopData, loopNumber);
    await simulateStep2(loopData, loopNumber);
    await simulateStep3(loopData, loopNumber);
    await simulateStep4(loopData, loopNumber);
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
    
    // Update balances to show cumulative effect
    setBalances(prev => ({
      ...prev,
      ptSusde: loopData.cumulativeCollateral.toFixed(2),
      usdc: (parseFloat(prev.usdc) + loopData.actualBorrowAmount).toFixed(2)
    }));
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="w-full bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Multi-Loop USDC Yield Strategy
            </h1>
            <p className="text-slate-400 text-sm">
              Recursive leveraged yield farming with compounding APY
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {account && (
              <div className="text-right">
                <div className="text-sm font-medium text-slate-300">
                  {account.address.slice(0, 6)}...{account.address.slice(-4)}
                </div>
                <div className="text-xs text-slate-400">
                  {account.balance} ETH
                </div>
              </div>
            )}
            <button
              onClick={connectWallet}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                account 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {account ? '✅ Connected' : '🔗 Connect Wallet'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Input & Loop Configuration */}
          <div className="space-y-6">
            
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
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Maximum Loop Iterations
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={maxLoops}
                      onChange={(e) => setMaxLoops(parseInt(e.target.value))}
                      className="flex-1"
                      disabled={!account || isProcessing}
                    />
                    <span className="text-lg font-bold text-purple-400 w-8">{maxLoops}</span>
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
                <div className="flex items-center mb-4">
                  <DollarSign className="w-5 h-5 text-green-400 mr-2" />
                  <h2 className="text-xl font-semibold">Your Balances</h2>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        USDC
                      </div>
                      <span className="text-slate-300">USD Coin</span>
                    </div>
                    <span className="font-semibold text-green-400">{balances.usdc}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        PT
                      </div>
                      <span className="text-slate-300">PT-sUSDe</span>
                    </div>
                    <span className="font-semibold text-pink-400">{balances.ptSusde}</span>
                  </div>
                </div>
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
                </div>
                
                <div className="p-3 bg-gradient-to-r from-yellow-900/50 to-orange-900/50 rounded-lg">
                  <div className="text-xs text-yellow-300 font-medium mb-1">⚠️ Important Notes:</div>
                  <ul className="text-xs text-slate-300 space-y-1">
                    <li>• Higher loops increase complexity and gas costs</li>
                    <li>• Rate spread must remain positive for profitability</li>
                    <li>• Monitor liquidation thresholds closely</li>
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

export default USDCLoopInterface;
