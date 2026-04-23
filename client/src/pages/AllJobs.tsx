import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { FilePlus, Search, Phone, ChevronRight, DollarSign, Eye } from "lucide-react";

const JOB_STATUSES = ["New Lead", "Estimate Sent", "Appointment Booked", "Completed"] as const;

const STATUS_FILTERS = [
  "All",
  "New Lead",
  "Estimate Sent",
  "Appointment Booked",
  "Completed",
];

const STATUS_COLORS: Record<string, string> = {
  "New Lead": "bg-blue-100 text-blue-700",
  "Estimate Sent": "bg-orange-100 text-orange-700",
  "Appointment Booked": "bg-green-100 text-green-700",
  Booked: "bg-green-100 text-green-700",
  "In Progress": "bg-yellow-100 text-yellow-700",
  Completed: "bg-gray-100 text-gray-700",
  "Review Requested": "bg-purple-100 text-purple-700",
};

export default function AllJobs() {
  const utils = trpc.useUtils();
  const { data: jobs } = trpc.estimates.list.useQuery();
  const updateStatus = trpc.estimates.updateStatus.useMutation({
    onSuccess: () => utils.estimates.list.invalidate(),
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const allJobs = jobs ?? [];

  const filteredJobs = useMemo(() => {
    let result = allJobs;

    if (activeFilter !== "All") {
      result = result.filter((j) => j.status === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (j) =>
          j.name.toLowerCase().includes(q) ||
          (j.phone && j.phone.includes(q)) ||
          (j.email && j.email.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allJobs, activeFilter, searchQuery]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredJobs.length} jobs found
          </p>
        </div>
        <Link
          href="/new-estimate"
          className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
        >
          <FilePlus className="h-4 w-4" />
          New Estimate
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, phone, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeFilter === filter
                ? "bg-green-500 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Jobs list */}
      <div className="space-y-3">
        {filteredJobs.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-12 text-center text-sm text-gray-400">
            No jobs found.
          </div>
        )}
        {filteredJobs.map((job) => {
          const initials = (job.firstName || job.name.charAt(0)).charAt(0).toUpperCase();
          const displayName = job.firstName && job.lastName
            ? `${job.firstName} ${job.lastName}`
            : job.name;
          const status = job.status || "New Lead";
          const statusClass = STATUS_COLORS[status] || STATUS_COLORS["New Lead"];

          const upsellTotal =
            (job.bathroomSinkPrice || 0) + (job.kitchenSinkPrice || 0);

          return (
            <div
              key={job.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-sm shrink-0">
                  {initials}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-900">
                      {displayName}
                    </p>
                    <select
                      value={status}
                      onChange={(e) => updateStatus.mutate({ id: job.id, status: e.target.value as any })}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border-none outline-none cursor-pointer ${statusClass}`}
                    >
                      {JOB_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {status === "Appointment Booked" ? (
                      <span className="flex items-center gap-0.5 text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                        <DollarSign className="h-3 w-3" />
                      </span>
                    ) : job.viewedAt ? (
                      <span className="flex items-center gap-0.5 text-xs font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">
                        <Eye className="h-3 w-3" />
                        Viewed
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{job.service}</span>
                    <span>·</span>
                    <span>{job.duration || "3 Hours"}</span>
                    {job.phone && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Phone className="h-3 w-3" />
                          {job.phone}
                        </span>
                      </>
                    )}
                  </div>
                  {job.address && (
                    <p className="text-xs text-gray-400 mt-0.5">{job.address}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    ${job.price.toLocaleString()}
                  </p>
                  {upsellTotal > 0 && (
                    <p className="text-xs text-gray-500">
                      ${upsellTotal.toLocaleString()} upsell
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
