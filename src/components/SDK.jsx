import axios from 'axios';

const HOSTED_SDK_URL = 'https://api-v2.pendle.finance/core/';
export const LIMIT_ORDER_URL = 'https://api-v2.pendle.finance/limit-order/';

export const MARKET_ADDRESS = '0xa36b60a14a1a5247912584768c6e53e1a269a9f7';
export const PT_ADDRESS = '0xb253eff1104802b97ac7e3ac9fdd73aece295a2c';
export const CHAIN_ID = 1;

// SUSDE address must be declared (assuming you have it)
export const SUSDE = '0x9d39a5de30e57443bff2a8307a4256c8797a3497';

// Replace this with your signer’s address (e.g. from ethers.getSigner())
const address = '0xYourWalletAddressHere';

 async function callSDK(path, params = {}) {
  const response = await axios.get(HOSTED_SDK_URL + path, {
    params
  });

  return response;
}

 async function swapTokenToPt() {
  try {
    const resp = await callSDK(
      `/v2/sdk/${CHAIN_ID}/markets/${MARKET_ADDRESS}/swap`,
      {
        receiver: address,
        slippage: 0.01,
        tokenIn: SUSDE,
        tokenOut: PT_ADDRESS,
        amountIn: '10000000000000000' // 0.01 SUSDE (assuming 18 decimals)
      }
    );

    console.log('Amount PT Out: ', resp.data.data.amountOut);
    console.log('Price impact: ', resp.data.data.priceImpact);
    console.log('Computing unit: ', resp.headers['x-computing-unit']);

    // Send transaction manually with ethers if needed
    const signer = getSigner(); 
    await signer.sendTransaction(resp.data.tx);
  } catch (error) {
    console.error('Swap failed:', error);
  }
}
