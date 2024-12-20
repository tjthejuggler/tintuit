import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAppSelector } from '../lib/store';
import {
  HomeIcon,
  DocumentTextIcon,
  QuestionMarkCircleIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const navigation = [
  { name: 'Home', to: '/', icon: HomeIcon },
  { name: 'Papers', to: '/papers', icon: DocumentTextIcon },
  { name: 'Questions', to: '/questions', icon: QuestionMarkCircleIcon },
  { name: 'Stats', to: '/stats', icon: ChartBarIcon },
  { name: 'Settings', to: '/settings', icon: Cog6ToothIcon },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isOnline = useAppSelector(state => state.papers.isOnline);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar */}
      <div
        className={clsx(
          'fixed inset-0 z-50 bg-gray-900/80 lg:hidden',
          sidebarOpen ? 'block' : 'hidden'
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <nav
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 transform bg-white p-4 shadow-lg transition-transform dark:bg-gray-800 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">TinTuit</h1>
            <button
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-8 flex-1 space-y-1">
            {navigation.map(({ name, to, icon: Icon }) => (
              <NavLink
                key={name}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center rounded-md px-4 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  )
                }
              >
                <Icon className="mr-3 h-5 w-5" />
                {name}
              </NavLink>
            ))}
          </div>

          <div className="mt-auto pt-4">
            <div className="flex items-center space-x-2 px-4 text-sm">
              <div
                className={clsx(
                  'h-2 w-2 rounded-full',
                  isOnline ? 'bg-green-500' : 'bg-red-500'
                )}
              />
              <span className="text-gray-600 dark:text-gray-300">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="lg:pl-72">
        <div className="sticky top-0 z-40 bg-white px-4 py-4 shadow-sm dark:bg-gray-800 lg:hidden">
          <button
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>

        <main className="min-h-screen p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
