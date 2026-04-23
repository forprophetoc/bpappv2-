import {
  Calendar,
  ExternalLink,
  Phone,
} from "lucide-react";

export default function CalendarPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Calendar & Bookings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View and manage all scheduled appointments.
          </p>
        </div>
        <button
          onClick={() =>
            window.open("https://app.gohighlevel.com/calendar", "_blank")
          }
          className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
        >
          <ExternalLink className="h-4 w-4" />
          Open Full Calendar
        </button>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Book Appointment */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-xl">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                Book Appointment
              </p>
              <p className="text-xs text-gray-500">
                Schedule a job without sending an estimate
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              window.open("https://app.gohighlevel.com/calendar", "_blank")
            }
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ExternalLink className="h-5 w-5" />
          </button>
        </div>

        {/* Call to Book */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-xl">
              <Phone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Call to Book</p>
              <p className="text-xs text-gray-500">[[phone]]</p>
            </div>
          </div>
          <a
            href="tel:+1"
            className="border border-gray-200 rounded-lg px-4 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
          >
            Call Now
          </a>
        </div>
      </div>

      {/* Embedded booking calendar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900 text-sm">
            Booking Calendar
          </h2>
        </div>
        <div className="p-0">
          <iframe
            src="https://api.leadconnectorhq.com/widget/booking/Pbt4MIKvOcDf1sLjqaMS"
            style={{ width: "100%", border: "none", overflow: "hidden" }}
            scrolling="no"
            id="Pbt4MIKvOcDf1sLjqaMS_1744812926498"
            title="Booking Calendar"
            className="min-h-[600px]"
          />
        </div>
      </div>
    </div>
  );
}
