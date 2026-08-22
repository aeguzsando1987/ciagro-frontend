import type { SVGProps } from 'react'

/**
 * Silos de grano — icono propio.
 *
 * Lucide no trae ninguno: `Factory` sugiere industria pesada, `Warehouse` es una nave
 * a dos aguas que se lee como cochera, y `Cylinder` o `Database` son un cilindro
 * suelto y un icono de base de datos. Una CIAgro es una unidad de acopio y operación
 * agrícola, y el silo es su imagen reconocible.
 *
 * Composición: tres silos, el central más alto y detrás, dos menores delante. En un
 * icono de solo trazo no se puede tapar con relleno, así que la profundidad se
 * consigue cortando el cuerpo del silo central justo donde arrancan las cúpulas de los
 * delanteros: el ojo completa la parte oculta.
 *
 * Sigue las convenciones de lucide para no desentonar con los demás iconos del árbol:
 * lienzo 24x24, sin relleno, trazo de 2 con extremos y uniones redondeados, y
 * `currentColor` para heredar el color del texto.
 */
export function SiloIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* Silo central, el más alto: cúpula y el tramo de cuerpo que queda a la vista
          por encima de los otros dos. Termina en y=12, donde empiezan las cúpulas
          delanteras, para que se lea como si continuara por detrás. */}
      <path d="M8 12V7a4 4 0 0 1 8 0v5" />
      {/* Silo delantero izquierdo */}
      <path d="M2 21v-8a3.5 3.5 0 0 1 7 0v8" />
      {/* Silo delantero derecho */}
      <path d="M15 21v-8a3.5 3.5 0 0 1 7 0v8" />
      {/* Suelo: apoya el conjunto y evita que los tres floten sueltos */}
      <path d="M1 21h22" />
    </svg>
  )
}
