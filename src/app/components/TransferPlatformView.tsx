'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Truck,
  Download,
  RefreshCw,
  ShoppingCart,
  Plus,
  Minus,
  MapPin,
  LayoutGrid,
  X,
  Sparkles,
  SlidersHorizontal,
  Filter,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

// react-query
import { useQuery, useQueryClient } from '@tanstack/react-query'

// shadcn/ui
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// services & types (new InventoryService contracts)
import { InventoryService, StoreService, OrderService } from '@/lib/services/InventoryService'
import type { GroupedProduct, OrderItem } from '@/lib/services/InventoryService'

/**
 * Transfer Platform — Wizard Edition (patched)
 * - Uses InventoryService.getNetworkInventory(currentBranchId, allBranches)
 * - Falls back to synthetic distance when store locations are missing
 * - Preflight validation updated to use the new inventory fetch path
 */

// ---------- Helpers ----------
const getQty = (d: any): number => Number(d?.qty ?? d?.quantity ?? 0)
const getBasePrice = (d: any): number => Number(d?.basePrice ?? d?.price ?? 0)
const getPromoPrice = (d: any): number | null => {
  const v = d?.promoPrice ?? d?.discountPrice
  return v == null ? null : Number(v)
}
const getEffectivePrice = (d: any): { price: number; base: number; hasPromo: boolean } => {
  const base = getBasePrice(d)
  const promo = getPromoPrice(d)
  return { price: promo != null ? promo : base, base, hasPromo: promo != null }
}

function seededRand(seed: string, min: number, max: number): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  h = (h ^ (h >>> 16)) >>> 0
  const r = h / 0xffffffff
  return Math.round((min + (max - min) * r) * 10) / 10
}

type LatLng = { lat: number; lng: number }
type LatLngMap = Record<string, LatLng | undefined>

function kmBetween(a: LatLng, b: LatLng): number {
  const toRad = (x: number) => (x * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return Math.round(R * c * 10) / 10
}

function formatTHB(n: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)
}
const safeMin = (v: number) => (v === Infinity ? 0 : v)

// ---------- Types ----------

type BranchSummary = {
  branchId: string
  branchName: string
  distance: number
  available: number
  minPrice: number
  hasPromo: boolean
  node: any // raw branch node
}

type ProductRow = {
  key: string
  productName: string
  brand: string
  model?: string
  hasPromoAny: boolean
  totalAvailable: number
  minPriceAll: number
  grouped: GroupedProduct
}

// Wizard types

type SpecOption = { spec: string; total: number; minPrice: number; hasPromo: boolean }

type BranchForSpec = BranchSummary & { maxPrice: number }

// ---------- Component ----------
export default function TransferPlatformView({
  myBranchId,
  myBranchName,
}: {
  myBranchId: string
  myBranchName: string
}) {
  const qc = useQueryClient()

  // UI state
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(
    () => (typeof window !== 'undefined' ? (localStorage.getItem('tp:view') as any) : null) || 'grid'
  )
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Filters
  const [selectedBrand, setSelectedBrand] = useState('All Brands')
  const [searchTerm, setSearchTerm] = useState('')
  const [inStockOnly, setInStockOnly] = useState(true)
  const [hasPromotion, setHasPromotion] = useState(false)
  const [sortBy, setSortBy] = useState<'relevance' | 'price' | 'brand'>('relevance')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Cart
  interface CartItemView extends Omit<OrderItem, 'unitPrice' | 'totalPrice'> {
    branchId: string
    branchName: string
    productName: string
    maxQty: number
  }
  const [cart, setCart] = useState<CartItemView[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notes, setNotes] = useState('')

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardProduct, setWizardProduct] = useState<GroupedProduct | null>(null)

  // Pause auto refresh while any modal is open
  const anyModalOpen = wizardOpen || isCartOpen

  // ------- Data fetching (React Query) -------
  const invQuery = useQuery<{
    inv: GroupedProduct[]
    stores: Record<string, string>
    coords?: LatLngMap
  }>({
    queryKey: ['inventory', 'network', myBranchId],
    queryFn: async () => {
      // Visible branches map {id: name}
      const storeMap = await StoreService.getAllStores()

      // Build Branch[] for InventoryService.getNetworkInventory
      const allBranches: { id: string; branchName: string }[] = Object.entries(storeMap).map(
        ([id, branchName]) => ({ id, branchName })
      )

      // Load network inventory (excludes current branch internally)
      const inv = await InventoryService.getNetworkInventory(myBranchId, allBranches)

      // Try to collect coordinates from Store documents (optional)
      let coords: LatLngMap | undefined
      try {
        const entries = await Promise.all(
          Object.keys(storeMap).map(async (id) => {
            try {
              const s = await StoreService.getStore(id)
              const lat = s?.location?.lat
              const lng = s?.location?.lng
              return lat != null && lng != null ? [id, { lat, lng }] : [id, undefined]
            } catch {
              return [id, undefined] as const
            }
          })
        )
        coords = Object.fromEntries(entries)
      } catch {
        // ignore — distance will fall back to seededRand
      }

      return { inv: inv ?? [], stores: storeMap ?? {}, coords }
    },
    staleTime: 60_000,
    refetchInterval: anyModalOpen ? false : 60_000,
    refetchOnWindowFocus: !anyModalOpen,
  })

  useEffect(() => {
    if (invQuery.isFetched) setLastUpdated(new Date())
  }, [invQuery.isFetched])

  const isLoading = invQuery.isLoading || invQuery.isRefetching
  const inventory = (invQuery.data?.inv ?? []) as GroupedProduct[]
  const stores = (invQuery.data?.stores ?? {}) as Record<string, string>
  const coords = (invQuery.data?.coords ?? {}) as LatLngMap

  const getDistanceKm = (branchId: string): number => {
    const me = coords?.[String(myBranchId)]
    const other = coords?.[String(branchId)]
    if (me && other) return kmBetween(me, other)
    return seededRand(String(branchId), 0.8, 6.8)
  }

  const availableBrands = useMemo(
    () => Array.from(new Set(inventory.map((i) => i.brand ?? 'Unknown'))).sort(),
    [inventory]
  )

  // ------- Build Product rows -------
  const productRows: ProductRow[] = useMemo(() => {
    const rows: ProductRow[] = []
    for (const p of inventory) {
      const branches: any[] = p.branches ?? []
      let hasPromo = false
      let total = 0
      let minAll = Infinity

      for (const b of branches) {
        for (const s of b.sizes ?? []) {
          for (const d of s.dots ?? []) {
            const { price, hasPromo: promo } = getEffectivePrice(d)
            const q = getQty(d)
            if (q > 0) {
              total += q
              minAll = Math.min(minAll, price)
            }
            if (promo) hasPromo = true
          }
        }
      }
      if (inStockOnly && total <= 0) continue
      if (hasPromotion && !hasPromo) continue

      rows.push({
        key: String(p.id),
        productName: p.name,
        brand: p.brand,
        model: p.model,
        hasPromoAny: hasPromo,
        totalAvailable: total,
        minPriceAll: safeMin(minAll),
        grouped: p,
      })
    }

    const q = searchTerm.trim().toLowerCase()
    const filtered = rows
      .filter((r) => (selectedBrand === 'All Brands' ? true : r.brand?.toLowerCase() === selectedBrand.toLowerCase()))
      .filter((r) => (!q ? true : `${r.productName} ${r.brand} ${r.model}`.toLowerCase().includes(q)))

    const dir = sortDir === 'asc' ? 1 : -1
    filtered.sort((a, b) => {
      const byPrice = () => (a.minPriceAll - b.minPriceAll) * dir
      const byStock = () => (b.totalAvailable - a.totalAvailable) * dir
      const byBrand = () => a.brand.localeCompare(b.brand)
      switch (sortBy) {
        case 'price':
          return byPrice() || byStock() || byBrand()
        case 'brand':
          return byBrand()
        case 'relevance':
        default:
          return byStock() || byPrice() || byBrand()
      }
    })

    return filtered
  }, [inventory, selectedBrand, searchTerm, inStockOnly, hasPromotion, sortBy, sortDir])

  // ------- KPIs -------
  const kpis = useMemo(() => {
    const products = productRows.length
    const units = productRows.reduce((s, r) => s + r.totalAvailable, 0)
    const avgPrice = products ? Math.round(productRows.reduce((s, r) => s + r.minPriceAll, 0) / products) : 0
    const branches = new Set(inventory.flatMap((p) => (p.branches ?? []).map((b: any) => String(b.branchId)))).size
    const low = 0 // simplified
    return { products, units, low, branches, avgPrice }
  }, [productRows, inventory])

  // ------- Cart helpers -------
  const cartCount = useMemo(() => cart.reduce((s, it) => s + it.quantity, 0), [cart])
  const cartSourceBranchName = useMemo(() => (cart.length ? cart[0].branchName : 'your cart'), [cart])

  const removeFromCart = (dotCode: string, variantId: string, branchId: string) => {
    setCart((c) => c.filter((it) => !(it.dotCode === dotCode && it.variantId === variantId && it.branchId === branchId)))
  }

  async function preflightValidateCart(items: CartItemView[]): Promise<{ ok: boolean; message?: string }> {
    try {
      // Build Branch[] once from current stores map
      const allBranches = Object.entries(stores).map(([id, branchName]) => ({ id, branchName }))
      const latest = await InventoryService.getNetworkInventory(myBranchId, allBranches)
      const map: Record<string, any> = {}
      for (const p of latest ?? []) map[String(p.id)] = p

      for (const it of items) {
        const p = map[String(it.productId)]
        if (!p) return { ok: false, message: `Product ${it.productName} not found anymore.` }
        const branch = (p.branches ?? []).find((b: any) => String(b.branchId) === String(it.branchId))
        if (!branch) return { ok: false, message: `Branch changed for ${it.productName}.` }
        let available = 0
        for (const s of branch.sizes ?? []) {
          if (String(s.variantId ?? '') !== String(it.variantId)) continue
          for (const d of s.dots ?? []) {
            if (String(d.dotCode ?? '') !== String(it.dotCode)) continue
            available = getQty(d)
          }
        }
        if (available < it.quantity)
          return { ok: false, message: `${it.productName} ${it.specification} ${it.dotCode} updated: only ${available} left.` }
      }
      return { ok: true }
    } catch (e: any) {
      return { ok: false, message: e?.message ?? 'Unable to validate inventory.' }
    }
  }

  const handleSubmitOrder = async () => {
    if (!cart.length) return
    setIsSubmitting(true)
    try {
      const pf = await preflightValidateCart(cart)
      if (!pf.ok) {
        toast.error(pf.message ?? 'Inventory changed. Please review your cart.')
        setIsSubmitting(false)
        return
      }
      const sellerBranchId = cart[0].branchId
      const sellerBranchName = cart[0].branchName
      await OrderService.createOrder({
        buyerBranchId: myBranchId,
        buyerBranchName: myBranchName,
        sellerBranchId,
        sellerBranchName,
        items: cart.map(({ branchId, branchName, maxQty, ...item }) => item),
        notes,
      })
      toast.success(`Transfer request sent to ${sellerBranchName}!`)
      setCart([])
      setNotes('')
      setIsCartOpen(false)
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'buyer'] })
    } catch (e: any) {
      toast.error(`Failed to send request: ${e?.message ?? 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------- Wizard ----------
  type Step = 'spec' | 'branch' | 'dot'
  const [step, setStep] = useState<Step>('spec')
  const canGoBack = step !== 'spec'
  const goBack = () => setStep((s) => (s === 'dot' ? 'branch' : 'spec'))

  const [selectedSpec, setSelectedSpec] = useState<SpecOption | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<BranchForSpec | null>(null)

  type PickRow = {
    sizeSpec: string
    variantId: string
    dotCode: string
    available: number
    price: number
    hasPromo: boolean
    selected: number
  }
  const [dotPicks, setDotPicks] = useState<PickRow[]>([])

  // open wizard with product
  const openWizard = (p: GroupedProduct) => {
    setWizardProduct(p)
    setSelectedSpec(null)
    setSelectedBranch(null)
    setDotPicks([])
    setStep('spec')
    setWizardOpen(true)
  }

  // build options for spec step
  const specOptions: SpecOption[] = useMemo(() => {
    if (!wizardProduct) return []
    const map = new Map<string, SpecOption>()
    for (const b of (wizardProduct.branches ?? []) as any[]) {
      for (const s of b.sizes ?? []) {
        let total = 0
        let min = Infinity
        let promo = false
        for (const d of s.dots ?? []) {
          const { price, hasPromo } = getEffectivePrice(d)
          const q = getQty(d)
          if (q > 0) {
            total += q
            min = Math.min(min, price)
          }
          if (hasPromo) promo = true
        }
        const spec = String(s.specification ?? 'N/A')
        if (!map.has(spec)) map.set(spec, { spec, total: 0, minPrice: Infinity, hasPromo: false })
        const prev = map.get(spec)!
        prev.total += total
        prev.minPrice = Math.min(prev.minPrice, min)
        prev.hasPromo = prev.hasPromo || promo
      }
    }
    return Array.from(map.values())
      .filter((o) => (inStockOnly ? o.total > 0 : true))
      .sort((a, b) => b.total - a.total || a.minPrice - b.minPrice)
  }, [wizardProduct, inStockOnly])

  // build branch list for selected spec
  const [branchSort, setBranchSort] = useState<'distance' | 'price' | 'stock'>('distance')
  const [branchDir, setBranchDir] = useState<'asc' | 'desc'>('asc')
  const [onlyPromoBranch, setOnlyPromoBranch] = useState(false)
  const [onlyInStockBranch, setOnlyInStockBranch] = useState(true)

  const branchesForSpec: BranchForSpec[] = useMemo(() => {
    if (!wizardProduct || !selectedSpec) return []
    const list: BranchForSpec[] = []
    for (const b of (wizardProduct.branches ?? []) as any[]) {
      let total = 0
      let min = Infinity
      let max = 0
      let promo = false
      for (const s of b.sizes ?? []) {
        if (String(s.specification ?? '') !== selectedSpec.spec) continue
        for (const d of s.dots ?? []) {
          const { price, hasPromo } = getEffectivePrice(d)
          const q = getQty(d)
          if (q > 0) {
            total += q
            min = Math.min(min, price)
            max = Math.max(max, price)
          }
          if (hasPromo) promo = true
        }
      }
      if (onlyInStockBranch && total <= 0) continue
      if (onlyPromoBranch && !promo) continue

      list.push({
        branchId: String(b.branchId),
        branchName: b.branchName as string,
        distance: getDistanceKm(String(b.branchId)),
        available: total,
        minPrice: safeMin(min),
        hasPromo: promo,
        node: b,
        maxPrice: max,
      })
    }
    const dir = branchDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const byPrice = () => (a.minPrice - b.minPrice) * dir
      const byDist = () => (a.distance - b.distance) * dir
      const byStock = () => (b.available - a.available) * dir
      return branchSort === 'price' ? byPrice() || byDist() || byStock() : branchSort === 'stock' ? byStock() || byPrice() || byDist() : byDist() || byPrice() || byStock()
    })
    return list
  }, [wizardProduct, selectedSpec, branchSort, branchDir, onlyPromoBranch, onlyInStockBranch])

  // when choose branch → build DOT picks
  const loadDotPicks = (branch: BranchForSpec) => {
    if (!wizardProduct || !selectedSpec) return
    const picks: any[] = []
    for (const s of (branch.node?.sizes ?? []) as any[]) {
      if (String(s.specification ?? '') !== selectedSpec.spec) continue
      for (const d of s.dots ?? []) {
        const { price, hasPromo } = getEffectivePrice(d)
        const q = getQty(d)
        if (q > 0) {
          picks.push({
            sizeSpec: selectedSpec.spec,
            variantId: String(s.variantId ?? ''),
            dotCode: String(d.dotCode ?? ''),
            available: q,
            price,
            hasPromo,
            selected: 0,
          })
        }
      }
    }
    picks.sort((a, b) => b.available - a.available || a.price - b.price)
    setDotPicks(picks)
  }

  const changePick = (dotCode: string, variantId: string, delta: number) => {
    setDotPicks((picks) =>
      picks.map((p) => (p.dotCode === dotCode && p.variantId === variantId ? { ...p, selected: Math.max(0, Math.min(p.available, p.selected + delta)) } : p))
    )
  }

  // one-branch rule confirm
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const confirmClearRef = useRef<{ onConfirm?: () => void }>({})

  const addToCart = () => {
    if (!wizardProduct || !selectedBranch) return
    const items = dotPicks.filter((p) => p.selected > 0)
    if (items.length === 0) {
      toast.info('Please select quantity.')
      return
    }
    if (cart.length > 0 && cart[0].branchId !== selectedBranch.branchId) {
      confirmClearRef.current.onConfirm = () => {
        setCart([])
        _add(items)
      }
      setConfirmClearOpen(true)
      return
    }
    _add(items)
  }

  const _add = (items: any[]) => {
    if (!wizardProduct || !selectedBranch) return
    const newItems: CartItemView[] = items.map((it) => ({
      branchId: selectedBranch.branchId,
      branchName: selectedBranch.branchName,
      productId: wizardProduct.id,
      productName: wizardProduct.name,
      specification: it.sizeSpec,
      dotCode: it.dotCode,
      quantity: it.selected,
      variantId: it.variantId,
      maxQty: it.available,
    }))

    setCart((prev) => {
      const other = prev.filter((x) => x.branchId !== selectedBranch.branchId)
      const same = prev.filter((x) => x.branchId === selectedBranch.branchId)
      newItems.forEach((ni) => {
        const idx = same.findIndex((x) => x.dotCode === ni.dotCode && x.variantId === ni.variantId)
        if (idx > -1) same[idx] = ni
        else same.push(ni)
      })
      return [...other, ...same].filter((x) => x.quantity > 0)
    })

    setWizardOpen(false)
    setIsCartOpen(true)
    toast.success('Cart updated')
  }

  // ---------- UI blocks ----------
  const HeaderBar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Transfer Platform</h1>
          <Sparkles className="h-5 w-5 text-amber-500" />
        </div>
        <p className="text-muted-foreground flex items-center gap-2">
          <span>ค้นหาและขอสินค้าจากสาขาอื่น</span>
          {lastUpdated ? <span className="text-xs">• อัปเดต {lastUpdated.toLocaleTimeString()}</span> : null}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList>
              <TabsTrigger value="grid" className="gap-1">
                <LayoutGrid className="h-4 w-4" /> Cards
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-1" disabled>
                <span className="opacity-60">Table</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="hidden md:flex items-center gap-1 rounded-full border px-2 py-1 bg-white shadow-sm">
          <span className="text-xs text-muted-foreground mr-1">Sort</span>
          <Button variant={sortBy === 'price' ? 'default' : 'ghost'} size="sm" className="rounded-full" onClick={() => setSortBy('price')}>
            Price
          </Button>
          <Button variant={sortBy === 'brand' ? 'default' : 'ghost'} size="sm" className="rounded-full" onClick={() => setSortBy('brand')}>
            Brand
          </Button>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))} title={sortDir === 'asc' ? 'Ascending' : 'Descending'}>
            {sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={() => invQuery.refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportCSV(productRows)}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button size="sm" onClick={() => setIsCartOpen(true)}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Cart ({cartCount})
        </Button>
      </div>
    </div>
  )

  const FilterBar = (
    <div className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-background/80 bg-background/95 border-b">
      <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
        <div className="w-full space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search products, brands..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Most Relevant</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="brand">Brand A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Brands">All Brands</SelectItem>
                {availableBrands.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={inStockOnly} onCheckedChange={(v) => setInStockOnly(Boolean(v))} />
              <Label>In Stock Only</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={hasPromotion} onCheckedChange={(v) => setHasPromotion(Boolean(v))} />
              <Label>On Sale</Label>
            </div>
            {(selectedBrand !== 'All Brands' || !inStockOnly || hasPromotion || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedBrand('All Brands')
                  setInStockOnly(true)
                  setHasPromotion(false)
                  setSearchTerm('')
                  toast.info('Filters cleared')
                }}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const KpiBar = (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[
        { title: 'Available Products', value: kpis.products },
        { title: 'Units in Stock', value: kpis.units },
        { title: 'Low Stock Items', value: kpis.low },
        { title: 'Active Branches', value: kpis.branches },
        { title: 'Avg Price', value: formatTHB(kpis.avgPrice) },
      ].map((k, i) => (
        <motion.div key={k.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card className="rounded-2xl shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{k.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{k.value}</CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )

  const ProductCard: React.FC<{ r: ProductRow }> = ({ r }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="group relative rounded-2xl border bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              {r.brand}
              {r.model ? ` • ${r.model}` : ''}
            </div>
            <h3 className="font-semibold leading-tight truncate text-lg">{r.productName}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {r.hasPromoAny && <Badge className="bg-green-600 hover:bg-green-600 text-white">Sale</Badge>}
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => openWizard(r.grouped)}>
              Details
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border bg-muted/40 px-3 py-2 text-center">
            <div
              className={cn(
                'text-lg font-bold',
                r.totalAvailable === 0 ? 'text-red-600' : r.totalAvailable < 6 ? 'text-amber-600' : 'text-green-600'
              )}
            >
              {r.totalAvailable}
            </div>
            <div className="text-muted-foreground">units</div>
          </div>
          <div className="rounded-xl border bg-muted/40 px-3 py-2 text-center">
            <div className="text-sm font-semibold">{formatTHB(r.minPriceAll)}</div>
            <div className="text-muted-foreground">from</div>
          </div>
        </div>
      </div>
    </motion.div>
  )

  // ------- Export CSV -------
  function exportCSV(rows: ProductRow[]) {
    const header = ['Product', 'Brand', 'Model', 'Units', 'Min Price']
    const rowsAsText = rows.map((r) => [r.productName, r.brand, r.model ?? '', r.totalAvailable, r.minPriceAll].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))
    const csvText = [header.join(','), ...rowsAsText].join('\n')
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvText], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transfer_products_${new Date().toISOString().slice(0, 19)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  // ------- Loading -------
  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-background">
        <div className="w-full p-6 space-y-6 max-w-screen-xl mx-auto">
          {HeaderBar}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Sticky Filters */}
      {FilterBar}

      <div className="w-full p-4 md:p-6 space-y-6 max-w-screen-xl mx-auto">
        {HeaderBar}
        {KpiBar}

        {/* Content */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span>{productRows.length} products</span>
            </div>
          </div>

          {productRows.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-sm text-muted-foreground">
                No results. Try clearing filters or clicking <b>Refresh</b>.
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {productRows.map((r) => (
                <ProductCard key={r.key} r={r} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Wizard Dialog ---------- */}
      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open)
          if (!open) setStep('spec')
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Button variant="ghost" size="icon" onClick={goBack} disabled={!canGoBack} aria-label="ย้อนกลับ" className="shrink-0">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                  <DialogTitle className="truncate">{wizardProduct?.name ?? 'Select'}</DialogTitle>
                  <DialogDescription className="truncate">
                    {wizardProduct?.brand} {wizardProduct?.model ? `• ${wizardProduct?.model}` : ''}
                  </DialogDescription>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className={step === 'spec' ? 'font-semibold' : 'text-muted-foreground'}>1. Spec</span>
                <span>•</span>
                <span className={step === 'branch' ? 'font-semibold' : 'text-muted-foreground'}>2. Branch</span>
                <span>•</span>
                <span className={step === 'dot' ? 'font-semibold' : 'text-muted-foreground'}>3. DOT</span>
              </div>
            </div>
          </DialogHeader>

          {/* Step contents */}
          {step === 'spec' && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">เลือกขนาด/โหลดอินเด็กซ์ (Spec)</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {specOptions.map((o) => (
                  <button
                    key={o.spec}
                    onClick={() => {
                      setSelectedSpec(o)
                      setStep('branch')
                    }}
                    className={cn(
                      'rounded-xl border p-3 text-left hover:border-blue-300 hover:bg-blue-50/40 transition-colors',
                      selectedSpec?.spec === o.spec && 'border-blue-500 ring-2 ring-blue-100'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{o.spec}</div>
                      {o.hasPromo && <Badge className="bg-green-600 hover:bg-green-600 text-white">Sale</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3">
                      <span>{o.total} units</span>
                      <span>•</span>
                      <span>{formatTHB(o.minPrice)} from</span>
                    </div>
                  </button>
                ))}
              </div>
              {!specOptions.length && <div className="text-center text-muted-foreground py-6 text-sm">No spec available.</div>}
            </div>
          )}

          {step === 'branch' && selectedSpec && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  Spec: <span className="font-medium">{selectedSpec.spec}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Sort
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant={branchSort === 'distance' ? 'default' : 'ghost'} onClick={() => setBranchSort('distance')}>
                      Distance
                    </Button>
                    <Button size="sm" variant={branchSort === 'price' ? 'default' : 'ghost'} onClick={() => setBranchSort('price')}>
                      Price
                    </Button>
                    <Button size="sm" variant={branchSort === 'stock' ? 'default' : 'ghost'} onClick={() => setBranchSort('stock')}>
                      Stock
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setBranchDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
                      {branchDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                  <span className="ml-2" />
                  <Filter className="h-3.5 w-3.5" />
                  <div className="flex items-center gap-2">
                    <Switch checked={onlyInStockBranch} onCheckedChange={(v) => setOnlyInStockBranch(Boolean(v))} />
                    <span>In stock</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={onlyPromoBranch} onCheckedChange={(v) => setOnlyPromoBranch(Boolean(v))} />
                    <span>On sale</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                {branchesForSpec.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-6">No branches match filters.</div>
                ) : (
                  branchesForSpec.map((br) => (
                    <div key={br.branchId} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border hover:bg-muted/60 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant="outline" className="font-mono text-xs">
                          {stores[br.branchId] ?? br.branchName}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {br.distance} km
                        </span>
                        {br.hasPromo && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            Sale
                          </Badge>
                        )}
                        {String(br.branchId) === String(myBranchId) && (
                          <Badge variant="outline" className="text-xs">
                            Your branch
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{br.available} units</span>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{formatTHB(br.minPrice)}</div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedBranch(br)
                            loadDotPicks(br)
                            setStep('dot')
                          }}
                          disabled={br.available === 0 || String(br.branchId) === String(myBranchId)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Select
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {step === 'dot' && selectedSpec && selectedBranch && (
            <div className="space-y-3">
              <div className="text-sm">
                Spec: <span className="font-medium">{selectedSpec.spec}</span> • Branch:{' '}
                <span className="font-medium">{stores[selectedBranch.branchId] ?? selectedBranch.branchName}</span>
              </div>
              <div className="space-y-2">
                {dotPicks.map((p) => (
                  <div key={`${p.dotCode}_${p.variantId}`} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{p.dotCode}</Badge>
                        {p.hasPromo && <Badge variant="secondary" className="text-xs">Sale</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Available: {p.available} • {formatTHB(p.price)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => changePick(p.dotCode, p.variantId, -1)} disabled={p.selected === 0}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center">{p.selected}</span>
                      <Button variant="outline" size="sm" onClick={() => changePick(p.dotCode, p.variantId, 1)} disabled={p.selected >= p.available}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!dotPicks.length && <div className="text-center text-muted-foreground text-sm py-6">No DOT available.</div>}
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <Button variant="ghost" onClick={goBack}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  ย้อนกลับ
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setWizardOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addToCart}>Add to Cart</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* One-branch confirm */}
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new request from another branch?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart currently has items from <b>{cart[0]?.branchName}</b>. To request from a different branch, the cart must be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmClearRef.current.onConfirm?.()}>Clear & Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cart Sheet */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Transfer Request</SheetTitle>
            <p className="text-sm text-muted-foreground">Requesting from {cartSourceBranchName}</p>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {cart.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">Your cart is empty</div>
            ) : (
              <>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={`${item.dotCode}_${item.variantId}_${item.branchId}`} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.productName}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.specification} • {item.dotCode}
                        </div>
                        <div className="text-sm font-semibold">Quantity: {item.quantity}</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => removeFromCart(item.dotCode, item.variantId, item.branchId)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between font-medium">
                    <span>Total Items</span>
                    <span>{cartCount}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea id="notes" placeholder="Add any special requests or notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCart([])} className="flex-1">
                    Clear Cart
                  </Button>
                  <Button onClick={handleSubmitOrder} disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />Sending...
                      </>
                    ) : (
                      <>
                        <Truck className="h-4 w-4 mr-2" />Send Request
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
