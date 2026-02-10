import React from 'react';
import { Anchor, Ship } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo = ({ className, showText = true, size = 'md' }: LogoProps) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <Link href="/" className={cn("flex items-center gap-2 transition-opacity hover:opacity-90", className)}>
      {/* Phần "Nút Cảng" - Icon Container */}
      <div className={cn(
        "relative flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/20",
        sizeClasses[size]
      )}>
        {/* Hiệu ứng bóng/sáng nhẹ ở góc */}
        <div className="absolute top-0 right-0 h-1/2 w-1/2 rounded-tr-xl bg-white/10 blur-[1px]" />
        
        {/* Icon Mỏ neo cách điệu */}
        <Anchor className={cn("relative z-10", iconSizes[size])} strokeWidth={2.5} />
      </div>

      {/* Phần Text (Tên dự án) */}
      {showText && (
        <div className="flex flex-col">
          <span className={cn("font-bold tracking-tight text-foreground leading-none", 
            size === 'lg' ? 'text-2xl' : 'text-xl'
          )}>
            Fresh<span className="text-blue-600">Sync</span>
          </span>
          <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
            Smart Port OS
          </span>
        </div>
      )}
    </Link>
  );
};