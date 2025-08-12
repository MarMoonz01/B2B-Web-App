'use client';

import { useState, useEffect, useMemo } from 'react';
import { InventoryService, GroupedProduct } from '@/lib/services/InventoryService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RefreshCw, ShoppingCart, Package, MapPin, Tag, ChevronDown, Plus, Minus } from 'lucide-react';
import { useCart } from '@/contexts/CartContext'; // Import cart context

export default function MarketplaceView() {
  const [inventory, setInventory] = useState<GroupedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const { addToCart, items: cartItems } = useCart();

  // Filter states
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [searchTerm, setSearchTerm] = useState('');
  const [availability, setAvailability] = useState('All');
  const [promotionStatus, setPromotionStatus] = useState('All');
  const [selectedBranch, setSelectedBranch] = useState('All Branches');

  // Quantity selection states
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const products = await InventoryService.fetchInventory();
      setInventory(products);
    } catch (err) {
      console.error('Failed to fetch marketplace data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const availableBrands = useMemo(() => {
    const brands = new Set(inventory.map(item => item.brand));
    return Array.from(brands).sort();
  }, [inventory]);

  const availableBranches = useMemo(() => {
    const branches = new Set<string>();
    inventory.forEach(product => {
      product.branches.forEach(branch => {
        branches.add(branch.branchName);
      });
    });
    return Array.from(branches).sort();
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    let result = [...inventory];

    if (selectedBrand !== 'All Brands') {
      result = result.filter(item => item.brand === selectedBrand);
    }

    if (selectedBranch !== 'All Branches') {
      result = result.map(product => {
        const filteredBranches = product.branches.filter(
          branch => branch.branchName === selectedBranch
        );
        if (filteredBranches.length > 0) {
          const newTotalAvailable = filteredBranches.reduce((sum, branch) => 
            sum + branch.sizes.reduce((sizeSum, size) => 
              sizeSum + size.dots.reduce((dotSum, dot) => dotSum + dot.qty, 0), 0), 0);
          return { ...product, branches: filteredBranches, totalAvailable: newTotalAvailable };
        }
        return null;
      }).filter((product): product is GroupedProduct => product !== null);
    }

    if (availability === 'In Stock') {
      result = result.filter(item => item.totalAvailable > 0);
    } else if (availability === 'Low Stock') {
      result = result.filter(item => item.totalAvailable > 0 && item.totalAvailable <= 10);
    }

    if (promotionStatus === 'On Promotion') {
      result = result.filter(item => 
        item.branches.some(b => b.sizes.some(s => s.dots.some(d => d.promoPrice && d.promoPrice > 0)))
      );
    }

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(lowercasedTerm) ||
        item.branches.some(b => b.sizes.some(s => s.specification.toLowerCase().includes(lowercasedTerm)))
      );
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, selectedBrand, selectedBranch, searchTerm, availability, promotionStatus]);

  const toggleProductExpansion = (productId: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleQuantityChange = (key: string, value: number, maxQty: number) => {
    setQuantities(prev => ({
      ...prev,
      [key]: Math.min(Math.max(0, value), maxQty)
    }));
  };

  const handleAddToCart = (
    product: GroupedProduct,
    branch: any,
    size: any,
    dot: any
  ) => {
    const key = `${product.id}-${branch.branchId}-${size.specification}-${dot.dotCode}`;
    const quantity = quantities[key] || 1;

    if (quantity > 0) {
      addToCart({
        id: key,
        productName: product.name,
        specification: size.specification,
        dotCode: dot.dotCode,
        quantity: quantity,
        unitPrice: dot.promoPrice || dot.basePrice,
        sellerBranch: branch.branchName,
        sellerBranchId: branch.branchId,
        maxQuantity: dot.qty
      });

      // Reset quantity after adding
      setQuantities(prev => ({ ...prev, [key]: 1 }));
    }
  };

  const getItemInCart = (key: string) => {
    return cartItems.find(item => item.id === key);
  };

  const getStockStatus = (total: number) => {
    if (total === 0) return { label: 'Out of Stock', variant: 'destructive' as const };
    if (total <= 10) return { label: 'Low Stock', variant: 'default' as const, className: 'bg-yellow-500 text-white' };
    return { label: 'In Stock', variant: 'default' as const, className: 'bg-green-600 text-white' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">B2B Marketplace</h1>
          <p className="text-muted-foreground">
            Discover and order inventory from dealers in your network
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Brands">All Brands</SelectItem>
                  {availableBrands.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Branches">All Branches</SelectItem>
                  {availableBranches.map(branch => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={availability} onValueChange={setAvailability}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="In Stock">In Stock</SelectItem>
                  <SelectItem value="Low Stock">Low Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Showing {filteredInventory.length} products
              </p>
              <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-muted-foreground">Loading inventory...</p>
          </div>
        ) : filteredInventory.length === 0 ? (
          <Card>
            <div className="py-20 text-center">
              <Package className="h-12 w-12 mx-auto text-slate-400" />
              <p className="mt-4 text-muted-foreground">No products found</p>
            </div>
          </Card>
        ) : (
          filteredInventory.map(product => {
            const status = getStockStatus(product.totalAvailable);
            const isExpanded = expandedProducts.has(product.id);

            return (
              <Card key={product.id} className="overflow-hidden">
                <CardHeader 
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleProductExpansion(product.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      <div>
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {product.totalAvailable} units • {product.branches.length} location(s)
                        </p>
                      </div>
                      <Badge variant={status.variant} className={status.className}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="border-t">
                    {product.branches.map(branch => (
                      <div key={branch.branchId} className="mb-6 last:mb-0">
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{branch.branchName}</span>
                        </div>
                        
                        <div className="space-y-2">
                          {branch.sizes.map(size => (
                            <div key={size.specification} className="border rounded-lg p-3">
                              <h4 className="font-medium mb-2">{size.specification}</h4>
                              <div className="space-y-2">
                                {size.dots.map(dot => {
                                  const key = `${product.id}-${branch.branchId}-${size.specification}-${dot.dotCode}`;
                                  const cartItem = getItemInCart(key);
                                  const currentQty = quantities[key] || 1;

                                  return (
                                    <div key={dot.dotCode} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                      <div className="flex-1">
                                        <span className="font-mono text-sm">DOT: {dot.dotCode}</span>
                                        <span className="ml-3 text-sm text-muted-foreground">
                                          Stock: {dot.qty}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center gap-3">
                                        {dot.promoPrice ? (
                                          <div className="text-right">
                                            <div className="flex items-center gap-2">
                                              <Tag className="h-3 w-3 text-red-600" />
                                              <span className="text-red-600 font-bold">
                                                ฿{dot.promoPrice.toLocaleString()}
                                              </span>
                                            </div>
                                            <span className="text-xs line-through text-muted-foreground">
                                              ฿{dot.basePrice.toLocaleString()}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="font-medium">
                                            ฿{dot.basePrice.toLocaleString()}
                                          </span>
                                        )}
                                        
                                        <div className="flex items-center gap-1">
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-8 w-8"
                                            onClick={() => handleQuantityChange(key, currentQty - 1, dot.qty)}
                                            disabled={dot.qty === 0}
                                          >
                                            <Minus className="h-3 w-3" />
                                          </Button>
                                          <Input
                                            type="number"
                                            value={currentQty}
                                            onChange={(e) => handleQuantityChange(key, parseInt(e.target.value) || 0, dot.qty)}
                                            className="w-16 text-center h-8"
                                            min="1"
                                            max={dot.qty}
                                            disabled={dot.qty === 0}
                                          />
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-8 w-8"
                                            onClick={() => handleQuantityChange(key, currentQty + 1, dot.qty)}
                                            disabled={dot.qty === 0 || currentQty >= dot.qty}
                                          >
                                            <Plus className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        
                                        <Button
                                          size="sm"
                                          onClick={() => handleAddToCart(product, branch, size, dot)}
                                          disabled={dot.qty === 0}
                                          className={cartItem ? 'bg-green-600 hover:bg-green-700' : ''}
                                        >
                                          <ShoppingCart className="h-4 w-4 mr-1" />
                                          {cartItem ? `In Cart (${cartItem.quantity})` : 'Add to Cart'}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}