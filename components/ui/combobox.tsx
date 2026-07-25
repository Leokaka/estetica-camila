"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, SearchIcon } from "lucide-react"

const Combobox = ComboboxPrimitive.Root

function ComboboxInputGroup({
  className,
  ...props
}: ComboboxPrimitive.InputGroup.Props) {
  return (
    <ComboboxPrimitive.InputGroup
      data-slot="combobox-input-group"
      className={cn("relative flex items-center", className)}
      {...props}
    />
  )
}

function ComboboxInput({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) {
  return (
    <>
      <SearchIcon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className={cn(
          "h-10 w-full min-w-0 rounded-xl border border-input bg-brand-card pr-8 pl-9 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:text-sm",
          className
        )}
        {...props}
      />
      <ComboboxPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none absolute right-3 size-4 text-muted-foreground" />
        }
      />
    </>
  )
}

function ComboboxContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: Omit<ComboboxPrimitive.Popup.Props, "children"> &
  Pick<ComboboxPrimitive.Positioner.Props, "sideOffset"> & {
    children?: ComboboxPrimitive.List.Props["children"]
  }) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner sideOffset={sideOffset} className="isolate z-50">
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "relative isolate z-50 max-h-64 w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <ComboboxPrimitive.Empty className="px-3 py-6 text-center text-sm text-muted-foreground empty:m-0 empty:p-0">
            Nada encontrado
          </ComboboxPrimitive.Empty>
          <ComboboxPrimitive.List className="p-1">{children}</ComboboxPrimitive.List>
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon className="size-4" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

const useComboboxFilter = ComboboxPrimitive.useFilter

export { Combobox, ComboboxInputGroup, ComboboxInput, ComboboxContent, ComboboxItem, useComboboxFilter }
