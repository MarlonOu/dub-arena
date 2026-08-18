// 通用 Dynamic Time Warping（動態時間規整）演算法。
// 用於音高輪廓與能量包絡的時間對齊，处理玩家錄音與參考音檔長度、語速不一致的情況。

export interface DtwResult {
  totalCost: number;
  normalizedCost: number; // 每一步的平均成本，供分數換算使用
  path: Array<[number, number]>; // 對齊路徑，(參考序列index, 錄音序列index)
}

export function dtw(
  a: number[],
  b: number[],
  costFn: (x: number, y: number) => number
): DtwResult {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) {
    return { totalCost: Infinity, normalizedCost: Infinity, path: [] };
  }

  const D: Float64Array[] = Array.from({ length: n + 1 }, () =>
    new Float64Array(m + 1).fill(Infinity)
  );
  D[0][0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = costFn(a[i - 1], b[j - 1]);
      D[i][j] = cost + Math.min(D[i - 1][j], D[i][j - 1], D[i - 1][j - 1]);
    }
  }

  let i = n;
  let j = m;
  const path: Array<[number, number]> = [];
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const diag = D[i - 1][j - 1];
    const up = D[i - 1][j];
    const left = D[i][j - 1];
    if (diag <= up && diag <= left) {
      i--;
      j--;
    } else if (up < left) {
      i--;
    } else {
      j--;
    }
  }
  path.reverse();

  return {
    totalCost: D[n][m],
    normalizedCost: D[n][m] / Math.max(1, path.length),
    path,
  };
}
