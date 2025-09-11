import { useState } from 'react';
import { ethers } from 'ethers';
import $u from './utils/$u.js';
import ERC20 from './contract/abizar.json';
import UNIVERSAL_ROUTER_ABI from "./contract/Router.json"; 
import PENDLE_LPT from "./contract/pendlelpt.json";
import RouterV4_ABI from "./contract/routerv4pundle.json";


// Constants
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; 
const USDE = "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3";
const UNIVERSAL_ROUTER = "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af";
const SUSDE = "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497";
const PENDLE = "0xA36b60A14A1A5247912584768C6e53E1a269a9F7";
const PENDLE_V4_Router = "0x888888888889758F76e7103c6CbF23ABbF58F946";
const MARKET_LPT_197 = "0xA36b60A14A1A5247912584768C6e53E1a269a9F7"; // Market address
const SY_SUSDE = "0xC01cde799245a25e6EabC550b36A47F6F83cc0f1";


const SUSDE_ABI = [
  "function deposit(uint256 assets, address receiver) external returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)"

];

const FEE_TIER = 3000; // 0.3%


const morpho = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"; // Morpho
const routerM = "0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0"; // intermediate sender/approver
const MORPHO_ABI = [
  "function supplyCollateral(address market, address onBehalf, uint256 amount) external",
  "function borrow(address market, uint256 amount, address onBehalf, address receiver) external"
];

function App() {
  const [account, setAccount] = useState(null);
  const [usdcBalance, setUsdcBalance] = useState("0.00");
  const [usdeBalance, setUsdeBalance] = useState("0.00");
  const [susdeBalance, setSUsdeBalance] = useState("0.00");
  const [pendleBalance, setPendleBalance] = useState("0.00");

  const [usdcContract, setUsdcContract] = useState(null);
  const [usdeContract, setUsdeContract] = useState(null);
  const [susdeContract, setSUsdeContract] = useState(null);
  const [pendleContract, setPendleContract] = useState(null);
  const [pendleV4Contract, setPendleV4Contract] = useState(null);


  const [router, setRouter] = useState(null);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [txHash, setTxHash] = useState('');

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask.");
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      const allowedChains = [1, 8453, 42161, 11155111]; 

        if (!allowedChains.includes(network.chainId)) {
        alert("Please switch to an allowed network: Ethereum, Base, Arbitrum, or Sepolia.");
        return;
        }

      const balance = await provider.getBalance(address);
      const formattedBalance = $u.moveDecimalLeft(balance.toString(), 18);
      setAccount({ address, signer, balance: Number(formattedBalance).toFixed(4), chainId: network.chainId });

      const usdc = new ethers.Contract(USDC, ERC20, signer);
      setUsdcContract(usdc);
      const usdcRaw = await usdc.balanceOf(address);
      setUsdcBalance($u.moveDecimalLeft(usdcRaw.toString(), 6));

      const usde = new ethers.Contract(USDE, ERC20, signer);
      setUsdeContract(usde);
      const usdeRaw = await usde.balanceOf(address);
      setUsdeBalance($u.moveDecimalLeft(usdeRaw.toString(), 18));

      const susde = new ethers.Contract(SUSDE, ERC20, signer);
      setSUsdeContract(susde);
      const susdeRaw = await susde.balanceOf(address);
      setSUsdeBalance($u.moveDecimalLeft(susdeRaw.toString(), 18));



      const pendle = new ethers.Contract(PENDLE, PENDLE_LPT, signer);
      setPendleContract(pendle);
      const pendleRaw = await pendle.balanceOf(address);
      setPendleBalance($u.moveDecimalLeft(pendleRaw.toString(), 18));

      const pendleV4 = new ethers.Contract(PENDLE_V4_Router, RouterV4_ABI, signer);
      setPendleV4Contract(pendleV4);

      const routerContract = new ethers.Contract(UNIVERSAL_ROUTER, UNIVERSAL_ROUTER_ABI, signer);
      setRouter(routerContract);

    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  };

  const handleSwap = async () => {
    if (!account || !amount) return alert("Connect wallet & enter amount");
    setStatus(""); setTxHash("");

    const { address } = account;
    const amountIn = $u.moveDecimalRight(amount, 6);

    const path = ethers.utils.solidityPack(["address", "uint24", "address"], [USDC, FEE_TIER, USDE]);
    const swapInput = ethers.utils.defaultAbiCoder.encode(["address", "uint256", "uint256", "bytes", "bool"], [address, amountIn.toString(), 0, path, false]);
    const commands = "0x101213";
    const inputs = [swapInput, "0x", "0x"];
    const deadline = Math.floor(Date.now() / 1000) + 900;

    try {
      setStatus("💱 Executing swap via Universal Router...");
      const tx = await router.functions["execute(bytes,bytes[],uint256)"](commands, inputs, deadline, { gasLimit: 500000 });
      const receipt = await tx.wait();
      setTxHash(receipt.transactionHash);
      setStatus("✅ Swap done!");

      const usdcRaw = await usdcContract.balanceOf(address);
      setUsdcBalance($u.moveDecimalLeft(usdcRaw.toString(), 6));
      const usdeRaw = await usdeContract.balanceOf(address);
      setUsdeBalance($u.moveDecimalLeft(usdeRaw.toString(), 18));

    } catch (err) {
      console.error("Swap failed:", err);
      setStatus("❌ Swap failed. Check console.");
    }
  };

  const handleStake = async () => {
    if (!account || !usdeContract || !susdeContract || !amount) return;
    setStatus("");
    setTxHash("");
  
    const { signer, address } = account;
  
    // Convert human-readable input (e.g. "1.0") to wei (e.g. "1000000000000000000")
    const amountIn = $u.moveDecimalRight(amount.toString(), 18); // ✅ FIXED
  
    try {
      const allowance = await usdeContract.allowance(address, SUSDE);
  
      if (BigInt(allowance.toString()) < BigInt(amountIn)) {
        setStatus("📝 Approving USDe for staking...");
        const approveTx = await usdeContract.approve(SUSDE, amountIn);
        await approveTx.wait();
      }
  
      setStatus("📥 Staking USDe into sUSDe...");
      const stakeTx = await susdeContract.deposit(amountIn, address);
      const receipt = await stakeTx.wait();
      setTxHash(receipt.hash);
      setStatus("✅ Stake complete!");
  
      // Refresh balances
      const usdeRaw = await usdeContract.balanceOf(address);
      setUsdeBalance($u.moveDecimalLeft(usdeRaw.toString(), 18));
  
      const susdeRaw = await susdeContract.balanceOf(address);
      setSUsdeBalance($u.moveDecimalLeft(susdeRaw.toString(), 18));
  
    } catch (err) {
      console.error("Stake failed:", err);
      setStatus("❌ Staking failed. Check console.");
    }
  };



  const handleAddLiquidityToPendle = async () => {
    if (!account || !pendleV4Contract || !susdeContract || !amount) return;
    setStatus("");
    setTxHash("");
  
    const zeroAddress = ethers.constants.AddressZero;
    const { signer, address } = account;
    const amountIn = $u.moveDecimalRight(amount.toString(), 18).toString();
  
    try {
      // 1. Check sUSDe allowance and approve if needed
      const allowance = await susdeContract.allowance(address, PENDLE_V4_Router);
      if (BigInt(allowance.toString()) < BigInt(amountIn)) {
        setStatus("📝 Approving sUSDe for Pendle Router...");
        const approveTx = await susdeContract.approve(PENDLE_V4_Router, amountIn);
        await approveTx.wait();
      }
  
      setStatus("➕ Adding liquidity to Pendle...");
      const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now
  
      // 2. Prepare all params as objects matching the ABI structs
  
      const tokenInput = {
        tokenIn: SUSDE,           // "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497"
        netTokenIn: amountIn,     // amount in raw decimals
        tokenMintSy: SY_SUSDE,    // "0xC01cde799245a25e6EabC550b36A47F6F83cc0f1"
        pendleSwap: zeroAddress,
        swapData: "0x",
      };
  
      const guessPtReceivedFromSy = {
        guessMin: 0,
        guessMax: 0,
        guessOffchain: 0,
        maxIteration: 0,
        eps: 0,
      };
  
      const limit = {
        limitRouter: zeroAddress,
        epsSkipMarket: 0,
        normalFills: [],
        flashFills: [],
        optData: "0x",
      };
  
      console.log("Add Liquidity Params:", {
        receiver: address,
        market: MARKET_LPT_197,
        minLpOut: 0,
        guessPtReceivedFromSy,
        tokenInput,
        limit,
      });
  
      // 3. Call the contract function
      const tx = await pendleV4Contract.addLiquiditySingleToken(
        address,
        MARKET_LPT_197,
        0, // minLpOut
        guessPtReceivedFromSy,
        tokenInput,
        limit
      );
  
      // 4. Wait for confirmation
      const receipt = await tx.wait();
      setTxHash(receipt.hash);
      setStatus("✅ Liquidity added!");
  
      // 5. Update Pendle LP balance
      const pendleRaw = await pendleContract.balanceOf(address);
      setPendleBalance($u.moveDecimalLeft(pendleRaw.toString(), 18));
    } catch (err) {
      console.error("Add liquidity failed:", err);
      setStatus("❌ Adding liquidity failed. Check console.");
    }
  };


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

  
  
  
  
  
  
  

  

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>🪙 Yields Token Swapper</h1>

      {account ? (
        <>
          <p><strong>Address:</strong> {account.address}</p>
          <p><strong>ETH:</strong> {account.balance}</p>
          <p><strong>USDC:</strong> {usdcBalance}</p>
          <p><strong>USDe:</strong> {usdeBalance}</p>
          <p><strong>SUSDe:</strong> {susdeBalance}</p> 
          <p><strong>Pendle LPT:</strong> {pendleBalance}</p>


          <h3>🔁 Swap USDC → USDe</h3>
          <input
            type="number"
            placeholder="Amount in USDC"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ padding: "0.5rem", marginRight: "1rem" }}
          />
          <button onClick={handleSwap}>Swap</button>

          <h3 style={{ marginTop: "2rem" }}>📥 Stake USDe → sUSDe</h3>
          <button onClick={handleStake}>Stake</button>


          <h3 style={{ marginTop: "2rem" }}>➕ Add Liquidity to Pendle</h3>
          <button onClick={handleAddLiquidityToPendle}>Add Liquidity</button>

          <h3 style={{ marginTop: "2rem" }}>🏦 Borrow USDC via Morpho</h3>
            <button onClick={handleMorphoBorrow}>Borrow USDC</button>



          <p>{status}</p>
          {txHash && (
            <a
              href={`https://etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Etherscan
            </a>
          )}
        </>
      ) : (
        <button onClick={connectWallet}>🔌 Connect Wallet</button>
      )}
    </div>
  );
}

export default App;