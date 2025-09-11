// src/App.js
import { useState } from 'react';
import { ethers } from "ethers";
import $u from './utils/$u.js';
import ERC20 from './contract/abizar.json';

function App() {
  const [account, setAccount] = useState(null);
  const [usdcBalance, setUsdcBalance] = useState("0.00");
  const [usdccontract, setUsdcContract] = useState(null);

  const [usdeBalance, setUsdeBalance] = useState("0.00");
  const [usdecontract, setUsdeContract] = useState(null);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install Metamask to use this app.");
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      if (network.chainId !== 1) {
        alert("Please switch to Ethereum Mainnet");
        return;
      }

      const ethBalance = await provider.getBalance(address);
      const formattedBalance = $u.moveDecimalLeft(ethBalance.toString(), 18);

      setAccount({
        address,
        balance: Number(formattedBalance).toFixed(4),
        chainId: network.chainId
      });

      const usde = new ethers.Contract(
        "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3",
        ERC20,
        signer
      );
      setUsdeContract(usde);
      const usdeRaw = await usde.balanceOf(address);
      const usdeFormatted = $u.moveDecimalLeft(usdeRaw.toString(), 18);
      setUsdeBalance(Number(usdeFormatted).toFixed(2));

      const usdc = new ethers.Contract(
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        ERC20,
        signer
      );
      setUsdcContract(usdc);
      const usdcRaw = await usdc.balanceOf(address);
      const usdcFormatted = $u.moveDecimalLeft(usdcRaw.toString(), 6);
      setUsdcBalance(Number(usdcFormatted).toFixed(2));

    } catch (err) {
      console.error("Connection failed:", err);
    }
  };

  const swapUSDCtoUSDE = async (amount) => {
    if (!usdccontract || !usdecontract || !account) return;

    try {
      const decimals = 6;
      const amt = ethers.utils.parseUnits(amount.toString(), decimals);

      const allowance = await usdccontract.allowance(account.address, usdecontract.address);
      if (allowance.lt(amt)) {
        const approveTx = await usdccontract.approve(usdecontract.address, amt);
        await approveTx.wait();
      }

      const transferTx = await usdccontract.transfer(usdecontract.address, amt);
      await transferTx.wait();

      alert(`Swapped ${amount} USDC to USDE`);
      connectWallet(); // Refresh balances

    } catch (err) {
      console.error("Swap failed:", err);
      alert("Swap failed. Check console for details.");
    }
  };

  return (
    <div>
      <h1>Yields App</h1>
      {account ? (
        <div>
          <p>Connected: {account.address}</p>
          <p>Balance: {account.balance} ETH</p>
          <p>USDC Balance: {usdcBalance}</p>
          <p>USDE Balance: {usdeBalance}</p>

          <button onClick={() => swapUSDCtoUSDE(1)}>Swap 1 USDC → USDE</button>
        </div>
      ) : (
        <button onClick={connectWallet}>Connect Wallet</button>
      )}
    </div>
  );
}

export default App;
