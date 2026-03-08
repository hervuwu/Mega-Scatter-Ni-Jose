const symbols = ['🍎', '🍋', '🍒', '💎', '🔔', '⭐'];
let balance = 100;
let isAutoSpinning = false;

// --- AUDIO SETUP ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const gridElement = document.getElementById('slotGrid');
const balanceDisplay = document.getElementById('balance');
const betInput = document.getElementById('betInput');
const spinBtn = document.getElementById('spinBtn');
const autoBtn = document.getElementById('autoBtn');
const statusText = document.getElementById('status');

const init = () => {
    const userBalance = window.prompt("Enter your starting balance:", "100");
    const parsedBalance = parseFloat(userBalance);
    if (!isNaN(parsedBalance) && parsedBalance >= 0) {
        balance = parsedBalance;
    } else {
        alert("Invalid input. Starting with $100.00");
        balance = 100;
    }
    updateUI();
};

const jackpotOverlay = document.createElement('div');
jackpotOverlay.id = "jackpot-overlay";
document.body.appendChild(jackpotOverlay);

// Generate 36 slots
for (let i = 0; i < 36; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.id = `s${i}`;
    slot.innerHTML = `<div class="reel"><div class="symbol">?</div></div>`;
    gridElement.appendChild(slot);
}

const slots = Array.from(document.querySelectorAll('.slot'));

const playSound = (freq, type, duration, vol = 0.05) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
};

const spin = async () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const currentBet = parseFloat(betInput.value);
    if (isNaN(currentBet) || currentBet <= 0) {
        statusText.innerText = "Invalid Bet!";
        isAutoSpinning = false;
        return;
    }

    if (balance < currentBet) {
        statusText.innerText = "Insufficient Funds!";
        isAutoSpinning = false;
        updateUI();
        return;
    }

    balance -= currentBet;
    updateUI();
    spinBtn.disabled = true;
    betInput.disabled = true;
    statusText.innerText = "Spinning...";

    // 1 in 1,000,000 Jackpot Roll
    const jackpotRoll = Math.floor(Math.random() * 1000000) + 1;
    const isJackpotWinner = (jackpotRoll === 777777);

    // --- WEIGHTED PROBABILITY POOL ---
    // Increase frequency of common fruits to boost low-tier wins
    const weightedPool = [
        '🍎', '🍎', '🍎', // Triple weight
        '🍋', '🍋', '🍋', 
        '🍒', '🍒', '🍒', 
        '💎', '🔔'       // Standard weight
    ];

    const results = [];
    const animations = slots.map((slot, i) => {
        const reel = slot.querySelector('.reel');
        
        const strip = Array.from({ length: 14 }, () => {
            // Stars remain rare at 5%
            return Math.random() > 0.95 ? '⭐' : weightedPool[Math.floor(Math.random() * weightedPool.length)];
        });

        if (isJackpotWinner && i < 10) strip[strip.length - 1] = '⭐';

        const finalSymbol = strip[strip.length - 1];
        results.push(finalSymbol);

        reel.innerHTML = strip.map(s => `<div class="symbol ${s === '⭐' ? 'gold' : ''}">${s}</div>`).join('');
        reel.style.transition = 'none';
        reel.style.transform = 'translateY(0)';
        reel.offsetHeight; 

        return new Promise(resolve => {
            setTimeout(() => {
                const col = i % 6;
                const row = Math.floor(i / 6);
                const delay = col * 0.1 + row * 0.03;
                reel.style.transition = `transform ${0.5 + delay}s cubic-bezier(0.45, 0.05, 0.55, 0.95)`;
                reel.style.transform = `translateY(-${(strip.length - 1) * 75}px)`;
                setTimeout(() => {
                    // Fixed typo: 'tr iangle' -> 'triangle'
                    if (i % 6 === 0) playSound(120, 'triangle', 0.1, 0.03);
                    resolve();
                }, 500 + (delay * 1000));
            }, 50);
        });
    });

    await Promise.all(animations);

    const counts = {};
    results.forEach(s => counts[s] = (counts[s] || 0) + 1);

    let totalSpinWin = 0;

    for (const [symbol, count] of Object.entries(counts)) {
        if (symbol === '⭐') continue;

        if (count >= 10) {
            const intervals = Math.floor((count - 10) / 2);
            const payout = (currentBet * 0.2) * Math.pow(2, intervals);
            totalSpinWin += payout;
        } 
        else if (count >= 5) {
            const intervals = Math.floor((count - 5) / 2);
            // Low Tier: Start at 1.5x Bet multiplier (per your logic)
            const baseLow = currentBet * 0.15;
            const payout = baseLow + (baseLow * intervals * 0.5);
            totalSpinWin += payout;
        }
    }

    if (isJackpotWinner) {
        await triggerJackpot();
    } else if (totalSpinWin > 0) {
        balance += totalSpinWin;
        statusText.innerText = `WIN! +$${totalSpinWin.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        statusText.style.color = "#4ef037";
        const notes = totalSpinWin >= (currentBet * 2) ? [523, 659, 783, 1046] : [523, 659, 783];
        notes.forEach((f, i) => setTimeout(() => playSound(f, 'sine', 0.4, 0.1), i * 150));
    } else {
        statusText.innerText = "Try Again";
        statusText.style.color = "white";
    }

    updateUI();
    if (isAutoSpinning && balance >= currentBet) {
        await new Promise(r => setTimeout(r, 1200));
        spin();
    } else {
        isAutoSpinning = false;
        spinBtn.disabled = false;
        betInput.disabled = false;
        updateUI();
    }
};

const triggerJackpot = async () => {
    isAutoSpinning = false;
    const exponent = Math.random() * (9 - 6) + 6; 
    const jackpotAmount = Math.floor(Math.pow(10, exponent));
    balance += jackpotAmount;

    document.body.classList.add('shake');
    jackpotOverlay.style.display = 'flex';
    jackpotOverlay.innerHTML = `<h1>⭐ ULTRA RARE JACKPOT ⭐</h1><div style="font-size: 3.5rem">$${jackpotAmount.toLocaleString()}</div>`;
    
    for(let i=0; i<30; i++) {
        playSound(300 + (i % 3 * 200), 'square', 0.1, 0.1);
        await new Promise(r => setTimeout(r, 100));
    }

    await new Promise(r => setTimeout(r, 6000));
    jackpotOverlay.style.display = 'none';
    document.body.classList.remove('shake');
};

const updateUI = () => {
    balanceDisplay.innerText = balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    autoBtn.innerText = isAutoSpinning ? "AUTO: ON" : "AUTO: OFF";
    autoBtn.style.background = isAutoSpinning ? "#4ef037" : "#e94560";
};

spinBtn.addEventListener('click', () => { isAutoSpinning = false; spin(); });
autoBtn.addEventListener('click', () => { isAutoSpinning = !isAutoSpinning; updateUI(); if (isAutoSpinning) spin(); });
window.onload = init;