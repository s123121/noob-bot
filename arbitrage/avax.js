import 'dotenv/config'
import axios from 'axios'
import Web3 from 'web3'
import HDWalletProvider from '@truffle/hdwallet-provider'

const provider = new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: `https://avalanche-mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
})

const web3 = new Web3(provider)
const toBn = web3.utils.toBigInt

const getAbi = async (address) => {
  const explorerUrl = `https://api.snowtrace.io/api?module=contract&action=getabi&address=${address}&apiKey=${process.env.SNOWTRACE_API_KEY}`
  const response = await axios.get(explorerUrl)
  const abi = JSON.parse(response.data.result)
  return abi
}

const getContract = async (address) => {
  const abi = await getAbi(address)
  const contract = new web3.eth.Contract(abi, address)
  return contract
}

async function getTokenInfo(tokenContract) {
  const [address, symbol, decimals, name] = await Promise.all([
    tokenContract._address,
    tokenContract.methods.symbol().call(),
    tokenContract.methods.decimals().call(),
    tokenContract.methods.name().call(),
  ])
  return { address, decimals, name, symbol }
}

const getAccount = async () => {
  const accounts = await web3.eth.getAccounts()
  return accounts[0]
}

async function main() {
  console.log('Loading Contracts...')
  const daiContract = await getContract('0xd586e7f844cea2f87f50152665bcbc2c279d8d70')
  const mimContract = await getContract('0x130966628846bfd36ff31a822705796e8cb8c18d')
  const usdcContract = await getContract('0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664')
  const usdtContract = await getContract('0xc7198437980c041c805a1edcba50c1ce5db95118')
  const wavaxContract = await getContract('0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7')
  const routerContract = await getContract('0x60aE616a2155Ee3d9A68541Ba4544862310933d4')

  const dai = await getTokenInfo(daiContract)
  const mim = await getTokenInfo(mimContract)
  const usdc = await getTokenInfo(usdcContract)
  const usdt = await getTokenInfo(usdtContract)

  const account = await getAccount()

  console.log(
    await mimContract.methods.balanceOf(account).call(),
    await daiContract.methods.balanceOf(account).call(),
    await mimContract.methods.allowance(account, routerContract._address).call(),
    await daiContract.methods.allowance(account, routerContract._address).call(),
  )

  const tokenPairs = [
    [dai, mim],
    [mim, dai],
    [dai, usdc],
    [usdc, dai],
    [usdt, dai],
    [dai, usdt],
    [usdc, usdt],
    [usdt, usdc],
    [usdt, mim],
    [mim, usdt],
    [usdc, mim],
    [mim, usdc],
  ]

  while (true) {
    for (let pair of tokenPairs) {
      let tokenIn = pair[0]
      let tokenOut = pair[1]
      console.log(`${new Date().toLocaleTimeString()} ${tokenIn.symbol} → ${tokenOut.symbol}`)
      let qtyOut = await routerContract.methods
        .getAmountsOut(toBn(1 * 10 ** Number(tokenIn.decimals)), [
          tokenIn.address,
          wavaxContract._address,
          tokenOut.address,
        ])
        .call()
      const amount = Number(qtyOut[2]) / 10 ** Number(tokenOut.decimals)
      if (amount >= 1.01) {
        console.log(`${new Date().toLocaleTimeString()} ${tokenIn.symbol} → ${tokenOut.symbol}: (${amount.toFixed(3)})`)
      }
      await new Promise((r) => setTimeout(r, 100))
    }
  }
}

// main();

const chain = async () => {
  const SPELL_USD_CONTRACT = '0x4f3ddf9378a4865cf4f28be51e10aecb83b7daee'
  const AVAX_USD_CONTRACT = '0x0a77230d17318075983913bc2145db16c7366156'

  const spellPrice = await getContract(SPELL_USD_CONTRACT)
  const price = await spellPrice.methods.latestRoundData().call()
}
