import { useState, useEffect } from 'react';
import Head from 'next/head';

interface TestResult {
  service: string;
  success: boolean;
  data: any;
  error?: string;
  timestamp: string;
}

interface RateDisplay {
  date: string;
  rate: string;
  parsedDate?: Date;
}

export default function TestRates() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [backgroundUpdate, setBackgroundUpdate] = useState(false);
  const [latestRbiRate, setLatestRbiRate] = useState<RateDisplay | null>(null);
  const [latestSbiRate, setLatestSbiRate] = useState<RateDisplay | null>(null);

  // Test RBI API
  const testRBI = async () => {
    setIsLoading(true);
    try {
      const url = backgroundUpdate ? '/api/rbi?backgroundUpdate=true' : '/api/rbi';
      const response = await fetch(url);
      const data = await response.json();
      
      // Extract latest rate for display
      if (data.success && data.data && data.data.length > 0) {
        const latest = data.data[0];
        let parsedDate: Date | undefined;
        
        try {
          // Try parsing the date string
          const dateParts = latest.date.split('-');
          if (dateParts.length === 3) {
            const monthMap: { [key: string]: number } = {
              'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
              'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };
            
            const day = parseInt(dateParts[0]);
            const month = monthMap[dateParts[1]] !== undefined ? monthMap[dateParts[1]] : parseInt(dateParts[1]) - 1;
            const year = parseInt(dateParts[2]);
            
            parsedDate = new Date(year, month, day);
          } else {
            parsedDate = new Date(latest.date);
          }
        } catch (err) {
          console.error("Error parsing date:", err);
        }
        
        setLatestRbiRate({
          date: latest.date,
          rate: latest.rate,
          parsedDate
        });
      }
      
      setResults(prev => [
        {
          service: 'RBI',
          success: response.ok,
          data,
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
    } catch (error) {
      setResults(prev => [
        {
          service: 'RBI',
          success: false,
          data: null,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Test SBI TT API
  const testSBITT = async () => {
    setIsLoading(true);
    try {
      const url = backgroundUpdate ? '/api/sbitt?backgroundUpdate=true' : '/api/sbitt';
      const response = await fetch(url);
      const data = await response.json();
      
      // Extract latest rate for display
      if (data.success && data.data && data.data.length > 0) {
        const latest = data.data[0];
        let parsedDate: Date | undefined;
        
        try {
          parsedDate = new Date(latest.timestamp);
        } catch (err) {
          console.error("Error parsing timestamp:", err);
        }
        
        setLatestSbiRate({
          date: latest.timestamp,
          rate: latest.sbi_tt_sell,
          parsedDate
        });
      }
      
      setResults(prev => [
        {
          service: 'SBITT',
          success: response.ok,
          data,
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
    } catch (error) {
      setResults(prev => [
        {
          service: 'SBITT',
          success: false,
          data: null,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Test update-rates API
  const testUpdateRates = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/update-rates?key=default-secure-key');
      const data = await response.json();
      
      setResults(prev => [
        {
          service: 'Update Rates',
          success: response.ok,
          data,
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
    } catch (error) {
      setResults(prev => [
        {
          service: 'Update Rates',
          success: false,
          data: null,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <Head>
        <title>Test Exchange Rates</title>
      </Head>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Exchange Rates Testing
          </h1>
          
          <div className="mb-4 flex items-center">
            <label className="inline-flex items-center mr-6">
              <input
                type="checkbox"
                checked={backgroundUpdate}
                onChange={(e) => setBackgroundUpdate(e.target.checked)}
                className="form-checkbox h-5 w-5 text-blue-600"
              />
              <span className="ml-2 text-gray-700">Include background update</span>
            </label>
          </div>
          
          {/* Display latest rates */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-md border ${latestRbiRate ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
              <h3 className="font-medium text-blue-800 mb-2">Latest RBI Rate</h3>
              {latestRbiRate ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Date:</span>
                    <span className="font-medium">{latestRbiRate.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Rate:</span>
                    <span className="font-medium">₹{parseFloat(latestRbiRate.rate).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Parsed Date:</span>
                    <span className="font-medium">
                      {latestRbiRate.parsedDate 
                        ? latestRbiRate.parsedDate.toLocaleDateString() 
                        : 'Invalid date'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 italic">No data available</p>
              )}
            </div>
            
            <div className={`p-4 rounded-md border ${latestSbiRate ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
              <h3 className="font-medium text-purple-800 mb-2">Latest SBI TT Rate</h3>
              {latestSbiRate ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Date:</span>
                    <span className="font-medium">{latestSbiRate.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Rate:</span>
                    <span className="font-medium">₹{parseFloat(latestSbiRate.rate).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Parsed Date:</span>
                    <span className="font-medium">
                      {latestSbiRate.parsedDate 
                        ? latestSbiRate.parsedDate.toLocaleDateString() 
                        : 'Invalid date'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 italic">No data available</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-8">
            <button
              onClick={testRBI}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Test RBI API
            </button>
            
            <button
              onClick={testSBITT}
              disabled={isLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              Test SBI TT API
            </button>
            
            <button
              onClick={testUpdateRates}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Run Update Rates
            </button>
          </div>
          
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Test Results
            </h2>
            
            {results.length === 0 ? (
              <p className="text-gray-500 italic">No tests run yet</p>
            ) : (
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-md border ${
                      result.success
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex justify-between mb-2">
                      <h3 className="font-medium">
                        {result.service} - {result.success ? "Success" : "Failed"}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    {result.error && (
                      <div className="text-red-700 text-sm mb-2">
                        Error: {result.error}
                      </div>
                    )}
                    
                    <pre className="bg-gray-800 rounded p-3 text-xs text-white overflow-auto max-h-60">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 