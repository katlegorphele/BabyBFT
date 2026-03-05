// Copyright 2025 katlegorphele
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use client"

import { useState, useEffect, useCallback } from "react"
import { ethers } from "ethers"
import { useWallet } from "../context/WalletContext"
import {
  SWEEPSTAKE_ABI,
  TOKEN_ABI,
  NETWORK_KEYS,
  SWEEPSTAKE_DEPLOYMENTS
} from "../constants/config"
import { formatNumber, formatAddress, getTimeSince } from "../utils/formatters"

export function Sweepstakev2() {
  const {
    account,
    provider,
    selectedNetwork,
    selectedNetworkConfig,
    availableNetworks,
    setPreferredNetwork,
    switchToSelectedNetwork
  } = useWallet()

  // UI State
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [error, setError] = useState(null)
  const [isWrongNetwork, setIsWrongNetwork] = useState(false)

  // Contract Data State
  const [prizePool, setPrizePool] = useState('0')
  const [entryFee, setEntryFee] = useState('0')
  const [participantCount, setParticipantCount] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [roundId, setRoundId] = useState(0)
  const [claimableBalance, setClaimableBalance] = useState('0')
  const [isPaused, setIsPaused] = useState(false)
  const [recentWinners, setRecentWinners] = useState([])
  const [userParticipated, setUserParticipated] = useState(false)
  const [needsApproval, setNeedsApproval] = useState(true)
  const [tokenBalance, setTokenBalance] = useState('0')

  // Contract instances
  const [contract, setContract] = useState(null)
  const [tokenContract, setTokenContract] = useState(null)
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)

  const activeDeployment = SWEEPSTAKE_DEPLOYMENTS[selectedNetwork]
  const hasDeployment = Boolean(activeDeployment?.contractAddress && activeDeployment?.tokenAddress)
  const isMainnet = selectedNetwork === NETWORK_KEYS.MAINNET

  const handleNetworkSwitch = async () => {
    setError(null)
    setIsSwitchingNetwork(true)
    try {
      await switchToSelectedNetwork()
    } catch (err) {
      setError('Failed to switch network: ' + err.message)
    } finally {
      setIsSwitchingNetwork(false)
    }
  }

  const handleSelectNetwork = async (networkKey) => {
    setError(null)
    setIsSwitchingNetwork(true)
    try {
      await setPreferredNetwork(networkKey)
    } catch (err) {
      setError('Failed to change selected network: ' + err.message)
    } finally {
      setIsSwitchingNetwork(false)
    }
  }

  // Check network and initialize contracts only on selected network
  useEffect(() => {
    const checkNetworkAndInit = async () => {
      if (!account || !provider) {
        setIsLoading(false)
        return
      }

      try {
        if (!hasDeployment) {
          setIsWrongNetwork(false)
          setContract(null)
          setTokenContract(null)
          setIsLoading(false)
          return
        }

        const network = await provider.getNetwork()
        const wrongNetwork = network.chainId !== selectedNetworkConfig.chainId
        setIsWrongNetwork(wrongNetwork)

        if (wrongNetwork) {
          setIsLoading(false)
          setContract(null)
          setTokenContract(null)
          return
        }

        const activeSigner = provider.getSigner()

        // Initialize contracts for the selected network deployment
        const sweepstakeContract = new ethers.Contract(
          activeDeployment.contractAddress,
          SWEEPSTAKE_ABI,
          activeSigner
        )
        const token = new ethers.Contract(
          activeDeployment.tokenAddress,
          TOKEN_ABI,
          activeSigner
        )

        setContract(sweepstakeContract)
        setTokenContract(token)
      } catch (err) {
        setError('Failed to initialize: ' + err.message)
        console.error(err)
        setIsLoading(false)
      }
    }

    checkNetworkAndInit()
  }, [account, provider, selectedNetworkConfig, hasDeployment, activeDeployment])

  // Load recent winners from historical rounds
  const loadRecentWinners = useCallback(async (currentRound) => {
    if (!contract || currentRound <= 1) return

    const winners = []
    const roundsToFetch = Math.min(currentRound - 1, 5)

    for (let i = currentRound - 1; i >= currentRound - roundsToFetch && i >= 1; i--) {
      try {
        const result = await contract.getRoundResult(i)
        const roundWinners = result[0]
        const prizePerWinner = result[2]
        const timestamp = result[4]

        if (roundWinners && roundWinners.length > 0) {
          winners.push({
            roundId: i,
            address: roundWinners[0],
            prize: ethers.utils.formatEther(prizePerWinner),
            timestamp: new Date(timestamp.toNumber() * 1000)
          })
        }
      } catch {
        // Round data not available, skip
      }
    }

    setRecentWinners(winners)
  }, [contract])

  // Load contract data
  const loadContractData = useCallback(async () => {
    if (!contract || !tokenContract || !account) return

    setIsLoading(true)
    setError(null)

    try {
      const [
        pool,
        fee,
        count,
        remaining,
        round,
        claimable,
        paused,
        participants,
        balance,
        allowance
      ] = await Promise.all([
        contract.prizePool(),
        contract.entryFee(),
        contract.getParticipantCount(),
        contract.getRoundTimeRemaining(),
        contract.roundId(),
        contract.claimableBalance(account),
        contract.paused(),
        contract.getParticipants(),
        tokenContract.balanceOf(account),
        tokenContract.allowance(account, activeDeployment.contractAddress)
      ])

      setPrizePool(ethers.utils.formatEther(pool))
      setEntryFee(ethers.utils.formatEther(fee))
      setParticipantCount(count.toNumber())
      setTimeRemaining(remaining.toNumber())
      setRoundId(round.toNumber())
      setClaimableBalance(ethers.utils.formatEther(claimable))
      setIsPaused(paused)
      setTokenBalance(ethers.utils.formatEther(balance))
      setNeedsApproval(allowance.lt(fee))

      // Check if user participated
      const participantList = participants.map(p => p.toLowerCase())
      setUserParticipated(participantList.includes(account.toLowerCase()))

      // Fetch recent winners
      await loadRecentWinners(round.toNumber())

    } catch (err) {
      console.error('Contract call error:', err)
      if (err.code === 'CALL_EXCEPTION') {
        setError(`Contract call failed. Make sure you are on ${selectedNetworkConfig.chainName}.`)
      } else {
        setError('Failed to load data: ' + (err.reason || err.message))
      }
    } finally {
      setIsLoading(false)
    }
  }, [contract, tokenContract, account, loadRecentWinners, activeDeployment, selectedNetworkConfig])

  // Initial load and periodic refresh
  useEffect(() => {
    if (contract && tokenContract && account) {
      loadContractData()

      const refreshInterval = setInterval(loadContractData, 30000)
      return () => clearInterval(refreshInterval)
    }
  }, [contract, tokenContract, account, loadContractData])

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          loadContractData()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining, loadContractData])

  // Join pool handler
  const handleJoinPool = async () => {
    if (!contract || !tokenContract || isJoining || !hasDeployment) return

    setIsJoining(true)
    setError(null)

    try {
      const feeAmount = await contract.entryFee()

      // Check and handle approval
      const currentAllowance = await tokenContract.allowance(account, activeDeployment.contractAddress)
      if (currentAllowance.lt(feeAmount)) {
        const approveTx = await tokenContract.approve(
          activeDeployment.contractAddress,
          ethers.constants.MaxUint256
        )
        await approveTx.wait()
      }

      // Join pool - contract only allows 1 entry per round per user
      const tx = await contract.joinPool()
      await tx.wait()

      // Reload data
      await loadContractData()

    } catch (err) {
      setError('Failed to join pool: ' + (err.reason || err.message))
      console.error(err)
    } finally {
      setIsJoining(false)
    }
  }

  // Withdraw prize handler
  const handleWithdrawPrize = async () => {
    if (!contract || isWithdrawing || parseFloat(claimableBalance) === 0) return

    setIsWithdrawing(true)
    setError(null)

    try {
      const tx = await contract.withdrawPrize()
      await tx.wait()

      await loadContractData()

    } catch (err) {
      setError('Failed to withdraw: ' + (err.reason || err.message))
      console.error(err)
    } finally {
      setIsWithdrawing(false)
    }
  }

  // Helper to convert seconds to hours/minutes/seconds
  const formatTimeLeft = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return { hours, minutes, seconds: secs }
  }

  const timeLeft = formatTimeLeft(timeRemaining)
  const formatTime = (num) => num.toString().padStart(2, "0")
  const usdValue = (parseFloat(prizePool) * 0.00053).toFixed(0)

  // Not connected state
  if (!account) {
    return (
      <div className="w-full text-center py-20">
        <span className="text-6xl mb-4 block">🎟️</span>
        <p className="text-gray-400 text-lg">Connect your wallet to play Sweepstakes</p>
      </div>
    )
  }

  // Loading state
  if (isLoading && !prizePool) {
    return (
      <div className="w-full text-center py-20">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400">Loading sweepstake data...</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-gray-300 text-sm">Sweepstake network</p>
          <div className="flex items-center gap-2">
            {availableNetworks.map((network) => (
              <button
                key={network.key}
                onClick={() => handleSelectNetwork(network.key)}
                disabled={isSwitchingNetwork}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedNetwork === network.key
                    ? 'bg-orange-500 text-black font-semibold'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {network.shortLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasDeployment && (
        <div className="bg-yellow-500/20 border border-yellow-500 rounded-xl p-4">
          <p className="text-yellow-400 font-semibold">No Deployment On {selectedNetworkConfig.shortLabel}</p>
          <p className="text-yellow-200 text-sm">
            Sweepstakes contracts are not configured for this network yet. Switch to Testnet to play.
          </p>
          {isMainnet && (
            <button
              onClick={() => handleSelectNetwork(NETWORK_KEYS.TESTNET)}
              className="mt-3 bg-yellow-500 text-black px-4 py-2 rounded-lg font-semibold hover:bg-yellow-400 transition-colors"
            >
              Switch To Testnet
            </button>
          )}
        </div>
      )}

      {/* Wrong Network Warning */}
      {isWrongNetwork && (
        <div className="bg-yellow-500/20 border border-yellow-500 rounded-xl p-4">
          <p className="text-yellow-400 font-semibold">Wrong Network</p>
          <p className="text-yellow-200 text-sm mb-3">Please switch to {selectedNetworkConfig.chainName} to use Sweepstakes</p>
          <button
            onClick={handleNetworkSwitch}
            disabled={isSwitchingNetwork}
            className="bg-yellow-500 text-black px-4 py-2 rounded-lg font-semibold hover:bg-yellow-400 transition-colors"
          >
            {isSwitchingNetwork ? 'Switching...' : `Switch to ${selectedNetworkConfig.shortLabel}`}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-xl p-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadContractData}
            className="text-red-300 text-sm underline mt-2"
          >
            Try again
          </button>
        </div>
      )}

      {/* Paused Warning */}
      {isPaused && (
        <div className="bg-yellow-500/20 border border-yellow-500 rounded-xl p-4 text-center">
          <p className="text-yellow-400 font-semibold">Contract is paused</p>
          <p className="text-yellow-200 text-sm">New entries are temporarily disabled</p>
        </div>
      )}

      {/* Claimable Balance Section */}
      {parseFloat(claimableBalance) > 0 && (
        <div className="bg-[#166534] border border-[#22c55e]/30 rounded-xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-green-200 text-sm mb-1">🎉 You Won!</div>
              <div className="text-2xl font-bold text-white">
                {formatNumber(claimableBalance)} BBFT
              </div>
            </div>
            <button
              onClick={handleWithdrawPrize}
              disabled={isWithdrawing}
              className="bg-white text-green-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isWithdrawing ? (
                <>
                  <div className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin"></div>
                  Claiming...
                </>
              ) : (
                'Claim Prize'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Top Stats Row - Prize Pool, Buy, Countdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Prize Pool Card */}
        <div className="bg-[#1a1f2e] border border-[#2a3142] rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <span>🏆</span> Prize Pool
          </div>
          <div className="text-3xl font-bold text-white mb-1">{formatNumber(prizePool)}</div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">BBFT available</span>
            <span className="text-gray-400 text-sm">${formatNumber(usdValue)} USD</span>
          </div>
        </div>

        {/* Buy Tickets Card */}
        <div className="bg-[#166534] border border-[#22c55e]/30 rounded-xl p-5">
          <div className="flex items-center gap-2 text-green-200 text-sm mb-2">
            <span>🎟️</span> Enter Sweepstake
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleJoinPool}
              disabled={isJoining || isPaused || userParticipated || isWrongNetwork || !hasDeployment || parseFloat(tokenBalance) < parseFloat(entryFee)}
              className="flex-1 h-10 rounded-lg bg-white text-green-700 font-bold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <div className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin"></div>
                  Joining...
                </>
              ) : userParticipated ? (
                'Already Entered'
              ) : needsApproval ? (
                'Approve & Enter'
              ) : (
                'Enter Now'
              )}
            </button>
          </div>
          <div className="text-green-200 text-sm mt-2">
            Entry fee: {formatNumber(entryFee)} BBFT
          </div>
          {parseFloat(tokenBalance) < parseFloat(entryFee) && !userParticipated && (
            <div className="text-red-300 text-xs mt-1">
              Insufficient balance (You have {formatNumber(tokenBalance)} BBFT)
            </div>
          )}
        </div>

        {/* Countdown Card */}
        <div className="bg-[#7c2d12] border border-[#f97316]/30 rounded-xl p-5">
          <div className="flex items-center gap-2 text-orange-200 text-sm mb-2">
            <span>⏰</span> Next Draw In
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-[#9a3412] rounded-lg px-3 py-2 text-center">
              <div className="text-2xl font-bold text-white">{formatTime(timeLeft.hours)}</div>
              <div className="text-orange-300 text-xs">HRS</div>
            </div>
            <span className="text-2xl font-bold text-orange-300">:</span>
            <div className="bg-[#9a3412] rounded-lg px-3 py-2 text-center">
              <div className="text-2xl font-bold text-white">{formatTime(timeLeft.minutes)}</div>
              <div className="text-orange-300 text-xs">MIN</div>
            </div>
            <span className="text-2xl font-bold text-orange-300">:</span>
            <div className="bg-[#9a3412] rounded-lg px-3 py-2 text-center">
              <div className="text-2xl font-bold text-white">{formatTime(timeLeft.seconds)}</div>
              <div className="text-orange-300 text-xs">SEC</div>
            </div>
          </div>
        </div>
      </div>

      {/* User Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-[#1a1f2e] border border-[#2a3142] rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-1">Your Status</div>
          <div className="text-2xl font-bold text-white">
            {userParticipated ? (
              <span className="text-[#22c55e]">Entered</span>
            ) : (
              <span className="text-gray-500">Not Entered</span>
            )}
          </div>
          <div className="text-gray-500 text-sm">Round #{roundId}</div>
        </div>
        <div className="bg-[#1a1f2e] border border-[#2a3142] rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-1">Participants</div>
          <div className="text-2xl font-bold text-white">{participantCount}</div>
          <div className="text-gray-500 text-sm">in this round</div>
        </div>
        <div className="bg-[#1a1f2e] border border-[#2a3142] rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-1">Your Balance</div>
          <div className="text-2xl font-bold text-white">{formatNumber(tokenBalance)}</div>
          <div className="text-gray-500 text-sm">BBFT</div>
        </div>
      </div>

      {/* Bottom Section - My Entry & Recent Winners */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My Entry Status */}
        <div className="bg-[#1a1f2e] border border-[#2a3142] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span>🎫</span> My Entry
            </h3>
            <span className="text-gray-400 text-sm">Round #{roundId}</span>
          </div>

          {userParticipated ? (
            <div className="bg-[#22c55e]/20 rounded-lg p-4 text-center">
              <div className="text-[#22c55e] font-bold text-lg mb-1">✓ Entered!</div>
              <p className="text-gray-400 text-sm">You're in this round's draw</p>
              <p className="text-gray-500 text-xs mt-2">
                Entry fee paid: {formatNumber(entryFee)} BBFT
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>You haven't entered this round yet</p>
              <p className="text-sm mt-2">Entry fee: {formatNumber(entryFee)} BBFT</p>
            </div>
          )}
        </div>

        {/* Recent Winners */}
        <div className="bg-[#1a1f2e] border border-[#2a3142] rounded-xl p-5">
          <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
            <span>🏅</span> Recent Winners
          </h3>
          <div className="space-y-3">
            {recentWinners.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No winners yet!</p>
            ) : (
              recentWinners.map((winner, i) => (
                <div key={i} className="flex items-center justify-between bg-[#0f1219] rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2a3142] flex items-center justify-center text-gray-400 text-sm">
                      #{winner.roundId}
                    </div>
                    <span className="text-white font-mono text-sm">{formatAddress(winner.address)}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[#22c55e] font-bold">{formatNumber(winner.prize)} BBFT</div>
                    <div className="text-gray-500 text-xs">{getTimeSince(winner.timestamp)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sweepstakev2
