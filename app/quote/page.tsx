"use client";

import PriceCalculator from '../../components/GetQuote/PriceCalculator';
import SupplierCalculator from '../../components/GetQuote/SupplierCalculator';
import TopCards from '../../components/GetQuote/TopCards';

export default function Quote() {
  return (
    <>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 space-y-6 sm:space-y-9">
        <section>
          <TopCards/>
        </section> 
      </div>
    
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* Price Calculators */}
          <div className="col-span-1 lg:col-span-8">
            <PriceCalculator/>
          </div>

          {/* Supplier Calculator (Coming Soon) */}
          <div className="col-span-1 lg:col-span-4">
            <SupplierCalculator />
          </div>
        </div>
      </div>
    </>
  );
}