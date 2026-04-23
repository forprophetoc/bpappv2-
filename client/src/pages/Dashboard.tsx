import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp,
  FileText,
  CalendarCheck,
  CheckCircle2,
  FilePlus,
  Briefcase,
  Calendar,
  ChevronRight,
  DollarSign,
  Eye,
} from "lucide-react";

const JOB_STATUSES = ["New Lead", "Estimate Sent", "Appointment Booked", "Completed"] as const;

const STATUS_COLORS: Record<string, string> = {
  "New Lead": "bg-blue-100 text-blue-700",
  "Estimate Sent": "bg-orange-100 text-orange-700",
  "Appointment Booked": "bg-green-100 text-green-700",
  Booked: "bg-green-100 text-green-700",
  "In Progress": "bg-yellow-100 text-yellow-700",
  Completed: "bg-gray-100 text-gray-700",
  "Review Requested": "bg-purple-100 text-purple-700",
};

export default function Dashboard() {
  const utils = trpc.useUtils();
  const { data: jobs } = trpc.estimates.list.useQuery();
  const updateStatus = trpc.estimates.updateStatus.useMutation({
    onSuccess: () => utils.estimates.list.invalidate(),
  });

  const allJobs = jobs ?? [];
  const newLeads = allJobs.filter((j) => j.status === "New Lead").length;
  const estimatesSent = allJobs.filter((j) => j.status === "Estimate Sent").length;
  const booked = allJobs.filter((j) => j.status === "Appointment Booked" || j.status === "Booked").length;
  const completed = allJobs.filter((j) => j.status === "Completed").length;
  const recentJobs = allJobs.slice(0, 5);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back — here's what's happening today.
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

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="NEW LEADS" value={newLeads} icon={TrendingUp} iconColor="text-blue-500" iconBg="bg-blue-100" />
        <StatCard label="ESTIMATES SENT" value={estimatesSent} icon={FileText} iconColor="text-orange-500" iconBg="bg-orange-100" />
        <StatCard label="BOOKED" value={booked} icon={CalendarCheck} iconColor="text-green-500" iconBg="bg-green-100" />
        <StatCard label="COMPLETED" value={completed} icon={CheckCircle2} iconColor="text-purple-500" iconBg="bg-purple-100" />
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Link href="/new-estimate" className="block">
          <ActionCard
            icon={FilePlus}
            iconBg="bg-green-100"
            iconColor="text-green-600"
            title="New Estimate"
            subtitle="Create & send a quote"
          />
        </Link>
        <Link href="/all-jobs" className="block">
          <ActionCard
            icon={Briefcase}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            title="All Jobs"
            subtitle="View & manage pipeline"
          />
        </Link>
        <Link href="/calendar" className="block">
          <ActionCard
            icon={Calendar}
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            title="Calendar"
            subtitle="View bookings"
          />
        </Link>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Recent Jobs</h2>
          <Link
            href="/all-jobs"
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            View all →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {recentJobs.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-gray-400">
              No jobs yet. Create your first estimate!
            </div>
          )}
          {recentJobs.map((job) => {
            const initials = (job.firstName || job.name.charAt(0)).charAt(0).toUpperCase();
            const displayName = job.firstName && job.lastName
              ? `${job.firstName} ${job.lastName}`
              : job.name;
            const status = job.status || "New Lead";
            const statusClass = STATUS_COLORS[status] || STATUS_COLORS["New Lead"];

            return (
              <div
                key={job.id}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-sm">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {displayName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {job.service} · {job.duration || "3 Hours"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">
                    ${job.price.toLocaleString()}
                  </span>
                  <select
                    value={status}
                    onChange={(e) => updateStatus.mutate({ id: job.id, status: e.target.value as any })}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-none outline-none cursor-pointer ${statusClass}`}
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`${iconBg} p-2 rounded-full`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
      <div className={`${iconBg} p-3 rounded-xl`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}
