import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
type Size = "default" | "sm" | "lg" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground hover:opacity-90 shadow-sm",
  secondary: "bg-muted text-foreground hover:bg-muted/70",
  outline: "border bg-card hover:bg-muted",
  ghost: "hover:bg-muted text-foreground",
  destructive: "bg-destructive text-white hover:opacity-90",
  link: "text-primary underline-offset-4 hover:underline px-0",
};
const sizes: Record<Size, string> = {
  default: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
  "icon-sm": "h-8 w-8",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const buttonClass = (variant: Variant = "default", size: Size = "default", className?: string) =>
  cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-all select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />
  ),
);
Button.displayName = "Button";
