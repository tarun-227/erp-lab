import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Design system: soft clay controls (12 px radius, soft press), 36-44 px targets. See design-system/erp-lab/MASTER.md.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-[15px] font-medium whitespace-nowrap transition-[background-color,box-shadow,transform,color] duration-150 ease-out outline-none select-none active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-clay hover:bg-[color-mix(in_oklab,var(--primary),black_10%)] dark:hover:bg-[color-mix(in_oklab,var(--primary),white_12%)]",
        outline:
          "border-border bg-card text-foreground shadow-[0_1px_0_rgb(30_27_75/0.04)] hover:border-primary/40 hover:bg-primary-soft aria-expanded:bg-primary-soft",
        secondary:
          "bg-primary-soft text-secondary-foreground hover:bg-[color-mix(in_oklab,var(--primary-soft),var(--primary)_10%)] aria-expanded:bg-primary-soft",
        ghost:
          "text-foreground hover:bg-primary-soft aria-expanded:bg-primary-soft",
        destructive:
          "bg-destructive-soft text-destructive hover:bg-[color-mix(in_oklab,var(--destructive-soft),var(--destructive)_12%)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 gap-2 px-4",
        xs: "h-7 gap-1 rounded-lg px-2.5 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-lg px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-11 gap-2 px-5 text-base",
        icon: "size-10",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 rounded-lg",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
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
