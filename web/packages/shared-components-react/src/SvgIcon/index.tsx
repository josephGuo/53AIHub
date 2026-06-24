import React, { forwardRef } from "react";
import type { CSSProperties, MouseEventHandler } from "react";

export type SvgIconProps = {
  name: string;
  size?: number | string;
  color?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<SVGSVGElement>;
};

export const SvgIcon = forwardRef<SVGSVGElement, SvgIconProps>(
  ({ name, size = 16, color, className, style, onClick }, ref) => {
    const s = typeof size === "number" ? `${size}px` : size;

    return (
      <svg
        ref={ref}
        className={className}
        style={{
          width: s,
          height: s,
          fill: color ?? "currentColor",
          color: color ?? "currentColor",
          ...style,
        }}
        onClick={onClick}
        aria-hidden
      >
        <use href={`#icon-${name}`} />
      </svg>
    );
  },
);

SvgIcon.displayName = "SvgIcon";

export default SvgIcon;
