/**
 * Kriging ordinario (modelo de variograma exponencial) para interpolar en el cliente.
 * Port compacto y tipado del algoritmo de kriging.js (Oliver Racz, MIT).
 *
 * A diferencia del IDW, el kriging usa la correlacion espacial (variograma) ajustada a los
 * datos, produciendo gradientes suaves entre puntos separados sin el artefacto 'bullseye'.
 *
 * Coste: el ajuste invierte una matriz n x n (O(n^3)). Para acotar tiempo y memoria, el
 * caller submuestrea a unos cientos de puntos antes de entrenar (kringingTrain no lo hace).
 */

export interface Variogram {
  x: number[]
  y: number[]
  nugget: number
  range: number
  sill: number
  A: number
  n: number
  M: number[]
}

function rep(v: number, n: number): number[] {
  return new Array(n).fill(v) as number[]
}

function matDiag(c: number, n: number): number[] {
  const Z = rep(0, n * n)
  for (let i = 0; i < n; i++) Z[i * n + i] = c
  return Z
}

function matTranspose(X: number[], n: number, m: number): number[] {
  const Z = new Array(m * n) as number[]
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) Z[j * n + i] = X[i * m + j]!
  return Z
}

function matAdd(X: number[], Y: number[], n: number, m: number): number[] {
  const Z = new Array(n * m) as number[]
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) Z[i * m + j] = X[i * m + j]! + Y[i * m + j]!
  return Z
}

function matMul(X: number[], Y: number[], n: number, m: number, p: number): number[] {
  const Z = new Array(n * p) as number[]
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      let s = 0
      for (let k = 0; k < m; k++) s += X[i * m + k]! * Y[k * p + j]!
      Z[i * p + j] = s
    }
  }
  return Z
}

/** Cholesky in-place (triangular inferior + diagonal). false si no es definida positiva. */
function matChol(X: number[], n: number): boolean {
  const p = rep(0, n)
  for (let i = 0; i < n; i++) p[i] = X[i * n + i]!
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) p[i]! -= X[i * n + j]! * X[i * n + j]!
    if (p[i]! <= 0) return false
    p[i] = Math.sqrt(p[i]!)
    for (let j = i + 1; j < n; j++) {
      for (let k = 0; k < i; k++) X[j * n + i]! -= X[j * n + k]! * X[i * n + k]!
      X[j * n + i]! /= p[i]!
    }
  }
  for (let i = 0; i < n; i++) X[i * n + i] = p[i]!
  return true
}

/** Inversa a partir del factor de Cholesky (in-place). */
function matChol2inv(X: number[], n: number): void {
  for (let i = 0; i < n; i++) {
    X[i * n + i] = 1 / X[i * n + i]!
    for (let j = i + 1; j < n; j++) {
      let sum = 0
      for (let k = i; k < j; k++) sum -= X[j * n + k]! * X[k * n + i]!
      X[j * n + i] = sum / X[j * n + j]!
    }
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) X[i * n + j] = 0
  for (let i = 0; i < n; i++) {
    X[i * n + i]! *= X[i * n + i]!
    for (let k = i + 1; k < n; k++) X[i * n + i]! += X[k * n + i]! * X[k * n + i]!
    for (let j = i + 1; j < n; j++) for (let k = j; k < n; k++) X[i * n + j]! += X[k * n + i]! * X[k * n + j]!
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) X[i * n + j] = X[j * n + i]!
}

function variogramExp(h: number, nugget: number, range: number, sill: number, A: number): number {
  return nugget + ((sill - nugget) / range) * (1 - Math.exp(-(1 / A) * (h / range)))
}

/** Ajusta el variograma y prepara los pesos. Retorna null si no converge. */
export function krigingTrain(t: number[], x: number[], y: number[], sigma2 = 0, alpha = 100): Variogram | null {
  const A = 1 / 3
  const n = t.length
  if (n < 3) return null

  // Distancias por pares (lag, semivarianza).
  const m = (n * n - n) / 2
  const distance = new Array(m) as [number, number][]
  for (let i = 0, k = 0; i < n; i++) {
    for (let j = 0; j < i; j++, k++) {
      const dx = x[i]! - x[j]!
      const dy = y[i]! - y[j]!
      distance[k] = [Math.sqrt(dx * dx + dy * dy), Math.abs(t[i]! - t[j]!)]
    }
  }
  distance.sort((a, b) => a[0] - b[0])
  let range = distance[m - 1]![0]
  if (range === 0) return null

  // Binning de los lags.
  const lags = m > 30 ? 30 : m
  const tolerance = range / lags
  let lag = rep(0, lags)
  let semi = rep(0, lags)
  let nLags: number
  if (lags < 30) {
    for (let l = 0; l < lags; l++) {
      lag[l] = distance[l]![0]
      semi[l] = distance[l]![1]
    }
    nLags = lags
  } else {
    let l = 0
    for (let i = 0, j = 0; i < lags && j < m; i++) {
      let k = 0
      while (distance[j]![0] <= (i + 1) * tolerance) {
        lag[l]! += distance[j]![0]
        semi[l]! += distance[j]![1]
        j++
        k++
        if (j >= m) break
      }
      if (k > 0) {
        lag[l]! /= k
        semi[l]! /= k
        l++
      }
    }
    lag = lag.slice(0, l)
    semi = semi.slice(0, l)
    nLags = l
  }
  if (nLags < 2) return null

  // Transformacion de features (modelo exponencial) y minimos cuadrados regularizados.
  range = lag[nLags - 1]! - lag[0]!
  if (range === 0) return null
  const X = rep(1, 2 * nLags)
  const Y = new Array(nLags) as number[]
  for (let i = 0; i < nLags; i++) {
    X[i * 2 + 1] = 1 - Math.exp(-(1 / A) * (lag[i]! / range))
    Y[i] = semi[i]!
  }
  const Xt = matTranspose(X, nLags, 2)
  let Z = matMul(Xt, X, 2, nLags, 2)
  Z = matAdd(Z, matDiag(1 / alpha, 2), 2, 2)
  if (!matChol(Z, 2)) return null
  matChol2inv(Z, 2)
  const W = matMul(matMul(Z, Xt, 2, 2, nLags), Y, 2, nLags, 1)
  let nugget = W[0]!
  const sill = W[1]! * range + nugget
  if (nugget < 0) nugget = 0

  // Matriz de Gram con el modelo e inversion (con regularizacion adaptativa).
  const K = new Array(n * n) as number[]
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const dx = x[i]! - x[j]!
      const dy = y[i]! - y[j]!
      const val = variogramExp(Math.sqrt(dx * dx + dy * dy), nugget, range, sill, A)
      K[i * n + j] = val
      K[j * n + i] = val
    }
    K[i * n + i] = variogramExp(0, nugget, range, sill, A)
  }
  let sig = sigma2
  let C = matAdd(K, matDiag(sig, n), n, n)
  let ok = matChol(C, n)
  let tries = 0
  while (!ok && tries < 6) {
    sig = sig > 0 ? sig * 10 : 1e-6
    C = matAdd(K, matDiag(sig, n), n, n)
    ok = matChol(C, n)
    tries++
  }
  if (!ok) return null
  matChol2inv(C, n)
  const M = matMul(C, t, n, n, 1)

  return { x: x.slice(), y: y.slice(), nugget, range, sill, A, n, M }
}

/** Predice el valor interpolado en (px, py). */
export function krigingPredict(px: number, py: number, v: Variogram): number {
  let s = 0
  for (let i = 0; i < v.n; i++) {
    const dx = px - v.x[i]!
    const dy = py - v.y[i]!
    s += variogramExp(Math.sqrt(dx * dx + dy * dy), v.nugget, v.range, v.sill, v.A) * v.M[i]!
  }
  return s
}
