const fallback = { increase: 0, decrease: 0, totalSun: 0 };

let state = { ...fallback };
let submitting = false;
let audioContext;
let stateVersion = 0;

const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n).toLocaleString('en-US');

function voterId() {
  let id = localStorage.getItem('sun-vote-voter-id');

  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

    localStorage.setItem('sun-vote-voter-id', id);
  }

  return id;
}

function render() {
  const total = state.increase + state.decrease;

  $('#increaseVotes').textContent = fmt(state.increase);
  $('#decreaseVotes').textContent = fmt(state.decrease);
  $('#totalSun').textContent = fmt(state.totalSun);

  $('#sunRatio').style.width =
    `${total ? Math.round(state.increase / total * 100) : 50}%`;
}

function toast(message) {
  const el = $('#toast');

  el.textContent = message;
  el.classList.add('show');

  setTimeout(() => {
    el.classList.remove('show');
  }, 1800);
}

function playVoteAnimation(button, choice) {
  const animationClass =
    choice === 'increase' ? 'sun-flash' : 'ice-freeze';

  button.classList.remove(animationClass);

  // 强制重新计算，让连续点击时动画可以重新开始
  void button.offsetWidth;

  button.classList.add(animationClass);

  button.addEventListener(
    'animationend',
    () => button.classList.remove(animationClass),
    { once: true }
  );
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  return audioContext;
}

function playTone(
  context,
  frequency,
  start,
  duration,
  type,
  volume,
  targetFrequency = frequency
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    targetFrequency,
    start + duration
  );

  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.connect(gain).connect(context.destination);

  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playVoteSound(choice) {
  const context = getAudioContext();
  const now = context.currentTime;

  if (choice === 'increase') {
    [523, 659, 784, 1047].forEach((note, index) => {
      playTone(
        context,
        note,
        now + index * 0.075,
        0.2,
        'sine',
        0.12,
        note * 1.06
      );
    });
  } else {
    playTone(context, 300, now, 0.72, 'triangle', 0.13, 92);

    [1568, 1319, 1047, 784].forEach((note, index) => {
      playTone(
        context,
        note,
        now + 0.08 + index * 0.13,
        0.24,
        'sine',
        0.055,
        note * 0.68
      );
    });
  }
}

function rainPlants(button, asset, plantClass) {
  const box = button.getBoundingClientRect();
  const holder = $('#fallingSunflowers');

  for (let i = 0; i < 18; i += 1) {
    const plant = document.createElement('span');

    plant.className = `falling-flower ${plantClass}`;
    plant.style.left =
      `${box.left + box.width * (0.12 + Math.random() * 0.76)}px`;
    plant.style.top = `${box.bottom - 18}px`;

    plant.style.setProperty(
      '--drift',
      `${Math.random() * 180 - 90}px`
    );

    plant.style.setProperty(
      '--drop',
      `${180 + Math.random() * 260}px`
    );

    plant.style.setProperty(
      '--spin',
      `${Math.random() * 540 - 270}deg`
    );

    plant.style.animationDelay = `${i * 35}ms`;

    plant.innerHTML = `<img src="${asset}" alt="">`;

    holder.appendChild(plant);

    setTimeout(() => {
      plant.remove();
    }, 2200);
  }
}

/* 背景图延后加载 */
function loadDecorativeBackground() {
  document.documentElement.classList.add('background-ready');
}

/* 先显示页面，不等待接口和背景图 */
render();

/* 浏览器空闲后再加载背景图 */
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(loadDecorativeBackground, {
    timeout: 1200
  });
} else {
  setTimeout(loadDecorativeBackground, 250);
}

async function loadTotals() {
  const requestVersion = ++stateVersion;

  try {
    const response = await fetch('/api/vote');

    if (!response.ok) {
      throw new Error();
    }

    const data = await response.json();

    // 防止较慢的旧请求覆盖最新投票结果
    if (requestVersion !== stateVersion) {
      return;
    }

    state = data;
    render();
  } catch {
    toast('当前暂时无法同步票数，请稍后再试。');
  }
}

document.querySelectorAll('.vote').forEach((button) => {
  button.addEventListener('click', async () => {
    if (submitting) {
      return;
    }

    const choice = button.dataset.vote;

    submitting = true;
    stateVersion += 1;
    button.disabled = true;

    playVoteAnimation(button, choice);
    playVoteSound(choice);

    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          choice,
          voterId: voterId()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '投票失败，请重试。');
      }

      state = data;
      render();

      if (choice === 'increase') {
        rainPlants(button, 'sunflower.jpg', 'sunflower-fall');
        toast('向日葵军团出发！阳光 +1');
      } else {
        rainPlants(button, 'ice-shooter.jpg', 'ice-fall');
        toast('寒冰射手出场！阳光 -1');
      }
    } catch (error) {
      toast(error.message || '网络开小差了，请稍后重试。');
    } finally {
      submitting = false;
      button.disabled = false;
    }
  });
});

/* 后台读取票数 */
loadTotals();
