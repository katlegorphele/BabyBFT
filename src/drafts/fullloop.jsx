import React from 'react'



const handleMorphoBorrow = async () => {
  if (!account || !amount || !susdeBalance || !susdeContract || !usdcContract) return;
  setStatus("");
  setTxHash("");

  const { signer, address } = account;

  // Contracts
  const morphoContract = new ethers.Contract(MORPHO_ADDRESS, MORPHO_ABI, signer);

  // Convert UI amount (e.g. 10) to 18 decimals for sUSDe
  const collateralAmount = $u.moveDecimalRight(amount.toString(), 18).toString();
  
  // Calculate USDC to borrow (assuming 80% LTV for safety)
  // sUSDe ≈ $1, USDC = $1, so we can borrow ~80% of collateral value
  // USDC has 6 decimals, so convert accordingly
  const borrowAmount = Math.floor(parseFloat(amount) * 0.8 * 1000000).toString(); // 80% LTV, 6 decimals

  try {
    // First, get the correct market parameters from the existing market ID
    console.log("🔍 Fetching correct market parameters...");
    const marketId = "0x85C7F4374F3A403B36D54CC284983B2B02BBD8581EE0F3C36494447B87D9FCAB";
    const marketParams = await morphoContract.idToMarketParams(marketId);
    console.log("📊 Correct market parameters:", marketParams);

    let totalEstimatedGas = ethers.BigNumber.from(0);
    // Step 1: Check and approve sUSDe for Morpho contract (not intermediary)
    console.log("🔐 Checking sUSDe allowance for Morpho...");
    const allowance = await susdeContract.allowance(address, MORPHO_ADDRESS);
    if (BigInt(allowance.toString()) < BigInt(collateralAmount)) {
      console.log("🔐 Estimating gas for sUSDe approval...");
      const approveGas = await susdeContract.estimateGas.approve(MORPHO_ADDRESS, collateralAmount);
      console.log(`⛽ Approve gas estimate: ${approveGas.toString()}`);
      totalEstimatedGas = totalEstimatedGas.add(approveGas);
      
      console.log("🔐 Approving sUSDe for Morpho...");
      const approveTx = await susdeContract.approve(MORPHO_ADDRESS, collateralAmount);
      await approveTx.wait();
      console.log("✅ sUSDe approved for Morpho.");
    } else {
      console.log("✅ sUSDe already approved for Morpho.");
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
};


const fullLoop = async () => {
    if (!account || !amount || !usdcContract || !susdeContract) return;
      
    setStatus("Preparing swap...");
    setTxHash("");

    const { signer, address } = account;


    const poolContract = new ethers.Contract(
      "0x02950460e2b9529d0e00284a5fa2d7bdf3fa4d72",
      [
        "function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint256)"
      ],
      signer
    );

    const amountIn = ethers.BigNumber.from("200000"); // 200000 USDC (6 decimals)
    const minAmountOut = ethers.BigNumber.from("199000000000000000"); // ~199 USDe

    // 1. Approve the pool to spend USDC
    console.log("Approving Curve Pool to spend USDC...");

    const allowance = await usdcContract.allowance(address, CURVE_POOL);
      if (BigInt(allowance.toString()) < BigInt(amountIn.toString())) {
          setStatus("Approving Curve Pool to spend USDC...");
          const approveTx = await usdcContract.approve(CURVE_POOL, amountIn);
          await approveTx.wait();
          setStatus("✅ Approval confirmed");
      }

    // 2. Call exchange(i = 1, j = 0, amountIn, minAmountOut)
    console.log("Swapping USDC for USDe...");
    const tx = await poolContract.exchange(1, 0, amountIn, minAmountOut);
    const receipt = await tx.wait();
    console.log("Swap successful ✅");
    console.log("Transaction hash:", receipt.transactionHash);






    setStatus("Preparing swap...");
    setTxHash("");


    // 3. Stake USDe to get sUSDe 

    // Convert human-readable input (e.g. "1.0") to wei (e.g. "1000000000000000000")
    const amountInStake = $u.moveDecimalRight(amount.toString(), 18); 
  

    const allowanceStake = await usdeContract.allowance(address, SUSDE);
  
      if (BigInt(allowanceStake.toString()) < BigInt(amountInStake)) {
        setStatus("📝 Approving USDe for staking...");
        const approveTx = await usdeContract.approve(SUSDE, amountInStake);
        await approveTx.wait();
      }
  
      setStatus("📥 Staking USDe into sUSDe...");
      const stakeTx = await susdeContract.deposit(amountInStake, address);
      const receiptStake = await stakeTx.wait();
      setTxHash(receiptStake.hash);
      setStatus("✅ Stake complete!");
  
      // Refresh balances
      const usdeRaw = await usdeContract.balanceOf(address);
      setUsdeBalance($u.moveDecimalLeft(usdeRaw.toString(), 18));
  
      const susdeRaw = await susdeContract.balanceOf(address);
      setSUsdeBalance($u.moveDecimalLeft(susdeRaw.toString(), 18));























      setStatus("Preparing swap...");
      setTxHash("");

      try {
        const { signer, address } = account;
        
        // Convert amount to wei (sUSDe has 18 decimals)
        const amountInWei = $u.moveDecimalRight(amount.toString(), 18).toString();
        
        setStatus("Fetching swap data from Pendle...");
        
        // Get swap data from Pendle SDK - using v2 endpoint
        const res = await callSDK(`/v2/sdk/${CHAIN_ID}/markets/${MARKET}/swap`, {
            receiver: address, // Use the connected wallet address as receiver
            slippage: 0.01, // 1% slippage
            tokenIn: SUSDE, // Use your SUSDE constant
            tokenOut: SUSDE_PT_ADDRESS,
            amountIn: amountInWei,
            enableAggregator: false // Set to true if you want to use aggregators
        }); 
        
        console.log("Amount sUSDe PT Out:", res.data.amountOut);
        console.log("Price impact:", res.data.priceImpact);
        console.log("Transaction data:", res.tx);
        
        setStatus("Checking token approval...");
        
        // Handle token approvals if needed
        if (res.tokenApprovals && res.tokenApprovals.length > 0) {
            for (const approval of res.tokenApprovals) {
                console.log(`Need to approve ${approval.amount} of token ${approval.token}`);
                
                // You'll need to implement token approval here
                // This typically involves calling the approve function on the ERC20 contract
                setStatus(`Approving ${approval.token}...`);
                
                // Example approval transaction (you'll need to implement this based on your setup)
                const approvalTx = await approveToken(approval.token, approval.amount, signer);
                await approvalTx.wait();
            }
        }
        
        setStatus("Executing swap...");
        
        // Send the swap transaction
        const tx = await signer.sendTransaction({
            to: res.tx.to,
            data: res.tx.data,
            from: res.tx.from,
            value: res.tx.value || "0" // Include value if needed (usually 0 for token swaps)
        });
        
        setStatus("Transaction submitted. Waiting for confirmation...");
        setTxHash(tx.hash);
        
        // Wait for transaction confirmation
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            setStatus("Swap completed successfully!");
            console.log("Transaction successful:", receipt);
        } else {
            setStatus("Transaction failed");
            console.error("Transaction failed:", receipt);
        }
        
    } catch (error) {
        console.error("Swap error:", error);
        setStatus(`Error: ${error.message}`);
    }




























    if (!account || !amount || !susdeBalance || !susdeContract || !usdcContract) return;
    setStatus("Preparing to Supply and Borrow");
    setTxHash("");
  
  
    // Contracts
    const morphoContract = new ethers.Contract(MORPHO_ADDRESS, MORPHO_ABI, signer);
  
    // Convert UI amount (e.g. 10) to 18 decimals for sUSDe
    const collateralAmount = $u.moveDecimalRight(amount.toString(), 18).toString();
    
    // Calculate USDC to borrow (assuming 80% LTV for safety)
    // sUSDe ≈ $1, USDC = $1, so we can borrow ~80% of collateral value
    // USDC has 6 decimals, so convert accordingly
    const borrowAmount = Math.floor(parseFloat(amount) * 0.8 * 1000000).toString(); // 80% LTV, 6 decimals

    try {
      // First, get the correct market parameters from the existing market ID
      console.log("🔍 Fetching correct market parameters...");
      const marketId = "0x85C7F4374F3A403B36D54CC284983B2B02BBD8581EE0F3C36494447B87D9FCAB";
      const marketParams = await morphoContract.idToMarketParams(marketId);
      console.log("📊 Correct market parameters:", marketParams);
  
      let totalEstimatedGas = ethers.BigNumber.from(0);
      // Step 1: Check and approve sUSDe for Morpho contract (not intermediary)
      console.log("🔐 Checking sUSDe allowance for Morpho...");
      const allowance = await susdeContract.allowance(address, MORPHO_ADDRESS);
      if (BigInt(allowance.toString()) < BigInt(collateralAmount)) {
        console.log("🔐 Estimating gas for sUSDe approval...");
        const approveGas = await susdeContract.estimateGas.approve(MORPHO_ADDRESS, collateralAmount);
        console.log(`⛽ Approve gas estimate: ${approveGas.toString()}`);
        totalEstimatedGas = totalEstimatedGas.add(approveGas);
        
        console.log("🔐 Approving sUSDe for Morpho...");
        const approveTx = await susdeContract.approve(MORPHO_ADDRESS, collateralAmount);
        await approveTx.wait();
        console.log("✅ sUSDe approved for Morpho.");
      } else {
        console.log("✅ sUSDe already approved for Morpho.");
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

const fullloop = () => {
  return (
    <div>
      
    </div>
  )
}

export default fullloop
