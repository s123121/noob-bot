import 'dotenv/config'
import axios from 'axios'
import Web3 from 'web3'
import HDWalletProvider from '@truffle/hdwallet-provider'
import { getERC20Token } from '../model/ERC20.js'
import { getLiquidityPool } from '../uniswap/v2/LiquidityPool.js'
import { getFlashBorrowToLpSwap } from './flash_borrow_to_lp_swap.js'

const UPDATE_METHOD = 'polling'

const DRY_RUN = true

const ARB_CONTRACT_ADDRESS = 'XXX'

const WBNB_CHAINLINK_PRICE_FEED_ADDRESS = '0x0567f2323251f0aab15c8dfb1967e4e8a7d42aee'

const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'
const WBNB_CONTRACT_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'

// const PANCAKE_POOL_CONTRACT_ADDRESS = '0x36696169C63e42cd08ce11f5deeBbCeBae652050'
const SUSHISWAP_POOL_CONTRACT_ADDRESS = '0x2905817b020fd35d9d09672946362b62766f0d69'
const BISWAP_POOL_CONTRACT_ADDRESS = '0x8840C6252e2e86e545deFb6da98B2a0E26d8C1BA'

// const PANCAKE_FACTORY_CONTRACT_ADDRESS = '0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10'
const SUSHISWAP_FACTORY_CONTRACT_ADDRESS = '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'
const BISWAP_FACTORY_CONTRACT_ADDRESS = '0x858E3312ed3A876947EA49d572A7C42DE08af7EE'
const LOOP_TIME = 500

const MIN_PROFIT_USD = 1.0

const bscProvider = new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: `https://bsc-mainnet.core.chainstack.com/${process.env.CHAINSTACK_KEY}`,
})

const web3 = new Web3(bscProvider)

const getAbi = async (address) => {
  const explorerUrl = `https://api.bscscan.com/api?module=contract&action=getabi&address=${address}&apiKey=${process.env.BSCCSAN_API_KEY}`
  const response = await axios.get(explorerUrl)
  const abi = JSON.parse(response.data.result)
  return abi
}

const getAccount = async () => {
  const accounts = await web3.eth.getAccounts()
  return accounts[0]
}

const main = async () => {
  const user = await getAccount()
  const abi = await getAbi(WBNB_CONTRACT_ADDRESS)
  const usdt = await getERC20Token({
    address: USDT_CONTRACT_ADDRESS,
    user,
    provider: web3,
  })
  const wbnb = await getERC20Token({
    address: WBNB_CONTRACT_ADDRESS,
    abi,
    user,
    provider: web3,
    oracleAddress: WBNB_CHAINLINK_PRICE_FEED_ADDRESS,
  })

  const sushiswap_lp_wbnb_usdt = await getLiquidityPool({
    address: SUSHISWAP_POOL_CONTRACT_ADDRESS,
    name: 'SushiSwap',
    tokens: [wbnb, usdt],
    provider: web3,
    updateMethod: UPDATE_METHOD,
    fee: 0.003,
  })

  const biswap_lp_wbnb_usdt = await getLiquidityPool({
    address: BISWAP_POOL_CONTRACT_ADDRESS,
    name: 'biswap',
    tokens: [wbnb, usdt],
    provider: web3,
    updateMethod: UPDATE_METHOD,
    fee: 0.003,
  })

  const sushiFactoryAbi = await getAbi(SUSHISWAP_FACTORY_CONTRACT_ADDRESS)
  const biswapFactoryAbi = await getAbi(BISWAP_FACTORY_CONTRACT_ADDRESS)

  const sushi_wbnb_to_biswap = await getFlashBorrowToLpSwap({
    provider: web3,
    borrowPool: sushiswap_lp_wbnb_usdt,
    borrowToken: wbnb,
    swapFactoryAddress: BISWAP_FACTORY_CONTRACT_ADDRESS,
    swapFactoryAbi: biswapFactoryAbi,
    swapTokenAddresses: [WBNB_CONTRACT_ADDRESS, USDT_CONTRACT_ADDRESS],
    updateMethod: UPDATE_METHOD,
    user,
  })

  // const sushi_usdt_to_biswap = await getFlashBorrowToLpSwap({
  //   provider: web3,
  //   borrowPool: sushiswap_lp_wbnb_usdt,
  //   borrowToken: usdt,
  //   swapFactoryAddress: BISWAP_FACTORY_CONTRACT_ADDRESS,
  //   swapFactoryAbi: biswapFactoryAbi,
  //   swapTokenAddresses: [USDT_CONTRACT_ADDRESS, WBNB_CONTRACT_ADDRESS],
  //   updateMethod: UPDATE_METHOD,
  //   user,
  // })

  const biswap_wbnb_to_sushi = await getFlashBorrowToLpSwap({
    provider: web3,
    borrowPool: biswap_lp_wbnb_usdt,
    borrowToken: wbnb,
    swapFactoryAddress: SUSHISWAP_FACTORY_CONTRACT_ADDRESS,
    swapFactoryAbi: sushiFactoryAbi,
    swapTokenAddresses: [WBNB_CONTRACT_ADDRESS, USDT_CONTRACT_ADDRESS],
    updateMethod: UPDATE_METHOD,
    user,
  })

  // const biswap_usdt_to_sushi = await getFlashBorrowToLpSwap({
  //   provider: web3,
  //   borrowPool: biswap_lp_wbnb_usdt,
  //   borrowToken: usdt,
  //   swapFactoryAddress: SUSHISWAP_FACTORY_CONTRACT_ADDRESS,
  //   swapFactoryAbi: sushiFactoryAbi,
  //   swapTokenAddresses: [USDT_CONTRACT_ADDRESS, WBNB_CONTRACT_ADDRESS],
  //   updateMethod: UPDATE_METHOD,
  //   user,
  // })

  const arbs = [sushi_wbnb_to_biswap, biswap_wbnb_to_sushi]

  wbnb.getPrice()
  while (true) {
    const start = Date.now()
    for (const arb of arbs) {
      arb.updateReserves({ silent: true, printReserves: false })
      if (arb.best.borrowAmount) {
        const arbProfitUsd = (arb.best.profitAmount / 10 ** arb.best.profitToken.decimals) * arb.best.profitToken.price
        console.log(
          `Borrow ${arb.best.borrowAmount / 10 ** arb.best.borrowToken.decimals} ${arb.best.borrowToken} on ${
            arb.borrowPool
          }, Profit ${arb.best.profitAmount / 10 ** arb.best.profitToken.decimals} ${
            arb.best.profitToken
          } (${arbProfitUsd}), Gas {gas_cost_usd} (base: {int(last_base_fee/(10**9))} gwei, priority: {int(MIN_PRIORITY_FEE/10**9)} gwei)`,
        )

        console.log(`LP Path: ${arb.swapPoolAddresses}`)
        console.log(`Borrow Amount: ${arb.best.borrowAmount}`)
        console.log(`Borrow Amounts: ${arb.best.borrowPoolAmounts}`)
        console.log(`Repay Amount: ${arb.best.repayAmount}`)
        console.log(`Swap Amounts: ${arb.best.swapPoolAmounts}`)
        if (arbProfitUsd > MIN_PROFIT_USD && !DRY_RUN) {
          console.log('executing arb')
          try {
            // arbContract.flashBorrowToLpSwap(
            //   arb.borrowPool.address,
            //   arb.best.borrowPoolAmounts,
            //   arb.best.repayAmount,
            //   arb.swapPoolAddresses,
            //   arb.best.swapPoolAmounts,
            //   { from: degenbot.address },
            // )
          } catch (err) {
            console.error(err)
          }
          break
        }
      }
    }
    try {
      wbnb.getPrice()
    } catch (err) {
      console.log(`(price update) Exception: ${err}`)
    }
    const end = Date.now()

    if (end - start >= LOOP_TIME) {
      continue
    } else {
      const sleepTime = LOOP_TIME - (end - start)
      console.log(`Sleeping for ${sleepTime} seconds`)
      await new Promise((resolve) => setTimeout(resolve, sleepTime))
      continue
    }
  }
}

main()
