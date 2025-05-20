"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

interface OnboardingFormProps {
  onClose: () => void;
}

export default function OnboardingForm({ onClose }: OnboardingFormProps) {
  const router = useRouter();
  const { userId } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    companyName: "",
    businessType: "",
    role: "",
    phoneNumber: "",
    pincode: "",
    gstin: "",
    interestedMetals: [] as string[],
  });

  const businessTypes = [
    "Manufacturer",
    "Trader",
    "Distributor",
    "Stockist",
    "End User",
    "Other",
  ];
  const roles = [
    "Procurement Manager",
    "Supply Chain Manager",
    "Business Owner",
    "Trader",
    "Other",
  ];
  const metals = ["Aluminium", "Copper", "Zinc", "Lead", "Nickel", "Other"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMissingFields([]);
    setIsSubmitting(true);

    try {
      console.log("User ID from Clerk:", userId);
      
      if (!userId) {
        console.error("No user ID from Clerk auth");
        throw new Error("User not authenticated");
      }

      // Client-side validation
      const requiredFields = {
        companyName: formData.companyName,
        businessType: formData.businessType,
        role: formData.role,
        phoneNumber: formData.phoneNumber,
        pincode: formData.pincode,
        gstin: formData.gstin
      };

      const missing = Object.entries(requiredFields)
        .filter(([ value]) => !value)
        .map(([key]) => key);

      if (missing.length > 0) {
        setMissingFields(missing);
        throw new Error("Please fill all required fields");
      }

      if (formData.interestedMetals.length === 0) {
        throw new Error("Please select at least one metal");
      }

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          userId,
          ...formData,
        }),
      });

      console.log("API Response status:", response.status);
      const data = await response.json();
      console.log("API Response data:", data);

      if (!response.ok) {
        throw new Error(data.message || "Failed to save onboarding data");
      }

      localStorage.setItem("onboardingCompleted", "true");
      onClose();
      router.push("/dashboard");
    } catch (error) {
      console.error("Error submitting form:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMetalToggle = (metal: string) => {
    setFormData((prev) => ({
      ...prev,
      interestedMetals: prev.interestedMetals.includes(metal)
        ? prev.interestedMetals.filter((m) => m !== metal)
        : [...prev.interestedMetals, metal],
    }));
  };

  const isFieldMissing = (fieldName: string) => missingFields.includes(fieldName);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-y-auto max-h-[90vh] border border-gray-100">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome to <span className="text-purple-600">NOVEX PRO</span>
              </h2>
              <div className="w-12 h-1 bg-gradient-to-r from-purple-500 to-purple-700 rounded-full mt-2"></div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
            </button>
          </div>

          <p className="text-sm text-gray-500 mb-6">
            Complete your profile to unlock personalized features and recommendations.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Company Information */}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Company Name {isFieldMissing('companyName') && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      companyName: e.target.value,
                    }))
                  }
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 transition-all duration-200 ${
                    isFieldMissing('companyName') ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="Enter company name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Business Type {isFieldMissing('businessType') && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    required
                    value={formData.businessType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        businessType: e.target.value,
                      }))
                    }
                    className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWNoZXZyb24tZG93biI+PHBhdGggZD0ibTYgOSA2IDYgNi02Ii8+PC9zdmc+')] bg-no-repeat bg-[center_right_1rem] bg-[length:16px_16px] ${
                      isFieldMissing('businessType') ? 'border-red-300' : 'border-gray-200'
                    }`}
                  >
                    <option value="">Select</option>
                    {businessTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Your Role {isFieldMissing('role') && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, role: e.target.value }))
                    }
                    className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWNoZXZyb24tZG93biI+PHBhdGggZD0ibTYgOSA2IDYgNi02Ii8+PC9zdmc+')] bg-no-repeat bg-[center_right_1rem] bg-[length:16px_16px] ${
                      isFieldMissing('role') ? 'border-red-300' : 'border-gray-200'
                    }`}
                  >
                    <option value="">Select</option>
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contact & Location Details */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Phone Number {isFieldMissing('phoneNumber') && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phoneNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phoneNumber: e.target.value,
                      }))
                    }
                    className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 transition-all duration-200 ${
                      isFieldMissing('phoneNumber') ? 'border-red-300' : 'border-gray-200'
                    }`}
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Pincode {isFieldMissing('pincode') && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.pincode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        pincode: e.target.value,
                      }))
                    }
                    className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 transition-all duration-200 ${
                      isFieldMissing('pincode') ? 'border-red-300' : 'border-gray-200'
                    }`}
                    placeholder="Enter pincode"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  GSTIN {isFieldMissing('gstin') && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  required
                  value={formData.gstin}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, gstin: e.target.value }))
                  }
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 transition-all duration-200 ${
                    isFieldMissing('gstin') ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="Enter GSTIN"
                />
              </div>
            </div>

            {/* Interested Metals */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Interested Metals {formData.interestedMetals.length === 0 && missingFields.includes('interestedMetals') && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {metals.map((metal) => (
                  <button
                    key={metal}
                    type="button"
                    onClick={() => handleMetalToggle(metal)}
                    className={`p-3 text-sm rounded-xl border transition-all duration-200 flex items-center justify-center ${
                      formData.interestedMetals.includes(metal)
                        ? "bg-purple-50 border-purple-300 text-purple-700 font-medium shadow-sm"
                        : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                    } ${
                      formData.interestedMetals.length === 0 && missingFields.includes('interestedMetals') 
                        ? '!border-red-300' 
                        : ''
                    }`}
                  >
                    {metal}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full bg-gradient-to-r from-purple-600 to-purple-500 text-white py-3 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm ${
                isSubmitting 
                  ? "opacity-70 cursor-not-allowed" 
                  : "hover:from-purple-700 hover:to-purple-600 hover:shadow-md"
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                "Complete Setup"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}