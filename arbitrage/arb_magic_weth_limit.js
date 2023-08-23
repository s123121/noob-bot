import 'dotenv/config'
import Web3 from 'web3'
import HDWalletProvider from '@truffle/hdwallet-provider'
import ERC20 from '../model/ERC20.js'
import Router from '../uniswap/v2/Router.js'
import { sushiswapV2PoolAbi } from '../abi/index.js'
import LiquidityPool from '../uniswap/v2/LiquidityPool.js'

const provider = new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
})

const web3 = new Web3(provider)

// Contract addresses (verify on Arbiscan)
const SUSHISWAP_ROUTER_CONTRACT_ADDRESS = '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506'
const SUSHISWAP_POOL_CONTRACT_ADDRESS = '0xB7E50106A5bd3Cf21AF210A755F9C8740890A8c9'
const WETH_CONTRACT_ADDRESS = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
const MAGIC_CONTRACT_ADDRESS = '0x539bdE0d7Dbd336b79148AA742883198BBF60342'

const SLIPAGE = 0.001
const DRY_RUN = true
const ONE_SHOT = false
const LOOP_TIME = 0.25

const getAccount = async () => {
  const accounts = await web3.eth.getAccounts()
  return accounts[0]
}

const main = async () => {
  const user = await getAccount()
  const magic = new ERC20({
    address: MAGIC_CONTRACT_ADDRESS,
    user,
    provider: web3,
  })
  await magic.init()
  const weth = new ERC20({
    address: WETH_CONTRACT_ADDRESS,
    user,
    provider: web3,
  })
  await weth.init()

  const tokens = [magic, weth]

  const sushiswapRouter = new Router({
    address: SUSHISWAP_ROUTER_CONTRACT_ADDRESS,
    name: 'sushiswap',
    provider: web3,
    user,
  })
  const sushiswapLp = new LiquidityPool({
    address: SUSHISWAP_POOL_CONTRACT_ADDRESS,
    abi: sushiswapV2PoolAbi,
    router: sushiswapRouter,
    tokens,
    name: 'SushiSwap: MAGIC-WETH',
    provider: web3,
    user,
  })

  sushiswapLp.init()

  const routers = [sushiswapRouter]
  const lps = [sushiswapLp]

  console.log('Approvals:')
  for (const router of routers) {
    for (const token of tokens) {
      const approval = await token.getApproval(router.address)
      if (!approval && !DRY_RUN) {
        await token.setApproval(router.address, -1)
      } else {
        console.log(`${token.name} on ${router.name} OK`)
      }
    }
  }

  console.log('Swap Targets:')
  for (const lp of lps) {
    lp.setSwapTarget({
      tokenInQty: 1,
      tokenIn: weth,
      tokenOutQty: 3000,
      tokenOut: magic,
    })
  }

  let balanceRefresh = true

  while (true) {
    const start = Date.now()
    if (balanceRefresh) {
      console.log('Account Balance:')
      for (const token of tokens) {
        const normalizeBalance = await token.getNormalizedBalance()
        console.log(`${normalizeBalance} ${token.symbol} (${token.name})`)
        balanceRefresh = false
      }
    }
    for (const lp of lps) {
      await lp.updateReserves({ printReserves: true, printRatio: true })
      if (lp.token0.balance && lp.token0MaxSwap) {
        const tokenIn = lp.token0
        const tokenOut = lp.token1
        const tokenInQty = Math.min(lp.token0.balance, lp.token0MaxSwap)
        const tokenOutQty = lp.calculateTokensOutFromTokensIn({
          tokenIn,
          tokenInQty,
        })
        console.log(
          `*** SWAP ON ${lp.router} OF ${tokenInQty / 10 ** tokenIn.decimals} ${tokenIn} FOR ${
            tokenOutQty / 10 ** tokenOut.decimals
          } ${tokenOut} ***`,
        )
        if (!DRY_RUN) {
          await lp.router.tokenSwap({
            tokenInQty,
            tokenInAddress: tokenIn.address,
            tokenOutQty,
            tokenOutAddress: tokenOut.address,
            slippage: SLIPAGE,
          })
          balanceRefresh = true
          if (ONE_SHOT) {
            console.log('single shot complete!')
            process.exit(0)
          }
          break
        }
      }
      if (lp.token1.balance && lp.token1MaxSwap) {
        const tokenIn = lp.token1
        const tokenOut = lp.token0
        const tokenInQty = Math.min(lp.token1.balance, lp.token1MaxSwap)
        const tokenOutQty = lp.calculateTokensOutFromTokensIn({
          tokenIn,
          tokenInQty,
        })
        console.log(
          `*** EXECUTING SWAP ON ${lp.router} OF ${tokenInQty / 10 ** tokenIn.decimals} ${tokenIn} FOR ${
            tokenOutQty / 10 ** tokenOut.decimals
          } ${tokenOut} ***`,
        )
        if (!DRY_RUN) {
          await lp.router.tokenSwap({
            tokenInQty,
            tokenInAddress: tokenIn.address,
            tokenOutQty,
            tokenOutAddress: tokenOut.address,
            slippage: SLIPAGE,
          })
          balanceRefresh = true
          if (ONE_SHOT) {
            console.log('single shot complete!')
            process.exit(0)
          }
          break
        }
      }
      const end = Date.now()
      const elapsed = (end - start) / 1000
      if (elapsed >= LOOP_TIME) {
        continue
      } else {
        await new Promise((resolve) => setTimeout(resolve, (LOOP_TIME - elapsed) * 1000))
        continue
      }
    }
  }
}

main()
