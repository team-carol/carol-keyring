// 레이아웃 확인용 샘플 아이콘. 실제 아이콘(maishift iconUrl)을 붙이기 전까지 디더링이 어떻게 보이는지 볼 때 쓴다.
// 게임 아이콘을 흉내 내지 않은, 캔버스로 그린 단순한 그림이다 (그라데이션 바탕, 얼굴, 별).

let cached: HTMLCanvasElement | null = null;

export function sampleIcon(): HTMLCanvasElement {
  if (cached) return cached;
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 바탕: 위는 하늘색, 아래는 분홍
  const sky = ctx.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, '#8fd3f4');
  sky.addColorStop(1, '#f9c5d1');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size, size);

  // 별
  ctx.fillStyle = '#ffd84d';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? 22 : 9;
    ctx.lineTo(128 + Math.cos(angle) * radius, 34 + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();

  // 머리카락
  ctx.fillStyle = '#5b3a29';
  ctx.beginPath();
  ctx.arc(78, 92, 56, Math.PI, 0);
  ctx.lineTo(134, 140);
  ctx.lineTo(22, 140);
  ctx.closePath();
  ctx.fill();

  // 얼굴
  const skin = ctx.createRadialGradient(70, 90, 10, 78, 100, 50);
  skin.addColorStop(0, '#ffe3cf');
  skin.addColorStop(1, '#f2b99a');
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(78, 104, 42, 46, 0, 0, Math.PI * 2);
  ctx.fill();

  // 앞머리
  ctx.fillStyle = '#5b3a29';
  ctx.beginPath();
  ctx.moveTo(34, 92);
  ctx.quadraticCurveTo(60, 50, 122, 88);
  ctx.quadraticCurveTo(84, 70, 34, 92);
  ctx.fill();

  // 눈, 볼
  ctx.fillStyle = '#2b1d16';
  ctx.beginPath();
  ctx.ellipse(62, 108, 5, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(94, 108, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(240, 90, 110, 0.55)';
  ctx.beginPath();
  ctx.ellipse(52, 124, 9, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(104, 124, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 입
  ctx.strokeStyle = '#a23b3b';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(78, 126, 8, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // 옷
  ctx.fillStyle = '#e8473f';
  ctx.beginPath();
  ctx.moveTo(30, size);
  ctx.quadraticCurveTo(78, 136, 126, size);
  ctx.fill();

  cached = canvas;
  return canvas;
}
