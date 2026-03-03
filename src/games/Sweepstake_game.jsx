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

import { useState, useEffect } from "react"

export function Sweepstakev2() {
  const [ticketCount, setTicketCount] = useState(1)
  const [timeLeft, setTimeLeft] = useState({
    hours: 2,
    minutes: 45,
    seconds: 30,
  })
  const [prizePool, setPrizePool] = useState(2847500)
  const [myTickets, setMyTickets] = useState([
    { id: 1, purchasedAt: new Date().getTime() - 3600000 },
    { id: 2, purchasedAt: new Date().getTime() - 1800000 },
  ])

  const ticketPrice = 100 // BBFT per ticket
  const totalTickets = 1247
  const participants = 89

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 }
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 }
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 }
        }
        return { hours: 23, minutes: 59, seconds: 59 }
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Simulate prize pool updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPrizePool((prev) => prev + Math.floor(Math.random() * 500))
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleBuyTickets = () => {
    const newTickets = Array.from({ length: ticketCount }, (_, i) => ({
      id: myTickets.length + i + 1,
      purchasedAt: new Date().getTime(),
    }))
    setMyTickets([...myTickets, ...newTickets])
    setTicketCount(1)
  }

  const formatTime = (num) => num.toString().padStart(2, "0")
  const formatNumber = (num) => num.toLocaleString()
  const usdValue = (prizePool * 0.00053).toFixed(0)

  return (
    <div className="w-full space-y-6">
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
            <span>🎟️</span> Buy Tickets
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
              className="w-10 h-10 rounded-lg bg-[#15803d] hover:bg-[#14532d] text-white font-bold text-xl transition-colors"
            >
              -
            </button>
            <input
              type="number"
              value={ticketCount}
              onChange={(e) => setTicketCount(Math.max(1, Number.parseInt(e.target.value) || 1))}
              className="w-16 h-10 rounded-lg bg-[#15803d] text-white text-center font-bold text-lg border-none outline-none"
            />
            <button
              onClick={() => setTicketCount(ticketCount + 1)}
              className="w-10 h-10 rounded-lg bg-[#15803d] hover:bg-[#14532d] text-white font-bold text-xl transition-colors"
            >
              +
            </button>
            <button
              onClick={handleBuyTickets}
              className="flex-1 h-10 rounded-lg bg-white text-green-700 font-bold hover:bg-gray-100 transition-colors"
            >
              Buy Now
            </button>
          </div>
          <div className="text-green-200 text-sm mt-2">Cost: {formatNumber(ticketCount * ticketPrice)} BBFT</div>
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
          <div className="text-gray-400 text-sm mb-1">Your Tickets</div>
          <div className="text-2xl font-bold text-white">{myTickets.length}</div>
          <div className="text-gray-500 text-sm">this round</div>
        </div>
        {/* <div className="bg-[#1a1f2e] border border-[#2a3142] rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-1">Win Chance</div>
          <div className="text-2xl font-bold text-[#22c55e]">
            {((myTickets.length / totalTickets) * 100).toFixed(2)}%
          </div>
          <div className="text-gray-500 text-sm">current odds</div>
        </div> */}
        <div className="bg-[#1a1f2e] border border-[#2a3142] rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-1">Total Tickets</div>
          <div className="text-2xl font-bold text-white">{formatNumber(totalTickets)}</div>
          <div className="text-gray-500 text-sm">in pool</div>
        </div>
        <div className="bg-[#1a1f2e] border border-[#2a3142] rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-1">Participants</div>
          <div className="text-2xl font-bold text-white">{participants}</div>
          <div className="text-gray-500 text-sm">players</div>
        </div>
      </div>

      {/* Bottom Section - My Tickets & Recent Winners */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My Tickets */}
        <div className="bg-[#1a1f2e] border border-[#2a3142] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span>🎫</span> My Tickets
            </h3>
            <span className="text-gray-400 text-sm">{myTickets.length} tickets</span>
          </div>

          {myTickets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No tickets purchased yet</div>
          ) : (
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {myTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between bg-[#0f1219] rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center">
                      <span className="text-white font-bold">🎟️</span>
                    </div>
                    <div>
                      <div className="text-white font-semibold">Ticket #{ticket.id}</div>
                      <div className="text-gray-400 text-xs">
                        {new Date(ticket.purchasedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#22c55e]/20 text-[#22c55e] px-3 py-1 rounded-full text-xs font-semibold">
                    ENTERED
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Winners */}
        <div className="bg-[#1a1f2e] border border-[#2a3142] rounded-xl p-5">
          <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
            <span>🏅</span> Recent Winners
          </h3>
          <div className="space-y-3">
            {[
              { address: "0x7a3...f92c", prize: 1250000, time: "2h ago" },
              { address: "0x9b1...e4d8", prize: 890000, time: "1d ago" },
              { address: "0x2c4...a1b3", prize: 2100000, time: "3d ago" },
            ].map((winner, i) => (
              <div key={i} className="flex items-center justify-between bg-[#0f1219] rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#2a3142] flex items-center justify-center text-gray-400 text-sm">
                    {i + 1}
                  </div>
                  <span className="text-white font-mono text-sm">{winner.address}</span>
                </div>
                <div className="text-right">
                  <div className="text-[#22c55e] font-bold">{formatNumber(winner.prize)} BBFT</div>
                  <div className="text-gray-500 text-xs">{winner.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Buy Options */}
      {/* <div className="bg-[#1a1f2e] border border-[#2a3142] rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Quick Buy</h3>
        <div className="flex flex-wrap gap-3">
          {[5, 10, 25, 50, 100].map((amount) => (
            <button
              key={amount}
              onClick={() => {
                setTicketCount(amount)
              }}
              className="px-6 py-3 rounded-lg bg-[#0f1219] border border-[#2a3142] text-white hover:border-[#f97316] hover:text-[#f97316] transition-colors"
            >
              {amount} Tickets
            </button>
          ))}
        </div>
      </div> */}
    </div>
  ) 
}

export default Sweepstakev2
