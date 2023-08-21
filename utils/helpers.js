import { strict as assert } from 'node:assert'
import axios from 'axios'
import { SLIPPAGE, DRY_RUN, SECOND } from './constants.js'

const accountGetBalance = async (account) => {
  try {
    return await account.balance()
  } catch (e) {
    console.log(`Exception in account_get_balance: ${e}`)
  }
}

const getAbi = async (address) => {
  const explorerUrl = `https://api.snowtrace.io/api?module=contract&action=getabi&address=${address}&apiKey=${process.env.SNOWTRACE_API_KEY}`
  const response = await axios.get(explorerUrl)
  const abi = JSON.parse(response.data.result)
  return abi
}

const contractLoad = async (address, proxyAddress, provider) => {
  try {
    const abi = await getAbi(proxyAddress || address)
    const contract = new provider.eth.Contract(abi, address)
    return contract
  } catch (e) {
    console.log(`Exception in contract_load: ${e}`)
  }
}

const getApproval = async (token, router, user) => {
  try {
    return await token.methods.allowance(user, router._address).call()
  } catch (e) {
    console.log(`Exception in get_approval: ${e}`)
    return false
  }
}

const getTokenName = async (token) => {
  try {
    return await token.methods.name().call()
  } catch (e) {
    console.log(`Exception in get_token_name: ${e}`)
    throw e
  }
}

const getTokenSymbol = async (token) => {
  try {
    return await token.methods.symbol().call()
  } catch (e) {
    console.log(`Exception in get_token_symbol: ${e}`)
    throw e
  }
}

const getTokenBalance = async (token, user) => {
  try {
    return await token.methods.balanceOf(user).call()
  } catch (e) {
    console.log(`Exception in get_token_balance: ${e}`)
    throw e
  }
}

const getTokenDecimals = async (token) => {
  try {
    return await token.methods.decimals().call()
  } catch (e) {
    console.log(`Exception in get_token_decimals: ${e}`)
    throw e
  }
}

const tokenApprove = async (token, router, value = 'unlimited', userAddress) => {
  if (DRY_RUN) {
    return true
  }

  if (value === 'unlimited') {
    try {
      await token.methods.approve(router._address, 2 ** 256 - 1).send({ from: userAddress })
      return true
    } catch (e) {
      console.log(`Exception in token_approve: ${e}`)
      throw e
    }
  } else {
    try {
      await token.methods.approve(router._address, value).send({ from: userAddress })
      return true
    } catch (e) {
      console.log(`Exception in token_approve: ${e}`)
      throw e
    }
  }
}

const getSwapRate = async (tokenInQuantity, tokenInAddress, tokenOutAddress, router) => {
  try {
    return await router.methods.getAmountsOut(tokenInQuantity, [tokenInAddress, tokenOutAddress]).call()
  } catch (e) {
    console.log(`Exception in get_swap_rate: ${e}`)
    return false
  }
}

const tokenSwap = async (
  tokenInQuantity,
  tokenInAddress,
  tokenOutQuantity,
  tokenOutAddress,
  router,
  priorityFee,
  userAddress,
) => {
  if (DRY_RUN) {
    return true
  }
  if (priorityFee) {
    assert(priorityFee > 0, 'Priority fee must be greater than 0')
    assert(Number.isInteger(priorityFee), 'Priority fee must be an integer')
  } else {
    priorityFee = 0
  }
  try {
    await router.methods
      .swapExactTokensForTokens(
        tokenInQuantity,
        parseInt(tokenOutQuantity * (1 - SLIPPAGE)),
        [tokenInAddress, tokenOutAddress],
        userAddress,
        parseInt(1000 * (Date.now() / 1000) + 30 * SECOND),
      )
      .send({ from: userAddress, maxPriorityFeePerGas: priorityFee })
    return true
  } catch (e) {
    console.log(`Exception: ${e}`)
    return false
  }
}

const getTokensOutFromTokensIn = (
  poolReservesToken0,
  poolReservesToken1,
  quantityToken0In = 0,
  quantityToken1In = 0,
  fee = 0,
) => {
  // fails if two input tokens are passed, or if both are 0
  assert(!(quantityToken0In && quantityToken1In))
  assert(quantityToken0In || quantityToken1In)
  if (quantityToken0In) {
    return (poolReservesToken1 * quantityToken0In * (1 - fee)) / (poolReservesToken0 + quantityToken0In * (1 - fee))
  }
  if (quantityToken1In) {
    return (poolReservesToken0 * quantityToken1In * (1 - fee)) / (poolReservesToken1 + quantityToken1In * (1 - fee))
  }
}

const getTokensInForRatioOut = (
  poolReservesToken0,
  poolReservesToken1,
  token0PerToken1,
  token0Out = false,
  token1Out = false,
  fee = 0,
) => {
  assert(!(token0Out && token1Out))
  if (token0Out) {
    const dy = parseInt(poolReservesToken0 / token0PerToken1 - poolReservesToken1 / (1 - fee))
    if (dy > 0) {
      return dy
    } else {
      return 0
    }
  }
  if (token1Out) {
    const dx = parseInt(poolReservesToken1 * token0PerToken1 - poolReservesToken0 / (1 - fee))
    if (dx > 0) {
      return dx
    } else {
      return 0
    }
  }
}

const getScaledPriorityFee = (baseFee, swapEv, gasLimit, priceOfWei, feeRatio) => {
  return parseInt((swapEv * feeRatio) / (gasLimit * priceOfWei) - baseFee).toString()
}

export {
  accountGetBalance,
  contractLoad,
  getApproval,
  getTokenName,
  getTokenSymbol,
  getTokenBalance,
  getTokenDecimals,
  tokenApprove,
  getSwapRate,
  tokenSwap,
}
