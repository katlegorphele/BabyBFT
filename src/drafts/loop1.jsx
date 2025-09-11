import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, DollarSign, Zap, AlertCircle, CheckCircle } from 'lucide-react';

const USDCLoopInterface = () => {
  const [usdcAmount, setUsdcAmount] = useState('100');
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState('Ready to start');
  const [txHash, setTxHash] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [balances, setBalances] = useState({
    usdc: '0',
    usde: '0',
    susde: '0',
    ptSusde: '0'
  });


  //   Correct addresses identified:

// Pendle Router V4: 0x888888888889758F76e7103c6CbF23ABbF58F946
// SY-sUSDe Token: 0xC01cde799245a25e6EabC550b36a47f6F83cc0f1
// Market (LP Token): 0xA36b60A14A1A5247912584768C6e53E1a269a9F7


  // Constants (you'll need to set these properly)
  const CURVE_POOL = "0x02950460e2b9529d0e00284a5fa2d7bdf3fa4d72";
  const SUSDE = "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497";
  const SUSDE_PT_ADDRESS = "0x8A4AcD3c4F34Fc3Df3cB8Eb5e48fc6DE2c23C2F8"; // Example PT address
  const MORPHO_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
  const INTERMEDIARY = "0x4095F064B8d3c3548A3bebfd0Bbfd04750E30077";
  const CHAIN_ID = 1; // Ethereum mainnet
  const MARKET = "0x85C7F4374F3A403B36D54CC284983B2B02BBD8581EE0F3C36494447B87D9FCAB";

  const steps = [
    { name: 'Swap USDC → USDe', icon: '🔄' },
    { name: 'Stake USDe → sUSDe', icon: '🏦' },
    { name: 'Swap sUSDe → PT-sUSDe', icon: '⚡' },
    { name: 'Supply PT & Borrow USDC', icon: '💰' }
  ];

  // Calculate estimates
  const calculateEstimates = () => {
    const inputAmount = parseFloat(usdcAmount) || 0;
    const slippage = 0.02; // 2% total slippage across all steps
    
    const estimatedUSDe = inputAmount * (1 - 0.005); // 0.5% swap slippage
    const estimatedSUSDe = estimatedUSDe; // 1:1 staking
    const estimatedPTSUSDe = estimatedSUSDe * (1 - 0.01); // 1% Pendle slippage
    const maxBorrowUSDC = estimatedPTSUSDe * 0.75; // 75% LTV for safety
    
    return {
      estimatedUSDe: estimatedUSDe.toFixed(2),
      estimatedSUSDe: estimatedSUSDe.toFixed(2),
      estimatedPTSUSDe: estimatedPTSUSDe.toFixed(2),
      maxBorrowUSDC: maxBorrowUSDC.toFixed(2)
    };
  };

  const estimates = calculateEstimates();

  // Mock utility functions (replace with your actual implementations)
  const $u = {
    moveDecimalRight: (amount, decimals) => {
      return (parseFloat(amount) * Math.pow(10, decimals)).toString();
    },
    moveDecimalLeft: (amount, decimals) => {
      return (parseFloat(amount) / Math.pow(10, decimals)).toString();
    }
  };

  const fullLoop = async () => {
    if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
      setStatus('Please enter a valid USDC amount');
      return;
    }

    setIsProcessing(true);
    setCurrentStep(0);
    
    try {
      // You'll need to implement account connection
      // const { account, usdcContract, usdeContract, susdeContract } = await getContracts();
      // For now, we'll simulate the process
      
      await simulateStep1(); // USDC → USDe
      await simulateStep2(); // USDe → sUSDe  
      await simulateStep3(); // sUSDe → PT-sUSDe
      await simulateStep4(); // Supply PT & Borrow USDC
      
    } catch (error) {
      console.error('Loop failed:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 1: Swap USDC to USDe via Curve
  const simulateStep1 = async () => {
    setCurrentStep(1);
    setStatus("Swapping USDC → USDe...");
    
    // Simulate the actual swap logic here
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const amountIn = parseFloat(usdcAmount) * 1000000; // Convert to 6 decimals
    const minAmountOut = parseFloat(estimates.estimatedUSDe) * Math.pow(10, 18); // 18 decimals
    
    
    const poolContract = new ethers.Contract(CURVE_POOL, ABI, signer);
    const allowance = await usdcContract.allowance(address, CURVE_POOL);
    if (BigInt(allowance.toString()) < BigInt(amountIn.toString())) {
      const approveTx = await usdcContract.approve(CURVE_POOL, amountIn);
      await approveTx.wait();
    }
    const tx = await poolContract.exchange(1, 0, amountIn, minAmountOut);
    const receipt = await tx.wait();
    setTxHash(receipt.transactionHash);
    
    
    setStatus("✅ USDC → USDe swap completed");
    setBalances(prev => ({ ...prev, usde: estimates.estimatedUSDe }));
  };

  // Step 2: Stake USDe to get sUSDe
  const simulateStep2 = async () => {
    setCurrentStep(2);
    setStatus("Staking USDe → sUSDe...");
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const amountInStake = $u.moveDecimalRight(estimates.estimatedUSDe, 18);
    
    // Your actual staking logic:
    
    const allowanceStake = await usdeContract.allowance(address, SUSDE);
    if (BigInt(allowanceStake.toString()) < BigInt(amountInStake)) {
      const approveTx = await usdeContract.approve(SUSDE, amountInStake);
      await approveTx.wait();
    }
    const stakeTx = await susdeContract.deposit(amountInStake, address);
    const receiptStake = await stakeTx.wait();
    setTxHash(receiptStake.hash);
    
    
    setStatus("✅ USDe → sUSDe staking completed");
    setBalances(prev => ({ ...prev, susde: estimates.estimatedSUSDe }));
  };

  // Step 3: Swap sUSDe to PT-sUSDe via Pendle
  const simulateStep3 = async () => {
    setCurrentStep(3);
    setStatus("Swapping sUSDe → PT-sUSDe...");
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const amountInWei = $u.moveDecimalRight(estimates.estimatedSUSDe, 18);
    
    // Your actual Pendle swap logic:
    
    const res = await callSDK(`/v2/sdk/${CHAIN_ID}/markets/${MARKET}/swap`, {
      receiver: address,
      slippage: 0.01,
      tokenIn: SUSDE,
      tokenOut: SUSDE_PT_ADDRESS,
      amountIn: amountInWei,
      enableAggregator: false
    });
    
    if (res.tokenApprovals && res.tokenApprovals.length > 0) {
      for (const approval of res.tokenApprovals) {
        const approvalTx = await approveToken(approval.token, approval.amount, signer);
        await approvalTx.wait();
      }
    }
    
    const tx = await signer.sendTransaction({
      to: res.tx.to,
      data: res.tx.data,
      from: res.tx.from,
      value: res.tx.value || "0"
    });
    const receipt = await tx.wait();
    setTxHash(tx.hash);
    
    
    setStatus("✅ sUSDe → PT-sUSDe swap completed");
    setBalances(prev => ({ ...prev, ptSusde: estimates.estimatedPTSUSDe }));
  };

  // Step 4: Supply PT-sUSDe as collateral and borrow USDC
  const simulateStep4 = async () => {
    setCurrentStep(4);
    setStatus("Supplying collateral and borrowing USDC...");
    
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const collateralAmount = $u.moveDecimalRight(estimates.estimatedPTSUSDe, 18);
    const borrowAmount = Math.floor(parseFloat(estimates.maxBorrowUSDC) * 1000000); // 6 decimals
    
    // Your actual Morpho supply and borrow logic:
    
    const morphoContract = new ethers.Contract(MORPHO_ADDRESS, MORPHO_ABI, signer);
    const marketId = MARKET;
    const marketParams = await morphoContract.idToMarketParams(marketId);
    
    // Approve PT-sUSDe for Morpho
    const allowance = await ptSusdeContract.allowance(address, MORPHO_ADDRESS);
    if (BigInt(allowance.toString()) < BigInt(collateralAmount)) {
      const approveTx = await ptSusdeContract.approve(MORPHO_ADDRESS, collateralAmount);
      await approveTx.wait();
    }
    
    // Set authorization if needed
    const isAuthorized = await morphoContract.isAuthorized(address, INTERMEDIARY);
    if (!isAuthorized) {
      const authTx = await morphoContract.setAuthorization(INTERMEDIARY, true);
      await authTx.wait();
    }
    
    // Supply collateral
    const supplyTx = await morphoContract.supplyCollateral(
      marketParams, 
      collateralAmount, 
      address,
      "0x"
    );
    await supplyTx.wait();
    
    // Borrow USDC
    const borrowTx = await morphoContract.borrow(
      marketParams,
      borrowAmount,
      0,
      address,
      address
    );
    const borrowReceipt = await borrowTx.wait();
    setTxHash(borrowReceipt.hash);
    
    
    setStatus(`✅ Loop completed! Borrowed ${estimates.maxBorrowUSDC} USDC`);
    setCurrentStep(4);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 min-h-screen text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          USDC Yield Loop
        </h1>
        <p className="text-slate-300">
          Swap USDC → USDe → sUSDe → PT-sUSDe, then supply as collateral to borrow back USDC
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
        <div className="flex items-center mb-4">
          <DollarSign className="w-5 h-5 text-green-400 mr-2" />
          <h2 className="text-xl font-semibold">Input Amount</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              USDC Amount to Loop
            </label>
            <input
              type="number"
              value={usdcAmount}
              onChange={(e) => setUsdcAmount(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter USDC amount"
              min="1"
              step="0.01"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {[100, 500, 1000].map((amount) => (
              <button
                key={amount}
                onClick={() => setUsdcAmount(amount.toString())}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm font-medium transition-colors"
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Estimates Section */}
      <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
        <div className="flex items-center mb-4">
          <Calculator className="w-5 h-5 text-blue-400 mr-2" />
          <h2 className="text-xl font-semibold">Estimated Outputs</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">USDe</div>
            <div className="text-lg font-bold text-green-400">{estimates.estimatedUSDe}</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">sUSDe</div>
            <div className="text-lg font-bold text-blue-400">{estimates.estimatedSUSDe}</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">PT-sUSDe</div>
            <div className="text-lg font-bold text-purple-400">{estimates.estimatedPTSUSDe}</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Max Borrow</div>
            <div className="text-lg font-bold text-yellow-400">{estimates.maxBorrowUSDC} USDC</div>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
        <div className="flex items-center mb-4">
          <TrendingUp className="w-5 h-5 text-purple-400 mr-2" />
          <h2 className="text-xl font-semibold">Progress</h2>
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

      {/* Status and Action */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Zap className="w-5 h-5 text-yellow-400 mr-2" />
            <h2 className="text-xl font-semibold">Execute Loop</h2>
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
          onClick={fullLoop}
          disabled={isProcessing || !usdcAmount || parseFloat(usdcAmount) <= 0}
          className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
            isProcessing || !usdcAmount || parseFloat(usdcAmount) <= 0
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg'
          }`}
        >
          {isProcessing ? 'Executing Loop...' : `Execute Full Loop with ${usdcAmount} USDC`}
        </button>
        
        {parseFloat(estimates.maxBorrowUSDC) > 0 && (
          <div className="mt-4 p-3 bg-slate-700 rounded-lg">
            <div className="text-sm text-slate-300 mb-1">Expected Result:</div>
            <div className="text-green-400 font-semibold">
              Borrow up to {estimates.maxBorrowUSDC} USDC against {estimates.estimatedPTSUSDe} PT-sUSDe collateral
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default USDCLoopInterface;