import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'

/** Campo de formulario del panel admin: label + control + mensaje de error inline. */
type FieldControlProps = {
  id?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
}

type RenderControlProps = FieldControlProps & {
  render?: (...args: never[]) => ReactNode
}

export function Field({
  label,
  error,
  helper,
  htmlFor,
  children,
}: {
  label: string
  error?: string
  helper?: string
  htmlFor?: string
  children: ReactNode
}) {
  const generatedId = useId()
  const controlId = htmlFor ?? generatedId
  const labelId = `${controlId}-label`
  const messageId = `${controlId}-message`
  const describedBy = error || helper ? messageId : undefined
  const applyControlProps = (node: ReactNode) => {
    if (!isValidElement(node)) return node
    const props = node.props as FieldControlProps
    return cloneElement(node as ReactElement<FieldControlProps>, {
      id: props.id ?? controlId,
      'aria-labelledby': [props['aria-labelledby'], labelId].filter(Boolean).join(' '),
      'aria-describedby': [props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
      'aria-invalid': error ? true : props['aria-invalid'],
    })
  }

  let control = children
  if (isValidElement(children)) {
    const childProps = children.props as RenderControlProps
    if (typeof childProps.render === 'function') {
      const render = childProps.render
      control = cloneElement(children as ReactElement<RenderControlProps>, {
        render: (...args: never[]) => applyControlProps(render(...args)),
      })
    } else {
      control = applyControlProps(children)
    }
  }

  return (
    <div className="space-y-1.5">
      <Label id={labelId} htmlFor={controlId}>{label}</Label>
      <div role="group" aria-labelledby={labelId}>
        {control}
      </div>
      {!error && helper && <p id={messageId} className="text-sm leading-5 text-secondary">{helper}</p>}
      {error && (
        <p id={messageId} role="alert" className="text-sm font-medium leading-5 text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
