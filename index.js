const fallback = { increase: 0, decrease: 0, totalSun: 0 };
let state = { ...fallback };
let submitting = false;
let audioContext;
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n).toLocaleString('en-US');

function voterId() {
  let id = localStorage.getItem('sun-vote-voter-id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem('sun-vote-voter-id', id);
  }
  return id;
}
function render() {
  const total = state.increase + state.decrease;
  $('#increaseVotes').textContent = fmt(state.increase);
  $('#decreaseVotes').textContent = fmt(state.decrease);
  $('#totalSun').textContent = fmt(state.totalSun);
  $('#sunRatio').style.width = `${total ? Math.round(state.increase / total * 100) : 50}%`;
}
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1800); }
function playVoteAnimation(button, choice) {
  const animationClass = choice === 'increase' ? 'sun-flash' : 'ice-freeze';

  // 连续点击时允许动画重新开始
  button.classList.remove(animationClass);
  void button.offsetWidth;
  button.classList.add(animationClass);

  button.addEventListener(
    'animationend',
    () => button.classList.remove(animationClass),
    { once: true }
  );
}
function getAudioContext() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function playTone(context, frequency, start, duration, type, volume, targetFrequency = frequency) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(targetFrequency, start + duration);
  gain.gain.setValueAtTime(.001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .025);
  gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .03);
}

function playVoteSound(choice) {
  const context = getAudioContext();
  const now = context.currentTime;

  if (choice === 'increase') {
    [523, 659, 784, 1047].forEach((note, index) =>
      playTone(context, note, now + index * .075, .2, 'sine', .12, note * 1.06)
    );
  } else {
    playTone(context, 300, now, .72, 'triangle', .13, 92);
    [1568, 1319, 1047, 784].forEach((note, index) =>
      playTone(context, note, now + .08 + index * .13, .24, 'sine', .055, note * .68)
    );
  }
}




function rainPlants(button, asset, plantClass) {
  const box = button.getBoundingClientRect(); const holder = $('#fallingSunflowers');
  for (let i = 0; i < 18; i += 1) {
    const plant = document.createElement('span'); plant.className = `falling-flower ${plantClass}`;
    plant.style.left = `${box.left + box.width * (.12 + Math.random() * .76)}px`; plant.style.top = `${box.bottom - 18}px`;
    plant.style.setProperty('--drift', `${Math.random() * 180 - 90}px`); plant.style.setProperty('--drop', `${180 + Math.random() * 260}px`);
    plant.style.setProperty('--spin', `${Math.random() * 540 - 270}deg`); plant.style.animationDelay = `${i * 35}ms`;
    plant.innerHTML = `<img src="${asset}" alt="">`; holder.appendChild(plant); setTimeout(() => plant.remove(), 2200);
  }
}
async function loadTotals() {
  try { const response = await fetch('/api/vote'); if (!response.ok) throw new Error(); state = await response.json(); render(); }
  catch { render(); toast('当前为离线预览数据，部署后将同步全校票数。'); }
}
document.querySelectorAll('.vote').forEach((button) => button.addEventListener('click', async () => {
  if (submitting) return;
  const choice = button.dataset.vote; submitting = true;
  button.disabled = true;
playVoteAnimation(button, choice);
playVoteSound(choice);
  
  try {
    const response = await fetch('/api/vote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choice, voterId: voterId() }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '投票失败，请重试。');
    state = data; render();
    if (choice === 'increase') { rainPlants(button, 'sunflower.jpg', 'sunflower-fall'); toast('向日葵军团出发！阳光 +1'); }
    else { rainPlants(button, 'ice-shooter.jpg', 'ice-fall'); toast('寒冰射手出场！阳光 -1'); }
  } catch (error) { toast(error.message || '网络开小差了，请稍后重试。'); }
  finally { submitting = false; button.disabled = false; }
}));
loadTotals();
