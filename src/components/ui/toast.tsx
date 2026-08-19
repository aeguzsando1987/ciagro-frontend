import { Toaster as SonnerToaster, toast } from 'sonner'

function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            '!rounded-lg !border-default !bg-surface !font-sans !text-foreground !shadow-overlay',
          description: '!text-secondary',
          success: '!border-success/20',
          error: '!border-danger/20',
          warning: '!border-warning/25',
          info: '!border-info/20',
          actionButton: '!rounded-md !bg-primary !text-white hover:!bg-primary-hover',
          cancelButton: '!rounded-md !bg-surface-secondary !text-control',
          closeButton: '!border-default !bg-surface !text-secondary hover:!bg-surface-secondary',
        },
      }}
    />
  )
}

export { Toaster, toast }
