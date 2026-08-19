interface AnimatedAgroindustryLogoProps {
  className?: string
  gearClassName?: string
}

export function AnimatedAgroindustryLogo({
  className = '',
  gearClassName = 'cia-login-gear',
}: AnimatedAgroindustryLogoProps) {
  return (
    <div
      role="img"
      aria-label="GPA Agroindustry"
      className={`relative aspect-[5390/2040] ${className}`}
    >
      <img
        src="/agroindustry-gear.png"
        alt=""
        aria-hidden="true"
        className={`${gearClassName} absolute left-0 top-[3.627%] z-0 h-auto w-[34.49%] select-none`}
        draggable={false}
      />
      <img
        src="/agroindustry-static.png"
        alt=""
        aria-hidden="true"
        className="relative z-10 block h-auto w-full select-none"
        draggable={false}
      />
    </div>
  )
}
