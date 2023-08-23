import { readFile } from 'fs/promises'

export const standardAbi = JSON.parse(await readFile(new URL('./standard.json', import.meta.url)))

export const oracleAbi = JSON.parse(await readFile(new URL('./oracle.json', import.meta.url)))

export const camelotPoolAbi = JSON.parse(await readFile(new URL('./camelot_pool.json', import.meta.url)))

export const sushiswapV2PoolAbi = JSON.parse(await readFile(new URL('./sushiswap_v2_pool.json', import.meta.url)))

export const uniswapUniversalRouterAbi = JSON.parse(
  await readFile(new URL('./uniswap_universal_router.json', import.meta.url)),
)

export const uniswapUniversalRouter2Abi = JSON.parse(
  await readFile(new URL('./uniswap_universal_router2.json', import.meta.url)),
)

export const uniswapV2FactoryAbi = JSON.parse(await readFile(new URL('./uniswap_v2_factory.json', import.meta.url)))

export const uniswapV2PoolAbi = JSON.parse(await readFile(new URL('./uniswap_v2_pool.json', import.meta.url)))

export const uniswapV2RouterAbi = JSON.parse(await readFile(new URL('./uniswap_v2_router.json', import.meta.url)))

export const uniswapV3FactoryAbi = JSON.parse(await readFile(new URL('./uniswap_v3_factory.json', import.meta.url)))

export const uniswapV3PoolAbi = JSON.parse(await readFile(new URL('./uniswap_v3_pool.json', import.meta.url)))

export const uniswapV3RouterAbi = JSON.parse(await readFile(new URL('./uniswap_v3_router.json', import.meta.url)))

export const uniswapV3Router2Abi = JSON.parse(await readFile(new URL('./uniswap_v3_router2.json', import.meta.url)))

export const uniswapV3TicklensAbi = JSON.parse(await readFile(new URL('./uniswap_v3_ticklens.json', import.meta.url)))
