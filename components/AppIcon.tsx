import Image from "next/image";

type Props = {
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
};

export function AppIcon({ size = 28, className, alt = "SnapMath", priority }: Props) {
  return (
    <Image
      src="/site-title-icon.png"
      alt={alt}
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  );
}
