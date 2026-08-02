import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/findings", label: "Findings", icon: "🛡️" },
  { to: "/assets", label: "Assets", icon: "💻" },
  { to: "/tickets", label: "Tickets", icon: "🎫" },
  { to: "/reports", label: "Reports", icon: "📄" },
  { to: "/admin", label: "Admin", icon: "⚙️" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-gray-900 text-gray-100 flex flex-col">
        <div className="px-5 py-5 text-lg font-bold border-b border-gray-800">
          🔒 VM Platform
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                  isActive ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800"
                }`
              }
            >
              <span>{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-gray-800 text-sm">
          <div className="mb-2">
            <div className="font-medium">{user?.name}</div>
            <div className="text-gray-400 text-xs">{user?.role?.replaceAll("_", " ")}</div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="text-red-400 hover:text-red-300 text-xs"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
