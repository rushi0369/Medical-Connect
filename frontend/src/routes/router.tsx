import { createBrowserRouter } from 'react-router'
import { RouteErrorBoundary } from '../components/common/RouteErrorBoundary'
import AuthLayout from '../layouts/AuthLayout'
import PanelLayout from '../layouts/PanelLayout'
import ChangePasswordPage from '../pages/auth/ChangePasswordPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import ResetPasswordPage from '../pages/auth/ResetPasswordPage'
import NotFoundPage from '../pages/system/NotFoundPage'
import SystemStatusPage from '../pages/system/SystemStatusPage'
import { GuestOnly, HomeRedirect, RequireLogin, RequireRole } from './guards'
import {
  AccountPage,
  AdminCustomersPage,
  AdminDashboardPage,
  AdminDeliveriesPage,
  AdminDeliveryPricingPage,
  AdminInvoicesPage,
  AdminOrderReviewPage,
  AdminOrdersPage,
  AdminPaymentsPage,
  AdminReportsPage,
  AdminSettingsPage,
  CustomerBillsPage,
  CustomerDashboardPage,
  CustomerOrdersPage,
  NotificationsPage,
  OrderDetailPage,
  RequestMedicinesPage,
  RiderAssignedOrdersPage,
  RiderDashboardPage,
  RiderDeliveryDetailPage,
  RiderDeliveryHistoryPage,
  RiderFormPage,
  RidersPage,
  SavedAddressesPage,
} from './lazyPages'
import { ADMIN_NAVIGATION, CUSTOMER_NAVIGATION, RIDER_NAVIGATION } from './navigation'

export const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  { path: '/status', element: <SystemStatusPage /> },
  {
    element: <AuthLayout />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        element: <RequireLogin />,
        children: [{ path: '/change-password', element: <ChangePasswordPage /> }],
      },
    ],
  },
  {
    element: <RequireRole role="CUSTOMER" />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/customer',
        element: <PanelLayout navigation={CUSTOMER_NAVIGATION} mode="sidebar" tone="light" />,
        children: [
          { index: true, element: <CustomerDashboardPage /> },
          { path: 'requests/new', element: <RequestMedicinesPage /> },
          { path: 'orders', element: <CustomerOrdersPage /> },
          { path: 'orders/:id', element: <OrderDetailPage /> },
          { path: 'bills', element: <CustomerBillsPage /> },
          { path: 'addresses', element: <SavedAddressesPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'profile', element: <AccountPage title="My profile" /> },
        ],
      },
    ],
  },
  {
    element: <RequireRole role="ADMIN" />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/admin',
        element: <PanelLayout navigation={ADMIN_NAVIGATION} mode="sidebar" tone="dark" />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'orders', element: <AdminOrdersPage /> },
          { path: 'orders/:id', element: <AdminOrderReviewPage /> },
          { path: 'invoices', element: <AdminInvoicesPage /> },
          { path: 'customers', element: <AdminCustomersPage /> },
          { path: 'riders', element: <RidersPage /> },
          { path: 'riders/new', element: <RiderFormPage /> },
          { path: 'riders/:id/edit', element: <RiderFormPage /> },
          { path: 'deliveries', element: <AdminDeliveriesPage /> },
          { path: 'payments', element: <AdminPaymentsPage /> },
          { path: 'reports', element: <AdminReportsPage /> },
          { path: 'delivery-pricing', element: <AdminDeliveryPricingPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'settings', element: <AdminSettingsPage /> },
          { path: 'profile', element: <AccountPage title="My Profile" /> },
        ],
      },
    ],
  },
  {
    element: <RequireRole role="RIDER" />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/rider',
        element: <PanelLayout navigation={RIDER_NAVIGATION} mode="bottom" tone="light" />,
        children: [
          { index: true, element: <RiderDashboardPage /> },
          { path: 'deliveries', element: <RiderAssignedOrdersPage /> },
          { path: 'deliveries/:id', element: <RiderDeliveryDetailPage /> },
          { path: 'history', element: <RiderDeliveryHistoryPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'profile', element: <AccountPage title="My profile" /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
