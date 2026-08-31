/**
 * Hilo aparte para la interpolación de la superficie de suelo.
 *
 * `analyzeSoilSurface` recorre una malla de hasta 260x260 celdas contra hasta
 * 1000 muestras: 67,600 interpolaciones que tardan entre 1 y 3 segundos en el
 * navegador. Corriendo en el hilo principal eso no ralentiza la interfaz, la
 * **congela**: JavaScript es de un solo hilo, así que durante ese cálculo no
 * corre ningún clic, ningún scroll ni ningún otro componente de la aplicación.
 *
 * El síntoma que lo delata es que el spinner sigue girando mientras todo lo demás
 * está muerto: las animaciones CSS las maneja el compositor del navegador, no el
 * hilo de JavaScript.
 *
 * Mover el cálculo aquí NO lo hace más rápido —sigue tardando lo mismo— pero deja
 * de secuestrar la aplicación mientras dura.
 */
import { analyzeSoilSurface, type AnalyzeSoilSurfaceOptions } from './soilMapSurface'

export interface SoilSurfaceRequest {
  id: number
  options: AnalyzeSoilSurfaceOptions
}

self.onmessage = (event: MessageEvent<SoilSurfaceRequest>) => {
  const { id, options } = event.data
  try {
    self.postMessage({ id, result: analyzeSoilSurface(options) })
  } catch (error) {
    // Nunca se deja morir la petición en silencio: quien la pidió está mostrando
    // "Calculando superficie…" y se quedaría ahí para siempre.
    self.postMessage({ id, error: (error as Error)?.message ?? 'Error de interpolación' })
  }
}
