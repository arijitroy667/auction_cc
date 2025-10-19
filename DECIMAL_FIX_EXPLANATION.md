# Decimal Mismatch Bug Fix

## 🐛 The Problem

Your bid transactions were reverting with the error:
```
"Bid amount below reserve price"
```

Even though you were bidding **4.5 USDC** which should have been valid!

## 🔍 Root Cause

There was a **decimal mismatch** between how auction prices were stored vs. how bid amounts were sent:

### Before the Fix:

1. **Auction Creation** (`auctionHub.ts`):
   - Starting Price: `4.5` → `parseEther("4.5")` = `4500000000000000000` (18 decimals)
   - Reserve Price: `4.5` → `parseEther("4.5")` = `4500000000000000000` (18 decimals)

2. **Bid Submission** (`BidComponent.tsx`):
   - Bid Amount: `4.5` → `parseUnits("4.5", 6)` = `4500000` (6 decimals for USDC/USDT)

3. **Contract Comparison** (`BidManager.sol` line 86):
   ```solidity
   require(amount >= auction.reservePrice, "Bid amount below reserve price");
   // Comparing: 4500000 >= 4500000000000000000 → FALSE ❌
   ```

This is like comparing 4.5 cents to 4.5 trillion dollars!

## ✅ The Solution

All prices and bid amounts now use **6 decimals** (USDC/USDT standard):

### Changes Made:

1. **`auctionHub.ts`** - Store auction prices with 6 decimals:
   ```typescript
   const startingPriceWei = ethers.parseUnits(startingPrice, 6);  // Changed from parseEther
   const reservePriceWei = ethers.parseUnits(reservePrice, 6);     // Changed from parseEther
   ```

2. **`BidComponent.tsx`** - Parse prices with 6 decimals:
   ```typescript
   const startingPriceNum = parseFloat(ethers.formatUnits(startingPrice, 6));  // Changed from formatEther
   const reservePriceNum = parseFloat(ethers.formatUnits(reservePrice, 6));    // Changed from formatEther
   ```

3. **`auction-test-panel.tsx`** - Display prices with 6 decimals:
   ```typescript
   startingPrice: ethers.formatUnits(auction.startingPrice, 6),  // Changed from formatEther
   reservePrice: ethers.formatUnits(auction.reservePrice, 6),    // Changed from formatEther
   ```

4. **`auctions/page.tsx`** - Format prices with 6 decimals:
   ```typescript
   return ethers.formatUnits(price, 6);  // Changed from formatEther
   ```

5. **`BidManager.sol`** - Added documentation explaining decimal requirements

## 🎯 Why This Matters

### Token Decimals:
- **ETH/WETH**: 18 decimals
- **USDC/USDT**: 6 decimals (stablecoins)
- **DAI**: 18 decimals

Since your auction system uses **USDC/USDT** as the bidding tokens, everything must use **6 decimals**.

### Example After Fix:
- Starting Price: `4.5` → `parseUnits("4.5", 6)` = `4500000` (6 decimals)
- Reserve Price: `4.5` → `parseUnits("4.5", 6)` = `4500000` (6 decimals)
- Bid Amount: `4.5` → `parseUnits("4.5", 6)` = `4500000` (6 decimals)
- Comparison: `4500000 >= 4500000` → **TRUE** ✅

## 📝 Next Steps

1. **Redeploy the contracts** if you haven't already (the smart contract logic is fine, but documentation was added)
2. **Create a new auction** - Old auctions have prices stored with 18 decimals and won't work
3. **Test bidding** - The new auctions should accept bids correctly now!

## 🧪 Testing Checklist

- [ ] Create a new auction with starting price = 10 USDC, reserve = 5 USDC
- [ ] Place a bid of 7 USDC - should succeed
- [ ] Try to place a bid of 3 USDC - should fail (below reserve)
- [ ] Try to place a bid of 11 USDC - should fail (above starting price)
- [ ] Increase existing bid from 7 to 9 USDC - should succeed

## ⚠️ Important Note

**Old auctions will not work!** They have prices stored with 18 decimals. You need to:
1. Either migrate old auction data (convert prices from 18 to 6 decimals), or
2. Create new auctions (recommended)

The keeper will also need to handle this when fetching auction data from events.
