import React, { useState, useRef, useEffect } from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import LiveSpotCard from "./LiveSpotCard";
import LMECashSettlement from "./LMECashSettlement";
import { Calendar, AlertTriangle, BarChart2 } from "lucide-react";
import { format } from "date-fns";
import TodayLSP from "./todayLSP";

interface LMECashSettlementSectionProps {
  title?: string;
}

// CSS for slider styles
const sliderStyles = {
  '.lme-slider': {
    margin: '0',
    touchAction: 'pan-y',
    userSelect: 'none',
    transition: 'all 0.3s ease',
    WebkitOverflowScrolling: 'touch', // Improve mobile scrolling
    position: 'relative',
    display: 'block',
    boxSizing: 'border-box',
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    KhtmlUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    width: '100%',
    overflow: 'hidden'
  },
  '.lme-slider .slick-track': {
    display: 'flex',
    gap: '0',
    alignItems: 'stretch',
    margin: '0',
    position: 'relative',
    left: '0',
    top: '0',
    padding: '0',
    boxSizing: 'border-box',
    transition: 'transform 0.5s ease'
  },
  '.lme-slider .slick-slide': {
    height: 'auto',
    padding: '0 6px',
    transition: 'all 0.3s ease',
    touchAction: 'manipulation', // Improve touch behavior
  },
  '.lme-slider .slick-slide > div': {
    height: '100%',
    display: 'flex',
  },
  '.lme-slider.at-start': {
    cursor: 'not-allowed'
  },
  '.lme-slider.at-end': {
    cursor: 'not-allowed'
  },
  '.card-container': {
    height: '100%',
    minHeight: '162px',
    display: 'flex',
  },
  // Edge cards style
  '.slider-edge-indicator': {
    position: 'absolute',
    top: '0',
    bottom: '0',
    width: '20px',
    pointerEvents: 'none',
    zIndex: '10',
    opacity: '0',
    transition: 'opacity 0.3s ease',
  },
  '.slider-edge-indicator.start': {
    left: '0',
    background: 'linear-gradient(to right, rgba(239, 246, 255, 0.8), transparent)',
    opacity: '1',
  },
  '.slider-edge-indicator.end': {
    right: '0',
    background: 'linear-gradient(to left, rgba(239, 246, 255, 0.8), transparent)',
    opacity: '1',
  },
  '.lme-slider.boundary-hit': {
    transform: 'translateX(0)',
    animation: 'shake 0.3s cubic-bezier(.36,.07,.19,.97) both',
  },
  '@keyframes shake': {
    '0%, 100%': { transform: 'translateX(0)' },
    '20%, 60%': { transform: 'translateX(-2px)' },
    '40%, 80%': { transform: 'translateX(2px)' },
  },
  // Fix for drag effects
  '.slick-slide.dragging': {
    pointerEvents: 'none',
  },
  // Ensure proper width for cards
  '.lme-card-wrapper': {
    width: '100%',
    height: '100%',
  },
  // Improve touch behavior
  '.lme-slider .slick-list': {
    overflow: 'hidden', // Contains overflow within slider
    margin: '0',
    padding: '0',
    touchAction: 'pan-y pinch-zoom', // Enable vertical scrolling
    width: '100%',
    position: 'relative'
  },
  // Prevent text selection during swiping
  '.lme-slider *': {
    userSelect: 'none',
  },
  // Smooth the dots if they exist
  '.lme-slider .slick-dots': {
    display: 'flex',
    justifyContent: 'center',
    gap: '4px',
    padding: '8px 0 0',
  },
  '.lme-slider .slick-dots li': {
    margin: '0',
  },
  // Prevent iOS hover stuck state
  '@media (hover: hover)': {
    '.lme-slider .slick-slide:hover': {
      cursor: 'grab',
    },
  },
  '.lme-slider .slick-slide:active': {
    cursor: 'grabbing',
  },
  // Swipe indicator styles
  '.swipe-indicator': {
    position: 'absolute',
    bottom: '6px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(99, 102, 241, 0.1)',
    borderRadius: '16px',
    padding: '4px 10px',
    zIndex: '20',
    opacity: '0',
    transition: 'opacity 0.2s ease-in-out',
    pointerEvents: 'none',
  },
  '.swipe-indicator.visible': {
    opacity: '1',
  },
  '.swipe-indicator svg': {
    width: '16px',
    height: '16px',
    color: 'rgb(99, 102, 241)',
    animation: 'swipeHint 1.5s infinite',
  },
  '.swipe-indicator span': {
    marginLeft: '6px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'rgb(67, 56, 202)',
  },
  '@keyframes swipeHint': {
    '0%, 100%': { transform: 'translateX(0)' },
    '50%': { transform: 'translateX(4px)' },
  },
  // Fixed cards layout - new improved styles
  '.dashboard-cards-layout': {
    display: 'flex',
    gap: '16px',
    position: 'relative',
    width: '100%',
    overflow: 'hidden' // Container overflow hidden
  },
  '.fixed-card-container': {
    width: '30%',
    flexShrink: '0',
    position: 'relative',
    zIndex: '10', // Higher z-index
  },
  '.scrolling-cards-container': {
    width: '68%',
    flexShrink: '0',
    flexGrow: '0',
    position: 'relative',
    overflow: 'hidden', // Critical to contain the slider
    borderLeft: '1px solid rgba(99, 102, 241, 0.1)',
    marginLeft: '2%',
    paddingLeft: '10px',
    // Add containment context for z-index
    zIndex: '1',
    isolation: 'isolate'
  },
  // Add styles for the cards themselves to ensure they don't break out
  '.lme-slider .slick-slide .lme-card-wrapper': {
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden'
  },
  // Add specific class for the slider wrapper
  '.lme-slider-container': {
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    margin: 0,
    padding: 0,
    width: '100%'
  }
};

// Define LMECashSettlement data interface
interface LMECashSettlementData {
  id: number;
  date: string;
  price: number;
  Dollar_Difference: number;
  INR_Difference: number;
  createdAt: string;
  updatedAt: string;
}

export default function LMECashSettlementSection({ title = "LME Cash Settlement" }: LMECashSettlementSectionProps) {
  const sliderRef = useRef<Slider>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const [sliderState, setSliderState] = useState({
    isAtStart: true,
    isAtEnd: false,
    currentIndex: 0
  });
  const [lmeData, setLmeData] = useState<LMECashSettlementData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Add state for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Add touch tracking state
  const [isSwiping, setIsSwiping] = useState(false);
  // Add state for swipe indicator
  const [showSwipeIndicator, setShowSwipeIndicator] = useState(false);

  // Fetch LME Cash Settlement data from the API
  useEffect(() => {
    const fetchLMEData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Add cache-busting query parameter and headers
        const timestamp = new Date().getTime();
        // Updated to use the correct API endpoint (lmecashcal) with a fixed limit of 10
        const response = await fetch(`/api/lmecashcal?_t=${timestamp}&limit=10`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch LME data: ${response.status} ${response.statusText}. ${errorText}`);
        }

        const result = await response.json();
        console.log("LME Cash Settlement API Response:", result);
        
        if (result.success && Array.isArray(result.data)) {
          // Sort data by date in descending order (most recent first)
          const sortedData = [...result.data].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          // Ensure we only keep the 10 most recent entries (queue-like behavior)
          const limitedData = sortedData.slice(0, 10);
          setLmeData(limitedData);
        } else {
          throw new Error('Invalid data format received from API');
        }
      } catch (error) {
        console.error('Error fetching LME data:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
        // Don't clear existing data on error to maintain the last known good state
      } finally {
        setIsLoading(false);
      }
    };

    fetchLMEData();

    // Set up polling interval (every 5 minutes)
    const intervalId = setInterval(fetchLMEData, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Format date from API data for display (e.g., "2023-04-28" to "28. April 2023")
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateString; // Return original string if date is invalid
      }
      
      // Format to match the UI in the image (25. April 2025 style)
      return format(date, "d MMMM yyyy");
    } catch (e) {
      console.error('Error formatting date:', e);
      return dateString; // Return original string if parsing fails
    }
  };

  // Format INR difference to properly display in the component
  const formatINRDifference = (value: number): string => {
    return Math.abs(value).toFixed(2);
  };

  // Apply custom slider styles
  useEffect(() => {
    // Apply fixed styles first
    const fixedStyleElement = document.createElement('style');
    fixedStyleElement.textContent = `
      /* Ensure fixed card stays put */
      .fixed-card-container {
        position: relative !important;
        z-index: 10 !important;
      }
      
      /* Ensure sliding cards don't overflow */
      .scrolling-cards-container {
        overflow: hidden !important;
      }
      
      /* Let slider track transform for scrolling */
      .lme-slider .slick-track {
        transition: transform 500ms ease !important;
      }
      
      /* Hide overflow on the list but show cards */
      .lme-slider .slick-list {
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(fixedStyleElement);

    // Apply custom styles
    Object.entries(sliderStyles).forEach(([selector, styles]) => {
      const selectorElement = document.createElement('style');
      selectorElement.textContent = `${selector} { ${Object.entries(styles).map(([prop, value]) => `${prop}: ${value};`).join(' ')} }`;
      document.head.appendChild(selectorElement);
    });

    return () => {
      // Clean up styles when component unmounts
      const styleElements = document.querySelectorAll('style');
      styleElements.forEach(el => {
        if (
          (el.textContent && Object.keys(sliderStyles).some(selector => el.textContent?.includes(selector))) ||
          (el.textContent && el.textContent.includes('.fixed-card-container'))
        ) {
          el.remove();
        }
      });
    };
  }, []);

  // Update slider state after each change
  const handleAfterChange = (currentSlide: number) => {
    if (!sliderRef.current) return;
    
    const slidesToShow = window.innerWidth >= 768 ? 3 : 1;
    const totalSlides = lmeData.length || 1;
    
    setSliderState({
      isAtStart: currentSlide === 0,
      isAtEnd: currentSlide + slidesToShow >= totalSlides,
      currentIndex: currentSlide
    });
  };
  
  // Handle window resize to update slider state
  useEffect(() => {
    const handleResize = () => {
      if (sliderRef.current) {
        try {
          // @ts-ignore - innerSlider is not in the type definitions but exists at runtime
          const currentSlide = sliderRef.current.innerSlider?.state?.currentSlide || 0;
          handleAfterChange(currentSlide);
        } catch (e) {
          console.error("Error accessing slider state:", e);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [lmeData.length]);

  // Expanded mobile view state
  const [expandedMobileView, setExpandedMobileView] = useState(false);

  // Function to render error content
  const renderErrorContent = () => {
    return (
      <div className="price-card bg-white rounded-xl p-3 md:p-4 border border-gray-200 
          shadow-sm hover:shadow-md transition-all duration-200 w-full
          relative overflow-hidden gpu-render group h-[162px]">
        
        {/* Background effect - properly layered */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity 
          bg-red-500 -z-10"></div>

        <div className="relative flex flex-col h-full gap-1 md:gap-2 justify-between">
          {/* Header with indicator badge */}
          <div>
            <div className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium inline-flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 crisp-text" />
              <span>Error Loading Data</span>
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 flex flex-col justify-center items-center py-2">
            <AlertTriangle size={24} className="text-red-500 mb-2" />
            <p className="text-sm text-gray-600 text-center">
              {error || 'Failed to load LME Cash Settlement data'}
            </p>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-2 text-xs text-gray-500">
            <div className="font-bold">
              {format(new Date(), 'dd MMMM yyyy')}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Function to render empty content
  const renderEmptyContent = () => {
    return (
      <div className="price-card bg-white rounded-xl p-3 md:p-4 border border-gray-200 
          shadow-sm hover:shadow-md transition-all duration-200 w-full
          relative overflow-hidden gpu-render group h-[162px]">
        
        {/* Background effect - properly layered */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity 
          bg-amber-500 -z-10"></div>

        <div className="relative flex flex-col h-full gap-1 md:gap-2 justify-between">
          {/* Header with indicator badge */}
          <div>
            <div className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-medium inline-flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 crisp-text" />
              <span>No Data Available</span>
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 flex flex-col justify-center items-center py-2">
            <AlertTriangle size={24} className="text-amber-500 mb-2" />
            <p className="text-sm text-gray-600 text-center">
              No LME Cash Settlement data available
            </p>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-2 text-xs text-gray-500">
            <div className="font-bold">
              {format(new Date(), 'dd MMMM yyyy')}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Update desktop card rendering structure to match mobile
  const renderCard = (data: LMECashSettlementData, key: string) => {
    return (
      <div key={key} className="h-full lme-card-wrapper">
        <LMECashSettlement
          basePrice={data.price}
          spread={data.Dollar_Difference}
          spreadINR={formatINRDifference(data.INR_Difference)}
          isIncrease={data.Dollar_Difference > 0}
          formattedDate={formatDate(data.date)}
        />
      </div>
    );
  };

  // Handle manual slide navigation
  const goToSlide = (direction: 'prev' | 'next') => {
    if (!sliderRef.current) return;
    
    if (direction === 'prev') {
      sliderRef.current.slickPrev();
    } else {
      sliderRef.current.slickNext();
    }
  };

  // Handle before change to prepare visuals
  const handleBeforeChange = (oldIndex: number, newIndex: number) => {
    // We could add animations or other visual feedback here if needed
    // This is called right before the slide changes
  };

  // Add a function to reset slider when needed (can be called when a user action causes issues)
  const resetSlider = () => {
    if (sliderRef.current) {
      try {
        // @ts-ignore - innerSlider is not in the type definitions but exists at runtime
        const currentSlide = sliderRef.current.innerSlider?.state?.currentSlide || 0;
        sliderRef.current.slickGoTo(currentSlide);
      } catch (e) {
        console.error("Error resetting slider:", e);
      }
    }
  };

  // Function to handle manual touch end (can be used to fix stuck sliders)
  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsSwiping(false);
    
    // If we need to handle any stuck slider issues on touch end
    if (sliderRef.current) {
      // Optional reset if there are persistent issues
      // setTimeout(() => resetSlider(), 300);
    }
  };
  
  // Show swipe hint on component mount for a few seconds
  useEffect(() => {
    if (lmeData.length > 3 && !isLoading && !error) {
      setShowSwipeIndicator(true);
      
      // Hide after 4 seconds
      const timer = setTimeout(() => {
        setShowSwipeIndicator(false);
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [lmeData.length, isLoading, error]);
  
  // Hide swipe indicator when user interacts
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsSwiping(true);
    setShowSwipeIndicator(false);
  };
  
  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent) => {
    // Touch move logic if needed
  };

  return (
    <section className="relative bg-gradient-to-br from-indigo-50/95 via-blue-50/95 to-sky-50/95 backdrop-blur-sm rounded-xl p-4 md:p-6 
      border border-indigo-100/50 shadow-[0_8px_16px_rgba(99,102,241,0.06)] hover:shadow-[0_12px_24px_rgba(99,102,241,0.08)] 
      transition-all duration-300 overflow-hidden">
      
      {/* Decorative background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.05)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(56,189,248,0.05)_0%,transparent_50%)]" />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base md:text-lg font-bold text-gray-800 flex items-center">
            <BarChart2 className="w-5 h-5 mr-2 text-indigo-600" />
            {title}
          </h2>
          
          {/* Add the Today's LME Cash Settlement button */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-1.5 px-3 rounded-md transition-colors flex items-center"
          >
            <Calendar className="w-4 h-4 mr-1.5" />
            Today&apos;s LME Cash Settlement
          </button>
        </div>

        {/* Desktop View - Slider - Only rendered on md screens and above */}
        <div className="hidden md:block">
          <div className="relative flex dashboard-cards-layout">
            {/* Fixed LiveSpotCard (First Card) */}
            <div className="fixed-card-container">
              <div className="transform hover:scale-105 transition-transform duration-300 hover:shadow-lg">
                <LiveSpotCard 
                  apiUrl="/api/average-price"
                  unit="/MT" 
                />
              </div>
            </div>

            {/* Slider with LME Settlement Cards */}
            <div 
              ref={sliderContainerRef}
              className="scrolling-cards-container" 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Edge indicators */}
              <div className={`slider-edge-indicator start ${sliderState.isAtStart ? 'opacity-0' : ''}`} />
              <div className={`slider-edge-indicator end ${sliderState.isAtEnd ? 'opacity-0' : ''}`} />
              
              {/* Swipe Indicator */}
              <div className={`swipe-indicator ${showSwipeIndicator ? 'visible' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>Swipe to View More</span>
              </div>

              <Slider
                ref={sliderRef}
                dots={false}
                infinite={false}
                speed={500}
                slidesToShow={3}
                slidesToScroll={1}
                autoplay={false}
                cssEase="ease-out"
                adaptiveHeight={false}
                variableWidth={false}
                swipeToSlide={true}
                draggable={true}
                arrows={false}
                accessibility={true}
                touchThreshold={15}
                swipe={true}
                touchMove={true}
                useCSS={true}
                useTransform={true}
                edgeFriction={0.35}
                lazyLoad="ondemand"
                afterChange={handleAfterChange}
                beforeChange={handleBeforeChange}
                pauseOnHover={true}
                pauseOnFocus={true}
                className={`lme-slider lme-slider-container ${sliderState.isAtStart ? 'at-start' : ''} ${sliderState.isAtEnd ? 'at-end' : ''}`}
                responsive={[
                  {
                    breakpoint: 1024,
                    settings: {
                      slidesToShow: 2,
                      slidesToScroll: 1,
                      touchThreshold: 10
                    }
                  },
                  {
                    breakpoint: 768,
                    settings: {
                      slidesToShow: 1,
                      slidesToScroll: 1,
                      touchThreshold: 15
                    }
                  }
                ]}
              >
                {isLoading ? (
                  // Loading skeletons for desktop view
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={`skeleton-${index}`} className="h-full py-0.5 px-2">
                      <div className="price-card bg-white rounded-xl p-3 md:p-4 border border-gray-200 
                          shadow-sm hover:shadow-md transition-all duration-200 w-full
                          relative overflow-hidden gpu-render h-[162px]">
                        <div className="flex flex-col h-full gap-1 md:gap-2 justify-between">
                          {/* Header with indicator badge */}
                          <div>
                            <div className="h-5 w-32 bg-gray-200 animate-pulse rounded-full mb-2"></div>
                          </div>
                          
                          {/* Price Content */}
                          <div className="flex-1 py-1 md:py-2">
                            <div className="h-6 w-28 md:w-32 bg-gray-200 animate-pulse mb-3 rounded"></div>
                            <div className="h-4 w-24 bg-gray-200 animate-pulse mb-2 rounded"></div>
                            <div className="h-4 w-20 bg-gray-200 animate-pulse rounded"></div>
                          </div>
                          
                          {/* Footer */}
                          <div className="flex items-center justify-between pt-2">
                            <div className="h-3 w-24 bg-gray-200 animate-pulse rounded"></div>
                            <div className="h-3 w-16 bg-gray-200 animate-pulse rounded"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : error ? (
                  // Error state
                  <div className="col-span-3 py-0.5 px-2">
                    {renderErrorContent()}
                  </div>
                ) : lmeData.length === 0 ? (
                  // Empty state
                  <div className="col-span-3 py-0.5 px-2">
                    {renderEmptyContent()}
                  </div>
                ) : (
                  // Real data cards - use the shared rendering function
                  // Only display up to 10 cards
                  lmeData.slice(0, 10).map((data, index) => (
                    <div key={`settlement-card-${index}`} className="h-full py-0.5 px-2 box-border">
                      {renderCard(data, `desktop-card-${index}`)}
                    </div>
                  ))
                )}
              </Slider>
            </div>
          </div>
        </div>

        {/* Mobile View - Stacked Cards - Only rendered on small screens */}
        <div className="block md:hidden">
          <div className="space-y-2.5">
            {/* Today's Card */}
            <div className="bg-white/50 p-1.5 md:p-2 rounded-xl shadow-sm">
              <LiveSpotCard 
                apiUrl="/api/average-price"
                unit="/MT" 
              />
            </div>

            {/* Show only first 3 historical cards or all when expanded */}
            <div className="grid grid-cols-1 gap-2.5 scroll-mt-4 scroll-smooth" id="mobile-cards-container">
              {isLoading ? (
                // Loading skeletons for mobile view
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={`mobile-skeleton-${index}`} 
                      className="price-card bg-white rounded-xl p-3 md:p-4 border border-gray-200 
                      shadow-sm hover:shadow-md transition-all duration-200 w-full
                      relative overflow-hidden gpu-render h-[162px]">
                    <div className="flex flex-col h-full gap-1 md:gap-2 justify-between">
                      {/* Header with indicator badge */}
                      <div>
                        <div className="h-5 w-32 bg-gray-200 animate-pulse rounded-full mb-2"></div>
                      </div>
                      
                      {/* Price Content */}
                      <div className="flex-1 py-1 md:py-2">
                        <div className="h-6 w-28 md:w-32 bg-gray-200 animate-pulse mb-3 rounded"></div>
                        <div className="h-4 w-24 bg-gray-200 animate-pulse mb-2 rounded"></div>
                        <div className="h-4 w-20 bg-gray-200 animate-pulse rounded"></div>
                      </div>
                      
                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="h-3 w-24 bg-gray-200 animate-pulse rounded"></div>
                        <div className="h-3 w-16 bg-gray-200 animate-pulse rounded"></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : error ? (
                // Error state
                renderErrorContent()
              ) : lmeData.length === 0 ? (
                // Empty state
                renderEmptyContent()
              ) : (
                // Real data cards - also use the shared rendering function
                // Limit to 10 cards total, but only show 3 or all based on expandedMobileView
                lmeData
                  .slice(0, expandedMobileView ? Math.min(10, lmeData.length) : 3)
                  .map((data, index) => (
                    <div
                      key={`mobile-card-${index}`}
                      id={`mobile-card-${index}`}
                    >
                      {renderCard(data, `mobile-card-content-${index}`)}
                    </div>
                  ))
              )}
            </div>

            {/* Show More / Show Less Button - only if we have more than 3 entries and not loading */}
            {!isLoading && !error && lmeData.length > 3 && (
              <button
                onClick={() => setExpandedMobileView(!expandedMobileView)}
                className="w-full mt-1.5 py-2.5 px-4 text-sm font-medium text-indigo-700 bg-indigo-50 
                  hover:bg-indigo-100 rounded-md border border-indigo-200 transition-all duration-200
                  flex items-center justify-center gap-2"
              >
                <span>{expandedMobileView ? 'Show Less' : 'Show More'}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-300 ${expandedMobileView ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Navigation and attribution section */}
        <div className="flex justify-end items-center mt-2 md:mt-3">

          {/* Desktop Navigation buttons */}
          <div className="hidden md:flex space-x-2">
            <button
              onClick={() => goToSlide('prev')}
              disabled={sliderState.isAtStart || isLoading || error !== null || lmeData.length === 0}
              className={`w-9 h-9 flex items-center justify-center rounded-md
                ${sliderState.isAtStart || isLoading || error !== null || lmeData.length === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 active:from-indigo-800 active:to-blue-800'} 
                transition-all duration-200 shadow-md`}
              aria-label="Previous card"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button
              onClick={() => goToSlide('next')}
              disabled={sliderState.isAtEnd || isLoading || error !== null || lmeData.length === 0}
              className={`w-9 h-9 flex items-center justify-center rounded-md
                ${sliderState.isAtEnd || isLoading || error !== null || lmeData.length === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 active:from-indigo-800 active:to-blue-800'} 
                transition-all duration-200 shadow-md`}
              aria-label="Next card"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Add the modal component */}
      <TodayLSP 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </section>
  );
} 