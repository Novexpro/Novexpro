import React from "react";
import PriceAlert from "./PriceAlert";
import MCXAluminium from "./MCXAluminium";
import LMEAluminium from "./LMEAluminium";
import MonthPrice from "./MonthPrice";
import RatesDisplay from "./RatesDisplay";
import FeedbackBanner from "./FeedbackBanner";
import LMECashSettlementSection from "./LMECashSettlementSection";

export default function MarketDashboard() {
  return (
    <div className="max-w-[1366px] mx-auto px-4 pt-4 space-y-2 min-h-screen">
      <FeedbackBanner />

      {/* LME Cash Settlement Section */}
      <LMECashSettlementSection />

      {/* Main Grid Layout - Rearranged for mobile view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* PriceAlert moved to bottom for mobile */}
        <div className="hidden md:block">
          <PriceAlert />
        </div>

        {/* Right Column */}
        <div className="space-y-2 mb-6">
          {/* MCX Aluminium */}
          <MCXAluminium />

          {/* LME, Month Price and Rates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-2">
              <LMEAluminium />
              <MonthPrice />
            </div>
            <div>
              <RatesDisplay />
            </div>
          </div>
        </div>
      </div>

      {/* Price Alert for mobile view - at bottom */}
      <div className="md:hidden">
        <PriceAlert />
      </div>
    </div>
  );
}
