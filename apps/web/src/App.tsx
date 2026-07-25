import { Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { PublicOnlyRoute } from "@/components/auth/public-only-route";
import { AdminLayout } from "@/layouts/admin-layout";
import { DashboardLayout } from "@/layouts/dashboard-layout";
import { LoginPage } from "@/pages/auth/login-page";
import { SignupPage } from "@/pages/auth/signup-page";
import { AdminBankTransfersPage } from "@/pages/admin/admin-bank-transfers-page";
import { AdminMarketplacePage } from "@/pages/admin/admin-marketplace-page";
import { AdminOverviewPage } from "@/pages/admin/admin-overview-page";
import { EmployeeChatPage } from "@/pages/dashboard/chat/employee-chat-page";
import { EmployeeFormPage } from "@/pages/dashboard/employees/employee-form-page";
import { EmployeesListPage } from "@/pages/dashboard/employees/employees-list-page";
import { KnowledgeListPage } from "@/pages/dashboard/knowledge/knowledge-list-page";
import { KnowledgeNewPage } from "@/pages/dashboard/knowledge/knowledge-new-page";
import { MarketplaceListPage } from "@/pages/dashboard/marketplace/marketplace-list-page";
import { PublishListingPage } from "@/pages/dashboard/marketplace/publish-page";
import { EmployeeMemoriesPage } from "@/pages/dashboard/memories/employee-memories-page";
import { MembersPage } from "@/pages/dashboard/members/members-page";
import { AnalyticsPage } from "@/pages/dashboard/analytics/analytics-page";
import { ApiKeysPage } from "@/pages/dashboard/api-keys/api-keys-page";
import { OrganizationPage } from "@/pages/dashboard/organization-page";
import { OverviewPage } from "@/pages/dashboard/overview-page";
import { ProfilePage } from "@/pages/dashboard/profile-page";
import { TeamChatPage } from "@/pages/dashboard/teams/team-chat-page";
import { TeamFormPage } from "@/pages/dashboard/teams/team-form-page";
import { TeamsListPage } from "@/pages/dashboard/teams/teams-list-page";
import { InvoicePage } from "@/pages/dashboard/wallet/invoice-page";
import { WalletPage } from "@/pages/dashboard/wallet/wallet-page";
import { WorkflowFormPage } from "@/pages/dashboard/workflows/workflow-form-page";
import { WorkflowRunPage } from "@/pages/dashboard/workflows/workflow-run-page";
import { WorkflowsListPage } from "@/pages/dashboard/workflows/workflows-list-page";
import { LandingPage } from "@/pages/landing-page";
import { NotFoundPage } from "@/pages/not-found-page";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnlyRoute>
            <SignupPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="employees" element={<EmployeesListPage />} />
        <Route path="employees/new" element={<EmployeeFormPage />} />
        <Route path="employees/:employeeId/edit" element={<EmployeeFormPage />} />
        <Route path="employees/:employeeId/chat" element={<EmployeeChatPage />} />
        <Route path="employees/:employeeId/memories" element={<EmployeeMemoriesPage />} />
        <Route path="knowledge" element={<KnowledgeListPage />} />
        <Route path="knowledge/new" element={<KnowledgeNewPage />} />
        <Route path="workflows" element={<WorkflowsListPage />} />
        <Route path="workflows/new" element={<WorkflowFormPage />} />
        <Route path="workflows/:workflowId/edit" element={<WorkflowFormPage />} />
        <Route path="workflows/:workflowId/run" element={<WorkflowRunPage />} />
        <Route path="teams" element={<TeamsListPage />} />
        <Route path="teams/new" element={<TeamFormPage />} />
        <Route path="teams/:teamId/edit" element={<TeamFormPage />} />
        <Route path="teams/:teamId/chat" element={<TeamChatPage />} />
        <Route path="marketplace" element={<MarketplaceListPage />} />
        <Route path="marketplace/publish" element={<PublishListingPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="wallet/invoice/:orderId" element={<InvoicePage />} />
        <Route path="settings/profile" element={<ProfilePage />} />
        <Route path="settings/organization" element={<OrganizationPage />} />
        <Route path="settings/members" element={<MembersPage />} />
        <Route path="settings/api-keys" element={<ApiKeysPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="bank-transfers" element={<AdminBankTransfersPage />} />
        <Route path="marketplace" element={<AdminMarketplacePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
