'use client';

import { useState } from 'react';
import { DollarSign, Info, TrendingUp } from 'lucide-react';
import { usePublishStore } from '@/store/publishStore';
import { cn } from '@/lib/utils';

const suggestedPrices = [4.99, 9.99, 14.99, 19.99];

export function PricingConfig() {
  const { pricing, updatePricing, getPlatformFee, getEstimatedEarnings } = usePublishStore();
  const [priceError, setPriceError] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Validate regular price
  const validatePrice = (value: number) => {
    if (value < 0.99) {
      setPriceError('Minimum price is $0.99');
      return false;
    }
    if (value > 49.99) {
      setPriceError('Maximum price is $49.99');
      return false;
    }
    setPriceError(null);
    return true;
  };

  // Validate promotional price
  const validatePromoPrice = (value: number) => {
    if (value < 0.99) {
      setPromoError('Minimum price is $0.99');
      return false;
    }
    if (value > 49.99) {
      setPromoError('Maximum price is $49.99');
      return false;
    }
    if (pricing.price && value >= pricing.price) {
      setPromoError('Promotional price must be less than regular price');
      return false;
    }
    setPromoError(null);
    return true;
  };

  // Handle price change
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      const rounded = Math.round(value * 100) / 100; // Round to 2 decimals
      if (validatePrice(rounded)) {
        updatePricing({ price: rounded });
      }
    }
  };

  // Handle promotional price change
  const handlePromoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      const rounded = Math.round(value * 100) / 100;
      if (validatePromoPrice(rounded)) {
        updatePricing({ promotionalPrice: rounded });
      }
    }
  };

  // Apply suggested price
  const applySuggestedPrice = (price: number) => {
    if (validatePrice(price)) {
      updatePricing({ price });
    }
  };

  const platformFee = getPlatformFee();
  const estimatedEarnings = getEstimatedEarnings();
  const activePrice = pricing.promotional && pricing.promotionalPrice 
    ? pricing.promotionalPrice 
    : pricing.price;

  return (
    <div className="space-y-6">
      {/* Marketplace Toggle */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Marketplace Listing
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Make your track available for purchase in the marketplace
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={pricing.enableMarketplace}
              onChange={(e) => updatePricing({ enableMarketplace: e.target.checked })}
              className="sr-only peer"
              aria-label="Enable marketplace listing"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Pricing Fields */}
      {pricing.enableMarketplace && (
        <div className="space-y-6">
          {/* Regular Price */}
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Regular Price *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="price"
                type="number"
                step="0.01"
                min="0.99"
                max="49.99"
                value={pricing.price || ''}
                onChange={handlePriceChange}
                onBlur={(e) => validatePrice(parseFloat(e.target.value))}
                className={cn(
                  "pl-10 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none",
                  "dark:bg-gray-800 dark:border-gray-700 dark:text-white",
                  priceError && "border-red-500"
                )}
                placeholder="0.00"
              />
            </div>
            {priceError && (
              <p className="text-xs text-red-500 mt-1">{priceError}</p>
            )}
            
            {/* Suggested Prices */}
            <div className="flex gap-2 mt-3">
              <span className="text-xs text-gray-500">Suggested:</span>
              {suggestedPrices.map(price => (
                <button
                  key={price}
                  onClick={() => applySuggestedPrice(price)}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  ${price.toFixed(2)}
                </button>
              ))}
            </div>
          </div>

          {/* Promotional Pricing */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <TrendingUp className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Promotional Pricing
                </h4>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={pricing.promotional}
                  onChange={(e) => updatePricing({ promotional: e.target.checked })}
                  className="sr-only peer"
                  aria-label="Enable promotional pricing"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 dark:peer-focus:ring-yellow-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-600"></div>
              </label>
            </div>
            
            {pricing.promotional && (
              <div>
                <label htmlFor="promo-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Promotional Price *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="promo-price"
                    type="number"
                    step="0.01"
                    min="0.99"
                    max="49.99"
                    value={pricing.promotionalPrice || ''}
                    onChange={handlePromoChange}
                    onBlur={(e) => validatePromoPrice(parseFloat(e.target.value))}
                    className={cn(
                      "pl-10 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:outline-none",
                      "dark:bg-gray-800 dark:border-gray-700 dark:text-white",
                      promoError && "border-red-500"
                    )}
                    placeholder="0.00"
                  />
                </div>
                {promoError && (
                  <p className="text-xs text-red-500 mt-1">{promoError}</p>
                )}
              </div>
            )}
          </div>

          {/* Earnings Calculator */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">
              Earnings Calculator
            </h4>
            
            <div className="space-y-3">
              {/* Sale Price */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Sale Price:
                </span>
                <span className="font-medium">
                  {pricing.promotional && pricing.promotionalPrice ? (
                    <>
                      <span className="line-through text-gray-400 mr-2">
                        ${pricing.price?.toFixed(2) || '0.00'}
                      </span>
                      <span className="text-green-600 dark:text-green-400">
                        ${pricing.promotionalPrice.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span>${pricing.price?.toFixed(2) || '0.00'}</span>
                  )}
                </span>
              </div>
              
              {/* Platform Fee */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                  Platform Fee:
                  <button
                    className="ml-1 relative"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    aria-label="Platform fee info"
                  >
                    <Info className="w-3 h-3 text-gray-400" />
                    {showTooltip && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap">
                        15% platform fee on all sales
                      </div>
                    )}
                  </button>
                </span>
                <span className="text-red-600 dark:text-red-400">
                  -${platformFee.toFixed(2)} <span className="text-xs">(15%)</span>
                </span>
              </div>
              
              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700"></div>
              
              {/* Estimated Earnings */}
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-900 dark:text-white">
                  Estimated Earnings:
                </span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  ${estimatedEarnings.toFixed(2)}
                </span>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-3">
              * Earnings are deposited weekly via Stripe Connect
            </p>
          </div>
        </div>
      )}

      {/* Info for free tracks */}
      {!pricing.enableMarketplace && (
        <div className="text-center py-12">
          <DollarSign className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Free Track
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            This track will be available for free in your library. You can enable marketplace listing to sell it.
          </p>
        </div>
      )}
    </div>
  );
}