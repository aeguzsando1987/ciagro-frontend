import * as React from 'react'

import { Button, type ButtonProps } from '@/components/ui/button'

export interface IconButtonProps extends Omit<ButtonProps, 'aria-label'> {
  label: string
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, title, size = 'icon', type = 'button', ...props }, ref) => (
    <Button
      ref={ref}
      type={type}
      size={size}
      aria-label={label}
      title={title ?? label}
      {...props}
    />
  )
)
IconButton.displayName = 'IconButton'

export { IconButton }
