"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * DatePicker — Calendar + Popover + Button composition.
 *
 * base-nova's registry doesn't ship DatePicker as a standalone primitive;
 * shadcn docs compose it from Calendar + Popover + Button. This is that
 * composition, exposed as `DatePicker` so feature code treats it as a
 * first-class primitive per the design-system-baseline inventory.
 *
 * Consumed tokens: radius (trigger), typography (placeholder), motion
 * (popover open/close via houseSpring defined in popover.tsx).
 */
function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled,
}: {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "justify-start text-left font-normal",
              !value && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon />
            {value ? format(value, "PPP") : <span>{placeholder}</span>}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
