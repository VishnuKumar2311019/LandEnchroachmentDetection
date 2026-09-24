import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Analytics.css';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

export default function Analytics() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchStats = () => {
    setLoading(true);
    fetch('http://localhost:5001/analytics')
      .then(r => r.json())
      .then(data => {
        setStats(data);
        setLoading(false);
        setLastUpdated(new Date().toLocaleTimeString());
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchStats(); }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const hasWeeklyData = stats?.weekly_detections?.length > 0;

  const lineData = {
    labels: hasWeeklyData
      ? stats.weekly_detections.map(w => w.week)
      : ['No data in last 30 days'],
    datasets: [{
      label: 'Activity Events',
      data: hasWeeklyData
        ? stats.weekly_detections.map(w => parseInt(w.count))
        : [0],
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#ef4444',
      pointRadius: hasWeeklyData ? 4 : 0,
    }]
  };

  const doughnutData = {
    labels: ['Secure Lands', 'Alerted Lands'],
    datasets: [{
      data: [
        Math.max(0, (stats?.total_lands || 0) - (stats?.alerts_sent || 0)),
        stats?.alerts_sent || 0,
      ],
      backgroundColor: ['#22c55e', '#ef4444'],
      borderWidth: 0,
      hoverOffset: 6,
    }]
  };

  const barData = {
    labels: stats?.top_encroached?.map(r => r.owner_name?.split(' ')[0] || 'Record') || [],
    datasets: [{
      label: 'Registered Area (m\u00b2)',
      data: stats?.top_encroached?.map(r => parseInt(r.score)) || [],
      backgroundColor: [
        'rgba(239, 68, 68, 0.85)',
        'rgba(249, 115, 22, 0.85)',
        'rgba(234, 179, 8, 0.85)',
        'rgba(34, 197, 94, 0.6)',
        'rgba(34, 197, 94, 0.4)',
      ],
      borderRadius: 6,
      borderWidth: 0,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { size: 12 } } },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: '#334155',
        borderWidth: 1,
      }
    },
    scales: {
      x: { grid: { color: 'rgba(51, 65, 85, 0.5)' }, ticks: { color: '#64748b' } },
      y: { grid: { color: 'rgba(51, 65, 85, 0.5)' }, ticks: { color: '#64748b' } }
    }
  };

  return (
    <div className="analytics-root">
      {/* Top Navigation */}
      <nav className="analytics-nav">
        <div className="analytics-nav-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <span>🛡️</span>
          <span className="analytics-nav-title">LandSecureX</span>
        </div>
        <div className="analytics-nav-links">
          <button className="nav-link" onClick={() => navigate('/')}>← Dashboard</button>
          <span className="nav-separator" />
          <span className="nav-user">👤 {user?.username || 'Admin'}</span>
          <button className="nav-link nav-logout" onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      <div className="analytics-body">
        <div className="analytics-header">
          <div>
            <h1 className="analytics-page-title">System Analytics</h1>
            <p className="analytics-page-sub">Real-time monitoring summary{lastUpdated ? ` · Updated at ${lastUpdated}` : ''}</p>
          </div>
          <button
            className="nav-link"
            onClick={fetchStats}
            style={{ border: '1px solid #1e293b', padding: '8px 16px', borderRadius: 8, fontSize: 13 }}
          >
            Refresh
          </button>
        </div>

        {/* Summary Stat Cards */}
        <div className="analytics-stats">
          {[
          { label: 'Total Registered', value: stats?.total_lands ?? '—', icon: 'REG', color: '#38bdf8' },
            { label: 'Alerts Sent', value: stats?.alerts_sent ?? '—', icon: 'ALT', color: '#ef4444' },
            { label: 'Email Alerts', value: stats?.alerts_sent ?? '—', icon: 'MAIL', color: '#f59e0b' },
            { label: 'Avg. Confidence', value: stats?.avg_confidence ? `${stats.avg_confidence}%` : '—', icon: 'AI', color: '#22c55e' },
          ].map((card, i) => (
            <div key={i} className="analytics-stat-card" style={{ '--accent': card.color }}>
              <div className="asc-icon">{card.icon}</div>
              <div className="asc-info">
                <div className="asc-value" style={{ color: card.color }}>{card.value}</div>
                <div className="asc-label">{card.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        {loading ? (
          <div className="analytics-loading">Loading analytics data...</div>
        ) : (
          <div className="analytics-charts">
            <div className="chart-card chart-wide">
              <h3 className="chart-title">Activity Trend (Last 30 Days)</h3>
              <div className="chart-body">
                {!hasWeeklyData && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#475569', fontSize: 13, textAlign: 'center', pointerEvents: 'none' }}>
                    No alert/scan activity in the last 30 days.
                  </div>
                )}
                <div style={{ position: 'relative', height: '100%' }}>
                  <Line data={lineData} options={chartOptions} />
                </div>
              </div>
            </div>

            <div className="chart-card">
              <h3 className="chart-title">Land Status Breakdown</h3>
              <div className="chart-body chart-body-sm">
                <Doughnut data={doughnutData} options={{ ...chartOptions, scales: undefined }} />
              </div>
            </div>

            <div className="chart-card">
              <h3 className="chart-title">Largest Registered Parcels (m²)</h3>
              <div className="chart-body">
                {(stats?.top_encroached?.length ?? 0) === 0 ? (
                  <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', paddingTop: 80 }}>No land records yet.</div>
                ) : (
                  <Bar data={barData} options={chartOptions} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
