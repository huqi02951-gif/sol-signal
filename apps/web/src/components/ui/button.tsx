// Adapted from shadcn/ui Button (MIT), see vendor/shadcn-LICENSE.txt.
import * as React from 'react';
import {Slot} from '@radix-ui/react-slot';
import {cva,type VariantProps} from 'class-variance-authority';
import {clsx} from 'clsx';
import {twMerge} from 'tailwind-merge';
const variants=cva('btn transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed',{variants:{variant:{default:'',secondary:'secondary',danger:'warn'}},defaultVariants:{variant:'default'}});
export function Button({asChild=false,className,variant,...props}:React.ComponentProps<'button'>&VariantProps<typeof variants>&{asChild?:boolean}){const C=asChild?Slot:'button';return <C className={twMerge(clsx(variants({variant}),className))} {...props}/>;}
