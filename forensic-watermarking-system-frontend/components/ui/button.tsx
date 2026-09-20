import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_12px_30px_oklch(0.84_0.13_82_/_0.18)] hover:brightness-105',
        outline:
          'border-primary/35 bg-transparent text-primary hover:bg-primary/10',
        secondary:
          'bg-muted text-foreground hover:bg-muted/80',
        ghost:
          'hover:bg-muted hover:text-foreground',
        destructive:
          'bg-destructive/15 text-destructive hover:bg-destructive/25',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 gap-2 px-4 text-sm',
        xs: 'h-7 gap-1 px-2.5 text-xs',
        sm: 'h-8 gap-1.5 px-3 text-[0.8rem]',
        lg: 'h-12 w-full gap-2 px-5 text-sm',
        icon: 'size-10',
        'icon-xs': 'size-7',
        'icon-sm': 'size-8',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
