"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  TrendingUp,
  Package,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  FileText,
  Download,
} from "lucide-react";
import { EarningsSummary } from "@mindscript/schemas";

interface DashboardStats {
  totalSales: number;
  activeListings: number;
  conversionRate: number;
  avgSalePrice: number;
}

interface RecentSale {
  id: string;
  trackTitle: string;
  amount: number;
  date: string;
  buyerLocation: string;
}

export default function SellerDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [chartPeriod, setChartPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    loadChartData();
  }, [chartPeriod]);

  const loadDashboardData = async () => {
    try {
      // Load earnings summary
      const earningsRes = await fetch("/api/seller/earnings");
      if (earningsRes.ok) {
        const earningsData = await earningsRes.json();
        setEarnings(earningsData);
      }

      // Load stats (mock for now - would come from API)
      setStats({
        totalSales: 127,
        activeListings: 8,
        conversionRate: 3.2,
        avgSalePrice: 1500, // $15.00 in cents
      });

      // Load recent sales (mock for now)
      setRecentSales([
        {
          id: "1",
          trackTitle: "Deep Sleep Meditation",
          amount: 1500,
          date: "2024-01-15T10:30:00Z",
          buyerLocation: "United States",
        },
        {
          id: "2",
          trackTitle: "Morning Energy Boost",
          amount: 2000,
          date: "2024-01-14T15:45:00Z",
          buyerLocation: "United Kingdom",
        },
        {
          id: "3",
          trackTitle: "Stress Relief Session",
          amount: 1500,
          date: "2024-01-14T08:20:00Z",
          buyerLocation: "Canada",
        },
      ]);

      setLoading(false);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      setLoading(false);
    }
  };

  const loadChartData = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (chartPeriod) {
        case "daily":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "weekly":
          startDate.setDate(startDate.getDate() - 28);
          break;
        case "monthly":
          startDate.setMonth(startDate.getMonth() - 6);
          break;
      }

      const response = await fetch(
        `/api/seller/earnings?period=${chartPeriod}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setChartData(data.data || []);
      }
    } catch (error) {
      console.error("Failed to load chart data:", error);
    }
  };

  const exportEarnings = async () => {
    try {
      const response = await fetch(
        `/api/seller/earnings?format=csv&startDate=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}&endDate=${new Date().toISOString()}`
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `earnings_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to export earnings:", error);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(new Date(dateString));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Seller Dashboard</h1>
        <p className="text-gray-600 mt-2">Track your sales and earnings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="h-8 w-8 text-green-600" />
            <span className="text-sm text-gray-500">This Month</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(earnings?.totalEarningsCents || 0)}
          </div>
          <div className="flex items-center mt-2">
            <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-sm text-green-600">+12.5%</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <Clock className="h-8 w-8 text-blue-600" />
            <span className="text-sm text-gray-500">Pending</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(earnings?.pendingPayoutCents || 0)}
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Next payout: {earnings?.nextPayoutDate ? new Date(earnings.nextPayoutDate).toLocaleDateString() : "N/A"}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <Package className="h-8 w-8 text-purple-600" />
            <span className="text-sm text-gray-500">Listings</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.activeListings || 0}</div>
          <div className="text-sm text-gray-600 mt-2">Active tracks</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="h-8 w-8 text-indigo-600" />
            <span className="text-sm text-gray-500">Conversion</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.conversionRate || 0}%</div>
          <div className="flex items-center mt-2">
            <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-sm text-green-600">+0.5%</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Earnings Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Earnings Overview</h2>
            <div className="flex items-center space-x-2">
              <select
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value as any)}
                className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <button
                onClick={exportEarnings}
                className="p-2 text-gray-600 hover:text-gray-900"
                title="Export CSV"
              >
                <Download className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Simple bar chart visualization */}
          <div className="h-64 flex items-end justify-between space-x-2">
            {chartData.map((item, index) => {
              const maxValue = Math.max(...chartData.map(d => d.earningsCents));
              const height = maxValue > 0 ? (item.earningsCents / maxValue) * 100 : 0;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors"
                    style={{ height: `${height}%` }}
                    title={formatCurrency(item.earningsCents)}
                  />
                  <span className="text-xs text-gray-500 mt-2">
                    {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Recent Sales</h2>
            <button
              onClick={() => router.push("/seller/earnings")}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              View all
            </button>
          </div>

          <div className="space-y-4">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{sale.trackTitle}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(sale.date)} • {sale.buyerLocation}
                  </p>
                </div>
                <span className="text-sm font-semibold text-green-600">
                  +{formatCurrency(sale.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => router.push("/seller/listings")}
          className="flex items-center justify-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <Package className="h-5 w-5 text-indigo-600 mr-3" />
          <span className="text-gray-900 font-medium">Manage Listings</span>
        </button>

        <button
          onClick={() => router.push("/seller/earnings")}
          className="flex items-center justify-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <BarChart3 className="h-5 w-5 text-indigo-600 mr-3" />
          <span className="text-gray-900 font-medium">View Detailed Earnings</span>
        </button>

        <button
          onClick={() => router.push("/builder")}
          className="flex items-center justify-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <FileText className="h-5 w-5 text-indigo-600 mr-3" />
          <span className="text-gray-900 font-medium">Create New Track</span>
        </button>
      </div>
    </div>
  );
}