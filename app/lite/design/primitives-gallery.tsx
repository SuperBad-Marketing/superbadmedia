"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DatePicker } from "@/components/ui/date-picker"

import { BrandHero } from "@/components/lite/brand-hero"
import { EmptyState } from "@/components/lite/empty-state"
import { SkeletonTile } from "@/components/lite/skeleton-tile"
import { Tier2Reveal } from "@/components/lite/tier-2-reveal"

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 py-4">
      <span
        className="uppercase tracking-wider text-xs"
        style={{ color: "var(--neutral-500)", fontFamily: "var(--font-label)" }}
      >
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

export function PrimitivesGallery() {
  const [date, setDate] = React.useState<Date | undefined>()

  return (
    <TooltipProvider>
      <div className="flex flex-col divide-y divide-[color:var(--neutral-600)]">
        <Row label="Button variants">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </Row>

        <Row label="Form inputs">
          <div className="flex flex-col gap-1.5 min-w-[240px]">
            <Label htmlFor="p-input">Email</Label>
            <Input id="p-input" placeholder="you@example.com" type="email" />
          </div>
          <div className="flex flex-col gap-1.5 min-w-[240px]">
            <Label htmlFor="p-textarea">Notes</Label>
            <Textarea id="p-textarea" placeholder="Type something." />
          </div>
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <Label>Status</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Pick one" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Row>

        <Row label="Toggles + radios">
          <div className="flex items-center gap-2">
            <Checkbox id="p-check" />
            <Label htmlFor="p-check">Accept terms</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="p-switch" />
            <Label htmlFor="p-switch">Emails on</Label>
          </div>
          <RadioGroup defaultValue="a" className="flex gap-3">
            <div className="flex items-center gap-2">
              <RadioGroupItem id="p-a" value="a" />
              <Label htmlFor="p-a">Option A</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="p-b" value="b" />
              <Label htmlFor="p-b">Option B</Label>
            </div>
          </RadioGroup>
        </Row>

        <Row label="Card + Badge + Avatar">
          <Card className="w-[260px]">
            <CardHeader>
              <CardTitle>Superbad HQ</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>AR</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm">Andy Robinson</span>
                <Badge variant="secondary">Admin</Badge>
              </div>
            </CardContent>
          </Card>
        </Row>

        <Row label="Dialog / Popover / Tooltip">
          <Dialog>
            <DialogTrigger render={<Button variant="outline">Open Dialog</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog title</DialogTitle>
                <DialogDescription>
                  Primitive-level dialog. Motion + aria handled by Base UI.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>

          <Popover>
            <PopoverTrigger render={<Button variant="outline">Popover</Button>} />
            <PopoverContent>A small floating panel.</PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost">Hover me</Button>} />
            <TooltipContent>Tooltip copy</TooltipContent>
          </Tooltip>
        </Row>

        <Row label="Accordion + Tabs">
          <Accordion className="w-[320px]">
            <AccordionItem value="1">
              <AccordionTrigger>First item</AccordionTrigger>
              <AccordionContent>Expanded body copy.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="2">
              <AccordionTrigger>Second item</AccordionTrigger>
              <AccordionContent>Another body.</AccordionContent>
            </AccordionItem>
          </Accordion>

          <Tabs defaultValue="overview" className="w-[320px]">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">Overview panel.</TabsContent>
            <TabsContent value="activity">Activity panel.</TabsContent>
          </Tabs>
        </Row>

        <Row label="Separator + Progress + Skeleton">
          <div className="w-[320px] flex flex-col gap-3">
            <Progress value={62} />
            <Separator />
            <Skeleton className="h-4 w-full" />
            <SkeletonTile className="h-20" />
          </div>
        </Row>

        <Row label="Table">
          <Table className="w-[420px]">
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Acme</TableCell>
                <TableCell>Quote</TableCell>
                <TableCell>$3,900</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Hooper &amp; Co.</TableCell>
                <TableCell>Retainer</TableCell>
                <TableCell>$5,400</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Row>

        <Row label="DatePicker">
          <DatePicker value={date} onChange={setDate} />
        </Row>

        <Row label="Toast (Sonner — aria-live)">
          <Button
            variant="outline"
            onClick={() =>
              toast("Action confirmed", {
                description: "Announced to screen readers via aria-live.",
              })
            }
          >
            Fire toast
          </Button>
        </Row>

        <Row label="BrandHero (Black Han Sans — closed list enforced)">
          <BrandHero location="marketing_landing_hero" size="h1">
            Real marketing for small business
          </BrandHero>
        </Row>

        <Row label="Tier2Reveal (CSS stub — A4 wires Framer choreographies)">
          <Tier2Reveal className="w-full max-w-md">
            <Card>
              <CardHeader>
                <CardTitle>I just arrived</CardTitle>
              </CardHeader>
              <CardContent>
                Fades + lifts in on mount. Vanishes under reduced-motion.
              </CardContent>
            </Card>
          </Tier2Reveal>
        </Row>

        <Row label="EmptyState">
          <div className="w-full max-w-lg rounded-md border border-[color:var(--neutral-600)]">
            <EmptyState
              hero="Nothing here yet"
              message="When leads start landing, they'll turn up here first."
            >
              <Button>Generate one</Button>
            </EmptyState>
          </div>
        </Row>
      </div>
    </TooltipProvider>
  )
}
